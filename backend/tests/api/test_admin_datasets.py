"""
Tests for admin dataset endpoints.

Tests the admin-only endpoints for dataset management and monitoring:
- GET /api/v1/admin/datasets/overview - Dataset overview statistics
- GET /api/v1/admin/datasets/recent - Recent dataset updates
- GET /api/v1/admin/datasets/{dataset_id}/details - Dataset detail statistics
- GET /api/v1/admin/datasets/{dataset_id}/progress - Labeling progress statistics
- GET /api/v1/admin/datasets/{dataset_id}/activity - Recent activity timeline

All endpoints require admin privileges (is_admin = True).
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json

from app.db.models.labeler import (
    Dataset,
    AnnotationProject,
    Annotation,
    ImageAnnotationStatus,
    ImageMetadata,
    ProjectPermission,
)
from app.main import app


# =============================================================================
# Test Dataset Overview Endpoint
# =============================================================================


class TestGetDatasetsOverview:
    """Tests for GET /api/v1/admin/datasets/overview."""

    def test_get_overview_empty_database(self, admin_client, labeler_db):
        """Test overview with no datasets."""
        response = admin_client.get("/api/v1/admin/datasets/overview")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_datasets"] == 0
        assert data["total_images"] == 0
        assert data["total_size_bytes"] == 0
        assert data["total_annotations"] == 0
        assert data["datasets_by_status"] == {}

    def test_get_overview_with_single_dataset(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test overview with a single dataset."""
        # Create dataset
        dataset = Dataset(
            id="ds_001",
            name="Test Dataset",
            owner_id=test_user_id,
            storage_path="s3://bucket/ds_001",
            storage_type="s3",
            format="images",
            num_images=100,
            status="active",
            visibility="private",
        )
        labeler_db.add(dataset)
        labeler_db.commit()

        # Create image metadata
        for i in range(5):
            img = ImageMetadata(
                id=f"img_{i:03d}.jpg",
                dataset_id=dataset.id,
                file_name=f"img_{i:03d}.jpg",
                s3_key=f"ds_001/img_{i:03d}.jpg",
                size=1024 * 1024,  # 1 MB
            )
            labeler_db.add(img)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/overview")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_datasets"] == 1
        assert data["total_images"] == 100
        assert data["total_size_bytes"] == 5 * 1024 * 1024  # 5 MB
        assert data["total_annotations"] == 0
        assert data["datasets_by_status"]["active"] == 1

    def test_get_overview_with_multiple_datasets(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test overview with multiple datasets and different statuses."""
        # Create datasets with different statuses
        statuses = ["active", "active", "active", "completed", "completed", "archived"]
        for i, status_val in enumerate(statuses):
            dataset = Dataset(
                id=f"ds_{i:03d}",
                name=f"Dataset {i}",
                owner_id=test_user_id,
                storage_path=f"s3://bucket/ds_{i:03d}",
                storage_type="s3",
                format="images",
                num_images=50 * (i + 1),
                status=status_val,
                visibility="private",
            )
            labeler_db.add(dataset)
        labeler_db.commit()

        # Create some image metadata
        for i in range(3):
            img = ImageMetadata(
                id=f"img_{i:03d}.jpg",
                dataset_id="ds_000",
                file_name=f"img_{i:03d}.jpg",
                s3_key=f"ds_000/img_{i:03d}.jpg",
                size=2048 * 1024,  # 2 MB
            )
            labeler_db.add(img)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/overview")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_datasets"] == 6
        assert data["total_images"] == 50 + 100 + 150 + 200 + 250 + 300  # Sum of num_images
        assert data["total_size_bytes"] == 3 * 2048 * 1024  # 6 MB
        assert data["total_annotations"] == 0
        assert data["datasets_by_status"]["active"] == 3
        assert data["datasets_by_status"]["completed"] == 2
        assert data["datasets_by_status"]["archived"] == 1

    def test_get_overview_with_annotations(
        self, admin_client, labeler_db, test_user_id, create_dataset, create_project
    ):
        """Test overview with datasets that have annotations."""
        # Create dataset and project
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_with_annotations",
            name="Dataset with Annotations",
            owner_id=test_user_id,
            num_images=10,
        )

        project = create_project(
            labeler_db,
            project_id="proj_001",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            task_types=["detection"],
        )

        # Create annotations
        for i in range(10):
            annotation = Annotation(
                project_id=project.id,
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                class_id="cls_001",
                class_name="person",
                created_by=test_user_id,
            )
            labeler_db.add(annotation)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/overview")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_datasets"] == 1
        assert data["total_annotations"] == 10

    def test_get_overview_requires_admin(self, authenticated_client, labeler_db):
        """Test that overview endpoint requires admin privileges."""
        response = authenticated_client.get("/api/v1/admin/datasets/overview")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_overview_unauthenticated(self, client, labeler_db):
        """Test that overview endpoint requires authentication."""
        response = client.get("/api/v1/admin/datasets/overview")

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test Recent Datasets Endpoint
# =============================================================================


class TestGetRecentDatasets:
    """Tests for GET /api/v1/admin/datasets/recent."""

    def test_get_recent_empty(self, admin_client, labeler_db):
        """Test recent datasets with empty database."""
        response = admin_client.get("/api/v1/admin/datasets/recent")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_recent_default_limit(self, admin_client, labeler_db, test_user_id):
        """Test recent datasets with default limit (10)."""
        # Create 15 datasets with different update times
        base_time = datetime.utcnow()
        for i in range(15):
            dataset = Dataset(
                id=f"ds_{i:03d}",
                name=f"Dataset {i}",
                owner_id=test_user_id,
                storage_path=f"s3://bucket/ds_{i:03d}",
                storage_type="s3",
                format="images",
                num_images=10,
                status="active",
                visibility="private",
                created_at=base_time - timedelta(hours=15 - i),
                updated_at=base_time - timedelta(hours=15 - i),
            )
            labeler_db.add(dataset)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/recent")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert isinstance(data, list)
        assert len(data) == 10  # Default limit

        # Verify sorted by updated_at descending (most recent first)
        assert data[0]["dataset_id"] == "ds_014"
        assert data[9]["dataset_id"] == "ds_005"

    def test_get_recent_custom_limit(self, admin_client, labeler_db, test_user_id):
        """Test recent datasets with custom limit."""
        # Create 10 datasets
        base_time = datetime.utcnow()
        for i in range(10):
            dataset = Dataset(
                id=f"ds_{i:03d}",
                name=f"Dataset {i}",
                owner_id=test_user_id,
                storage_path=f"s3://bucket/ds_{i:03d}",
                storage_type="s3",
                format="images",
                num_images=10,
                status="active",
                visibility="private",
                created_at=base_time - timedelta(hours=10 - i),
                updated_at=base_time - timedelta(hours=10 - i),
            )
            labeler_db.add(dataset)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/recent?limit=5")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 5
        assert data[0]["dataset_id"] == "ds_009"

    def test_get_recent_limit_validation_min(self, admin_client, labeler_db):
        """Test recent datasets with limit below minimum (1)."""
        response = admin_client.get("/api/v1/admin/datasets/recent?limit=0")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_recent_limit_validation_max(self, admin_client, labeler_db):
        """Test recent datasets with limit above maximum (100)."""
        response = admin_client.get("/api/v1/admin/datasets/recent?limit=101")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_recent_response_structure(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test response structure of recent datasets."""
        dataset = Dataset(
            id="ds_test",
            name="Test Dataset",
            owner_id=test_user_id,
            storage_path="s3://bucket/ds_test",
            storage_type="s3",
            format="images",
            num_images=50,
            status="active",
            visibility="private",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        labeler_db.add(dataset)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/recent")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 1
        dataset_info = data[0]

        # Verify required fields
        assert dataset_info["dataset_id"] == "ds_test"
        assert dataset_info["name"] == "Test Dataset"
        assert dataset_info["status"] == "active"
        assert dataset_info["num_images"] == 50
        assert "last_updated" in dataset_info
        # updated_by is None because user DB is not available
        assert dataset_info["updated_by"] is None

    def test_get_recent_requires_admin(self, authenticated_client, labeler_db):
        """Test that recent endpoint requires admin privileges."""
        response = authenticated_client.get("/api/v1/admin/datasets/recent")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_recent_unauthenticated(self, client, labeler_db):
        """Test that recent endpoint requires authentication."""
        response = client.get("/api/v1/admin/datasets/recent")

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test Dataset Details Endpoint
# =============================================================================


class TestGetDatasetDetails:
    """Tests for GET /api/v1/admin/datasets/{dataset_id}/details."""

    def test_get_details_success(
        self, admin_client, labeler_db, test_user_id, create_dataset
    ):
        """Test successful dataset details retrieval."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_details",
            name="Details Dataset",
            owner_id=test_user_id,
            description="A dataset for testing details",
            num_images=20,
            status="active",
        )

        response = admin_client.get("/api/v1/admin/datasets/ds_details/details")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify dataset info
        assert "dataset" in data
        assert data["dataset"]["id"] == "ds_details"
        assert data["dataset"]["name"] == "Details Dataset"
        assert data["dataset"]["description"] == "A dataset for testing details"
        assert data["dataset"]["status"] == "active"
        assert data["dataset"]["owner_id"] == test_user_id

        # Verify projects list
        assert "projects" in data
        assert isinstance(data["projects"], list)

        # Verify storage info
        assert "storage_info" in data

    def test_get_details_with_projects(
        self, admin_client, labeler_db, test_user_id, create_dataset, create_project
    ):
        """Test dataset details with associated projects."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_with_projects",
            name="Dataset with Projects",
            owner_id=test_user_id,
        )

        # Create multiple projects
        project1 = create_project(
            labeler_db,
            project_id="proj_001",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            name="Project 1",
            task_types=["detection"],
        )

        project2 = create_project(
            labeler_db,
            project_id="proj_002",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            name="Project 2",
            task_types=["segmentation"],
        )

        # Create annotations for project1
        for i in range(5):
            annotation = Annotation(
                project_id=project1.id,
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                class_id="cls_001",
            )
            labeler_db.add(annotation)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/ds_with_projects/details")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data["projects"]) == 2

        # Find project1 in results
        proj1_data = next(p for p in data["projects"] if p["project_id"] == "proj_001")
        assert proj1_data["name"] == "Project 1"
        assert proj1_data["task_types"] == ["detection"]
        assert proj1_data["annotation_count"] == 5

        proj2_data = next(p for p in data["projects"] if p["project_id"] == "proj_002")
        assert proj2_data["name"] == "Project 2"
        assert proj2_data["task_types"] == ["segmentation"]
        assert proj2_data["annotation_count"] == 0

    def test_get_details_with_storage_info(
        self, admin_client, labeler_db, test_user_id, create_dataset
    ):
        """Test dataset details with storage information."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_storage",
            name="Storage Dataset",
            owner_id=test_user_id,
        )

        # Create image metadata
        for i in range(10):
            img = ImageMetadata(
                id=f"img_{i:03d}.jpg",
                dataset_id=dataset.id,
                file_name=f"img_{i:03d}.jpg",
                s3_key=f"ds_storage/img_{i:03d}.jpg",
                size=1024 * 1024 * (i + 1),  # 1 MB to 10 MB
            )
            labeler_db.add(img)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/ds_storage/details")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        storage_info = data["storage_info"]
        assert storage_info["image_count"] == 10
        assert storage_info["total_size_bytes"] == sum(
            1024 * 1024 * (i + 1) for i in range(10)
        )
        assert storage_info["avg_size_bytes"] > 0

    def test_get_details_dataset_not_found(self, admin_client, labeler_db):
        """Test dataset details for non-existent dataset."""
        response = admin_client.get("/api/v1/admin/datasets/ds_nonexistent/details")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_get_details_response_structure(
        self, admin_client, labeler_db, test_user_id, create_dataset
    ):
        """Test complete response structure."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_structure",
            name="Structure Dataset",
            owner_id=test_user_id,
            description="Testing structure",
        )

        response = admin_client.get("/api/v1/admin/datasets/ds_structure/details")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify all top-level keys
        assert "dataset" in data
        assert "projects" in data
        assert "storage_info" in data

        # Verify dataset structure
        dataset_info = data["dataset"]
        assert "id" in dataset_info
        assert "name" in dataset_info
        assert "description" in dataset_info
        assert "owner_id" in dataset_info
        assert "owner_email" in dataset_info  # Will be None
        assert "status" in dataset_info
        assert "created_at" in dataset_info
        assert "updated_at" in dataset_info

    def test_get_details_requires_admin(
        self, authenticated_client, labeler_db, create_dataset, test_user_id
    ):
        """Test that details endpoint requires admin privileges."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_admin_test",
            name="Admin Test",
            owner_id=test_user_id,
        )

        response = authenticated_client.get("/api/v1/admin/datasets/ds_admin_test/details")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_details_unauthenticated(
        self, client, labeler_db, create_dataset, test_user_id
    ):
        """Test that details endpoint requires authentication."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_unauth_test",
            name="Unauth Test",
            owner_id=test_user_id,
        )

        response = client.get("/api/v1/admin/datasets/ds_unauth_test/details")

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test Labeling Progress Endpoint
# =============================================================================


