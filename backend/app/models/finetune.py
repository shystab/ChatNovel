from __future__ import annotations

from typing import Annotated

from sqlmodel import Field, SQLModel


class FineTunePrepareRequest(SQLModel):
    user_id: Annotated[str, Field(description="用户 ID")]
    project_id: Annotated[str, Field(description="项目/书籍 ID")]
    dataset_note: Annotated[str, Field(default="", description="数据集说明（可选）")]


class FineTunePrepareResponse(SQLModel):
    supported: bool
    message: str
    next_steps: list[str]

