from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, HTTPException, Request, WebSocket, status
from sqlmodel import Session, select, func

from app.core.config import settings
from app.core.security import get_encryption_key
from app.db.session import get_session
from app.models.auth import InviteCode, User


AUTH_QUERY_NAME = "auth_token"


@dataclass(frozen=True)
class CurrentUser:
    username: str
    is_admin: bool = False


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _unb64(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(data: str) -> str:
    return _b64(hmac.new(get_encryption_key(), data.encode(), hashlib.sha256).digest())


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000)
    return f"pbkdf2_sha256$200000${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algo, rounds, salt_b64, digest_b64 = encoded.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        salt = _unb64(salt_b64)
        expected = _unb64(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(rounds))
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_auth_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=settings.AUTH_TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": user.username,
        "admin": bool(user.is_admin),
        "exp": int(exp.timestamp()),
    }
    payload_part = _b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{payload_part}.{_sign(payload_part)}"


def decode_auth_token(token: str) -> CurrentUser | None:
    try:
        payload_part, signature = token.split(".", 1)
        if not hmac.compare_digest(_sign(payload_part), signature):
            return None
        payload = json.loads(_unb64(payload_part))
        if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
            return None
        username = str(payload.get("sub", "")).strip()
        if not username:
            return None
        return CurrentUser(username=username, is_admin=bool(payload.get("admin")))
    except Exception:
        return None


def user_count(session: Session) -> int:
    return session.exec(select(func.count()).select_from(User)).one()


def create_user(session: Session, username: str, password: str, *, is_admin: bool = False) -> User:
    username = username.strip()
    if len(username) < 2 or len(username) > 40:
        raise HTTPException(status_code=422, detail="用户名长度需要在 2-40 个字符之间")
    if len(password) < 8:
        raise HTTPException(status_code=422, detail="密码至少需要 8 位")
    if session.get(User, username):
        raise HTTPException(status_code=409, detail="用户名已存在")
    user = User(username=username, password_hash=hash_password(password), is_admin=is_admin)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def validate_invite(session: Session, code: str | None) -> InviteCode:
    if not code:
        raise HTTPException(status_code=400, detail="需要邀请码")
    invite = session.get(InviteCode, code.strip())
    now = datetime.utcnow()
    if (
        not invite
        or not invite.is_active
        or invite.uses >= invite.max_uses
        or (invite.expires_at and invite.expires_at < now)
    ):
        raise HTTPException(status_code=400, detail="邀请码无效或已过期")
    return invite


def consume_invite(session: Session, invite: InviteCode) -> None:
    invite.uses += 1
    if invite.uses >= invite.max_uses:
        invite.is_active = False
    session.add(invite)
    session.commit()


def create_invite(session: Session, created_by: str, max_uses: int = 1, expires_days: int | None = 14) -> InviteCode:
    code = secrets.token_urlsafe(18)
    expires_at = None
    if expires_days is not None and expires_days > 0:
        expires_at = datetime.utcnow() + timedelta(days=expires_days)
    invite = InviteCode(
        code=code,
        created_by=created_by,
        max_uses=max(1, min(int(max_uses or 1), 50)),
        expires_at=expires_at,
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)
    return invite


def _extract_bearer_token(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def get_current_user(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> CurrentUser:
    token = _extract_bearer_token(request)
    token_user = decode_auth_token(token) if token else None
    if token_user:
        db_user = session.get(User, token_user.username)
        if db_user and db_user.is_active:
            return CurrentUser(username=db_user.username, is_admin=db_user.is_admin)

    if not settings.AUTH_REQUIRED:
        return CurrentUser(username="default_user", is_admin=True)

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")


def require_admin(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要管理员权限")
    return current_user


def get_websocket_user(websocket: WebSocket) -> CurrentUser | None:
    token = websocket.query_params.get(AUTH_QUERY_NAME)
    token_user = decode_auth_token(token) if token else None
    if token_user:
        return token_user
    if not settings.AUTH_REQUIRED:
        return CurrentUser(username="default_user", is_admin=True)
    return None
