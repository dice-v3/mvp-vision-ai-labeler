"""
Tests for project endpoints.

Tests the project-related endpoints including:
- POST / - Create new annotation project
- GET / - List annotation projects (with pagination)
- GET /{project_id} - Get project by ID
- PATCH /{project_id} - Update project
- DELETE /{project_id} - Delete project
- POST /{project_id}/task-types - Add task type to project
- GET /{project_id}/images - List project images (with pagination)
- GET /{project_id}/images/status - Get image statuses
- GET /{project_id}/stats - Get project statistics
- POST /{project_id}/images/{image_id}/confirm - Confirm image
- POST /{project_id}/images/{image_id}/unconfirm - Unconfirm image
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime

from app.core.security import get_current_user, require_project_permission
from app.db.models.labeler import (
    AnnotationProject,
    Dataset,
    ProjectPermission,
    ImageMetadata,
    ImageAnnotationStatus,
    Annotation,
)
from app.main import app


class TestCreateProject:
    """Test cases for POST /api/v1/projects endpoint."""

    def test_create_project_success(self, authenticated_client, labeler_db, test_dataset, mock_current_user):
        """
        Test successful project creation.

        Should create project with owner permission and return project details.
        """
        project_data = {
            "name": "New Test Project",
            "description": "Test project description",
            "dataset_id": test_dataset.id,
            "task_types": ["detection", "classification"],
            "task_config": {
                "detection": {"show_labels": True},
                "classification": {"multi_label": False}
            },
            "task_classes": {
                "detection": {},
                "classification": {}
            },
            "settings": {"auto_save": True}
        }

        response = authenticated_client.post(
            "/api/v1/projects",
            json=project_data
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        # Verify project fields
        assert data["name"] == project_data["name"]
        assert data["description"] == project_data["description"]
        assert data["dataset_id"] == test_dataset.id
        assert data["owner_id"] == mock_current_user["sub"]
        assert data["task_types"] == project_data["task_types"]
        assert data["task_config"] == project_data["task_config"]
        assert data["total_images"] == test_dataset.num_items
        assert data["status"] == "active"
        assert "id" in data
        assert data["id"].startswith("proj_")

        # Verify dataset information included
        assert data["dataset_name"] == test_dataset.name
        assert data["dataset_num_items"] == test_dataset.num_items

        # Verify owner permission was created
        project_id = data["id"]
        permission = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id,
            ProjectPermission.user_id == mock_current_user["sub"]
        ).first()

        assert permission is not None
        assert permission.role == "owner"
        assert permission.granted_by == mock_current_user["sub"]

    def test_create_project_minimal_fields(self, authenticated_client, labeler_db, test_dataset):
        """
        Test project creation with minimal required fields.

        Should create project with default values for optional fields.
        """
        project_data = {
            "name": "Minimal Project",
            "dataset_id": test_dataset.id,
            "task_types": ["detection"],
            "task_config": {},
            "task_classes": {}
        }

        response = authenticated_client.post(
            "/api/v1/projects",
            json=project_data
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == project_data["name"]
        assert data["description"] is None
        assert data["settings"] == {}

    def test_create_project_dataset_not_found(self, authenticated_client, labeler_db):
        """
        Test project creation with non-existent dataset.

        Should return 404 error.
        """
        project_data = {
            "name": "Test Project",
            "dataset_id": "nonexistent_dataset_id",
            "task_types": ["detection"],
            "task_config": {},
            "task_classes": {}
        }

        response = authenticated_client.post(
            "/api/v1/projects",
            json=project_data
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_create_project_unauthenticated(self, client, test_dataset):
        """
        Test project creation without authentication.

        Should return 403 error.
        """
        project_data = {
            "name": "Test Project",
            "dataset_id": test_dataset.id,
            "task_types": ["detection"],
            "task_config": {},
            "task_classes": {}
        }

        response = client.post(
            "/api/v1/projects",
            json=project_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_project_missing_required_fields(self, authenticated_client, test_dataset):
        """
        Test project creation with missing required fields.

        Should return 422 validation error.
        """
        # Missing task_types
        project_data = {
            "name": "Test Project",
            "dataset_id": test_dataset.id,
            "task_config": {},
            "task_classes": {}
        }

        response = authenticated_client.post(
            "/api/v1/projects",
            json=project_data
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_project_with_multiple_task_types(self, authenticated_client, labeler_db, test_dataset):
        """
        Test project creation with multiple task types.

        Should create project with all task types configured.
        """
        project_data = {
            "name": "Multi-Task Project",
            "dataset_id": test_dataset.id,
            "task_types": ["detection", "classification", "segmentation"],
            "task_config": {
                "detection": {"show_labels": True},
                "classification": {"multi_label": True},
                "segmentation": {"show_labels": True}
            },
            "task_classes": {
                "detection": {"1": {"name": "car", "color": "#ff0000"}},
                "classification": {"1": {"name": "vehicle", "color": "#00ff00"}},
                "segmentation": {}
            }
        }

        response = authenticated_client.post(
            "/api/v1/projects",
            json=project_data
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert len(data["task_types"]) == 3
        assert "detection" in data["task_types"]
        assert "classification" in data["task_types"]
        assert "segmentation" in data["task_types"]


class TestListProjects:
    """Test cases for GET /api/v1/projects endpoint."""

    def test_list_projects_empty(self, authenticated_client, labeler_db):
        """
        Test listing projects when user has no projects.

        Should return empty list.
        """
        response = authenticated_client.get("/api/v1/projects")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_list_projects_single(self, authenticated_client, labeler_db, test_project, test_dataset):
        """
        Test listing projects with single project.

        Should return list with one project.
        """
        response = authenticated_client.get("/api/v1/projects")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == test_project.id
        assert data[0]["name"] == test_project.name
        assert data[0]["dataset_name"] == test_dataset.name
        assert data[0]["dataset_num_items"] == test_dataset.num_items

    def test_list_projects_multiple(self, authenticated_client, labeler_db, test_dataset, mock_current_user, create_project):
        """
        Test listing multiple projects.

        Should return all projects owned by user.
        """
        # Create multiple projects
        project1 = create_project(
            labeler_db,
            project_id="proj_multi_1",
            name="Project 1",
            dataset_id=test_dataset.id,
            owner_id=mock_current_user["sub"]
        )
        project2 = create_project(
            labeler_db,
            project_id="proj_multi_2",
            name="Project 2",
            dataset_id=test_dataset.id,
            owner_id=mock_current_user["sub"]
        )

        response = authenticated_client.get("/api/v1/projects")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        project_ids = [p["id"] for p in data]
        assert project1.id in project_ids
        assert project2.id in project_ids

    def test_list_projects_pagination_default(self, authenticated_client, labeler_db):
        """
        Test listing projects with default pagination.

        Should use default skip=0 and limit=100.
        """
        response = authenticated_client.get("/api/v1/projects")

        assert response.status_code == status.HTTP_200_OK
        # Default pagination should work
        assert isinstance(response.json(), list)

    def test_list_projects_pagination_custom(self, authenticated_client, labeler_db, test_dataset, mock_current_user, create_project):
        """
        Test listing projects with custom pagination parameters.

        Should respect skip and limit parameters.
        """
        # Create 5 projects
        for i in range(5):
            create_project(
                labeler_db,
                project_id=f"proj_page_{i}",
                name=f"Project {i}",
                dataset_id=test_dataset.id,
                owner_id=mock_current_user["sub"]
            )

        # Get first 2
        response = authenticated_client.get(
            "/api/v1/projects",
            params={"skip": 0, "limit": 2}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2

        # Get next 2
        response = authenticated_client.get(
            "/api/v1/projects",
            params={"skip": 2, "limit": 2}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2

    def test_list_projects_pagination_max_limit(self, authenticated_client, labeler_db):
        """
        Test listing projects with limit exceeding max (100).

        Should cap limit at 100.
        """
        response = authenticated_client.get(
            "/api/v1/projects",
            params={"limit": 200}
        )

        assert response.status_code == status.HTTP_200_OK
        # Should not error, backend caps at 100

    def test_list_projects_only_owned(self, authenticated_client, labeler_db, test_dataset, mock_current_user, create_project):
        """
        Test that users only see their own projects.

        Should not return projects owned by other users.
        """
        # Create project for current user
        my_project = create_project(
            labeler_db,
            project_id="proj_mine",
            name="My Project",
            dataset_id=test_dataset.id,
            owner_id=mock_current_user["sub"]
        )

        # Create project for another user
        other_project = create_project(
            labeler_db,
            project_id="proj_other",
            name="Other Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        response = authenticated_client.get("/api/v1/projects")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        project_ids = [p["id"] for p in data]

        # Should only see own project
        assert my_project.id in project_ids
        assert other_project.id not in project_ids

    def test_list_projects_unauthenticated(self, client):
        """
        Test listing projects without authentication.

        Should return 403 error.
        """
        response = client.get("/api/v1/projects")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_projects_with_missing_dataset(self, authenticated_client, labeler_db, mock_current_user, create_project):
        """
        Test listing projects when associated dataset is missing.

        Should return projects with null dataset information.
        """
        # Create dataset
        dataset = Dataset(
            id="ds_temp",
            name="Temp Dataset",
            owner_id=mock_current_user["sub"],
            storage_path="s3://test",
            storage_type="s3",
            format="images",
            num_images=10,
            status="active",
            integrity_status="valid"
        )
        labeler_db.add(dataset)
        labeler_db.commit()

        # Create project with this dataset
        project = create_project(
            labeler_db,
            project_id="proj_orphan",
            name="Orphan Project",
            dataset_id=dataset.id,
            owner_id=mock_current_user["sub"]
        )

        # Delete the dataset
        labeler_db.delete(dataset)
        labeler_db.commit()

        response = authenticated_client.get("/api/v1/projects")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        orphan_project = next((p for p in data if p["id"] == project.id), None)
        assert orphan_project is not None
        assert orphan_project["dataset_name"] is None
        assert orphan_project["dataset_num_items"] is None


class TestGetProject:
    """Test cases for GET /api/v1/projects/{project_id} endpoint."""

    def test_get_project_success(self, authenticated_client, labeler_db, test_project, test_dataset):
        """
        Test getting project by ID.

        Should return project details with dataset information.
        """
        response = authenticated_client.get(f"/api/v1/projects/{test_project.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == test_project.id
        assert data["name"] == test_project.name
        assert data["dataset_id"] == test_project.dataset_id
        assert data["dataset_name"] == test_dataset.name
        assert data["dataset_num_items"] == test_dataset.num_items

    def test_get_project_not_found(self, authenticated_client, labeler_db):
        """
        Test getting non-existent project.

        Should return 404 error.
        """
        response = authenticated_client.get("/api/v1/projects/nonexistent_proj")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_get_project_unauthenticated(self, client, test_project):
        """
        Test getting project without authentication.

        Should return 403 error.
        """
        response = client.get(f"/api/v1/projects/{test_project.id}")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_project_no_permission(self, authenticated_client, labeler_db, test_dataset, create_project):
        """
        Test getting project without viewer permission.

        Should return 403 error due to missing permission.
        """
        # Create project owned by another user
        other_project = create_project(
            labeler_db,
            project_id="proj_other_owner",
            name="Other User Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        response = authenticated_client.get(f"/api/v1/projects/{other_project.id}")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_project_with_viewer_permission(self, authenticated_client, labeler_db, test_dataset, mock_current_user, create_project):
        """
        Test getting project with viewer permission.

        Should return project details even if not owner.
        """
        # Create project owned by another user
        other_project = create_project(
            labeler_db,
            project_id="proj_shared",
            name="Shared Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        # Grant viewer permission to current user
        permission = ProjectPermission(
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="viewer",
            granted_by="other-user-id"
        )
        labeler_db.add(permission)
        labeler_db.commit()

        response = authenticated_client.get(f"/api/v1/projects/{other_project.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == other_project.id

    def test_get_project_response_structure(self, authenticated_client, labeler_db, test_project):
        """
        Test project response includes all required fields.

        Should validate response schema matches ProjectResponse.
        """
        response = authenticated_client.get(f"/api/v1/projects/{test_project.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Required fields
        assert "id" in data
        assert "name" in data
        assert "dataset_id" in data
        assert "owner_id" in data
        assert "task_types" in data
        assert "task_config" in data
        assert "task_classes" in data
        assert "settings" in data
        assert "total_images" in data
        assert "annotated_images" in data
        assert "total_annotations" in data
        assert "status" in data
        assert "created_at" in data
        assert "updated_at" in data


class TestUpdateProject:
    """Test cases for PATCH /api/v1/projects/{project_id} endpoint."""

    def test_update_project_name(self, authenticated_client, labeler_db, test_project):
        """
        Test updating project name.

        Should update name and return updated project.
        """
        update_data = {"name": "Updated Project Name"}

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["id"] == test_project.id

        # Verify in database
        labeler_db.refresh(test_project)
        assert test_project.name == update_data["name"]

    def test_update_project_description(self, authenticated_client, labeler_db, test_project):
        """
        Test updating project description.

        Should update description field.
        """
        update_data = {"description": "New description for the project"}

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["description"] == update_data["description"]

    def test_update_project_task_config(self, authenticated_client, labeler_db, test_project):
        """
        Test updating project task configuration.

        Should update task_config field.
        """
        update_data = {
            "task_config": {
                "detection": {"show_labels": False, "show_confidence": True}
            }
        }

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["task_config"] == update_data["task_config"]

    def test_update_project_settings(self, authenticated_client, labeler_db, test_project):
        """
        Test updating project settings.

        Should update settings field.
        """
        update_data = {
            "settings": {"auto_save": True, "theme": "dark"}
        }

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["settings"] == update_data["settings"]

    def test_update_project_multiple_fields(self, authenticated_client, labeler_db, test_project):
        """
        Test updating multiple fields simultaneously.

        Should update all provided fields.
        """
        update_data = {
            "name": "Multi-Update Project",
            "description": "Updated description",
            "settings": {"key": "value"}
        }

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["description"] == update_data["description"]
        assert data["settings"] == update_data["settings"]

    def test_update_project_not_found(self, authenticated_client, labeler_db):
        """
        Test updating non-existent project.

        Should return 404 error.
        """
        update_data = {"name": "Updated Name"}

        response = authenticated_client.patch(
            "/api/v1/projects/nonexistent_proj",
            json=update_data
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_project_unauthenticated(self, client, test_project):
        """
        Test updating project without authentication.

        Should return 403 error.
        """
        update_data = {"name": "Updated Name"}

        response = client.patch(
            f"/api/v1/projects/{test_project.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_project_requires_admin_permission(self, authenticated_client, labeler_db, test_dataset, mock_current_user, create_project):
        """
        Test updating project requires admin role.

        Should return 403 if user only has viewer role.
        """
        # Create project owned by another user
        other_project = create_project(
            labeler_db,
            project_id="proj_viewer_only",
            name="Viewer Only Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        # Grant viewer permission (not admin)
        permission = ProjectPermission(
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="viewer",
            granted_by="other-user-id"
        )
        labeler_db.add(permission)
        labeler_db.commit()

        update_data = {"name": "Unauthorized Update"}

        response = authenticated_client.patch(
            f"/api/v1/projects/{other_project.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_project_with_admin_permission(self, authenticated_client, labeler_db, test_dataset, mock_current_user, create_project):
        """
        Test updating project with admin permission.

        Should allow update even if not owner.
        """
        # Create project owned by another user
        other_project = create_project(
            labeler_db,
            project_id="proj_admin_perm",
            name="Admin Permission Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        # Grant admin permission
        permission = ProjectPermission(
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="admin",
            granted_by="other-user-id"
        )
        labeler_db.add(permission)
        labeler_db.commit()

        update_data = {"name": "Admin Updated Name"}

        response = authenticated_client.patch(
            f"/api/v1/projects/{other_project.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == update_data["name"]

    def test_update_project_empty_update(self, authenticated_client, labeler_db, test_project):
        """
        Test updating project with no fields.

        Should return project unchanged.
        """
        original_name = test_project.name
        update_data = {}

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == original_name


class TestDeleteProject:
    """Test cases for DELETE /api/v1/projects/{project_id} endpoint."""

    def test_delete_project_success(self, authenticated_client, labeler_db, test_project):
        """
        Test successful project deletion.

        Should delete project and return 204.
        """
        project_id = test_project.id

        response = authenticated_client.delete(f"/api/v1/projects/{project_id}")

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify project is deleted
        deleted_project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.id == project_id
        ).first()
        assert deleted_project is None

    def test_delete_project_not_found(self, authenticated_client, labeler_db):
        """
        Test deleting non-existent project.

        Should return 404 error.
        """
        response = authenticated_client.delete("/api/v1/projects/nonexistent_proj")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_project_unauthenticated(self, client, test_project):
        """
        Test deleting project without authentication.

        Should return 403 error.
        """
        response = client.delete(f"/api/v1/projects/{test_project.id}")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_project_requires_owner_permission(self, authenticated_client, labeler_db, test_dataset, mock_current_user, create_project):
        """
        Test deleting project requires owner role.

        Should return 403 if user only has admin role.
        """
        # Create project owned by another user
        other_project = create_project(
            labeler_db,
            project_id="proj_admin_no_delete",
            name="Admin No Delete Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        # Grant admin permission (not owner)
        permission = ProjectPermission(
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="admin",
            granted_by="other-user-id"
        )
        labeler_db.add(permission)
        labeler_db.commit()

        response = authenticated_client.delete(f"/api/v1/projects/{other_project.id}")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_project_with_owner_permission(self, authenticated_client, labeler_db, test_project):
        """
        Test deleting project with owner permission.

        Should successfully delete project.
        """
        project_id = test_project.id

        response = authenticated_client.delete(f"/api/v1/projects/{project_id}")

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify deletion
        deleted_project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.id == project_id
        ).first()
        assert deleted_project is None

    def test_delete_project_cascades_permissions(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test that deleting project cascades to permissions.

        Should delete associated permissions.
        """
        project_id = test_project.id

        # Verify permissions exist
        permissions_before = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id
        ).all()
        assert len(permissions_before) > 0

        response = authenticated_client.delete(f"/api/v1/projects/{project_id}")

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify permissions are deleted (cascade)
        permissions_after = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id
        ).all()
        assert len(permissions_after) == 0


