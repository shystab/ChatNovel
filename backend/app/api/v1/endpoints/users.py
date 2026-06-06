from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session, and_, or_, select

from app.core.auth import CurrentUser, get_current_user
from app.db.session import get_session
from app.models.auth import User, UserProfileRead, UserProfileUpdate
from app.crud.settings_crud import get_settings
from app.models.social import (
    DirectMessage,
    DirectMessageCreate,
    DirectMessageRead,
    ShowcaseCard,
    ShowcaseCardCreate,
    ShowcaseCardRead,
    ShowcaseCardUpdate,
)
from app.services.workspace_service import delete_user_asset, resolve_workspace_relative_path, save_user_asset


router = APIRouter()
MAX_AVATAR_BYTES = 3 * 1024 * 1024
MAX_COVER_BYTES = 8 * 1024 * 1024
IMAGE_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def _profile(user: User) -> UserProfileRead:
    return UserProfileRead(
        username=user.username,
        display_name=user.display_name,
        bio=user.bio,
        current_work=user.current_work,
        avatar_color=user.avatar_color or "#f97316",
        avatar_image_path=user.avatar_image_path,
        show_background_on_profile=user.show_background_on_profile,
        is_admin=user.is_admin,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
    )


def _card(card: ShowcaseCard) -> ShowcaseCardRead:
    return ShowcaseCardRead(**card.model_dump())


def _normalize_text(value: str | None, max_len: int) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned[:max_len] or None


