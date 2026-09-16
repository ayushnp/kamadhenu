import uuid
from datetime import date, datetime
from typing import Optional

from sqlmodel import SQLModel


class BovineHealthRecordCreate(SQLModel):
    disease_name: str
    diagnosed_date: Optional[date] = None
    resolved_date: Optional[date] = None
    treatment: Optional[str] = None
    notes: Optional[str] = None
    is_comorbidity: bool = False


class BovineHealthRecordRead(SQLModel):
    id: uuid.UUID
    cow_id: uuid.UUID
    disease_name: str
    diagnosed_date: Optional[date] = None
    resolved_date: Optional[date] = None
    treatment: Optional[str] = None
    notes: Optional[str] = None
    is_comorbidity: bool
    recorded_by: Optional[uuid.UUID] = None
    created_at: datetime
