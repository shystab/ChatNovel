

"""
启动迁移脚本 — 幂等，每次启动都会执行

功能：
1. 为 chapter 表添加 book_id 列（若已存在则忽略）
2. 若无书籍，自动创建"默认书籍"
3. 将所有未分配书籍的章节（book_id=NULL）归入默认书籍
4. 修复 conversation 表：去掉 book_id NOT NULL 约束（重建表）
"""
from sqlmodel import Session, select, text
from app.models.books import Book
from app.models.chapters import Chapter


DEFAULT_BOOK_TITLE = "默认书籍"
DEFAULT_BOOK_DESC = "自动创建的默认书籍，包含所有未分类章节"
DEFAULT_USER_ID = "default_user"


def _fix_conversation_table(session: Session) -> None:
    """
    重建 conversation 表，去掉 book_id NOT NULL 约束。
    SQLite 不支持 ALTER COLUMN，只能 rename → recreate → copy → drop。
    幂等：检测到 book_id 已是 nullable 则跳过。
    """
    # 检查当前 book_id 是否还是 NOT NULL
    rows = session.exec(text("PRAGMA table_info(conversation)")).all()  # type: ignore[call-overload]
    book_id_notnull = None
    for row in rows:
        if row[1] == "book_id":
            book_id_notnull = bool(row[3])  # notnull 字段
            break

    if book_id_notnull is None:
        # conversation 表不存在，交给 SQLModel create_all 处理
        return
    if book_id_notnull is False:
        # 已经是 nullable，无需处理
        return

    print("[Migration] Rebuilding conversation table to make book_id nullable...")
    session.exec(text("""
        CREATE TABLE IF NOT EXISTS conversation_new (
            id      INTEGER PRIMARY KEY,
            user_id VARCHAR NOT NULL,
            title   VARCHAR NOT NULL DEFAULT '新对话',
            messages JSON,
            create_time DATETIME NOT NULL,
            update_time DATETIME NOT NULL,
            book_id INTEGER REFERENCES book(id)
        )
    """))  # type: ignore[call-overload]
    session.exec(text("""
        INSERT INTO conversation_new (id, user_id, title, messages, create_time, update_time, book_id)
        SELECT id, user_id, title, messages, create_time, update_time, NULL
        FROM conversation
    """))  # type: ignore[call-overload]
    session.exec(text("DROP TABLE conversation"))  # type: ignore[call-overload]
    session.exec(text("ALTER TABLE conversation_new RENAME TO conversation"))  # type: ignore[call-overload]
    session.commit()
    print("[Migration] conversation table rebuilt (book_id now nullable)")


def run_startup_migration(session: Session) -> None:
    """幂等迁移：创建默认书籍并归并孤立章节"""

    # Step 1: 安全地添加 book_id 列（SQLite 不会通过 create_all 添加新列）
    try:
        session.exec(text("ALTER TABLE chapter ADD COLUMN book_id INTEGER REFERENCES book(id)"))  # type: ignore[call-overload]
        session.commit()
        print("[Migration] Added book_id column to chapter table")
    except Exception:
        # 列已存在 — 忽略
        session.rollback()

    # Step 2: 安全地添加 summary 列（SQLite 不会通过 create_all 添加新列）
    try:
        session.exec(text("ALTER TABLE chapter ADD COLUMN summary TEXT DEFAULT ''"))  # type: ignore[call-overload]
        session.commit()
        print("[Migration] Added summary column to chapter table")
    except Exception:
        # 列已存在 — 忽略
        session.rollback()

    # Step 2.5: 安全地添加 setting 表的新列
    try:
        session.exec(text("ALTER TABLE setting ADD COLUMN summary_auto_generate BOOLEAN DEFAULT 1"))  # type: ignore[call-overload]
        session.commit()
        print("[Migration] Added summary_auto_generate column to setting table")
    except Exception:
        session.rollback()

    try:
        session.exec(text("ALTER TABLE setting ADD COLUMN summary_generation_style VARCHAR DEFAULT 'concise'"))  # type: ignore[call-overload]
        session.commit()
        print("[Migration] Added summary_generation_style column to setting table")
    except Exception:
        session.rollback()

    # Step 3: 确保至少有一本书
    books = session.exec(select(Book)).all()
    if not books:
        default_book = Book(
            title=DEFAULT_BOOK_TITLE,
            description=DEFAULT_BOOK_DESC,
            user_id=DEFAULT_USER_ID,
        )
        session.add(default_book)
        session.commit()
        session.refresh(default_book)
        default_book_id = default_book.id
        print(f"[Migration] Created default book (id={default_book_id})")
    else:
        default_book_id = books[0].id

    # Step 4: 把所有 book_id=NULL 的章节归入默认书籍
    orphan_chapters = session.exec(
        select(Chapter).where(Chapter.book_id == None)  # noqa: E711
    ).all()

    if orphan_chapters:
        for chapter in orphan_chapters:
            chapter.book_id = default_book_id
            session.add(chapter)
        session.commit()
        print(f"[Migration] Assigned {len(orphan_chapters)} orphan chapter(s) to book_id={default_book_id}")

    # Step 5: 修复 conversation 表（去掉 book_id NOT NULL）
    _fix_conversation_table(session)
