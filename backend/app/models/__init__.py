"""SQLModel table models — re-exported for Alembic autogenerate."""

from app.models.cow import Bovine
from app.models.cow_health import BovineHealthRecord
from app.models.user import User, UserRole
from app.models.vaccination import Vaccination

__all__ = [
    "User",
    "UserRole",
    "Bovine",
    "BovineHealthRecord",
    "Vaccination",
]
