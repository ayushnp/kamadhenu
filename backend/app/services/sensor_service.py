"""Sensor service — handles hardware telemetry ingestion and time-series retrieval."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.cow import Bovine
from app.models.sensor import EnvironmentReading, MilkReading, WearableReading
from app.models.user import User
from app.schemas.sensor import (
    CowTelemetrySummary,
    EnvironmentIngest,
    MilkIngest,
    MilkRead,
    MilkSessionIngest,
    WearableBatchIngest,
    WearableIngest,
    WearableRead,
)


def _resolve_cow(
    session: Session,
    cow_id: Optional[uuid.UUID] = None,
    pashu_aadhar: Optional[str] = None,
) -> Bovine:
    """Find Bovine by cow_id or pashu_aadhar."""
    if cow_id:
        cow = session.get(Bovine, cow_id)
        if not cow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bovine with id '{cow_id}' not found.",
            )
        return cow

    if pashu_aadhar:
        statement = select(Bovine).where(Bovine.pashu_aadhar == pashu_aadhar)
        cow = session.exec(statement).first()
        if not cow:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bovine with Pashu Aadhaar '{pashu_aadhar}' not found.",
            )
        return cow

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Either 'cow_id' or 'pashu_aadhar' must be specified.",
    )


def _resolve_farmer(
    session: Session,
    farmer_id: Optional[uuid.UUID] = None,
    farmer_phone: Optional[str] = None,
) -> User:
    """Find Farmer user by ID or phone number."""
    if farmer_id:
        user = session.get(User, farmer_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Farmer with id '{farmer_id}' not found.",
            )
        return user

    if farmer_phone:
        statement = select(User).where(User.phone == farmer_phone)
        user = session.exec(statement).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Farmer with phone '{farmer_phone}' not found.",
            )
        return user

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Either 'farmer_id' or 'farmer_phone' must be specified.",
    )


# ─── Ingestion ────────────────────────────────────────────────────────────────

def ingest_wearable(payload: WearableIngest, session: Session) -> WearableReading:
    """Store a single collar telemetry reading."""
    cow = _resolve_cow(session, cow_id=payload.cow_id, pashu_aadhar=payload.pashu_aadhar)
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)

    reading = WearableReading(
        cow_id=cow.id,
        recorded_at=recorded_at,
        activity_index=payload.activity_index,
        rumination_minutes=payload.rumination_minutes,
        body_temperature=payload.body_temperature,
        lying_time_minutes=payload.lying_time_minutes,
        latitude=payload.latitude if payload.latitude is not None else cow.latitude,
        longitude=payload.longitude if payload.longitude is not None else cow.longitude,
    )
    session.add(reading)
    session.commit()
    session.refresh(reading)
    return reading


def ingest_wearable_batch(
    payload: WearableBatchIngest, session: Session
) -> List[WearableReading]:
    """Store multiple collar readings uploaded in a batch."""
    created: List[WearableReading] = []
    # Cache resolved cows to minimize queries
    cow_cache: dict[str, Bovine] = {}

    for item in payload.readings:
        key = str(item.cow_id or item.pashu_aadhar)
        if key not in cow_cache:
            cow_cache[key] = _resolve_cow(
                session, cow_id=item.cow_id, pashu_aadhar=item.pashu_aadhar
            )
        cow = cow_cache[key]
        recorded_at = item.recorded_at or datetime.now(timezone.utc)

        reading = WearableReading(
            cow_id=cow.id,
            recorded_at=recorded_at,
            activity_index=item.activity_index,
            rumination_minutes=item.rumination_minutes,
            body_temperature=item.body_temperature,
            lying_time_minutes=item.lying_time_minutes,
            latitude=item.latitude if item.latitude is not None else cow.latitude,
            longitude=item.longitude if item.longitude is not None else cow.longitude,
        )
        session.add(reading)
        created.append(reading)

    session.commit()
    for r in created:
        session.refresh(r)
    return created


def ingest_milk(payload: MilkIngest, session: Session) -> MilkReading:
    """Store a single milk quarter reading."""
    cow = _resolve_cow(session, cow_id=payload.cow_id, pashu_aadhar=payload.pashu_aadhar)
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)

    reading = MilkReading(
        cow_id=cow.id,
        quarter=payload.quarter,
        recorded_at=recorded_at,
        electrical_conductivity=payload.electrical_conductivity,
        ph=payload.ph,
        turbidity=payload.turbidity,
        milk_temperature=payload.milk_temperature,
        cmt_result=payload.cmt_result,
        scc=payload.scc,
    )
    session.add(reading)
    session.commit()
    session.refresh(reading)
    return reading


def ingest_milk_session(
    payload: MilkSessionIngest, session: Session
) -> List[MilkReading]:
    """Store all quarter tests from a single milking session."""
    cow = _resolve_cow(session, cow_id=payload.cow_id, pashu_aadhar=payload.pashu_aadhar)
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)

    created: List[MilkReading] = []
    for item in payload.quarters:
        reading = MilkReading(
            cow_id=cow.id,
            quarter=item.quarter,
            recorded_at=recorded_at,
            electrical_conductivity=item.electrical_conductivity,
            ph=item.ph,
            turbidity=item.turbidity,
            milk_temperature=item.milk_temperature,
            cmt_result=item.cmt_result,
            scc=item.scc,
        )
        session.add(reading)
        created.append(reading)

    session.commit()
    for r in created:
        session.refresh(r)
    return created


def ingest_environment(
    payload: EnvironmentIngest, session: Session
) -> EnvironmentReading:
    """Store a barn environmental telemetry reading."""
    farmer = _resolve_farmer(
        session, farmer_id=payload.farmer_id, farmer_phone=payload.farmer_phone
    )
    recorded_at = payload.recorded_at or datetime.now(timezone.utc)

    reading = EnvironmentReading(
        farmer_id=farmer.id,
        recorded_at=recorded_at,
        ambient_temperature=payload.ambient_temperature,
        humidity=payload.humidity,
        bedding_moisture=payload.bedding_moisture,
        ammonia_ppm=payload.ammonia_ppm,
        hygiene_score=payload.hygiene_score,
    )
    session.add(reading)
    session.commit()
    session.refresh(reading)

    try:
        from app.services.notification_service import check_and_trigger_environment_alert
        check_and_trigger_environment_alert(reading, session)
    except Exception:
        pass

    return reading


# ─── Query / History ──────────────────────────────────────────────────────────

def get_cow_wearable_history(
    cow_id: uuid.UUID,
    days: int,
    session: Session,
) -> List[WearableReading]:
    """Return chronological wearable telemetry for the specified cow."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    statement = (
        select(WearableReading)
        .where(WearableReading.cow_id == cow_id)
        .where(WearableReading.recorded_at >= since)
        .order_by(WearableReading.recorded_at.asc())
    )
    return list(session.exec(statement).all())


