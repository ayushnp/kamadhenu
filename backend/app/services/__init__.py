from app.services.auth_service import authenticate_user, create_staff, register_farmer
from app.services.cow_service import (
    add_health_record,
    add_vaccination,
    create_bovine,
    get_bovine,
    get_bovine_with_history,
    list_bovines,
    list_health_records,
    list_vaccinations,
    lookup_bovine,
    update_bovine,
)
from app.services.user_service import get_user_by_id, list_users_by_role, update_user

__all__ = [
    "register_farmer",
    "create_staff",
    "authenticate_user",
    "get_user_by_id",
    "update_user",
    "list_users_by_role",
    "create_bovine",
    "get_bovine",
    "lookup_bovine",
    "list_bovines",
    "update_bovine",
    "get_bovine_with_history",
    "add_health_record",
    "list_health_records",
    "add_vaccination",
    "list_vaccinations",
]
