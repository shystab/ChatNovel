from __future__ import annotations

from datetime import datetime
from typing import Annotated

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    username: Annotated[str, Field(primary_key=True, min_length=2, max_length=40)]
    password_hash: str
    is_admin: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: datetime | None = None


class InviteCode(SQLModel, table=True):
    code: Annotated[str, Field(primary_key=True, min_length=8, max_length=80)]
    created_by: str
    max_uses: int = 1
    uses: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime | None = None


class AuthUser(SQLModel):
    username: str
    is_admin: bool = False


class LoginRequest(SQLModel):
    username: str
    password: str


class RegisterRequest(SQLModel):
    username: str
    password: str
    invite_code: str | None = None


class AuthResponse(SQLModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser


class InviteCreateRequest(SQLModel):
    max_uses: int = 1
    expires_days: int | None = 14


class InviteRead(SQLModel):
    code: str
    max_uses: int
    uses: int
    is_active: bool
    created_at: datetime
    expires_at: datetime | None = None
