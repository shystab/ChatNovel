"""
AI 服务层 - 通用 AI 服务（工具调用版）
"""
import json
import logging
import re
from dataclasses import dataclass
from typing import List

from sqlmodel import Session, select, or_
from openai.types.chat import ChatCompletionMessageParam

from app.services.ai_provider import BaseAIProvider, get_ai_provider
from app.services.knowledge_service import get_knowledge_service
from app.crud.memory_crud import get_enabled_preset, get_memory_summary
from app.crud.preset_crud import get_enabled_preset_new
from app.crud.crud import get_chapter, get_chapters_by_book
from app.crud.crud import get_nearby_chapter_summaries
from app.models.ai import AgentEditOperation, AgentEditPlan
from app.models.books import Book
from app.models.chapters import Chapter
from app.models.knowledge import KnowledgeChunk, KnowledgeDocument

# ──────────────────────────────────────────────
# 内置 System Prompt（写作人格）
# ──────────────────────────────────────────────
DEFAULT_WRITER_PERSONA = """你是一个专业的小说写作助手。

核心原则：
- 直接给结果，不解释、不废话、不道歉
- 续写/改写时只输出正文，无任何说明
- 回答问题时简洁精准，能一句说清绝不两句
- 保持原作者的文风和语气
- 中文写作默认使用正式小说语言，避免口水化表达

禁止行为：
- 禁止以"好的"、"当然"、"我来帮你"开头
- 禁止在正文外附加任何解释或总结
- 禁止重复用户说过的话
- 禁止过度热情的语气"""

DEFAULT_SUMMARY_SYSTEM = "你是专业小说摘要生成助手。请为以下章节内容生成简洁准确的摘要，概括核心情节和关键信息。"

logger = logging.getLogger(__name__)

FORESHADOWING_KEYWORDS = (
    "伏笔", "暗示", "预感", "异样", "奇怪", "秘密", "隐瞒", "真相", "疑点", "谜",
    "梦", "旧", "伤疤", "钥匙", "信", "照片", "玉佩", "项链", "标记", "符号",
    "突然", "似乎", "仿佛", "没有解释", "说不清", "记不起", "忘记", "沉默",
    "为什么", "不对劲", "第一次", "最后一次",
)

AGENT_EDIT_ACTIONS = {
    "append",
    "prepend",
    "replace_all",
    "insert_before",
    "insert_after",
    "replace_text",
}


@dataclass(frozen=True)
class MemoryProfile:
    """不同写作需求对应的自动记忆层配置。"""

    name: str
    label: str
    current_chars: int = 1800
    use_nearby: bool = True
    nearby_before: int = 2
    nearby_after: int = 1
    use_chapter_rag: bool = True
    use_external_rag: bool = False
    rag_top_k: int = 3
    use_book_outline: bool = False
    book_outline_limit: int = 50
    use_foreshadowing_scan: bool = False
    foreshadowing_scope: str = "current"


# ──────────────────────────────────────────────
# 工具定义（Function Calling）
# ──────────────────────────────────────────────
WRITING_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_chapter",
            "description": "读取当前编辑器/当前章节内容。适合续写、改写、总结本章、检查当前正文时调用。",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_nearby_chapters_summary",
            "description": "获取当前章节前后章节摘要，用于理解最近剧情、承接关系和人物状态。",
            "parameters": {
                "type": "object",
                "properties": {
                    "before": {"type": "integer", "description": "向前读取几章摘要，默认3"},
                    "after": {"type": "integer", "description": "向后读取几章摘要，默认1"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_my_chapters",
            "description": "在自己的小说全书中检索相关片段。这属于内部写作上下文，不是外部语料 RAG。适合查人物、设定、伏笔、事件、前后矛盾。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词或问题"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_external_reference",
            "description": "在用户上传/选中的外部语料中检索参考。可用于文风、设定、范例情节、资料灵感，但不要直接复制原文。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"},
                    "purpose": {
                        "type": "string",
                        "enum": ["reference", "style", "setting", "plot"],
                        "description": "检索用途：reference通用参考，style文风，setting设定资料，plot情节范例"
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_book_outline",
            "description": "获取当前书籍的章节摘要索引。适合用户询问全书结构、情节推进、伏笔回收、前后文关系时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "limit": {"type": "integer", "description": "最多返回多少章，默认80"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "extract_foreshadowing_candidates",
            "description": "扫描当前章节或全书中的伏笔/疑点候选句。适合用户问伏笔、悬念、未回收线索、埋线、疑点时调用。",
            "parameters": {
                "type": "object",
                "properties": {
                    "scope": {
                        "type": "string",
                        "enum": ["current", "book"],
                        "description": "扫描范围：current 当前章节，book 当前书籍"
                    }
                }
            }
        }
    }
]


