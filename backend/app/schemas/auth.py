from pydantic import BaseModel, ConfigDict, EmailStr, Field
from uuid import UUID

from app.models.enums import UserRole, UserStatus


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=150)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class OAuthGoogleIn(BaseModel):
    """Frontend obtains this from supabase-js after the Google OAuth redirect; the
    backend verifies it against Supabase and bridges it to its own session."""

    access_token: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class LogoutIn(BaseModel):
    refresh_token: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str | None
    role: UserRole
    status: UserStatus
    images_used: int


class AuthSessionOut(BaseModel):
    """Response returned by /auth/register and /auth/login: tokens + user info."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class DevLoginIn(BaseModel):
    email: EmailStr = "dev@example.com"
    role: UserRole = UserRole.user
