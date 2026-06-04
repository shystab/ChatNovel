from sqlmodel import Field, SQLModel, Relationship
from datetime import datetime
from typing import Annotated, TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.chapters import Chapter


class BaseBook(SQLModel):
    """基础书籍模型"""
    title: Annotated[str, Field(index=True, description="书籍标题")]
    description: Annotated[str | None, Field(default=None, description="书籍简介")]
    user_id: Annotated[str, Field(index=True, description="用户ID")]
    cover_url: Annotated[str | None, Field(default=None, description="封面图片URL")]


class Book(BaseBook, table=True):
    """数据库表模型"""
    id: Annotated[int | None, Field(default=None, primary_key=True)]
    create_time: Annotated[datetime, Field(default_factory=datetime.now, description="创建时间")]
    update_time: Annotated[datetime, Field(default_factory=datetime.now, description="更新时间")]

    # 只保留章节关联；对话独立于书籍，不在此维护
    chapters: list["Chapter"] = Relationship(back_populates="book")


class BookRead(BaseBook):
    """读取书籍时的响应模型"""
    id: Annotated[int, Field(description="书籍 ID")]
    create_time: Annotated[datetime, Field(description="创建时间")]
    update_time: Annotated[datetime, Field(description="更新时间")]
    chapter_count: Annotated[int, Field(default=0, description="章节数量")]


class BookCreate(SQLModel):
    """创建书籍时的请求模型"""
    title: Annotated[str, Field(index=True, description="书籍标题")]
    description: Annotated[str | None, Field(default=None, description="书籍简介")]
    user_id: Annotated[str | None, Field(default=None, description="用户ID")]
    cover_url: Annotated[str | None, Field(default=None, description="封面图片URL")]


class BookUpdate(SQLModel):
    """更新书籍时的请求模型"""
    title: Annotated[str | None, Field(default=None, description="书籍标题")]
    description: Annotated[str | None, Field(default=None, description="书籍简介")]
    cover_url: Annotated[str | None, Field(default=None, description="封面图片URL")]
