"""RiskScore DB model -- stores XGBoost mastitis risk predictions."""

import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class RiskScore(SQLModel, table=True):
    """One mastitis risk assessment result per cow per scoring run."""

    __tablename__ = "risk_scores"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    cow_id: uuid.UUID = Field(foreign_key="cows.id", index=True)
    scored_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)

    score: float          # 0.0 - 100.0
    category: str         # "no_risk" | "low" | "moderate" | "high"
    factors: str          # JSON-serialised list[RiskFactor] dicts
    engine_version: str = Field(default="xgb-v1")
    window_days: int = Field(default=7)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
