"""Mastitis risk engine REST API -- 4 endpoints consumed by the mobile frontend."""

import uuid
from typing import List

from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import CurrentUser, SessionDep
from app.models.cow import Bovine
from app.models.user import UserRole
from app.schemas.risk import FarmRiskSummary, RiskResponse
from app.services.risk_service import (
    _rs_to_response,
    get_farm_risk_summary,
    get_latest_risk,
    get_risk_history,
    save_risk_score,
)
from ml.engine import score_cow

router = APIRouter(prefix="/risk", tags=["AI Risk Engine"])


def _assert_cow_access(cow_id: uuid.UUID, user, session) -> Bovine:
    cow = session.get(Bovine, cow_id)
    if not cow:
        raise HTTPException(status_code=404, detail=f"Cow {cow_id} not found.")
    if user.role == UserRole.farmer and cow.farmer_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied to this cow.")
    return cow


@router.post(
    "/score/{cow_id}",
    response_model=RiskResponse,
    summary="Run mastitis risk assessment for a cow right now",
)
def run_risk_score(
    cow_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUser,
    window_days: int = Query(default=7, ge=3, le=14),
) -> RiskResponse:
    _assert_cow_access(cow_id, user, session)
    try:
        result = score_cow(cow_id, session, window_days=window_days)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    rs = save_risk_score(cow_id, result, session)
    return _rs_to_response(rs)


@router.get(
    "/cows/{cow_id}/latest",
    response_model=RiskResponse,
    summary="Get the most recent risk assessment for a cow",
)
def get_latest_risk_score(
    cow_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUser,
) -> RiskResponse:
    _assert_cow_access(cow_id, user, session)
    rs = get_latest_risk(cow_id, session)
    if not rs:
        raise HTTPException(
            status_code=404,
            detail="No risk score found. POST /risk/score/{cow_id} to generate one.",
        )
    return _rs_to_response(rs)


@router.get(
    "/cows/{cow_id}/history",
    response_model=List[RiskResponse],
    summary="Get risk score trend for a cow (last N days)",
)
def get_cow_risk_history(
    cow_id: uuid.UUID,
    session: SessionDep,
    user: CurrentUser,
    days: int = Query(default=14, ge=1, le=90),
) -> List[RiskResponse]:
    _assert_cow_access(cow_id, user, session)
    records = get_risk_history(cow_id, days, session)
    return [_rs_to_response(r) for r in records]


@router.get(
    "/farm/summary",
    response_model=FarmRiskSummary,
    summary="Get risk distribution across all cows on the farm",
)
def farm_risk_summary(
    session: SessionDep,
    user: CurrentUser,
) -> FarmRiskSummary:
    return get_farm_risk_summary(user, session)
