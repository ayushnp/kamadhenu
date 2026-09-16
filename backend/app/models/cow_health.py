import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class BovineHealthRecord(SQLModel, table=True):
    """Historical disease / health event record for a bovine animal (cattle or buffalo)."""

    __tablename__ = "cow_health_records"  # kept for DB backward compatibility

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )
    cow_id: uuid.UUID = Field(foreign_key="cows.id", index=True)

    disease_name: str = Field(max_length=200)
    diagnosed_date: Optional[date] = Field(default=None)
    resolved_date: Optional[date] = Field(default=None)
    treatment: Optional[str] = Field(default=None, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=1000)
    is_comorbidity: bool = Field(default=False)  # flag chronic/co-existing conditions
    recorded_by: Optional[uuid.UUID] = Field(
        default=None, foreign_key="users.id"
    )  # doctor/inspector who logged it

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

