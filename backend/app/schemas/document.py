from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DocumentStatus


class DocumentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=20)


class DocumentUpdate(BaseModel):
    """Partial update — only provided fields are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=40)
    color: str | None = Field(default=None, max_length=20)


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    icon: str | None = None
    color: str | None = None
    status: DocumentStatus
    total_pages: int
    created_at: datetime
