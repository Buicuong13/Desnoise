from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import PageStatus


class PageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    document_id: UUID
    page_number: int
    status: PageStatus
    original_url: str
    denoised_url: str | None
    width: int | None
    height: int | None
    file_size_kb: int | None
    processing_error: str | None
    completed_at: datetime | None


class PageStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: PageStatus
    denoised_url: str | None
    processing_error: str | None
