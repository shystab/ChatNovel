"""
AI 辅助模型 - 定义 AI 相关的数据结构（工具调用模式）
"""
from sqlmodel import SQLModel, Field
from typing import Annotated, List, Literal


class ChatMessage(SQLModel):
    """单条对话消息"""
    role: Annotated[Literal["user", "assistant", "system"], Field(description="消息角色")]
    content: Annotated[str, Field(description="消息内容")]


class AIWSRequest(SQLModel):
    """
    WebSocket 请求载荷（工具调用模式）。
    前端只需发送对话历史、当前章节/书籍上下文。
    任务类型（续写、改写等）由后端工具调用自动判断，不再需要 task 字段。
    """
    messages: List[ChatMessage] = Field(default_factory=list)
    user_id: str = Field(default="default_user")
    project_id: str = Field(default="default_project")
    current_chapter_id: int | None = Field(default=None)
    book_id: int | None = Field(default=None)
    content: str = Field(default="")
    use_memory: bool = Field(default=True)
    max_length: int = Field(default=500)
    analysis_enabled: bool = Field(default=False)
    analysis_interval_chars: int = Field(default=200)
    analysis_types: List[str] = Field(default_factory=lambda: ["repetition", "length"])