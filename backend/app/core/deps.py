"""FastAPI dependency factories for auth and role enforcement."""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlmodel import Session, select

from app.core.security import decode_token
from app.database import get_session
from app.models.user import User, UserRole

_bearer = HTTPBearer(auto_error=True)

SessionDep = Annotated[Session, Depends(get_session)]


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
    session: SessionDep,
) -> User:
    """Extract and validate JWT, return the User row from DB."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(credentials.credentials)
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = session.get(User, uuid.UUID(user_id))
    if user is None or not user.is_active:
        raise credentials_exception
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: UserRole):
    """Dependency factory that restricts an endpoint to specific roles.

    Usage::

        @router.get("/admin")
        def admin_only(user: Annotated[User, Depends(require_role(UserRole.authority))]):
            ...
    """

    def _check(current_user: CurrentUser) -> User:
        role_values = {r.value for r in roles}
        if str(current_user.role) not in role_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to: {list(role_values)}",
            )
        return current_user

    return _check
