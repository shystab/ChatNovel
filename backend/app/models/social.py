from __future__ import annotations

from datetime import datetime
from typing import Annotated

from sqlmodel import Field, SQLModel


class DirectMessage(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    sender_username: Annotated[str, Field(index=True, max_length=40)]
    recipient_username: Annotated[str, Field(index=True, max_length=40)]
    content: Annotated[str, Field(min_length=1, max_length=2000)]
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    read_at: datetime | None = None


class DirectMessageCreate(SQLModel):
    to_user: Annotated[str, Field(min_length=2, max_length=40)]
    content: Annotated[str, Field(min_length=1, max_length=2000)]


class DirectMessageRead(SQLModel):
    id: int
    sender_username: str
    recipient_username: str
    content: str
    created_at: datetime
    read_at: datetime | None = None


class ShowcaseCard(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: Annotated[str, Field(index=True, max_length=40)]
    title: Annotated[str, Field(min_length=1, max_length=120)]
    subtitle: Annotated[str | None, Field(default=None, max_length=160)] = None
    excerpt: Annotated[str, Field(default="", max_length=500)] = ""
    content: Annotated[str, Field(default="", max_length=20000)] = ""
    cover_image_path: Annotated[str | None, Field(default=None, max_length=500)] = None
    is_public: bool = True
    sort_order: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)


class ShowcaseCardCreate(SQLModel):
    title: Annotated[str, Field(min_length=1, max_length=120)]
    subtitle: Annotated[str | None, Field(default=None, max_length=160)] = None
    excerpt: Annotated[str | None, Field(default=None, max_length=500)] = None
    content: Annotated[str | None, Field(default=None, max_length=20000)] = None
    is_public: bool = True
    sort_order: int = 0


class ShowcaseCardUpdate(SQLModel):
    title: Annotated[str | None, Field(default=None, max_length=120)] = None
    subtitle: Annotated[str | None, Field(default=None, max_length=160)] = None
    excerpt: Annotated[str | None, Field(default=None, max_length=500)] = None
    content: Annotated[str | None, Field(default=None, max_length=20000)] = None
    is_public: bool | None = None
    sort_order: int | None = None


class ShowcaseCardRead(SQLModel):
    id: int
    user_id: str
    title: str
    subtitle: str | None = None
    excerpt: str
    content: str
    cover_image_path: str | None = None
    is_public: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime
