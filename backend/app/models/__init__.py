"""SQLModel table models — re-exported for Alembic autogenerate."""

from app.models.cow import Cow
from app.models.cow_health import CowHealthRecord
from app.models.user import User, UserRole
from app.models.vaccination import Vaccination

__all__ = [
    "User",
    "UserRole",
    "Cow",
    "CowHealthRecord",
    "Vaccination",
]
