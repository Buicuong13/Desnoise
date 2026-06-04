"""workspace appearance: icon + color

Adds (additive only):
- documents.icon  (String(40)) — icon key resolved on the frontend
- documents.color (String(20)) — color key resolved on the frontend

Revision ID: 0005_document_icon_color
Revises: 0004_llm_provider_ollama
Create Date: 2026-06-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_document_icon_color"
down_revision: Union[str, None] = "0004_llm_provider_ollama"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("icon", sa.String(40), nullable=True))
    op.add_column("documents", sa.Column("color", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "color")
    op.drop_column("documents", "icon")
