"""Auth service — registration and login logic."""

from fastapi import HTTPException, status
from sqlmodel import Session, or_, select

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import StaffCreate, UserCreate


def register_farmer(payload: UserCreate, session: Session) -> User:
    """Register a new farmer account. Raises 409 if phone/email already taken."""
    _assert_unique_contact(payload.phone, payload.email, session)

    user = User(
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=UserRole.farmer,
        photo_url=payload.photo_url,
        place=payload.place,
        number_of_animals=payload.number_of_animals,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def create_staff(payload: StaffCreate, session: Session) -> User:
    """Create inspector / doctor / authority accounts (authority-only action)."""
    _assert_unique_contact(payload.phone, payload.email, session, employee_id=payload.employee_id)

    user = User(
        name=payload.name,
        phone=payload.phone,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        employee_id=payload.employee_id,
        department=payload.department,
        jurisdiction=payload.jurisdiction,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def authenticate_user(payload: LoginRequest, session: Session) -> TokenResponse:
    """Validate credentials and return a signed JWT token.

    The identifier can be:
    - Phone number (all roles)
    - Email address (all roles)
    - Employee ID (Inspector / Doctor / Authority only)
    """
    identifier = payload.identifier.strip()

    statement = select(User).where(
        or_(
            User.phone == identifier,
            User.email == identifier,
            User.employee_id == identifier,  # staff login via government employee ID
        )
    )
    user = session.exec(statement).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    token = create_access_token(subject=user.id, role=str(user.role))
    return TokenResponse(access_token=token)


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _assert_unique_contact(phone, email, session, employee_id=None):
    conditions = []
    if phone:
        conditions.append(User.phone == phone)
    if email:
        conditions.append(User.email == email)
    if employee_id:
        conditions.append(User.employee_id == employee_id)
    existing = session.exec(select(User).where(or_(*conditions))).first()
    if existing:
        raise HTTPException(status_code=409, detail="Phone, email, or employee ID already registered.")