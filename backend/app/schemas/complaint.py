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
