"""direct upload + denoise versioning + layout OCR + tiptap

Adds (additive only):
- pages: denoise_version, current_denoised_cloudinary_public_id,
  ocr_document_json, ocr_plain_text, tiptap_json, final_text
- ocr_words: start_offset, end_offset
- corrections: start_offset, end_offset; word_indices -> nullable
- page_status enum values: reviewing, reviewed, exported
- new table: denoise_attempts (debug only)

Revision ID: 0002_direct_upload
Revises: 0001_initial
Create Date: 2026-05-31

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_direct_upload"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_NEW_PAGE_STATUSES = ("reviewing", "reviewed", "exported")


def upgrade() -> None:
    # ── New page_status enum values. ADD VALUE cannot run inside the migration's
    #    main transaction on some PG versions, so use an autocommit block.
    with op.get_context().autocommit_block():
        for value in _NEW_PAGE_STATUSES:
            op.execute(f"ALTER TYPE page_status ADD VALUE IF NOT EXISTS '{value}'")

    # ── pages: new columns
    op.add_column("pages", sa.Column("denoise_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("pages", sa.Column("current_denoised_cloudinary_public_id", sa.String(255), nullable=True))
    op.add_column("pages", sa.Column("ocr_document_json", postgresql.JSONB, nullable=True))
    op.add_column("pages", sa.Column("ocr_plain_text", sa.Text, nullable=True))
    op.add_column("pages", sa.Column("tiptap_json", postgresql.JSONB, nullable=True))
    op.add_column("pages", sa.Column("final_text", sa.Text, nullable=True))

    # ── ocr_words: char offsets into ocr_plain_text
    op.add_column("ocr_words", sa.Column("start_offset", sa.Integer, nullable=True))
    op.add_column("ocr_words", sa.Column("end_offset", sa.Integer, nullable=True))

    # ── corrections: char offsets + word_indices now nullable (offset is primary)
    op.add_column("corrections", sa.Column("start_offset", sa.Integer, nullable=True))
    op.add_column("corrections", sa.Column("end_offset", sa.Integer, nullable=True))
    op.alter_column("corrections", "word_indices", existing_type=postgresql.ARRAY(sa.Integer), nullable=True)

    # ── denoise_attempts (debug only — never shown in main history)
    op.create_table(
        "denoise_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("page_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version", sa.Integer, nullable=False),
        sa.Column("source_image_url", sa.Text, nullable=True),
        sa.Column("output_image_url", sa.Text, nullable=True),
        sa.Column("output_cloudinary_public_id", sa.Text, nullable=True),
        sa.Column("params_json", postgresql.JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_denoise_attempts_page", "denoise_attempts", ["page_id"])


def downgrade() -> None:
    op.drop_index("ix_denoise_attempts_page", table_name="denoise_attempts")
    op.drop_table("denoise_attempts")

    op.alter_column("corrections", "word_indices", existing_type=postgresql.ARRAY(sa.Integer), nullable=False)
    op.drop_column("corrections", "end_offset")
    op.drop_column("corrections", "start_offset")

    op.drop_column("ocr_words", "end_offset")
    op.drop_column("ocr_words", "start_offset")

    op.drop_column("pages", "final_text")
    op.drop_column("pages", "tiptap_json")
    op.drop_column("pages", "ocr_plain_text")
    op.drop_column("pages", "ocr_document_json")
    op.drop_column("pages", "current_denoised_cloudinary_public_id")
    op.drop_column("pages", "denoise_version")

    # NOTE: PostgreSQL cannot DROP enum values; the added page_status values
    # ('reviewing', 'reviewed', 'exported') are left in place on downgrade.
