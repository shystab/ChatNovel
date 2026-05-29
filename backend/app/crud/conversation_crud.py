"""
对话记录 CRUD 操作
"""
from datetime import datetime
from sqlmodel import Session, select
from app.models.conversations import Conversation, ConversationCreate, ConversationUpdate


def get_conversation(session: Session, conversation_id: int) -> Conversation | None:
    return session.get(Conversation, conversation_id)


def get_conversations(session: Session, skip: int = 0, limit: int = 50) -> list[Conversation]:
    statement = (
        select(Conversation)
        .order_by(Conversation.update_time.desc())  # type: ignore[attr-defined]
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def create_conversation(session: Session, conv_in: ConversationCreate) -> Conversation:
    conv = Conversation(
        user_id=conv_in.user_id,
        title=conv_in.title,
        messages=[],
        selected_doc_ids=[],
    )
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv


def update_conversation(
    session: Session, conv: Conversation, conv_in: ConversationUpdate
) -> Conversation:
    conv_data = conv_in.model_dump(exclude_unset=True)
    for key, value in conv_data.items():
        setattr(conv, key, value)
    conv.update_time = datetime.now()
    session.add(conv)
    session.commit()
    session.refresh(conv)
    return conv


def delete_conversation(session: Session, conv: Conversation) -> None:
    session.delete(conv)
    session.commit()
