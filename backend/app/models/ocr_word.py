from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base

if TYPE_CHECKING:
    from app.models.correction import Correction
    from app.models.page import Page


class OcrWord(Base):
    __tablename__ = "ocr_words"
    __table_args__ = (
        Index("ix_ocr_words_page_word", "page_id", "word_index"),
        Index("ix_ocr_words_suspicious", "page_id", postgresql_where="is_suspicious = true"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    page_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("pages.id", ondelete="CASCADE"), nullable=False
    )

    word_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    bbox: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    line_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_suspicious: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    page: Mapped["Page"] = relationship("Page", back_populates="ocr_words")
    corrections: Mapped[list["Correction"]] = relationship(
        "Correction",
        back_populates="ocr_word",
        cascade="all, delete-orphan",
    )
