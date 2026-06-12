"""Focused regression checks for NovelCat AI context boundaries."""

from __future__ import annotations

import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"

os.environ.setdefault("ENABLE_LOCAL_EMBEDDINGS", "false")
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

import app.services.ai_service as ai_module  # noqa: E402
from app.services.ai_provider import BaseAIProvider  # noqa: E402
from app.services.ai_service import AIService, EXTERNAL_REFERENCE_BOUNDARY  # noqa: E402


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


class StubProvider(BaseAIProvider):
    def chat(self, messages, **kwargs) -> str:
        return ""

    def stream_chat(self, messages, **kwargs):
        yield ""


class RecordingAIService(AIService):
    def __init__(self):
        super().__init__(provider=StubProvider())
        self.layered_kwargs: dict = {}

    def build_layered_memory_context(self, **kwargs) -> str:
        self.layered_kwargs = kwargs
        return ""


class StubKnowledgeService:
    vector_enabled = True

    def __init__(self):
        self.external_query = ""
        self.external_top_k = 0

    def search_external(self, **kwargs) -> list[dict]:
        self.external_query = kwargs["query"]
        self.external_top_k = kwargs["top_k"]
        return [
            {"text": "外部人物甲与外部人物乙发生了外部事件。", "meta": {"document_id": 1}},
            {"text": "另一段仅供参考的外部资料。", "meta": {"document_id": 1}},
            {"text": "这条不应进入自动上下文。", "meta": {"document_id": 1}},
        ][: self.external_top_k]

    def search_chapters(self, **kwargs) -> list[dict]:
        return []


def main() -> None:
    service = RecordingAIService()

    service._build_auto_context(
        messages=[{"role": "user", "content": "继续写这一章"}],
        current_content="当前小说正文末尾。",
        current_chapter_id=None,
        user_id="alice",
        project_id="default",
        book_id=None,
        selected_doc_ids=[1],
    )
    require(
        service.layered_kwargs["use_external_rag"] is False,
        "selecting documents alone must not auto-inject external references",
    )

    service._build_auto_context(
        messages=[{"role": "user", "content": "保持当前文风继续写"}],
        current_content="当前小说正文末尾。",
        current_chapter_id=None,
        user_id="alice",
        project_id="default",
        book_id=None,
        selected_doc_ids=[1],
    )
    require(
        service.layered_kwargs["use_external_rag"] is False,
        "the current book's style must not be confused with an external style reference",
    )

    service._build_auto_context(
        messages=[{"role": "user", "content": "参考外部语料的文风改写这一段"}],
        current_content="当前小说正文末尾。",
        current_chapter_id=None,
        user_id="alice",
        project_id="default",
        book_id=None,
        selected_doc_ids=[1],
    )
    require(
        service.layered_kwargs["use_external_rag"] is True,
        "an explicit style-reference request should enable external references",
    )
    require(
        service.layered_kwargs["external_query"] == "参考外部语料的文风改写这一段",
        "external search should use the explicit user request without the chapter tail",
    )

    knowledge = StubKnowledgeService()
    original_get_knowledge_service = ai_module.get_knowledge_service
    ai_module.get_knowledge_service = lambda: knowledge
    try:
        context = AIService(provider=StubProvider()).build_unified_rag_context(
            user_id="alice",
            project_id="default",
            book_id=None,
            query="内部检索问题\n\n当前上下文末尾：本书人物和事件",
            external_query="明确的外部资料问题",
            top_k=5,
            use_external=True,
            use_chapters=False,
            selected_doc_ids=[1],
        )
    finally:
        ai_module.get_knowledge_service = original_get_knowledge_service

    require(knowledge.external_query == "明确的外部资料问题", "external RAG should use its separate query")
    require(knowledge.external_top_k == 2, "automatic external context should be capped at two snippets")
    require(EXTERNAL_REFERENCE_BOUNDARY in context, "external context must include the reference boundary")
    require("这条不应进入自动上下文" not in context, "automatic context should not include excess snippets")

    print("AI context boundary checks passed.")


if __name__ == "__main__":
    main()
