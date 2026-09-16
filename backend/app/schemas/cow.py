import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel


# ─── Create ───────────────────────────────────────────────────────────────────

class BovineCreate(SQLModel):
    pashu_aadhar: Optional[str] = None
    barcode: Optional[str] = None
    tag_number: Optional[str] = None
    name: Optional[str] = None
    breed: Optional[str] = None
    species: str = "cattle"  # "cattle" | "buffalo"
    age_years: Optional[float] = None
    calf_number: Optional[int] = None
    lactation_number: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# ─── Read ─────────────────────────────────────────────────────────────────────

class BovineRead(SQLModel):
    id: uuid.UUID
    farmer_id: uuid.UUID
    pashu_aadhar: Optional[str] = None
    barcode: Optional[str] = None
    tag_number: Optional[str] = None
    name: Optional[str] = None
    breed: Optional[str] = None
    species: str
    age_years: Optional[float] = None
    calf_number: Optional[int] = None
    lactation_number: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ─── Update ───────────────────────────────────────────────────────────────────

class BovineUpdate(SQLModel):
    pashu_aadhar: Optional[str] = None
    barcode: Optional[str] = None
    tag_number: Optional[str] = None
    name: Optional[str] = None
    breed: Optional[str] = None
    species: Optional[str] = None  # "cattle" | "buffalo"
    age_years: Optional[float] = None
    calf_number: Optional[int] = None
    lactation_number: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = None


# ─── Nested read (bovine + related records) ───────────────────────────────────

from app.schemas.cow_health import BovineHealthRecordRead  # noqa: E402
from app.schemas.vaccination import VaccinationRead  # noqa: E402


class BovineWithHistory(BovineRead):
    health_records: list[BovineHealthRecordRead] = []
    vaccinations: list[VaccinationRead] = []
