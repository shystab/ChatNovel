from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.auth import (
    CurrentUser,
    consume_invite,
    create_auth_token,
    create_invite,
    create_user,
    get_current_user,
    require_admin,
    user_count,
    validate_invite,
    verify_password,
)
from app.db.session import get_session
from app.models.auth import AuthResponse, AuthUser, InviteCode, InviteCreateRequest, InviteRead, LoginRequest, RegisterRequest, User


router = APIRouter()


def _auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_auth_token(user),
        user=AuthUser(
            username=user.username,
            display_name=user.display_name,
            bio=user.bio,
            current_work=user.current_work,
            avatar_color=user.avatar_color or "#f97316",
            avatar_image_path=user.avatar_image_path,
            show_background_on_profile=user.show_background_on_profile,
            is_admin=user.is_admin,
        ),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: Annotated[RegisterRequest, Body()],
    session: Annotated[Session, Depends(get_session)],
):
    first_user = user_count(session) == 0
    invite = None
    if not first_user:
        invite = validate_invite(session, payload.invite_code)

    user = create_user(session, payload.username, payload.password, is_admin=first_user)
    if invite:
        consume_invite(session, invite)
    return _auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: Annotated[LoginRequest, Body()],
    session: Annotated[Session, Depends(get_session)],
):
    user = session.get(User, payload.username.strip())
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    user.last_login_at = datetime.utcnow()
    session.add(user)
    session.commit()
    session.refresh(user)
    return _auth_response(user)


@router.get("/me", response_model=AuthUser)
def me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    user = session.get(User, current_user.username)
    if user:
        return AuthUser(
            username=user.username,
            display_name=user.display_name,
            bio=user.bio,
            current_work=user.current_work,
            avatar_color=user.avatar_color or "#f97316",
            avatar_image_path=user.avatar_image_path,
            show_background_on_profile=user.show_background_on_profile,
            is_admin=user.is_admin,
        )
    return AuthUser(username=current_user.username, is_admin=current_user.is_admin)


@router.post("/invites", response_model=InviteRead, status_code=status.HTTP_201_CREATED)
def new_invite(
    payload: Annotated[InviteCreateRequest, Body()],
    current_user: Annotated[CurrentUser, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
):
    return create_invite(
        session,
        created_by=current_user.username,
        max_uses=payload.max_uses,
        expires_days=payload.expires_days,
    )


@router.get("/invites", response_model=list[InviteRead])
def list_invites(
    _: Annotated[CurrentUser, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
):
    return list(session.exec(select(InviteCode).order_by(InviteCode.created_at.desc())).all())  # type: ignore[attr-defined]
