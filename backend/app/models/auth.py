from __future__ import annotations

from datetime import datetime
from typing import Annotated

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    username: Annotated[str, Field(primary_key=True, min_length=2, max_length=40)]
    password_hash: str
    display_name: Annotated[str | None, Field(default=None, max_length=80)] = None
    bio: Annotated[str | None, Field(default=None, max_length=300)] = None
    current_work: Annotated[str | None, Field(default=None, max_length=240)] = None
    avatar_color: Annotated[str, Field(default="#f97316", max_length=24)] = "#f97316"
    avatar_image_path: Annotated[str | None, Field(default=None, max_length=500)] = None
    show_background_on_profile: bool = False
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
    display_name: str | None = None
    bio: str | None = None
    current_work: str | None = None
    avatar_color: str = "#f97316"
    avatar_image_path: str | None = None
    show_background_on_profile: bool = False
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


class UserProfileRead(SQLModel):
    username: str
    display_name: str | None = None
    bio: str | None = None
    current_work: str | None = None
    avatar_color: str = "#f97316"
    avatar_image_path: str | None = None
    show_background_on_profile: bool = False
    is_admin: bool = False
    is_active: bool = True
    created_at: datetime
    last_login_at: datetime | None = None


class UserProfileUpdate(SQLModel):
    display_name: Annotated[str | None, Field(default=None, max_length=80)] = None
    bio: Annotated[str | None, Field(default=None, max_length=300)] = None
    current_work: Annotated[str | None, Field(default=None, max_length=240)] = None
    avatar_color: Annotated[str | None, Field(default=None, max_length=24)] = None
    show_background_on_profile: bool | None = None


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
