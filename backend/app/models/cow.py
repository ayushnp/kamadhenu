import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Cow(SQLModel, table=True):
    """Cattle profile — links to a farmer (User) and carries Pashu Aadhar / barcode."""

    __tablename__ = "cows"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )

    # ─── Identity ─────────────────────────────────────────────────────────────
    # Pashu Aadhar is a 12-digit government UID issued under INAPH/NDP scheme.
    # barcode is a farm-level QR/barcode that may differ from Pashu Aadhar.
    pashu_aadhar: Optional[str] = Field(
        default=None, max_length=20, unique=True, index=True
    )
    barcode: Optional[str] = Field(
        default=None, max_length=100, unique=True, index=True
    )
    tag_number: Optional[str] = Field(default=None, max_length=50)  # ear tag

    # ─── Ownership ────────────────────────────────────────────────────────────
    farmer_id: uuid.UUID = Field(foreign_key="users.id", index=True)

    # ─── Biological info ──────────────────────────────────────────────────────
    name: Optional[str] = Field(default=None, max_length=100)
    breed: Optional[str] = Field(default=None, max_length=100)  # e.g. HF, Jersey, Sahiwal
    species: str = Field(default="cattle", max_length=20)  # cattle | buffalo
    age_years: Optional[float] = Field(default=None, ge=0)
    calf_number: Optional[int] = Field(default=None, ge=0)    # parity / number of calves
    lactation_number: Optional[int] = Field(default=None, ge=0)

    # ─── Location (GPS) ───────────────────────────────────────────────────────
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)

    # ─── Metadata ─────────────────────────────────────────────────────────────
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
