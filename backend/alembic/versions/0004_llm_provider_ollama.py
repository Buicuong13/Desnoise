"""add 'ollama' to llm_provider enum

The free (viewer) tier can now run on a local/cloud Ollama model instead of
OpenRouter (see VIEWER_LLM_PROVIDER). corrections.llm_provider records which
provider produced each suggestion, so the enum needs the new value.

Revision ID: 0004_llm_provider_ollama
Revises: 0003_page_doc_class
Create Date: 2026-06-04

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004_llm_provider_ollama"
down_revision: Union[str, None] = "0003_page_doc_class"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD VALUE cannot run inside the migration's main transaction on some PG
    # versions — use an autocommit block (same pattern as 0002).
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE llm_provider ADD VALUE IF NOT EXISTS 'ollama'")


def downgrade() -> None:
    # PostgreSQL cannot DROP an enum value; the added 'ollama' value is left in
    # place on downgrade (harmless).
    pass
