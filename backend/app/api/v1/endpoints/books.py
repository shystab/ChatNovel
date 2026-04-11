"""
书籍 API 接口（含章节子路由）
"""
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Body, status
from sqlmodel import Session, select, func
from typing import Annotated, List

from app.db.session import get_session
from app.crud import book_crud
from app.crud.crud import get_chapters_by_book, get_chapter, create_chapter, update_chapter, delete_chapter
from app.models.books import BookCreate, BookRead, BookUpdate
from app.models.chapters import ChapterCreate, ChapterRead, ChapterUpdate, Chapter


router = APIRouter(responses={404: {"description": "Not found"}})


def _get_book_or_404(book_id: int, session: Session) -> None:
    """验证书籍存在，不存在则抛 404"""
    if not book_crud.get_book(session, book_id):
        raise HTTPException(status_code=404, detail="Book not found")


def _build_book_read(book, session: Session) -> BookRead:
    """将 Book 转为 BookRead，自动填充 chapter_count"""
    count = session.exec(
        select(func.count()).select_from(Chapter).where(Chapter.book_id == book.id)
    ).one()
    return BookRead(
        id=book.id,
        title=book.title,
        description=book.description,
        user_id=book.user_id,
        cover_url=book.cover_url,
        create_time=book.create_time,
        update_time=book.update_time,
        chapter_count=count,
    )


# ── Book CRUD ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[BookRead], summary="获取书籍列表")
def list_books(
    session: Annotated[Session, Depends(get_session)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
):
    books = book_crud.get_books(session, skip=skip, limit=limit)
    return [_build_book_read(b, session) for b in books]


@router.post(
    "/",
    response_model=BookRead,
    status_code=status.HTTP_201_CREATED,
    summary="创建书籍",
)
def create_book(
    book_in: Annotated[BookCreate, Body()],
    session: Annotated[Session, Depends(get_session)],
):
    book = book_crud.create_book(session, book_in)
    return _build_book_read(book, session)


@router.get("/{book_id}", response_model=BookRead, summary="获取书籍详情")
def get_book(
    book_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
):
    book = book_crud.get_book(session, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return _build_book_read(book, session)


@router.patch("/{book_id}", response_model=BookRead, summary="更新书籍信息")
def update_book(
    book_id: Annotated[int, Path(ge=1)],
    book_in: Annotated[BookUpdate, Body()],
    session: Annotated[Session, Depends(get_session)],
):
    book = book_crud.get_book(session, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book = book_crud.update_book(session, book, book_in)
    return _build_book_read(book, session)


@router.delete(
    "/{book_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除书籍",
)
def delete_book(
    book_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
):
    book = book_crud.get_book(session, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book_crud.delete_book(session, book)


# ── Chapter Sub-Resource ───────────────────────────────────────────────────────

@router.get(
    "/{book_id}/chapters",
    response_model=List[ChapterRead],
    summary="获取书籍的章节列表",
)
def list_chapters(
    book_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
):
    _get_book_or_404(book_id, session)
    return get_chapters_by_book(session, book_id, offset=offset, limit=limit)


@router.post(
    "/{book_id}/chapters",
    response_model=ChapterRead,
    status_code=status.HTTP_201_CREATED,
    summary="在书籍下创建章节",
)
def create_chapter_in_book(
    book_id: Annotated[int, Path(ge=1)],
    chapter_in: Annotated[ChapterCreate, Body()],
    session: Annotated[Session, Depends(get_session)],
):
    _get_book_or_404(book_id, session)
    # book_id 从 URL 注入，覆盖 body 里的值
    chapter_in.book_id = book_id
    return create_chapter(session, chapter_in)


@router.get(
    "/{book_id}/chapters/{chapter_id}",
    response_model=ChapterRead,
    summary="获取章节详情",
)
def get_chapter_in_book(
    book_id: Annotated[int, Path(ge=1)],
    chapter_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
):
    chapter = get_chapter(session, chapter_id, book_id=book_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.patch(
    "/{book_id}/chapters/{chapter_id}",
    response_model=ChapterRead,
    summary="更新章节",
)
def update_chapter_in_book(
    book_id: Annotated[int, Path(ge=1)],
    chapter_id: Annotated[int, Path(ge=1)],
    chapter_in: Annotated[ChapterUpdate, Body()],
    session: Annotated[Session, Depends(get_session)],
):
    chapter = get_chapter(session, chapter_id, book_id=book_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return update_chapter(session, chapter, chapter_in)


@router.delete(
    "/{book_id}/chapters/{chapter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除章节",
)
def delete_chapter_in_book(
    book_id: Annotated[int, Path(ge=1)],
    chapter_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
):
    chapter = get_chapter(session, chapter_id, book_id=book_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    delete_chapter(session, chapter)
