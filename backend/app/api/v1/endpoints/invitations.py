"""
Invitation Endpoints for Phase 8.2 - Invitation System

Endpoints for creating, listing, accepting, and canceling project invitations.

IMPORTANT: Uses Labeler DB's invitations table (independent from Platform).
Supports 5-role RBAC: owner, admin, reviewer, annotator, viewer.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import secrets

from app.core.database import get_labeler_db
from app.core.security import get_current_user
# from app.db.models.user import User
from app.db.models.labeler import AnnotationProject, ProjectPermission, Invitation
from app.schemas.invitation import (
    CreateInvitationRequest,
    InvitationResponse,
    InvitationListResponse,
    AcceptInvitationRequest,
    AcceptInvitationResponse,
)

router = APIRouter()


def generate_invitation_token() -> str:
    """Generate a secure random token for invitation."""
    return secrets.token_urlsafe(32)


def enrich_invitation(
    invitation: Invitation,
    labeler_db: Session,
) -> InvitationResponse:
    """Enrich invitation with user and project information."""
    # Get inviter info
    # inviter = user_db.query(User).filter(User.id == invitation.inviter_id).first()
    # inviter_name = inviter.full_name if inviter and inviter.full_name else None
    inviter_name = None

    # Get invitee info
    # invitee = user_db.query(User).filter(User.id == invitation.invitee_id).first() if invitation.invitee_id else None
    # invitee_name = invitee.full_name if invitee and invitee.full_name else None
    invitee_name = None

    # Get project info (invitation.project_id is dataset_id)
    project_name = None
    if invitation.project_id:
        project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.dataset_id == invitation.project_id
        ).first()
        project_name = project.name if project else None

    return InvitationResponse(
        id=invitation.id,
        project_id=invitation.project_id,
        inviter_user_id=invitation.inviter_id,
        invitee_user_id=invitation.invitee_id,
        invitee_email=invitation.invitee_email,
        role=invitation.role,
        status=invitation.status,
        token=invitation.token if invitation.status == "pending" else None,
        created_at=invitation.created_at,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
        cancelled_at=invitation.cancelled_at,
        inviter_name=inviter_name,
        invitee_name=invitee_name,
        project_name=project_name,
    )


@router.post("", response_model=InvitationResponse, tags=["Invitations"])
async def create_invitation(
    request: CreateInvitationRequest,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Create a new project invitation (Phase 8.2).

    - Inviter must have 'owner' or 'admin' permission on the project
    - Invitee must exist in User DB
    - Cannot invite user who is already a member
    - Cannot have duplicate pending invitations
    - Generates secure token with 7-day expiration
    """
    # Verify project exists (request.project_id is actually dataset_id)
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.dataset_id == request.project_id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Use the actual project.id for permission checks
    actual_project_id = project.id

    # Check inviter has permission (owner or admin)
    inviter_permission = labeler_db.query(ProjectPermission).filter(
        ProjectPermission.project_id == actual_project_id,
        ProjectPermission.user_id == current_user.id,
    ).first()

    if not inviter_permission or inviter_permission.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only project owners and admins can invite members"
        )

    # Verify invitee exists
    # NOTE: User DB lookup disabled - cannot verify invitee exists
    # invitee = user_db.query(User).filter(
    #     User.id == request.invitee_user_id
    # ).first()
    # if not invitee:
    #     raise HTTPException(status_code=404, detail="Invitee user not found")

    # TODO: Without User DB, we cannot verify invitee exists or get their email
    # This endpoint may need to accept email in the request or use Keycloak
    raise HTTPException(
        status_code=501,
        detail="Cannot create invitation: User DB lookup disabled. Need Keycloak integration."
    )

    # Check if invitee is already a member
    existing_permission = labeler_db.query(ProjectPermission).filter(
        ProjectPermission.project_id == actual_project_id,
        ProjectPermission.user_id == request.invitee_user_id,
    ).first()

    if existing_permission:
        raise HTTPException(
            status_code=400,
            detail="User is already a member of this project"
        )

    # Check for duplicate pending invitation
    existing_invitation = labeler_db.query(Invitation).filter(
        Invitation.project_id == request.project_id,
        Invitation.invitee_id == request.invitee_user_id,
        Invitation.status == "pending",
    ).first()

    if existing_invitation:
        raise HTTPException(
            status_code=400,
            detail="A pending invitation already exists for this user"
        )

    # Create invitation
    token = generate_invitation_token()
    expires_at = datetime.utcnow() + timedelta(days=7)

    # NOTE: Code below unreachable due to exception above, but kept commented for reference
    # new_invitation = Invitation(
    #     token=token,
    #     project_id=request.project_id,
    #     inviter_id=current_user.id,
    #     invitee_id=request.invitee_user_id,
    #     invitee_email=invitee.email,  # Cannot get email without User DB
    #     role=request.role.value,
    #     status="pending",
    #     message=None,
    #     created_at=datetime.utcnow(),
    #     expires_at=expires_at,
    # )
    #
    # labeler_db.add(new_invitation)
    # labeler_db.commit()
    # labeler_db.refresh(new_invitation)
    #
    # return enrich_invitation(new_invitation, labeler_db)


