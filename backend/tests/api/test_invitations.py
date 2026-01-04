"""
Tests for invitation endpoints.

Tests the invitation-related endpoints including:
- POST /invitations - Create new invitation
- GET /invitations - List invitations (sent/received)
- POST /invitations/accept - Accept invitation
- POST /invitations/{invitation_id}/cancel - Cancel invitation

Tests cover invitation workflow: creation, listing, acceptance, rejection, expiration,
and email notification triggers.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime, timedelta

from app.core.security import get_current_user
from app.db.models.labeler import (
    Invitation,
    AnnotationProject,
    ProjectPermission,
)
from app.main import app


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def create_invitation(labeler_db):
    """Factory fixture to create test invitations."""
    def _create_invitation(
        project_id: str = "ds_test_project",
        inviter_id: str = "test-user-123",
        invitee_id: str = "invitee-user-456",
        invitee_email: str = "invitee@example.com",
        role: str = "annotator",
        status: str = "pending",
        token: str = None,
        expires_at: datetime = None,
        accepted_at: datetime = None,
        cancelled_at: datetime = None,
        message: str = None,
    ) -> Invitation:
        """Create a test invitation with custom parameters."""
        if token is None:
            import secrets
            token = secrets.token_urlsafe(32)

        if expires_at is None:
            expires_at = datetime.utcnow() + timedelta(days=7)

        invitation = Invitation(
            token=token,
            project_id=project_id,
            inviter_id=inviter_id,
            invitee_id=invitee_id,
            invitee_email=invitee_email,
            role=role,
            status=status,
            message=message,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
            accepted_at=accepted_at,
            cancelled_at=cancelled_at,
        )

        labeler_db.add(invitation)
        labeler_db.commit()
        labeler_db.refresh(invitation)

        return invitation

    return _create_invitation


# =============================================================================
# Test CreateInvitation Endpoint
# =============================================================================

class TestCreateInvitation:
    """Test cases for POST /api/v1/invitations endpoint."""

    def test_create_invitation_not_implemented(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
    ):
        """
        Test that create invitation returns 501 (Not Implemented).

        Currently disabled due to User DB being removed.
        Should return 501 with appropriate message.
        """
        request_data = {
            "project_id": test_project.dataset_id,
            "invitee_user_id": "invitee-user-456",
            "role": "annotator"
        }

        response = authenticated_client.post(
            "/api/v1/invitations",
            json=request_data
        )

        assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED
        data = response.json()
        assert "User DB" in data["detail"] or "Keycloak" in data["detail"]

    def test_create_invitation_project_not_found(
        self,
        authenticated_client,
        labeler_db,
        mock_current_user,
    ):
        """
        Test create invitation with non-existent project.

        Should return 404 when project doesn't exist.
        """
        request_data = {
            "project_id": "ds_nonexistent",
            "invitee_user_id": "invitee-user-456",
            "role": "annotator"
        }

        response = authenticated_client.post(
            "/api/v1/invitations",
            json=request_data
        )

        # Should hit project not found check before 501
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Project not found" in response.json()["detail"]

    def test_create_invitation_requires_admin_permission(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
    ):
        """
        Test create invitation requires admin or owner permission.

        Should return 403 when user is not owner or admin.
        """
        # Change user's permission to viewer
        permission = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == test_project.id,
            ProjectPermission.user_id == mock_current_user["sub"]
        ).first()
        permission.role = "viewer"
        labeler_db.commit()

        request_data = {
            "project_id": test_project.dataset_id,
            "invitee_user_id": "invitee-user-456",
            "role": "annotator"
        }

        response = authenticated_client.post(
            "/api/v1/invitations",
            json=request_data
        )

        # Should hit permission check before 501
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "owners and admins" in response.json()["detail"]

    def test_create_invitation_unauthenticated(
        self,
        client,
        test_project,
    ):
        """
        Test create invitation without authentication.

        Should return 403 when user is not authenticated.
        """
        request_data = {
            "project_id": test_project.dataset_id,
            "invitee_user_id": "invitee-user-456",
            "role": "annotator"
        }

        response = client.post(
            "/api/v1/invitations",
            json=request_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test ListInvitations Endpoint
# =============================================================================

class TestListInvitations:
    """Test cases for GET /api/v1/invitations endpoint."""

    def test_list_received_invitations_empty(
        self,
        authenticated_client,
        labeler_db,
        mock_current_user,
    ):
        """
        Test listing received invitations when there are none.

        Should return empty list.
        """
        response = authenticated_client.get(
            "/api/v1/invitations?type=received"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["invitations"] == []
        assert data["total"] == 0

    def test_list_sent_invitations_empty(
        self,
        authenticated_client,
        labeler_db,
        mock_current_user,
    ):
        """
        Test listing sent invitations when there are none.

        Should return empty list.
        """
        response = authenticated_client.get(
            "/api/v1/invitations?type=sent"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["invitations"] == []
        assert data["total"] == 0

    def test_list_received_invitations_with_data(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test listing received invitations.

        Should return invitations where current user is invitee.
        """
        # Create invitation for current user
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="other-user-789",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="annotator",
            status="pending"
        )

        response = authenticated_client.get(
            "/api/v1/invitations?type=received"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert len(data["invitations"]) == 1

        inv = data["invitations"][0]
        assert inv["id"] == invitation.id
        assert inv["invitee_user_id"] == mock_current_user["sub"]
        assert inv["invitee_email"] == mock_current_user["email"]
        assert inv["role"] == "annotator"
        assert inv["status"] == "pending"
        assert inv["token"] is None  # Token only shown when creating
        assert "created_at" in inv
        assert "expires_at" in inv

    def test_list_sent_invitations_with_data(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test listing sent invitations.

        Should return invitations where current user is inviter.
        """
        # Create invitation sent by current user
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="other-user-789",
            invitee_email="other@example.com",
            role="reviewer",
            status="pending"
        )

        response = authenticated_client.get(
            "/api/v1/invitations?type=sent"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert len(data["invitations"]) == 1

        inv = data["invitations"][0]
        assert inv["id"] == invitation.id
        assert inv["inviter_user_id"] == mock_current_user["sub"]
        assert inv["invitee_email"] == "other@example.com"
        assert inv["role"] == "reviewer"
        assert inv["status"] == "pending"

    def test_list_invitations_filter_by_status(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test listing invitations with status filter.

        Should only return invitations matching the status.
        """
        # Create invitations with different statuses
        create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user1",
            invitee_email="user1@example.com",
            status="pending"
        )
        create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user2",
            invitee_email="user2@example.com",
            status="accepted",
            accepted_at=datetime.utcnow()
        )
        create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user3",
            invitee_email="user3@example.com",
            status="cancelled",
            cancelled_at=datetime.utcnow()
        )

        # Filter by pending
        response = authenticated_client.get(
            "/api/v1/invitations?type=sent&status=pending"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["invitations"][0]["status"] == "pending"

        # Filter by accepted
        response = authenticated_client.get(
            "/api/v1/invitations?type=sent&status=accepted"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["invitations"][0]["status"] == "accepted"

        # Filter by cancelled
        response = authenticated_client.get(
            "/api/v1/invitations?type=sent&status=cancelled"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["invitations"][0]["status"] == "cancelled"

    def test_list_invitations_filter_by_project(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
        create_project,
    ):
        """
        Test listing invitations with project filter.

        Should only return invitations for the specified project.
        """
        # Create another project
        other_project = create_project(
            labeler_db,
            name="Other Project",
            dataset_id="ds_other",
            owner_id=mock_current_user["sub"]
        )

        # Create invitations for different projects
        inv1 = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user1",
            invitee_email="user1@example.com"
        )
        inv2 = create_invitation(
            project_id=other_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user2",
            invitee_email="user2@example.com"
        )

        # Filter by test_project
        response = authenticated_client.get(
            f"/api/v1/invitations?type=sent&project_id={test_project.dataset_id}"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["invitations"][0]["project_id"] == test_project.dataset_id

        # Filter by other_project
        response = authenticated_client.get(
            f"/api/v1/invitations?type=sent&project_id={other_project.dataset_id}"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["invitations"][0]["project_id"] == other_project.dataset_id

    def test_list_invitations_multiple_filters(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test listing invitations with multiple filters combined.

        Should return invitations matching all filters.
        """
        # Create various invitations
        create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user1",
            invitee_email="user1@example.com",
            status="pending"
        )
        create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user2",
            invitee_email="user2@example.com",
            status="accepted",
            accepted_at=datetime.utcnow()
        )
        create_invitation(
            project_id="ds_other_project",
            inviter_id=mock_current_user["sub"],
            invitee_id="user3",
            invitee_email="user3@example.com",
            status="pending"
        )

        # Filter by project and status
        response = authenticated_client.get(
            f"/api/v1/invitations?type=sent&project_id={test_project.dataset_id}&status=pending"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["invitations"][0]["status"] == "pending"
        assert data["invitations"][0]["project_id"] == test_project.dataset_id

    def test_list_invitations_ordered_by_created_at_desc(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test that invitations are ordered by created_at descending.

        Should return newest invitations first.
        """
        # Create invitations with different timestamps
        import time

        inv1 = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user1",
            invitee_email="user1@example.com"
        )

        time.sleep(0.01)  # Small delay to ensure different timestamps

        inv2 = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user2",
            invitee_email="user2@example.com"
        )

        time.sleep(0.01)

        inv3 = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user3",
            invitee_email="user3@example.com"
        )

        response = authenticated_client.get(
            "/api/v1/invitations?type=sent"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 3

        # Should be ordered newest first
        assert data["invitations"][0]["id"] == inv3.id
        assert data["invitations"][1]["id"] == inv2.id
        assert data["invitations"][2]["id"] == inv1.id

    def test_list_invitations_invalid_type(
        self,
        authenticated_client,
        labeler_db,
        mock_current_user,
    ):
        """
        Test listing invitations with invalid type parameter.

        Should return 400 when type is not 'sent' or 'received'.
        """
        response = authenticated_client.get(
            "/api/v1/invitations?type=invalid"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid type" in response.json()["detail"]

    def test_list_invitations_unauthenticated(
        self,
        client,
    ):
        """
        Test listing invitations without authentication.

        Should return 403 when user is not authenticated.
        """
        response = client.get(
            "/api/v1/invitations?type=received"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_invitations_with_enriched_fields(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test that invitations include enriched fields.

        Should include project_name when project exists.
        """
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="user1",
            invitee_email="user1@example.com"
        )

        response = authenticated_client.get(
            "/api/v1/invitations?type=sent"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1

        inv = data["invitations"][0]
        # Project name should be enriched
        assert inv["project_name"] == test_project.name
        # User names currently None (User DB disabled)
        assert inv["inviter_name"] is None
        assert inv["invitee_name"] is None


# =============================================================================
# Test AcceptInvitation Endpoint
# =============================================================================

class TestAcceptInvitation:
    """Test cases for POST /api/v1/invitations/accept endpoint."""

    def test_accept_invitation_success(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test successfully accepting an invitation.

        Should create ProjectPermission and update invitation status.
        """
        # Create invitation for current user
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="inviter-user-789",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="annotator",
            status="pending"
        )

        response = authenticated_client.post(
            "/api/v1/invitations/accept",
            json={"token": invitation.token}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response
        assert data["message"] == "Invitation accepted successfully"
        assert data["project_id"] == test_project.dataset_id
        assert data["role"] == "annotator"
        assert "permission_id" in data

        # Verify permission was created
        permission = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.id == data["permission_id"]
        ).first()
        assert permission is not None
        assert permission.project_id == test_project.id
        assert permission.user_id == mock_current_user["sub"]
        assert permission.role == "annotator"
        assert permission.granted_by == "inviter-user-789"

        # Verify invitation status updated
        labeler_db.refresh(invitation)
        assert invitation.status == "accepted"
        assert invitation.accepted_at is not None

    def test_accept_invitation_invalid_token(
        self,
        authenticated_client,
        labeler_db,
        mock_current_user,
    ):
        """
        Test accepting invitation with invalid token.

        Should return 404 when token doesn't exist.
        """
        response = authenticated_client.post(
            "/api/v1/invitations/accept",
            json={"token": "invalid-token-xyz"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Invalid invitation token" in response.json()["detail"]

    def test_accept_invitation_wrong_user(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test accepting invitation intended for another user.

        Should return 403 when invitation is not for current user.
        """
        # Create invitation for different user
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="inviter-user-789",
            invitee_id="other-user-456",
            invitee_email="other@example.com",
            role="annotator",
            status="pending"
        )

        response = authenticated_client.post(
            "/api/v1/invitations/accept",
            json={"token": invitation.token}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "not for you" in response.json()["detail"]

    def test_accept_invitation_already_accepted(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test accepting an already accepted invitation.

        Should return 400 when invitation is not pending.
        """
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="inviter-user-789",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="annotator",
            status="accepted",
            accepted_at=datetime.utcnow()
        )

        response = authenticated_client.post(
            "/api/v1/invitations/accept",
            json={"token": invitation.token}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already accepted" in response.json()["detail"]

    def test_accept_invitation_already_cancelled(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test accepting a cancelled invitation.

        Should return 400 when invitation was cancelled.
        """
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="inviter-user-789",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="annotator",
            status="cancelled",
            cancelled_at=datetime.utcnow()
        )

        response = authenticated_client.post(
            "/api/v1/invitations/accept",
            json={"token": invitation.token}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already cancelled" in response.json()["detail"]

    def test_accept_invitation_expired(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test accepting an expired invitation.

        Should return 400 and mark invitation as expired.
        """
        # Create invitation that expired 1 day ago
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="inviter-user-789",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="annotator",
            status="pending",
            expires_at=datetime.utcnow() - timedelta(days=1)
        )

        response = authenticated_client.post(
            "/api/v1/invitations/accept",
            json={"token": invitation.token}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "expired" in response.json()["detail"]

        # Verify invitation status updated to expired
        labeler_db.refresh(invitation)
        assert invitation.status == "expired"

    def test_accept_invitation_project_not_found(
        self,
        authenticated_client,
        labeler_db,
        mock_current_user,
        create_invitation,
    ):
        """
        Test accepting invitation when project no longer exists.

        Should return 404 when project was deleted.
        """
        invitation = create_invitation(
            project_id="ds_nonexistent_project",
            inviter_id="inviter-user-789",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="annotator",
            status="pending"
        )

        response = authenticated_client.post(
            "/api/v1/invitations/accept",
            json={"token": invitation.token}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Project not found" in response.json()["detail"]

    def test_accept_invitation_creates_correct_role(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test that accepting invitation creates permission with correct role.

        Should support all role types: viewer, annotator, reviewer, admin.
        """
        roles = ["viewer", "annotator", "reviewer", "admin"]

        for role in roles:
            # Create invitation with specific role
            invitation = create_invitation(
                project_id=test_project.dataset_id,
                inviter_id="inviter-user-789",
                invitee_id=mock_current_user["sub"],
                invitee_email=mock_current_user["email"],
                role=role,
                status="pending",
                token=f"token-{role}"
            )

            response = authenticated_client.post(
                "/api/v1/invitations/accept",
                json={"token": invitation.token}
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["role"] == role

            # Verify permission role
            permission = labeler_db.query(ProjectPermission).filter(
                ProjectPermission.id == data["permission_id"]
            ).first()
            assert permission.role == role

            # Clean up for next iteration
            labeler_db.delete(permission)
            labeler_db.commit()

    def test_accept_invitation_unauthenticated(
        self,
        client,
        create_invitation,
        labeler_db,
    ):
        """
        Test accepting invitation without authentication.

        Should return 403 when user is not authenticated.
        """
        invitation = create_invitation()

        response = client.post(
            "/api/v1/invitations/accept",
            json={"token": invitation.token}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test CancelInvitation Endpoint
# =============================================================================

class TestCancelInvitation:
    """Test cases for POST /api/v1/invitations/{invitation_id}/cancel endpoint."""

    def test_cancel_invitation_by_inviter(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test successfully canceling invitation as inviter.

        Should update invitation status to cancelled.
        """
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="invitee-user-456",
            invitee_email="invitee@example.com",
            role="annotator",
            status="pending"
        )

        response = authenticated_client.post(
            f"/api/v1/invitations/{invitation.id}/cancel"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response
        assert data["id"] == invitation.id
        assert data["status"] == "cancelled"
        assert data["cancelled_at"] is not None

        # Verify database updated
        labeler_db.refresh(invitation)
        assert invitation.status == "cancelled"
        assert invitation.cancelled_at is not None

    def test_cancel_invitation_by_invitee(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test successfully canceling invitation as invitee (rejecting).

        Should update invitation status to cancelled.
        """
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="inviter-user-789",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="annotator",
            status="pending"
        )

        response = authenticated_client.post(
            f"/api/v1/invitations/{invitation.id}/cancel"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["status"] == "cancelled"

        # Verify database updated
        labeler_db.refresh(invitation)
        assert invitation.status == "cancelled"

    def test_cancel_invitation_not_found(
        self,
        authenticated_client,
        labeler_db,
        mock_current_user,
    ):
        """
        Test canceling non-existent invitation.

        Should return 404 when invitation doesn't exist.
        """
        response = authenticated_client.post(
            "/api/v1/invitations/99999/cancel"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "Invitation not found" in response.json()["detail"]

    def test_cancel_invitation_unauthorized(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test canceling invitation by unauthorized user.

        Should return 403 when user is neither inviter nor invitee.
        """
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="other-inviter-123",
            invitee_id="other-invitee-456",
            invitee_email="invitee@example.com",
            role="annotator",
            status="pending"
        )

        response = authenticated_client.post(
            f"/api/v1/invitations/{invitation.id}/cancel"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "sent or received" in response.json()["detail"]

    def test_cancel_invitation_already_accepted(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test canceling an already accepted invitation.

        Should return 400 when invitation is not pending.
        """
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="invitee-user-456",
            invitee_email="invitee@example.com",
            role="annotator",
            status="accepted",
            accepted_at=datetime.utcnow()
        )

        response = authenticated_client.post(
            f"/api/v1/invitations/{invitation.id}/cancel"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Cannot cancel" in response.json()["detail"]
        assert "accepted" in response.json()["detail"]

    def test_cancel_invitation_already_cancelled(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test canceling an already cancelled invitation.

        Should return 400 when invitation is already cancelled.
        """
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="invitee-user-456",
            invitee_email="invitee@example.com",
            role="annotator",
            status="cancelled",
            cancelled_at=datetime.utcnow()
        )

        response = authenticated_client.post(
            f"/api/v1/invitations/{invitation.id}/cancel"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Cannot cancel" in response.json()["detail"]

    def test_cancel_invitation_already_expired(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test canceling an expired invitation.

        Should return 400 when invitation has expired.
        """
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id=mock_current_user["sub"],
            invitee_id="invitee-user-456",
            invitee_email="invitee@example.com",
            role="annotator",
            status="expired",
            expires_at=datetime.utcnow() - timedelta(days=1)
        )

        response = authenticated_client.post(
            f"/api/v1/invitations/{invitation.id}/cancel"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Cannot cancel" in response.json()["detail"]

    def test_cancel_invitation_unauthenticated(
        self,
        client,
        create_invitation,
        labeler_db,
    ):
        """
        Test canceling invitation without authentication.

        Should return 403 when user is not authenticated.
        """
        invitation = create_invitation()

        response = client.post(
            f"/api/v1/invitations/{invitation.id}/cancel"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test Invitation Workflow Integration
# =============================================================================

class TestInvitationWorkflow:
    """Integration tests for complete invitation workflows."""

    def test_full_invitation_workflow_acceptance(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test complete invitation acceptance workflow.

        Create -> List (received) -> Accept -> Verify permission created.
        """
        # Step 1: Create invitation (simulate another user inviting current user)
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="inviter-user-789",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="reviewer",
            status="pending"
        )

        # Step 2: List received invitations
        response = authenticated_client.get(
            "/api/v1/invitations?type=received&status=pending"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["invitations"][0]["status"] == "pending"

        # Step 3: Accept invitation
        response = authenticated_client.post(
            "/api/v1/invitations/accept",
            json={"token": invitation.token}
        )
        assert response.status_code == status.HTTP_200_OK
        accept_data = response.json()
        assert accept_data["role"] == "reviewer"

        # Step 4: Verify invitation no longer appears in pending list
        response = authenticated_client.get(
            "/api/v1/invitations?type=received&status=pending"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 0

        # Step 5: Verify invitation appears in accepted list
        response = authenticated_client.get(
            "/api/v1/invitations?type=received&status=accepted"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["invitations"][0]["status"] == "accepted"

    def test_full_invitation_workflow_rejection(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test complete invitation rejection workflow.

        Create -> List (received) -> Cancel (reject) -> Verify status.
        """
        # Step 1: Create invitation
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="inviter-user-789",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="annotator",
            status="pending"
        )

        # Step 2: List received invitations
        response = authenticated_client.get(
            "/api/v1/invitations?type=received"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1

        # Step 3: Reject invitation (cancel as invitee)
        response = authenticated_client.post(
            f"/api/v1/invitations/{invitation.id}/cancel"
        )
        assert response.status_code == status.HTTP_200_OK

        # Step 4: Verify invitation appears in cancelled list
        response = authenticated_client.get(
            "/api/v1/invitations?type=received&status=cancelled"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["invitations"][0]["status"] == "cancelled"

    def test_invitation_expiration_workflow(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
    ):
        """
        Test invitation expiration handling.

        Create expired invitation -> Try to accept -> Should fail with expired status.
        """
        # Create expired invitation
        invitation = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="inviter-user-789",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="annotator",
            status="pending",
            expires_at=datetime.utcnow() - timedelta(hours=1)
        )

        # Try to accept expired invitation
        response = authenticated_client.post(
            "/api/v1/invitations/accept",
            json={"token": invitation.token}
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "expired" in response.json()["detail"]

        # Verify invitation status updated to expired
        labeler_db.refresh(invitation)
        assert invitation.status == "expired"

        # Verify it appears in expired list
        response = authenticated_client.get(
            "/api/v1/invitations?type=received&status=expired"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert data["invitations"][0]["status"] == "expired"

    def test_multiple_invitations_same_user_different_projects(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
        create_invitation,
        create_project,
    ):
        """
        Test user receiving invitations to multiple projects.

        Should be able to manage invitations for different projects independently.
        """
        # Create another project
        project2 = create_project(
            labeler_db,
            name="Project 2",
            dataset_id="ds_project2",
            owner_id="other-owner-123"
        )

        # Create invitations to different projects
        inv1 = create_invitation(
            project_id=test_project.dataset_id,
            inviter_id="inviter1",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="annotator"
        )
        inv2 = create_invitation(
            project_id=project2.dataset_id,
            inviter_id="inviter2",
            invitee_id=mock_current_user["sub"],
            invitee_email=mock_current_user["email"],
            role="reviewer"
        )

        # List all received invitations
        response = authenticated_client.get(
            "/api/v1/invitations?type=received"
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 2

        # Accept first invitation
        response = authenticated_client.post(
            "/api/v1/invitations/accept",
            json={"token": inv1.token}
        )
        assert response.status_code == status.HTTP_200_OK

        # Cancel second invitation
        response = authenticated_client.post(
            f"/api/v1/invitations/{inv2.id}/cancel"
        )
        assert response.status_code == status.HTTP_200_OK

        # Verify states
        response = authenticated_client.get(
            "/api/v1/invitations?type=received&status=accepted"
        )
        assert response.json()["total"] == 1

        response = authenticated_client.get(
            "/api/v1/invitations?type=received&status=cancelled"
        )
        assert response.json()["total"] == 1
