"""initial schema (12 tables)

Revision ID: 0001_initial
Revises:
Create Date: 2026-05-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# `create_type=False` keeps op.create_table from auto-issuing CREATE TYPE again
# (which would collide with the explicit enum.create() loop below).
user_role = postgresql.ENUM("admin", "user", "viewer", name="user_role", create_type=False)
user_status = postgresql.ENUM("active", "banned", "pending", name="user_status", create_type=False)
document_status = postgresql.ENUM(
    "draft", "processing", "ready", "archived", name="document_status", create_type=False
)
page_status = postgresql.ENUM(
    "uploaded",
    "denoising",
    "denoised",
    "ocr_running",
    "ocr_done",
    "llm_running",
    "llm_done",
    "failed",
    name="page_status",
    create_type=False,
)
correction_status = postgresql.ENUM(
    "pending", "kept", "undone", name="correction_status", create_type=False
)
llm_provider = postgresql.ENUM(
    "openai", "openrouter_qwen", name="llm_provider", create_type=False
)
export_format = postgresql.ENUM("docx", "pdf", name="export_format", create_type=False)
subscription_status = postgresql.ENUM(
    "active", "expired", "cancelled", name="subscription_status", create_type=False
)
payment_gateway = postgresql.ENUM(
    "vnpay", "momo", "stripe", name="payment_gateway", create_type=False
)
payment_status = postgresql.ENUM(
    "pending", "success", "failed", "refunded", name="payment_status", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    for enum in (
        user_role,
        user_status,
        document_status,
        page_status,
        correction_status,
        llm_provider,
        export_format,
        subscription_status,
        payment_gateway,
        payment_status,
    ):
        enum.create(bind, checkfirst=True)

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(150), nullable=True),
        sa.Column("role", user_role, nullable=False, server_default="viewer"),
        sa.Column("status", user_status, nullable=False, server_default="active"),
        sa.Column("images_used", sa.Integer, nullable=False, server_default="0"),
        sa.Column("active_workspace_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_status", "users", ["status"])

    # documents (workspace)
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", document_status, nullable=False, server_default="draft"),
        sa.Column("total_pages", sa.Integer, nullable=False, server_default="0"),
        sa.Column("ui_state", postgresql.JSONB, nullable=True),
        sa.Column("last_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_documents_user_recent", "documents", ["user_id", "last_opened_at"])
    op.create_foreign_key(
        "fk_users_active_workspace",
        "users",
        "documents",
        ["active_workspace_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # refresh_tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user", "refresh_tokens", ["user_id"])

    # pages
    op.create_table(
        "pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_number", sa.Integer, nullable=False),
        sa.Column("cloudinary_public_id", sa.String(255), nullable=True),
        sa.Column("original_url", sa.Text, nullable=False),
        sa.Column("denoised_url", sa.Text, nullable=True),
        sa.Column("file_size_kb", sa.Integer, nullable=True),
        sa.Column("width", sa.Integer, nullable=True),
        sa.Column("height", sa.Integer, nullable=True),
        sa.Column("status", page_status, nullable=False, server_default="uploaded"),
        sa.Column("processing_error", sa.Text, nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("document_id", "page_number", name="uq_pages_doc_pageno"),
    )
    op.create_index("ix_pages_document", "pages", ["document_id"])
    op.create_index("ix_pages_status", "pages", ["status"])

    # ocr_words
    op.create_table(
        "ocr_words",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("page_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("word_index", sa.Integer, nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("confidence", sa.Numeric(5, 2), nullable=False),
        sa.Column("bbox", postgresql.JSONB, nullable=True),
        sa.Column("line_number", sa.Integer, nullable=True),
        sa.Column("is_suspicious", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ocr_words_page_word", "ocr_words", ["page_id", "word_index"])
    op.create_index(
        "ix_ocr_words_suspicious",
        "ocr_words",
        ["page_id"],
        postgresql_where=sa.text("is_suspicious = true"),
    )

    # corrections
    op.create_table(
        "corrections",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("page_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ocr_word_id", sa.BigInteger, sa.ForeignKey("ocr_words.id", ondelete="CASCADE"), nullable=True),
        sa.Column("word_indices", postgresql.ARRAY(sa.Integer), nullable=False),
        sa.Column("original_text", sa.Text, nullable=False),
        sa.Column("suggested_text", sa.Text, nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("llm_provider", llm_provider, nullable=False),
        sa.Column("llm_model", sa.String(100), nullable=False),
        sa.Column("confidence_score", sa.Numeric(5, 2), nullable=True),
        sa.Column("status", correction_status, nullable=False, server_default="pending"),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_corrections_page_status", "corrections", ["page_id", "status"])

    # feedback
    op.create_table(
        "feedback",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pages.id", ondelete="CASCADE"), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("note", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_feedback_document", "feedback", ["document_id"])

    # exports
    op.create_table(
        "exports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("format", export_format, nullable=False),
        sa.Column("file_url", sa.Text, nullable=False),
        sa.Column("file_size_kb", sa.Integer, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_exports_document", "exports", ["document_id"])

    # subscription_plans
    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(30), nullable=False, unique=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("price_vnd", sa.Integer, nullable=False),
        sa.Column("duration_days", sa.Integer, nullable=False),
        sa.Column("features", postgresql.JSONB, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # user_subscriptions
    op.create_table(
        "user_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", sa.Integer, sa.ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", subscription_status, nullable=False, server_default="active"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_user_subscriptions_user", "user_subscriptions", ["user_id"])
    op.create_index("ix_user_subscriptions_status", "user_subscriptions", ["status"])

    # payments
    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("user_subscriptions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("gateway", payment_gateway, nullable=False),
        sa.Column("gateway_txn_id", sa.String(100), nullable=False, unique=True),
        sa.Column("amount_vnd", sa.Integer, nullable=False),
        sa.Column("status", payment_status, nullable=False, server_default="pending"),
        sa.Column("raw_payload", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_payments_user", "payments", ["user_id"])
    op.create_index("ix_payments_status", "payments", ["status"])

    # audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("actor_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("target_id", sa.String(100), nullable=True),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column("ip", postgresql.INET, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_created", "audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_constraint("fk_users_active_workspace", "users", type_="foreignkey")
    for table in (
        "audit_logs",
        "payments",
        "user_subscriptions",
        "subscription_plans",
        "exports",
        "feedback",
        "corrections",
        "ocr_words",
        "pages",
        "refresh_tokens",
        "documents",
        "users",
    ):
        op.drop_table(table)

    bind = op.get_bind()
    for enum in (
        payment_status,
        payment_gateway,
        subscription_status,
        export_format,
        llm_provider,
        correction_status,
        page_status,
        document_status,
        user_status,
        user_role,
    ):
        enum.drop(bind, checkfirst=True)
