# app/db/session.py
from typing import Generator
from sqlmodel import Session, SQLModel, create_engine
from app.core.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    # FastAPI 多线程/多 worker 环境下常见需要关闭线程检查
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, echo=settings.SQL_ECHO, connect_args=connect_args)

def init_db():
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session