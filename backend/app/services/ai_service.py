"""
AI 服务层 - 通用 AI 服务（工具调用版）
"""
import json
import re
from typing import List, Generator

from sqlmodel import Session
from openai.types.chat import ChatCompletionMessageParam

from app.services.ai_provider import BaseAIProvider, get_ai_provider
from app.services.knowledge_service import get_knowledge_service
from app.crud.memory_crud import get_enabled_preset, get_memory_summary
from app.crud.preset_crud import get_enabled_preset_new
from app.crud.crud import get_chapter
from app.crud.crud import get_nearby_chapter_summaries

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

# ──────────────────────────────────────────────
# 工具定义（Function Calling）
# ──────────────────────────────────────────────
WRITING_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_chapter",
            "description": "获取用户当前正在编辑的章节全文。当用户询问当前章节内容、要求续写或修改时，可以调用此工具。",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_nearby_chapters_summary",
            "description": "获取当前章节附近2-3章的摘要，用于了解最近的情节发展。",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_my_chapters",
            "description": "在全书章节中搜索与用户问题相关的内容，用于回顾伏笔、人物、事件等。",
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
            "description": "在用户上传的参考章节中搜索范例情节、设定等（可参考但不要直接复制）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "搜索关键词"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_style_examples",
            "description": "在用户上传的文风仿写内容中搜索相似风格的片段，用于模仿特定作家的语气、用词等。",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "风格描述或关键词"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "continue_writing",
            "description": "根据当前写作内容生成续写。当用户要求续写、接着写、继续写时调用此工具。",
            "parameters": {
                "type": "object",
                "properties": {
                    "max_length": {"type": "integer", "description": "续写长度（字数）", "default": 200}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "rewrite_text",
            "description": "改写用户选中的文本。参数text为原文，style可选（如“更流畅”）。",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "要改写的原文"},
                    "style": {"type": "string", "description": "改写风格", "default": "清晰流畅"}
                },
                "required": ["text"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_grammar",
            "description": "检查文本的语法和风格问题，返回 JSON。",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "要检查的文本"}
                },
                "required": ["text"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_plot",
            "description": "根据用户描述生成情节建议。",
            "parameters": {
                "type": "object",
                "properties": {
                    "description": {"type": "string", "description": "用户的需求或背景"}
                },
                "required": ["description"]
            }
        }
    }
]


