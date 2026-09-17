"""Complaint routes — farmer raises complaints, staff manages lifecycle."""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query

from app.core.deps import CurrentUser, SessionDep, require_role
from app.models.complaint import ComplaintStatus
from app.models.user import User, UserRole
from app.schemas.complaint import (
    ComplaintCreate,
    ComplaintRead,
    ComplaintReassign,
    ComplaintStatusUpdate,
)
from app.services.complaint_service import (
    get_complaint,
    list_complaints,
    raise_complaint,
    reassign_complaint,
    update_complaint_status,
)

router = APIRouter(prefix="/complaints", tags=["Complaints"])

FarmerOnly = Annotated[User, Depends(require_role(UserRole.farmer))]
DoctorOrInspector = Annotated[
    User,
    Depends(require_role(UserRole.doctor, UserRole.inspector)),
]
AuthorityOnly = Annotated[User, Depends(require_role(UserRole.authority))]


@router.post(
    "/",
    response_model=ComplaintRead,
    status_code=201,
    summary="[Farmer] Raise a complaint for a bovine animal",
)
def create_complaint(
    payload: ComplaintCreate,
    farmer: FarmerOnly,
    session: SessionDep,
) -> ComplaintRead:
    """Farmer raises a health complaint for one of their animals.

    The system automatically assigns the complaint to the nearest active
    Doctor or Inspector using the Haversine formula.
    If no eligible staff member is found, the complaint is created with
    status ``open`` and ``assigned_to=null``.
    """
    complaint = raise_complaint(payload, farmer, session)
    return ComplaintRead.model_validate(complaint)


@router.get(
    "/",
    response_model=list[ComplaintRead],
    summary="List complaints (role-filtered)",
)
def get_complaints(
    current_user: CurrentUser,
    session: SessionDep,
    filter_status: Optional[ComplaintStatus] = Query(default=None, alias="status"),
    assigned_to: Optional[uuid.UUID] = Query(default=None),
) -> list[ComplaintRead]:
    """Return complaints filtered by role:

    - **Farmer**: only their own complaints
    - **Doctor / Inspector**: complaints assigned to them
    - **Authority**: all complaints (optionally filtered by status or assigned_to)
    """
    complaints = list_complaints(
        current_user, session, filter_status=filter_status, assigned_to=assigned_to
    )
    return [ComplaintRead.model_validate(c) for c in complaints]


@router.get(
    "/{complaint_id}",
    response_model=ComplaintRead,
    summary="Get a single complaint",
)
def get_single_complaint(
    complaint_id: uuid.UUID,
    current_user: CurrentUser,
    session: SessionDep,
) -> ComplaintRead:
    """Any authenticated user can fetch a complaint by ID.

    Farmers are restricted to their own complaints.
    """
    from fastapi import HTTPException, status as http_status

    complaint = get_complaint(complaint_id, session)

    # Farmers can only see their own
    if str(current_user.role) == UserRole.farmer and complaint.farmer_id != current_user.id:
        raise HTTPException(
            status_code=http_status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )
    return ComplaintRead.model_validate(complaint)


@router.patch(
    "/{complaint_id}/assign",
    response_model=ComplaintRead,
    summary="[Authority] Manually reassign a complaint to a Doctor or Inspector",
)
def assign_complaint(
    complaint_id: uuid.UUID,
    payload: ComplaintReassign,
    _authority: AuthorityOnly,
    session: SessionDep,
) -> ComplaintRead:
    complaint = get_complaint(complaint_id, session)
    complaint = reassign_complaint(complaint, payload, session)
    return ComplaintRead.model_validate(complaint)


@router.patch(
    "/{complaint_id}/status",
    response_model=ComplaintRead,
    summary="[Doctor / Inspector] Update complaint status (strict FSM)",
)
def update_status(
    complaint_id: uuid.UUID,
    payload: ComplaintStatusUpdate,
    current_user: CurrentUser,
    session: SessionDep,
) -> ComplaintRead:
    """Move a complaint through the status FSM.

    Valid transitions::

        open → assigned → in_progress → resolved → closed

    ``resolved_notes`` is required when transitioning to ``resolved``.
    """
    complaint = get_complaint(complaint_id, session)
    complaint = update_complaint_status(complaint, payload, current_user, session)
    return ComplaintRead.model_validate(complaint)
