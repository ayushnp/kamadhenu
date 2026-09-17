"""Complaint service — GPS-based auto-assignment and strict FSM transitions."""

import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlmodel import Session, func, select

from app.models.complaint import ALLOWED_TRANSITIONS, Complaint, ComplaintStatus
from app.models.cow import Bovine
from app.models.user import User, UserRole
from app.schemas.complaint import ComplaintCreate, ComplaintReassign, ComplaintStatusUpdate


# ─── Public service functions ─────────────────────────────────────────────────

def raise_complaint(payload: ComplaintCreate, farmer: User, session: Session) -> Complaint:
    """Farmer raises a complaint for one of their bovine animals.

    Steps:
    1. Verify the bovine belongs to this farmer.
    2. Assert the animal has GPS coordinates (400 if not).
    3. Auto-assign to the geographically nearest active Doctor or Inspector.
    4. Persist and return.
    """
    # 1 — ownership check
    bovine = session.get(Bovine, payload.bovine_id)
    if not bovine or not bovine.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bovine animal not found")
    if bovine.farmer_id != farmer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only raise complaints for your own animals",
        )

    # 2 — GPS guard
    if bovine.latitude is None or bovine.longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Animal must have GPS coordinates set before raising a complaint. "
                   "Update the animal's latitude/longitude first.",
        )

    # 3 — find nearest staff (Doctor or Inspector)
    nearest = _find_nearest_staff(bovine.latitude, bovine.longitude, session)

    complaint = Complaint(
        farmer_id=farmer.id,
        bovine_id=payload.bovine_id,
        description=payload.description,
        priority=payload.priority,
        symptoms=payload.symptoms,
        animal_lat=bovine.latitude,
        animal_lng=bovine.longitude,
        assigned_to=nearest.id if nearest else None,
        status=ComplaintStatus.assigned if nearest else ComplaintStatus.open,
        complaint_number=_next_complaint_number(session),
    )
    session.add(complaint)
    session.commit()
    session.refresh(complaint)
    return complaint


def get_complaint(complaint_id: uuid.UUID, session: Session) -> Complaint:
    """Fetch a complaint by UUID — raises 404 if not found."""
    complaint = session.get(Complaint, complaint_id)
    if not complaint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found")
    return complaint


def get_complaint_by_number(complaint_number: int, session: Session) -> Complaint:
    """Fetch a complaint by its human-readable complaint_number — raises 404 if not found."""
    complaint = session.exec(
        select(Complaint).where(Complaint.complaint_number == complaint_number)
    ).first()
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint CMP-{complaint_number:04d} not found",
        )
    return complaint


def list_complaints(
    user: User,
    session: Session,
    filter_status: Optional[ComplaintStatus] = None,
    assigned_to: Optional[uuid.UUID] = None,
) -> list[Complaint]:
    """Role-aware complaint listing.

    - Farmer: only their own complaints
    - Inspector / Doctor: complaints assigned to them
    - Authority: all complaints
    """
    stmt = select(Complaint)

    if str(user.role) == UserRole.farmer:
        stmt = stmt.where(Complaint.farmer_id == user.id)
    elif str(user.role) in (UserRole.inspector, UserRole.doctor):
        stmt = stmt.where(Complaint.assigned_to == user.id)
    # authority sees everything — no additional filter

    if filter_status:
        stmt = stmt.where(Complaint.status == filter_status)
    if assigned_to:
        stmt = stmt.where(Complaint.assigned_to == assigned_to)

    return list(session.exec(stmt.order_by(Complaint.created_at.desc())).all())  # type: ignore[arg-type]


def update_complaint_status(
    complaint: Complaint,
    payload: ComplaintStatusUpdate,
    actor: User,
    session: Session,
) -> Complaint:
    """Doctor / Inspector updates complaint status via strict FSM.

    Rules:
    - Only the assigned staff member may move status (or any Authority).
    - Transitioning to ``resolved`` requires ``resolved_notes``.
    - Invalid transitions are rejected with 400.
    """
    # Role check — only assigned staff or authority may update
    actor_role = str(actor.role)
    if actor_role == UserRole.farmer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Farmers cannot update complaint status",
        )
    if actor_role in (UserRole.doctor, UserRole.inspector):
        if complaint.assigned_to != actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update complaints assigned to you",
            )

    # FSM validation
    current = ComplaintStatus(complaint.status)
    new = payload.status
    if new not in ALLOWED_TRANSITIONS.get(current, set()):
        allowed = [s.value for s in ALLOWED_TRANSITIONS.get(current, set())]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot move from '{current.value}' to '{new.value}'. "
                   f"Allowed next states: {allowed}",
        )

    # resolved_notes required when resolving
    if new == ComplaintStatus.resolved and not payload.resolved_notes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="resolved_notes is required when marking a complaint as resolved",
        )

    complaint.status = new
    if payload.resolved_notes:
        complaint.resolved_notes = payload.resolved_notes
    complaint.updated_at = datetime.now(timezone.utc)
    session.add(complaint)
    session.commit()
    session.refresh(complaint)
    return complaint


def reassign_complaint(
    complaint: Complaint,
    payload: ComplaintReassign,
    session: Session,
) -> Complaint:
    """Authority manually reassigns a complaint to a specific Doctor or Inspector."""
    staff = session.get(User, payload.assigned_to)
    if not staff or not staff.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target staff member not found or inactive",
        )
    if str(staff.role) not in (UserRole.doctor, UserRole.inspector):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Complaints can only be assigned to a Doctor or Inspector",
        )

    complaint.assigned_to = payload.assigned_to
    # Move to assigned if still open
    if complaint.status == ComplaintStatus.open:
        complaint.status = ComplaintStatus.assigned
    complaint.updated_at = datetime.now(timezone.utc)
    session.add(complaint)
    session.commit()
    session.refresh(complaint)
    return complaint


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in kilometres between two GPS points.

    Uses the Haversine formula:
        a = sin²(Δlat/2) + cos(lat1)·cos(lat2)·sin²(Δlon/2)
        c = 2·atan2(√a, √(1−a))
        d = R·c
    """
    R = 6_371.0  # Earth's mean radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _find_nearest_staff(
    animal_lat: float,
    animal_lng: float,
    session: Session,
) -> Optional[User]:
    """Return the nearest active Doctor or Inspector to the given coordinates.

    Returns ``None`` if no eligible staff member is found in the database.
    Only staff with both latitude and longitude set are considered for distance
    ranking — staff without GPS are skipped.
    """
    candidates = session.exec(
        select(User).where(
            User.role.in_([UserRole.doctor, UserRole.inspector]),  # type: ignore[attr-defined]
            User.is_active == True,  # noqa: E712
        )
    ).all()

    nearest: Optional[User] = None
    min_dist = float("inf")

    for staff in candidates:
        if staff.latitude is None or staff.longitude is None:
            # Skip staff without a GPS base location
            continue
        dist = _haversine(animal_lat, animal_lng, staff.latitude, staff.longitude)
        if dist < min_dist:
            min_dist = dist
            nearest = staff

    return nearest


def _next_complaint_number(session: Session) -> int:
    """Return the next sequential complaint number (MAX + 1, starting at 1).

    Uses a single aggregation query — safe for low-concurrency usage.
    The UNIQUE constraint on ``complaint_number`` provides a last-resort
    guard against races in high-concurrency scenarios.
    """
    result = session.exec(select(func.max(Complaint.complaint_number))).one()
    current_max = result if result is not None else 0
    return current_max + 1
