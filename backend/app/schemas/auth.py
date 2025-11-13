"""Authentication schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    """Login request."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """User information response."""
    id: int
    email: str
    username: Optional[str] = None  # Not in Platform DB
    full_name: Optional[str] = None  # Platform DB uses this
    company: Optional[str] = None
    division: Optional[str] = None
    department: Optional[str] = None
    system_role: Optional[str] = None  # 'admin' or 'user' in Platform
    is_active: bool
    is_admin: bool  # Derived from system_role via @property
    badge_color: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
