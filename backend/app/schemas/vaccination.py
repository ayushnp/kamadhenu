import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import SQLModel


class VaccinationCreate(SQLModel):
    vaccine_name: str
    disease_covered: Optional[str] = None
    date_administered: date
    next_due_date: Optional[date] = None
    batch_number: Optional[str] = None
    administered_by: Optional[str] = None
    notes: Optional[str] = None


class VaccinationRead(SQLModel):
    id: uuid.UUID
    cow_id: uuid.UUID
    vaccine_name: str
    disease_covered: Optional[str] = None
    date_administered: date
    next_due_date: Optional[date] = None
    batch_number: Optional[str] = None
    administered_by: Optional[str] = None
    notes: Optional[str] = None
    recorded_by: Optional[uuid.UUID] = None
    created_at: datetime
