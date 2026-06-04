# app/db/session.py
from typing import Generator
from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine
from app.core.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    # FastAPI 会把同步接口放进线程池；SQLite 轻量多人使用时需要允许跨线程连接并等待短暂写锁。
    connect_args = {"check_same_thread": False, "timeout": 30}

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.SQL_ECHO,
    connect_args=connect_args,
    pool_pre_ping=True,
)


if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
