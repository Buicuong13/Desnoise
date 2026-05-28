from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, INTEGER, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDPKMixin
from app.models.enums import CorrectionStatus, LLMProvider

if TYPE_CHECKING:
    from app.models.ocr_word import OcrWord
    from app.models.page import Page


class Correction(UUIDPKMixin, Base):
    """LLM-suggested OCR fix. Keep/Undo via status field."""

    __tablename__ = "corrections"
    __table_args__ = (Index("ix_corrections_page_status", "page_id", "status"),)

    page_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("pages.id", ondelete="CASCADE"), nullable=False
    )
    ocr_word_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("ocr_words.id", ondelete="CASCADE"), nullable=True
    )
    word_indices: Mapped[list[int]] = mapped_column(ARRAY(INTEGER), nullable=False)

    original_text: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_text: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    llm_provider: Mapped[LLMProvider] = mapped_column(
        Enum(LLMProvider, name="llm_provider"), nullable=False
    )
    llm_model: Mapped[str] = mapped_column(String(100), nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

    status: Mapped[CorrectionStatus] = mapped_column(
        Enum(CorrectionStatus, name="correction_status"),
        default=CorrectionStatus.pending,
        nullable=False,
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    page: Mapped["Page"] = relationship("Page", back_populates="corrections")
    ocr_word: Mapped["OcrWord | None"] = relationship("OcrWord", back_populates="corrections")
