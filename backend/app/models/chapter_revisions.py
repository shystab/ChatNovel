from datetime import datetime
from typing import Annotated

from sqlmodel import Field, SQLModel

from app.core.time import utc_now_naive


class ChapterRevision(SQLModel, table=True):
    id: Annotated[int | None, Field(default=None, primary_key=True)]
    chapter_id: Annotated[int, Field(index=True)]
    book_id: Annotated[int, Field(index=True)]
    user_id: Annotated[str, Field(index=True)]
    title: str
    content: str
    created_at: Annotated[datetime, Field(default_factory=utc_now_naive, index=True)]


class ChapterRevisionRead(SQLModel):
    id: int
    chapter_id: int
    book_id: int
    title: str
    content: str
    created_at: datetime
