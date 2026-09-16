"""Bovine animal profile routes (cattle and buffalo)."""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import CurrentUser, SessionDep, require_role
from app.models.user import User, UserRole
from app.schemas.cow import BovineCreate, BovineRead, BovineUpdate, BovineWithHistory
from app.services.cow_service import (
    create_bovine,
    get_bovine,
    get_bovine_with_history,
    list_bovines,
    lookup_bovine,
    update_bovine,
)

router = APIRouter(prefix="/cows", tags=["Bovine Animals"])

FarmerOnly = Annotated[User, Depends(require_role(UserRole.farmer))]
StaffOrAbove = Annotated[
    User,
    Depends(require_role(UserRole.inspector, UserRole.doctor, UserRole.authority)),
]


@router.post(
    "/",
    response_model=BovineRead,
    status_code=201,
    summary="[Farmer] Register a bovine animal (cattle or buffalo)",
)
def add_bovine(payload: BovineCreate, farmer: FarmerOnly, session: SessionDep) -> BovineRead:
    bovine = create_bovine(payload, farmer, session)
    return BovineRead.model_validate(bovine)


@router.get(
    "/",
    response_model=list[BovineRead],
    summary="[Farmer] List own herd",
)
def my_herd(current_user: CurrentUser, session: SessionDep) -> list[BovineRead]:
    # Farmers see own herd; staff can supply farmer_id via /lookup or /farmer/{id} routes
    if current_user.role != UserRole.farmer:
        return []
    bovines = list_bovines(current_user.id, session)
    return [BovineRead.model_validate(b) for b in bovines]


@router.get(
    "/lookup",
    response_model=BovineWithHistory,
    summary="Lookup bovine animal by barcode / Pashu Aadhar / tag (all authenticated roles)",
)
def lookup(
    current_user: CurrentUser,
    session: SessionDep,
    barcode: Optional[str] = Query(default=None),
    pashu_aadhar: Optional[str] = Query(default=None),
    tag_number: Optional[str] = Query(default=None),
) -> BovineWithHistory:
    bovine = lookup_bovine(session, barcode=barcode, pashu_aadhar=pashu_aadhar, tag_number=tag_number)
    return get_bovine_with_history(bovine, session)


@router.get(
    "/farmer/{farmer_id}",
    response_model=list[BovineRead],
    summary="[Staff+] List bovine animals for a given farmer",
)
def herd_by_farmer(
    farmer_id: uuid.UUID,
    _caller: StaffOrAbove,
    session: SessionDep,
) -> list[BovineRead]:
    bovines = list_bovines(farmer_id, session)
    return [BovineRead.model_validate(b) for b in bovines]


@router.get(
    "/{cow_id}",
    response_model=BovineWithHistory,
    summary="Get bovine animal profile with full history",
)
def get_bovine_detail(
    cow_id: uuid.UUID,
    current_user: CurrentUser,
    session: SessionDep,
) -> BovineWithHistory:
    bovine = get_bovine(cow_id, session)

    # Farmers can only view their own animals
    if str(current_user.role) == UserRole.farmer and str(bovine.farmer_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return get_bovine_with_history(bovine, session)


@router.patch(
    "/{cow_id}",
    response_model=BovineRead,
    summary="[Farmer] Update bovine animal profile",
)
def patch_bovine(
    cow_id: uuid.UUID,
    payload: BovineUpdate,
    farmer: FarmerOnly,
    session: SessionDep,
) -> BovineRead:
    bovine = get_bovine(cow_id, session)
    if bovine.farmer_id != farmer.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your animal")
    bovine = update_bovine(bovine, payload, session)
    return BovineRead.model_validate(bovine)
