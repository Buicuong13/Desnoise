"""Pydantic schemas used as the LLM output contract."""
from pydantic import BaseModel, Field


class CorrectionSuggestion(BaseModel):
    """One LLM-proposed fix for a suspicious OCR span."""

    original: str = Field(description="The original OCR text that needs to be replaced")
    suggested: str = Field(description="The corrected text the LLM proposes")
    reason: str = Field(default="", description="Short justification for the change")
    confidence: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Self-reported confidence (0..1)",
    )


class CorrectionList(BaseModel):
    """Wrapper so PydanticOutputParser has a single root model."""

    suggestions: list[CorrectionSuggestion] = Field(default_factory=list)
