from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPKMixin
from app.models.enums import PageStatus

if TYPE_CHECKING:
    from app.models.correction import Correction
    from app.models.denoise_attempt import DenoiseAttempt
    from app.models.document import Document
    from app.models.ocr_word import OcrWord


class Page(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "pages"
    __table_args__ = (UniqueConstraint("document_id", "page_number", name="uq_pages_doc_pageno"),)

    document_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # `cloudinary_public_id` holds the ORIGINAL image public_id.
    cloudinary_public_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    original_url: Mapped[str] = mapped_column(Text, nullable=False)
    # `denoised_url` always points at the CURRENT denoised image (overwritten on
    # each "Denoise Again" — history only keeps the latest, per spec §5).
    denoised_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_denoised_cloudinary_public_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    denoise_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    file_size_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Document-layout OCR result (spec §6.2): block → paragraph → line → word.
    ocr_document_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    ocr_plain_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Tiptap ProseMirror document used by the frontend editor (spec §7-§8).
    tiptap_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    # Final reviewed text (OCR + kept LLM corrections + manual edits) used by export.
    final_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[PageStatus] = mapped_column(
        Enum(PageStatus, name="page_status"),
        default=PageStatus.uploaded,
        nullable=False,
        index=True,
    )
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    document: Mapped["Document"] = relationship("Document", back_populates="pages")
    ocr_words: Mapped[list["OcrWord"]] = relationship(
        "OcrWord", back_populates="page", cascade="all, delete-orphan"
    )
    corrections: Mapped[list["Correction"]] = relationship(
        "Correction", back_populates="page", cascade="all, delete-orphan"
    )
    denoise_attempts: Mapped[list["DenoiseAttempt"]] = relationship(
        "DenoiseAttempt", back_populates="page", cascade="all, delete-orphan"
    )
