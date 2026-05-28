from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base, TimestampMixin, UUIDPKMixin
from app.models.enums import DocumentStatus

if TYPE_CHECKING:
    from app.models.export import Export
    from app.models.feedback import Feedback
    from app.models.page import Page
    from app.models.user import User


class Document(UUIDPKMixin, TimestampMixin, Base):
    """A workspace = one book / one set of related pages."""

    __tablename__ = "documents"

    user_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status"),
        default=DocumentStatus.draft,
        nullable=False,
        index=True,
    )

    total_pages: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    ui_state: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    last_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner: Mapped["User"] = relationship(
        "User", back_populates="documents", foreign_keys=[user_id]
    )
    pages: Mapped[list["Page"]] = relationship(
        "Page", back_populates="document", cascade="all, delete-orphan"
    )
    feedbacks: Mapped[list["Feedback"]] = relationship(
        "Feedback", back_populates="document", cascade="all, delete-orphan"
    )
    exports: Mapped[list["Export"]] = relationship(
        "Export", back_populates="document", cascade="all, delete-orphan"
    )
