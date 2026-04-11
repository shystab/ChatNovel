from __future__ import annotations

from datetime import datetime
from typing import Annotated

from sqlmodel import Field, SQLModel


class KnowledgeDocument(SQLModel, table=True):
    id: Annotated[int | None, Field(default=None, primary_key=True)]
    user_id: Annotated[str, Field(index=True)]
    project_id: Annotated[str, Field(index=True)]
    title: Annotated[str, Field(index=True)]
    created_at: Annotated[datetime, Field(default_factory=datetime.utcnow)]


class KnowledgeChunk(SQLModel, table=True):
    id: Annotated[int | None, Field(default=None, primary_key=True)]
    document_id: Annotated[int, Field(index=True)]
    user_id: Annotated[str, Field(index=True)]
    project_id: Annotated[str, Field(index=True)]
    text: Annotated[str, Field(description="分段后的文本内容")]
    created_at: Annotated[datetime, Field(default_factory=datetime.utcnow)]


class KnowledgeUploadRequest(SQLModel):
    user_id: Annotated[str, Field(description="用户 ID")]
    project_id: Annotated[str, Field(description="项目/书籍 ID")]
    title: Annotated[str, Field(default="untitled", description="文档标题")]
    text: Annotated[str, Field(description="要上传的纯文本内容")]


class KnowledgeUploadResponse(SQLModel):
    document_id: int
    chunks: int


class KnowledgeSearchResponse(SQLModel):
    results: list[dict]
