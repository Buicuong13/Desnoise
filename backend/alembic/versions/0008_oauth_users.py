"""oauth users: nullable password + auth_provider

Supports Google sign-in bridged through Supabase. OAuth-only accounts have no
local password, so:
- users.password_hash  -> nullable
- users.auth_provider  (String(20), default 'local') — 'local' | 'google'

Revision ID: 0008_oauth_users
Revises: 0007_seed_subscription_plans
Create Date: 2026-06-09

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_oauth_users"
down_revision: Union[str, None] = "0007_seed_subscription_plans"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "auth_provider",
            sa.String(20),
            server_default="local",
            nullable=False,
        ),
    )
    op.alter_column("users", "password_hash", existing_type=sa.String(255), nullable=True)


def downgrade() -> None:
    # Restore NOT NULL — backfill any OAuth-only rows with an empty hash first so
    # the constraint can be re-applied without failing on existing data.
    op.execute("UPDATE users SET password_hash = '' WHERE password_hash IS NULL")
    op.alter_column("users", "password_hash", existing_type=sa.String(255), nullable=False)
    op.drop_column("users", "auth_provider")
