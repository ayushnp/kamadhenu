"""Schemas for sensor data ingestion and retrieval."""

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.sensor import CMTResult, MilkQuarter


# ─── Wearable Collar Schemas ───────────────────────────────────────────────────

class WearableIngest(BaseModel):
    """Payload sent by wearable collar or gateway.
    Accepts either cow_id (UUID) or pashu_aadhar (human/tag identifier).
    """

    cow_id: Optional[uuid.UUID] = None
    pashu_aadhar: Optional[str] = Field(default=None, max_length=50)

    recorded_at: Optional[datetime] = None
    activity_index: float = Field(ge=0.0, description="Movement or step score")
    rumination_minutes: float = Field(ge=0.0, description="Chewing time in minutes")
    body_temperature: Optional[float] = Field(default=None, description="Body temp in °C")
    lying_time_minutes: Optional[float] = Field(default=None, ge=0.0)
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @model_validator(mode="after")
    def validate_cow_identifier(self) -> "WearableIngest":
        if not self.cow_id and not self.pashu_aadhar:
            raise ValueError("Either 'cow_id' or 'pashu_aadhar' must be provided.")
        return self


class WearableBatchIngest(BaseModel):
    """Batch of readings uploaded when collar syncs after being offline."""

    readings: List[WearableIngest]


class WearableRead(BaseModel):
    id: uuid.UUID
    cow_id: uuid.UUID
    recorded_at: datetime
    activity_index: float
    rumination_minutes: float
    body_temperature: Optional[float] = None
    lying_time_minutes: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Milk Analyzer Schemas ────────────────────────────────────────────────────

class MilkQuarterItem(BaseModel):
    quarter: MilkQuarter
    electrical_conductivity: float = Field(ge=0.0, description="mS/cm")
    ph: float = Field(ge=0.0, le=14.0, description="pH value")
    turbidity: Optional[float] = Field(default=None, ge=0.0)
    milk_temperature: Optional[float] = Field(default=None)
    cmt_result: Optional[CMTResult] = None
    scc: Optional[int] = Field(default=None, ge=0)


class MilkIngest(BaseModel):
    """Single quarter reading payload."""

    cow_id: Optional[uuid.UUID] = None
    pashu_aadhar: Optional[str] = Field(default=None, max_length=50)
    recorded_at: Optional[datetime] = None
    quarter: MilkQuarter
    electrical_conductivity: float = Field(ge=0.0)
    ph: float = Field(ge=0.0, le=14.0)
    turbidity: Optional[float] = None
    milk_temperature: Optional[float] = None
    cmt_result: Optional[CMTResult] = None
    scc: Optional[int] = None

    @model_validator(mode="after")
    def validate_cow_identifier(self) -> "MilkIngest":
        if not self.cow_id and not self.pashu_aadhar:
            raise ValueError("Either 'cow_id' or 'pashu_aadhar' must be provided.")
        return self


class MilkSessionIngest(BaseModel):
    """Milking session recording multiple quarters (FL, FR, RL, RR) at once."""

    cow_id: Optional[uuid.UUID] = None
    pashu_aadhar: Optional[str] = Field(default=None, max_length=50)
    recorded_at: Optional[datetime] = None
    quarters: List[MilkQuarterItem]

    @model_validator(mode="after")
    def validate_cow_identifier(self) -> "MilkSessionIngest":
        if not self.cow_id and not self.pashu_aadhar:
            raise ValueError("Either 'cow_id' or 'pashu_aadhar' must be provided.")
        if not self.quarters:
            raise ValueError("At least one quarter reading must be supplied.")
        return self


class MilkRead(BaseModel):
    id: uuid.UUID
    cow_id: uuid.UUID
    quarter: MilkQuarter
    recorded_at: datetime
    electrical_conductivity: float
    ph: float
    turbidity: Optional[float] = None
    milk_temperature: Optional[float] = None
    cmt_result: Optional[CMTResult] = None
    scc: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Environment Schemas ──────────────────────────────────────────────────────

class EnvironmentIngest(BaseModel):
    """Payload from the barn environmental monitor."""

    farmer_id: Optional[uuid.UUID] = None
    farmer_phone: Optional[str] = None
    recorded_at: Optional[datetime] = None
    ambient_temperature: float = Field(description="°C")
    humidity: float = Field(ge=0.0, le=100.0, description="% RH")
    bedding_moisture: float = Field(ge=0.0, le=100.0, description="% moisture")
    ammonia_ppm: Optional[float] = Field(default=None, ge=0.0)
    hygiene_score: Optional[int] = Field(default=None, ge=1, le=4)

    @model_validator(mode="after")
    def validate_farmer_identifier(self) -> "EnvironmentIngest":
        if not self.farmer_id and not self.farmer_phone:
            raise ValueError("Either 'farmer_id' or 'farmer_phone' must be provided.")
        return self


class EnvironmentRead(BaseModel):
    id: uuid.UUID
    farmer_id: uuid.UUID
    recorded_at: datetime
    ambient_temperature: float
    humidity: float
    bedding_moisture: float
    ammonia_ppm: Optional[float] = None
    hygiene_score: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Combined Cow Telemetry Trend ─────────────────────────────────────────────

class CowTelemetrySummary(BaseModel):
    cow_id: uuid.UUID
    pashu_aadhar: Optional[str] = None
    cow_name: Optional[str] = None
    days_requested: int
    wearable_records_count: int
    milk_records_count: int
    wearable: List[WearableRead]
    milk: List[MilkRead]
