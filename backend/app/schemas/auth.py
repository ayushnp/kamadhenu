import uuid
from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    """Accepts either phone or email + password."""

    identifier: str  # phone number OR email
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: uuid.UUID   # user id
    role: str
    exp: datetime
