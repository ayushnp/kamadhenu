"""add_complaint_number

Revision ID: a1b2c3d4e5f6
Revises: 9c5f223afe10
Create Date: 2026-09-17 10:32:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9c5f223afe10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add complaint_number column — sequential human-readable ID per complaint."""
    op.add_column(
        'complaints',
        sa.Column('complaint_number', sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f('ix_complaints_complaint_number'),
        'complaints',
        ['complaint_number'],
        unique=True,
    )


def downgrade() -> None:
    """Remove complaint_number column."""
    op.drop_index(op.f('ix_complaints_complaint_number'), table_name='complaints')
    op.drop_column('complaints', 'complaint_number')
