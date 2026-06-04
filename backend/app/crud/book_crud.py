"""
书籍 CRUD 操作
"""
from sqlmodel import Session, select
from app.models.books import Book, BookCreate, BookUpdate


def get_book(session: Session, book_id: int, user_id: str | None = None) -> Book | None:
    """根据 ID 获取书籍"""
    book = session.get(Book, book_id)
    if user_id is not None and book and book.user_id != user_id:
        return None
    return book


def get_books(session: Session, skip: int = 0, limit: int = 100, user_id: str | None = None) -> list[Book]:
    """获取书籍列表"""
    statement = select(Book)
    if user_id is not None:
        statement = statement.where(Book.user_id == user_id)
    statement = statement.offset(skip).limit(limit)
    return list(session.exec(statement).all())


def create_book(session: Session, book_in: BookCreate) -> Book:
    """创建书籍"""
    book = Book.model_validate(book_in)
    session.add(book)
    session.commit()
    session.refresh(book)
    return book


def update_book(session: Session, book: Book, book_in: BookUpdate) -> Book:
    """更新书籍（部分更新）"""
    book_data = book_in.model_dump(exclude_unset=True)
    for key, value in book_data.items():
        setattr(book, key, value)
    session.add(book)
    session.commit()
    session.refresh(book)
    return book


def delete_book(session: Session, book: Book) -> None:
    """删除书籍"""
    session.delete(book)
    session.commit()
