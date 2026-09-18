"""Pydantic schemas for the mastitis risk engine API."""

import uuid
from datetime import datetime
from typing import List

from pydantic import BaseModel


class RiskFactor(BaseModel):
    label: str      # "Milk EC rose 34% above baseline"
    weight: str     # "high" | "moderate" | "low"
    value: float    # raw computed feature value


class RiskResponse(BaseModel):
    cow_id: uuid.UUID
    scored_at: datetime
    score: float         # 0.0 - 100.0
    category: str        # "no_risk" | "low" | "moderate" | "high"
    factors: List[RiskFactor]
    engine_version: str
    window_days: int
    recommendation: str  # plain-English action for farmer


class FarmRiskSummary(BaseModel):
    total_cows: int
    no_risk: int
    low: int
    moderate: int
    high: int
    high_risk_cows: list  # list of dicts with cow_id, name, pashu_aadhar, score, category
