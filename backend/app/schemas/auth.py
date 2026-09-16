import uuid
from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    """Accepts phone, email, or employee ID + password.

    - Farmers log in with phone or email.
    - Inspectors / Doctors / Authority staff log in with their employee ID,
      phone, or email — whichever was registered.
    """

    identifier: str  # phone number, email, OR employee ID
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: uuid.UUID   # user id
    role: str
    exp: datetime
