"""Sensor telemetry models — wearable collar, milk quality analyzer, and barn environment."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import Index
from sqlmodel import Column, Field, SQLModel, String


class MilkQuarter(str, Enum):
    """Udder quarters: Front Left, Front Right, Rear Left, Rear Right."""

    FL = "FL"
    FR = "FR"
    RL = "RL"
    RR = "RR"


class CMTResult(str, Enum):
    """California Mastitis Test gel reaction classifications."""

    negative = "negative"
    trace = "trace"
    one_plus = "1+"
    two_plus = "2+"
    three_plus = "3+"


class WearableReading(SQLModel, table=True):
    """Continuous collar telemetry: rumination, activity, body temperature."""

    __tablename__ = "wearable_readings"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )
    cow_id: uuid.UUID = Field(foreign_key="cows.id", index=True)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # ─── Movement & Rumination ────────────────────────────────────────────────
    activity_index: float = Field(default=0.0, ge=0.0)  # steps/acceleration magnitude
    rumination_minutes: float = Field(default=0.0, ge=0.0)  # minutes per hour/time window
    body_temperature: Optional[float] = Field(default=None)  # in °C (normal ~38.0 - 39.2)
    lying_time_minutes: Optional[float] = Field(default=None, ge=0.0)

    # Optional collar GPS fix
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_wearable_cow_time", "cow_id", "recorded_at"),
    )


class MilkReading(SQLModel, table=True):
    """Per-quarter milk testing metrics collected at morning/evening milking."""

    __tablename__ = "milk_readings"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )
    cow_id: uuid.UUID = Field(foreign_key="cows.id", index=True)
    quarter: MilkQuarter = Field(sa_column=Column(String, nullable=False))
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        index=True,
    )

    # ─── Milk Electro-Chemical & Physical Metrics ─────────────────────────────
    electrical_conductivity: float = Field(ge=0.0)  # mS/cm (normal: 4.0 - 5.5; mastitis: >5.8)
    ph: float = Field(ge=0.0)  # normal: 6.4 - 6.8; alkaline (>6.8) indicates mastitis
    turbidity: Optional[float] = Field(default=None, ge=0.0)  # NTU / optical density
    milk_temperature: Optional[float] = Field(default=None)  # in °C

    # ─── Somatic Cell & Clinical Markers ──────────────────────────────────────
    cmt_result: Optional[CMTResult] = Field(
        default=None,
        sa_column=Column(String, nullable=True),
    )
    scc: Optional[int] = Field(default=None, ge=0)  # somatic cell count cells/mL

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_milk_cow_quarter_time", "cow_id", "quarter", "recorded_at"),
    )


class EnvironmentReading(SQLModel, table=True):
    """Barn environmental telemetry (ambient temperature, humidity, moisture, ammonia)."""

    __tablename__ = "environment_readings"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )
    farmer_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    recorded_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        index=True,
    )

    ambient_temperature: float = Field()  # in °C
    humidity: float = Field(ge=0.0, le=100.0)  # % RH
    bedding_moisture: float = Field(ge=0.0, le=100.0)  # % moisture in stall floor
    ammonia_ppm: Optional[float] = Field(default=None, ge=0.0)  # ppm (normal <15, harmful >25)
    hygiene_score: Optional[int] = Field(default=None, ge=1, le=4)  # 1 = clean, 4 = dirty

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_env_farmer_time", "farmer_id", "recorded_at"),
    )
