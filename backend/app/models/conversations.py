from sqlmodel import Field, SQLModel, Column, JSON
from datetime import datetime
from typing import Annotated, Any


class Conversation(SQLModel, table=True):
    """对话记录 — 独立于书籍，不持有 FK"""
    id: Annotated[int | None, Field(default=None, primary_key=True)]
    user_id: Annotated[str, Field(default="default_user", index=True, description="用户ID")]
    title: Annotated[str, Field(default="新对话", description="对话标题")]
    messages: Annotated[list[dict[str, Any]], Field(
        default_factory=list,
        sa_column=Column(JSON),
        description="对话消息列表",
    )]
    create_time: Annotated[datetime, Field(default_factory=datetime.now)]
    update_time: Annotated[datetime, Field(default_factory=datetime.now)]


class ConversationRead(SQLModel):
    id: int
    user_id: str
    title: str
    messages: list[dict[str, Any]]
    create_time: datetime
    update_time: datetime


class ConversationCreate(SQLModel):
    title: str = "新对话"
    user_id: str = "default_user"


class ConversationUpdate(SQLModel):
    title: str | None = None
    messages: list[dict[str, Any]] | None = None
