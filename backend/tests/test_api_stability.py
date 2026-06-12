from __future__ import annotations

import unittest
from contextlib import ExitStack
from tempfile import TemporaryDirectory
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings
from app.db.session import get_session
from app.main import app
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument


class ApiStabilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        def test_session():
            with Session(cls.engine) as session:
                yield session

        app.dependency_overrides[get_session] = test_session
        cls.original_auth_required = settings.AUTH_REQUIRED
        cls.original_app_access_token = settings.APP_ACCESS_TOKEN
        cls.original_deepseek_key = settings.DEEPSEEK_API_KEY
        cls.original_openai_key = settings.OPENAI_API_KEY
        cls.original_workspace_dir = settings.NOVEL_WORKSPACE_DIR
        cls.test_workspace = TemporaryDirectory()
        settings.AUTH_REQUIRED = True
        settings.APP_ACCESS_TOKEN = None
        settings.DEEPSEEK_API_KEY = None
        settings.OPENAI_API_KEY = None
        settings.NOVEL_WORKSPACE_DIR = cls.test_workspace.name
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.client.close()
        app.dependency_overrides.clear()
        settings.AUTH_REQUIRED = cls.original_auth_required
        settings.APP_ACCESS_TOKEN = cls.original_app_access_token
        settings.DEEPSEEK_API_KEY = cls.original_deepseek_key
        settings.OPENAI_API_KEY = cls.original_openai_key
        settings.NOVEL_WORKSPACE_DIR = cls.original_workspace_dir
        cls.test_workspace.cleanup()
        cls.engine.dispose()

    def setUp(self) -> None:
        SQLModel.metadata.drop_all(self.engine)
        SQLModel.metadata.create_all(self.engine)
        self.patches = ExitStack()
        self.patches.enter_context(patch("app.api.v1.endpoints.books.write_project_manifest"))
        self.patches.enter_context(patch("app.api.v1.endpoints.books.write_chapter_file"))
        self.patches.enter_context(patch("app.api.v1.endpoints.books.delete_chapter_files"))

    def tearDown(self) -> None:
        self.patches.close()

    def register(self, username: str, invite_code: str | None = None) -> dict:
        payload = {"username": username, "password": "password-123"}
        if invite_code:
            payload["invite_code"] = invite_code
        response = self.client.post("/api/v1/auth/register", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    @staticmethod
    def auth_headers(auth: dict) -> dict[str, str]:
        return {"Authorization": f"Bearer {auth['access_token']}"}

    def create_invited_user(self) -> tuple[dict, dict]:
        admin = self.register("admin")
        invite_response = self.client.post(
            "/api/v1/auth/invites",
            json={"max_uses": 1, "expires_days": 14},
            headers=self.auth_headers(admin),
        )
        self.assertEqual(invite_response.status_code, 201, invite_response.text)
        member = self.register("member", invite_response.json()["code"])
        return admin, member

    def test_auth_required_first_user_admin_and_invite_registration(self) -> None:
        self.assertEqual(self.client.get("/api/v1/books/").status_code, 401)

        admin, member = self.create_invited_user()
        self.assertTrue(admin["user"]["is_admin"])
        self.assertFalse(member["user"]["is_admin"])

        reused_invite = self.client.post(
            "/api/v1/auth/register",
            json={
                "username": "third-user",
                "password": "password-123",
                "invite_code": "invalid-code",
            },
        )
        self.assertEqual(reused_invite.status_code, 400)

    def test_books_chapters_conversations_settings_and_knowledge_are_isolated(self) -> None:
        admin, member = self.create_invited_user()
        admin_headers = self.auth_headers(admin)
        member_headers = self.auth_headers(member)

        book_response = self.client.post(
            "/api/v1/books/",
            json={"title": "Admin book"},
            headers=admin_headers,
        )
        self.assertEqual(book_response.status_code, 201, book_response.text)
        book_id = book_response.json()["id"]

        chapter_response = self.client.post(
            f"/api/v1/books/{book_id}/chapters",
            json={"title": "Chapter one", "content": "private text", "order": 1},
            headers=admin_headers,
        )
        self.assertEqual(chapter_response.status_code, 201, chapter_response.text)
        chapter_id = chapter_response.json()["id"]

        conversation_response = self.client.post(
            "/api/v1/conversations/",
            json={"title": "Private conversation", "messages": [{"role": "user", "content": "secret"}]},
            headers=admin_headers,
        )
        self.assertEqual(conversation_response.status_code, 201, conversation_response.text)
        conversation_id = conversation_response.json()["id"]

        admin_settings = self.client.patch(
            "/api/v1/settings/",
            json={"font_size": 22},
            headers=admin_headers,
        )
        self.assertEqual(admin_settings.status_code, 200, admin_settings.text)

        with Session(self.engine) as session:
            document = KnowledgeDocument(user_id="admin", project_id=str(book_id), title="Private notes")
            session.add(document)
            session.commit()
            session.refresh(document)
            session.add(
                KnowledgeChunk(
                    document_id=document.id,
                    user_id="admin",
                    project_id=str(book_id),
                    text="private knowledge",
                )
            )
            session.commit()
            document_id = document.id

        self.assertEqual(self.client.get(f"/api/v1/books/{book_id}", headers=member_headers).status_code, 404)
        self.assertEqual(
            self.client.get(f"/api/v1/books/{book_id}/chapters/{chapter_id}", headers=member_headers).status_code,
            404,
        )
        self.assertEqual(
            self.client.get(f"/api/v1/conversations/{conversation_id}", headers=member_headers).status_code,
            404,
        )
        self.assertEqual(self.client.get("/api/v1/books/", headers=member_headers).json(), [])
        self.assertEqual(self.client.get("/api/v1/conversations/?include_empty=true", headers=member_headers).json(), [])

        member_settings = self.client.get("/api/v1/settings/", headers=member_headers)
        self.assertEqual(member_settings.status_code, 200, member_settings.text)
        self.assertEqual(member_settings.json()["font_size"], 16)

        member_documents = self.client.get(
            f"/api/v1/knowledge/documents?user_id=admin&project_id={book_id}",
            headers=member_headers,
        )
        self.assertEqual(member_documents.status_code, 200, member_documents.text)
        self.assertEqual(member_documents.json()["items"], [])
        self.assertEqual(
            self.client.delete(f"/api/v1/knowledge/documents/{document_id}", headers=member_headers).status_code,
            404,
        )

    def test_ai_health_reports_missing_key_without_calling_provider(self) -> None:
        admin = self.register("admin")
        response = self.client.get("/api/v1/ai/health", headers=self.auth_headers(admin))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()["configured"])

    def test_chapter_revision_history_can_restore_and_stays_private(self) -> None:
        admin, member = self.create_invited_user()
        admin_headers = self.auth_headers(admin)
        member_headers = self.auth_headers(member)
        book = self.client.post("/api/v1/books/", json={"title": "Revision book"}, headers=admin_headers).json()
        chapter = self.client.post(
            f"/api/v1/books/{book['id']}/chapters",
            json={"title": "Chapter", "content": "version one", "order": 1},
            headers=admin_headers,
        ).json()

        updated = self.client.patch(
            f"/api/v1/books/{book['id']}/chapters/{chapter['id']}",
            json={"content": "version two"},
            headers=admin_headers,
        )
        self.assertEqual(updated.status_code, 200, updated.text)

        history = self.client.get(
            f"/api/v1/books/{book['id']}/chapters/{chapter['id']}/revisions",
            headers=admin_headers,
        )
        self.assertEqual(history.status_code, 200, history.text)
        self.assertEqual(history.json()[0]["content"], "version one")
        revision_id = history.json()[0]["id"]

        self.assertEqual(
            self.client.get(
                f"/api/v1/books/{book['id']}/chapters/{chapter['id']}/revisions",
                headers=member_headers,
            ).status_code,
            404,
        )

        restored = self.client.post(
            f"/api/v1/books/{book['id']}/chapters/{chapter['id']}/revisions/{revision_id}/restore",
            headers=admin_headers,
        )
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertEqual(restored.json()["content"], "version one")

    def test_admin_can_manage_login_cover_and_user_access(self) -> None:
        admin, member = self.create_invited_user()
        admin_headers = self.auth_headers(admin)
        member_headers = self.auth_headers(member)

        member_upload = self.client.post(
            "/api/v1/admin/login-cover",
            files={"file": ("cover.jpg", b"member-cover", "image/jpeg")},
            headers=member_headers,
        )
        self.assertEqual(member_upload.status_code, 403)

        upload = self.client.post(
            "/api/v1/admin/login-cover",
            files={"file": ("cover.jpg", b"admin-cover", "image/jpeg")},
            headers=admin_headers,
        )
        self.assertEqual(upload.status_code, 200, upload.text)
        cover = self.client.get("/api/v1/admin/login-cover")
        self.assertEqual(cover.status_code, 200, cover.text)
        self.assertEqual(cover.content, b"admin-cover")

        member_cannot_manage = self.client.patch(
            "/api/v1/admin/users/admin",
            json={"is_active": False},
            headers=member_headers,
        )
        self.assertEqual(member_cannot_manage.status_code, 403)

        self_cannot_disable = self.client.patch(
            "/api/v1/admin/users/admin",
            json={"is_active": False},
            headers=admin_headers,
        )
        self.assertEqual(self_cannot_disable.status_code, 400)

        disabled = self.client.patch(
            "/api/v1/admin/users/member",
            json={"is_active": False},
            headers=admin_headers,
        )
        self.assertEqual(disabled.status_code, 200, disabled.text)
        self.assertFalse(disabled.json()["is_active"])
        self.assertEqual(
            self.client.post(
                "/api/v1/auth/login",
                json={"username": "member", "password": "password-123"},
            ).status_code,
            401,
        )

        restored = self.client.patch(
            "/api/v1/admin/users/member",
            json={"is_active": True, "is_admin": True},
            headers=admin_headers,
        )
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertTrue(restored.json()["is_active"])
        self.assertTrue(restored.json()["is_admin"])

        clear = self.client.delete("/api/v1/admin/login-cover", headers=admin_headers)
        self.assertEqual(clear.status_code, 204, clear.text)
        self.assertEqual(self.client.get("/api/v1/admin/login-cover").status_code, 404)


if __name__ == "__main__":
    unittest.main()
