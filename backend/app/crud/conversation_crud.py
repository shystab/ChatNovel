"""
对话记录 CRUD 操作
"""
from datetime import datetime
from sqlmodel import Session, select
from app.models.conversations import Conversation, ConversationCreate, ConversationUpdate


def get_conversation(session: Session, conversation_id: int) -> Conversation | None:
    return session.get(Conversation, conversation_id)


def _has_user_content(conv: Conversation) -> bool:
    if conv.messages:
        return True
    if conv.selected_doc_ids:
        return True
    return conv.title.strip() != "新对话"


def get_conversations(
    session: Session,
    skip: int = 0,
    limit: int = 50,
    include_empty: bool = False,
) -> list[Conversation]:
    statement = (
        select(Conversation)
        .order_by(Conversation.update_time.desc())  # type: ignore[attr-defined]
        .offset(skip)
        .limit(limit if include_empty else max(limit * 4, 50))
    )
    conversations = list(session.exec(statement).all())
    if include_empty:
        return conversations
    return [conv for conv in conversations if _has_user_content(conv)][:limit]


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


def delete_empty_conversations(session: Session) -> list[int]:
    conversations = list(session.exec(select(Conversation)).all())
    empty_conversations = [conv for conv in conversations if not _has_user_content(conv)]
    deleted_ids = [conv.id for conv in empty_conversations if conv.id is not None]
    for conv in empty_conversations:
        session.delete(conv)
    session.commit()
    return deleted_ids
