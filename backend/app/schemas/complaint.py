"""Complaint request/response schemas."""

import uuid
from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel

from app.models.complaint import ComplaintPriority, ComplaintStatus


# ─── Create ───────────────────────────────────────────────────────────────────

class ComplaintCreate(SQLModel):
    """Farmer payload when raising a complaint for one of their animals."""

    bovine_id: uuid.UUID
    description: str
    priority: ComplaintPriority = ComplaintPriority.medium
    symptoms: Optional[str] = None


# ─── Read ─────────────────────────────────────────────────────────────────────

class ComplaintRead(SQLModel):
    """Full complaint response — safe to return to any authenticated user."""

    id: uuid.UUID
    complaint_number: Optional[int] = None
    complaint_ref: Optional[str] = None   # formatted e.g. "CMP-0001"
    farmer_id: uuid.UUID
    bovine_id: uuid.UUID
    assigned_to: Optional[uuid.UUID] = None
    status: ComplaintStatus
    priority: ComplaintPriority
    description: str
    symptoms: Optional[str] = None
    resolved_notes: Optional[str] = None
    animal_lat: Optional[float] = None
    animal_lng: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_complaint(cls, complaint) -> "ComplaintRead":
        """Build a ComplaintRead with the formatted complaint_ref."""
        return cls(
            id=complaint.id,
            complaint_number=complaint.complaint_number,
            complaint_ref=f"CMP-{complaint.complaint_number:04d}" if complaint.complaint_number else None,
            farmer_id=complaint.farmer_id,
            bovine_id=complaint.bovine_id,
            assigned_to=complaint.assigned_to,
            status=complaint.status,
            priority=complaint.priority,
            description=complaint.description,
            symptoms=complaint.symptoms,
            resolved_notes=complaint.resolved_notes,
            animal_lat=complaint.animal_lat,
            animal_lng=complaint.animal_lng,
            created_at=complaint.created_at,
            updated_at=complaint.updated_at,
        )


# ─── Update — status (Doctor / Inspector) ─────────────────────────────────────

class ComplaintStatusUpdate(SQLModel):
    """Doctor / Inspector moves the complaint through the FSM.

    ``resolved_notes`` is required when transitioning to ``resolved``.
    """

    status: ComplaintStatus
    resolved_notes: Optional[str] = None


# ─── Reassign (Authority) ─────────────────────────────────────────────────────

class ComplaintReassign(SQLModel):
    """Authority manually reassigns a complaint to a specific Doctor or Inspector."""

    assigned_to: uuid.UUID
