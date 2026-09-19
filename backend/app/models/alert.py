"""Alert model — stores notifications for farmers, vets, inspectors, and authorities."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Column, Field, SQLModel, String


class AlertSeverity(str, Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class AlertType(str, Enum):
    high_risk_mastitis = "high_risk_mastitis"
    case_assigned = "case_assigned"
    outbreak_warning = "outbreak_warning"
    vaccine_overdue = "vaccine_overdue"
    barn_environment_hazard = "barn_environment_hazard"


class Alert(SQLModel, table=True):
    """An alert or notification delivered to a user or role."""

    __tablename__ = "alerts"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        index=True,
    )

    # ─── Recipient ────────────────────────────────────────────────────────────
    # Specific recipient user (e.g. specific farmer or assigned vet)
    user_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="users.id",
        index=True,
    )
    # Target role for broadcast/role-based alerts (e.g. "authority" or "doctor")
    target_role: Optional[str] = Field(default=None, index=True)

    # ─── Associations ─────────────────────────────────────────────────────────
    bovine_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="cows.id",
        index=True,
    )
    complaint_id: Optional[uuid.UUID] = Field(
        default=None,
        foreign_key="complaints.id",
        index=True,
    )

    # ─── Content ──────────────────────────────────────────────────────────────
    title: str = Field(max_length=255)
    message: str = Field(max_length=1000)
    alert_type: AlertType = Field(
        sa_column=Column(String, nullable=False, index=True)
    )
    severity: AlertSeverity = Field(
        default=AlertSeverity.warning,
        sa_column=Column(String, nullable=False)
    )

    # ─── Status & Metadata ────────────────────────────────────────────────────
    is_read: bool = Field(default=False, index=True)
    data_json: Optional[str] = Field(default=None)  # JSON string with extra metadata (score, tag, village)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        index=True,
    )
