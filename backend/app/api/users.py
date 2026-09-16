"""User management routes."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, SessionDep, require_role
from app.models.user import User, UserRole
from app.schemas.user import StaffCreate, UserPublic, UserUpdate
from app.services.auth_service import create_staff
from app.services.user_service import get_user_by_id, list_users_by_role, update_user

router = APIRouter(prefix="/users", tags=["Users"])

AuthorityOnly = Annotated[User, Depends(require_role(UserRole.authority))]
StaffOrAbove = Annotated[
    User,
    Depends(require_role(UserRole.inspector, UserRole.doctor, UserRole.authority)),
]


@router.get(
    "/me",
    response_model=UserPublic,
    summary="Get own profile",
)
def get_me(current_user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserPublic,
    summary="Update own profile",
)
def update_me(payload: UserUpdate, current_user: CurrentUser, session: SessionDep) -> UserPublic:
    # Farmers and staff can update their own non-role-critical fields
    user = update_user(current_user, payload, session)
    return UserPublic.model_validate(user)


@router.post(
    "/staff",
    response_model=UserPublic,
    status_code=201,
    summary="[Authority] Create inspector / doctor / authority account",
)
def create_staff_account(
    payload: StaffCreate,
    _admin: AuthorityOnly,
    session: SessionDep,
) -> UserPublic:
    user = create_staff(payload, session)
    return UserPublic.model_validate(user)


@router.get(
    "/",
    response_model=list[UserPublic],
    summary="[Staff+] List users by role",
)
def list_users(
    role: UserRole,
    _caller: StaffOrAbove,
    session: SessionDep,
) -> list[UserPublic]:
    users = list_users_by_role(role, session)
    return [UserPublic.model_validate(u) for u in users]


@router.get(
    "/{user_id}",
    response_model=UserPublic,
    summary="[Staff+] Get user by ID",
)
def get_user(
    user_id: str,
    _caller: StaffOrAbove,
    session: SessionDep,
) -> UserPublic:
    import uuid
    user = get_user_by_id(uuid.UUID(user_id), session)
    return UserPublic.model_validate(user)


@router.patch(
    "/{user_id}/deactivate",
    response_model=UserPublic,
    summary="[Authority] Deactivate a user account",
)
def deactivate_user(
    user_id: str,
    _admin: AuthorityOnly,
    session: SessionDep,
) -> UserPublic:
    import uuid
    user = get_user_by_id(uuid.UUID(user_id), session)
    user = update_user(user, UserUpdate(is_active=False), session)
    return UserPublic.model_validate(user)
