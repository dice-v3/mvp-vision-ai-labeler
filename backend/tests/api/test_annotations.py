"""
Tests for annotation endpoints.

Tests the annotation-related endpoints including:
- POST /annotations - Create annotation
- GET /annotations/{annotation_id} - Get annotation by ID
- PUT /annotations/{annotation_id} - Update annotation
- DELETE /annotations/{annotation_id} - Delete annotation
- GET /annotations/project/{project_id} - List project annotations
- POST /annotations/batch - Batch create annotations
- GET /annotations/history/project/{project_id} - List project history
- GET /annotations/history/annotation/{annotation_id} - List annotation history
- POST /annotations/{annotation_id}/confirm - Confirm annotation
- POST /annotations/{annotation_id}/unconfirm - Unconfirm annotation
- POST /annotations/bulk-confirm - Bulk confirm annotations
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime, timedelta

from app.core.security import get_current_user
from app.db.models.labeler import (
    Annotation,
    AnnotationHistory,
    AnnotationProject,
    ProjectPermission,
    ImageLock,
)
from app.main import app


class TestCreateAnnotation:
    """Test cases for POST /api/v1/annotations endpoint."""

    def test_create_annotation_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test successful annotation creation with all fields.

        Should create annotation with draft state and return annotation details.
        """
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_001",
            "annotation_type": "bbox",
            "geometry": {
                "type": "bbox",
                "bbox": [100, 100, 50, 50],
            },
            "class_id": "cls_person",
            "class_name": "person",
            "attributes": {"occluded": False, "truncated": False},
            "confidence": 95,
            "notes": "Clear bounding box",
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status") as mock_update:
            response = authenticated_client.post(
                "/api/v1/annotations",
                json=annotation_data
            )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        # Verify annotation fields
        assert data["project_id"] == annotation_data["project_id"]
        assert data["image_id"] == annotation_data["image_id"]
        assert data["annotation_type"] == annotation_data["annotation_type"]
        assert data["geometry"] == annotation_data["geometry"]
        assert data["class_id"] == annotation_data["class_id"]
        assert data["class_name"] == annotation_data["class_name"]
        assert data["attributes"] == annotation_data["attributes"]
        assert data["confidence"] == annotation_data["confidence"]
        assert data["notes"] == annotation_data["notes"]
        assert data["created_by"] == mock_current_user["sub"]
        assert data["annotation_state"] == "draft"
        assert data["is_verified"] is False
        assert data["version"] == 1
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

        # Verify history entry was created
        history = labeler_db.query(AnnotationHistory).filter(
            AnnotationHistory.annotation_id == data["id"],
            AnnotationHistory.action == "create"
        ).first()
        assert history is not None
        assert history.new_state["annotation_type"] == "bbox"

        # Verify image status update was called
        mock_update.assert_called_once()

    def test_create_annotation_minimal_fields(self, authenticated_client, labeler_db, test_project):
        """
        Test annotation creation with minimal required fields.

        Should create annotation with default values for optional fields.
        """
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_002",
            "annotation_type": "bbox",
            "geometry": {
                "type": "bbox",
                "bbox": [50, 50, 30, 30],
            },
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.post(
                "/api/v1/annotations",
                json=annotation_data
            )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        # Verify minimal fields
        assert data["project_id"] == annotation_data["project_id"]
        assert data["image_id"] == annotation_data["image_id"]
        assert data["annotation_type"] == annotation_data["annotation_type"]
        assert data["annotation_state"] == "draft"
        assert data["class_id"] is None
        assert data["class_name"] is None
        assert data["confidence"] is None
        assert data["notes"] is None
        assert data["attributes"] == {}

    def test_create_annotation_no_object_type(self, authenticated_client, labeler_db, test_project):
        """
        Test creating a no_object annotation.

        Should automatically set state to confirmed.
        """
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_003",
            "annotation_type": "no_object",
            "geometry": {},
            "attributes": {"task_type": "detection"},
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.post(
                "/api/v1/annotations",
                json=annotation_data
            )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["annotation_state"] == "confirmed"

    def test_create_annotation_polygon(self, authenticated_client, test_project):
        """Test creating a polygon annotation."""
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_004",
            "annotation_type": "polygon",
            "geometry": {
                "type": "polygon",
                "points": [[10, 10], [20, 10], [20, 20], [10, 20]],
            },
            "class_id": "cls_car",
            "class_name": "car",
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.post(
                "/api/v1/annotations",
                json=annotation_data
            )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["annotation_type"] == "polygon"
        assert data["geometry"]["points"] == annotation_data["geometry"]["points"]

    def test_create_annotation_project_not_found(self, authenticated_client):
        """Test creating annotation for non-existent project."""
        annotation_data = {
            "project_id": "proj_nonexistent",
            "image_id": "img_001",
            "annotation_type": "bbox",
            "geometry": {"type": "bbox", "bbox": [0, 0, 10, 10]},
        }

        response = authenticated_client.post(
            "/api/v1/annotations",
            json=annotation_data
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_create_annotation_no_permission(self, client, labeler_db, test_project, create_project_permission):
        """Test creating annotation without project permission."""
        # Create a different user with no permission
        different_user = {
            "sub": "different-user-id",
            "preferred_username": "different_user",
            "email": "different@example.com",
            "name": "Different User",
            "roles": []
        }

        # Override authentication to return different user
        app.dependency_overrides[get_current_user] = lambda: different_user

        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_001",
            "annotation_type": "bbox",
            "geometry": {"type": "bbox", "bbox": [0, 0, 10, 10]},
        }

        response = client.post(
            "/api/v1/annotations",
            json=annotation_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Clean up override
        app.dependency_overrides.pop(get_current_user, None)

    def test_create_annotation_viewer_role_denied(self, client, labeler_db, test_project, create_project_permission):
        """Test that viewer role cannot create annotations."""
        viewer_user = {
            "sub": "viewer-user-id",
            "preferred_username": "viewer",
            "email": "viewer@example.com",
            "name": "Viewer User",
            "roles": []
        }

        # Create viewer permission
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=viewer_user["sub"],
            role="viewer"
        )

        # Override authentication
        app.dependency_overrides[get_current_user] = lambda: viewer_user

        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_001",
            "annotation_type": "bbox",
            "geometry": {"type": "bbox", "bbox": [0, 0, 10, 10]},
        }

        response = client.post(
            "/api/v1/annotations",
            json=annotation_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "annotator" in response.json()["detail"].lower()

        # Clean up
        app.dependency_overrides.pop(get_current_user, None)

    def test_create_annotation_annotator_role_success(self, client, labeler_db, test_project, create_project_permission):
        """Test that annotator role can create annotations."""
        annotator_user = {
            "sub": "annotator-user-id",
            "preferred_username": "annotator",
            "email": "annotator@example.com",
            "name": "Annotator User",
            "roles": []
        }

        # Create annotator permission
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=annotator_user["sub"],
            role="annotator"
        )

        # Override authentication
        app.dependency_overrides[get_current_user] = lambda: annotator_user

        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_001",
            "annotation_type": "bbox",
            "geometry": {"type": "bbox", "bbox": [0, 0, 10, 10]},
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = client.post(
                "/api/v1/annotations",
                json=annotation_data
            )

        assert response.status_code == status.HTTP_201_CREATED

        # Clean up
        app.dependency_overrides.pop(get_current_user, None)

    def test_create_annotation_image_locked_by_different_user(self, authenticated_client, labeler_db, test_project):
        """Test creating annotation when image is locked by different user."""
        # Create a lock for a different user
        lock = ImageLock(
            project_id=test_project.id,
            image_id="img_locked",
            user_id="different-user-id",
            acquired_at=datetime.utcnow(),
            heartbeat_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(minutes=5),
        )
        labeler_db.add(lock)
        labeler_db.commit()

        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_locked",
            "annotation_type": "bbox",
            "geometry": {"type": "bbox", "bbox": [0, 0, 10, 10]},
        }

        response = authenticated_client.post(
            "/api/v1/annotations",
            json=annotation_data
        )

        assert response.status_code == status.HTTP_423_LOCKED
        assert "locked" in response.json()["detail"].lower()

    def test_create_annotation_auto_acquires_lock(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test that creating annotation auto-acquires lock if none exists."""
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_unlocked",
            "annotation_type": "bbox",
            "geometry": {"type": "bbox", "bbox": [0, 0, 10, 10]},
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.post(
                "/api/v1/annotations",
                json=annotation_data
            )

        assert response.status_code == status.HTTP_201_CREATED

        # Verify lock was created
        lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == test_project.id,
            ImageLock.image_id == "img_unlocked"
        ).first()
        assert lock is not None
        assert lock.user_id == mock_current_user["sub"]

    def test_create_annotation_invalid_annotation_type(self, authenticated_client, test_project):
        """Test creating annotation with invalid annotation type."""
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_001",
            "annotation_type": "invalid_type",
            "geometry": {"type": "invalid", "data": []},
        }

        response = authenticated_client.post(
            "/api/v1/annotations",
            json=annotation_data
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_create_annotation_unauthenticated(self, client, test_project):
        """Test creating annotation without authentication."""
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_001",
            "annotation_type": "bbox",
            "geometry": {"type": "bbox", "bbox": [0, 0, 10, 10]},
        }

        response = client.post(
            "/api/v1/annotations",
            json=annotation_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestGetAnnotation:
    """Test cases for GET /api/v1/annotations/{annotation_id} endpoint."""

    def test_get_annotation_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test successful annotation retrieval."""
        # Create annotation
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            class_id="cls_person",
            class_name="person",
            attributes={"occluded": False},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        response = authenticated_client.get(
            f"/api/v1/annotations/{annotation.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == annotation.id
        assert data["project_id"] == test_project.id
        assert data["annotation_type"] == "bbox"
        assert data["class_id"] == "cls_person"
        assert data["annotation_state"] == "draft"
        assert data["version"] == 1

    def test_get_annotation_not_found(self, authenticated_client):
        """Test getting non-existent annotation."""
        response = authenticated_client.get(
            "/api/v1/annotations/999999"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_annotation_unauthenticated(self, client, labeler_db, test_project, mock_current_user):
        """Test getting annotation without authentication."""
        # Create annotation
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        response = client.get(
            f"/api/v1/annotations/{annotation.id}"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestUpdateAnnotation:
    """Test cases for PUT /api/v1/annotations/{annotation_id} endpoint."""

    def test_update_annotation_geometry(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test updating annotation geometry."""
        # Create annotation
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        update_data = {
            "geometry": {"type": "bbox", "bbox": [15, 15, 30, 30]},
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.put(
                f"/api/v1/annotations/{annotation.id}",
                json=update_data
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["geometry"]["bbox"] == [15, 15, 30, 30]
        assert data["version"] == 2  # Version incremented

        # Verify history entry
        history = labeler_db.query(AnnotationHistory).filter(
            AnnotationHistory.annotation_id == annotation.id,
            AnnotationHistory.action == "update"
        ).first()
        assert history is not None

    def test_update_annotation_class(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test updating annotation class."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            class_id="cls_person",
            class_name="person",
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        update_data = {
            "class_id": "cls_car",
            "class_name": "car",
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.put(
                f"/api/v1/annotations/{annotation.id}",
                json=update_data
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["class_id"] == "cls_car"
        assert data["class_name"] == "car"
        assert data["version"] == 2

    def test_update_annotation_multiple_fields(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test updating multiple annotation fields at once."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        update_data = {
            "geometry": {"type": "bbox", "bbox": [5, 5, 25, 25]},
            "class_id": "cls_bike",
            "class_name": "bike",
            "attributes": {"color": "red"},
            "confidence": 85,
            "notes": "Updated annotation",
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.put(
                f"/api/v1/annotations/{annotation.id}",
                json=update_data
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["geometry"]["bbox"] == [5, 5, 25, 25]
        assert data["class_id"] == "cls_bike"
        assert data["attributes"]["color"] == "red"
        assert data["confidence"] == 85
        assert data["notes"] == "Updated annotation"

    def test_update_annotation_optimistic_locking_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test optimistic locking with correct version."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        update_data = {
            "geometry": {"type": "bbox", "bbox": [15, 15, 25, 25]},
            "version": 1,  # Correct version
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.put(
                f"/api/v1/annotations/{annotation.id}",
                json=update_data
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["version"] == 2

    def test_update_annotation_optimistic_locking_conflict(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test optimistic locking conflict with stale version."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=3,  # Current version is 3
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        update_data = {
            "geometry": {"type": "bbox", "bbox": [15, 15, 25, 25]},
            "version": 1,  # Stale version
        }

        response = authenticated_client.put(
            f"/api/v1/annotations/{annotation.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        data = response.json()
        assert "detail" in data
        detail = data["detail"]
        assert detail["error"] == "conflict"
        assert detail["current_version"] == 3
        assert detail["your_version"] == 1

    def test_update_annotation_not_found(self, authenticated_client):
        """Test updating non-existent annotation."""
        update_data = {
            "geometry": {"type": "bbox", "bbox": [0, 0, 10, 10]},
        }

        response = authenticated_client.put(
            "/api/v1/annotations/999999",
            json=update_data
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_annotation_not_creator_nor_owner(self, client, labeler_db, test_project):
        """Test that non-creator, non-owner cannot update annotation."""
        # Create annotation by user1
        user1_id = "user1-id"
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=user1_id,
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        # Try to update as user2 (not creator, not owner)
        user2 = {
            "sub": "user2-id",
            "preferred_username": "user2",
            "email": "user2@example.com",
            "name": "User 2",
            "roles": []
        }
        app.dependency_overrides[get_current_user] = lambda: user2

        update_data = {
            "geometry": {"type": "bbox", "bbox": [15, 15, 25, 25]},
        }

        response = client.put(
            f"/api/v1/annotations/{annotation.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Clean up
        app.dependency_overrides.pop(get_current_user, None)

    def test_update_annotation_owner_can_update_any(self, client, labeler_db, test_project, test_user_id):
        """Test that project owner can update any annotation."""
        # Create annotation by different user
        other_user_id = "other-user-id"
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=other_user_id,
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        # Update as project owner (test_user_id is the owner)
        owner = {
            "sub": test_user_id,
            "preferred_username": "owner",
            "email": "owner@example.com",
            "name": "Owner",
            "roles": []
        }
        app.dependency_overrides[get_current_user] = lambda: owner

        update_data = {
            "geometry": {"type": "bbox", "bbox": [15, 15, 25, 25]},
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = client.put(
                f"/api/v1/annotations/{annotation.id}",
                json=update_data
            )

        assert response.status_code == status.HTTP_200_OK

        # Clean up
        app.dependency_overrides.pop(get_current_user, None)

    def test_update_annotation_image_locked_by_different_user(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test updating annotation when image is locked by different user."""
        # Create annotation
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_locked",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        # Create lock for different user
        lock = ImageLock(
            project_id=test_project.id,
            image_id="img_locked",
            user_id="different-user-id",
            acquired_at=datetime.utcnow(),
            heartbeat_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(minutes=5),
        )
        labeler_db.add(lock)
        labeler_db.commit()

        update_data = {
            "geometry": {"type": "bbox", "bbox": [15, 15, 25, 25]},
        }

        response = authenticated_client.put(
            f"/api/v1/annotations/{annotation.id}",
            json=update_data
        )

        assert response.status_code == status.HTTP_423_LOCKED


class TestDeleteAnnotation:
    """Test cases for DELETE /api/v1/annotations/{annotation_id} endpoint."""

    def test_delete_annotation_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test successful annotation deletion."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)
        annotation_id = annotation.id

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.delete(
                f"/api/v1/annotations/{annotation_id}"
            )

        assert response.status_code == status.HTTP_200_OK
        assert "deleted successfully" in response.json()["message"]

        # Verify annotation is deleted
        deleted = labeler_db.query(Annotation).filter(Annotation.id == annotation_id).first()
        assert deleted is None

        # Verify history entry was created
        history = labeler_db.query(AnnotationHistory).filter(
            AnnotationHistory.annotation_id == annotation_id,
            AnnotationHistory.action == "delete"
        ).first()
        assert history is not None

    def test_delete_annotation_not_found(self, authenticated_client):
        """Test deleting non-existent annotation."""
        response = authenticated_client.delete(
            "/api/v1/annotations/999999"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_annotation_not_creator_nor_owner(self, client, labeler_db, test_project):
        """Test that non-creator, non-owner cannot delete annotation."""
        user1_id = "user1-id"
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=user1_id,
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        # Try to delete as user2
        user2 = {
            "sub": "user2-id",
            "preferred_username": "user2",
            "email": "user2@example.com",
            "name": "User 2",
            "roles": []
        }
        app.dependency_overrides[get_current_user] = lambda: user2

        response = client.delete(
            f"/api/v1/annotations/{annotation.id}"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Clean up
        app.dependency_overrides.pop(get_current_user, None)

    def test_delete_annotation_owner_can_delete_any(self, client, labeler_db, test_project, test_user_id):
        """Test that project owner can delete any annotation."""
        other_user_id = "other-user-id"
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=other_user_id,
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        # Delete as project owner
        owner = {
            "sub": test_user_id,
            "preferred_username": "owner",
            "email": "owner@example.com",
            "name": "Owner",
            "roles": []
        }
        app.dependency_overrides[get_current_user] = lambda: owner

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = client.delete(
                f"/api/v1/annotations/{annotation.id}"
            )

        assert response.status_code == status.HTTP_200_OK

        # Clean up
        app.dependency_overrides.pop(get_current_user, None)

    def test_delete_annotation_image_locked_by_different_user(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test deleting annotation when image is locked by different user."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_locked",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        # Create lock for different user
        lock = ImageLock(
            project_id=test_project.id,
            image_id="img_locked",
            user_id="different-user-id",
            acquired_at=datetime.utcnow(),
            heartbeat_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(minutes=5),
        )
        labeler_db.add(lock)
        labeler_db.commit()

        response = authenticated_client.delete(
            f"/api/v1/annotations/{annotation.id}"
        )

        assert response.status_code == status.HTTP_423_LOCKED


class TestListProjectAnnotations:
    """Test cases for GET /api/v1/annotations/project/{project_id} endpoint."""

    def test_list_annotations_empty(self, authenticated_client, test_project):
        """Test listing annotations for project with no annotations."""
        response = authenticated_client.get(
            f"/api/v1/annotations/project/{test_project.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json() == []

    def test_list_annotations_multiple(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test listing multiple annotations."""
        # Create multiple annotations
        for i in range(5):
            annotation = Annotation(
                project_id=test_project.id,
                image_id=f"img_{i:03d}",
                annotation_type="bbox",
                task_type="detection",
                geometry={"type": "bbox", "bbox": [i*10, i*10, 20, 20]},
                created_by=mock_current_user["sub"],
                annotation_state="draft",
                version=1,
            )
            labeler_db.add(annotation)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/annotations/project/{test_project.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 5

    def test_list_annotations_filter_by_image(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test filtering annotations by image_id."""
        # Create annotations for different images
        for i in range(3):
            annotation = Annotation(
                project_id=test_project.id,
                image_id="img_target",
                annotation_type="bbox",
                task_type="detection",
                geometry={"type": "bbox", "bbox": [i*10, i*10, 20, 20]},
                created_by=mock_current_user["sub"],
                annotation_state="draft",
                version=1,
            )
            labeler_db.add(annotation)

        # Create annotations for other images
        for i in range(2):
            annotation = Annotation(
                project_id=test_project.id,
                image_id=f"img_other_{i}",
                annotation_type="bbox",
                task_type="detection",
                geometry={"type": "bbox", "bbox": [i*10, i*10, 20, 20]},
                created_by=mock_current_user["sub"],
                annotation_state="draft",
                version=1,
            )
            labeler_db.add(annotation)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/annotations/project/{test_project.id}?image_id=img_target"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 3
        for ann in data:
            assert ann["image_id"] == "img_target"

    def test_list_annotations_pagination(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test annotation listing with pagination."""
        # Create 15 annotations
        for i in range(15):
            annotation = Annotation(
                project_id=test_project.id,
                image_id=f"img_{i:03d}",
                annotation_type="bbox",
                task_type="detection",
                geometry={"type": "bbox", "bbox": [i*10, i*10, 20, 20]},
                created_by=mock_current_user["sub"],
                annotation_state="draft",
                version=1,
            )
            labeler_db.add(annotation)
        labeler_db.commit()

        # Test first page
        response = authenticated_client.get(
            f"/api/v1/annotations/project/{test_project.id}?skip=0&limit=10"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 10

        # Test second page
        response = authenticated_client.get(
            f"/api/v1/annotations/project/{test_project.id}?skip=10&limit=10"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 5

    def test_list_annotations_max_limit(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test that limit is capped at 1000."""
        # Create a few annotations
        for i in range(5):
            annotation = Annotation(
                project_id=test_project.id,
                image_id=f"img_{i:03d}",
                annotation_type="bbox",
                task_type="detection",
                geometry={"type": "bbox", "bbox": [i*10, i*10, 20, 20]},
                created_by=mock_current_user["sub"],
                annotation_state="draft",
                version=1,
            )
            labeler_db.add(annotation)
        labeler_db.commit()

        # Request with very high limit
        response = authenticated_client.get(
            f"/api/v1/annotations/project/{test_project.id}?limit=5000"
        )

        assert response.status_code == status.HTTP_200_OK
        # Should return all 5, not fail
        assert len(response.json()) == 5

    def test_list_annotations_requires_viewer_permission(self, client, labeler_db, test_project):
        """Test that viewer permission is required."""
        # User with no permission
        user = {
            "sub": "no-permission-user",
            "preferred_username": "user",
            "email": "user@example.com",
            "name": "User",
            "roles": []
        }
        app.dependency_overrides[get_current_user] = lambda: user

        response = client.get(
            f"/api/v1/annotations/project/{test_project.id}"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Clean up
        app.dependency_overrides.pop(get_current_user, None)


class TestBatchCreateAnnotations:
    """Test cases for POST /api/v1/annotations/batch endpoint."""

    def test_batch_create_success(self, authenticated_client, labeler_db, test_project):
        """Test successful batch creation of annotations."""
        batch_data = {
            "annotations": [
                {
                    "project_id": test_project.id,
                    "image_id": "img_001",
                    "annotation_type": "bbox",
                    "geometry": {"type": "bbox", "bbox": [10, 10, 20, 20]},
                    "class_id": "cls_person",
                    "class_name": "person",
                },
                {
                    "project_id": test_project.id,
                    "image_id": "img_002",
                    "annotation_type": "bbox",
                    "geometry": {"type": "bbox", "bbox": [30, 30, 40, 40]},
                    "class_id": "cls_car",
                    "class_name": "car",
                },
                {
                    "project_id": test_project.id,
                    "image_id": "img_003",
                    "annotation_type": "polygon",
                    "geometry": {"type": "polygon", "points": [[0, 0], [10, 0], [10, 10], [0, 10]]},
                    "class_id": "cls_bike",
                    "class_name": "bike",
                },
            ]
        }

        response = authenticated_client.post(
            "/api/v1/annotations/batch",
            json=batch_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["created"] == 3
        assert data["failed"] == 0
        assert len(data["annotation_ids"]) == 3
        assert data["errors"] == []

        # Verify annotations were created
        annotations = labeler_db.query(Annotation).filter(
            Annotation.project_id == test_project.id
        ).all()
        assert len(annotations) == 3

    def test_batch_create_partial_success(self, authenticated_client, labeler_db, test_project):
        """Test batch creation with some failures."""
        batch_data = {
            "annotations": [
                {
                    "project_id": test_project.id,
                    "image_id": "img_001",
                    "annotation_type": "bbox",
                    "geometry": {"type": "bbox", "bbox": [10, 10, 20, 20]},
                },
                {
                    "project_id": "proj_nonexistent",  # Non-existent project
                    "image_id": "img_002",
                    "annotation_type": "bbox",
                    "geometry": {"type": "bbox", "bbox": [30, 30, 40, 40]},
                },
                {
                    "project_id": test_project.id,
                    "image_id": "img_003",
                    "annotation_type": "bbox",
                    "geometry": {"type": "bbox", "bbox": [50, 50, 60, 60]},
                },
            ]
        }

        response = authenticated_client.post(
            "/api/v1/annotations/batch",
            json=batch_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["created"] == 2
        assert data["failed"] == 1
        assert len(data["annotation_ids"]) == 2
        assert len(data["errors"]) == 1
        assert "not found" in data["errors"][0].lower()

    def test_batch_create_no_object_annotations(self, authenticated_client, labeler_db, test_project):
        """Test batch creation with no_object annotations."""
        batch_data = {
            "annotations": [
                {
                    "project_id": test_project.id,
                    "image_id": "img_001",
                    "annotation_type": "no_object",
                    "geometry": {},
                    "attributes": {"task_type": "detection"},
                },
                {
                    "project_id": test_project.id,
                    "image_id": "img_002",
                    "annotation_type": "no_object",
                    "geometry": {},
                    "attributes": {"task_type": "detection"},
                },
            ]
        }

        response = authenticated_client.post(
            "/api/v1/annotations/batch",
            json=batch_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["created"] == 2

        # Verify no_object annotations are automatically confirmed
        annotations = labeler_db.query(Annotation).filter(
            Annotation.project_id == test_project.id
        ).all()
        for ann in annotations:
            assert ann.annotation_state == "confirmed"

    def test_batch_create_requires_annotator_permission(self, client, labeler_db, test_project, create_project_permission):
        """Test that batch create requires annotator permission."""
        viewer_user = {
            "sub": "viewer-user-id",
            "preferred_username": "viewer",
            "email": "viewer@example.com",
            "name": "Viewer",
            "roles": []
        }

        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=viewer_user["sub"],
            role="viewer"
        )

        app.dependency_overrides[get_current_user] = lambda: viewer_user

        batch_data = {
            "annotations": [
                {
                    "project_id": test_project.id,
                    "image_id": "img_001",
                    "annotation_type": "bbox",
                    "geometry": {"type": "bbox", "bbox": [10, 10, 20, 20]},
                },
            ]
        }

        response = client.post(
            "/api/v1/annotations/batch",
            json=batch_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # All should fail due to insufficient permissions
        assert data["created"] == 0
        assert data["failed"] == 1

        # Clean up
        app.dependency_overrides.pop(get_current_user, None)


class TestAnnotationHistory:
    """Test cases for annotation history endpoints."""

    def test_list_project_history(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test listing annotation history for a project."""
        # Create annotation and history entries
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        # Create history entries
        history1 = AnnotationHistory(
            annotation_id=annotation.id,
            project_id=test_project.id,
            action="create",
            new_state={"annotation_type": "bbox"},
            changed_by=mock_current_user["sub"],
            timestamp=datetime.utcnow(),
        )
        history2 = AnnotationHistory(
            annotation_id=annotation.id,
            project_id=test_project.id,
            action="update",
            previous_state={"geometry": {"bbox": [10, 10, 20, 20]}},
            new_state={"geometry": {"bbox": [15, 15, 25, 25]}},
            changed_by=mock_current_user["sub"],
            timestamp=datetime.utcnow(),
        )
        labeler_db.add(history1)
        labeler_db.add(history2)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/annotations/history/project/{test_project.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 2
        assert data[0]["action"] in ["create", "update"]

    def test_list_project_history_pagination(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test pagination of project history."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        # Create multiple history entries
        for i in range(15):
            history = AnnotationHistory(
                annotation_id=annotation.id,
                project_id=test_project.id,
                action="update",
                previous_state={},
                new_state={},
                changed_by=mock_current_user["sub"],
                timestamp=datetime.utcnow(),
            )
            labeler_db.add(history)
        labeler_db.commit()

        # Test with limit
        response = authenticated_client.get(
            f"/api/v1/annotations/history/project/{test_project.id}?limit=10"
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 10

    def test_list_annotation_history(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test listing history for a specific annotation."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        # Create history entries
        for action in ["create", "update", "update"]:
            history = AnnotationHistory(
                annotation_id=annotation.id,
                project_id=test_project.id,
                action=action,
                new_state={},
                changed_by=mock_current_user["sub"],
                timestamp=datetime.utcnow(),
            )
            labeler_db.add(history)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/annotations/history/annotation/{annotation.id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 3
        for entry in data:
            assert entry["annotation_id"] == annotation.id


class TestConfirmAnnotation:
    """Test cases for annotation confirmation endpoints."""

    def test_confirm_annotation_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test confirming an annotation."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.post(
                f"/api/v1/annotations/{annotation.id}/confirm"
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["annotation_id"] == annotation.id
        assert data["annotation_state"] == "confirmed"
        assert data["confirmed_by"] == mock_current_user["sub"]
        assert data["confirmed_at"] is not None

        # Verify in database
        labeler_db.refresh(annotation)
        assert annotation.annotation_state == "confirmed"
        assert annotation.confirmed_by == mock_current_user["sub"]
        assert annotation.version == 2  # Version incremented

    def test_confirm_annotation_not_found(self, authenticated_client):
        """Test confirming non-existent annotation."""
        response = authenticated_client.post(
            "/api/v1/annotations/999999/confirm"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_unconfirm_annotation_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test unconfirming an annotation."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="confirmed",
            confirmed_by=mock_current_user["sub"],
            confirmed_at=datetime.utcnow(),
            version=2,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.post(
                f"/api/v1/annotations/{annotation.id}/unconfirm"
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["annotation_id"] == annotation.id
        assert data["annotation_state"] == "draft"
        assert data["confirmed_by"] is None
        assert data["confirmed_at"] is None

        # Verify in database
        labeler_db.refresh(annotation)
        assert annotation.annotation_state == "draft"
        assert annotation.confirmed_by is None
        assert annotation.confirmed_at is None
        assert annotation.version == 3

    def test_bulk_confirm_annotations_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test bulk confirming multiple annotations."""
        # Create multiple draft annotations
        annotation_ids = []
        for i in range(5):
            annotation = Annotation(
                project_id=test_project.id,
                image_id=f"img_{i:03d}",
                annotation_type="bbox",
                task_type="detection",
                geometry={"type": "bbox", "bbox": [i*10, i*10, 20, 20]},
                created_by=mock_current_user["sub"],
                annotation_state="draft",
                version=1,
            )
            labeler_db.add(annotation)
            labeler_db.flush()
            annotation_ids.append(annotation.id)
        labeler_db.commit()

        bulk_data = {
            "annotation_ids": annotation_ids
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.post(
                "/api/v1/annotations/bulk-confirm",
                json=bulk_data
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["confirmed"] == 5
        assert data["failed"] == 0
        assert len(data["results"]) == 5
        assert data["errors"] == []

        # Verify all are confirmed in database
        annotations = labeler_db.query(Annotation).filter(
            Annotation.id.in_(annotation_ids)
        ).all()
        for ann in annotations:
            assert ann.annotation_state == "confirmed"
            assert ann.confirmed_by == mock_current_user["sub"]

    def test_bulk_confirm_partial_failure(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test bulk confirm with some non-existent annotations."""
        # Create one annotation
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        bulk_data = {
            "annotation_ids": [annotation.id, 999998, 999999]
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.post(
                "/api/v1/annotations/bulk-confirm",
                json=bulk_data
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["confirmed"] == 1
        assert data["failed"] == 2
        assert len(data["errors"]) == 2


class TestAnnotationValidation:
    """Test cases for annotation validation and edge cases."""

    def test_create_annotation_missing_required_fields(self, authenticated_client, test_project):
        """Test creating annotation with missing required fields."""
        # Missing geometry
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_001",
            "annotation_type": "bbox",
        }

        response = authenticated_client.post(
            "/api/v1/annotations",
            json=annotation_data
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_annotation_invalid_geometry(self, authenticated_client, test_project):
        """Test creating annotation with invalid geometry."""
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_001",
            "annotation_type": "bbox",
            "geometry": "invalid",  # Should be dict
        }

        response = authenticated_client.post(
            "/api/v1/annotations",
            json=annotation_data
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_annotation_empty_update(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """Test updating annotation with no fields to update."""
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            task_type="detection",
            geometry={"type": "bbox", "bbox": [10, 10, 20, 20]},
            created_by=mock_current_user["sub"],
            annotation_state="draft",
            version=1,
        )
        labeler_db.add(annotation)
        labeler_db.commit()
        labeler_db.refresh(annotation)

        update_data = {}

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.put(
                f"/api/v1/annotations/{annotation.id}",
                json=update_data
            )

        # Should still succeed, just increments version
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["version"] == 2

    def test_create_annotation_with_confidence_range(self, authenticated_client, test_project):
        """Test creating annotation with confidence values."""
        # Test valid confidence
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_001",
            "annotation_type": "bbox",
            "geometry": {"type": "bbox", "bbox": [10, 10, 20, 20]},
            "confidence": 85,
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.post(
                "/api/v1/annotations",
                json=annotation_data
            )

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["confidence"] == 85

    def test_annotation_task_type_inference(self, authenticated_client, labeler_db, test_project):
        """Test that task_type is correctly inferred and stored."""
        annotation_data = {
            "project_id": test_project.id,
            "image_id": "img_001",
            "annotation_type": "bbox",
            "geometry": {"type": "bbox", "bbox": [10, 10, 20, 20]},
        }

        with patch("app.api.v1.endpoints.annotations.update_image_status"):
            response = authenticated_client.post(
                "/api/v1/annotations",
                json=annotation_data
            )

        assert response.status_code == status.HTTP_201_CREATED
        annotation_id = response.json()["id"]

        # Verify task_type was stored in database
        annotation = labeler_db.query(Annotation).filter(Annotation.id == annotation_id).first()
        assert annotation.task_type is not None
        # For bbox, task_type should be "detection"
        assert annotation.task_type == "detection"
