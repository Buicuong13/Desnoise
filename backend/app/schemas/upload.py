"""Schemas for the signed direct-to-Cloudinary upload flow (spec §3)."""
from uuid import UUID

from pydantic import BaseModel, Field


class SignatureIn(BaseModel):
    """Frontend asks the backend to sign a direct Cloudinary upload."""

    workspace_id: UUID
    filename: str
    content_type: str
    file_size: int = Field(ge=1, description="Bytes")
    purpose: str = "original_page"


class SignatureOut(BaseModel):
    upload_url: str
    fields: dict
    expires_in: int = 300


class RegisterUploadIn(BaseModel):
    """Frontend reports the Cloudinary result so the backend can store metadata."""

    original_image_url: str
    cloudinary_public_id: str
    filename: str | None = None
    file_size: int | None = None
    width: int | None = None
    height: int | None = None
    format: str | None = None
