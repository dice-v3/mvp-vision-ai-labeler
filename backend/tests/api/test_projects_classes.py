"""
Tests for project class management endpoints.

Tests the class-related endpoints including:
- POST /{project_id}/classes - Add class to project task
- PATCH /{project_id}/classes/{class_id} - Update class
- DELETE /{project_id}/classes/{class_id} - Delete class
- PUT /{project_id}/classes/reorder - Reorder classes

All class operations are task-specific (require task_type parameter).
"""

import pytest
from unittest.mock import patch
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime

from app.core.security import get_current_user
from app.db.models.labeler import (
    AnnotationProject,
    Annotation,
)
from app.main import app


class TestAddClass:
    """Test cases for POST /api/v1/projects/{project_id}/classes endpoint."""

    def test_add_class_success_all_fields(
        self,
        authenticated_client,
        labeler_db,
        test_project,
        mock_current_user,
    ):
        """
        Test adding a class with all fields specified.

        Should create class with provided values and return class details.
        """
        class_data = {
            "class_id": "person",
            "name": "Person",
            "color": "#FF5733",
            "description": "Human person detection",
        }

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json=class_data,
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        assert data["class_id"] == "person"
        assert data["name"] == "Person"
        assert data["color"] == "#FF5733"
        assert data["description"] == "Human person detection"
        assert data["order"] == 0
        assert data["image_count"] == 0
        assert data["bbox_count"] == 0

        # Verify class was added to project
        labeler_db.refresh(test_project)
        assert "detection" in test_project.task_classes
        assert "person" in test_project.task_classes["detection"]
        assert test_project.task_classes["detection"]["person"]["name"] == "Person"

    def test_add_class_success_auto_generated_id(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test adding a class without specifying class_id.

        Should auto-generate a unique class_id.
        """
        class_data = {
            "name": "Car",
            "color": "#00FF00",
        }

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json=class_data,
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        # Verify auto-generated class_id
        assert "class_id" in data
        assert len(data["class_id"]) == 8  # Short UUID (8 chars)
        assert data["name"] == "Car"
        assert data["color"] == "#00FF00"

        # Verify class was added to project
        labeler_db.refresh(test_project)
        assert data["class_id"] in test_project.task_classes["detection"]

    def test_add_class_minimal_fields(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test adding a class with minimal required fields.

        Should use default values for optional fields.
        """
        class_data = {
            "name": "Bicycle",
            "color": "#0000FF",
        }

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json=class_data,
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        assert data["name"] == "Bicycle"
        assert data["color"] == "#0000FF"
        assert data["description"] is None
        assert data["order"] == 0

    def test_add_class_multiple_classes_ordering(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test adding multiple classes verifies correct ordering.

        Each new class should have order incremented.
        """
        # Add first class
        response1 = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "cls1", "name": "Class 1", "color": "#FF0000"},
        )
        assert response1.status_code == status.HTTP_201_CREATED
        assert response1.json()["order"] == 0

        # Add second class
        response2 = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "cls2", "name": "Class 2", "color": "#00FF00"},
        )
        assert response2.status_code == status.HTTP_201_CREATED
        assert response2.json()["order"] == 1

        # Add third class
        response3 = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "cls3", "name": "Class 3", "color": "#0000FF"},
        )
        assert response3.status_code == status.HTTP_201_CREATED
        assert response3.json()["order"] == 2

    def test_add_class_different_task_types(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        test_dataset,
        mock_current_user,
    ):
        """
        Test adding classes to different task types in same project.

        Classes should be task-specific and isolated.
        """
        # Create project with multiple task types
        project = create_project(
            labeler_db,
            project_id="proj_multi_task",
            name="Multi-Task Project",
            dataset_id=test_dataset.id,
            owner_id=mock_current_user["sub"],
            task_types=["detection", "classification"],
            task_config={
                "detection": {"show_labels": True},
                "classification": {"multi_label": False},
            },
        )

        # Add class to detection task
        response1 = authenticated_client.post(
            f"/api/v1/projects/{project.id}/classes?task_type=detection",
            json={"class_id": "person", "name": "Person", "color": "#FF0000"},
        )
        assert response1.status_code == status.HTTP_201_CREATED

        # Add class to classification task (same class_id, different task)
        response2 = authenticated_client.post(
            f"/api/v1/projects/{project.id}/classes?task_type=classification",
            json={"class_id": "person", "name": "Person Type", "color": "#00FF00"},
        )
        assert response2.status_code == status.HTTP_201_CREATED

        # Verify both classes exist independently
        labeler_db.refresh(project)
        assert "person" in project.task_classes["detection"]
        assert "person" in project.task_classes["classification"]
        assert project.task_classes["detection"]["person"]["name"] == "Person"
        assert project.task_classes["classification"]["person"]["name"] == "Person Type"

    def test_add_class_project_not_found(
        self,
        authenticated_client,
    ):
        """
        Test adding class to non-existent project.

        Should return 404 Not Found.
        """
        class_data = {
            "name": "Test Class",
            "color": "#FF0000",
        }

        response = authenticated_client.post(
            "/api/v1/projects/proj_nonexistent/classes?task_type=detection",
            json=class_data,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_add_class_unauthorized_not_owner(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        test_dataset,
    ):
        """
        Test adding class when user is not the owner.

        Should return 403 Forbidden (unless user is admin).
        """
        # Create project owned by different user
        project = create_project(
            labeler_db,
            project_id="proj_other_owner",
            name="Other's Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id",
        )

        class_data = {
            "name": "Test Class",
            "color": "#FF0000",
        }

        response = authenticated_client.post(
            f"/api/v1/projects/{project.id}/classes?task_type=detection",
            json=class_data,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "not authorized" in response.json()["detail"].lower()

    def test_add_class_task_type_not_found(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test adding class to non-existent task type.

        Should return 400 Bad Request.
        """
        class_data = {
            "name": "Test Class",
            "color": "#FF0000",
        }

        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=segmentation",
            json=class_data,
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "task type" in response.json()["detail"].lower()
        assert "not found" in response.json()["detail"].lower()

    def test_add_class_duplicate_class_id(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test adding class with duplicate class_id in same task.

        Should return 409 Conflict.
        """
        class_data = {
            "class_id": "duplicate",
            "name": "First Class",
            "color": "#FF0000",
        }

        # Add first class
        response1 = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json=class_data,
        )
        assert response1.status_code == status.HTTP_201_CREATED

        # Try to add duplicate
        class_data["name"] = "Second Class"
        response2 = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json=class_data,
        )

        assert response2.status_code == status.HTTP_409_CONFLICT
        assert "already exists" in response2.json()["detail"].lower()

    def test_add_class_initializes_task_classes(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        test_dataset,
        mock_current_user,
    ):
        """
        Test adding first class initializes task_classes structure.

        Should handle projects with None or empty task_classes.
        """
        # Create project with no task_classes
        project = create_project(
            labeler_db,
            project_id="proj_no_classes",
            name="No Classes Project",
            dataset_id=test_dataset.id,
            owner_id=mock_current_user["sub"],
            task_classes=None,
        )

        class_data = {
            "class_id": "first",
            "name": "First Class",
            "color": "#FF0000",
        }

        response = authenticated_client.post(
            f"/api/v1/projects/{project.id}/classes?task_type=detection",
            json=class_data,
        )

        assert response.status_code == status.HTTP_201_CREATED

        # Verify task_classes was initialized
        labeler_db.refresh(project)
        assert project.task_classes is not None
        assert "detection" in project.task_classes
        assert "first" in project.task_classes["detection"]

    def test_add_class_no_authentication(
        self,
        client,
        labeler_db,
        test_project,
    ):
        """
        Test adding class without authentication.

        Should return 401 Unauthorized.
        """
        class_data = {
            "name": "Test Class",
            "color": "#FF0000",
        }

        response = client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json=class_data,
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_add_class_missing_required_fields(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test adding class with missing required fields.

        Should return 422 Unprocessable Entity.
        """
        # Missing name
        response1 = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"color": "#FF0000"},
        )
        assert response1.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Missing color
        response2 = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"name": "Test"},
        )
        assert response2.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestUpdateClass:
    """Test cases for PATCH /api/v1/projects/{project_id}/classes/{class_id} endpoint."""

    def test_update_class_name(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test updating class name.

        Should update name and preserve other fields.
        """
        # Add a class first
        add_response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "test_cls", "name": "Original", "color": "#FF0000"},
        )
        assert add_response.status_code == status.HTTP_201_CREATED

        # Update name
        update_data = {"name": "Updated Name"}
        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/classes/test_cls?task_type=detection",
            json=update_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["class_id"] == "test_cls"
        assert data["name"] == "Updated Name"
        assert data["color"] == "#FF0000"  # Preserved

        # Verify in database
        labeler_db.refresh(test_project)
        assert test_project.task_classes["detection"]["test_cls"]["name"] == "Updated Name"

    def test_update_class_color(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test updating class color.

        Should update color and preserve other fields.
        """
        # Add a class first
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "test_cls", "name": "Test", "color": "#FF0000"},
        )

        # Update color
        update_data = {"color": "#00FF00"}
        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/classes/test_cls?task_type=detection",
            json=update_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["color"] == "#00FF00"
        assert data["name"] == "Test"  # Preserved

    def test_update_class_description(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test updating class description.

        Should update description field.
        """
        # Add a class first
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "test_cls", "name": "Test", "color": "#FF0000"},
        )

        # Update description
        update_data = {"description": "New description"}
        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/classes/test_cls?task_type=detection",
            json=update_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["description"] == "New description"

    def test_update_class_order(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test updating class order.

        Should update order field.
        """
        # Add a class first
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "test_cls", "name": "Test", "color": "#FF0000"},
        )

        # Update order
        update_data = {"order": 5}
        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/classes/test_cls?task_type=detection",
            json=update_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["order"] == 5

    def test_update_class_multiple_fields(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test updating multiple class fields at once.

        Should update all specified fields.
        """
        # Add a class first
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "test_cls", "name": "Test", "color": "#FF0000"},
        )

        # Update multiple fields
        update_data = {
            "name": "Updated",
            "color": "#0000FF",
            "description": "Updated description",
            "order": 3,
        }
        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/classes/test_cls?task_type=detection",
            json=update_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["name"] == "Updated"
        assert data["color"] == "#0000FF"
        assert data["description"] == "Updated description"
        assert data["order"] == 3

    def test_update_class_project_not_found(
        self,
        authenticated_client,
    ):
        """
        Test updating class in non-existent project.

        Should return 404 Not Found.
        """
        update_data = {"name": "Updated"}
        response = authenticated_client.patch(
            "/api/v1/projects/proj_nonexistent/classes/test_cls?task_type=detection",
            json=update_data,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_class_unauthorized(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        test_dataset,
    ):
        """
        Test updating class when user is not the owner.

        Should return 403 Forbidden.
        """
        # Create project owned by different user
        project = create_project(
            labeler_db,
            project_id="proj_other",
            name="Other's Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id",
        )

        update_data = {"name": "Updated"}
        response = authenticated_client.patch(
            f"/api/v1/projects/{project.id}/classes/test_cls?task_type=detection",
            json=update_data,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_class_task_type_not_found(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test updating class with non-existent task type.

        Should return 404 Not Found.
        """
        update_data = {"name": "Updated"}
        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/classes/test_cls?task_type=nonexistent",
            json=update_data,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "task type" in response.json()["detail"].lower()

    def test_update_class_class_not_found(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test updating non-existent class.

        Should return 404 Not Found.
        """
        update_data = {"name": "Updated"}
        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/classes/nonexistent?task_type=detection",
            json=update_data,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "class" in response.json()["detail"].lower()

    def test_update_class_no_authentication(
        self,
        client,
        labeler_db,
        test_project,
    ):
        """
        Test updating class without authentication.

        Should return 401 Unauthorized.
        """
        update_data = {"name": "Updated"}
        response = client.patch(
            f"/api/v1/projects/{test_project.id}/classes/test_cls?task_type=detection",
            json=update_data,
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_update_class_empty_update(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test updating class with no fields specified.

        Should succeed but not change anything.
        """
        # Add a class first
        add_response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "test_cls", "name": "Original", "color": "#FF0000"},
        )
        original = add_response.json()

        # Update with empty body
        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}/classes/test_cls?task_type=detection",
            json={},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # All fields should remain unchanged
        assert data["name"] == original["name"]
        assert data["color"] == original["color"]


