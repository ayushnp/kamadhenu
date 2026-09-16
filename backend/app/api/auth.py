"""Auth routes — public endpoints for farmer registration and login."""

from fastapi import APIRouter

from app.core.deps import SessionDep
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserPublic
from app.services.auth_service import authenticate_user, register_farmer

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=UserPublic,
    status_code=201,
    summary="Farmer self-registration",
    description=(
        "Register a new **farmer** account. "
        "Inspector, Doctor, and Authority accounts are created by an Authority admin via `POST /users/staff`."
    ),
)
def register(payload: UserCreate, session: SessionDep) -> UserPublic:
    user = register_farmer(payload, session)
    return UserPublic.model_validate(user)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login (all roles)",
    description="Login using **phone or email** + password. Returns a Bearer JWT token.",
)
def login(payload: LoginRequest, session: SessionDep) -> TokenResponse:
    return authenticate_user(payload, session)
