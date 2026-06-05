"""add 'classifying' and 'rejected' to page_status enum

Classification moved from a synchronous API call to the background
classify_queue (see celery_redis_pool_deploy_plan.md). A freshly registered
page now sits at `classifying` until the document/non-document gate resolves,
then becomes `uploaded` (accepted) or `rejected` (not a document).

Revision ID: 0006_page_status_classify_reject
Revises: 0005_document_icon_color
Create Date: 2026-06-05

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0006_page_status_classify_reject"
down_revision: Union[str, None] = "0005_document_icon_color"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD VALUE cannot run inside the migration's main transaction on some PG
    # versions — use an autocommit block (same pattern as 0002/0004).
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE page_status ADD VALUE IF NOT EXISTS 'classifying'")
        op.execute("ALTER TYPE page_status ADD VALUE IF NOT EXISTS 'rejected'")


def downgrade() -> None:
    # PostgreSQL cannot DROP an enum value; the added values are left in place
    # on downgrade (harmless).
    pass
