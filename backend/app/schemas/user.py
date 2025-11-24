"""
User Schemas for Phase 8.2 - Invitation System

Schemas for user search and user information display.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List


class UserSearchItem(BaseModel):
    """Individual user item in search results."""

    id: int
    email: EmailStr
    full_name: Optional[str] = None
    avatar_name: Optional[str] = None
    badge_color: Optional[str] = None
    system_role: Optional[str] = None  # "admin" or "user"

    class Config:
        from_attributes = True


class UserSearchResponse(BaseModel):
    """Response for user search endpoint."""

    users: List[UserSearchItem]
    total: int
    limit: int
    offset: int


class UserInfoResponse(BaseModel):
    """Detailed user information response."""

    id: int
    email: EmailStr
    full_name: Optional[str] = None
    avatar_name: Optional[str] = None
    badge_color: Optional[str] = None
    system_role: Optional[str] = None
    organization_id: Optional[int] = None
    is_active: bool = True
    created_at: Optional[str] = None

    class Config:
        from_attributes = True
