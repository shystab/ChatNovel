from __future__ import annotations

from datetime import timedelta

from sqlmodel import Session, select

from app.core.time import utc_now_naive
from app.models.chapter_revisions import ChapterRevision
from app.models.chapters import Chapter


REVISION_INTERVAL = timedelta(minutes=5)
MAX_REVISIONS_PER_CHAPTER = 50


def list_chapter_revisions(session: Session, chapter_id: int, user_id: str) -> list[ChapterRevision]:
    return list(
        session.exec(
            select(ChapterRevision)
            .where(ChapterRevision.chapter_id == chapter_id)
            .where(ChapterRevision.user_id == user_id)
            .order_by(ChapterRevision.created_at.desc())  # type: ignore[attr-defined]
            .limit(MAX_REVISIONS_PER_CHAPTER + 20)
        ).all()
    )


def snapshot_chapter(
    session: Session,
    chapter: Chapter,
    user_id: str,
    *,
    force: bool = False,
) -> ChapterRevision | None:
    if chapter.id is None or chapter.book_id is None:
        return None

    revisions = list_chapter_revisions(session, chapter.id, user_id)
    latest = revisions[0] if revisions else None
    if latest and latest.content == chapter.content and latest.title == chapter.title:
        return None
    if latest and not force and latest.created_at > utc_now_naive() - REVISION_INTERVAL:
        return None

    revision = ChapterRevision(
        chapter_id=chapter.id,
        book_id=chapter.book_id,
        user_id=user_id,
        title=chapter.title,
        content=chapter.content,
    )
    session.add(revision)
    session.commit()
    session.refresh(revision)

    for old_revision in revisions[MAX_REVISIONS_PER_CHAPTER - 1:]:
        session.delete(old_revision)
    session.commit()
    return revision
