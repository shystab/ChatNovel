"""
书籍 API 接口（含章节子路由）
"""
import io

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Body, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, func
from typing import Annotated, List

from app.db.session import get_session
from app.crud import book_crud
from app.crud.crud import get_chapters_by_book, get_chapter, create_chapter, update_chapter, delete_chapter
from app.models.books import BookCreate, BookRead, BookUpdate
from app.models.chapters import ChapterCreate, ChapterRead, ChapterUpdate, Chapter
from app.services.workspace_service import (
    build_docx_export,
    build_txt_export,
    content_disposition,
    delete_chapter_files,
    safe_filename,
    sync_book_workspace,
    sync_library_workspace,
    write_chapter_file,
    write_project_manifest,
)


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


def _parse_chapter_ids(ids: str | None) -> list[int] | None:
    if not ids:
        return None
    try:
        parsed = [int(item.strip()) for item in ids.split(",") if item.strip()]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="ids must be comma-separated integers") from exc
    if not parsed:
        raise HTTPException(status_code=422, detail="ids cannot be empty")
    return parsed


def _export_chapters_for_book(session: Session, book_id: int, ids: str | None) -> list[Chapter]:
    chapters = get_chapters_by_book(session, book_id, limit=5000)
    chapter_ids = _parse_chapter_ids(ids)
    if chapter_ids is None:
        return chapters

    by_id = {chapter.id: chapter for chapter in chapters}
    missing = [chapter_id for chapter_id in chapter_ids if chapter_id not in by_id]
    if missing:
        raise HTTPException(status_code=404, detail=f"Chapter(s) not found in book: {missing}")
    return [by_id[chapter_id] for chapter_id in chapter_ids]


def _attachment_filename(book, suffix: str) -> str:
    return f"{safe_filename(book.title, 'novel')}.{suffix}"


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
    write_project_manifest(book)
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
    write_project_manifest(book)
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


@router.post("/workspace/sync", summary="同步全部作品到作品文件夹")
def sync_library_to_workspace(
    session: Annotated[Session, Depends(get_session)],
):
    books = book_crud.get_books(session, limit=1000)
    items = [
        (book, get_chapters_by_book(session, book.id, limit=5000))
        for book in books
        if book.id is not None
    ]
    return sync_library_workspace(items)


# ── Chapter Sub-Resource ───────────────────────────────────────────────────────

@router.get("/{book_id}/export/txt", summary="导出当前书籍为 TXT")
def export_book_txt(
    book_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
    ids: Annotated[str | None, Query(description="Comma-separated chapter IDs to export")] = None,
):
    book = book_crud.get_book(session, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    chapters = _export_chapters_for_book(session, book_id, ids)
    if not chapters:
        raise HTTPException(status_code=404, detail="No chapters found")

    content = build_txt_export(chapters, title=book.title)
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": content_disposition(_attachment_filename(book, "txt"))},
    )


@router.get("/{book_id}/export/docx", summary="导出当前书籍为 DOCX")
def export_book_docx(
    book_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
    ids: Annotated[str | None, Query(description="Comma-separated chapter IDs to export")] = None,
):
    book = book_crud.get_book(session, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    chapters = _export_chapters_for_book(session, book_id, ids)
    if not chapters:
        raise HTTPException(status_code=404, detail="No chapters found")

    return StreamingResponse(
        build_docx_export(chapters, title=book.title),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": content_disposition(_attachment_filename(book, "docx"))},
    )


@router.post("/{book_id}/workspace/sync", summary="同步当前书籍到作品文件夹")
def sync_book_to_workspace(
    book_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
):
    book = book_crud.get_book(session, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    chapters = get_chapters_by_book(session, book_id, limit=5000)
    return sync_book_workspace(book, chapters)


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
    chapter = create_chapter(session, chapter_in)
    write_chapter_file(chapter)
    return chapter


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
    updated = update_chapter(session, chapter, chapter_in)
    write_chapter_file(updated)
    return updated


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
    delete_chapter_files(chapter)
    delete_chapter(session, chapter)
