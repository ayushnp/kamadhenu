from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision = "c3d4e5f6a7b2"
down_revision = "b2c3d4e5f6a1"
branch_labels = None
depends_on = None


def upgrade():
    # 1. risk_scores — stores XGBoost mastitis risk predictions per cow
    op.create_table(
        "risk_scores",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("cow_id", sa.UUID(), nullable=False),
        sa.Column("scored_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("factors", sa.Text(), nullable=True),
        sa.Column("engine_version", sa.String(), nullable=False, server_default="xgb-v1"),
        sa.Column("window_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["cow_id"], ["cows.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_risk_scores_id", "risk_scores", ["id"])
    op.create_index("ix_risk_scores_cow_id", "risk_scores", ["cow_id"])
    op.create_index("ix_risk_scores_scored_at", "risk_scores", ["scored_at"])
    op.create_index("ix_risk_cow_scored", "risk_scores", ["cow_id", "scored_at"])

    # 2. cows.freshening_date — start of current lactation (enables Days-In-Milk)
    op.add_column("cows", sa.Column("freshening_date", sa.Date(), nullable=True))

    # 3. milk_readings.milk_yield_litres — total yield; enables yield-drop detection
    op.add_column("milk_readings", sa.Column("milk_yield_litres", sa.Float(), nullable=True))


def downgrade():
    op.drop_column("milk_readings", "milk_yield_litres")
    op.drop_column("cows", "freshening_date")
    op.drop_index("ix_risk_cow_scored", table_name="risk_scores")
    op.drop_index("ix_risk_scores_scored_at", table_name="risk_scores")
    op.drop_index("ix_risk_scores_cow_id", table_name="risk_scores")
    op.drop_index("ix_risk_scores_id", table_name="risk_scores")
    op.drop_table("risk_scores")
