from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class MemoryProfile:
    """Automatic context layers selected for a writing request."""

    name: str
    label: str
    current_chars: int = 1800
    use_nearby: bool = True
    nearby_before: int = 2
    nearby_after: int = 1
    use_chapter_rag: bool = True
    rag_top_k: int = 3
    use_book_outline: bool = False
    book_outline_limit: int = 50
    use_foreshadowing_scan: bool = False
    foreshadowing_scope: str = "current"


def clip_text(text: str, limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit] + "...（已截断）"


def plain_text(value: str) -> str:
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


def split_sentences(text: str) -> list[str]:
    chunks = re.split(r"(?<=[。！？!?；;])\s*|\n+", text)
    return [chunk.strip() for chunk in chunks if chunk and chunk.strip()]


def chapter_brief(summary: str, content: str, limit: int = 220) -> str:
    summary = plain_text(summary)
    if summary:
        return clip_text(summary, limit)
    content = plain_text(content)
    if not content:
        return "暂无内容"
    sentences = split_sentences(content)
    if not sentences:
        return clip_text(content, limit)
    if len(sentences) == 1:
        return clip_text(sentences[0], limit)
    return clip_text(f"{sentences[0]} {sentences[-1]}", limit)


def detect_memory_profile(user_query: str) -> MemoryProfile:
    """Select the automatic context profile that best matches the request."""
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


def requests_external_reference(user_query: str) -> bool:
    """Return whether the user explicitly asked for non-book reference material."""
    query = user_query or ""
    return any(
        phrase in query
        for phrase in (
            "外部资料",
            "外部语料",
            "外部参考",
            "参考资料",
            "参考文档",
            "选中资料",
            "选中文档",
            "上传资料",
            "上传文档",
            "知识库",
            "素材库",
            "范文",
            "范例",
        )
    )
