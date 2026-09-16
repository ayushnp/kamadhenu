"""Bovine animal management service (cattle and buffalo)."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import Session, or_, select

from app.models.cow import Bovine
from app.models.cow_health import BovineHealthRecord
from app.models.user import User
from app.models.vaccination import Vaccination
from app.schemas.cow import BovineCreate, BovineUpdate, BovineWithHistory
from app.schemas.cow_health import BovineHealthRecordCreate, BovineHealthRecordRead
from app.schemas.vaccination import VaccinationCreate, VaccinationRead


# ─── Bovine CRUD ──────────────────────────────────────────────────────────────

def create_bovine(payload: BovineCreate, farmer: User, session: Session) -> Bovine:
    _assert_unique_identifiers(payload.pashu_aadhar, payload.barcode, session)
    bovine = Bovine(**payload.model_dump(), farmer_id=farmer.id)
    session.add(bovine)
    session.commit()
    session.refresh(bovine)
    return bovine


def get_bovine(bovine_id: uuid.UUID, session: Session) -> Bovine:
    bovine = session.get(Bovine, bovine_id)
    if not bovine or not bovine.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bovine animal not found")
    return bovine


def lookup_bovine(
    session: Session,
    barcode: Optional[str] = None,
    pashu_aadhar: Optional[str] = None,
    tag_number: Optional[str] = None,
) -> Bovine:
    """Find a bovine animal by barcode, Pashu Aadhar, or ear tag number."""
    if not any([barcode, pashu_aadhar, tag_number]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one of: barcode, pashu_aadhar, tag_number",
        )
    filters = []
    if barcode:
        filters.append(Bovine.barcode == barcode)
    if pashu_aadhar:
        filters.append(Bovine.pashu_aadhar == pashu_aadhar)
    if tag_number:
        filters.append(Bovine.tag_number == tag_number)

    bovine = session.exec(select(Bovine).where(or_(*filters))).first()
    if not bovine or not bovine.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bovine animal not found")
    return bovine


def list_bovines(farmer_id: uuid.UUID, session: Session) -> list[Bovine]:
    return list(
        session.exec(
            select(Bovine).where(Bovine.farmer_id == farmer_id, Bovine.is_active == True)  # noqa: E712
        ).all()
    )


def update_bovine(bovine: Bovine, payload: BovineUpdate, session: Session) -> Bovine:
    data = payload.model_dump(exclude_none=True)
    for field, value in data.items():
        setattr(bovine, field, value)
    bovine.updated_at = datetime.now(timezone.utc)
    session.add(bovine)
    session.commit()
    session.refresh(bovine)
    return bovine


def get_bovine_with_history(bovine: Bovine, session: Session) -> BovineWithHistory:
    health_records = list(
        session.exec(
            select(BovineHealthRecord).where(BovineHealthRecord.cow_id == bovine.id)
        ).all()
    )
    vaccinations = list(
        session.exec(
            select(Vaccination).where(Vaccination.cow_id == bovine.id)
        ).all()
    )
    return BovineWithHistory(
        **bovine.model_dump(),
        health_records=[BovineHealthRecordRead.model_validate(r) for r in health_records],
        vaccinations=[VaccinationRead.model_validate(v) for v in vaccinations],
    )


# ─── Health records ───────────────────────────────────────────────────────────

def add_health_record(
    bovine: Bovine,
    payload: BovineHealthRecordCreate,
    recorded_by: uuid.UUID,
    session: Session,
) -> BovineHealthRecord:
    record = BovineHealthRecord(
        **payload.model_dump(),
        cow_id=bovine.id,
        recorded_by=recorded_by,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def list_health_records(bovine_id: uuid.UUID, session: Session) -> list[BovineHealthRecord]:
    return list(
        session.exec(
            select(BovineHealthRecord).where(BovineHealthRecord.cow_id == bovine_id)
        ).all()
    )


# ─── Vaccinations ─────────────────────────────────────────────────────────────

def add_vaccination(
    bovine: Bovine,
    payload: VaccinationCreate,
    recorded_by: uuid.UUID,
    session: Session,
) -> Vaccination:
    vax = Vaccination(
        **payload.model_dump(),
        cow_id=bovine.id,
        recorded_by=recorded_by,
    )
    session.add(vax)
    session.commit()
    session.refresh(vax)
    return vax


def list_vaccinations(bovine_id: uuid.UUID, session: Session) -> list[Vaccination]:
    return list(
        session.exec(
            select(Vaccination).where(Vaccination.cow_id == bovine_id)
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
            select(Bovine).where(Bovine.pashu_aadhar == pashu_aadhar)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Pashu Aadhar '{pashu_aadhar}' is already registered.",
            )
    if barcode:
        existing = session.exec(select(Bovine).where(Bovine.barcode == barcode)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Barcode '{barcode}' is already registered.",
            )
