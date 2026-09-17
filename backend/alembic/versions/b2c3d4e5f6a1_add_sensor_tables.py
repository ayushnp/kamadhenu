"""add_sensor_tables

Revision ID: b2c3d4e5f6a1
Revises: a1b2c3d4e5f6
Create Date: 2026-09-17 15:58:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a1'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── 1. Wearable readings ──────────────────────────────────────────────────
    op.create_table(
        'wearable_readings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('cow_id', sa.UUID(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('activity_index', sa.Float(), nullable=False),
        sa.Column('rumination_minutes', sa.Float(), nullable=False),
        sa.Column('body_temperature', sa.Float(), nullable=True),
        sa.Column('lying_time_minutes', sa.Float(), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['cow_id'], ['cows.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_wearable_readings_cow_id'), 'wearable_readings', ['cow_id'], unique=False)
    op.create_index(op.f('ix_wearable_readings_recorded_at'), 'wearable_readings', ['recorded_at'], unique=False)
    op.create_index('ix_wearable_cow_time', 'wearable_readings', ['cow_id', 'recorded_at'], unique=False)

    # ─── 2. Milk readings ──────────────────────────────────────────────────────
    op.create_table(
        'milk_readings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('cow_id', sa.UUID(), nullable=False),
        sa.Column('quarter', sa.String(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('electrical_conductivity', sa.Float(), nullable=False),
        sa.Column('ph', sa.Float(), nullable=False),
        sa.Column('turbidity', sa.Float(), nullable=True),
        sa.Column('milk_temperature', sa.Float(), nullable=True),
        sa.Column('cmt_result', sa.String(), nullable=True),
        sa.Column('scc', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['cow_id'], ['cows.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_milk_readings_cow_id'), 'milk_readings', ['cow_id'], unique=False)
    op.create_index(op.f('ix_milk_readings_recorded_at'), 'milk_readings', ['recorded_at'], unique=False)
    op.create_index('ix_milk_cow_quarter_time', 'milk_readings', ['cow_id', 'quarter', 'recorded_at'], unique=False)

    # ─── 3. Environment readings ───────────────────────────────────────────────
    op.create_table(
        'environment_readings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('farmer_id', sa.UUID(), nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ambient_temperature', sa.Float(), nullable=False),
        sa.Column('humidity', sa.Float(), nullable=False),
        sa.Column('bedding_moisture', sa.Float(), nullable=False),
        sa.Column('ammonia_ppm', sa.Float(), nullable=True),
        sa.Column('hygiene_score', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['farmer_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_environment_readings_farmer_id'), 'environment_readings', ['farmer_id'], unique=False)
    op.create_index(op.f('ix_environment_readings_recorded_at'), 'environment_readings', ['recorded_at'], unique=False)
    op.create_index('ix_env_farmer_time', 'environment_readings', ['farmer_id', 'recorded_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_env_farmer_time', table_name='environment_readings')
    op.drop_index(op.f('ix_environment_readings_recorded_at'), table_name='environment_readings')
    op.drop_index(op.f('ix_environment_readings_farmer_id'), table_name='environment_readings')
    op.drop_table('environment_readings')

    op.drop_index('ix_milk_cow_quarter_time', table_name='milk_readings')
    op.drop_index(op.f('ix_milk_readings_recorded_at'), table_name='milk_readings')
    op.drop_index(op.f('ix_milk_readings_cow_id'), table_name='milk_readings')
    op.drop_table('milk_readings')

    op.drop_index('ix_wearable_cow_time', table_name='wearable_readings')
    op.drop_index(op.f('ix_wearable_readings_recorded_at'), table_name='wearable_readings')
    op.drop_index(op.f('ix_wearable_readings_cow_id'), table_name='wearable_readings')
    op.drop_table('wearable_readings')