@router.get("", response_model=InvitationListResponse, tags=["Invitations"])
async def list_invitations(
    type: str = Query("received", description="'sent' or 'received'"),
    status: Optional[str] = Query(None, description="Filter by status"),
    project_id: Optional[str] = Query(None, description="Filter by project"),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    List invitations sent by or received by current user (Phase 8.2).

    - type='sent': Invitations created by current user
    - type='received': Invitations for current user
    - Optional filters: status, project_id
    - Returns enriched invitation data with user/project names
    """
    # Build base query
    query = labeler_db.query(Invitation)

    if type == "sent":
        query = query.filter(Invitation.inviter_id == current_user.id)
    elif type == "received":
        query = query.filter(Invitation.invitee_id == current_user.id)
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid type. Must be 'sent' or 'received'"
        )

    # Apply filters
    if status:
        query = query.filter(Invitation.status == status)

    if project_id:
        query = query.filter(Invitation.project_id == project_id)

    # Get results ordered by created_at descending
    invitations = query.order_by(Invitation.created_at.desc()).all()

    # Enrich with user/project info
    enriched_invitations = [
        enrich_invitation(inv, labeler_db)
        for inv in invitations
    ]

    return InvitationListResponse(
        invitations=enriched_invitations,
        total=len(enriched_invitations),
    )


@router.post("/accept", response_model=AcceptInvitationResponse, tags=["Invitations"])
async def accept_invitation(
    request: AcceptInvitationRequest,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Accept a project invitation (Phase 8.2).

    - Validates invitation token
    - Checks invitation is pending and not expired
    - Creates ProjectPermission with specified role
    - Updates invitation status to 'accepted'
    - Returns created permission information
    """
    # Find invitation by token
    invitation = labeler_db.query(Invitation).filter(
        Invitation.token == request.token,
    ).first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid invitation token")

    # Verify invitation is for current user
    if invitation.invitee_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="This invitation is not for you"
        )

    # Check invitation status
    if invitation.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Invitation is already {invitation.status}"
        )

    # Check expiration
    if datetime.utcnow() >= invitation.expires_at:
        # Mark as expired
        invitation.status = "expired"
        labeler_db.commit()
        raise HTTPException(status_code=400, detail="Invitation has expired")

    # Get the actual project (invitation.project_id is dataset_id)
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.dataset_id == invitation.project_id
    ).first()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create ProjectPermission with the actual project.id
    new_permission = ProjectPermission(
        project_id=project.id,
        user_id=current_user.id,
        role=invitation.role,
        granted_at=datetime.utcnow(),
        granted_by=invitation.inviter_id,
    )

    labeler_db.add(new_permission)
    labeler_db.commit()
    labeler_db.refresh(new_permission)

    # Update invitation status
    invitation.status = "accepted"
    invitation.accepted_at = datetime.utcnow()
    labeler_db.commit()

    return AcceptInvitationResponse(
        message="Invitation accepted successfully",
        project_id=invitation.project_id,
        role=invitation.role,
        permission_id=new_permission.id,
    )


@router.post("/{invitation_id}/cancel", response_model=InvitationResponse, tags=["Invitations"])
async def cancel_invitation(
    invitation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Cancel a pending invitation (Phase 8.2).

    - Only inviter or invitee can cancel
    - Invitation must be in 'pending' status
    - Updates status to 'cancelled'
    """
    invitation = labeler_db.query(Invitation).filter(
        Invitation.id == invitation_id,
    ).first()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Check if current user is inviter or invitee
    if invitation.inviter_id != current_user.id and invitation.invitee_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You can only cancel invitations you sent or received"
        )

    # Check status
    if invitation.status != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel invitation with status '{invitation.status}'"
        )

    # Update status
    invitation.status = "cancelled"
    invitation.cancelled_at = datetime.utcnow()
    labeler_db.commit()

    return enrich_invitation(invitation, labeler_db)
