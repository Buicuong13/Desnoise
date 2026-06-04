"""page document-classifier result columns

Adds (additive only):
- pages: doc_class (String(20)), doc_class_confidence (Numeric(5,4))

Captures the MobileNetV3-Small document/non-document classification recorded at
upload time. The actual upload gate happens in POST /uploads/validate before the
page is created; these columns are informational only (e.g. show a badge).

Revision ID: 0003_page_doc_class
Revises: 0002_direct_upload
Create Date: 2026-06-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_page_doc_class"
down_revision: Union[str, None] = "0002_direct_upload"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("pages", sa.Column("doc_class", sa.String(20), nullable=True))
    op.add_column("pages", sa.Column("doc_class_confidence", sa.Numeric(5, 4), nullable=True))


def downgrade() -> None:
    op.drop_column("pages", "doc_class_confidence")
    op.drop_column("pages", "doc_class")
