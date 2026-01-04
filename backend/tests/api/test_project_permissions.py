"""
Tests for project permission endpoints.

Tests the project permission-related endpoints including:
- GET /{project_id}/permissions - List project permissions
- POST /{project_id}/permissions - Add project member
- PATCH /{project_id}/permissions/{user_id} - Update member role
- DELETE /{project_id}/permissions/{user_id} - Remove member
- POST /{project_id}/transfer-ownership - Transfer ownership

Tests cover unified RBAC with 5 roles: owner, admin, reviewer, annotator, viewer
"""

import pytest
from unittest.mock import patch
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime

from app.core.security import get_current_user, require_project_permission
from app.db.models.labeler import (
    AnnotationProject,
    ProjectPermission,
)
from app.main import app


class TestListProjectPermissions:
    """Test cases for GET /api/v1/projects/{project_id}/permissions endpoint."""

    def test_list_permissions_success(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
    ):
        """
        Test listing permissions for a project.

        Should return all permissions including the owner.
        """
        response = authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/permissions"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should have at least the owner permission
        assert len(data) >= 1
        owner_perm = next((p for p in data if p["role"] == "owner"), None)
        assert owner_perm is not None
        assert owner_perm["user_id"] == mock_current_user["sub"]
        assert owner_perm["project_id"] == test_project.id
        assert "granted_at" in owner_perm
        assert "granted_by" in owner_perm

    def test_list_permissions_multiple_members(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """
        Test listing permissions with multiple members.

        Should return all members with different roles.
        """
        # Add additional members with different roles
        admin_perm = create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id="admin-user-id",
            role="admin",
        )
        reviewer_perm = create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id="reviewer-user-id",
            role="reviewer",
        )
        annotator_perm = create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id="annotator-user-id",
            role="annotator",
        )
        viewer_perm = create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id="viewer-user-id",
            role="viewer",
        )

        response = authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/permissions"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should have owner + 4 additional members = 5 total
        assert len(data) == 5

        # Verify all roles are present
        roles = {p["role"] for p in data}
        assert roles == {"owner", "admin", "reviewer", "annotator", "viewer"}

        # Verify structure of permissions
        for perm in data:
            assert "id" in perm
            assert "project_id" in perm
            assert "user_id" in perm
            assert "role" in perm
            assert "granted_by" in perm
            assert "granted_at" in perm

    def test_list_permissions_with_dataset_id(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        test_dataset,
    ):
        """
        Test listing permissions using dataset_id (ds_xxx format).

        Should work with both project_id and dataset_id.
        """
        response = authenticated_client.get(
            f"/api/v1/projects/{test_dataset.id}/permissions"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should find the project by dataset_id and return permissions
        assert len(data) >= 1
        owner_perm = next((p for p in data if p["role"] == "owner"), None)
        assert owner_perm is not None

    def test_list_permissions_unauthenticated(self, client, test_project):
        """
        Test listing permissions without authentication.

        Should return 403 Forbidden.
        """
        response = client.get(f"/api/v1/projects/{test_project.id}/permissions")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_permissions_no_access(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        create_dataset,
        mock_current_user,
    ):
        """
        Test listing permissions for a project without access.

        Should return 403 Forbidden when user has no permission.
        """
        # Create a dataset and project owned by a different user
        other_dataset = create_dataset(
            labeler_db,
            dataset_id="ds_other",
            name="Other Dataset",
            owner_id="other-user-id",
        )
        other_project = create_project(
            labeler_db,
            project_id="proj_other",
            name="Other Project",
            dataset_id=other_dataset.id,
            owner_id="other-user-id",
        )

        response = authenticated_client.get(
            f"/api/v1/projects/{other_project.id}/permissions"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_permissions_empty_list(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test listing permissions returns empty list if all removed.

        Should return empty array if no permissions exist.
        """
        # Remove all permissions for testing
        labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == test_project.id
        ).delete()
        labeler_db.commit()

        # Need to override permission check since we removed all permissions
        def mock_permission_check():
            return True

        app.dependency_overrides[require_project_permission("viewer")] = (
            mock_permission_check
        )

        try:
            response = authenticated_client.get(
                f"/api/v1/projects/{test_project.id}/permissions"
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data == []
        finally:
            # Clean up override
            if require_project_permission("viewer") in app.dependency_overrides:
                del app.dependency_overrides[require_project_permission("viewer")]


class TestAddProjectMember:
    """Test cases for POST /api/v1/projects/{project_id}/permissions endpoint."""

    def test_add_member_service_unavailable(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test adding a member when user DB is not available.

        Should return 503 Service Unavailable since user lookup by email
        is not possible without user database.
        """
        request_data = {
            "user_email": "newuser@example.com",
            "role": "annotator",
        }

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/permissions",
            json=request_data,
        )

        assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
        data = response.json()
        assert "User database is not configured" in data["detail"]

    def test_add_member_unauthenticated(self, client, test_project):
        """
        Test adding a member without authentication.

        Should return 403 Forbidden.
        """
        request_data = {
            "user_email": "newuser@example.com",
            "role": "annotator",
        }

        response = client.post(
            f"/api/v1/projects/{test_project.id}/permissions",
            json=request_data,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_add_member_no_admin_permission(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        create_dataset,
        create_project_permission,
        mock_current_user,
    ):
        """
        Test adding a member without admin permission.

        Should return 403 Forbidden when user is not admin or owner.
        """
        # Create a project where current user is only a viewer
        other_dataset = create_dataset(
            labeler_db,
            dataset_id="ds_viewer_test",
            name="Viewer Test Dataset",
            owner_id="other-user-id",
        )
        other_project = create_project(
            labeler_db,
            project_id="proj_viewer_test",
            name="Viewer Test Project",
            dataset_id=other_dataset.id,
            owner_id="other-user-id",
        )

        # Give current user viewer permission only
        create_project_permission(
            labeler_db,
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="viewer",
        )

        request_data = {
            "user_email": "newuser@example.com",
            "role": "annotator",
        }

        response = authenticated_client.post(
            f"/api/v1/projects/{other_project.id}/permissions",
            json=request_data,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_add_member_project_not_found(
        self,
        authenticated_client,
        labeler_db,
    ):
        """
        Test adding a member to non-existent project.

        Should return 404 Not Found.
        """
        # Override permission check to pass, so we can test project not found
        def mock_permission_check():
            return True

        app.dependency_overrides[require_project_permission("admin")] = (
            mock_permission_check
        )

        try:
            request_data = {
                "user_email": "newuser@example.com",
                "role": "annotator",
            }

            response = authenticated_client.post(
                "/api/v1/projects/proj_nonexistent/permissions",
                json=request_data,
            )

            assert response.status_code == status.HTTP_404_NOT_FOUND
            data = response.json()
            assert "not found" in data["detail"].lower()
        finally:
            # Clean up override
            if require_project_permission("admin") in app.dependency_overrides:
                del app.dependency_overrides[require_project_permission("admin")]


class TestUpdateProjectMemberRole:
    """Test cases for PATCH /api/v1/projects/{project_id}/permissions/{user_id} endpoint."""

    def test_update_role_success(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """
        Test successfully updating a member's role.

        Should update the role and return updated permission.
        """
        # Create a member with viewer role
        member_id = "member-user-id"
        permission = create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=member_id,
            role="viewer",
        )

        # Update to annotator
        request_data = {"role": "annotator"}

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/permissions/{member_id}",
            json=request_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["role"] == "annotator"
        assert data["user_id"] == member_id
        assert data["project_id"] == test_project.id

        # Verify in database
        updated_perm = (
            labeler_db.query(ProjectPermission)
            .filter(
                ProjectPermission.project_id == test_project.id,
                ProjectPermission.user_id == member_id,
            )
            .first()
        )
        assert updated_perm.role == "annotator"

    def test_update_role_viewer_to_annotator(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """Test promoting viewer to annotator."""
        member_id = "viewer-user-id"
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=member_id,
            role="viewer",
        )

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/permissions/{member_id}",
            json={"role": "annotator"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["role"] == "annotator"

    def test_update_role_annotator_to_reviewer(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """Test promoting annotator to reviewer."""
        member_id = "annotator-user-id"
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=member_id,
            role="annotator",
        )

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/permissions/{member_id}",
            json={"role": "reviewer"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["role"] == "reviewer"

    def test_update_role_reviewer_to_admin(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """Test promoting reviewer to admin."""
        member_id = "reviewer-user-id"
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=member_id,
            role="reviewer",
        )

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/permissions/{member_id}",
            json={"role": "admin"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["role"] == "admin"

    def test_update_role_admin_to_viewer(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """Test demoting admin to viewer."""
        member_id = "admin-user-id"
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=member_id,
            role="admin",
        )

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/permissions/{member_id}",
            json={"role": "viewer"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["role"] == "viewer"

    def test_update_role_cannot_change_owner(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
    ):
        """
        Test that owner role cannot be changed via update endpoint.

        Should return 400 Bad Request.
        """
        # Try to change owner's role (owner is the current user)
        request_data = {"role": "admin"}

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/permissions/{mock_current_user['sub']}",
            json=request_data,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Cannot change owner role" in data["detail"]

    def test_update_role_cannot_promote_to_owner(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """
        Test that members cannot be promoted to owner via update endpoint.

        Should return 400 Bad Request.
        """
        member_id = "admin-user-id"
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=member_id,
            role="admin",
        )

        request_data = {"role": "owner"}

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/permissions/{member_id}",
            json=request_data,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Cannot promote to owner" in data["detail"]

    def test_update_role_permission_not_found(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test updating role for non-existent permission.

        Should return 404 Not Found.
        """
        request_data = {"role": "admin"}

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/permissions/nonexistent-user-id",
            json=request_data,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "does not have access" in data["detail"].lower()

    def test_update_role_unauthenticated(self, client, test_project):
        """
        Test updating role without authentication.

        Should return 403 Forbidden.
        """
        request_data = {"role": "admin"}

        response = client.patch(
            f"/api/v1/projects/{test_project.id}/permissions/some-user-id",
            json=request_data,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_role_no_admin_permission(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        create_dataset,
        create_project_permission,
        mock_current_user,
    ):
        """
        Test updating role without admin permission.

        Should return 403 Forbidden when user is not admin or owner.
        """
        # Create a project where current user is only a viewer
        other_dataset = create_dataset(
            labeler_db,
            dataset_id="ds_viewer_update",
            name="Viewer Update Dataset",
            owner_id="other-user-id",
        )
        other_project = create_project(
            labeler_db,
            project_id="proj_viewer_update",
            name="Viewer Update Project",
            dataset_id=other_dataset.id,
            owner_id="other-user-id",
        )

        # Give current user viewer permission only
        create_project_permission(
            labeler_db,
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="viewer",
        )

        # Create another member to try to update
        member_id = "member-user-id"
        create_project_permission(
            labeler_db,
            project_id=other_project.id,
            user_id=member_id,
            role="annotator",
        )

        request_data = {"role": "reviewer"}

        response = authenticated_client.patch(
            f"/api/v1/projects/{other_project.id}/permissions/{member_id}",
            json=request_data,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_role_with_dataset_id(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        test_dataset,
        create_project_permission,
    ):
        """
        Test updating role using dataset_id (ds_xxx format).

        Should work with both project_id and dataset_id.
        """
        member_id = "member-user-id"
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=member_id,
            role="viewer",
        )

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_dataset.id}/permissions/{member_id}",
            json={"role": "annotator"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["role"] == "annotator"


class TestRemoveProjectMember:
    """Test cases for DELETE /api/v1/projects/{project_id}/permissions/{user_id} endpoint."""

    def test_remove_member_success(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """
        Test successfully removing a member from a project.

        Should delete the permission and return 204 No Content.
        """
        member_id = "member-user-id"
        permission = create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=member_id,
            role="annotator",
        )

        response = authenticated_client.delete(
            f"/api/v1/projects/{test_project.id}/permissions/{member_id}"
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify permission was deleted
        deleted_perm = (
            labeler_db.query(ProjectPermission)
            .filter(
                ProjectPermission.project_id == test_project.id,
                ProjectPermission.user_id == member_id,
            )
            .first()
        )
        assert deleted_perm is None

    def test_remove_member_cannot_remove_owner(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
    ):
        """
        Test that owner cannot be removed.

        Should return 400 Bad Request.
        """
        response = authenticated_client.delete(
            f"/api/v1/projects/{test_project.id}/permissions/{mock_current_user['sub']}"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Cannot remove project owner" in data["detail"]

    def test_remove_member_cannot_remove_self(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        create_dataset,
        create_project_permission,
        mock_current_user,
    ):
        """
        Test that user cannot remove themselves.

        Should return 400 Bad Request.
        """
        # Create a project where current user is admin (not owner)
        other_dataset = create_dataset(
            labeler_db,
            dataset_id="ds_self_remove",
            name="Self Remove Dataset",
            owner_id="other-user-id",
        )
        other_project = create_project(
            labeler_db,
            project_id="proj_self_remove",
            name="Self Remove Project",
            dataset_id=other_dataset.id,
            owner_id="other-user-id",
        )

        # Give current user admin permission
        create_project_permission(
            labeler_db,
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="admin",
        )

        response = authenticated_client.delete(
            f"/api/v1/projects/{other_project.id}/permissions/{mock_current_user['sub']}"
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "cannot remove yourself" in data["detail"].lower()

    def test_remove_member_permission_not_found(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test removing non-existent permission.

        Should return 404 Not Found.
        """
        response = authenticated_client.delete(
            f"/api/v1/projects/{test_project.id}/permissions/nonexistent-user-id"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "does not have access" in data["detail"].lower()

    def test_remove_member_unauthenticated(self, client, test_project):
        """
        Test removing member without authentication.

        Should return 403 Forbidden.
        """
        response = client.delete(
            f"/api/v1/projects/{test_project.id}/permissions/some-user-id"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_remove_member_no_admin_permission(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        create_dataset,
        create_project_permission,
        mock_current_user,
    ):
        """
        Test removing member without admin permission.

        Should return 403 Forbidden when user is not admin or owner.
        """
        # Create a project where current user is only a viewer
        other_dataset = create_dataset(
            labeler_db,
            dataset_id="ds_viewer_remove",
            name="Viewer Remove Dataset",
            owner_id="other-user-id",
        )
        other_project = create_project(
            labeler_db,
            project_id="proj_viewer_remove",
            name="Viewer Remove Project",
            dataset_id=other_dataset.id,
            owner_id="other-user-id",
        )

        # Give current user viewer permission only
        create_project_permission(
            labeler_db,
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="viewer",
        )

        # Create another member to try to remove
        member_id = "member-user-id"
        create_project_permission(
            labeler_db,
            project_id=other_project.id,
            user_id=member_id,
            role="annotator",
        )

        response = authenticated_client.delete(
            f"/api/v1/projects/{other_project.id}/permissions/{member_id}"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_remove_member_with_dataset_id(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        test_dataset,
        create_project_permission,
    ):
        """
        Test removing member using dataset_id (ds_xxx format).

        Should work with both project_id and dataset_id.
        """
        member_id = "member-user-id"
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=member_id,
            role="annotator",
        )

        response = authenticated_client.delete(
            f"/api/v1/projects/{test_dataset.id}/permissions/{member_id}"
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify permission was deleted
        deleted_perm = (
            labeler_db.query(ProjectPermission)
            .filter(
                ProjectPermission.project_id == test_project.id,
                ProjectPermission.user_id == member_id,
            )
            .first()
        )
        assert deleted_perm is None


class TestTransferProjectOwnership:
    """Test cases for POST /api/v1/projects/{project_id}/transfer-ownership endpoint."""

    def test_transfer_ownership_success(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
        mock_current_user,
    ):
        """
        Test successfully transferring project ownership.

        Should transfer ownership and demote current owner to admin.
        """
        # Create a member who will become the new owner
        new_owner_id = "new-owner-user-id"
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=new_owner_id,
            role="admin",
        )

        request_data = {"new_owner_user_id": new_owner_id}

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/transfer-ownership",
            json=request_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["message"] == "Ownership transferred successfully"
        assert data["new_owner_user_id"] == new_owner_id
        assert data["previous_owner_user_id"] == mock_current_user["sub"]

        # Verify in database
        new_owner_perm = (
            labeler_db.query(ProjectPermission)
            .filter(
                ProjectPermission.project_id == test_project.id,
                ProjectPermission.user_id == new_owner_id,
            )
            .first()
        )
        assert new_owner_perm.role == "owner"

        old_owner_perm = (
            labeler_db.query(ProjectPermission)
            .filter(
                ProjectPermission.project_id == test_project.id,
                ProjectPermission.user_id == mock_current_user["sub"],
            )
            .first()
        )
        assert old_owner_perm.role == "admin"

    def test_transfer_ownership_from_viewer_to_owner(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
        mock_current_user,
    ):
        """
        Test transferring ownership to a viewer.

        Should promote viewer directly to owner.
        """
        # Create a viewer who will become the new owner
        new_owner_id = "viewer-to-owner-id"
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=new_owner_id,
            role="viewer",
        )

        request_data = {"new_owner_user_id": new_owner_id}

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/transfer-ownership",
            json=request_data,
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify the viewer was promoted to owner
        new_owner_perm = (
            labeler_db.query(ProjectPermission)
            .filter(
                ProjectPermission.project_id == test_project.id,
                ProjectPermission.user_id == new_owner_id,
            )
            .first()
        )
        assert new_owner_perm.role == "owner"

    def test_transfer_ownership_cannot_transfer_to_self(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
    ):
        """
        Test that owner cannot transfer ownership to themselves.

        Should return 400 Bad Request.
        """
        request_data = {"new_owner_user_id": mock_current_user["sub"]}

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/transfer-ownership",
            json=request_data,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "Cannot transfer ownership to yourself" in data["detail"]

    def test_transfer_ownership_new_owner_not_member(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test transferring ownership to non-member.

        Should return 400 Bad Request.
        """
        request_data = {"new_owner_user_id": "non-member-user-id"}

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/transfer-ownership",
            json=request_data,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "is not a member" in data["detail"].lower()

    def test_transfer_ownership_only_owner_can_transfer(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        create_dataset,
        create_project_permission,
        mock_current_user,
    ):
        """
        Test that only owner can transfer ownership.

        Should return 403 Forbidden when non-owner tries to transfer.
        """
        # Create a project where current user is admin (not owner)
        other_dataset = create_dataset(
            labeler_db,
            dataset_id="ds_transfer_test",
            name="Transfer Test Dataset",
            owner_id="other-user-id",
        )
        other_project = create_project(
            labeler_db,
            project_id="proj_transfer_test",
            name="Transfer Test Project",
            dataset_id=other_dataset.id,
            owner_id="other-user-id",
        )

        # Give current user admin permission (not owner)
        create_project_permission(
            labeler_db,
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="admin",
        )

        # Create a member to transfer to
        new_owner_id = "new-owner-user-id"
        create_project_permission(
            labeler_db,
            project_id=other_project.id,
            user_id=new_owner_id,
            role="admin",
        )

        request_data = {"new_owner_user_id": new_owner_id}

        response = authenticated_client.post(
            f"/api/v1/projects/{other_project.id}/transfer-ownership",
            json=request_data,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_transfer_ownership_unauthenticated(self, client, test_project):
        """
        Test transferring ownership without authentication.

        Should return 403 Forbidden.
        """
        request_data = {"new_owner_user_id": "new-owner-user-id"}

        response = client.post(
            f"/api/v1/projects/{test_project.id}/transfer-ownership",
            json=request_data,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_transfer_ownership_with_dataset_id(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        test_dataset,
        create_project_permission,
    ):
        """
        Test transferring ownership using dataset_id (ds_xxx format).

        Should work with both project_id and dataset_id.
        """
        # Create a member who will become the new owner
        new_owner_id = "new-owner-user-id"
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=new_owner_id,
            role="admin",
        )

        request_data = {"new_owner_user_id": new_owner_id}

        response = authenticated_client.post(
            f"/api/v1/projects/{test_dataset.id}/transfer-ownership",
            json=request_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["new_owner_user_id"] == new_owner_id


class TestPermissionRoleHierarchy:
    """Test cases for role hierarchy and permission validation."""

    def test_all_five_roles_are_distinct(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """
        Test that all 5 roles (owner, admin, reviewer, annotator, viewer) exist and are distinct.
        """
        # Create members with each role
        roles = ["owner", "admin", "reviewer", "annotator", "viewer"]
        user_ids = [f"{role}-user-id" for role in roles]

        for i, role in enumerate(roles[1:], 1):  # Skip owner, it already exists
            create_project_permission(
                labeler_db,
                project_id=test_project.id,
                user_id=user_ids[i],
                role=role,
            )

        # Verify all permissions exist with correct roles
        permissions = (
            labeler_db.query(ProjectPermission)
            .filter(ProjectPermission.project_id == test_project.id)
            .all()
        )

        permission_roles = {p.role for p in permissions}
        assert permission_roles == {"owner", "admin", "reviewer", "annotator", "viewer"}

    def test_role_changes_are_flexible(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """
        Test that roles can be changed in any direction (except owner restrictions).
        """
        member_id = "flexible-user-id"
        permission = create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=member_id,
            role="viewer",
        )

        # Test role progression: viewer -> annotator -> reviewer -> admin -> viewer
        role_progression = ["annotator", "reviewer", "admin", "viewer"]

        for target_role in role_progression:
            response = authenticated_client.patch(
                f"/api/v1/projects/{test_project.id}/permissions/{member_id}",
                json={"role": target_role},
            )
            assert response.status_code == status.HTTP_200_OK
            assert response.json()["role"] == target_role

    def test_response_structure_is_consistent(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        create_project_permission,
    ):
        """
        Test that all permission responses have consistent structure.
        """
        # Create various permissions
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id="admin-user-id",
            role="admin",
        )

        response = authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/permissions"
        )

        assert response.status_code == status.HTTP_200_OK
        permissions = response.json()

        # Verify all permissions have the same structure
        required_fields = {
            "id",
            "project_id",
            "user_id",
            "role",
            "granted_by",
            "granted_at",
            "user_name",
            "user_email",
            "user_badge_color",
            "granted_by_name",
            "granted_by_email",
        }

        for perm in permissions:
            assert set(perm.keys()) == required_fields
            # User info should be None since user DB is not available
            assert perm["user_name"] is None
            assert perm["user_email"] is None
            assert perm["granted_by_name"] is None
            assert perm["granted_by_email"] is None
