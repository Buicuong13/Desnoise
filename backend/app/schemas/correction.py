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


class TriggerCorrectionIn(BaseModel):
    """Optional body for triggering LLM correction.

    `provider` lets a paid user pick the model (openai → gpt-4o-mini, or ollama).
    Ignored for viewers (forced onto the free tier). Defaults to the role's
    default provider when omitted.
    """

    provider: LLMProvider | None = None


class BulkReviewIn(BaseModel):
    accept_ids: list[UUID] = []
    reject_ids: list[UUID] = []


class FinalTextOut(BaseModel):
    page_id: UUID
    text: str
    blurred: bool = False
