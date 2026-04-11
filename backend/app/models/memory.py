from __future__ import annotations

from datetime import datetime
from typing import Annotated

from sqlmodel import Field, SQLModel


class PromptPresetBase(SQLModel):
    name: Annotated[str, Field(index=True, description="预设名称")]
    system_prompt: Annotated[str, Field(description="系统提示词（会拼到 system message）")]
    enabled: Annotated[bool, Field(default=True, description="是否启用")]


class PromptPreset(PromptPresetBase, table=True):
    id: Annotated[int | None, Field(default=None, primary_key=True)]
    user_id: Annotated[str, Field(index=True, description="用户 ID（暂时用字符串）")]
    project_id: Annotated[str, Field(index=True, description="项目/书籍 ID（暂时用字符串）")]
    created_at: Annotated[datetime, Field(default_factory=datetime.utcnow)]
    updated_at: Annotated[datetime, Field(default_factory=datetime.utcnow)]


class PromptPresetCreate(PromptPresetBase):
    user_id: str
    project_id: str


class PromptPresetUpdate(SQLModel):
    name: str | None = Field(default=None)
    system_prompt: str | None = Field(default=None)
    enabled: bool | None = Field(default=None)


class PromptPresetRead(PromptPresetBase):
    id: int
    user_id: str
    project_id: str
    created_at: datetime
    updated_at: datetime


class MemorySummary(SQLModel, table=True):
    id: Annotated[int | None, Field(default=None, primary_key=True)]
    user_id: Annotated[str, Field(index=True)]
    project_id: Annotated[str, Field(index=True)]
    summary: Annotated[str, Field(default="", description="写作记忆摘要（用于拼接上下文）")]
    updated_at: Annotated[datetime, Field(default_factory=datetime.utcnow)]


class MemorySummaryRead(SQLModel):
    user_id: str
    project_id: str
    summary: str
    updated_at: datetime
