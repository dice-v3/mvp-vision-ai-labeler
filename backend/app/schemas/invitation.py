"""
Invitation Schemas for Phase 8.2 - Invitation System

Schemas for project invitation management.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum


class InvitationStatus(str, Enum):
    """Invitation status enum."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ProjectRole(str, Enum):
    """Project role enum (Phase 8.1 RBAC)."""

    OWNER = "owner"
    ADMIN = "admin"
    REVIEWER = "reviewer"
    ANNOTATOR = "annotator"
    VIEWER = "viewer"


class CreateInvitationRequest(BaseModel):
    """Request to create a new invitation."""

    project_id: str
    invitee_user_id: str  # Keycloak user sub (UUID)
    role: ProjectRole


class InvitationResponse(BaseModel):
    """Individual invitation response."""

    id: int
    project_id: str
    inviter_user_id: str  # Keycloak user sub (UUID)
    invitee_user_id: str  # Keycloak user sub (UUID)
    invitee_email: EmailStr
    role: str
    status: str
    token: Optional[str] = None  # Only returned when creating new invitation
    created_at: datetime
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None

    # Enriched fields (from joins)
    inviter_name: Optional[str] = None
    invitee_name: Optional[str] = None
    project_name: Optional[str] = None

    class Config:
        from_attributes = True


class InvitationListResponse(BaseModel):
    """Response for listing invitations."""

    invitations: List[InvitationResponse]
    total: int


class AcceptInvitationRequest(BaseModel):
    """Request to accept an invitation."""

    token: str


class AcceptInvitationResponse(BaseModel):
    """Response after accepting invitation."""

    message: str
    project_id: str
    role: str
    permission_id: int  # Created ProjectPermission ID
