"""
Project Permission Endpoints (Phase 8.1.3)

Unified RBAC system with 5 roles:
- owner: Full control (delete project, manage all)
- admin: Manage members, classes, review
- reviewer: Annotate + review others' work
- annotator: Annotate own work only
- viewer: Read-only access
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_labeler_db, get_platform_db
from app.core.security import get_current_user, require_project_permission
from app.db.models.labeler import ProjectPermission, AnnotationProject
from app.schemas.permission import (
    ProjectPermissionInviteRequest,
    ProjectPermissionResponse,
    ProjectPermissionUpdateRequest,
    ProjectTransferOwnershipRequest,
)

router = APIRouter()


# =============================================================================
# Permission Listing
# =============================================================================

@router.get(
    "/{project_id}/permissions",
    response_model=List[ProjectPermissionResponse],
    tags=["Project Permissions"],
)
async def list_project_permissions(
    project_id: str,
    current_user=Depends(get_current_user),
    _permission=Depends(require_project_permission("viewer")),
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
):
    """
    List all permissions for a project.

    Requires: viewer role or higher

    Note: Supports both dataset_id (ds_xxx) and project_id (proj_xxx)
    """
    # Support both dataset_id (ds_xxx) and project_id (proj_xxx)
    actual_project_id = project_id
    if project_id.startswith('ds_'):
        project = (
            labeler_db.query(AnnotationProject)
            .filter(AnnotationProject.dataset_id == project_id)
            .first()
        )
        if project:
            actual_project_id = project.id

    # Get all permissions for this project
    permissions = (
        labeler_db.query(ProjectPermission)
        .filter(ProjectPermission.project_id == actual_project_id)
        .all()
    )

    # Build response without user information (User DB not available)
    result = []
    for perm in permissions:
        perm_dict = {
            "id": perm.id,
            "project_id": perm.project_id,
            "user_id": perm.user_id,
            "role": perm.role,
            "granted_by": perm.granted_by,
            "granted_at": perm.granted_at,
            "user_name": None,
            "user_email": None,
            "user_badge_color": None,
            "granted_by_name": None,
            "granted_by_email": None,
        }
        result.append(perm_dict)

    return result


# =============================================================================
# Add Member
# =============================================================================

@router.post(
    "/{project_id}/permissions",
    response_model=ProjectPermissionResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Project Permissions"],
)
async def add_project_member(
    project_id: str,
    request: ProjectPermissionInviteRequest,
    current_user=Depends(get_current_user),
    _permission=Depends(require_project_permission("admin")),
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
):
    """
    Add a member to a project with specified role.

    Requires: admin role or higher

    Notes:
    - Cannot grant 'owner' role (use transfer ownership instead)
    - Admin can only grant roles up to 'admin' (not 'owner')
    - Supports both dataset_id (ds_xxx) and project_id (proj_xxx)
    """
    # Support both dataset_id and project_id
    actual_project_id = project_id
    if project_id.startswith('ds_'):
        project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.dataset_id == project_id
        ).first()
        if project:
            actual_project_id = project.id
    else:
        project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.id == project_id
        ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # User DB is not available - cannot look up users by email
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Adding members by email is not available. User database is not configured.",
    )


# =============================================================================
# Update Member Role
# =============================================================================

@router.patch(
    "/{project_id}/permissions/{user_id}",
    response_model=ProjectPermissionResponse,
    tags=["Project Permissions"],
)
async def update_project_member_role(
    project_id: str,
    user_id: int,
    request: ProjectPermissionUpdateRequest,
    current_user=Depends(get_current_user),
    _permission=Depends(require_project_permission("admin")),
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
):
    """
    Update a member's role in a project.

    Requires: admin role or higher

    Notes:
    - Cannot change owner role (use transfer ownership instead)
    - Cannot promote to owner (use transfer ownership instead)
    - Supports both dataset_id (ds_xxx) and project_id (proj_xxx)
    """
    # Support both dataset_id and project_id
    actual_project_id = project_id
    if project_id.startswith('ds_'):
        project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.dataset_id == project_id
        ).first()
        if project:
            actual_project_id = project.id

    # Get permission
    permission = (
        labeler_db.query(ProjectPermission)
        .filter(
            ProjectPermission.project_id == actual_project_id,
            ProjectPermission.user_id == user_id,
        )
        .first()
    )

    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} does not have access to project {project_id}",
        )

    # Cannot change owner role
    if permission.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change owner role. Use transfer ownership instead.",
        )

    # Cannot promote to owner
    if request.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot promote to owner. Use transfer ownership instead.",
        )

    # Update role
    permission.role = request.role
    labeler_db.commit()
    labeler_db.refresh(permission)

    # Return response without user information (User DB not available)
    return {
        "id": permission.id,
        "project_id": permission.project_id,
        "user_id": permission.user_id,
        "role": permission.role,
        "granted_by": permission.granted_by,
        "granted_at": permission.granted_at,
        "user_name": None,
        "user_email": None,
        "user_badge_color": None,
        "granted_by_name": None,
        "granted_by_email": None,
    }


# =============================================================================
# Remove Member
# =============================================================================

@router.delete(
    "/{project_id}/permissions/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Project Permissions"],
)
async def remove_project_member(
    project_id: str,
    user_id: int,
    current_user=Depends(get_current_user),
    _permission=Depends(require_project_permission("admin")),
    labeler_db: Session = Depends(get_labeler_db),
):
    """
    Remove a member from a project.

    Requires: admin role or higher

    Notes:
    - Cannot remove the owner (transfer ownership first)
    - User cannot remove themselves
    - Supports both dataset_id (ds_xxx) and project_id (proj_xxx)
    """
    # Support both dataset_id and project_id
    actual_project_id = project_id
    if project_id.startswith('ds_'):
        project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.dataset_id == project_id
        ).first()
        if project:
            actual_project_id = project.id

    # Get permission
    permission = (
        labeler_db.query(ProjectPermission)
        .filter(
            ProjectPermission.project_id == actual_project_id,
            ProjectPermission.user_id == user_id,
        )
        .first()
    )

    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {user_id} does not have access to project {project_id}",
        )

    # Cannot remove owner
    if permission.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove project owner. Transfer ownership first.",
        )

    # User cannot remove themselves
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove yourself from the project.",
        )

    # Delete permission
    labeler_db.delete(permission)
    labeler_db.commit()


# =============================================================================
# Transfer Ownership
# =============================================================================

@router.post(
    "/{project_id}/transfer-ownership",
    response_model=dict,
    tags=["Project Permissions"],
)
async def transfer_project_ownership(
    project_id: str,
    request: ProjectTransferOwnershipRequest,
    current_user=Depends(get_current_user),
    _permission=Depends(require_project_permission("owner")),
    labeler_db: Session = Depends(get_labeler_db),
):
    """
    Transfer project ownership to another member.

    Requires: owner role

    Notes:
    - Target user must already be a member of the project
    - Current owner becomes admin
    - Cannot transfer to yourself
    - Supports both dataset_id (ds_xxx) and project_id (proj_xxx)
    """
    # Support both dataset_id and project_id
    actual_project_id = project_id
    if project_id.startswith('ds_'):
        project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.dataset_id == project_id
        ).first()
        if project:
            actual_project_id = project.id

    new_owner_id = request.new_owner_user_id

    # Cannot transfer to yourself
    if new_owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot transfer ownership to yourself",
        )

    # Get current owner permission
    current_owner_perm = (
        labeler_db.query(ProjectPermission)
        .filter(
            ProjectPermission.project_id == actual_project_id,
            ProjectPermission.user_id == current_user.id,
            ProjectPermission.role == "owner",
        )
        .first()
    )

    if not current_owner_perm:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can transfer ownership",
        )

    # Get new owner permission (must be existing member)
    new_owner_perm = (
        labeler_db.query(ProjectPermission)
        .filter(
            ProjectPermission.project_id == actual_project_id,
            ProjectPermission.user_id == new_owner_id,
        )
        .first()
    )

    if not new_owner_perm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User {new_owner_id} is not a member of this project",
        )

    # Transfer ownership
    current_owner_perm.role = "admin"  # Demote current owner to admin
    new_owner_perm.role = "owner"  # Promote new owner

    labeler_db.commit()

    return {
        "message": "Ownership transferred successfully",
        "new_owner_user_id": new_owner_id,
        "previous_owner_user_id": current_user.id,
    }
