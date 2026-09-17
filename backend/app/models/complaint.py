"""Complaint model — farmer raises a complaint for a bovine animal; system auto-assigns nearest staff."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Column, Field, SQLModel, String


class ComplaintStatus(str, Enum):
    """Strict FSM:  open → assigned → in_progress → resolved → closed."""

    open = "open"
    assigned = "assigned"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class ComplaintPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


# Valid forward transitions — only these moves are allowed
ALLOWED_TRANSITIONS: dict[ComplaintStatus, set[ComplaintStatus]] = {
    ComplaintStatus.open: {ComplaintStatus.assigned},
    ComplaintStatus.assigned: {ComplaintStatus.in_progress},
    ComplaintStatus.in_progress: {ComplaintStatus.resolved},
    ComplaintStatus.resolved: {ComplaintStatus.closed},
    ComplaintStatus.closed: set(),  # terminal state
}


class Complaint(SQLModel, table=True):
    """A health complaint raised by a farmer for one of their bovine animals."""

    __tablename__ = "complaints"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )

    # ─── Ownership & subject ───────────────────────────────────────────────────
    farmer_id: uuid.UUID = Field(foreign_key="users.id", index=True)
    bovine_id: uuid.UUID = Field(foreign_key="cows.id", index=True)

    # ─── Assignment ───────────────────────────────────────────────────────────
    # Populated by Haversine auto-assign on creation; NULL means still open/unassigned
    assigned_to: Optional[uuid.UUID] = Field(
        default=None, foreign_key="users.id", index=True
    )

    # ─── Status & priority ────────────────────────────────────────────────────
    status: ComplaintStatus = Field(
        default=ComplaintStatus.open,
        sa_column=Column(String, nullable=False),
    )
    priority: ComplaintPriority = Field(
        default=ComplaintPriority.medium,
        sa_column=Column(String, nullable=False),
    )

    # ─── Description ──────────────────────────────────────────────────────────
    description: str = Field(max_length=2000)
    symptoms: Optional[str] = Field(default=None, max_length=1000)

    # ─── Resolution ───────────────────────────────────────────────────────────
    resolved_notes: Optional[str] = Field(default=None, max_length=2000)

    # ─── GPS snapshot at time of complaint ────────────────────────────────────
    # Snapshotted from Bovine at creation so later GPS edits don't affect assignment
    animal_lat: Optional[float] = Field(default=None)
    animal_lng: Optional[float] = Field(default=None)

    # ─── Metadata ─────────────────────────────────────────────────────────────
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