class AIService:
    def __init__(self, provider: BaseAIProvider, session: Session | None = None):
        self.provider = provider
        self.session = session

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
        global_preset = get_enabled_preset_new(self.session)
        if global_preset and global_preset.system_prompt.strip():
            print(f"[DEBUG] Using global preset: {global_preset.name}")
            return global_preset.system_prompt.strip()

        # 如果全局预设没有启用的，尝试从用户特定预设系统获取（memory_crud）
        user_preset = get_enabled_preset(self.session, user_id, project_id)
        if user_preset and user_preset.system_prompt.strip():
            print(f"[DEBUG] Using user preset: {user_preset.name}")
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
            db_settings = get_settings(self.session)
            if db_settings:
                config["temperature"] = db_settings.temperature
                config["max_tokens"] = db_settings.max_tokens
        return config

    # ──────────────────────────────────────────────
    # 信息工具实现（保持不变）
    # ──────────────────────────────────────────────
    def get_current_chapter(self, current_chapter_id: int, book_id: int) -> str:
        """获取当前章节全文（截断至4000字）"""
        chapter = get_chapter(self.session, current_chapter_id, book_id=book_id)
        if not chapter:
            return "未找到当前章节内容。"
        content = chapter.content
        if len(content) > 4000:
            content = content[:4000] + "...（已截断）"
        return f"当前章节内容：\n{content}"

    def get_nearby_chapters_summary(self, current_chapter_id: int, before: int = 2, after: int = 2) -> str:
        """返回附近章节摘要"""
        if not self.session:
            return ""
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

    def search_my_chapters(self, query: str, book_id: int) -> str:
        """全书章节检索"""
        ks = get_knowledge_service()
        hits = ks.search_chapters(
            user_id="default_user",  # 可根据实际传入user_id
            book_id=book_id,
            query=query,
            top_k=5
        )
        if not hits:
            return f"未找到与“{query}”相关的章节内容。"
        lines = [f"全书检索结果（相关片段）："]
        for i, h in enumerate(hits, 1):
            lines.append(f"[{i}] {h['text']}")
        return "\n".join(lines)

    def search_external_reference(self, query: str, project_id: str) -> str:
        """外部参考章节检索"""
        ks = get_knowledge_service()
        hits = ks.search_external(
            user_id="default_user",
            project_id=project_id,
            query=query,
            top_k=5,
            weight=30
        )
        if not hits:
            return f"未找到与'{query}'相关的外部参考内容。"

        lines = [f"外部参考素材："]
        for i, h in enumerate(hits, 1):
            lines.append(f"[{i}] {h['text']}")
        return "\n".join(lines)

    def get_style_examples(self, query: str, project_id: str) -> str:
        """文风仿写检索"""
        ks = get_knowledge_service()
        hits = ks.search_external(
            user_id="default_user",
            project_id=project_id,
            query=query,
            top_k=5,
            weight=30
        )
        if not hits:
            return f"未找到与'{query}'相关的文风范例。"

        lines = [f"文风范例（供模仿风格，不要直接复制）："]
        for i, h in enumerate(hits, 1):
            lines.append(f"[{i}] {h['text']}")
        return "\n".join(lines)

    # ──────────────────────────────────────────────
    # 统一对话入口（只使用信息工具）
    # ──────────────────────────────────────────────
    def stream_chat(
        self,
        messages: List[dict],
        user_id: str = "default_user",
        project_id: str = "default_project",
        use_memory: bool = True,
        max_tokens: int = 500,
        temperature: float = 0.0,
        current_chapter_id: int | None = None,
        book_id: int | None = None,
        current_content: str = "",
    ):
        # 构建基础 system prompt
        persona = self._get_persona(user_id, project_id)
        print(f"[DEBUG] _get_persona returned (first 300 chars): {persona[:300]}")
        system_content = persona
        if use_memory:
            memory_ctx = self._get_memory_context(user_id, project_id)
            if memory_ctx:
                system_content = f"{persona}\n\n{memory_ctx}"

        # 将当前编辑器内容注入 system prompt，让 AI 知道有内容可续写
        if current_content:
            preview = current_content[-500:] if len(current_content) > 500 else current_content
            system_content = f"{system_content}\n\n【当前编辑器内容】\n{preview}"

        # 添加可用工具说明，帮助AI知道何时调用RAG工具
        tool_instructions = """
【可用工具说明】
你可以使用以下工具获取更多信息来更好地协助用户：

1. get_current_chapter - 获取用户当前正在编辑的章节全文。当用户询问当前章节内容、要求续写或修改时调用。

2. get_nearby_chapters_summary - 获取当前章节附近2-3章的摘要，用于了解最近的情节发展。

3. search_my_chapters - 在全书章节中搜索与用户问题相关的内容，用于回顾伏笔、人物、事件等。需要查询关键词。

4. search_external_reference - 在用户上传的参考章节中搜索范例情节、设定等（可参考但不要直接复制）。当用户需要参考外部素材、范例或灵感时调用。用户可能已经上传了小说范例、设定集、灵感素材等文档。

5. get_style_examples - 在用户上传的文风仿写内容中搜索相似风格的片段，用于模仿特定作家的语气、用词等。

使用指南：
- 当用户询问当前章节内容时，调用 get_current_chapter
- 当用户需要了解情节发展时，调用 get_nearby_chapters_summary
- 当用户需要搜索全书相关内容时，调用 search_my_chapters
- 当用户需要参考外部素材、范例或灵感时，调用 search_external_reference
- 当用户需要文风模仿参考时，调用 get_style_examples
- 可以组合使用多个工具来获取全面信息
- 如果你不确定用户需要什么信息，可以先调用相关工具获取上下文再回答
"""
        system_content = f"{system_content}\n{tool_instructions}"

        print(f"[DEBUG] system_content (first 500 chars): {system_content[:500]}")
        print(f"[DEBUG] current_content length: {len(current_content)}")
        # 1. 调用非流式 chat 判断是否需要工具
        tool_messages = [{"role": "system", "content": system_content}] + messages
        try:
            response_str = self.provider.chat(
                messages=tool_messages,
                tools=WRITING_TOOLS,
                tool_choice="auto",
                temperature=0.1,
                max_tokens=500
            )
            print(f"[stream_chat] tool phase response: {repr(response_str[:300] if response_str else None)}")
        except Exception as e:
            print(f"[stream_chat] 工具调用判断失败，降级为普通对话: {e}")
            response_str = ""
        print(f"[DEBUG] provider.chat response_str: {response_str[:500]}")
        # 2. 解析 tool_calls
        try:
            tool_calls = json.loads(response_str)
            print(f"[stream_chat] parsed tool_calls: {tool_calls}")
            if isinstance(tool_calls, list) and len(tool_calls) > 0:
                # 将 AI 的工具调用消息添加到对话历史
                assistant_msg = {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": tc.get("id", f"call_{i}"),
                            "type": "function",
                            "function": {
                                "name": tc["function"]["name"],
                                "arguments": json.dumps(tc["function"]["arguments"]) if not isinstance(tc["function"]["arguments"], str) else tc["function"]["arguments"]
                            }
                        }
                        for i, tc in enumerate(tool_calls)
                    ]
                }
                messages.append(assistant_msg)

                # 执行每个工具调用，将结果添加到 messages
                for tc in tool_calls:
                    tool_name = tc["function"]["name"]
                    args_raw = tc["function"]["arguments"]
                    if isinstance(args_raw, str):
                        try:
                            args = json.loads(args_raw)
                        except json.JSONDecodeError:
                            args = {}
                    else:
                        args = args_raw
                    tool_call_id = tc.get("id", f"call_{tool_name}_{len(messages)}")

                    result = ""  # 初始化默认值

                    try:
                        if tool_name == "get_current_chapter":
                            result = self.get_current_chapter(current_chapter_id, book_id)
                        elif tool_name == "get_nearby_chapters_summary":
                            result = self.get_nearby_chapters_summary(current_chapter_id)
                        elif tool_name == "search_my_chapters":
                            query = args.get("query", "")
                            result = self.search_my_chapters(query, book_id)
                        elif tool_name == "search_external_reference":
                            query = args.get("query", "")
                            result = self.search_external_reference(query, project_id)
                        elif tool_name == "get_style_examples":
                            query = args.get("query", "")
                            result = self.get_style_examples(query, project_id)
                        else:
                            result = f"未知工具: {tool_name}"
                    except Exception as e:
                        result = f"工具 {tool_name} 执行失败: {str(e)}"
                        print(f"[ERROR] 工具 {tool_name} 异常: {e}")

                    messages.append({"role": "tool", "content": result, "tool_call_id": tool_call_id})
                    print(f"[DEBUG] tool {tool_name} result: {result[:200] if result else 'empty'}")
                # 所有工具执行完毕后，重新调用流式生成最终回复（不带 tools）
                final_messages = [{"role": "system", "content": system_content}] + messages
                print(f"[DEBUG] messages count after tool: {len(messages)}")
                try:
                    print(f"[DEBUG] final_messages count: {len(final_messages)}")
                    gen_config = self._get_generation_config()
                    yield from self.provider.stream_chat(
                        messages=final_messages,
                        temperature=temperature if temperature != 0.0 else gen_config["temperature"],
                        max_tokens=max_tokens or gen_config["max_tokens"],
                    )
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    raise
                    return
                return  # 工具调用后续写完成后直接返回，不再执行下面的普通对话逻辑
        except json.JSONDecodeError:
            # 不是 tool_calls，说明 AI 直接回复了文本
            print(f"[DEBUG] response_str is not JSON, treating as direct reply: {response_str[:200]}")
            if response_str and response_str.strip():
                # 直接返回 AI 的回复
                yield response_str
                return
            # 如果没有回复，继续普通对话

        # 3. 普通对话（无工具调用或无回复）
        full_messages = [{"role": "system", "content": system_content}] + messages
        gen_config = self._get_generation_config()
        yield from self.provider.stream_chat(
            messages=full_messages,
            temperature=temperature or gen_config["temperature"],
            max_tokens=max_tokens or gen_config["max_tokens"],
        )

    # ──────────────────────────────────────────────
    # 其他保留的辅助方法（analyze_text_light, generate_chapter_summary, build_layered_memory_context 等）
    # 注意：build_layered_memory_context 仍被续写内部使用？现在续写已独立，可以删除或保留备用。
    # 为节省篇幅，这里省略了 analyze_text_light 等方法的实现（它们未改动，可保留原样）
    # 请你在替换时保留 analyze_text_light, generate_chapter_summary, build_layered_memory_context 等原有代码。
    # ──────────────────────────────────────────────
    # ──────────────────────────────────────────────
    # 统一 RAG 上下文（区分外部知识库和全书章节）
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
    ) -> str:
        """构建统一 RAG 上下文，区分外部知识库和全书章节"""
        if not query:
            return ""

        ks = get_knowledge_service()
        lines = []

        # 1. 外部知识库检索
        if use_external:
            ext_hits = ks.search_external(
                user_id=user_id,
                project_id=project_id,
                query=query,
                top_k=top_k,
                weight=external_weight,
            )
            if ext_hits:
                lines.append("【外部风格/事实参考（严禁直接复制原文，仅可借鉴风格、用词和设定）】")
                for i, h in enumerate(ext_hits, start=1):
                    lines.append(f"[外{i}] {h['text']}")

        # 2. 全书章节检索
        if use_chapters and book_id:
            chapter_hits = ks.search_chapters(
                user_id=user_id,
                book_id=book_id,
                query=query,
                top_k=top_k,
            )
            if chapter_hits:
                lines.append("【全书情节回顾（可引用其中内容保持连贯性）】")
                for i, h in enumerate(chapter_hits, start=1):
                    lines.append(f"[章{i}] {h['text']}")

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
        # 新增参数：RAG 分离
        book_id: int | None = None,
        use_external_rag: bool = True,
        use_chapter_rag: bool = True,
        external_rag_weight: int = 30,
    ) -> str:
        """
        构建分层记忆上下文

        返回：
            组合的上下文字符串，可以直接注入AI提示
        """
        parts = []

        # 1. 当前章节全文（如果提供且启用）
        if use_current_chapter and current_content:
            truncated = current_content
            if len(truncated) > max_current_chars:
                truncated = truncated[:max_current_chars] + "...（已截断）"
            parts.append(f"【当前章节】\n{truncated}")

        # 2. 附近章节摘要（如果提供章节ID且启用）
        if use_nearby_summaries and current_chapter_id and self.session:
            from app.crud.crud import get_nearby_chapter_summaries
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
                    parts.append("【附近章节摘要】\n" + "\n".join(summary_lines))

        # 3. RAG检索（知识库） - 统一处理外部知识库和全书章节
        if use_rag and current_content:
            # 决定使用哪些 RAG 源
            external_enabled = use_external_rag if use_rag else False
            chapter_enabled = use_chapter_rag if use_rag else False

            if external_enabled or chapter_enabled:
                rag_context = self.build_unified_rag_context(
                    user_id=user_id,
                    project_id=project_id,
                    book_id=book_id,
                    query=current_content,
                    top_k=rag_top_k,
                    use_external=external_enabled,
                    use_chapters=chapter_enabled,
                    external_weight=external_rag_weight,
                )
                if rag_context:
                    parts.append(rag_context)

        # 4. 写作记忆摘要（对话历史）
        if use_memory_summary:
            memory_ctx = self._get_memory_context(user_id, project_id)
            if memory_ctx:
                parts.append(memory_ctx)

        return "\n\n".join(parts) if parts else ""


def get_ai_service(session: Session | None = None) -> AIService:
    provider = get_ai_provider(session=session)
    return AIService(provider=provider, session=session)