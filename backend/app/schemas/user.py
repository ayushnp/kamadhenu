import uuid
from datetime import datetime
from typing import Optional

from pydantic import EmailStr, field_validator, model_validator
from sqlmodel import SQLModel

from app.models.user import UserRole


# ─── Create ───────────────────────────────────────────────────────────────────

class UserCreate(SQLModel):
    """Farmer self-registration payload.
    Inspector / Doctor / Authority accounts are created by Authority admins via /users.
    """

    name: str
    password: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    photo_url: Optional[str] = None
    place: Optional[str] = None
    number_of_animals: Optional[int] = None

    @model_validator(mode="after")
    def at_least_one_contact(self) -> "UserCreate":
        if not self.phone and not self.email:
            raise ValueError("At least one of phone or email is required.")
        return self


class StaffCreate(SQLModel):
    """Authority-only: create inspector / doctor / authority accounts."""

    name: str
    role: UserRole
    password: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    jurisdiction: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @model_validator(mode="after")
    def at_least_one_contact(self) -> "StaffCreate":
        if not self.phone and not self.email:
            raise ValueError("At least one of phone or email is required.")
        return self

    @field_validator("role")
    @classmethod
    def not_farmer(cls, v: UserRole) -> UserRole:
        if v == UserRole.farmer:
            raise ValueError("Use /auth/register for farmer registration.")
        return v


# ─── Read ─────────────────────────────────────────────────────────────────────

class UserPublic(SQLModel):
    """Safe response model — never returns hashed_password."""

    id: uuid.UUID
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: UserRole
    photo_url: Optional[str] = None
    place: Optional[str] = None
    number_of_animals: Optional[int] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    jurisdiction: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


# Alias for backwards-compat
UserRead = UserPublic


# ─── Update ───────────────────────────────────────────────────────────────────

class UserUpdate(SQLModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    photo_url: Optional[str] = None
    place: Optional[str] = None
    number_of_animals: Optional[int] = None
    department: Optional[str] = None
    jurisdiction: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_active: Optional[bool] = None