class AIService:
    def __init__(self, provider: BaseAIProvider, session: Session | None = None, user_id: str = "default_user"):
        self.provider = provider
        self.session = session
        self.user_id = user_id

    # ──────────────────────────────────────────────
    # 辅助方法
    # ──────────────────────────────────────────────
    def _create_messages(self, system: str, user: str) -> list[ChatCompletionMessageParam]:
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ]

    def _get_persona(self, user_id: str, project_id: str) -> str:
        if not self.session:
            return DEFAULT_WRITER_PERSONA

        # 尝试从全局预设系统获取（preset_crud）
        global_preset = get_enabled_preset_new(self.session, user_id=user_id)
        if global_preset and global_preset.system_prompt.strip():
            logger.debug("Using global preset id=%s", global_preset.id)
            return global_preset.system_prompt.strip()

        # 如果全局预设没有启用的，尝试从用户特定预设系统获取（memory_crud）
        user_preset = get_enabled_preset(self.session, user_id, project_id)
        if user_preset and user_preset.system_prompt.strip():
            logger.debug("Using user preset id=%s", user_preset.id)
            return user_preset.system_prompt.strip()

        return DEFAULT_WRITER_PERSONA

    def _get_memory_context(self, user_id: str, project_id: str) -> str:
        if not self.session:
            return ""
        summary = get_memory_summary(self.session, user_id, project_id)
        if summary and summary.summary.strip():
            return f"【前情提要】\n{summary.summary.strip()}"
        return ""

    def _get_generation_config(self) -> dict:
        config = {"temperature": 0.7, "max_tokens": 1000}
        if self.session:
            from app.crud.settings_crud import get_settings
            db_settings = get_settings(self.session, user_id=self.user_id)
            if db_settings:
                config["temperature"] = db_settings.temperature if db_settings.temperature is not None else config["temperature"]
                config["max_tokens"] = db_settings.max_tokens or config["max_tokens"]
        config["temperature"] = max(0.0, min(float(config["temperature"]), 2.0))
        config["max_tokens"] = max(256, min(int(config["max_tokens"]), 8000))
        return config

    def _get_summary_config(self) -> dict:
        config = {"style": "concise"}
        if self.session:
            from app.crud.settings_crud import get_settings
            db_settings = get_settings(self.session, user_id=self.user_id)
            if db_settings and db_settings.summary_generation_style:
                config["style"] = db_settings.summary_generation_style
        return config

    def _get_chat_context_config(self) -> dict:
        config = {
            "current_chapter_chars": 1800,
            "chat_use_chapter_rag": True,
            "suggest_use_external_rag": False,
            "external_rag_weight": 30,
        }
        if self.session:
            from app.crud.settings_crud import get_settings
            db_settings = get_settings(self.session, user_id=self.user_id)
            if db_settings:
                config["current_chapter_chars"] = max(500, min(db_settings.current_chapter_chars or 1800, 6000))
                config["chat_use_chapter_rag"] = bool(db_settings.chat_use_chapter_rag)
                config["suggest_use_external_rag"] = bool(db_settings.suggest_use_external_rag)
                config["external_rag_weight"] = db_settings.external_rag_weight or 30
        return config

    def _latest_user_query(self, messages: List[dict], current_content: str = "") -> str:
        for msg in reversed(messages):
            if msg.get("role") == "user" and str(msg.get("content", "")).strip():
                return str(msg["content"]).strip()
        return current_content[-1000:].strip()

    def _prepare_chat_messages(self, messages: List[dict], *, keep_last: int = 16, content_limit: int = 3000) -> List[dict]:
        """清理和裁剪对话历史，避免长对话拖慢/稀释当前任务。"""
        allowed_roles = {"user", "assistant", "system", "tool"}
        cleaned: list[dict] = []
        for msg in messages:
            role = msg.get("role")
            if role not in allowed_roles:
                continue
            content = msg.get("content")
            if content is None and role != "assistant":
                continue
            next_msg = dict(msg)
            if isinstance(content, str):
                next_msg["content"] = self._clip_text(self._plain_text(content), content_limit)
            cleaned.append(next_msg)

        if len(cleaned) <= keep_last:
            return cleaned

        recent = cleaned[-keep_last:]
        # 如果最早一条是 assistant，去掉它，避免没有对应用户上下文的半截问答。
        if recent and recent[0].get("role") == "assistant":
            recent = recent[1:]
        return recent

    @staticmethod
    def _clip_text(text: str, limit: int) -> str:
        text = (text or "").strip()
        if len(text) <= limit:
            return text
        return text[:limit] + "...（已截断）"

    @staticmethod
    def _plain_text(value: str) -> str:
        value = value or ""
        value = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
        value = re.sub(r"</p\s*>", "\n\n", value, flags=re.IGNORECASE)
        value = re.sub(r"<[^>]+>", "", value)
        replacements = {
            "&nbsp;": " ",
            "&lt;": "<",
            "&gt;": ">",
            "&amp;": "&",
            "&quot;": '"',
        }
        for old, new in replacements.items():
            value = value.replace(old, new)
        return re.sub(r"\n{3,}", "\n\n", value).strip()

    def _build_rag_query(self, user_query: str, current_plain: str) -> str:
        user_query = self._clip_text(user_query, 700)
        context_tail = self._clip_text(current_plain[-500:], 500) if current_plain else ""
        if not context_tail or context_tail in user_query:
            return user_query
        return f"{user_query}\n\n当前上下文末尾：{context_tail}".strip()

    @staticmethod
    def _hit_label(hit: dict, fallback: str) -> str:
        meta = hit.get("meta") or {}
        if meta.get("chapter_title"):
            return str(meta["chapter_title"])
        if meta.get("document_id"):
            return f"文档#{meta['document_id']}"
        return fallback

    @staticmethod
    def _split_sentences(text: str) -> list[str]:
        chunks = re.split(r"(?<=[。！？!?；;])\s*|\n+", text)
        return [chunk.strip() for chunk in chunks if chunk and chunk.strip()]

    def _chapter_brief(self, title: str, summary: str, content: str, limit: int = 220) -> str:
        summary = self._plain_text(summary)
        if summary:
            return self._clip_text(summary, limit)
        plain = self._plain_text(content)
        if not plain:
            return "暂无内容"
        sentences = self._split_sentences(plain)
        if not sentences:
            return self._clip_text(plain, limit)
        if len(sentences) == 1:
            return self._clip_text(sentences[0], limit)
        return self._clip_text(f"{sentences[0]} {sentences[-1]}", limit)

    def _detect_memory_profile(self, user_query: str) -> MemoryProfile:
        """按用户需求选择不同的自动记忆层。"""
        query = user_query or ""

        def has_any(words: tuple[str, ...]) -> bool:
            return any(word in query for word in words)

        if has_any(("伏笔", "悬念", "疑点", "埋线", "线索", "回收", "铺垫", "前后呼应")):
            return MemoryProfile(
                name="foreshadowing",
                label="伏笔/线索分析",
                current_chars=2600,
                nearby_before=4,
                nearby_after=2,
                rag_top_k=6,
                use_book_outline=True,
                book_outline_limit=90,
                use_foreshadowing_scan=True,
                foreshadowing_scope="book",
            )

        if has_any(("全书", "大纲", "结构", "节奏", "主线", "支线", "人物弧光", "人物线", "设定矛盾", "前后矛盾", "一致性")):
            return MemoryProfile(
                name="structure",
                label="全书结构/连贯性",
                current_chars=2200,
                nearby_before=4,
                nearby_after=2,
                rag_top_k=6,
                use_book_outline=True,
                book_outline_limit=100,
            )

        if has_any(("总结", "摘要", "概括", "提炼", "梳理本章", "本章讲了", "本章内容")):
            return MemoryProfile(
                name="summary",
                label="本章总结",
                current_chars=4200,
                use_nearby=False,
                use_chapter_rag=False,
                rag_top_k=0,
            )

        if has_any(("文风", "仿写", "模仿", "语气", "笔触", "腔调", "风格", "类似")):
            return MemoryProfile(
                name="style",
                label="文风/语料参考",
                current_chars=2600,
                nearby_before=2,
                nearby_after=0,
                use_chapter_rag=False,
                use_external_rag=True,
                rag_top_k=4,
            )

        if has_any(("润色", "改写", "重写", "扩写", "缩写", "精简", "修改这一段", "优化文笔", "病句", "错别字", "对白")):
            return MemoryProfile(
                name="rewrite",
                label="局部改写/润色",
                current_chars=3600,
                nearby_before=1,
                nearby_after=0,
                use_chapter_rag=False,
                rag_top_k=0,
            )

        if has_any(("续写", "接着写", "继续写", "下一段", "下一章", "补一段", "展开", "生成正文", "写下去")):
            return MemoryProfile(
                name="draft",
                label="续写/正文生成",
                current_chars=3000,
                nearby_before=3,
                nearby_after=1,
                rag_top_k=4,
            )

        return MemoryProfile(name="default", label="通用写作问答")

    def _build_auto_context(
        self,
        *,
        messages: List[dict],
        current_content: str,
        current_chapter_id: int | None,
        user_id: str,
        project_id: str,
        book_id: int | None,
        selected_doc_ids: list[int] | None,
    ) -> str:
        """为聊天入口选择记忆 profile，并复用统一的分层记忆构建链路。"""
        config = self._get_chat_context_config()
        current_plain = self._plain_text(current_content)
        query = self._latest_user_query(messages, current_plain)
        query_for_search = self._build_rag_query(query, current_plain)
        profile = self._detect_memory_profile(query)

        current_limit = max(
            int(config["current_chapter_chars"]),
            int(profile.current_chars),
        )
        current_limit = max(500, min(current_limit, 6000))

        use_external = (
            bool(selected_doc_ids)
            or bool(config["suggest_use_external_rag"])
            or bool(profile.use_external_rag)
        )
        use_chapter_rag = bool(config["chat_use_chapter_rag"]) and bool(profile.use_chapter_rag)

        return self.build_layered_memory_context(
            current_chapter_id=current_chapter_id,
            current_content=current_plain,
            user_id=user_id,
            project_id=project_id,
            book_id=book_id,
            query=query_for_search,
            selected_doc_ids=selected_doc_ids,
            use_current_chapter=True,
            max_current_chars=current_limit,
            use_nearby_summaries=profile.use_nearby,
            nearby_before=profile.nearby_before,
            nearby_after=profile.nearby_after,
            use_rag=bool(profile.rag_top_k) and (use_external or use_chapter_rag),
            rag_top_k=profile.rag_top_k,
            use_external_rag=use_external,
            use_chapter_rag=use_chapter_rag,
            external_rag_weight=int(config["external_rag_weight"]),
            use_book_outline=profile.use_book_outline,
            book_outline_limit=profile.book_outline_limit,
            use_foreshadowing_scan=profile.use_foreshadowing_scan,
            foreshadowing_scope=profile.foreshadowing_scope,
            use_memory_summary=False,
            context_title=f"自动分层记忆：{profile.label}",
        )

    # ──────────────────────────────────────────────
    # 信息工具实现（保持不变）
    # ──────────────────────────────────────────────
    def get_current_chapter(
        self,
        current_chapter_id: int | None,
        book_id: int | None,
        current_content: str = "",
    ) -> str:
        """获取当前编辑器/章节正文（优先使用前端传来的未保存内容）。"""
        chapter = None
        if current_chapter_id and self.session:
            chapter = get_chapter(self.session, current_chapter_id, book_id=book_id)

        content = self._plain_text(current_content)
        if not content and chapter:
            content = self._plain_text(chapter.content)

        if not content:
            return "当前没有可读取的章节内容。"

        title = f"《{chapter.title}》" if chapter else "当前编辑器"
        summary = self._chapter_brief(chapter.title, chapter.summary, chapter.content, limit=260) if chapter else ""
        content = self._clip_text(content, 5000)
        if summary:
            return f"当前章节 {title}\n章节摘要：{summary}\n\n正文：\n{content}"
        return f"{title}内容：\n{content}"

    def get_nearby_chapters_summary(self, current_chapter_id: int | None, before: int = 3, after: int = 1) -> str:
        """返回附近章节摘要"""
        if not self.session:
            return ""
        if not current_chapter_id:
            return "当前没有选中的章节，无法读取附近章节摘要。"
        before = max(0, min(int(before or 3), 8))
        after = max(0, min(int(after or 1), 5))
        nearby = get_nearby_chapter_summaries(
            self.session, current_chapter_id, before_count=before, after_count=after
        )
        if not nearby:
            return "附近没有其他章节。"
        lines = []
        for item in nearby:
            prefix = "前" if item["is_before"] else "后"
            title = item["title"]
            summary = item.get("summary", "无摘要")
            lines.append(f"【{prefix}】《{title}》：{summary}")
        return "附近章节摘要：\n" + "\n".join(lines)

    def search_my_chapters(self, query: str, user_id: str, book_id: int | None, top_k: int = 5) -> str:
        """全书章节检索：内部写作上下文，不属于外部语料 RAG。"""
        if not book_id:
            return "当前没有可检索的书籍上下文。"
        query = (query or "").strip()
        if not query:
            return "没有提供检索关键词。"
        top_k = max(1, min(int(top_k or 5), 10))
        ks = get_knowledge_service()
        hits = ks.search_chapters(
            user_id=user_id,
            book_id=book_id,
            query=query,
            top_k=top_k
        )
        if not hits:
            hits = self._keyword_search_chapters(user_id=user_id, book_id=book_id, query=query, top_k=top_k)
        if not hits:
            return f"未找到与“{query}”相关的章节内容。"
        lines = [f"全书检索结果（相关片段）："]
        for i, h in enumerate(hits, 1):
            source = self._hit_label(h, f"章节{i}")
            lines.append(f"[{i} | {source}] {self._clip_text(h.get('text', ''), 700)}")
        return "\n".join(lines)

    def search_external_reference(
        self,
        query: str,
        user_id: str,
        project_id: str,
        selected_doc_ids: list[int] | None = None,
        purpose: str = "reference",
        top_k: int = 5,
    ) -> str:
        """外部参考语料检索：这部分才是 RAG。"""
        query = (query or "").strip()
        if not query:
            return "没有提供检索关键词。"
        top_k = max(1, min(int(top_k or 5), 10))
        purpose_labels = {
            "style": "文风范例（只借鉴语气、节奏和用词，不要直接复制）",
            "setting": "设定/资料参考",
            "plot": "情节范例参考（只借鉴结构，不要照搬）",
            "reference": "外部参考素材",
        }
        label = purpose_labels.get(purpose, purpose_labels["reference"])
        ks = get_knowledge_service()
        if not ks.vector_enabled:
            return "外部语料向量模型未就绪，无法进行外部 RAG 检索。请先开启并加载 embedding 模型。"
        hits = ks.search_external(
            user_id=user_id,
            project_id=project_id,
            query=query,
            top_k=top_k,
            weight=30,
            document_ids=selected_doc_ids,
        )
        if not hits:
            return f"未找到与'{query}'相关的外部参考内容。"

        lines = [f"{label}："]
        for i, h in enumerate(hits, 1):
            source = self._hit_label(h, f"资料{i}")
            lines.append(f"[{i} | {source}] {self._clip_text(h.get('text', ''), 700)}")
        return "\n".join(lines)

    def _keyword_search_chapters(self, *, user_id: str, book_id: int, query: str, top_k: int) -> list[dict]:
        if not self.session:
            return []
        terms = [term for term in re.split(r"\s+", query.strip()) if term][:4]
        if not terms:
            return []
        stmt = (
            select(Chapter)
            .join(Book, Book.id == Chapter.book_id)
            .where(Book.user_id == user_id)
            .where(Chapter.book_id == book_id)
        )
        term_filters = []
        for term in terms:
            term_filters.append(Chapter.title.contains(term))  # type: ignore[attr-defined]
            term_filters.append(Chapter.summary.contains(term))  # type: ignore[attr-defined]
            term_filters.append(Chapter.content.contains(term))  # type: ignore[attr-defined]
        stmt = stmt.where(or_(*term_filters)).order_by(Chapter.order).limit(top_k)
        chapters = list(self.session.exec(stmt).all())
        return [
            {
                "text": self._plain_text(chapter.summary or chapter.content),
                "meta": {"chapter_id": chapter.id, "chapter_title": chapter.title, "source_type": "keyword"},
                "distance": 0,
            }
            for chapter in chapters
        ]

    def get_style_examples(
        self,
        query: str,
        user_id: str,
        project_id: str,
        selected_doc_ids: list[int] | None = None,
    ) -> str:
        """兼容旧调用：文风检索并入 search_external_reference。"""
        return self.search_external_reference(
            query=query,
            user_id=user_id,
            project_id=project_id,
            selected_doc_ids=selected_doc_ids,
            purpose="style",
        )

    def get_current_chapter_summary(
        self,
        current_chapter_id: int | None,
        book_id: int | None,
        current_content: str = "",
    ) -> str:
        """返回当前章节摘要或轻量提炼结果。"""
        if current_chapter_id and self.session:
            chapter = get_chapter(self.session, current_chapter_id, book_id=book_id)
            if chapter:
                brief = self._chapter_brief(chapter.title, chapter.summary, chapter.content, limit=360)
                return f"当前章节《{chapter.title}》摘要：\n{brief}"

        plain = self._plain_text(current_content)
        if not plain:
            return "当前没有可总结的章节内容。"
        sentences = self._split_sentences(plain)
        if len(sentences) >= 2:
            brief = self._clip_text(f"{sentences[0]} {sentences[-1]}", 360)
        else:
            brief = self._clip_text(plain, 360)
        return f"当前编辑器内容摘要候选：\n{brief}"

    def _extract_json_object(self, raw: str) -> dict:
        """从模型返回中提取 JSON 对象，兼容偶尔出现的代码块。"""
        text = (raw or "").strip()
        for _ in range(3):
            text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
            text = re.sub(r"\s*```$", "", text).strip()
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                start = text.find("{")
                end = text.rfind("}")
                if start < 0 or end <= start:
                    raise
                parsed = json.loads(text[start:end + 1])

            if isinstance(parsed, dict):
                return parsed
            if isinstance(parsed, str):
                text = parsed.strip()
                continue
            raise ValueError("Agent edit response must be a JSON object")

        raise ValueError("Agent edit response contains too many nested JSON strings")

    def _agent_reply_from_raw(self, raw: str) -> str:
        """Return a safe chat reply when the model failed to produce a usable plan."""
        text = (raw or "").strip()
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text).strip()
        if not text or text.startswith(("{", "[")):
            return "AI 没有生成可应用的修改方案，请换一种更具体的说法再试。"
        return self._clip_text(self._plain_text(text).strip(), 500)

    def _normalize_agent_edit_plan(self, data: dict) -> AgentEditPlan:
        """把模型 JSON 收敛成安全的写作操作列表。"""
        summary = self._clip_text(str(data.get("summary") or "AI 写作修改方案"), 220)
        reply = self._clip_text(str(data.get("reply") or summary), 500)
        risk = str(data.get("risk") or "low").lower()
        if risk not in {"low", "medium", "high"}:
            risk = "low"

        operations: list[AgentEditOperation] = []
        raw_operations = data.get("operations")
        if isinstance(raw_operations, dict):
            raw_operations = [raw_operations]
        if not isinstance(raw_operations, list):
            raw_operations = []

        for item in raw_operations[:5]:
            if not isinstance(item, dict):
                continue
            action = str(item.get("action") or "").strip()
            if action not in AGENT_EDIT_ACTIONS:
                continue

            content = self._plain_text(str(item.get("content") or "")).strip()
            anchor = self._plain_text(str(item.get("anchor") or "")).strip() or None
            find_text = self._plain_text(str(item.get("find_text") or "")).strip() or None
            reason = self._clip_text(str(item.get("reason") or "").strip(), 160) or None

            if action in {"append", "prepend", "replace_all"} and not content:
                continue
            if action in {"insert_before", "insert_after"} and (not anchor or not content):
                continue
            if action == "replace_text" and (not find_text or not content):
                continue

            operations.append(AgentEditOperation(
                action=action,  # type: ignore[arg-type]
                content=content,
                anchor=anchor,
                find_text=find_text,
                reason=reason,
            ))

        if any(op.action == "replace_all" for op in operations) or len(operations) >= 3:
            risk = "high" if risk != "low" else "medium"
        elif not operations:
            risk = "low"

        return AgentEditPlan(reply=reply, summary=summary, risk=risk, operations=operations)

    def propose_writing_edits(
        self,
        *,
        instruction: str,
        messages: List[dict] | None = None,
        user_id: str = "default_user",
        project_id: str = "default_project",
        current_chapter_id: int | None = None,
        book_id: int | None = None,
        current_content: str = "",
        selected_doc_ids: list[int] | None = None,
        use_memory: bool = True,
    ) -> AgentEditPlan:
        """生成可审查的写作修改方案，不直接写入正文。"""
        instruction = instruction.strip()
        if not instruction:
            return AgentEditPlan(reply="没有收到写作任务。", summary="没有收到写作任务", risk="low", operations=[])

        profile = self._detect_memory_profile(instruction)
        config = self._get_chat_context_config()
        use_external = bool(selected_doc_ids) or bool(config["suggest_use_external_rag"]) or profile.use_external_rag
        use_chapter_rag = bool(config["chat_use_chapter_rag"]) and profile.use_chapter_rag
        current_plain = self._plain_text(current_content)
        query = self._build_rag_query(instruction, current_plain)
        context = self.build_layered_memory_context(
            current_chapter_id=current_chapter_id,
            current_content=current_plain,
            user_id=user_id,
            project_id=project_id,
            book_id=book_id,
            query=query,
            selected_doc_ids=selected_doc_ids,
            max_current_chars=max(profile.current_chars, int(config["current_chapter_chars"])),
            use_nearby_summaries=profile.use_nearby,
            nearby_before=profile.nearby_before,
            nearby_after=profile.nearby_after,
            use_rag=bool(profile.rag_top_k) and (use_external or use_chapter_rag),
            rag_top_k=profile.rag_top_k,
            use_external_rag=use_external,
            use_chapter_rag=use_chapter_rag,
            external_rag_weight=int(config["external_rag_weight"]),
            use_book_outline=profile.use_book_outline,
            book_outline_limit=profile.book_outline_limit,
            use_foreshadowing_scan=profile.use_foreshadowing_scan,
            foreshadowing_scope=profile.foreshadowing_scope,
            use_memory_summary=use_memory,
            context_title=f"写作 Agent 分层记忆：{profile.label}",
        )
        history = self._prepare_chat_messages(messages or [], keep_last=8, content_limit=1200)
        history_lines = "\n".join(f"{msg.get('role')}: {msg.get('content')}" for msg in history)

        system = f"""{self._get_persona(user_id, project_id)}

你是一个谨慎的小说写作 agent。你的任务不是直接改数据库，而是生成“用户确认后才能应用”的结构化修改方案。
只返回 JSON，不要 Markdown 代码块，不要在 JSON 外解释。

可用 action：
- append：追加到章节末尾
- prepend：插入到章节开头
- replace_all：全文替换；只有用户明确要求重写整章时使用
- insert_before：插入到 anchor 之前；anchor 必须是当前正文中的精确短文本
- insert_after：插入到 anchor 之后；anchor 必须是当前正文中的精确短文本
- replace_text：把 find_text 精确替换为 content；find_text 必须来自当前正文

规则：
- 优先使用局部操作，不确定定位时使用 append。
- anchor/find_text 保持短而唯一，最好 10-80 个中文字符。
- content 只写最终要进入小说正文的文本，不写“这里插入”等说明。
- reply 是给用户看的说明，不会写入正文；content 才是会进入小说正文的内容。
- reason 用一句话说明修改意图。
- operations 最多 5 步。
- 如果用户只是在问候、讨论、提问，或没有明确要求修改正文，正常回答并返回空的 operations。
"""
        user = f"""请根据以下任务生成写作修改方案。

用户任务：
{instruction}

最近对话：
{history_lines or "无"}

上下文：
{context or "无"}

返回 JSON 格式：
{{
  "reply": "给用户看的简短说明，和正文内容分开",
  "summary": "一句话说明这次改什么",
  "risk": "low|medium|high",
  "operations": [
    {{
      "action": "append|prepend|replace_all|insert_before|insert_after|replace_text",
      "anchor": "insert_before/insert_after 使用，可省略",
      "find_text": "replace_text 使用，可省略",
      "content": "要写入的正文",
      "reason": "一句话原因"
    }}
  ]
}}"""

        gen_config = self._get_generation_config()
        raw = self.provider.chat(
            messages=self._create_messages(system, user),
            temperature=0.2,
            max_tokens=max(1200, min(gen_config["max_tokens"], 3000)),
        )
        try:
            data = self._extract_json_object(raw)
            return self._normalize_agent_edit_plan(data)
        except Exception as exc:
            logger.warning("Agent edit plan parse failed: %s", exc)
            reply = self._agent_reply_from_raw(raw)
            return AgentEditPlan(reply=reply, summary="没有生成可应用的修改方案", risk="low", operations=[])

    def get_book_outline(self, book_id: int | None, limit: int = 80) -> str:
        """返回当前书籍章节摘要索引。"""
        if not self.session or not book_id:
            return "当前没有可用的书籍上下文。"
        limit = max(1, min(limit or 80, 200))
        chapters = get_chapters_by_book(self.session, book_id, limit=limit)
        if not chapters:
            return "当前书籍还没有章节。"

        lines = [f"当前书籍章节摘要索引（共返回 {len(chapters)} 章）："]
        for chapter in chapters:
            brief = self._chapter_brief(chapter.title, chapter.summary, chapter.content, limit=180)
            lines.append(f"{chapter.order}. 《{chapter.title}》：{brief}")
        return "\n".join(lines)

    def extract_foreshadowing_candidates(
        self,
        *,
        scope: str = "current",
        current_chapter_id: int | None = None,
        book_id: int | None = None,
        current_content: str = "",
        max_items: int = 16,
    ) -> str:
        """用轻量规则扫描伏笔/悬念候选句，供 AI 进一步判断。"""
        max_items = max(3, min(max_items, 30))
        sources: list[tuple[str, str]] = []

        if scope == "book" and self.session and book_id:
            chapters = get_chapters_by_book(self.session, book_id, limit=5000)
            sources = [(f"{chapter.order}.《{chapter.title}》", chapter.content) for chapter in chapters]
        elif current_chapter_id and self.session:
            chapter = get_chapter(self.session, current_chapter_id, book_id=book_id)
            if chapter:
                sources = [(f"《{chapter.title}》", chapter.content)]

        if not sources and current_content:
            sources = [("当前编辑器", current_content)]

        if not sources:
            return "没有可扫描的章节内容。"

        candidates: list[str] = []
        seen: set[str] = set()
        for source, raw_text in sources:
            plain = self._plain_text(raw_text)
            for sentence in self._split_sentences(plain):
                normalized = sentence[:120]
                if normalized in seen:
                    continue
                if any(keyword in sentence for keyword in FORESHADOWING_KEYWORDS):
                    seen.add(normalized)
                    candidates.append(f"- [{source}] {self._clip_text(sentence, 180)}")
                if len(candidates) >= max_items:
                    break
            if len(candidates) >= max_items:
                break

        if not candidates:
            return "未扫描到明显伏笔候选句。可以让 AI 结合全书摘要继续做主观判断。"
        return "伏笔/悬念候选句（需要 AI 再判断是否真正成立）：\n" + "\n".join(candidates)

    # ──────────────────────────────────────────────
    # 统一对话入口（只使用信息工具）
    # ──────────────────────────────────────────────
    def stream_chat(
        self,
        messages: List[dict],
        user_id: str = "default_user",
        project_id: str = "default_project",
        use_memory: bool = True,
        max_tokens: int | None = None,
        temperature: float = 0.0,
        current_chapter_id: int | None = None,
        book_id: int | None = None,
        current_content: str = "",
        selected_doc_ids: list[int] | None = None,
    ):
        messages = self._prepare_chat_messages(messages)
        yield {
            "type": "agent_step",
            "step": {
                "id": "task-received",
                "phase": "planning",
                "status": "completed",
                "title": "已接收写作任务",
                "detail": "开始整理可用上下文与工具",
            },
        }

        # 构建基础 system prompt
        persona = self._get_persona(user_id, project_id)
        system_content = persona
        if use_memory:
            memory_ctx = self._get_memory_context(user_id, project_id)
            if memory_ctx:
                system_content = f"{persona}\n\n{memory_ctx}"

        auto_context = self._build_auto_context(
            messages=messages,
            current_content=current_content,
            current_chapter_id=current_chapter_id,
            user_id=user_id,
            project_id=project_id,
            book_id=book_id,
            selected_doc_ids=selected_doc_ids,
        )
        if auto_context:
            system_content = f"{system_content}\n\n{auto_context}"
            yield {
                "type": "agent_step",
                "step": {
                    "id": "context-ready",
                    "phase": "context",
                    "status": "completed",
                    "title": "已准备分层写作上下文",
                    "detail": "当前章节、附近章节摘要与可用记忆已注入",
                    "content": self._clip_text(auto_context, 3200),
                },
            }

        context_rules = [
            "【上下文使用规则】",
            "- 当前编辑器内容优先于历史对话。",
            "- 外部语料只用于参考风格、设定和信息，禁止直接大段复制。",
            "- 回答续写/改写类请求时，只输出可放入正文的内容，除非用户明确要求解释。",
        ]
        if selected_doc_ids:
            context_rules.append("- 用户已选择参考语料；外部语料检索应优先限制在这些文档内。")
        if book_id:
            context_rules.append("- 如需回顾伏笔、人物或设定，可参考全书相关片段。")
        system_content = f"{system_content}\n\n" + "\n".join(context_rules)

        # 添加可用工具说明，帮助AI知道何时调用RAG工具
        tool_instructions = """
【可用工具说明】
用户会直接用自然语言提出续写、改写、检查、情节建议或普通问答需求。你不需要等待前端指令，也不要输出“需要调用某某写作工具”的说明；请根据用户意图直接完成写作任务。

系统已经按用户需求自动注入了分层记忆。工具只用于在需要时补查，不要为了形式而调用。

当前可用工具：

1. get_current_chapter - 读取当前编辑器/当前章节正文。用于续写、改写、总结本章、检查当前正文。

2. get_nearby_chapters_summary - 读取当前章节前后摘要。用于承接剧情、判断人物状态和最近事件。

3. search_my_chapters - 在自己的小说全书中检索相关片段。用于查人物、设定、事件、伏笔、矛盾。

4. search_external_reference - 在用户上传/选中的语料中检索。purpose=style 时用于文风参考，purpose=setting/plot/reference 用于设定、情节范例或通用资料。

5. get_book_outline - 读取全书章节摘要索引。用于全书结构、节奏、人物线、伏笔回收和前后文关系。

6. extract_foreshadowing_candidates - 扫描伏笔/悬念候选句。用于伏笔、埋线、疑点、回收线索。

使用指南：
- 普通续写/润色优先使用自动分层记忆，除非上下文明显不足。
- 总结本章时可调用 get_current_chapter。
- 近几章承接问题调用 get_nearby_chapters_summary。
- 全书一致性、伏笔、人物、设定问题调用 search_my_chapters 或 get_book_outline。
- 文风/外部设定/范例问题调用 search_external_reference，并设置合适 purpose。
- 伏笔、悬念、疑点、埋线问题调用 extract_foreshadowing_candidates；必要时再结合 get_book_outline 判断是否已回收。
- 可以组合使用多个工具来获取全面信息
- 如果你不确定用户需要什么信息，可以先调用相关工具获取上下文再回答
- 工具只用于补充上下文；最终的续写、改写、检查、情节建议都由你在最终回复中直接生成
"""
        system_content = f"{system_content}\n{tool_instructions}"

        # Agent 最多进行三轮工具决策；现有工具和分层记忆保持不变。
        for round_index in range(3):
            planning_id = f"planning-{round_index + 1}"
            yield {
                "type": "agent_step",
                "step": {
                    "id": planning_id,
                    "phase": "planning",
                    "status": "running",
                    "title": "正在判断下一步",
                    "detail": f"第 {round_index + 1} 轮工具决策",
                },
            }
            try:
                response_str = self.provider.chat(
                    messages=[{"role": "system", "content": system_content}] + messages,
                    tools=WRITING_TOOLS,
                    tool_choice="auto",
                    temperature=0.1,
                    max_tokens=500,
                )
                tool_calls = json.loads(response_str)
            except Exception as exc:
                logger.info("Tool selection failed, falling back to final response: %s", exc)
                tool_calls = []

            if not isinstance(tool_calls, list) or not tool_calls:
                yield {
                    "type": "agent_step",
                    "step": {
                        "id": planning_id,
                        "phase": "planning",
                        "status": "completed",
                        "title": "上下文已经足够",
                        "detail": "开始组织最终回答",
                    },
                }
                break

            yield {
                "type": "agent_step",
                "step": {
                    "id": planning_id,
                    "phase": "planning",
                    "status": "completed",
                    "title": f"决定调用 {len(tool_calls)} 个工具",
                    "detail": f"第 {round_index + 1} 轮工具决策完成",
                },
            }
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": tc.get("id", f"call_{round_index}_{i}"),
                        "type": "function",
                        "function": {
                            "name": tc["function"]["name"],
                            "arguments": json.dumps(tc["function"]["arguments"]) if not isinstance(tc["function"]["arguments"], str) else tc["function"]["arguments"],
                        },
                    }
                    for i, tc in enumerate(tool_calls)
                ],
            })

            for tool_index, tc in enumerate(tool_calls):
                    tool_name = tc["function"]["name"]
                    args_raw = tc["function"]["arguments"]
                    if isinstance(args_raw, str):
                        try:
                            args = json.loads(args_raw)
                        except json.JSONDecodeError:
                            args = {}
                    else:
                        args = args_raw
                    tool_call_id = tc.get("id", f"call_{round_index}_{tool_index}_{tool_name}")
                    step_id = f"tool-{round_index}-{tool_call_id}"
                    query = str(args.get("query") or "")
                    yield {
                        "type": "agent_step",
                        "step": {
                            "id": step_id,
                            "phase": "tool",
                            "status": "running",
                            "title": tool_name,
                            "detail": query or "正在读取写作上下文",
                            "query": query,
                        },
                    }

                    result = ""  # 初始化默认值

                    try:
                        if tool_name == "get_current_chapter":
                            result = self.get_current_chapter(current_chapter_id, book_id, current_content)
                        elif tool_name == "get_nearby_chapters_summary":
                            result = self.get_nearby_chapters_summary(
                                current_chapter_id,
                                before=int(args.get("before", 3) or 3),
                                after=int(args.get("after", 1) or 1),
                            )
                        elif tool_name == "search_my_chapters":
                            query = args.get("query", "")
                            result = self.search_my_chapters(query, user_id, book_id)
                        elif tool_name == "search_external_reference":
                            query = args.get("query", "")
                            result = self.search_external_reference(
                                query,
                                user_id,
                                project_id,
                                selected_doc_ids,
                                purpose=args.get("purpose", "reference") or "reference",
                            )
                        elif tool_name == "get_book_outline":
                            result = self.get_book_outline(book_id, int(args.get("limit", 80) or 80))
                        elif tool_name == "extract_foreshadowing_candidates":
                            result = self.extract_foreshadowing_candidates(
                                scope=args.get("scope", "current") or "current",
                                current_chapter_id=current_chapter_id,
                                book_id=book_id,
                                current_content=current_content,
                            )
                        else:
                            result = f"未知工具: {tool_name}"
                    except Exception as e:
                        result = f"工具 {tool_name} 执行失败: {str(e)}"
                        logger.warning("Tool %s failed: %s", tool_name, e)

                    messages.append({"role": "tool", "content": result, "tool_call_id": tool_call_id})
                    yield {
                        "type": "agent_step",
                        "step": {
                            "id": step_id,
                            "phase": "tool",
                            "status": "failed" if result.startswith(f"工具 {tool_name} 执行失败") else "completed",
                            "title": tool_name,
                            "detail": query or "工具调用完成",
                            "query": query,
                            "content": self._clip_text(result, 3200),
                        },
                    }

        yield {
            "type": "agent_step",
            "step": {
                "id": "generating-answer",
                "phase": "generating",
                "status": "running",
                "title": "正在生成回答",
                "detail": "根据已读取的上下文组织内容",
            },
        }
        full_messages = [{"role": "system", "content": system_content}] + messages
        gen_config = self._get_generation_config()
        yield from self.provider.stream_chat(
            messages=full_messages,
            temperature=temperature or gen_config["temperature"],
            max_tokens=max_tokens or gen_config["max_tokens"],
        )

    # ──────────────────────────────────────────────
    # 其他写作辅助能力：外部语料检索、轻量分析、续写、摘要和分层记忆。
    # ──────────────────────────────────────────────
    # ──────────────────────────────────────────────
    # 统一检索上下文：外部知识库属于 RAG，全书章节属于内部写作上下文。
    # ──────────────────────────────────────────────
    def build_unified_rag_context(
        self,
        user_id: str,
        project_id: str,
        book_id: int | None,
        query: str,
        top_k: int = 5,
        use_external: bool = True,
        use_chapters: bool = True,
        external_weight: int = 30,
        selected_doc_ids: list[int] | None = None,
        snippet_chars: int = 650,
    ) -> str:
        """构建统一检索上下文：外部知识库属于 RAG，全书章节属于内部写作上下文。"""
        if not query:
            return ""

        ks = get_knowledge_service()
        lines = []
        snippet_chars = max(200, min(int(snippet_chars or 650), 1200))

        # 1. 外部知识库检索
        if use_external:
            if not ks.vector_enabled:
                lines.append("【外部语料】向量模型未就绪，本次不会使用外部资料。")
            else:
                try:
                    ext_hits = ks.search_external(
                        user_id=user_id,
                        project_id=project_id,
                        query=query,
                        top_k=top_k,
                        weight=external_weight,
                        document_ids=selected_doc_ids,
                    )
                except Exception as exc:
                    logger.warning("External RAG context failed: %s", exc)
                    ext_hits = []
                if ext_hits:
                    label = "选中语料参考" if selected_doc_ids else "外部语料参考"
                    lines.append(f"【{label}（严禁直接复制原文，仅可借鉴风格、用词和设定）】")
                    for i, h in enumerate(ext_hits, start=1):
                        source = self._hit_label(h, f"资料{i}")
                        lines.append(f"[外{i} | {source}] {self._clip_text(h.get('text', ''), snippet_chars)}")

        # 2. 全书章节检索
        if use_chapters and book_id:
            try:
                chapter_hits = ks.search_chapters(
                    user_id=user_id,
                    book_id=book_id,
                    query=query,
                    top_k=top_k,
                )
            except Exception as exc:
                logger.warning("Chapter RAG context failed: %s", exc)
                chapter_hits = []
            if chapter_hits:
                lines.append("【全书情节回顾（可引用其中内容保持连贯性）】")
                for i, h in enumerate(chapter_hits, start=1):
                    source = self._hit_label(h, f"章节{i}")
                    lines.append(f"[章{i} | {source}] {self._clip_text(h.get('text', ''), snippet_chars)}")
            else:
                fallback_hits = self._keyword_search_chapters(
                    user_id=user_id,
                    book_id=book_id,
                    query=query,
                    top_k=top_k,
                )
                if fallback_hits:
                    lines.append("【全书关键词回顾（可引用其中内容保持连贯性）】")
                    for i, h in enumerate(fallback_hits, start=1):
                        source = self._hit_label(h, f"章节{i}")
                        lines.append(f"[章{i} | {source}] {self._clip_text(h.get('text', ''), snippet_chars)}")

        return "\n".join(lines) if lines else ""

    # ──────────────────────────────────────────────
    # 轻量实时分析（不调用大模型）
    # ──────────────────────────────────────────────
    def analyze_text_light(self, text: str, analysis_types: list[str] | None = None) -> dict:
        if analysis_types is None:
            analysis_types = ["repetition", "length"]

        result: dict = {"types": analysis_types, "signals": {}}

        if "length" in analysis_types:
            paragraphs = [p for p in text.splitlines() if p.strip()]
            result["signals"]["length"] = {
                "chars": len(text),
                "paragraphs": len(paragraphs),
            }

        if "repetition" in analysis_types:
            tokens = re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z]{4,}", text)
            freq: dict[str, int] = {}
            for t in tokens:
                freq[t] = freq.get(t, 0) + 1
            top = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)[:5]
            result["signals"]["repetition"] = [{"token": k, "count": v} for k, v in top if v >= 3]

        return result

    def continue_writing(
        self,
        *,
        content: str,
        max_length: int = 200,
        current_chapter_id: int | None = None,
        book_id: int | None = None,
        user_id: str = "default_user",
        project_id: str = "default_project",
        use_memory: bool = True,
    ):
        context = self.build_layered_memory_context(
            current_chapter_id=current_chapter_id,
            current_content=content,
            user_id=user_id,
            project_id=project_id,
            book_id=book_id,
            use_memory_summary=use_memory,
            use_external_rag=False,
            use_chapter_rag=True,
        )
        prompt = (
            "Continue the novel text directly. Match the original tone and do not add explanations.\n\n"
            f"{context or content}"
        )
        gen_config = self._get_generation_config()
        yield from self.provider.stream_chat(
            messages=self._create_messages(DEFAULT_WRITER_PERSONA, prompt),
            temperature=gen_config["temperature"],
            max_tokens=max(max_length, gen_config["max_tokens"]),
        )

    def rewrite_text(self, text: str, style: str = "clear and fluent") -> str:
        prompt = (
            f"Rewrite the following text in this style: {style}.\n"
            "Return only the rewritten text, with no explanation.\n\n"
            f"{text}"
        )
        gen_config = self._get_generation_config()
        return self.provider.chat(
            messages=self._create_messages(DEFAULT_WRITER_PERSONA, prompt),
            temperature=gen_config["temperature"],
            max_tokens=gen_config["max_tokens"],
        )

    def check_grammar(self, text: str) -> str:
        prompt = (
            "Check the following prose for grammar, style, continuity, and wording issues. "
            "Return strict JSON with this shape: {\"issues\": [\"...\"], \"suggestions\": [\"...\"]}.\n\n"
            f"{text}"
        )
        return self.provider.chat(
            messages=self._create_messages(DEFAULT_WRITER_PERSONA, prompt),
            temperature=0.2,
            max_tokens=1000,
        )

    def suggest_plot(self, description: str) -> str:
        prompt = (
            "Generate concise plot suggestions for a novel. "
            "Return strict JSON with this shape: {\"suggestions\": [\"...\", \"...\", \"...\"]}.\n\n"
            f"{description}"
        )
        return self.provider.chat(
            messages=self._create_messages(DEFAULT_WRITER_PERSONA, prompt),
            temperature=0.8,
            max_tokens=1200,
        )

    # ──────────────────────────────────────────────
    # 章节摘要生成
    # ──────────────────────────────────────────────
    def generate_chapter_summary(self, content: str, style: str = "concise", max_length: int = 200) -> str:
        """
        生成章节摘要

        参数：
            content: 章节内容
            style: 生成风格 "concise"(简洁)/"detailed"(详细)/"extract_first"(提取首段)
            max_length: 摘要最大长度（字符数）

        返回：
            生成的摘要文本
        """
        if style == "extract_first":
            # 提取首段：找到第一个非空段落
            paragraphs = [p.strip() for p in content.splitlines() if p.strip()]
            if paragraphs:
                first_para = paragraphs[0]
                # 如果首段太长，截取
                if len(first_para) > max_length:
                    return first_para[:max_length] + "..."
                return first_para
            # 没有段落，返回空字符串
            return ""

        # AI 生成摘要
        if style == "detailed":
            prompt = f"请为以下章节内容生成详细摘要（不超过{max_length}字），涵盖主要情节、人物发展和关键细节：\n\n{content}"
        else:  # concise 或其他
            prompt = f"请为以下章节内容生成简洁摘要（不超过{max_length}字），概括核心情节：\n\n{content}"

        messages = self._create_messages(system=DEFAULT_SUMMARY_SYSTEM, user=prompt)

        try:
            result = self.provider.chat(
                messages=messages,
                temperature=0.3,  # 低温度确保摘要准确
                max_tokens=max_length // 2,  # 假设中文字符约2字符/token
            )
            return result.strip()
        except Exception as e:
            # 如果AI生成失败，回退到提取首段
            paragraphs = [p.strip() for p in content.splitlines() if p.strip()]
            if paragraphs:
                first_para = paragraphs[0]
                if len(first_para) > max_length:
                    return first_para[:max_length] + "..."
                return first_para
            return ""

    # ──────────────────────────────────────────────
    # 分层记忆上下文
    # ──────────────────────────────────────────────
    def build_layered_memory_context(
        self,
        *,
        current_chapter_id: int | None = None,
        current_content: str = "",
        user_id: str = "default_user",
        project_id: str = "default_project",
        use_current_chapter: bool = True,
        use_nearby_summaries: bool = True,
        nearby_before: int = 3,
        nearby_after: int = 0,
        use_rag: bool = True,
        rag_top_k: int = 5,
        use_memory_summary: bool = True,
        max_current_chars: int = 8000,
        book_id: int | None = None,
        use_external_rag: bool = True,
        use_chapter_rag: bool = True,
        external_rag_weight: int = 30,
        query: str = "",
        selected_doc_ids: list[int] | None = None,
        use_book_outline: bool = False,
        book_outline_limit: int = 60,
        use_foreshadowing_scan: bool = False,
        foreshadowing_scope: str = "current",
        context_title: str = "分层记忆",
    ) -> str:
        """
        构建分层记忆上下文

        返回：
            组合的上下文字符串，可以直接注入AI提示
        """
        parts = []
        current_plain = self._plain_text(current_content)
        max_current_chars = max(500, min(int(max_current_chars or 8000), 12000))
        rag_top_k = max(0, min(int(rag_top_k or 0), 10))
        nearby_before = max(0, min(int(nearby_before or 0), 8))
        nearby_after = max(0, min(int(nearby_after or 0), 5))

        if not current_plain and current_chapter_id and self.session:
            chapter = get_chapter(self.session, current_chapter_id, book_id=book_id)
            if chapter:
                current_plain = self._plain_text(chapter.content)

        # 1. 当前章节全文（如果提供且启用）
        if use_current_chapter and current_plain:
            truncated = self._clip_text(current_plain[-max_current_chars:], max_current_chars)
            parts.append(f"【第1层：当前章节/编辑器内容】\n{truncated}")

        # 2. 附近章节摘要（如果提供章节ID且启用）
        if use_nearby_summaries and current_chapter_id and self.session:
            nearby = get_nearby_chapter_summaries(
                self.session,
                chapter_id=current_chapter_id,
                before_count=nearby_before,
                after_count=nearby_after
            )
            if nearby:
                summary_lines = []
                for item in nearby:
                    prefix = "（前）" if item["is_before"] else "（后）"
                    if item["summary"]:
                        summary_lines.append(f"{prefix}《{item['title']}》：{item['summary']}")
                    else:
                        summary_lines.append(f"{prefix}《{item['title']}》：无摘要")
                if summary_lines:
                    parts.append("【第2层：附近章节摘要】\n" + "\n".join(summary_lines))

        # 3. 全书摘要索引（只在结构、伏笔、连贯性分析时自动加入）
        if use_book_outline and self.session and book_id:
            outline = self.get_book_outline(book_id, limit=book_outline_limit)
            if outline and "当前没有可用" not in outline and "还没有章节" not in outline:
                parts.append("【第3层：全书摘要索引】\n" + outline)

        # 4. 检索补充：外部知识库是 RAG，全书章节是内部写作上下文检索。
        rag_query = (query or current_plain).strip()
        if use_rag and rag_query:
            external_enabled = use_external_rag if use_rag else False
            chapter_enabled = use_chapter_rag if use_rag else False

            if external_enabled or chapter_enabled:
                rag_context = self.build_unified_rag_context(
                    user_id=user_id,
                    project_id=project_id,
                    book_id=book_id,
                    query=rag_query,
                    top_k=rag_top_k,
                    use_external=external_enabled,
                    use_chapters=chapter_enabled,
                    external_weight=external_rag_weight,
                    selected_doc_ids=selected_doc_ids,
                )
                if rag_context:
                    parts.append("【第4层：检索补充】\n" + rag_context)

        # 5. 轻量伏笔扫描（规则辅助，不替代 AI 判断）
        if use_foreshadowing_scan:
            foreshadowing = self.extract_foreshadowing_candidates(
                scope=foreshadowing_scope,
                current_chapter_id=current_chapter_id,
                book_id=book_id,
                current_content=current_plain,
                max_items=14,
            )
            if foreshadowing and "没有可扫描" not in foreshadowing:
                parts.append("【第5层：伏笔/疑点候选】\n" + foreshadowing)

        # 6. 写作记忆摘要（对话历史）
        if use_memory_summary:
            memory_ctx = self._get_memory_context(user_id, project_id)
            if memory_ctx:
                parts.append("【长期写作记忆】\n" + memory_ctx)

        if not parts:
            return ""
        return f"【{context_title}】\n" + "\n\n".join(parts)


def get_ai_service(session: Session | None = None, user_id: str = "default_user") -> AIService:
    provider = get_ai_provider(session=session, user_id=user_id)
    return AIService(provider=provider, session=session, user_id=user_id)
