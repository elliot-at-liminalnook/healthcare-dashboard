"""add patient version

Revision ID: 3c9a41e07b52
Revises: f0d8fdac145c
Create Date: 2026-11-18 13:14:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3c9a41e07b52"
down_revision: str | Sequence[str] | None = "f0d8fdac145c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Existing patients start at version 1, the same as a newly created one.
    op.add_column(
        "patients", sa.Column("version", sa.Integer(), server_default="1", nullable=False)
    )


def downgrade() -> None:
    op.drop_column("patients", "version")
