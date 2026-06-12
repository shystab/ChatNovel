from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlmodel import Session, func, select

from app.core.auth import CurrentUser, require_admin
from app.db.session import get_session
from app.models.auth import AdminUserUpdate, User, UserProfileRead
from app.services.workspace_service import delete_system_asset, find_system_asset, save_system_image


router = APIRouter()
MAX_LOGIN_COVER_BYTES = 12 * 1024 * 1024
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


def _active_admin_count(session: Session) -> int:
    return session.exec(
        select(func.count())
        .select_from(User)
        .where(User.is_admin == True)  # noqa: E712
        .where(User.is_active == True)  # noqa: E712
    ).one()


@router.get("/login-cover")
def read_login_cover():
    path = find_system_asset("login-cover")
    if not path or not path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login cover not found")
    return FileResponse(
        path,
        media_type=IMAGE_MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream"),
        headers={"Cache-Control": "no-store"},
    )


@router.post("/login-cover")
async def upload_login_cover(
    file: Annotated[UploadFile, File()],
    _: Annotated[CurrentUser, Depends(require_admin)],
):
    if file.content_type not in set(IMAGE_MEDIA_TYPES.values()):
        raise HTTPException(status_code=400, detail="Only jpg/png/webp/gif images are supported")
    data = await file.read()
    if len(data) > MAX_LOGIN_COVER_BYTES:
        raise HTTPException(status_code=413, detail="Login cover must be smaller than 12MB")
    path = save_system_image("login-cover", file.filename or "login-cover.jpg", data)
    return {"updated": True, "filename": path.name}


@router.delete("/login-cover", status_code=status.HTTP_204_NO_CONTENT)
def clear_login_cover(
    _: Annotated[CurrentUser, Depends(require_admin)],
):
    delete_system_asset("login-cover")


@router.get("/users", response_model=list[UserProfileRead])
def list_all_users(
    _: Annotated[CurrentUser, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
):
    users = session.exec(
        select(User).order_by(User.created_at.asc())  # type: ignore[attr-defined]
    ).all()
    return [_profile(user) for user in users]


@router.patch("/users/{username}", response_model=UserProfileRead)
def update_user_access(
    username: str,
    payload: Annotated[AdminUserUpdate, Body()],
    current_user: Annotated[CurrentUser, Depends(require_admin)],
    session: Annotated[Session, Depends(get_session)],
):
    user = session.get(User, username.strip())
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    next_is_admin = payload.is_admin if payload.is_admin is not None else user.is_admin
    next_is_active = payload.is_active if payload.is_active is not None else user.is_active
    if user.username == current_user.username and (not next_is_admin or not next_is_active):
        raise HTTPException(status_code=400, detail="You cannot remove your own administrator access or disable your account")

    removing_active_admin = user.is_admin and user.is_active and (not next_is_admin or not next_is_active)
    if removing_active_admin and _active_admin_count(session) <= 1:
        raise HTTPException(status_code=400, detail="At least one active administrator is required")

    user.is_admin = next_is_admin
    user.is_active = next_is_active
    session.add(user)
    session.commit()
    session.refresh(user)
    return _profile(user)
