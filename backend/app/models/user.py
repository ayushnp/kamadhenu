import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Column, Field, SQLModel, String


class UserRole(str, Enum):
    """Application roles — controls permissions throughout the API."""

    farmer = "farmer"
    inspector = "inspector"
    doctor = "doctor"
    authority = "authority"


class User(SQLModel, table=True):
    """System user (farmer, inspector, veterinary doctor, or authority official)."""

    __tablename__ = "users"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )
    name: str = Field(max_length=200)
    phone: Optional[str] = Field(default=None, max_length=20, unique=True, index=True)
    email: Optional[str] = Field(default=None, max_length=255, unique=True, index=True)
    hashed_password: str
    role: UserRole = Field(
        default=UserRole.farmer,
        sa_column=Column(String, nullable=False),
    )

    # ─── Profile extras ──────────────────────────────────────────────────────
    photo_url: Optional[str] = Field(default=None, max_length=500)
    place: Optional[str] = Field(default=None, max_length=300)
    number_of_animals: Optional[int] = Field(default=None, ge=0)

    # ─── Inspector / Doctor / Authority specific ──────────────────────────────
    employee_id: Optional[str] = Field(default=None, max_length=100, unique=True)
    department: Optional[str] = Field(default=None, max_length=200)
    jurisdiction: Optional[str] = Field(default=None, max_length=300)  # area/district

    # ─── Location (base GPS for staff — used for nearest-doctor assignment) ──────
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)

    # ─── Metadata ─────────────────────────────────────────────────────────────
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
