"""page restoration / recovery metric columns

Adds (additive only):
- pages: recovery_score (Numeric(5,2)), ocr_conf_before (Numeric(5,2)),
         ocr_conf_after (Numeric(5,2))

Stores the task-based restoration metric computed at OCR time from the average
per-word OCR confidence: `before` = original (noisy) image, `after` = current
(denoised) image, `recovery_score` = after. Used to show "this page is N%
readable / pipeline improved readability by +M" in the editor.

Revision ID: 0009_page_recovery_score
Revises: 0008_oauth_users
Create Date: 2026-06-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_page_recovery_score"
down_revision: Union[str, None] = "0008_oauth_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pages", sa.Column("recovery_score", sa.Numeric(5, 2), nullable=True))
    op.add_column("pages", sa.Column("ocr_conf_before", sa.Numeric(5, 2), nullable=True))
    op.add_column("pages", sa.Column("ocr_conf_after", sa.Numeric(5, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("pages", "ocr_conf_after")
    op.drop_column("pages", "ocr_conf_before")
    op.drop_column("pages", "recovery_score")
