"""Debug-only log of every denoise run for a page.

History shown to users keeps ONLY the latest denoised image
(`pages.denoised_url`, spec §5). This table records each intermediate
attempt for dev/admin debugging and is never surfaced in the main history.
"""
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, UUIDPKMixin

if TYPE_CHECKING:
    from app.models.page import Page


class DenoiseAttempt(UUIDPKMixin, Base):
    __tablename__ = "denoise_attempts"

    page_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("pages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    source_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    output_cloudinary_public_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    params_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    page: Mapped["Page"] = relationship("Page", back_populates="denoise_attempts")