def _normalize_avatar_color(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    if cleaned.startswith("#") and len(cleaned) in {4, 7}:
        return cleaned[:7]
    return cleaned[:24]


@router.get("/", response_model=list[UserProfileRead])
def list_users(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    users = session.exec(
        select(User)
        .where(User.is_active == True)  # noqa: E712
        .order_by(User.last_login_at.desc(), User.created_at.desc())  # type: ignore[attr-defined]
    ).all()
    current = current_user.username
    return [_profile(user) for user in users if user.username != current]


@router.get("/me", response_model=UserProfileRead)
def my_profile(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    user = session.get(User, current_user.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return _profile(user)


@router.patch("/me", response_model=UserProfileRead)
def update_my_profile(
    payload: Annotated[UserProfileUpdate, Body()],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    user = session.get(User, current_user.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    if payload.display_name is not None:
        user.display_name = _normalize_text(payload.display_name, 80)
    if payload.bio is not None:
        user.bio = _normalize_text(payload.bio, 300)
    if payload.current_work is not None:
        user.current_work = _normalize_text(payload.current_work, 240)
    if payload.avatar_color is not None:
        user.avatar_color = _normalize_avatar_color(payload.avatar_color) or user.avatar_color
    if payload.show_background_on_profile is not None:
        user.show_background_on_profile = payload.show_background_on_profile

    session.add(user)
    session.commit()
    session.refresh(user)
    return _profile(user)


def _ensure_image(file: UploadFile, max_bytes: int, data: bytes) -> None:
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="只支持 jpg/png/webp/gif 图片")
    if len(data) > max_bytes:
        limit = max_bytes // 1024 // 1024
        raise HTTPException(status_code=413, detail=f"图片需要小于 {limit}MB")


def _image_response(path):
    suffix = path.suffix.lower()
    return FileResponse(
        path,
        media_type=IMAGE_MEDIA_TYPES.get(suffix, "application/octet-stream"),
        headers={"Cache-Control": "no-store"},
    )


@router.post("/me/avatar", response_model=UserProfileRead)
async def upload_my_avatar(
    file: Annotated[UploadFile, File()],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    data = await file.read()
    _ensure_image(file, MAX_AVATAR_BYTES, data)
    user = session.get(User, current_user.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    old_path = user.avatar_image_path
    new_path = save_user_asset(
        user.username,
        "avatars",
        file.filename or "avatar.jpg",
        data,
        stem=f"avatar-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
    )
    if old_path and old_path != new_path:
        delete_user_asset(old_path)
    user.avatar_image_path = new_path
    session.add(user)
    session.commit()
    session.refresh(user)
    return _profile(user)


@router.delete("/me/avatar", response_model=UserProfileRead)
def delete_my_avatar(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    user = session.get(User, current_user.username)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    delete_user_asset(user.avatar_image_path)
    user.avatar_image_path = None
    session.add(user)
    session.commit()
    session.refresh(user)
    return _profile(user)


@router.get("/{username}/background")
def read_user_background(
    username: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    user = session.get(User, username.strip())
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="背景不存在")
    if current_user.username != user.username and not user.show_background_on_profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="主页背景不存在")
    db_settings = get_settings(session, user_id=user.username)
    if not db_settings or not db_settings.background_image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="背景不存在")
    try:
        path = resolve_workspace_relative_path(db_settings.background_image_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="主页背景路径无效") from exc
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="主页背景不存在")
    return _image_response(path)


@router.get("/{username}/avatar")
def read_avatar(
    username: str,
    _: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    user = session.get(User, username.strip())
    if not user or not user.is_active or not user.avatar_image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="头像不存在")
    try:
        path = resolve_workspace_relative_path(user.avatar_image_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="头像路径无效") from exc
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="头像不存在")
    return _image_response(path)


@router.get("/{username}/profile", response_model=UserProfileRead)
def read_user_profile(
    username: str,
    _: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    user = session.get(User, username.strip())
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return _profile(user)


@router.get("/showcases/me", response_model=list[ShowcaseCardRead])
def list_my_showcases(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    cards = session.exec(
        select(ShowcaseCard)
        .where(ShowcaseCard.user_id == current_user.username)
        .order_by(ShowcaseCard.sort_order.asc(), ShowcaseCard.updated_at.desc())  # type: ignore[attr-defined]
    ).all()
    return [_card(card) for card in cards]


@router.post("/showcases", response_model=ShowcaseCardRead, status_code=status.HTTP_201_CREATED)
def create_showcase(
    payload: Annotated[ShowcaseCardCreate, Body()],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    now = datetime.utcnow()
    card = ShowcaseCard(
        user_id=current_user.username,
        title=payload.title.strip(),
        subtitle=_normalize_text(payload.subtitle, 160),
        excerpt=_normalize_text(payload.excerpt, 500) or "",
        content=_normalize_text(payload.content, 20000) or "",
        is_public=payload.is_public,
        sort_order=payload.sort_order,
        created_at=now,
        updated_at=now,
    )
    session.add(card)
    session.commit()
    session.refresh(card)
    return _card(card)


@router.get("/showcases/{card_id}", response_model=ShowcaseCardRead)
def get_showcase(
    card_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    card = session.get(ShowcaseCard, card_id)
    if not card or (not card.is_public and card.user_id != current_user.username and not current_user.is_admin):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="展示卡片不存在")
    return _card(card)


@router.patch("/showcases/{card_id}", response_model=ShowcaseCardRead)
def update_showcase(
    card_id: int,
    payload: Annotated[ShowcaseCardUpdate, Body()],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    card = session.get(ShowcaseCard, card_id)
    if not card or card.user_id != current_user.username:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="展示卡片不存在")

    if payload.title is not None:
        title = payload.title.strip()
        if not title:
            raise HTTPException(status_code=422, detail="标题不能为空")
        card.title = title
    if payload.subtitle is not None:
        card.subtitle = _normalize_text(payload.subtitle, 160)
    if payload.excerpt is not None:
        card.excerpt = _normalize_text(payload.excerpt, 500) or ""
    if payload.content is not None:
        card.content = _normalize_text(payload.content, 20000) or ""
    if payload.is_public is not None:
        card.is_public = payload.is_public
    if payload.sort_order is not None:
        card.sort_order = payload.sort_order
    card.updated_at = datetime.utcnow()
    session.add(card)
    session.commit()
    session.refresh(card)
    return _card(card)


@router.delete("/showcases/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_showcase(
    card_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    card = session.get(ShowcaseCard, card_id)
    if not card or card.user_id != current_user.username:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="展示卡片不存在")
    delete_user_asset(card.cover_image_path)
    session.delete(card)
    session.commit()


@router.post("/showcases/{card_id}/cover", response_model=ShowcaseCardRead)
async def upload_showcase_cover(
    card_id: int,
    file: Annotated[UploadFile, File()],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    data = await file.read()
    _ensure_image(file, MAX_COVER_BYTES, data)
    card = session.get(ShowcaseCard, card_id)
    if not card or card.user_id != current_user.username:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="展示卡片不存在")

    old_path = card.cover_image_path
    new_path = save_user_asset(
        current_user.username,
        "showcase-covers",
        file.filename or "cover.jpg",
        data,
        stem=f"showcase-{card_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}",
    )
    if old_path and old_path != new_path:
        delete_user_asset(old_path)
    card.cover_image_path = new_path
    card.updated_at = datetime.utcnow()
    session.add(card)
    session.commit()
    session.refresh(card)
    return _card(card)


@router.get("/showcases/{card_id}/cover")
def read_showcase_cover(
    card_id: int,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    card = session.get(ShowcaseCard, card_id)
    if not card or (not card.is_public and card.user_id != current_user.username and not current_user.is_admin):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="封面不存在")
    if not card.cover_image_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="封面不存在")
    try:
        path = resolve_workspace_relative_path(card.cover_image_path)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="封面路径无效") from exc
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="封面不存在")
    return _image_response(path)


@router.get("/{username}/showcases", response_model=list[ShowcaseCardRead])
def list_user_showcases(
    username: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    user = session.get(User, username.strip())
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    stmt = select(ShowcaseCard).where(ShowcaseCard.user_id == user.username)
    if current_user.username != user.username and not current_user.is_admin:
        stmt = stmt.where(ShowcaseCard.is_public == True)  # noqa: E712
    cards = session.exec(
        stmt.order_by(ShowcaseCard.sort_order.asc(), ShowcaseCard.updated_at.desc())  # type: ignore[attr-defined]
    ).all()
    return [_card(card) for card in cards]


@router.get("/messages", response_model=list[DirectMessageRead])
def list_messages(
    with_user: Annotated[str, Query(min_length=2, max_length=40)],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=200)] = 80,
):
    other_username = with_user.strip()
    other = session.get(User, other_username)
    if not other or not other.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    me = current_user.username
    messages = session.exec(
        select(DirectMessage)
        .where(
            or_(
                and_(DirectMessage.sender_username == me, DirectMessage.recipient_username == other_username),
                and_(DirectMessage.sender_username == other_username, DirectMessage.recipient_username == me),
            )
        )
        .order_by(DirectMessage.created_at.desc())  # type: ignore[attr-defined]
        .limit(limit)
    ).all()

    changed = False
    now = datetime.utcnow()
    for message in messages:
        if message.recipient_username == me and message.read_at is None:
            message.read_at = now
            session.add(message)
            changed = True
    if changed:
        session.commit()

    return list(reversed(messages))


@router.post("/messages", response_model=DirectMessageRead, status_code=status.HTTP_201_CREATED)
def send_message(
    payload: Annotated[DirectMessageCreate, Body()],
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    recipient_username = payload.to_user.strip()
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="消息不能为空")
    if recipient_username == current_user.username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="不能给自己发送消息")

    recipient = session.get(User, recipient_username)
    if not recipient or not recipient.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")

    message = DirectMessage(
        sender_username=current_user.username,
        recipient_username=recipient_username,
        content=content[:2000],
    )
    session.add(message)
    session.commit()
    session.refresh(message)
    return message
