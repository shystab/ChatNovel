"""
书籍 API 接口（含章节子路由）
"""
import io

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Body, status
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, func
from typing import Annotated, List

from app.db.session import get_session
from app.core.auth import CurrentUser, get_current_user
from app.crud import book_crud
from app.crud.crud import get_chapters_by_book, get_chapter, create_chapter, update_chapter, delete_chapter
from app.models.books import Book, BookCreate, BookRead, BookUpdate
from app.models.chapters import ChapterCreate, ChapterRead, ChapterUpdate, Chapter
from app.services.workspace_service import (
    build_docx_export,
    build_txt_export,
    build_workspace_backup,
    content_disposition,
    delete_chapter_files,
    read_workspace_book,
    safe_filename,
    scan_library_workspace,
    sync_book_workspace,
    sync_library_workspace,
    write_chapter_file,
    write_project_manifest,
)


router = APIRouter(responses={404: {"description": "Not found"}})


def _get_book_or_404(book_id: int, session: Session, user_id: str) -> Book:
    """验证书籍存在，不存在则抛 404"""
    book = book_crud.get_book(session, book_id, user_id=user_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


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


def _library_items(session: Session, user_id: str) -> list[tuple]:
    books = book_crud.get_books(session, limit=1000, user_id=user_id)
    return [
        (book, get_chapters_by_book(session, book.id, limit=5000))
        for book in books
        if book.id is not None
    ]


def _find_import_book(session: Session, title: str, user_id: str):
    return session.exec(select(Book).where(Book.title == title).where(Book.user_id == user_id)).first()


def _find_import_chapter(session: Session, book_id: int, chapter_data: dict) -> Chapter | None:
    chapter_id = chapter_data.get("id")
    if chapter_id:
        chapter = get_chapter(session, chapter_id)
        if chapter and chapter.book_id == book_id:
            return chapter

    return session.exec(
        select(Chapter)
        .where(Chapter.book_id == book_id)
        .where(Chapter.order == chapter_data["order"])
    ).first()


def _import_workspace_library(session: Session, user_id: str) -> dict:
    scan = scan_library_workspace()
    created_books = 0
    updated_books = 0
    created_chapters = 0
    updated_chapters = 0

    for scanned_book in scan["books"]:
        data = read_workspace_book(scanned_book["folder"])
        book = _find_import_book(session, data["title"], user_id)
        if book:
            book.title = data["title"]
            book.description = data.get("description")
            book.user_id = user_id
            updated_books += 1
        else:
            book = book_crud.create_book(session, BookCreate(
                title=data["title"],
                description=data.get("description"),
                user_id=user_id,
            ))
            created_books += 1

        session.add(book)
        session.commit()
        session.refresh(book)

        for chapter_data in data["chapters"]:
            chapter = _find_import_chapter(session, book.id, chapter_data)
            if chapter:
                chapter = update_chapter(session, chapter, ChapterUpdate(
                    title=chapter_data["title"],
                    content=chapter_data["content"],
                    order=chapter_data["order"],
                ))
                updated_chapters += 1
            else:
                chapter = create_chapter(session, ChapterCreate(
                    title=chapter_data["title"],
                    content=chapter_data["content"],
                    order=chapter_data["order"],
                    book_id=book.id,
                ))
                created_chapters += 1
            write_chapter_file(chapter, book)

    return {
        "workspace": scan["workspace"],
        "book_count": scan["book_count"],
        "chapter_count": scan["chapter_count"],
        "created_books": created_books,
        "updated_books": updated_books,
        "created_chapters": created_chapters,
        "updated_chapters": updated_chapters,
    }


# ── Book CRUD ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[BookRead], summary="获取书籍列表")
def list_books(
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
):
    books = book_crud.get_books(session, skip=skip, limit=limit, user_id=current_user.username)
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
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    book_in.user_id = current_user.username
    book = book_crud.create_book(session, book_in)
    write_project_manifest(book)
    return _build_book_read(book, session)


@router.get("/{book_id}", response_model=BookRead, summary="获取书籍详情")
def get_book(
    book_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    book = book_crud.get_book(session, book_id, user_id=current_user.username)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return _build_book_read(book, session)


@router.patch("/{book_id}", response_model=BookRead, summary="更新书籍信息")
def update_book(
    book_id: Annotated[int, Path(ge=1)],
    book_in: Annotated[BookUpdate, Body()],
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    book = book_crud.get_book(session, book_id, user_id=current_user.username)
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
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    book = book_crud.get_book(session, book_id, user_id=current_user.username)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book_crud.delete_book(session, book)


@router.post("/workspace/sync", summary="同步全部作品到作品文件夹")
def sync_library_to_workspace(
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    return sync_library_workspace(_library_items(session, current_user.username))


@router.post("/workspace/backup", summary="备份数据库和作品文件夹")
def backup_workspace(
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    sync_library_workspace(_library_items(session, current_user.username))
    filename, output = build_workspace_backup()
    return StreamingResponse(
        output,
        media_type="application/zip",
        headers={"Content-Disposition": content_disposition(filename)},
    )


@router.get("/workspace/scan", summary="扫描作品文件夹")
def scan_workspace():
    return scan_library_workspace()


@router.post("/workspace/import", summary="从作品文件夹导入到数据库")
def import_workspace(
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    result = _import_workspace_library(session, current_user.username)
    sync_library_workspace(_library_items(session, current_user.username))
    return result


# ── Chapter Sub-Resource ───────────────────────────────────────────────────────

@router.get("/{book_id}/export/txt", summary="导出当前书籍为 TXT")
def export_book_txt(
    book_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ids: Annotated[str | None, Query(description="Comma-separated chapter IDs to export")] = None,
):
    book = book_crud.get_book(session, book_id, user_id=current_user.username)
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
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ids: Annotated[str | None, Query(description="Comma-separated chapter IDs to export")] = None,
):
    book = book_crud.get_book(session, book_id, user_id=current_user.username)
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
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    book = book_crud.get_book(session, book_id, user_id=current_user.username)
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
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
):
    _get_book_or_404(book_id, session, current_user.username)
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
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    _get_book_or_404(book_id, session, current_user.username)
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
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    _get_book_or_404(book_id, session, current_user.username)
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
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    _get_book_or_404(book_id, session, current_user.username)
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
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    _get_book_or_404(book_id, session, current_user.username)
    chapter = get_chapter(session, chapter_id, book_id=book_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    delete_chapter_files(chapter)
    delete_chapter(session, chapter)
