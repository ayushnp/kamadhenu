"""Cow profile routes."""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import CurrentUser, SessionDep, require_role
from app.models.user import User, UserRole
from app.schemas.cow import CowCreate, CowRead, CowUpdate, CowWithHistory
from app.services.cow_service import (
    create_cow,
    get_cow,
    get_cow_with_history,
    list_cows,
    lookup_cow,
    update_cow,
)

router = APIRouter(prefix="/cows", tags=["Cows"])

FarmerOnly = Annotated[User, Depends(require_role(UserRole.farmer))]
StaffOrAbove = Annotated[
    User,
    Depends(require_role(UserRole.inspector, UserRole.doctor, UserRole.authority)),
]


@router.post(
    "/",
    response_model=CowRead,
    status_code=201,
    summary="[Farmer] Register a cow",
)
def add_cow(payload: CowCreate, farmer: FarmerOnly, session: SessionDep) -> CowRead:
    cow = create_cow(payload, farmer, session)
    return CowRead.model_validate(cow)


@router.get(
    "/",
    response_model=list[CowRead],
    summary="[Farmer] List own herd",
)
def my_herd(current_user: CurrentUser, session: SessionDep) -> list[CowRead]:
    # Farmers see own herd; staff can supply farmer_id via /lookup or /farmer/{id} routes
    if current_user.role != UserRole.farmer:
        return []
    cows = list_cows(current_user.id, session)
    return [CowRead.model_validate(c) for c in cows]


@router.get(
    "/lookup",
    response_model=CowWithHistory,
    summary="Lookup cow by barcode / Pashu Aadhar / tag (all authenticated roles)",
)
def lookup(
    current_user: CurrentUser,
    session: SessionDep,
    barcode: Optional[str] = Query(default=None),
    pashu_aadhar: Optional[str] = Query(default=None),
    tag_number: Optional[str] = Query(default=None),
) -> CowWithHistory:
    cow = lookup_cow(session, barcode=barcode, pashu_aadhar=pashu_aadhar, tag_number=tag_number)
    return get_cow_with_history(cow, session)


@router.get(
    "/farmer/{farmer_id}",
    response_model=list[CowRead],
    summary="[Staff+] List cows for a given farmer",
)
def herd_by_farmer(
    farmer_id: str,
    _caller: StaffOrAbove,
    session: SessionDep,
) -> list[CowRead]:
    cows = list_cows(uuid.UUID(farmer_id), session)
    return [CowRead.model_validate(c) for c in cows]


@router.get(
    "/{cow_id}",
    response_model=CowWithHistory,
    summary="Get cow profile with full history",
)
def get_cow_detail(
    cow_id: str,
    current_user: CurrentUser,
    session: SessionDep,
) -> CowWithHistory:
    cow = get_cow(uuid.UUID(cow_id), session)

    # Farmers can only view their own cows
    if str(current_user.role) == UserRole.farmer and str(cow.farmer_id) != str(current_user.id):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return get_cow_with_history(cow, session)


@router.patch(
    "/{cow_id}",
    response_model=CowRead,
    summary="[Farmer] Update cow profile",
)
def patch_cow(
    cow_id: str,
    payload: CowUpdate,
    farmer: FarmerOnly,
    session: SessionDep,
) -> CowRead:
    cow = get_cow(uuid.UUID(cow_id), session)
    if cow.farmer_id != farmer.id:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your cow")
    cow = update_cow(cow, payload, session)
    return CowRead.model_validate(cow)
