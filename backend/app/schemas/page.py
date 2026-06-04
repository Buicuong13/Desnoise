from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import PageStatus


class PageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    page_number: int
    status: PageStatus
    original_url: str
    # Current denoised image (overwritten on each "Denoise Again").
    denoised_url: str | None
    denoise_version: int = 0
    width: int | None
    height: int | None
    file_size_kb: int | None
    doc_class: str | None = None
    doc_class_confidence: float | None = None
    ocr_plain_text: str | None = None
    tiptap_json: dict[str, Any] | None = None
    final_text: str | None = None
    processing_error: str | None
    completed_at: datetime | None


class PageStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: PageStatus
    denoised_url: str | None
    denoise_version: int = 0
    processing_error: str | None


class DenoiseIn(BaseModel):
    """Options for POST /pages/{id}/denoise (spec §4.3)."""

    source: Literal["original", "current_denoised"] = "original"
    params: dict[str, Any] = Field(default_factory=dict)


class TiptapPatchIn(BaseModel):
    """Manual edit save from the Tiptap editor (spec §7, §16)."""

    tiptap_json: dict[str, Any]