class TestAddTaskType:
    """Test cases for POST /api/v1/projects/{project_id}/task-types endpoint."""

    def test_add_task_type_success(self, authenticated_client, labeler_db, test_project):
        """
        Test adding new task type to project.

        Should add task type with default config.
        """
        request_data = {"task_type": "segmentation"}

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/task-types",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "segmentation" in data["task_types"]
        assert "segmentation" in data["task_config"]
        assert "segmentation" in data["task_classes"]

    def test_add_task_type_detection(self, authenticated_client, labeler_db, test_project):
        """
        Test adding detection task type.

        Should initialize with detection default config.
        """
        request_data = {"task_type": "detection"}

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/task-types",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "detection" in data["task_types"]
        assert data["task_config"]["detection"]["show_labels"] is True
        assert data["task_config"]["detection"]["show_confidence"] is False

    def test_add_task_type_classification(self, authenticated_client, labeler_db, test_project):
        """
        Test adding classification task type.

        Should initialize with classification default config.
        """
        request_data = {"task_type": "classification"}

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/task-types",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "classification" in data["task_types"]
        assert data["task_config"]["classification"]["multi_label"] is False
        assert data["task_config"]["classification"]["show_confidence"] is False

    def test_add_task_type_duplicate(self, authenticated_client, labeler_db, create_project, test_dataset, mock_current_user):
        """
        Test adding task type that already exists.

        Should return 400 error.
        """
        # Create project with detection task
        project = create_project(
            labeler_db,
            project_id="proj_dup_task",
            name="Duplicate Task Project",
            dataset_id=test_dataset.id,
            owner_id=mock_current_user["sub"],
            task_types=["detection"]
        )

        # Try to add detection again
        request_data = {"task_type": "detection"}

        response = authenticated_client.post(
            f"/api/v1/projects/{project.id}/task-types",
            json=request_data
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists" in response.json()["detail"].lower()

    def test_add_task_type_invalid(self, authenticated_client, labeler_db, test_project):
        """
        Test adding invalid task type.

        Should return 400 error.
        """
        request_data = {"task_type": "invalid_task_type"}

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/task-types",
            json=request_data
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid task type" in response.json()["detail"]

    def test_add_task_type_not_found(self, authenticated_client, labeler_db):
        """
        Test adding task type to non-existent project.

        Should return 404 error.
        """
        request_data = {"task_type": "detection"}

        response = authenticated_client.post(
            "/api/v1/projects/nonexistent_proj/task-types",
            json=request_data
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_add_task_type_unauthenticated(self, client, test_project):
        """
        Test adding task type without authentication.

        Should return 403 error.
        """
        request_data = {"task_type": "detection"}

        response = client.post(
            f"/api/v1/projects/{test_project.id}/task-types",
            json=request_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_add_task_type_requires_admin_permission(self, authenticated_client, labeler_db, test_dataset, mock_current_user, create_project):
        """
        Test adding task type requires admin role.

        Should return 403 if user only has viewer role.
        """
        # Create project owned by another user
        other_project = create_project(
            labeler_db,
            project_id="proj_viewer_task",
            name="Viewer Task Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        # Grant viewer permission
        permission = ProjectPermission(
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="viewer",
            granted_by="other-user-id"
        )
        labeler_db.add(permission)
        labeler_db.commit()

        request_data = {"task_type": "detection"}

        response = authenticated_client.post(
            f"/api/v1/projects/{other_project.id}/task-types",
            json=request_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestListProjectImages:
    """Test cases for GET /api/v1/projects/{project_id}/images endpoint."""

    @patch('app.api.v1.endpoints.projects.storage_client')
    def test_list_project_images_empty(self, mock_storage, authenticated_client, labeler_db, test_project):
        """
        Test listing images when project has no images.

        Should return empty list with total=0.
        """
        response = authenticated_client.get(f"/api/v1/projects/{test_project.id}/images")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["images"] == []
        assert data["total"] == 0
        assert data["project_id"] == test_project.id

    @patch('app.api.v1.endpoints.projects.storage_client')
    def test_list_project_images_with_data(self, mock_storage, authenticated_client, labeler_db, test_project):
        """
        Test listing images with image metadata.

        Should return images with presigned URLs.
        """
        # Create image metadata
        img1 = ImageMetadata(
            id="img_001.jpg",
            dataset_id=test_project.dataset_id,
            s3_key="datasets/test/img_001.jpg",
            size=1024,
            width=800,
            height=600,
            uploaded_at=datetime.utcnow(),
            last_modified=datetime.utcnow()
        )
        img2 = ImageMetadata(
            id="img_002.jpg",
            dataset_id=test_project.dataset_id,
            s3_key="datasets/test/img_002.jpg",
            size=2048,
            width=1024,
            height=768,
            uploaded_at=datetime.utcnow(),
            last_modified=datetime.utcnow()
        )
        labeler_db.add_all([img1, img2])
        labeler_db.commit()

        # Mock presigned URL generation
        mock_storage.generate_presigned_url.return_value = "https://presigned-url.com/image.jpg"

        response = authenticated_client.get(f"/api/v1/projects/{test_project.id}/images")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["images"]) == 2
        assert data["total"] == 2
        assert data["images"][0]["id"] == "img_001.jpg"
        assert data["images"][1]["id"] == "img_002.jpg"

    @patch('app.api.v1.endpoints.projects.storage_client')
    def test_list_project_images_pagination_default(self, mock_storage, authenticated_client, labeler_db, test_project):
        """
        Test listing images with default pagination.

        Should use default limit=50, offset=0.
        """
        mock_storage.generate_presigned_url.return_value = "https://presigned-url.com/image.jpg"

        response = authenticated_client.get(f"/api/v1/projects/{test_project.id}/images")

        assert response.status_code == status.HTTP_200_OK
        # Should work with default pagination

    @patch('app.api.v1.endpoints.projects.storage_client')
    def test_list_project_images_pagination_custom(self, mock_storage, authenticated_client, labeler_db, test_project):
        """
        Test listing images with custom pagination.

        Should respect limit and offset parameters.
        """
        # Create 10 images
        for i in range(10):
            img = ImageMetadata(
                id=f"img_{i:03d}.jpg",
                dataset_id=test_project.dataset_id,
                s3_key=f"datasets/test/img_{i:03d}.jpg",
                size=1024,
                width=800,
                height=600,
                uploaded_at=datetime.utcnow(),
                last_modified=datetime.utcnow()
            )
            labeler_db.add(img)
        labeler_db.commit()

        mock_storage.generate_presigned_url.return_value = "https://presigned-url.com/image.jpg"

        # Get first 5
        response = authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/images",
            params={"limit": 5, "offset": 0}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["images"]) == 5
        assert data["total"] == 10

        # Get next 5
        response = authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/images",
            params={"limit": 5, "offset": 5}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["images"]) == 5
        assert data["total"] == 10

    def test_list_project_images_invalid_offset(self, authenticated_client, labeler_db, test_project):
        """
        Test listing images with negative offset.

        Should return 400 error.
        """
        response = authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/images",
            params={"offset": -1}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "offset must be >= 0" in response.json()["detail"]

    def test_list_project_images_invalid_limit_low(self, authenticated_client, labeler_db, test_project):
        """
        Test listing images with limit < 1.

        Should return 400 error.
        """
        response = authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/images",
            params={"limit": 0}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "limit must be between 1 and 200" in response.json()["detail"]

    def test_list_project_images_invalid_limit_high(self, authenticated_client, labeler_db, test_project):
        """
        Test listing images with limit > 200.

        Should return 400 error.
        """
        response = authenticated_client.get(
            f"/api/v1/projects/{test_project.id}/images",
            params={"limit": 201}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "limit must be between 1 and 200" in response.json()["detail"]

    def test_list_project_images_not_found(self, authenticated_client, labeler_db):
        """
        Test listing images for non-existent project.

        Should return 404 error.
        """
        response = authenticated_client.get("/api/v1/projects/nonexistent_proj/images")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_list_project_images_unauthenticated(self, client, test_project):
        """
        Test listing images without authentication.

        Should return 403 error.
        """
        response = client.get(f"/api/v1/projects/{test_project.id}/images")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_project_images_requires_viewer_permission(self, authenticated_client, labeler_db, test_dataset, create_project):
        """
        Test listing images requires viewer role.

        Should return 403 if user has no permission.
        """
        # Create project owned by another user
        other_project = create_project(
            labeler_db,
            project_id="proj_no_view",
            name="No View Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        response = authenticated_client.get(f"/api/v1/projects/{other_project.id}/images")

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestGetProjectStats:
    """Test cases for GET /api/v1/projects/{project_id}/stats endpoint."""

    def test_get_project_stats_empty(self, authenticated_client, labeler_db, test_project):
        """
        Test getting stats for project with no annotations.

        Should return stats with all counts at zero.
        """
        response = authenticated_client.get(f"/api/v1/projects/{test_project.id}/stats")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["project_id"] == test_project.id
        assert data["total_images"] == test_project.total_images
        assert "task_stats" in data

    def test_get_project_stats_with_data(self, authenticated_client, labeler_db, create_project, test_dataset, mock_current_user):
        """
        Test getting stats with annotation status data.

        Should return accurate counts by status.
        """
        # Create project with task types
        project = create_project(
            labeler_db,
            project_id="proj_stats",
            name="Stats Project",
            dataset_id=test_dataset.id,
            owner_id=mock_current_user["sub"],
            task_types=["detection"],
            total_images=10
        )

        # Create image statuses
        for i in range(5):
            status_entry = ImageAnnotationStatus(
                project_id=project.id,
                image_id=f"img_{i}.jpg",
                task_type="detection",
                status="completed" if i < 3 else "in-progress",
                is_image_confirmed=i < 2
            )
            labeler_db.add(status_entry)
        labeler_db.commit()

        response = authenticated_client.get(f"/api/v1/projects/{project.id}/stats")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_images"] == 10

        # Find detection task stats
        detection_stats = next((t for t in data["task_stats"] if t["task_type"] == "detection"), None)
        assert detection_stats is not None
        assert detection_stats["completed"] == 3
        assert detection_stats["in_progress"] == 2
        assert detection_stats["not_started"] == 5  # 10 total - 5 with status
        assert detection_stats["confirmed"] == 2

    def test_get_project_stats_not_found(self, authenticated_client, labeler_db):
        """
        Test getting stats for non-existent project.

        Should return 404 error.
        """
        response = authenticated_client.get("/api/v1/projects/nonexistent_proj/stats")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_project_stats_unauthenticated(self, client, test_project):
        """
        Test getting stats without authentication.

        Should return 403 error.
        """
        response = client.get(f"/api/v1/projects/{test_project.id}/stats")

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestAccessControl:
    """Test cases for access control across project endpoints."""

    def test_owner_has_full_access(self, authenticated_client, labeler_db, test_project):
        """
        Test that project owner has full access.

        Owner should be able to view, update, and delete.
        """
        # View project
        response = authenticated_client.get(f"/api/v1/projects/{test_project.id}")
        assert response.status_code == status.HTTP_200_OK

        # Update project
        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}",
            json={"name": "Owner Update"}
        )
        assert response.status_code == status.HTTP_200_OK

        # Delete project
        response = authenticated_client.delete(f"/api/v1/projects/{test_project.id}")
        assert response.status_code == status.HTTP_204_NO_CONTENT

    def test_admin_can_update_not_delete(self, authenticated_client, labeler_db, test_dataset, mock_current_user, create_project):
        """
        Test that admin can update but not delete.

        Admin role should allow updates but not deletion.
        """
        # Create project owned by another user
        other_project = create_project(
            labeler_db,
            project_id="proj_admin_access",
            name="Admin Access Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        # Grant admin permission
        permission = ProjectPermission(
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="admin",
            granted_by="other-user-id"
        )
        labeler_db.add(permission)
        labeler_db.commit()

        # Can view
        response = authenticated_client.get(f"/api/v1/projects/{other_project.id}")
        assert response.status_code == status.HTTP_200_OK

        # Can update
        response = authenticated_client.patch(
            f"/api/v1/projects/{other_project.id}",
            json={"name": "Admin Update"}
        )
        assert response.status_code == status.HTTP_200_OK

        # Cannot delete
        response = authenticated_client.delete(f"/api/v1/projects/{other_project.id}")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_viewer_read_only_access(self, authenticated_client, labeler_db, test_dataset, mock_current_user, create_project):
        """
        Test that viewer has read-only access.

        Viewer should be able to view but not modify.
        """
        # Create project owned by another user
        other_project = create_project(
            labeler_db,
            project_id="proj_viewer_access",
            name="Viewer Access Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        # Grant viewer permission
        permission = ProjectPermission(
            project_id=other_project.id,
            user_id=mock_current_user["sub"],
            role="viewer",
            granted_by="other-user-id"
        )
        labeler_db.add(permission)
        labeler_db.commit()

        # Can view
        response = authenticated_client.get(f"/api/v1/projects/{other_project.id}")
        assert response.status_code == status.HTTP_200_OK

        # Cannot update
        response = authenticated_client.patch(
            f"/api/v1/projects/{other_project.id}",
            json={"name": "Viewer Update"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Cannot delete
        response = authenticated_client.delete(f"/api/v1/projects/{other_project.id}")
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_no_permission_no_access(self, authenticated_client, labeler_db, test_dataset, create_project):
        """
        Test that users without permission cannot access project.

        Should return 403 for all operations.
        """
        # Create project owned by another user (no permission granted)
        other_project = create_project(
            labeler_db,
            project_id="proj_no_access",
            name="No Access Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id"
        )

        # Cannot view
        response = authenticated_client.get(f"/api/v1/projects/{other_project.id}")
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Cannot update
        response = authenticated_client.patch(
            f"/api/v1/projects/{other_project.id}",
            json={"name": "No Access Update"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Cannot delete
        response = authenticated_client.delete(f"/api/v1/projects/{other_project.id}")
        assert response.status_code == status.HTTP_403_FORBIDDEN