class TestGetLabelingProgress:
    """Tests for GET /api/v1/admin/datasets/{dataset_id}/progress."""

    def test_get_progress_for_dataset(
        self, admin_client, labeler_db, test_user_id, create_dataset, create_project
    ):
        """Test labeling progress for entire dataset (all projects)."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_progress",
            name="Progress Dataset",
            owner_id=test_user_id,
        )

        project = create_project(
            labeler_db,
            project_id="proj_progress",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            task_types=["detection"],
        )

        # Create image annotation statuses
        statuses = ["not_started", "in_progress", "completed", "completed"]
        for i, status_val in enumerate(statuses):
            img_status = ImageAnnotationStatus(
                project_id=project.id,
                image_id=f"img_{i:03d}.jpg",
                task_type="detection",
                status=status_val,
                total_annotations=5 if status_val == "completed" else 2,
            )
            labeler_db.add(img_status)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/ds_progress/progress")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "images_by_status" in data
        assert data["images_by_status"]["not_started"] == 1
        assert data["images_by_status"]["in_progress"] == 1
        assert data["images_by_status"]["completed"] == 2

        assert "completion_rate" in data
        assert data["completion_rate"] == 0.5  # 2 out of 4

        assert "total_images" in data
        assert data["total_images"] == 4

        assert "completed_images" in data
        assert data["completed_images"] == 2

    def test_get_progress_for_specific_project(
        self, admin_client, labeler_db, test_user_id, create_dataset, create_project
    ):
        """Test labeling progress for a specific project."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_multi_proj",
            name="Multi Project Dataset",
            owner_id=test_user_id,
        )

        project1 = create_project(
            labeler_db,
            project_id="proj_001",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            task_types=["detection"],
        )

        project2 = create_project(
            labeler_db,
            project_id="proj_002",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            task_types=["segmentation"],
        )

        # Create statuses for both projects
        for i in range(3):
            img_status1 = ImageAnnotationStatus(
                project_id=project1.id,
                image_id=f"img_{i:03d}.jpg",
                task_type="detection",
                status="completed",
            )
            labeler_db.add(img_status1)

            img_status2 = ImageAnnotationStatus(
                project_id=project2.id,
                image_id=f"img_{i:03d}.jpg",
                task_type="segmentation",
                status="in_progress",
            )
            labeler_db.add(img_status2)
        labeler_db.commit()

        # Query for specific project
        response = admin_client.get(
            "/api/v1/admin/datasets/ds_multi_proj/progress?project_id=proj_001"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["images_by_status"]["completed"] == 3
        assert data["total_images"] == 3
        assert data["completion_rate"] == 1.0

    def test_get_progress_with_annotations_by_task(
        self, admin_client, labeler_db, test_user_id, create_dataset, create_project
    ):
        """Test progress includes annotations grouped by task type."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_annotations",
            name="Annotations Dataset",
            owner_id=test_user_id,
        )

        project = create_project(
            labeler_db,
            project_id="proj_annotations",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            task_types=["detection", "segmentation"],
        )

        # Create annotations with different task types
        for i in range(5):
            ann_det = Annotation(
                project_id=project.id,
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
            )
            labeler_db.add(ann_det)

        for i in range(3):
            ann_seg = Annotation(
                project_id=project.id,
                image_id=f"img_{i:03d}.jpg",
                annotation_type="polygon",
                task_type="segmentation",
                geometry={"points": [[10, 10], [50, 10], [50, 50]]},
            )
            labeler_db.add(ann_seg)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/ds_annotations/progress")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "annotations_by_task" in data
        assert data["annotations_by_task"]["detection"] == 5
        assert data["annotations_by_task"]["segmentation"] == 3

    def test_get_progress_with_user_contributions(
        self, admin_client, labeler_db, test_user_id, create_dataset, create_project
    ):
        """Test progress includes user contribution statistics."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_contrib",
            name="Contribution Dataset",
            owner_id=test_user_id,
        )

        project = create_project(
            labeler_db,
            project_id="proj_contrib",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            task_types=["detection"],
        )

        # Create annotations by different users
        user1_id = "user-1"
        user2_id = "user-2"

        for i in range(7):
            ann1 = Annotation(
                project_id=project.id,
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=user1_id,
            )
            labeler_db.add(ann1)

        for i in range(3):
            ann2 = Annotation(
                project_id=project.id,
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=user2_id,
            )
            labeler_db.add(ann2)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/ds_contrib/progress")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "user_contributions" in data
        user_contribs = data["user_contributions"]

        # Should be sorted by count descending
        assert len(user_contribs) == 2
        assert user_contribs[0]["user_id"] == user1_id
        assert user_contribs[0]["annotation_count"] == 7
        assert user_contribs[1]["user_id"] == user2_id
        assert user_contribs[1]["annotation_count"] == 3

    def test_get_progress_empty_dataset(
        self, admin_client, labeler_db, test_user_id, create_dataset
    ):
        """Test progress for dataset with no projects."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_empty",
            name="Empty Dataset",
            owner_id=test_user_id,
        )

        response = admin_client.get("/api/v1/admin/datasets/ds_empty/progress")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["images_by_status"] == {}
        assert data["annotations_by_task"] == {}
        assert data["completion_rate"] == 0
        assert data["total_images"] == 0
        assert data["completed_images"] == 0
        assert data["user_contributions"] == []

    def test_get_progress_requires_admin(
        self, authenticated_client, labeler_db, create_dataset, test_user_id
    ):
        """Test that progress endpoint requires admin privileges."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_admin_progress",
            name="Admin Progress",
            owner_id=test_user_id,
        )

        response = authenticated_client.get(
            "/api/v1/admin/datasets/ds_admin_progress/progress"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_progress_unauthenticated(
        self, client, labeler_db, create_dataset, test_user_id
    ):
        """Test that progress endpoint requires authentication."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_unauth_progress",
            name="Unauth Progress",
            owner_id=test_user_id,
        )

        response = client.get("/api/v1/admin/datasets/ds_unauth_progress/progress")

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test Recent Activity Endpoint
# =============================================================================


class TestGetRecentActivity:
    """Tests for GET /api/v1/admin/datasets/{dataset_id}/activity."""

    def test_get_activity_with_defaults(
        self, admin_client, labeler_db, test_user_id, create_dataset, create_project
    ):
        """Test recent activity with default parameters (7 days, 50 limit)."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_activity",
            name="Activity Dataset",
            owner_id=test_user_id,
        )

        project = create_project(
            labeler_db,
            project_id="proj_activity",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            task_types=["detection"],
        )

        # Create recent annotations (within 7 days)
        base_time = datetime.utcnow()
        for i in range(5):
            annotation = Annotation(
                project_id=project.id,
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=test_user_id,
                created_at=base_time - timedelta(hours=i),
            )
            labeler_db.add(annotation)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/ds_activity/activity")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert isinstance(data, list)
        assert len(data) == 5

        # Verify sorted by timestamp descending
        assert data[0]["type"] == "annotation_created"
        assert "timestamp" in data[0]
        assert "user_email" in data[0]
        assert "details" in data[0]

    def test_get_activity_custom_days(
        self, admin_client, labeler_db, test_user_id, create_dataset, create_project
    ):
        """Test recent activity with custom days parameter."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_custom_days",
            name="Custom Days Dataset",
            owner_id=test_user_id,
        )

        project = create_project(
            labeler_db,
            project_id="proj_custom_days",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            task_types=["detection"],
        )

        # Create annotations at different times
        base_time = datetime.utcnow()
        for i in range(5):
            annotation = Annotation(
                project_id=project.id,
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_at=base_time - timedelta(days=i),
            )
            labeler_db.add(annotation)
        labeler_db.commit()

        # Query with 3 days
        response = admin_client.get(
            "/api/v1/admin/datasets/ds_custom_days/activity?days=3"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should only include annotations from last 3 days (0, 1, 2)
        assert len(data) == 3

    def test_get_activity_custom_limit(
        self, admin_client, labeler_db, test_user_id, create_dataset, create_project
    ):
        """Test recent activity with custom limit parameter."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_custom_limit",
            name="Custom Limit Dataset",
            owner_id=test_user_id,
        )

        project = create_project(
            labeler_db,
            project_id="proj_custom_limit",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            task_types=["detection"],
        )

        # Create 20 recent annotations
        for i in range(20):
            annotation = Annotation(
                project_id=project.id,
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
            )
            labeler_db.add(annotation)
        labeler_db.commit()

        # Query with limit=10
        response = admin_client.get(
            "/api/v1/admin/datasets/ds_custom_limit/activity?limit=10"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 10

    def test_get_activity_empty(
        self, admin_client, labeler_db, test_user_id, create_dataset
    ):
        """Test activity for dataset with no projects."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_no_activity",
            name="No Activity Dataset",
            owner_id=test_user_id,
        )

        response = admin_client.get("/api/v1/admin/datasets/ds_no_activity/activity")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_activity_days_validation_min(self, admin_client, labeler_db):
        """Test activity with days below minimum (1)."""
        response = admin_client.get(
            "/api/v1/admin/datasets/ds_test/activity?days=0"
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_activity_days_validation_max(self, admin_client, labeler_db):
        """Test activity with days above maximum (90)."""
        response = admin_client.get(
            "/api/v1/admin/datasets/ds_test/activity?days=91"
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_activity_limit_validation_min(self, admin_client, labeler_db):
        """Test activity with limit below minimum (1)."""
        response = admin_client.get(
            "/api/v1/admin/datasets/ds_test/activity?limit=0"
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_activity_limit_validation_max(self, admin_client, labeler_db):
        """Test activity with limit above maximum (200)."""
        response = admin_client.get(
            "/api/v1/admin/datasets/ds_test/activity?limit=201"
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_activity_response_structure(
        self, admin_client, labeler_db, test_user_id, create_dataset, create_project
    ):
        """Test response structure of activity timeline."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_structure",
            name="Structure Dataset",
            owner_id=test_user_id,
        )

        project = create_project(
            labeler_db,
            project_id="proj_structure",
            dataset_id=dataset.id,
            owner_id=test_user_id,
            task_types=["detection"],
        )

        annotation = Annotation(
            project_id=project.id,
            image_id="img_001.jpg",
            annotation_type="bbox",
            task_type="detection",
            geometry={"x": 10, "y": 10, "width": 50, "height": 50},
            created_by=test_user_id,
        )
        labeler_db.add(annotation)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/datasets/ds_structure/activity")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 1
        activity = data[0]

        # Verify required fields
        assert activity["type"] == "annotation_created"
        assert "timestamp" in activity
        assert "user_email" in activity
        assert "details" in activity

        details = activity["details"]
        assert "annotation_id" in details
        assert "task_type" in details
        assert details["task_type"] == "detection"
        assert "image_id" in details
        assert details["image_id"] == "img_001.jpg"

    def test_get_activity_requires_admin(
        self, authenticated_client, labeler_db, create_dataset, test_user_id
    ):
        """Test that activity endpoint requires admin privileges."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_admin_activity",
            name="Admin Activity",
            owner_id=test_user_id,
        )

        response = authenticated_client.get(
            "/api/v1/admin/datasets/ds_admin_activity/activity"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_activity_unauthenticated(
        self, client, labeler_db, create_dataset, test_user_id
    ):
        """Test that activity endpoint requires authentication."""
        dataset = create_dataset(
            labeler_db,
            dataset_id="ds_unauth_activity",
            name="Unauth Activity",
            owner_id=test_user_id,
        )

        response = client.get("/api/v1/admin/datasets/ds_unauth_activity/activity")

        assert response.status_code == status.HTTP_403_FORBIDDEN