def get_cow_milk_history(
    cow_id: uuid.UUID,
    days: int,
    session: Session,
) -> List[MilkReading]:
    """Return chronological milk test results for the specified cow."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    statement = (
        select(MilkReading)
        .where(MilkReading.cow_id == cow_id)
        .where(MilkReading.recorded_at >= since)
        .order_by(MilkReading.recorded_at.asc())
    )
    return list(session.exec(statement).all())


def get_farm_environment_history(
    farmer_id: uuid.UUID,
    days: int,
    session: Session,
) -> List[EnvironmentReading]:
    """Return chronological environmental telemetry for the farmer's barn (newest first)."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    statement = (
        select(EnvironmentReading)
        .where(EnvironmentReading.farmer_id == farmer_id)
        .where(EnvironmentReading.recorded_at >= since)
        .order_by(EnvironmentReading.recorded_at.desc())
    )
    return list(session.exec(statement).all())


def get_cow_telemetry_summary(
    cow_id: uuid.UUID,
    days: int,
    session: Session,
) -> CowTelemetrySummary:
    """Consolidate wearable + milk history into a single payload for charts."""
    cow = session.get(Bovine, cow_id)
    if not cow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bovine with id '{cow_id}' not found.",
        )

    wearable_records = get_cow_wearable_history(cow_id, days, session)
    milk_records = get_cow_milk_history(cow_id, days, session)

    return CowTelemetrySummary(
        cow_id=cow.id,
        pashu_aadhar=cow.pashu_aadhar,
        cow_name=cow.name,
        days_requested=days,
        wearable_records_count=len(wearable_records),
        milk_records_count=len(milk_records),
        wearable=[WearableRead.model_validate(w) for w in wearable_records],
        milk=[MilkRead.model_validate(m) for m in milk_records],
    )
