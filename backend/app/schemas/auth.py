from pydantic import BaseModel, EmailStr

from app.models.enums import UserRole


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DevLoginIn(BaseModel):
    email: EmailStr = "dev@example.com"
    role: UserRole = UserRole.user
