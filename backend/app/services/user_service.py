"""User management service."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.models.user import User, UserRole
from app.schemas.user import UserUpdate


def get_user_by_id(user_id: uuid.UUID, session: Session) -> User:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def update_user(user: User, payload: UserUpdate, session: Session) -> User:
    """Apply non-null patch fields to the user row."""
    data = payload.model_dump(exclude_none=True)
    for field, value in data.items():
        setattr(user, field, value)
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def list_users_by_role(role: UserRole, session: Session) -> list[User]:
    return list(session.exec(select(User).where(User.role == role)).all())
