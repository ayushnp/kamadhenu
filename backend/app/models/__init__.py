"""SQLModel table models — re-exported for Alembic autogenerate."""

from app.models.complaint import Complaint, ComplaintPriority, ComplaintStatus
from app.models.cow import Bovine
from app.models.cow_health import BovineHealthRecord
from app.models.sensor import (
    CMTResult,
    EnvironmentReading,
    MilkQuarter,
    MilkReading,
    WearableReading,
)
from app.models.user import User, UserRole
from app.models.vaccination import Vaccination
from app.models.risk import RiskScore
from app.models.alert import Alert, AlertSeverity, AlertType

__all__ = [
    "User",
    "UserRole",
    "Bovine",
    "BovineHealthRecord",
    "Vaccination",
    "Complaint",
    "ComplaintStatus",
    "ComplaintPriority",
    "WearableReading",
    "MilkReading",
    "EnvironmentReading",
    "MilkQuarter",
    "CMTResult",
    "RiskScore",
    "Alert",
    "AlertSeverity",
    "AlertType",
]
