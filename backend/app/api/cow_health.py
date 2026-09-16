"""Bovine animal health record routes."""

import uuid

from fastapi import APIRouter

from app.core.deps import CurrentUser, SessionDep
from app.models.user import UserRole
from app.schemas.cow_health import BovineHealthRecordCreate, BovineHealthRecordRead
from app.services.cow_service import add_health_record, get_bovine, list_health_records

router = APIRouter(prefix="/cows/{cow_id}/health", tags=["Health Records"])


@router.post(
    "/",
    response_model=BovineHealthRecordRead,
    status_code=201,
    summary="Add health/disease record for a bovine animal (farmer or staff)",
)
def add_record(
    cow_id: str,
    payload: BovineHealthRecordCreate,
    current_user: CurrentUser,
    session: SessionDep,
) -> BovineHealthRecordRead:
    bovine = get_bovine(uuid.UUID(cow_id), session)

    # Farmer can only add to their own animal
    if current_user.role == UserRole.farmer and bovine.farmer_id != current_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    record = add_health_record(bovine, payload, current_user.id, session)
    return BovineHealthRecordRead.model_validate(record)


@router.get(
    "/",
    response_model=list[BovineHealthRecordRead],
    summary="List all health records for a bovine animal",
)
def get_records(
    cow_id: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[BovineHealthRecordRead]:
    bovine = get_bovine(uuid.UUID(cow_id), session)

    if current_user.role == UserRole.farmer and bovine.farmer_id != current_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    records = list_health_records(uuid.UUID(cow_id), session)
    return [BovineHealthRecordRead.model_validate(r) for r in records]
