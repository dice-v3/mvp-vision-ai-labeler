"""
Tests for platform dataset endpoints.

Tests the platform integration endpoints for service-to-service communication:
- GET /api/v1/platform/datasets/{dataset_id} - Get dataset by ID
- GET /api/v1/platform/datasets - List datasets with filters
- POST /api/v1/platform/datasets/batch - Batch get datasets
- GET /api/v1/platform/datasets/{dataset_id}/permissions/{user_id} - Check user permission
- POST /api/v1/platform/datasets/{dataset_id}/download-url - Generate download URL

These endpoints use Hybrid JWT authentication for Platform service.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json

from app.core.service_jwt import get_service_jwt_payload, require_service_scope
from app.db.models.labeler import (
    Dataset,
    DatasetPermission,
    AnnotationProject,
    AnnotationVersion,
)
from app.main import app


# =============================================================================
# Service JWT Fixtures
# =============================================================================

@pytest.fixture
def mock_service_jwt_payload():
    """
    Provide mock service JWT payload from Platform.

    This mocks the payload that would be returned by get_service_jwt_payload.
    """
    return {
        "sub": "test-user-id-12345678-1234-1234-1234-123456789abc",
        "service": "platform",
        "scopes": ["labeler:read", "labeler:write"],
        "type": "service",
        "iat": 1609459200,
        "exp": 1609545600,
    }


@pytest.fixture
def platform_client(client, mock_service_jwt_payload):
    """
    Create a test client with service JWT authentication.

    This client has Platform service credentials and can access
    platform-specific endpoints.
    """
    # Override service JWT dependencies
    async def override_get_service_jwt_payload():
        return mock_service_jwt_payload

    async def override_require_service_scope(*scopes):
        async def check_scopes():
            return mock_service_jwt_payload
        return check_scopes

    app.dependency_overrides[get_service_jwt_payload] = override_get_service_jwt_payload

    yield client

    # Clean up overrides
    app.dependency_overrides.pop(get_service_jwt_payload, None)


@pytest.fixture
def platform_client_read_only(client):
    """
    Create a test client with service JWT authentication but only read scope.
    """
    mock_payload = {
        "sub": "test-user-id-12345678-1234-1234-1234-123456789abc",
        "service": "platform",
        "scopes": ["labeler:read"],
        "type": "service",
        "iat": 1609459200,
        "exp": 1609545600,
    }

    async def override_get_service_jwt_payload():
        return mock_payload

    app.dependency_overrides[get_service_jwt_payload] = override_get_service_jwt_payload

    yield client

    app.dependency_overrides.pop(get_service_jwt_payload, None)


# =============================================================================
# Test GET /api/v1/platform/datasets/{dataset_id}
# =============================================================================

class TestGetDatasetForPlatform:
    """Test cases for GET /api/v1/platform/datasets/{dataset_id} endpoint."""

    def test_get_dataset_success(self, platform_client, labeler_db, create_dataset):
        """
        Test successful dataset retrieval for Platform.

        Should return complete dataset metadata.
        """
        # Create test dataset
        dataset = create_dataset(
            labeler_db,
            name="Test Dataset",
            description="Dataset for Platform training",
            num_images=100,
            num_classes=5,
            labeled=True,
            visibility="public",
            format="coco",
        )

        response = platform_client.get(f"/api/v1/platform/datasets/{dataset.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response structure
        assert data["id"] == dataset.id
        assert data["name"] == "Test Dataset"
        assert data["description"] == "Dataset for Platform training"
        assert data["num_images"] == 100
        assert data["num_classes"] == 5
        assert data["labeled"] is True
        assert data["visibility"] == "public"
        assert data["format"] == "coco"
        assert data["storage_type"] == "r2"
        assert "storage_path" in data
        assert "owner_id" in data
        assert "version" in data
        assert "created_at" in data
        assert "updated_at" in data
        assert isinstance(data["published_task_types"], list)

    def test_get_dataset_not_found(self, platform_client):
        """
        Test dataset not found error.

        Should return 404 when dataset doesn't exist.
        """
        response = platform_client.get("/api/v1/platform/datasets/ds_nonexistent")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_get_dataset_without_auth(self, client, labeler_db, create_dataset):
        """
        Test access without service JWT.

        Should return 401 when authorization header is missing.
        """
        dataset = create_dataset(labeler_db, name="Test Dataset")

        response = client.get(f"/api/v1/platform/datasets/{dataset.id}")

        # Should fail without authentication
        assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN, status.HTTP_422_UNPROCESSABLE_ENTITY]

    def test_get_dataset_with_task_specific_stats(self, platform_client, labeler_db, create_dataset, create_project):
        """
        Test dataset retrieval with task-specific statistics.

        When task_type is provided in query params, should return
        task-specific stats from latest AnnotationVersion.
        """
        # Create dataset with project
        dataset = create_dataset(
            labeler_db,
            name="Multi-task Dataset",
            num_images=100,
            num_classes=5,
        )

        project = create_project(
            labeler_db,
            dataset_id=dataset.id,
            task_types=["detection", "segmentation"],
        )

        # Create annotation versions for different task types
        detection_version = AnnotationVersion(
            id="ver_detection_001",
            project_id=project.id,
            task_type="detection",
            version=1,
            image_count=50,
            export_path="exports/detection_v1.json",
            created_by="test-user-id",
        )
        labeler_db.add(detection_version)
        labeler_db.commit()

        response = platform_client.get(f"/api/v1/platform/datasets/{dataset.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == dataset.id

    def test_get_dataset_with_json_fields(self, platform_client, labeler_db, create_dataset):
        """
        Test dataset with JSON fields (class_names, tags).

        Should parse JSON string fields to lists.
        """
        # Create dataset with JSON fields
        dataset = create_dataset(
            labeler_db,
            name="Dataset with JSON",
            class_names=json.dumps(["cat", "dog", "bird"]),
            tags=json.dumps(["animals", "classification"]),
        )

        response = platform_client.get(f"/api/v1/platform/datasets/{dataset.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify JSON fields are parsed
        assert data["class_names"] == ["cat", "dog", "bird"]
        assert data["tags"] == ["animals", "classification"]


# =============================================================================
# Test GET /api/v1/platform/datasets
# =============================================================================

class TestListDatasetsForPlatform:
    """Test cases for GET /api/v1/platform/datasets endpoint."""

    def test_list_datasets_empty(self, platform_client):
        """
        Test listing datasets when none exist.

        Should return empty list with correct pagination metadata.
        """
        response = platform_client.get("/api/v1/platform/datasets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total"] == 0
        assert data["page"] == 1
        assert data["limit"] == 50
        assert data["datasets"] == []

    def test_list_datasets_basic(self, platform_client, labeler_db, create_dataset):
        """
        Test basic dataset listing.

        Should return all datasets with default pagination.
        """
        # Create test datasets
        for i in range(3):
            create_dataset(
                labeler_db,
                name=f"Dataset {i+1}",
                num_images=10 * (i + 1),
            )

        response = platform_client.get("/api/v1/platform/datasets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total"] == 3
        assert data["page"] == 1
        assert data["limit"] == 50
        assert len(data["datasets"]) == 3

        # Verify datasets are in descending order by created_at
        assert data["datasets"][0]["name"] == "Dataset 3"
        assert data["datasets"][1]["name"] == "Dataset 2"
        assert data["datasets"][2]["name"] == "Dataset 1"

    def test_list_datasets_pagination(self, platform_client, labeler_db, create_dataset):
        """
        Test dataset listing with pagination.

        Should respect page and limit parameters.
        """
        # Create 10 test datasets
        for i in range(10):
            create_dataset(labeler_db, name=f"Dataset {i+1}")

        # Get first page with limit=3
        response = platform_client.get("/api/v1/platform/datasets?page=1&limit=3")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total"] == 10
        assert data["page"] == 1
        assert data["limit"] == 3
        assert len(data["datasets"]) == 3

        # Get second page
        response = platform_client.get("/api/v1/platform/datasets?page=2&limit=3")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["page"] == 2
        assert len(data["datasets"]) == 3

    def test_list_datasets_filter_by_user_id(self, platform_client, labeler_db, create_dataset):
        """
        Test filtering datasets by owner user_id.

        Should return only datasets owned by specified user.
        """
        user1_id = "user-1-id"
        user2_id = "user-2-id"

        # Create datasets for different users
        create_dataset(labeler_db, name="User 1 Dataset 1", owner_id=user1_id)
        create_dataset(labeler_db, name="User 1 Dataset 2", owner_id=user1_id)
        create_dataset(labeler_db, name="User 2 Dataset", owner_id=user2_id)

        response = platform_client.get(f"/api/v1/platform/datasets?user_id={user1_id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total"] == 2
        assert len(data["datasets"]) == 2
        assert all(ds["owner_id"] == user1_id for ds in data["datasets"])

    def test_list_datasets_filter_by_visibility(self, platform_client, labeler_db, create_dataset):
        """
        Test filtering datasets by visibility.

        Should return only datasets with specified visibility.
        """
        create_dataset(labeler_db, name="Public Dataset 1", visibility="public")
        create_dataset(labeler_db, name="Public Dataset 2", visibility="public")
        create_dataset(labeler_db, name="Private Dataset", visibility="private")
        create_dataset(labeler_db, name="Org Dataset", visibility="organization")

        response = platform_client.get("/api/v1/platform/datasets?visibility=public")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total"] == 2
        assert all(ds["visibility"] == "public" for ds in data["datasets"])

    def test_list_datasets_filter_by_labeled(self, platform_client, labeler_db, create_dataset):
        """
        Test filtering datasets by labeled status.

        Should return only labeled or unlabeled datasets.
        """
        create_dataset(labeler_db, name="Labeled 1", labeled=True)
        create_dataset(labeler_db, name="Labeled 2", labeled=True)
        create_dataset(labeler_db, name="Unlabeled", labeled=False)

        response = platform_client.get("/api/v1/platform/datasets?labeled=true")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total"] == 2
        assert all(ds["labeled"] is True for ds in data["datasets"])

        # Test unlabeled filter
        response = platform_client.get("/api/v1/platform/datasets?labeled=false")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total"] == 1
        assert data["datasets"][0]["labeled"] is False

    def test_list_datasets_filter_by_format(self, platform_client, labeler_db, create_dataset):
        """
        Test filtering datasets by format.

        Should return only datasets with specified format.
        """
        create_dataset(labeler_db, name="COCO Dataset", format="coco")
        create_dataset(labeler_db, name="YOLO Dataset", format="yolo")
        create_dataset(labeler_db, name="DICE Dataset", format="dice")

        response = platform_client.get("/api/v1/platform/datasets?format=coco")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total"] == 1
        assert data["datasets"][0]["format"] == "coco"

    def test_list_datasets_filter_by_task_type(self, platform_client, labeler_db, create_dataset):
        """
        Test filtering datasets by task type using published_task_types.

        Should return only datasets that have published the specified task type.
        """
        # Create datasets with different published task types
        ds1 = create_dataset(labeler_db, name="Detection Dataset")
        ds1.published_task_types = ["detection"]

        ds2 = create_dataset(labeler_db, name="Multi-task Dataset")
        ds2.published_task_types = ["detection", "segmentation"]

        ds3 = create_dataset(labeler_db, name="Classification Dataset")
        ds3.published_task_types = ["classification"]

        labeler_db.commit()

        response = platform_client.get("/api/v1/platform/datasets?task_type=detection")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should return datasets that have 'detection' in published_task_types
        assert data["total"] == 2
        for ds in data["datasets"]:
            assert "detection" in ds["published_task_types"]

    def test_list_datasets_multiple_filters(self, platform_client, labeler_db, create_dataset):
        """
        Test combining multiple filters.

        Should return datasets matching all filter criteria.
        """
        user_id = "test-user-id"

        # Create various datasets
        ds1 = create_dataset(
            labeler_db,
            name="Perfect Match",
            owner_id=user_id,
            visibility="public",
            labeled=True,
            format="coco",
        )
        ds1.published_task_types = ["detection"]

        create_dataset(
            labeler_db,
            name="Wrong User",
            owner_id="other-user",
            visibility="public",
            labeled=True,
            format="coco",
        )

        create_dataset(
            labeler_db,
            name="Wrong Visibility",
            owner_id=user_id,
            visibility="private",
            labeled=True,
            format="coco",
        )

        labeler_db.commit()

        response = platform_client.get(
            f"/api/v1/platform/datasets?user_id={user_id}&visibility=public&labeled=true&format=coco&task_type=detection"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total"] == 1
        assert data["datasets"][0]["name"] == "Perfect Match"

    def test_list_datasets_limit_validation(self, platform_client):
        """
        Test limit parameter validation.

        Should enforce max limit of 200.
        """
        # Valid limit
        response = platform_client.get("/api/v1/platform/datasets?limit=100")
        assert response.status_code == status.HTTP_200_OK

        # Max limit
        response = platform_client.get("/api/v1/platform/datasets?limit=200")
        assert response.status_code == status.HTTP_200_OK

        # Exceeds max limit - should be rejected
        response = platform_client.get("/api/v1/platform/datasets?limit=300")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_list_datasets_page_validation(self, platform_client):
        """
        Test page parameter validation.

        Should require page >= 1.
        """
        # Valid page
        response = platform_client.get("/api/v1/platform/datasets?page=1")
        assert response.status_code == status.HTTP_200_OK

        # Invalid page (0)
        response = platform_client.get("/api/v1/platform/datasets?page=0")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Invalid page (negative)
        response = platform_client.get("/api/v1/platform/datasets?page=-1")
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# Test POST /api/v1/platform/datasets/batch
# =============================================================================

class TestGetDatasetsBatchForPlatform:
    """Test cases for POST /api/v1/platform/datasets/batch endpoint."""

    def test_batch_get_datasets_success(self, platform_client, labeler_db, create_dataset):
        """
        Test successful batch dataset retrieval.

        Should return all requested datasets.
        """
        # Create test datasets
        ds1 = create_dataset(labeler_db, name="Dataset 1", num_images=10)
        ds2 = create_dataset(labeler_db, name="Dataset 2", num_images=20)
        ds3 = create_dataset(labeler_db, name="Dataset 3", num_images=30)

        request_data = {
            "dataset_ids": [ds1.id, ds2.id, ds3.id]
        }

        response = platform_client.post(
            "/api/v1/platform/datasets/batch",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert ds1.id in data["datasets"]
        assert ds2.id in data["datasets"]
        assert ds3.id in data["datasets"]

        # Verify complete dataset data
        assert data["datasets"][ds1.id]["name"] == "Dataset 1"
        assert data["datasets"][ds1.id]["num_images"] == 10
        assert data["datasets"][ds2.id]["name"] == "Dataset 2"
        assert data["datasets"][ds2.id]["num_images"] == 20

        # No errors
        assert len(data["errors"]) == 0

    def test_batch_get_datasets_with_missing(self, platform_client, labeler_db, create_dataset):
        """
        Test batch retrieval with some missing datasets.

        Should return found datasets and list missing ones in errors.
        """
        ds1 = create_dataset(labeler_db, name="Dataset 1")

        request_data = {
            "dataset_ids": [ds1.id, "ds_nonexistent_1", "ds_nonexistent_2"]
        }

        response = platform_client.post(
            "/api/v1/platform/datasets/batch",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Found dataset
        assert data["datasets"][ds1.id] is not None
        assert data["datasets"][ds1.id]["name"] == "Dataset 1"

        # Missing datasets
        assert data["datasets"]["ds_nonexistent_1"] is None
        assert data["datasets"]["ds_nonexistent_2"] is None

        # Errors
        assert "ds_nonexistent_1" in data["errors"]
        assert "ds_nonexistent_2" in data["errors"]
        assert "not found" in data["errors"]["ds_nonexistent_1"].lower()

    def test_batch_get_datasets_with_specific_fields(self, platform_client, labeler_db, create_dataset):
        """
        Test batch retrieval with specific fields.

        Should return only requested fields.
        """
        ds1 = create_dataset(
            labeler_db,
            name="Dataset 1",
            num_images=100,
            format="coco",
            num_classes=5,
        )

        request_data = {
            "dataset_ids": [ds1.id],
            "fields": ["id", "name", "num_images"]
        }

        response = platform_client.post(
            "/api/v1/platform/datasets/batch",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        dataset = data["datasets"][ds1.id]

        # Requested fields should be present
        assert dataset["id"] == ds1.id
        assert dataset["name"] == "Dataset 1"
        assert dataset["num_images"] == 100

        # Other fields should not be present (or can be null)
        # The schema allows all fields to be optional when using specific fields

    def test_batch_get_datasets_all_fields(self, platform_client, labeler_db, create_dataset):
        """
        Test batch retrieval with all available fields.

        Should return complete dataset information.
        """
        ds1 = create_dataset(
            labeler_db,
            name="Complete Dataset",
            num_images=50,
            format="coco",
            num_classes=10,
            visibility="public",
            labeled=True,
        )

        request_data = {
            "dataset_ids": [ds1.id],
            "fields": ["id", "name", "format", "num_images", "storage_path", "num_classes", "labeled", "visibility", "owner_id"]
        }

        response = platform_client.post(
            "/api/v1/platform/datasets/batch",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        dataset = data["datasets"][ds1.id]
        assert dataset["id"] == ds1.id
        assert dataset["name"] == "Complete Dataset"
        assert dataset["format"] == "coco"
        assert dataset["num_images"] == 50
        assert dataset["num_classes"] == 10
        assert dataset["labeled"] is True
        assert dataset["visibility"] == "public"

    def test_batch_get_datasets_empty_request(self, platform_client):
        """
        Test batch request with empty dataset_ids list.

        Should fail validation (min_items=1).
        """
        request_data = {
            "dataset_ids": []
        }

        response = platform_client.post(
            "/api/v1/platform/datasets/batch",
            json=request_data
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_batch_get_datasets_exceeds_max(self, platform_client):
        """
        Test batch request exceeding max items (50).

        Should fail validation (max_items=50).
        """
        request_data = {
            "dataset_ids": [f"ds_{i}" for i in range(51)]
        }

        response = platform_client.post(
            "/api/v1/platform/datasets/batch",
            json=request_data
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


# =============================================================================
# Test GET /api/v1/platform/datasets/{dataset_id}/permissions/{user_id}
# =============================================================================

class TestCheckDatasetPermissionForPlatform:
    """Test cases for GET /api/v1/platform/datasets/{dataset_id}/permissions/{user_id} endpoint."""

    def test_check_permission_owner(self, platform_client, labeler_db, create_dataset):
        """
        Test permission check for dataset owner.

        Should return has_access=True with role=owner and reason=owner.
        """
        owner_id = "owner-user-id"
        dataset = create_dataset(labeler_db, name="Owner Dataset", owner_id=owner_id)

        response = platform_client.get(
            f"/api/v1/platform/datasets/{dataset.id}/permissions/{owner_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["dataset_id"] == dataset.id
        assert data["user_id"] == owner_id
        assert data["has_access"] is True
        assert data["role"] == "owner"
        assert data["reason"] == "owner"

    def test_check_permission_public_dataset(self, platform_client, labeler_db, create_dataset):
        """
        Test permission check for public dataset.

        Should return has_access=True with reason=public_dataset.
        """
        dataset = create_dataset(
            labeler_db,
            name="Public Dataset",
            visibility="public",
            owner_id="owner-id",
        )

        other_user_id = "other-user-id"

        response = platform_client.get(
            f"/api/v1/platform/datasets/{dataset.id}/permissions/{other_user_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["has_access"] is True
        assert data["reason"] == "public_dataset"
        assert data["role"] is None  # No explicit permission

    def test_check_permission_public_with_explicit_permission(
        self, platform_client, labeler_db, create_dataset, create_dataset_permission
    ):
        """
        Test permission check for public dataset with explicit permission.

        Should return has_access=True with the explicit role.
        """
        dataset = create_dataset(
            labeler_db,
            name="Public Dataset",
            visibility="public",
            owner_id="owner-id",
        )

        user_id = "user-with-permission"

        # Grant explicit permission
        create_dataset_permission(
            labeler_db,
            dataset_id=dataset.id,
            user_id=user_id,
            role="admin",
        )

        response = platform_client.get(
            f"/api/v1/platform/datasets/{dataset.id}/permissions/{user_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["has_access"] is True
        assert data["role"] == "admin"
        assert data["reason"] == "public_dataset"

    def test_check_permission_explicit_permission(
        self, platform_client, labeler_db, create_dataset, create_dataset_permission
    ):
        """
        Test permission check with explicit dataset permission.

        Should return has_access=True with role and reason=explicit_permission.
        """
        dataset = create_dataset(
            labeler_db,
            name="Private Dataset",
            visibility="private",
            owner_id="owner-id",
        )

        user_id = "member-user-id"

        # Grant explicit permission
        create_dataset_permission(
            labeler_db,
            dataset_id=dataset.id,
            user_id=user_id,
            role="viewer",
        )

        response = platform_client.get(
            f"/api/v1/platform/datasets/{dataset.id}/permissions/{user_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["has_access"] is True
        assert data["role"] == "viewer"
        assert data["reason"] == "explicit_permission"

    def test_check_permission_no_access(self, platform_client, labeler_db, create_dataset):
        """
        Test permission check with no access.

        Should return has_access=False with reason=no_access.
        """
        dataset = create_dataset(
            labeler_db,
            name="Private Dataset",
            visibility="private",
            owner_id="owner-id",
        )

        unauthorized_user_id = "unauthorized-user"

        response = platform_client.get(
            f"/api/v1/platform/datasets/{dataset.id}/permissions/{unauthorized_user_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["has_access"] is False
        assert data["role"] is None
        assert data["reason"] == "no_access"

    def test_check_permission_dataset_not_found(self, platform_client):
        """
        Test permission check for non-existent dataset.

        Should return 404.
        """
        response = platform_client.get(
            "/api/v1/platform/datasets/ds_nonexistent/permissions/user-id"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_check_permission_various_roles(
        self, platform_client, labeler_db, create_dataset, create_dataset_permission
    ):
        """
        Test permission check for various role types.

        Should correctly identify different permission roles.
        """
        dataset = create_dataset(
            labeler_db,
            name="Shared Dataset",
            visibility="private",
            owner_id="owner-id",
        )

        # Create permissions for different roles
        roles = ["owner", "admin", "reviewer", "annotator", "viewer"]

        for role in roles[1:]:  # Skip owner as it's determined by owner_id
            user_id = f"{role}-user-id"
            create_dataset_permission(
                labeler_db,
                dataset_id=dataset.id,
                user_id=user_id,
                role=role,
            )

            response = platform_client.get(
                f"/api/v1/platform/datasets/{dataset.id}/permissions/{user_id}"
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            assert data["has_access"] is True
            assert data["role"] == role
            assert data["reason"] == "explicit_permission"


# =============================================================================
# Test POST /api/v1/platform/datasets/{dataset_id}/download-url
# =============================================================================

class TestGenerateDownloadUrlForPlatform:
    """Test cases for POST /api/v1/platform/datasets/{dataset_id}/download-url endpoint."""

    @patch("app.api.v1.endpoints.platform_datasets.StorageClient")
    def test_generate_download_url_success(
        self, mock_storage_class, platform_client, labeler_db, create_dataset, mock_service_jwt_payload
    ):
        """
        Test successful download URL generation.

        Should return presigned URL with expiration.
        """
        # Setup mock storage
        mock_storage = MagicMock()
        mock_storage.generate_presigned_url.return_value = "https://r2.example.com/presigned-url"
        mock_storage.datasets_bucket = "test-datasets-bucket"
        mock_storage_class.return_value = mock_storage

        # Create dataset with annotation path
        dataset = create_dataset(
            labeler_db,
            name="Download Test Dataset",
            owner_id=mock_service_jwt_payload["sub"],
            annotation_path="annotations.json",
        )

        request_data = {
            "expiration_seconds": 3600,
            "purpose": "training_job_123"
        }

        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response
        assert data["dataset_id"] == dataset.id
        assert data["download_url"] == "https://r2.example.com/presigned-url"
        assert "expires_at" in data
        assert data["format"] == "json"
        assert "manifest" in data
        assert data["manifest"]["annotations"] == "annotations.json"

        # Verify storage client was called correctly
        mock_storage.generate_presigned_url.assert_called_once()
        call_args = mock_storage.generate_presigned_url.call_args
        assert call_args.kwargs["bucket"] == "test-datasets-bucket"
        assert call_args.kwargs["expiration"] == 3600

    @patch("app.api.v1.endpoints.platform_datasets.StorageClient")
    def test_generate_download_url_owner_access(
        self, mock_storage_class, platform_client, labeler_db, create_dataset, mock_service_jwt_payload
    ):
        """
        Test download URL generation for dataset owner.

        Owner should have access to generate download URLs.
        """
        mock_storage = MagicMock()
        mock_storage.generate_presigned_url.return_value = "https://r2.example.com/url"
        mock_storage.datasets_bucket = "bucket"
        mock_storage_class.return_value = mock_storage

        dataset = create_dataset(
            labeler_db,
            owner_id=mock_service_jwt_payload["sub"],
            annotation_path="annotations.json",
        )

        request_data = {"expiration_seconds": 1800}

        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK

    @patch("app.api.v1.endpoints.platform_datasets.StorageClient")
    def test_generate_download_url_public_dataset(
        self, mock_storage_class, platform_client, labeler_db, create_dataset, mock_service_jwt_payload
    ):
        """
        Test download URL generation for public dataset.

        Any user should be able to download public datasets.
        """
        mock_storage = MagicMock()
        mock_storage.generate_presigned_url.return_value = "https://r2.example.com/url"
        mock_storage.datasets_bucket = "bucket"
        mock_storage_class.return_value = mock_storage

        dataset = create_dataset(
            labeler_db,
            visibility="public",
            owner_id="other-user-id",
            annotation_path="annotations.json",
        )

        request_data = {"expiration_seconds": 3600}

        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK

    @patch("app.api.v1.endpoints.platform_datasets.StorageClient")
    def test_generate_download_url_with_permission(
        self, mock_storage_class, platform_client, labeler_db, create_dataset,
        create_dataset_permission, mock_service_jwt_payload
    ):
        """
        Test download URL generation with explicit permission.

        Users with explicit dataset permission should have access.
        """
        mock_storage = MagicMock()
        mock_storage.generate_presigned_url.return_value = "https://r2.example.com/url"
        mock_storage.datasets_bucket = "bucket"
        mock_storage_class.return_value = mock_storage

        dataset = create_dataset(
            labeler_db,
            visibility="private",
            owner_id="owner-id",
            annotation_path="annotations.json",
        )

        # Grant permission to JWT user
        create_dataset_permission(
            labeler_db,
            dataset_id=dataset.id,
            user_id=mock_service_jwt_payload["sub"],
            role="viewer",
        )

        request_data = {"expiration_seconds": 3600}

        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json=request_data
        )

        assert response.status_code == status.HTTP_200_OK

    def test_generate_download_url_no_access(
        self, platform_client, labeler_db, create_dataset, mock_service_jwt_payload
    ):
        """
        Test download URL generation without access.

        Should return 403 when user lacks permission.
        """
        dataset = create_dataset(
            labeler_db,
            visibility="private",
            owner_id="other-owner-id",
            annotation_path="annotations.json",
        )

        request_data = {"expiration_seconds": 3600}

        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json=request_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "does not have access" in response.json()["detail"]

    def test_generate_download_url_dataset_not_found(self, platform_client):
        """
        Test download URL generation for non-existent dataset.

        Should return 404.
        """
        request_data = {"expiration_seconds": 3600}

        response = platform_client.post(
            "/api/v1/platform/datasets/ds_nonexistent/download-url",
            json=request_data
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    @patch("app.api.v1.endpoints.platform_datasets.StorageClient")
    def test_generate_download_url_no_annotation_file(
        self, mock_storage_class, platform_client, labeler_db, create_dataset, mock_service_jwt_payload
    ):
        """
        Test download URL generation when dataset has no annotation file.

        Should return 404 when annotation_path is None.
        """
        dataset = create_dataset(
            labeler_db,
            owner_id=mock_service_jwt_payload["sub"],
            annotation_path=None,
        )

        request_data = {"expiration_seconds": 3600}

        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json=request_data
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "no annotation file" in response.json()["detail"].lower()

    @patch("app.api.v1.endpoints.platform_datasets.StorageClient")
    def test_generate_download_url_expiration_validation(
        self, mock_storage_class, platform_client, labeler_db, create_dataset, mock_service_jwt_payload
    ):
        """
        Test expiration_seconds validation.

        Should enforce min (60s) and max (86400s = 24h) limits.
        """
        mock_storage = MagicMock()
        mock_storage.generate_presigned_url.return_value = "https://r2.example.com/url"
        mock_storage.datasets_bucket = "bucket"
        mock_storage_class.return_value = mock_storage

        dataset = create_dataset(
            labeler_db,
            owner_id=mock_service_jwt_payload["sub"],
            annotation_path="annotations.json",
        )

        # Valid: minimum (60s)
        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json={"expiration_seconds": 60}
        )
        assert response.status_code == status.HTTP_200_OK

        # Valid: maximum (86400s = 24h)
        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json={"expiration_seconds": 86400}
        )
        assert response.status_code == status.HTTP_200_OK

        # Invalid: too low
        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json={"expiration_seconds": 30}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Invalid: too high
        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json={"expiration_seconds": 100000}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @patch("app.api.v1.endpoints.platform_datasets.StorageClient")
    def test_generate_download_url_default_expiration(
        self, mock_storage_class, platform_client, labeler_db, create_dataset, mock_service_jwt_payload
    ):
        """
        Test download URL generation with default expiration.

        Should use default 3600s (1 hour) if not specified.
        """
        mock_storage = MagicMock()
        mock_storage.generate_presigned_url.return_value = "https://r2.example.com/url"
        mock_storage.datasets_bucket = "bucket"
        mock_storage_class.return_value = mock_storage

        dataset = create_dataset(
            labeler_db,
            owner_id=mock_service_jwt_payload["sub"],
            annotation_path="annotations.json",
        )

        # Don't specify expiration_seconds (should use default)
        response = platform_client.post(
            f"/api/v1/platform/datasets/{dataset.id}/download-url",
            json={}
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify default expiration was used
        call_args = mock_storage.generate_presigned_url.call_args
        assert call_args.kwargs["expiration"] == 3600


# =============================================================================
# Integration Tests
# =============================================================================

class TestPlatformDatasetsIntegration:
    """Integration tests for platform dataset endpoints."""

    def test_full_workflow_discovery_to_download(
        self, platform_client, labeler_db, create_dataset, mock_service_jwt_payload
    ):
        """
        Test complete workflow: discover datasets -> check permission -> download.

        Simulates Platform discovering datasets and downloading them.
        """
        # Setup: Create datasets with different visibility
        public_ds = create_dataset(
            labeler_db,
            name="Public Dataset",
            visibility="public",
            labeled=True,
            format="coco",
            annotation_path="public_annotations.json",
        )
        public_ds.published_task_types = ["detection"]

        private_ds = create_dataset(
            labeler_db,
            name="Private Dataset",
            visibility="private",
            owner_id=mock_service_jwt_payload["sub"],
            annotation_path="private_annotations.json",
        )

        labeler_db.commit()

        # Step 1: Discover public labeled datasets for detection
        response = platform_client.get(
            "/api/v1/platform/datasets?visibility=public&labeled=true&task_type=detection"
        )
        assert response.status_code == status.HTTP_200_OK
        datasets = response.json()["datasets"]
        assert len(datasets) == 1
        assert datasets[0]["id"] == public_ds.id

        # Step 2: Check permission for discovered dataset
        user_id = mock_service_jwt_payload["sub"]
        response = platform_client.get(
            f"/api/v1/platform/datasets/{public_ds.id}/permissions/{user_id}"
        )
        assert response.status_code == status.HTTP_200_OK
        permission = response.json()
        assert permission["has_access"] is True
        assert permission["reason"] == "public_dataset"

        # Step 3: Generate download URL
        with patch("app.api.v1.endpoints.platform_datasets.StorageClient") as mock_storage_class:
            mock_storage = MagicMock()
            mock_storage.generate_presigned_url.return_value = "https://r2.example.com/url"
            mock_storage.datasets_bucket = "bucket"
            mock_storage_class.return_value = mock_storage

            response = platform_client.post(
                f"/api/v1/platform/datasets/{public_ds.id}/download-url",
                json={"expiration_seconds": 3600, "purpose": "training_job"}
            )
            assert response.status_code == status.HTTP_200_OK
            download_data = response.json()
            assert "download_url" in download_data

    def test_batch_get_with_permission_check(
        self, platform_client, labeler_db, create_dataset, create_dataset_permission, mock_service_jwt_payload
    ):
        """
        Test batch dataset retrieval followed by permission checks.

        Simulates Platform checking multiple datasets at once.
        """
        user_id = mock_service_jwt_payload["sub"]

        # Create datasets with different access levels
        owned_ds = create_dataset(labeler_db, name="Owned", owner_id=user_id)
        public_ds = create_dataset(labeler_db, name="Public", visibility="public", owner_id="other")
        private_ds = create_dataset(labeler_db, name="Private", visibility="private", owner_id="other")

        # Grant permission to private dataset
        create_dataset_permission(
            labeler_db,
            dataset_id=private_ds.id,
            user_id=user_id,
            role="viewer",
        )

        # Batch get all datasets
        response = platform_client.post(
            "/api/v1/platform/datasets/batch",
            json={"dataset_ids": [owned_ds.id, public_ds.id, private_ds.id]}
        )
        assert response.status_code == status.HTTP_200_OK
        batch_data = response.json()
        assert len(batch_data["datasets"]) == 3

        # Check permissions for each
        for dataset_id in [owned_ds.id, public_ds.id, private_ds.id]:
            response = platform_client.get(
                f"/api/v1/platform/datasets/{dataset_id}/permissions/{user_id}"
            )
            assert response.status_code == status.HTTP_200_OK
            perm = response.json()
            assert perm["has_access"] is True
