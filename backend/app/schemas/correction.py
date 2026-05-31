from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import CorrectionStatus, LLMProvider


class CorrectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    page_id: UUID
    word_indices: list[int] | None
    start_offset: int | None
    end_offset: int | None
    original_text: str
    suggested_text: str
    reason: str | None
    llm_provider: LLMProvider
    llm_model: str
    confidence_score: float | None
    status: CorrectionStatus
    reviewed_at: datetime | None
    created_at: datetime


class BulkReviewIn(BaseModel):
    accept_ids: list[UUID] = []
    reject_ids: list[UUID] = []


class FinalTextOut(BaseModel):
    page_id: UUID
    text: str
    blurred: bool = False
