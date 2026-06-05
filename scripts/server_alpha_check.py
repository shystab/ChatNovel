"""Basic server-branch Alpha checks.

This script uses a disposable SQLite database under backend/.test and does not
touch the user's real novel_ide.db.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
TEST_DIR = BACKEND / ".test"
TEST_DB = TEST_DIR / "server_alpha_check.db"

TEST_DIR.mkdir(parents=True, exist_ok=True)
for suffix in ("", "-wal", "-shm"):
    path = Path(str(TEST_DB) + suffix)
    if path.exists():
        path.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["AUTH_REQUIRED"] = "true"
os.environ["ENABLE_LOCAL_EMBEDDINGS"] = "false"
os.environ["DEEPSEEK_API_KEY"] = ""
os.environ["OPENAI_API_KEY"] = ""
os.environ.pop("APP_ACCESS_TOKEN", None)

sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


API = "/api/v1"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def request(client: TestClient, method: str, path: str, token: str | None = None, **kwargs):
    headers = kwargs.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    response = client.request(method, path, headers=headers, **kwargs)
    return response


def json_ok(client: TestClient, method: str, path: str, token: str | None = None, **kwargs):
    response = request(client, method, path, token=token, **kwargs)
    require(response.status_code < 400, f"{method} {path} failed: {response.status_code} {response.text}")
    return response.json()


def main() -> None:
    with TestClient(app) as client:
        unauthorized = request(client, "GET", f"{API}/books/")
        require(unauthorized.status_code == 401, "AUTH_REQUIRED=true should protect book APIs")

        admin_auth = json_ok(
            client,
            "POST",
            f"{API}/auth/register",
            json={"username": "alice", "password": "password123"},
        )
        admin_token = admin_auth["access_token"]
        require(admin_auth["user"]["is_admin"] is True, "first user should become admin")

        invite = json_ok(
            client,
            "POST",
            f"{API}/auth/invites",
            token=admin_token,
            json={"max_uses": 1, "expires_days": 14},
        )
        require(invite["code"], "admin invite code should be generated")

        bob_auth = json_ok(
            client,
            "POST",
            f"{API}/auth/register",
            json={"username": "bob", "password": "password123", "invite_code": invite["code"]},
        )
        bob_token = bob_auth["access_token"]
        require(bob_auth["user"]["is_admin"] is False, "invited user should not become admin")

        admin_book = json_ok(
            client,
            "POST",
            f"{API}/books/",
            token=admin_token,
            json={"title": "Alice Book"},
        )
        require(admin_book["user_id"] == "alice", "created book should belong to current user")

        bob_cannot_get = request(client, "GET", f"{API}/books/{admin_book['id']}", token=bob_token)
        require(bob_cannot_get.status_code == 404, "user B should not see user A's book")

        chapter = json_ok(
            client,
            "POST",
            f"{API}/books/{admin_book['id']}/chapters",
            token=admin_token,
            json={"title": "Chapter 1", "content": "hello alpha", "summary": "", "order": 1},
        )
        updated = json_ok(
            client,
            "PATCH",
            f"{API}/books/{admin_book['id']}/chapters/{chapter['id']}",
            token=admin_token,
            json={"content": "hello alpha saved"},
        )
        require(updated["content"] == "hello alpha saved", "chapter content should save")

        bob_chapter = request(
            client,
            "GET",
            f"{API}/books/{admin_book['id']}/chapters/{chapter['id']}",
            token=bob_token,
        )
        require(bob_chapter.status_code == 404, "user B should not see user A's chapter")

        bob_books = json_ok(client, "GET", f"{API}/books/", token=bob_token)
        require(all(item["user_id"] == "bob" for item in bob_books), "book list should be user-scoped")

        settings_a = json_ok(client, "GET", f"{API}/settings/", token=admin_token)
        settings_b = json_ok(client, "GET", f"{API}/settings/", token=bob_token)
        require(settings_a["user_id"] == "alice" and settings_b["user_id"] == "bob", "settings should be user-scoped")

        profile = json_ok(
            client,
            "PATCH",
            f"{API}/users/me",
            token=admin_token,
            json={
                "display_name": "Alice Writer",
                "bio": "writes moon cities",
                "current_work": "a moon city novella",
                "avatar_color": "#fb7185",
            },
        )
        require(profile["display_name"] == "Alice Writer", "user profile should update")
        require(profile["current_work"] == "a moon city novella", "current work should update")

        avatar_upload = request(
            client,
            "POST",
            f"{API}/users/me/avatar",
            token=admin_token,
            files={"file": ("avatar.png", b"fake-image", "image/png")},
        )
        require(avatar_upload.status_code < 400, "avatar upload should work")
        avatar_file = request(
            client,
            "GET",
            f"{API}/users/alice/avatar",
            params={"auth_token": admin_token},
        )
        require(avatar_file.status_code == 200, "avatar file should accept auth_token query param")
        avatar_upload_again = request(
            client,
            "POST",
            f"{API}/users/me/avatar",
            token=admin_token,
            files={"file": ("avatar.png", b"fake-image-2", "image/png")},
        )
        require(avatar_upload_again.status_code < 400, "avatar re-upload should work")
        avatar_file_again = request(
            client,
            "GET",
            f"{API}/users/alice/avatar",
            params={"auth_token": admin_token},
        )
        require(avatar_file_again.status_code == 200, "avatar re-upload should not delete the saved file")

        bob_users = json_ok(client, "GET", f"{API}/users/", token=bob_token)
        require(any(item["username"] == "alice" for item in bob_users), "users list should show other active users")
        require(all(item["username"] != "bob" for item in bob_users), "users list should hide current user")

        message = json_ok(
            client,
            "POST",
            f"{API}/users/messages",
            token=bob_token,
            json={"to_user": "alice", "content": "hello from bob"},
        )
        require(message["sender_username"] == "bob" and message["recipient_username"] == "alice", "direct message should send")

        thread = json_ok(
            client,
            "GET",
            f"{API}/users/messages",
            token=admin_token,
            params={"with_user": "bob"},
        )
        require(thread and thread[0]["content"] == "hello from bob", "direct message thread should load")

        card = json_ok(
            client,
            "POST",
            f"{API}/users/showcases",
            token=admin_token,
            json={
                "title": "Moon City",
                "subtitle": "alpha fragment",
                "excerpt": "silver gate",
                "content": "The silver gate opened under the moon.",
                "is_public": True,
            },
        )
        require(card["user_id"] == "alice", "showcase card should belong to current user")

        public_cards = json_ok(client, "GET", f"{API}/users/alice/showcases", token=bob_token)
        require(public_cards and public_cards[0]["title"] == "Moon City", "public showcase should be visible to friends")

        cover_upload = request(
            client,
            "POST",
            f"{API}/users/showcases/{card['id']}/cover",
            token=admin_token,
            files={"file": ("cover.png", b"fake-cover", "image/png")},
        )
        require(cover_upload.status_code < 400, "showcase cover upload should work")
        cover_file = request(
            client,
            "GET",
            f"{API}/users/showcases/{card['id']}/cover",
            params={"auth_token": admin_token},
        )
        require(cover_file.status_code == 200, "showcase cover should accept auth_token query param")
        cover_upload_again = request(
            client,
            "POST",
            f"{API}/users/showcases/{card['id']}/cover",
            token=admin_token,
            files={"file": ("cover.png", b"fake-cover-2", "image/png")},
        )
        require(cover_upload_again.status_code < 400, "showcase cover re-upload should work")
        cover_file_again = request(
            client,
            "GET",
            f"{API}/users/showcases/{card['id']}/cover",
            params={"auth_token": admin_token},
        )
        require(cover_file_again.status_code == 200, "showcase cover re-upload should not delete the saved file")

        hidden = json_ok(
            client,
            "PATCH",
            f"{API}/users/showcases/{card['id']}",
            token=admin_token,
            json={"is_public": False},
        )
        require(hidden["is_public"] is False, "showcase visibility should update")
        hidden_from_bob = json_ok(client, "GET", f"{API}/users/alice/showcases", token=bob_token)
        require(all(item["id"] != card["id"] for item in hidden_from_bob), "hidden showcase should not be visible to friends")

        upload_without_vector = request(
            client,
            "POST",
            f"{API}/knowledge/upload",
            token=admin_token,
            json={
                "user_id": "ignored",
                "project_id": "default_project",
                "title": "External Notes",
                "text": "moonstone city has a silver gate and alpha keyword",
            },
        )
        require(upload_without_vector.status_code == 503, "knowledge upload should require vector embeddings")

        search_without_vector = request(
            client,
            "GET",
            f"{API}/knowledge/search",
            token=admin_token,
            params={"user_id": "ignored", "project_id": "default_project", "q": "moonstone", "top_k": 5},
        )
        require(search_without_vector.status_code == 503, "knowledge search should require vector embeddings")

        docs = json_ok(
            client,
            "GET",
            f"{API}/knowledge/documents",
            token=admin_token,
            params={"user_id": "ignored", "project_id": "default_project"},
        )
        require(docs["total"] == 0, "failed vector upload should not create documents")

        rag_health = json_ok(client, "GET", f"{API}/knowledge/health", token=admin_token)
        require(rag_health["retrieval_mode"] == "vector", "external knowledge should be vector-only")
        require(rag_health["vector_ready"] is False, "test disables local embeddings, so vector should be off")

        reindex_without_vector = request(
            client,
            "POST",
            f"{API}/knowledge/reindex",
            token=admin_token,
            params={"project_id": "default_project"},
        )
        require(reindex_without_vector.status_code == 503, "reindex should require vector embeddings")

        health = json_ok(client, "GET", f"{API}/ai/health", token=admin_token)
        require(health["configured"] is False, "AI without API key should report unconfigured")

    print("server alpha check passed")


if __name__ == "__main__":
    main()
