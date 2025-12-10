"""Dataset and Project permission schemas."""

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


class PermissionInviteRequest(BaseModel):
    """Request to invite a user to a dataset."""
    user_email: str = Field(..., description="Email of user to invite")
    role: str = Field(..., description="Role to grant ('owner' or 'member')")

    class Config:
        json_schema_extra = {
            "example": {
                "user_email": "user@example.com",
                "role": "member"
            }
        }


class PermissionResponse(BaseModel):
    """Dataset permission information."""
    id: int
    dataset_id: str
    user_id: int
    role: str
    granted_by: int
    granted_at: datetime

    # User information (joined from Platform DB)
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_badge_color: Optional[str] = None

    # Granted by user information
    granted_by_name: Optional[str] = None
    granted_by_email: Optional[str] = None

    class Config:
        from_attributes = True


class PermissionUpdateRequest(BaseModel):
    """Request to update a user's permission."""
    role: str = Field(..., description="New role ('owner' or 'member')")

    class Config:
        json_schema_extra = {
            "example": {
                "role": "owner"
            }
        }


class TransferOwnershipRequest(BaseModel):
    """Request to transfer dataset ownership."""
    new_owner_user_id: int = Field(..., description="User ID of new owner")

    class Config:
        json_schema_extra = {
            "example": {
                "new_owner_user_id": 2
            }
        }


# ============================================================================
# Phase 8.1: Project Permission Schemas (Unified RBAC)
# ============================================================================

# Type for project roles
ProjectRole = Literal['owner', 'admin', 'reviewer', 'annotator', 'viewer']


class ProjectPermissionInviteRequest(BaseModel):
    """Request to invite a user to a project."""
    user_email: str = Field(..., description="Email of user to invite")
    role: ProjectRole = Field(..., description="Role to grant")

    class Config:
        json_schema_extra = {
            "example": {
                "user_email": "user@example.com",
                "role": "annotator"
            }
        }


class ProjectPermissionResponse(BaseModel):
    """Project permission information."""
    id: int
    project_id: str
    user_id: int
    role: ProjectRole
    granted_by: int
    granted_at: datetime

    # User information (joined from Platform DB)
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_badge_color: Optional[str] = None

    # Granted by user information
    granted_by_name: Optional[str] = None
    granted_by_email: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectPermissionUpdateRequest(BaseModel):
    """Request to update a user's project permission."""
    role: ProjectRole = Field(..., description="New role")

    class Config:
        json_schema_extra = {
            "example": {
                "role": "reviewer"
            }
        }


class ProjectTransferOwnershipRequest(BaseModel):
    """Request to transfer project ownership."""
    new_owner_user_id: int = Field(..., description="User ID of new owner")

    class Config:
        json_schema_extra = {
            "example": {
                "new_owner_user_id": 2
            }
        }
