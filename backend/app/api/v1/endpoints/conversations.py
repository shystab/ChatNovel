"""
对话记录 API 接口 — 完全独立于书籍
"""
from fastapi import APIRouter, Depends, HTTPException, Path, Query, Body, status
from sqlmodel import Session
from typing import Annotated, Any

from app.db.session import get_session
from app.crud import conversation_crud
from app.models.conversations import ConversationRead, ConversationCreate, ConversationUpdate

router = APIRouter(responses={404: {"description": "Conversation not found"}})


class ConversationCreateRequest(ConversationCreate):
    """创建请求体（可附带初始消息）"""
    messages: list[dict[str, Any]] | None = None


@router.get("/", response_model=list[ConversationRead], summary="获取对话列表")
def list_conversations(
    session: Annotated[Session, Depends(get_session)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
):
    return conversation_crud.get_conversations(session, skip=skip, limit=limit)


@router.post("/", response_model=ConversationRead, status_code=status.HTTP_201_CREATED, summary="创建对话")
def create_conversation(
    conv_in: Annotated[ConversationCreateRequest, Body()],
    session: Annotated[Session, Depends(get_session)],
):
    conv = conversation_crud.create_conversation(session, conv_in)
    if conv_in.messages:
        conv = conversation_crud.update_conversation(
            session, conv, ConversationUpdate(messages=conv_in.messages)
        )
    return conv


@router.get("/{conversation_id}", response_model=ConversationRead, summary="获取对话详情")
def get_conversation(
    conversation_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
):
    conv = conversation_crud.get_conversation(session, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.patch("/{conversation_id}", response_model=ConversationRead, summary="更新对话")
def update_conversation(
    conversation_id: Annotated[int, Path(ge=1)],
    conv_in: Annotated[ConversationUpdate, Body()],
    session: Annotated[Session, Depends(get_session)],
):
    conv = conversation_crud.get_conversation(session, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation_crud.update_conversation(session, conv, conv_in)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除对话")
def delete_conversation(
    conversation_id: Annotated[int, Path(ge=1)],
    session: Annotated[Session, Depends(get_session)],
):
    conv = conversation_crud.get_conversation(session, conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conversation_crud.delete_conversation(session, conv)
