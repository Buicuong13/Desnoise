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
    # Informational classifier result from POST /uploads/validate (the gate has
    # already happened client-side; stored only so the editor can show a badge).
    doc_class: str | None = None
    doc_class_confidence: float | None = None


class ValidateUploadIn(BaseModel):
    """Validate that an uploaded image is a document page before registering it."""

    workspace_id: UUID
    image_url: str
    cloudinary_public_id: str | None = None


class ValidateUploadOut(BaseModel):
    is_document: bool
    # 'document' | 'non_document' | 'unknown'
    label: str
    confidence: float
    prob_documents: float
    prob_non_documents: float
    threshold: float
