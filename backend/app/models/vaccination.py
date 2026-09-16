import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Vaccination(SQLModel, table=True):
    """Vaccination record for a cow."""

    __tablename__ = "vaccinations"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )
    cow_id: uuid.UUID = Field(foreign_key="cows.id", index=True)

    vaccine_name: str = Field(max_length=200)
    disease_covered: Optional[str] = Field(default=None, max_length=200)
    date_administered: date
    next_due_date: Optional[date] = Field(default=None)
    batch_number: Optional[str] = Field(default=None, max_length=100)
    administered_by: Optional[str] = Field(default=None, max_length=200)  # vet name
    notes: Optional[str] = Field(default=None, max_length=500)
    recorded_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.id")

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
