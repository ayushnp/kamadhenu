"""Cow management service."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import Session, or_, select

from app.models.cow import Cow
from app.models.cow_health import CowHealthRecord
from app.models.user import User
from app.models.vaccination import Vaccination
from app.schemas.cow import CowCreate, CowUpdate, CowWithHistory
from app.schemas.cow_health import CowHealthRecordCreate, CowHealthRecordRead
from app.schemas.vaccination import VaccinationCreate, VaccinationRead


# ─── Cow CRUD ─────────────────────────────────────────────────────────────────

def create_cow(payload: CowCreate, farmer: User, session: Session) -> Cow:
    _assert_unique_identifiers(payload.pashu_aadhar, payload.barcode, session)
    cow = Cow(**payload.model_dump(), farmer_id=farmer.id)
    session.add(cow)
    session.commit()
    session.refresh(cow)
    return cow


def get_cow(cow_id: uuid.UUID, session: Session) -> Cow:
    cow = session.get(Cow, cow_id)
    if not cow or not cow.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cow not found")
    return cow


def lookup_cow(
    session: Session,
    barcode: Optional[str] = None,
    pashu_aadhar: Optional[str] = None,
    tag_number: Optional[str] = None,
) -> Cow:
    """Find a cow by barcode, Pashu Aadhar, or ear tag number."""
    if not any([barcode, pashu_aadhar, tag_number]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one of: barcode, pashu_aadhar, tag_number",
        )
    filters = []
    if barcode:
        filters.append(Cow.barcode == barcode)
    if pashu_aadhar:
        filters.append(Cow.pashu_aadhar == pashu_aadhar)
    if tag_number:
        filters.append(Cow.tag_number == tag_number)

    cow = session.exec(select(Cow).where(or_(*filters))).first()
    if not cow or not cow.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cow not found")
    return cow


def list_cows(farmer_id: uuid.UUID, session: Session) -> list[Cow]:
    return list(
        session.exec(
            select(Cow).where(Cow.farmer_id == farmer_id, Cow.is_active == True)  # noqa: E712
        ).all()
    )


def update_cow(cow: Cow, payload: CowUpdate, session: Session) -> Cow:
    data = payload.model_dump(exclude_none=True)
    for field, value in data.items():
        setattr(cow, field, value)
    cow.updated_at = datetime.now(timezone.utc)
    session.add(cow)
    session.commit()
    session.refresh(cow)
    return cow


def get_cow_with_history(cow: Cow, session: Session) -> CowWithHistory:
    health_records = list(
        session.exec(
            select(CowHealthRecord).where(CowHealthRecord.cow_id == cow.id)
        ).all()
    )
    vaccinations = list(
        session.exec(
            select(Vaccination).where(Vaccination.cow_id == cow.id)
        ).all()
    )
    return CowWithHistory(
        **cow.model_dump(),
        health_records=[CowHealthRecordRead.model_validate(r) for r in health_records],
        vaccinations=[VaccinationRead.model_validate(v) for v in vaccinations],
    )


# ─── Health records ───────────────────────────────────────────────────────────

def add_health_record(
    cow: Cow,
    payload: CowHealthRecordCreate,
    recorded_by: uuid.UUID,
    session: Session,
) -> CowHealthRecord:
    record = CowHealthRecord(
        **payload.model_dump(),
        cow_id=cow.id,
        recorded_by=recorded_by,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_health_records(cow_id: uuid.UUID, session: Session) -> list[CowHealthRecord]:
    return list(
        session.exec(
            select(CowHealthRecord).where(CowHealthRecord.cow_id == cow_id)
        ).all()
    )


# ─── Vaccinations ─────────────────────────────────────────────────────────────

def add_vaccination(
    cow: Cow,
    payload: VaccinationCreate,
    recorded_by: uuid.UUID,
    session: Session,
) -> Vaccination:
    vax = Vaccination(
        **payload.model_dump(),
        cow_id=cow.id,
        recorded_by=recorded_by,
    )
    session.add(vax)
    session.commit()
    session.refresh(vax)
    return vax


def list_vaccinations(cow_id: uuid.UUID, session: Session) -> list[Vaccination]:
    return list(
        session.exec(
            select(Vaccination).where(Vaccination.cow_id == cow_id)
        ).all()
    )


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _assert_unique_identifiers(
    pashu_aadhar: Optional[str],
    barcode: Optional[str],
    session: Session,
) -> None:
    if pashu_aadhar:
        existing = session.exec(
            select(Cow).where(Cow.pashu_aadhar == pashu_aadhar)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Pashu Aadhar '{pashu_aadhar}' is already registered.",
            )
    if barcode:
        existing = session.exec(select(Cow).where(Cow.barcode == barcode)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Barcode '{barcode}' is already registered.",
            )
