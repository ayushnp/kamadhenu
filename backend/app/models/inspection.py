"""Farm & Barn Inspection report models."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Index
from sqlmodel import Column, Field, SQLModel, String, Text


class InspectionStatus(str, Enum):
    passed = "passed"                      # Grade A — Clean & Compliant
    conditional_pass = "conditional_pass"  # Grade B — Needs Attention / Minor Rectifications
    failed = "failed"                      # Grade C — Bio-Hazard / Urgent Action Required


class FarmInspection(SQLModel, table=True):
    """Official Barn & Farm Hygiene / Biosecurity Inspection Report filed by Field Inspector."""

    __tablename__ = "farm_inspections"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )

    farmer_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    inspector_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # Optional linked complaint (if inspection was triggered by a complaint or outbreak)
    complaint_id: Optional[uuid.UUID] = Field(default=None, foreign_key="complaints.id", index=True)

    inspected_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # Overall Outcome & Score (0 - 100)
    status: InspectionStatus = Field(default=InspectionStatus.passed)
    overall_score: int = Field(default=85, ge=0, le=100)

    # Category Scores (1 to 5 scale)
    biosecurity_score: int = Field(default=4, ge=1, le=5)      # Sanitization, pest barrier, disinfection
    ventilation_score: int = Field(default=4, ge=1, le=5)      # Ammonia control, shed airflow, heat dissipation
    bedding_hygiene_score: int = Field(default=4, ge=1, le=5)  # Floor dryness, lime powder, manure removal
    water_feed_score: int = Field(default=4, ge=1, le=5)       # Clean drinking troughs, unadulterated feed
    milking_hygiene_score: int = Field(default=4, ge=1, le=5)  # Teat dipping, machine sanitization
    animal_welfare_score: int = Field(default=4, ge=1, le=5)   # Housing density, shed comfort, quarantine pen

    # Field Measurements observed by Inspector
    ammonia_ppm_observed: Optional[float] = Field(default=None)
    bedding_moisture_observed: Optional[float] = Field(default=None)

    # Summary & Recommendations
    summary: str = Field(sa_column=Column(String, nullable=False))
    deficiencies: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    recommendations: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    # Follow-up
    follow_up_required: bool = Field(default=False)
    follow_up_date: Optional[datetime] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_inspection_farmer_time", "farmer_id", "inspected_at"),
        Index("ix_inspection_inspector_time", "inspector_id", "inspected_at"),
    )


class FarmInspectionCreate(BaseModel):
    farmer_id: uuid.UUID
    complaint_id: Optional[uuid.UUID] = None
    status: InspectionStatus = InspectionStatus.passed
    overall_score: int = 85
    biosecurity_score: int = 4
    ventilation_score: int = 4
    bedding_hygiene_score: int = 4
    water_feed_score: int = 4
    milking_hygiene_score: int = 4
    animal_welfare_score: int = 4
    ammonia_ppm_observed: Optional[float] = None
    bedding_moisture_observed: Optional[float] = None
    summary: str
    deficiencies: Optional[str] = None
    recommendations: Optional[str] = None
    follow_up_required: bool = False
    follow_up_date: Optional[datetime] = None


class FarmInspectionRead(BaseModel):
    id: uuid.UUID
    farmer_id: uuid.UUID
    farmer_name: Optional[str] = None
    farmer_place: Optional[str] = None
    farmer_phone: Optional[str] = None
    inspector_id: uuid.UUID
    inspector_name: Optional[str] = None
    complaint_id: Optional[uuid.UUID] = None
    inspected_at: datetime
    status: InspectionStatus
    overall_score: int
    biosecurity_score: int
    ventilation_score: int
    bedding_hygiene_score: int
    water_feed_score: int
    milking_hygiene_score: int
    animal_welfare_score: int
    ammonia_ppm_observed: Optional[float] = None
    bedding_moisture_observed: Optional[float] = None
    summary: str
    deficiencies: Optional[str] = None
    recommendations: Optional[str] = None
    follow_up_required: bool
    follow_up_date: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