class TestDeleteClass:
    """Test cases for DELETE /api/v1/projects/{project_id}/classes/{class_id} endpoint."""

    def test_delete_class_success(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test successfully deleting an unused class.

        Should remove class from project.
        """
        # Add a class first
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "to_delete", "name": "To Delete", "color": "#FF0000"},
        )

        # Delete the class
        response = authenticated_client.delete(
            f"/api/v1/projects/{test_project.id}/classes/to_delete?task_type=detection",
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify class was removed
        labeler_db.refresh(test_project)
        assert "to_delete" not in test_project.task_classes.get("detection", {})

    def test_delete_class_with_annotations_conflict(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test deleting class that has annotations.

        Should return 409 Conflict and not delete class.
        """
        # Add a class first
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "in_use", "name": "In Use", "color": "#FF0000"},
        )

        # Create an annotation using this class
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_test_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"x": 100, "y": 100, "width": 200, "height": 200},
            class_id="in_use",
            class_name="In Use",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()

        # Try to delete the class
        response = authenticated_client.delete(
            f"/api/v1/projects/{test_project.id}/classes/in_use?task_type=detection",
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "cannot delete" in response.json()["detail"].lower()
        assert "annotation" in response.json()["detail"].lower()

        # Verify class was NOT removed
        labeler_db.refresh(test_project)
        assert "in_use" in test_project.task_classes["detection"]

    def test_delete_class_project_not_found(
        self,
        authenticated_client,
    ):
        """
        Test deleting class from non-existent project.

        Should return 404 Not Found.
        """
        response = authenticated_client.delete(
            "/api/v1/projects/proj_nonexistent/classes/test_cls?task_type=detection",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_class_unauthorized(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        test_dataset,
    ):
        """
        Test deleting class when user is not the owner.

        Should return 403 Forbidden.
        """
        # Create project owned by different user
        project = create_project(
            labeler_db,
            project_id="proj_other",
            name="Other's Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id",
        )

        response = authenticated_client.delete(
            f"/api/v1/projects/{project.id}/classes/test_cls?task_type=detection",
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_class_task_type_not_found(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test deleting class with non-existent task type.

        Should return 404 Not Found.
        """
        response = authenticated_client.delete(
            f"/api/v1/projects/{test_project.id}/classes/test_cls?task_type=nonexistent",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "task type" in response.json()["detail"].lower()

    def test_delete_class_class_not_found(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test deleting non-existent class.

        Should return 404 Not Found.
        """
        response = authenticated_client.delete(
            f"/api/v1/projects/{test_project.id}/classes/nonexistent?task_type=detection",
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "class" in response.json()["detail"].lower()

    def test_delete_class_no_authentication(
        self,
        client,
        labeler_db,
        test_project,
    ):
        """
        Test deleting class without authentication.

        Should return 401 Unauthorized.
        """
        response = client.delete(
            f"/api/v1/projects/{test_project.id}/classes/test_cls?task_type=detection",
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_delete_class_multiple_annotations(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test deleting class with multiple annotations.

        Should return 409 with annotation count.
        """
        # Add a class
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "popular", "name": "Popular", "color": "#FF0000"},
        )

        # Create multiple annotations
        for i in range(5):
            annotation = Annotation(
                project_id=test_project.id,
                image_id=f"img_test_{i:03d}",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 100, "y": 100, "width": 200, "height": 200},
                class_id="popular",
                class_name="Popular",
                version=1,
            )
            labeler_db.add(annotation)
        labeler_db.commit()

        # Try to delete
        response = authenticated_client.delete(
            f"/api/v1/projects/{test_project.id}/classes/popular?task_type=detection",
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "5" in response.json()["detail"]


class TestReorderClasses:
    """Test cases for PUT /api/v1/projects/{project_id}/classes/reorder endpoint."""

    def test_reorder_classes_success(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test successfully reordering classes.

        Should update order field for all classes.
        """
        # Add multiple classes
        class_ids = ["cls1", "cls2", "cls3"]
        for i, class_id in enumerate(class_ids):
            authenticated_client.post(
                f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
                json={"class_id": class_id, "name": f"Class {i+1}", "color": "#FF0000"},
            )

        # Reorder: reverse the order
        reorder_data = {"class_ids": ["cls3", "cls2", "cls1"]}
        response = authenticated_client.put(
            f"/api/v1/projects/{test_project.id}/classes/reorder?task_type=detection",
            json=reorder_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify returned list is in new order
        assert len(data) == 3
        assert data[0]["class_id"] == "cls3"
        assert data[0]["order"] == 0
        assert data[1]["class_id"] == "cls2"
        assert data[1]["order"] == 1
        assert data[2]["class_id"] == "cls1"
        assert data[2]["order"] == 2

        # Verify in database
        labeler_db.refresh(test_project)
        assert test_project.task_classes["detection"]["cls3"]["order"] == 0
        assert test_project.task_classes["detection"]["cls2"]["order"] == 1
        assert test_project.task_classes["detection"]["cls1"]["order"] == 2

    def test_reorder_classes_partial_list(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test reordering with partial list of classes.

        Should only update order for specified classes.
        """
        # Add multiple classes
        for i in range(1, 6):
            authenticated_client.post(
                f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
                json={"class_id": f"cls{i}", "name": f"Class {i}", "color": "#FF0000"},
            )

        # Reorder only 3 classes
        reorder_data = {"class_ids": ["cls3", "cls1", "cls5"]}
        response = authenticated_client.put(
            f"/api/v1/projects/{test_project.id}/classes/reorder?task_type=detection",
            json=reorder_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 3
        assert data[0]["class_id"] == "cls3"
        assert data[1]["class_id"] == "cls1"
        assert data[2]["class_id"] == "cls5"

    def test_reorder_classes_empty_list(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test reordering with empty list.

        Should succeed but not change anything.
        """
        # Add a class
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "cls1", "name": "Class 1", "color": "#FF0000"},
        )

        # Reorder with empty list
        reorder_data = {"class_ids": []}
        response = authenticated_client.put(
            f"/api/v1/projects/{test_project.id}/classes/reorder?task_type=detection",
            json=reorder_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0

    def test_reorder_classes_project_not_found(
        self,
        authenticated_client,
    ):
        """
        Test reordering classes in non-existent project.

        Should return 404 Not Found.
        """
        reorder_data = {"class_ids": ["cls1", "cls2"]}
        response = authenticated_client.put(
            "/api/v1/projects/proj_nonexistent/classes/reorder?task_type=detection",
            json=reorder_data,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_reorder_classes_unauthorized(
        self,
        authenticated_client,
        labeler_db,
        create_project,
        test_dataset,
    ):
        """
        Test reordering classes when user is not the owner.

        Should return 403 Forbidden.
        """
        # Create project owned by different user
        project = create_project(
            labeler_db,
            project_id="proj_other",
            name="Other's Project",
            dataset_id=test_dataset.id,
            owner_id="other-user-id",
        )

        reorder_data = {"class_ids": ["cls1", "cls2"]}
        response = authenticated_client.put(
            f"/api/v1/projects/{project.id}/classes/reorder?task_type=detection",
            json=reorder_data,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_reorder_classes_task_type_not_found(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test reordering classes with non-existent task type.

        Should return 404 Not Found.
        """
        reorder_data = {"class_ids": ["cls1", "cls2"]}
        response = authenticated_client.put(
            f"/api/v1/projects/{test_project.id}/classes/reorder?task_type=nonexistent",
            json=reorder_data,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "task type" in response.json()["detail"].lower()

    def test_reorder_classes_invalid_class_id(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test reordering with non-existent class_id.

        Should return 404 Not Found.
        """
        # Add one class
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={"class_id": "cls1", "name": "Class 1", "color": "#FF0000"},
        )

        # Try to reorder with invalid class_id
        reorder_data = {"class_ids": ["cls1", "nonexistent"]}
        response = authenticated_client.put(
            f"/api/v1/projects/{test_project.id}/classes/reorder?task_type=detection",
            json=reorder_data,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "class" in response.json()["detail"].lower()

    def test_reorder_classes_no_authentication(
        self,
        client,
        labeler_db,
        test_project,
    ):
        """
        Test reordering classes without authentication.

        Should return 401 Unauthorized.
        """
        reorder_data = {"class_ids": ["cls1", "cls2"]}
        response = client.put(
            f"/api/v1/projects/{test_project.id}/classes/reorder?task_type=detection",
            json=reorder_data,
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_reorder_classes_preserves_other_fields(
        self,
        authenticated_client,
        labeler_db,
        test_project,
    ):
        """
        Test that reordering preserves all other class fields.

        Should only change order field.
        """
        # Add classes with different attributes
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={
                "class_id": "cls1",
                "name": "Class 1",
                "color": "#FF0000",
                "description": "First class",
            },
        )
        authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/classes?task_type=detection",
            json={
                "class_id": "cls2",
                "name": "Class 2",
                "color": "#00FF00",
                "description": "Second class",
            },
        )

        # Reorder
        reorder_data = {"class_ids": ["cls2", "cls1"]}
        response = authenticated_client.put(
            f"/api/v1/projects/{test_project.id}/classes/reorder?task_type=detection",
            json=reorder_data,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify all fields preserved
        cls2 = data[0]
        assert cls2["class_id"] == "cls2"
        assert cls2["name"] == "Class 2"
        assert cls2["color"] == "#00FF00"
        assert cls2["description"] == "Second class"
        assert cls2["order"] == 0

        cls1 = data[1]
        assert cls1["class_id"] == "cls1"
        assert cls1["name"] == "Class 1"
        assert cls1["color"] == "#FF0000"
        assert cls1["description"] == "First class"
        assert cls1["order"] == 1
