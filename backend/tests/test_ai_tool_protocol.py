from __future__ import annotations

import unittest

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.models.books import Book
from app.models.chapters import Chapter
from app.services.ai_provider import BaseAIProvider
from app.services.ai_service import AIService
from app.services.ai_tool_protocol import (
    contains_tool_protocol,
    parse_tool_calls,
    strip_tool_protocol,
)


DSML_CALL = """<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="get_current_chapter">
<｜｜DSML｜｜parameter name="chapter_id" string="false">第 8 章</｜｜DSML｜｜parameter>
</｜｜DSML｜｜invoke>
</｜｜DSML｜｜tool_calls>"""


class ScriptedProvider(BaseAIProvider):
    def __init__(self, chat_responses: list[str], stream_chunks: list[str]) -> None:
        self.chat_responses = chat_responses
        self.stream_chunks = stream_chunks

    def chat(self, messages, **kwargs) -> str:
        return self.chat_responses.pop(0)

    def stream_chat(self, messages, **kwargs):
        yield from self.stream_chunks


class AiToolProtocolTests(unittest.TestCase):
    def test_dsml_tool_calls_are_parsed(self) -> None:
        calls = parse_tool_calls(DSML_CALL)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["function"]["name"], "get_current_chapter")
        self.assertEqual(calls[0]["function"]["arguments"]["chapter_id"], "第 8 章")
        self.assertTrue(contains_tool_protocol(DSML_CALL))
        self.assertEqual(strip_tool_protocol(f"正常回答\n{DSML_CALL}"), "正常回答")

    def test_stream_chat_executes_dsml_tool_before_final_answer(self) -> None:
        provider = ScriptedProvider([DSML_CALL, ""], ["这五章的整体节奏很自然。"])
        service = AIService(provider=provider)
        output = list(service.stream_chat(
            messages=[{"role": "user", "content": "评价这五章"}],
            current_content="当前章节正文",
        ))
        tool_steps = [
            item["step"]
            for item in output
            if isinstance(item, dict) and item.get("type") == "agent_step" and item["step"].get("phase") == "tool"
        ]
        text = "".join(item for item in output if isinstance(item, str))
        self.assertTrue(any(step["title"] == "get_current_chapter" and step["status"] == "completed" for step in tool_steps))
        self.assertEqual(text, "这五章的整体节奏很自然。")
        self.assertNotIn("DSML", text)

    def test_final_protocol_leak_is_replaced_with_safe_message(self) -> None:
        provider = ScriptedProvider([""], [DSML_CALL])
        output = list(AIService(provider=provider).stream_chat(
            messages=[{"role": "user", "content": "评价这五章"}],
            current_content="当前章节正文",
        ))
        text = "".join(item for item in output if isinstance(item, str))
        self.assertNotIn("DSML", text)
        self.assertIn("重新生成", text)

    def test_recent_and_referenced_chapters_stay_inside_user_book(self) -> None:
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        with Session(engine) as session:
            alice_book = Book(title="Alice", user_id="alice")
            bob_book = Book(title="Bob", user_id="bob")
            session.add(alice_book)
            session.add(bob_book)
            session.commit()
            session.refresh(alice_book)
            session.refresh(bob_book)
            alice_chapters = [
                Chapter(title=f"A{i}", content=f"alice-{i}", order=i, book_id=alice_book.id)
                for i in range(1, 6)
            ]
            session.add_all(alice_chapters)
            session.add(Chapter(title="B5", content="bob-secret", order=5, book_id=bob_book.id))
            session.commit()
            for chapter in alice_chapters:
                session.refresh(chapter)

            service = AIService(provider=ScriptedProvider([], []), session=session)
            recent = service.get_recent_chapters(alice_chapters[-1].id, alice_book.id, "alice", count=3)
            referenced = service.get_chapter_by_reference("第 4 章", alice_book.id, "alice")
            forbidden = service.get_chapter_by_reference("第 5 章", bob_book.id, "alice")

            self.assertIn("alice-3", recent)
            self.assertIn("alice-5", recent)
            self.assertNotIn("bob-secret", recent)
            self.assertIn("alice-4", referenced)
            self.assertNotIn("bob-secret", forbidden)


if __name__ == "__main__":
    unittest.main()
