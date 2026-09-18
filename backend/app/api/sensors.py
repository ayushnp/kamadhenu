"""Sensor telemetry routes — collar wearable, milk testing, and barn environment."""

import uuid
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status

from app.core.deps import CurrentUser, SessionDep
from app.models.cow import Bovine
from app.models.user import UserRole
from app.schemas.sensor import (
    CowTelemetrySummary,
    EnvironmentIngest,
    EnvironmentRead,
    MilkIngest,
    MilkRead,
    MilkSessionIngest,
    WearableBatchIngest,
    WearableIngest,
    WearableRead,
)
from app.services.sensor_service import (
    get_cow_milk_history,
    get_cow_telemetry_summary,
    get_cow_wearable_history,
    get_farm_environment_history,
    ingest_environment,
    ingest_milk,
    ingest_milk_session,
    ingest_wearable,
    ingest_wearable_batch,
)

router = APIRouter(prefix="/sensors", tags=["IoT Sensor Telemetry"])


def _assert_cow_access(cow_id: uuid.UUID, user, session) -> Bovine:
    """Verify that the cow exists and that the user has permission to view its telemetry."""
    cow = session.get(Bovine, cow_id)
    if not cow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bovine with id '{cow_id}' not found.",
        )
    # Farmers can only inspect their own animals; Staff / Authorities have broad access
    if user.role == UserRole.farmer and cow.farmer_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view sensor telemetry for this animal.",
        )
    return cow


# ─── Background risk scoring helper ──────────────────────────────────────────

def _bg_score_cow(cow_id: uuid.UUID) -> None:
    """Fire-and-forget: score cow and persist in isolated session. Never raises."""
    try:
        from app.database import engine
        from sqlmodel import Session
        from ml.engine import score_cow
        from app.services.risk_service import save_risk_score

        with Session(engine) as session:
            result = score_cow(cow_id, session, window_days=7)
            save_risk_score(cow_id, result, session)
    except Exception:
        pass


# ─── Ingest Endpoints (Collar / Milk Analyzer / Barn Node) ─────────────────────

@router.post(
    "/wearable",
    response_model=WearableRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest single wearable collar reading",
)
def record_wearable(
    payload: WearableIngest,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    user: CurrentUser,
) -> WearableRead:
    reading = ingest_wearable(payload, session)
    # Auto-score in background so risk is always fresh after new data
    background_tasks.add_task(_bg_score_cow, payload.cow_id)
    return WearableRead.model_validate(reading)


@router.post(
    "/wearable/batch",
    response_model=List[WearableRead],
    status_code=status.HTTP_201_CREATED,
    summary="Ingest batch of wearable readings (offline sync)",
)
def record_wearable_batch(
    payload: WearableBatchIngest,
    session: SessionDep,
    user: CurrentUser,
) -> List[WearableRead]:
    readings = ingest_wearable_batch(payload, session)
    return [WearableRead.model_validate(r) for r in readings]


@router.post(
    "/milk",
    response_model=MilkRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest single milk quarter reading (EC, pH, CMT, etc.)",
)
def record_milk(
    payload: MilkIngest,
    session: SessionDep,
    user: CurrentUser,
) -> MilkRead:
    reading = ingest_milk(payload, session)
    return MilkRead.model_validate(reading)


@router.post(
    "/milk/session",
    response_model=List[MilkRead],
    status_code=status.HTTP_201_CREATED,
    summary="Ingest 4-quarter milking session (FL, FR, RL, RR)",
)
def record_milk_session(
    payload: MilkSessionIngest,
    background_tasks: BackgroundTasks,
    session: SessionDep,
    user: CurrentUser,
) -> List[MilkRead]:
    readings = ingest_milk_session(payload, session)
    # Auto-score in background — milk session is the richest data point
    if readings:
        background_tasks.add_task(_bg_score_cow, readings[0].cow_id)
    return [MilkRead.model_validate(r) for r in readings]


@router.post(
    "/environment",
    response_model=EnvironmentRead,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest barn environmental telemetry",
)
def record_environment(
    payload: EnvironmentIngest,
    session: SessionDep,
    user: CurrentUser,
) -> EnvironmentRead:
    reading = ingest_environment(payload, session)
    return EnvironmentRead.model_validate(reading)


# ─── Query & History Endpoints ────────────────────────────────────────────────

@router.get(
    "/cows/{cow_id}/wearable",
    response_model=List[WearableRead],
    summary="Get 7–14 day wearable telemetry history for a cow",
)
def cow_wearable_history(
    cow_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUser,
    days: int = Query(default=14, ge=1, le=90),
) -> List[WearableRead]:
    _assert_cow_access(cow_id, user, session)
    records = get_cow_wearable_history(cow_id, days, session)
    return [WearableRead.model_validate(r) for r in records]


@router.get(
    "/cows/{cow_id}/milk",
    response_model=List[MilkRead],
    summary="Get 7–14 day milk testing history for a cow",
)
def cow_milk_history(
    cow_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUser,
    days: int = Query(default=14, ge=1, le=90),
) -> List[MilkRead]:
    _assert_cow_access(cow_id, user, session)
    records = get_cow_milk_history(cow_id, days, session)
    return [MilkRead.model_validate(r) for r in records]


@router.get(
    "/cows/{cow_id}/summary",
    response_model=CowTelemetrySummary,
    summary="Consolidated wearable + milk time-series for cow dashboard & graphs",
)
def cow_telemetry_summary(
    cow_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUser,
    days: int = Query(default=14, ge=1, le=90),
) -> CowTelemetrySummary:
    _assert_cow_access(cow_id, user, session)
    return get_cow_telemetry_summary(cow_id, days, session)


@router.get(
    "/farm/environment",
    response_model=List[EnvironmentRead],
    summary="Get barn environmental condition history",
)
def farm_environment_history(
    session: SessionDep,
    user: CurrentUser,
    days: int = Query(default=7, ge=1, le=60),
    farmer_id: Optional[uuid.UUID] = Query(default=None),
) -> List[EnvironmentRead]:
    target_farmer_id = user.id
    if user.role != UserRole.farmer and farmer_id:
        target_farmer_id = farmer_id

    records = get_farm_environment_history(target_farmer_id, days, session)
    return [EnvironmentRead.model_validate(r) for r in records]
