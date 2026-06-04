from __future__ import annotations

from datetime import datetime
from typing import Annotated

from sqlmodel import Field, SQLModel


class PresetBase(SQLModel):
    user_id: Annotated[str, Field(default="default_user", index=True, description="用户ID")]
    name: Annotated[str, Field(index=True, description="预设名称")]
    description: Annotated[str, Field(default="", description="预设描述（可选）")]
    system_prompt: Annotated[str, Field(description="System Prompt 内容")]
    is_enabled: Annotated[bool, Field(default=False, description="是否启用（同一时间只有一个）")]


class Preset(PresetBase, table=True):
    __tablename__ = "preset"

    id: Annotated[int | None, Field(default=None, primary_key=True)]
    created_at: Annotated[datetime, Field(default_factory=datetime.utcnow)]
    updated_at: Annotated[datetime, Field(default_factory=datetime.utcnow)]


class PresetCreate(SQLModel):
    user_id: str = "default_user"
    name: str
    description: str = ""
    system_prompt: str
    is_enabled: bool = False


class PresetUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    is_enabled: bool | None = None


class PresetRead(PresetBase):
    id: int
    created_at: datetime
    updated_at: datetime


class PresetListResponse(SQLModel):
    items: list[PresetRead]
    total: int
