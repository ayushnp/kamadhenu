"""Vaccination record routes for bovine animals."""

import uuid

from fastapi import APIRouter

from app.core.deps import CurrentUser, SessionDep
from app.models.user import UserRole
from app.schemas.vaccination import VaccinationCreate, VaccinationRead
from app.services.cow_service import add_vaccination, get_bovine, list_vaccinations

router = APIRouter(prefix="/cows/{cow_id}/vaccinations", tags=["Vaccinations"])


@router.post(
    "/",
    response_model=VaccinationRead,
    status_code=201,
    summary="Add vaccination record for a bovine animal",
)
def add_vax(
    cow_id: str,
    payload: VaccinationCreate,
    current_user: CurrentUser,
    session: SessionDep,
) -> VaccinationRead:
    bovine = get_bovine(uuid.UUID(cow_id), session)

    if current_user.role == UserRole.farmer and bovine.farmer_id != current_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    vax = add_vaccination(bovine, payload, current_user.id, session)
    return VaccinationRead.model_validate(vax)


@router.get(
    "/",
    response_model=list[VaccinationRead],
    summary="List all vaccination records for a bovine animal",
)
def get_vax(
    cow_id: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> list[VaccinationRead]:
    bovine = get_bovine(uuid.UUID(cow_id), session)

    if current_user.role == UserRole.farmer and bovine.farmer_id != current_user.id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    vaxes = list_vaccinations(uuid.UUID(cow_id), session)
    return [VaccinationRead.model_validate(v) for v in vaxes]
