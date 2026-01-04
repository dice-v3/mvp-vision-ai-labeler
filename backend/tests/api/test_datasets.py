"""
Tests for dataset endpoints.

Tests the dataset-related endpoints including:
- POST / - Create new dataset
- GET / - List datasets (with pagination and access control)
- GET /{dataset_id} - Get dataset by ID
- PUT /{dataset_id} - Update dataset
- GET /{dataset_id}/images - List dataset images
- GET /{dataset_id}/size - Get dataset size statistics
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime

from app.core.security import get_current_user, require_dataset_permission
from app.db.models.labeler import (
    Dataset,
    DatasetPermission,
    AnnotationProject,
    ProjectPermission,
    ImageMetadata,
)
from app.main import app


class TestCreateDataset:
    """Test cases for POST /api/v1/datasets endpoint."""

    def test_create_dataset_success(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test successful dataset creation.

        Should create dataset with owner permission and linked project.
        """
        dataset_data = {
            "name": "New Test Dataset",
            "description": "Test dataset description",
            "task_types": ["detection", "classification"],
            "visibility": "private"
        }

        response = authenticated_client.post(
            "/api/v1/datasets",
            json=dataset_data
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        # Verify dataset fields
        assert data["name"] == dataset_data["name"]
        assert data["description"] == dataset_data["description"]
        assert data["owner_id"] == mock_current_user["sub"]
        assert data["visibility"] == "private"
        assert data["status"] == "active"
        assert data["labeled"] is False
        assert data["num_images"] == 0
        assert "id" in data
        assert data["id"].startswith("ds_")

        # Verify owner permission was created
        dataset_id = data["id"]
        permission = labeler_db.query(DatasetPermission).filter(
            DatasetPermission.dataset_id == dataset_id,
            DatasetPermission.user_id == mock_current_user["sub"]
        ).first()

        assert permission is not None
        assert permission.role == "owner"

        # Verify annotation project was created
        project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.dataset_id == dataset_id
        ).first()

        assert project is not None
        assert project.name == dataset_data["name"]
        assert project.task_types == dataset_data["task_types"]
        assert "detection" in project.task_config
        assert "classification" in project.task_config

        # Verify project permission was created
        project_permission = labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project.id,
            ProjectPermission.user_id == mock_current_user["sub"]
        ).first()

        assert project_permission is not None
        assert project_permission.role == "owner"

    def test_create_dataset_minimal_fields(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test dataset creation with minimal required fields.

        Should create dataset with default values for optional fields.
        """
        dataset_data = {
            "name": "Minimal Dataset",
        }

        response = authenticated_client.post(
            "/api/v1/datasets",
            json=dataset_data
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        assert data["name"] == "Minimal Dataset"
        assert data["description"] is None
        assert data["visibility"] == "private"  # Default value
        assert data["owner_id"] == mock_current_user["sub"]

    def test_create_dataset_with_all_task_types(self, authenticated_client, labeler_db):
        """
        Test dataset creation with all supported task types.

        Should create task_config for all task types.
        """
        dataset_data = {
            "name": "Multi-Task Dataset",
            "task_types": ["detection", "segmentation", "classification", "geometry"]
        }

        response = authenticated_client.post(
            "/api/v1/datasets",
            json=dataset_data
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        # Verify project has all task types configured
        project = labeler_db.query(AnnotationProject).filter(
            AnnotationProject.dataset_id == data["id"]
        ).first()

        assert project.task_types == dataset_data["task_types"]
        assert "detection" in project.task_config
        assert project.task_config["detection"]["type"] == "bbox"
        assert "segmentation" in project.task_config
        assert project.task_config["segmentation"]["type"] == "polygon"
        assert "classification" in project.task_config
        assert project.task_config["classification"]["type"] == "single"
        assert "geometry" in project.task_config
        assert project.task_config["geometry"]["type"] == "line"

    def test_create_dataset_public_visibility(self, authenticated_client):
        """
        Test creating a public dataset.

        Should set visibility to public.
        """
        dataset_data = {
            "name": "Public Dataset",
            "visibility": "public"
        }

        response = authenticated_client.post(
            "/api/v1/datasets",
            json=dataset_data
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        assert data["visibility"] == "public"

    def test_create_dataset_unauthenticated(self, client):
        """
        Test dataset creation without authentication.

        Should return 403 Forbidden.
        """
        dataset_data = {
            "name": "Unauthorized Dataset",
        }

        response = client.post(
            "/api/v1/datasets",
            json=dataset_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestListDatasets:
    """Test cases for GET /api/v1/datasets endpoint."""

    def test_list_datasets_empty(self, authenticated_client):
        """
        Test listing datasets when none exist.

        Should return empty list.
        """
        response = authenticated_client.get("/api/v1/datasets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data == []

    def test_list_datasets_single_owned(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test listing datasets with a single owned dataset.

        Should return the user's dataset.
        """
        # Create a dataset owned by the current user
        dataset = Dataset(
            id="ds_owned_001",
            name="Owned Dataset",
            owner_id=mock_current_user["sub"],
            storage_path="datasets/ds_owned_001/",
            storage_type="s3",
            format="images",
            num_images=5,
            visibility="private",
            status="active",
        )
        labeler_db.add(dataset)
        labeler_db.commit()

        response = authenticated_client.get("/api/v1/datasets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 1
        assert data[0]["id"] == "ds_owned_001"
        assert data[0]["name"] == "Owned Dataset"
        assert data[0]["owner_id"] == mock_current_user["sub"]
        assert data[0]["num_items"] == 5

    def test_list_datasets_multiple_owned(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test listing multiple owned datasets.

        Should return all datasets owned by the user.
        """
        # Create multiple datasets
        for i in range(3):
            dataset = Dataset(
                id=f"ds_multi_{i}",
                name=f"Dataset {i}",
                owner_id=mock_current_user["sub"],
                storage_path=f"datasets/ds_multi_{i}/",
                storage_type="s3",
                format="images",
                num_images=10 + i,
                visibility="private",
                status="active",
            )
            labeler_db.add(dataset)
        labeler_db.commit()

        response = authenticated_client.get("/api/v1/datasets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 3
        dataset_ids = [d["id"] for d in data]
        assert "ds_multi_0" in dataset_ids
        assert "ds_multi_1" in dataset_ids
        assert "ds_multi_2" in dataset_ids

    def test_list_datasets_with_permissions(
        self, authenticated_client, labeler_db, mock_current_user, create_dataset_permission
    ):
        """
        Test listing datasets where user has explicit permissions.

        Should return datasets with permissions even if not owner.
        """
        # Create dataset owned by someone else
        dataset = Dataset(
            id="ds_shared_001",
            name="Shared Dataset",
            owner_id="other-user-id",
            storage_path="datasets/ds_shared_001/",
            storage_type="s3",
            format="images",
            num_images=15,
            visibility="private",
            status="active",
        )
        labeler_db.add(dataset)
        labeler_db.commit()

        # Grant permission to current user
        create_dataset_permission(
            labeler_db,
            dataset_id="ds_shared_001",
            user_id=mock_current_user["sub"],
            role="member"
        )

        response = authenticated_client.get("/api/v1/datasets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 1
        assert data[0]["id"] == "ds_shared_001"
        assert data[0]["name"] == "Shared Dataset"
        assert data[0]["owner_id"] == "other-user-id"

    def test_list_datasets_public_visibility(self, authenticated_client, labeler_db):
        """
        Test listing public datasets.

        Should return public datasets regardless of ownership.
        """
        # Create public dataset owned by someone else
        dataset = Dataset(
            id="ds_public_001",
            name="Public Dataset",
            owner_id="other-user-id",
            storage_path="datasets/ds_public_001/",
            storage_type="s3",
            format="images",
            num_images=20,
            visibility="public",
            status="active",
        )
        labeler_db.add(dataset)
        labeler_db.commit()

        response = authenticated_client.get("/api/v1/datasets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 1
        assert data[0]["id"] == "ds_public_001"
        assert data[0]["visibility"] == "public"

    def test_list_datasets_mixed_access(
        self, authenticated_client, labeler_db, mock_current_user, create_dataset_permission
    ):
        """
        Test listing datasets with mixed access types.

        Should return owned, permitted, and public datasets.
        """
        # Create owned dataset
        owned_dataset = Dataset(
            id="ds_owned_mix",
            name="Owned Dataset",
            owner_id=mock_current_user["sub"],
            storage_path="datasets/ds_owned_mix/",
            storage_type="s3",
            format="images",
            num_images=5,
            visibility="private",
            status="active",
        )
        labeler_db.add(owned_dataset)

        # Create public dataset
        public_dataset = Dataset(
            id="ds_public_mix",
            name="Public Dataset",
            owner_id="other-user-id",
            storage_path="datasets/ds_public_mix/",
            storage_type="s3",
            format="images",
            num_images=10,
            visibility="public",
            status="active",
        )
        labeler_db.add(public_dataset)

        # Create shared dataset
        shared_dataset = Dataset(
            id="ds_shared_mix",
            name="Shared Dataset",
            owner_id="other-user-id",
            storage_path="datasets/ds_shared_mix/",
            storage_type="s3",
            format="images",
            num_images=15,
            visibility="private",
            status="active",
        )
        labeler_db.add(shared_dataset)
        labeler_db.commit()

        # Grant permission for shared dataset
        create_dataset_permission(
            labeler_db,
            dataset_id="ds_shared_mix",
            user_id=mock_current_user["sub"],
            role="member"
        )

        response = authenticated_client.get("/api/v1/datasets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 3
        dataset_ids = [d["id"] for d in data]
        assert "ds_owned_mix" in dataset_ids
        assert "ds_public_mix" in dataset_ids
        assert "ds_shared_mix" in dataset_ids

    def test_list_datasets_excludes_no_access(self, authenticated_client, labeler_db):
        """
        Test that private datasets without permissions are excluded.

        Should not return datasets user has no access to.
        """
        # Create private dataset owned by someone else (no permissions)
        dataset = Dataset(
            id="ds_no_access",
            name="No Access Dataset",
            owner_id="other-user-id",
            storage_path="datasets/ds_no_access/",
            storage_type="s3",
            format="images",
            num_images=100,
            visibility="private",
            status="active",
        )
        labeler_db.add(dataset)
        labeler_db.commit()

        response = authenticated_client.get("/api/v1/datasets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should not include the no-access dataset
        dataset_ids = [d["id"] for d in data]
        assert "ds_no_access" not in dataset_ids

    def test_list_datasets_pagination_default(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test default pagination parameters.

        Should use skip=0, limit=100 by default.
        """
        # Create multiple datasets
        for i in range(5):
            dataset = Dataset(
                id=f"ds_page_{i}",
                name=f"Dataset {i}",
                owner_id=mock_current_user["sub"],
                storage_path=f"datasets/ds_page_{i}/",
                storage_type="s3",
                format="images",
                num_images=1,
                visibility="private",
                status="active",
            )
            labeler_db.add(dataset)
        labeler_db.commit()

        response = authenticated_client.get("/api/v1/datasets")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 5

    def test_list_datasets_pagination_with_skip(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test pagination with skip parameter.

        Should skip the specified number of records.
        """
        # Create multiple datasets
        for i in range(10):
            dataset = Dataset(
                id=f"ds_skip_{i}",
                name=f"Dataset {i}",
                owner_id=mock_current_user["sub"],
                storage_path=f"datasets/ds_skip_{i}/",
                storage_type="s3",
                format="images",
                num_images=1,
                visibility="private",
                status="active",
            )
            labeler_db.add(dataset)
        labeler_db.commit()

        response = authenticated_client.get("/api/v1/datasets?skip=5")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 5

    def test_list_datasets_pagination_with_limit(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test pagination with limit parameter.

        Should return at most the specified number of records.
        """
        # Create multiple datasets
        for i in range(10):
            dataset = Dataset(
                id=f"ds_limit_{i}",
                name=f"Dataset {i}",
                owner_id=mock_current_user["sub"],
                storage_path=f"datasets/ds_limit_{i}/",
                storage_type="s3",
                format="images",
                num_images=1,
                visibility="private",
                status="active",
            )
            labeler_db.add(dataset)
        labeler_db.commit()

        response = authenticated_client.get("/api/v1/datasets?limit=3")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 3

    def test_list_datasets_pagination_max_limit(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test that limit is capped at 100.

        Should return at most 100 records even if higher limit specified.
        """
        response = authenticated_client.get("/api/v1/datasets?limit=500")

        assert response.status_code == status.HTTP_200_OK
        # Endpoint caps at min(limit, 100), so it should accept but cap internally

    def test_list_datasets_unauthenticated(self, client):
        """
        Test listing datasets without authentication.

        Should return 403 Forbidden.
        """
        response = client.get("/api/v1/datasets")

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestGetDataset:
    """Test cases for GET /api/v1/datasets/{dataset_id} endpoint."""

    def test_get_dataset_success(self, authenticated_client, labeler_db, test_dataset):
        """
        Test successful dataset retrieval.

        Should return dataset details.
        """
        response = authenticated_client.get(f"/api/v1/datasets/{test_dataset.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["id"] == test_dataset.id
        assert data["name"] == test_dataset.name
        assert data["description"] == test_dataset.description
        assert data["owner_id"] == test_dataset.owner_id
        assert data["num_items"] == test_dataset.num_images
        assert data["source"] == test_dataset.storage_type

    def test_get_dataset_not_found(self, authenticated_client):
        """
        Test getting non-existent dataset.

        Should return 404 Not Found.
        """
        response = authenticated_client.get("/api/v1/datasets/ds_nonexistent")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_get_dataset_response_structure(self, authenticated_client, labeler_db, test_dataset):
        """
        Test that response includes all required fields.

        Should match DatasetResponse schema.
        """
        response = authenticated_client.get(f"/api/v1/datasets/{test_dataset.id}")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify required fields
        assert "id" in data
        assert "name" in data
        assert "owner_id" in data
        assert "num_items" in data
        assert "source" in data
        assert "status" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_get_dataset_unauthenticated(self, client, test_dataset):
        """
        Test getting dataset without authentication.

        Should return 403 Forbidden.
        """
        response = client.get(f"/api/v1/datasets/{test_dataset.id}")

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestUpdateDataset:
    """Test cases for PUT /api/v1/datasets/{dataset_id} endpoint."""

    def test_update_dataset_name(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test updating dataset name.

        Should update name and return updated dataset.
        """
        # Create dataset owned by current user
        dataset = Dataset(
            id="ds_update_name",
            name="Original Name",
            description="Test description",
            owner_id=mock_current_user["sub"],
            storage_path="datasets/ds_update_name/",
            storage_type="s3",
            format="images",
            num_images=5,
            visibility="private",
            status="active",
        )
        labeler_db.add(dataset)

        # Create owner permission
        permission = DatasetPermission(
            dataset_id="ds_update_name",
            user_id=mock_current_user["sub"],
            role="owner",
            granted_by=mock_current_user["sub"],
            granted_at=datetime.utcnow(),
        )
        labeler_db.add(permission)
        labeler_db.commit()

        # Mock require_dataset_permission to return permission
        def mock_require_permission(required_role: str):
            def dependency():
                return permission
            return dependency

        app.dependency_overrides[require_dataset_permission] = mock_require_permission

        update_data = {
            "name": "Updated Name",
            "description": "Test description"
        }

        response = authenticated_client.put(
            "/api/v1/datasets/ds_update_name",
            json=update_data
        )

        # Clear override
        app.dependency_overrides.clear()

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["name"] == "Updated Name"
        assert data["description"] == "Test description"

        # Verify in database
        labeler_db.refresh(dataset)
        assert dataset.name == "Updated Name"

    def test_update_dataset_description(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test updating dataset description.

        Should update description field.
        """
        # Create dataset
        dataset = Dataset(
            id="ds_update_desc",
            name="Test Dataset",
            description="Original description",
            owner_id=mock_current_user["sub"],
            storage_path="datasets/ds_update_desc/",
            storage_type="s3",
            format="images",
            num_images=5,
            visibility="private",
            status="active",
        )
        labeler_db.add(dataset)

        # Create owner permission
        permission = DatasetPermission(
            dataset_id="ds_update_desc",
            user_id=mock_current_user["sub"],
            role="owner",
            granted_by=mock_current_user["sub"],
            granted_at=datetime.utcnow(),
        )
        labeler_db.add(permission)
        labeler_db.commit()

        # Mock require_dataset_permission
        def mock_require_permission(required_role: str):
            def dependency():
                return permission
            return dependency

        app.dependency_overrides[require_dataset_permission] = mock_require_permission

        update_data = {
            "name": "Test Dataset",
            "description": "Updated description"
        }

        response = authenticated_client.put(
            "/api/v1/datasets/ds_update_desc",
            json=update_data
        )

        app.dependency_overrides.clear()

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["description"] == "Updated description"

    def test_update_dataset_visibility(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test updating dataset visibility.

        Should change visibility from private to public.
        """
        # Create dataset
        dataset = Dataset(
            id="ds_update_vis",
            name="Test Dataset",
            description="Test description",
            owner_id=mock_current_user["sub"],
            storage_path="datasets/ds_update_vis/",
            storage_type="s3",
            format="images",
            num_images=5,
            visibility="private",
            status="active",
        )
        labeler_db.add(dataset)

        # Create owner permission
        permission = DatasetPermission(
            dataset_id="ds_update_vis",
            user_id=mock_current_user["sub"],
            role="owner",
            granted_by=mock_current_user["sub"],
            granted_at=datetime.utcnow(),
        )
        labeler_db.add(permission)
        labeler_db.commit()

        # Mock require_dataset_permission
        def mock_require_permission(required_role: str):
            def dependency():
                return permission
            return dependency

        app.dependency_overrides[require_dataset_permission] = mock_require_permission

        update_data = {
            "name": "Test Dataset",
            "description": "Test description",
            "visibility": "public"
        }

        response = authenticated_client.put(
            "/api/v1/datasets/ds_update_vis",
            json=update_data
        )

        app.dependency_overrides.clear()

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["visibility"] == "public"

        # Verify in database
        labeler_db.refresh(dataset)
        assert dataset.visibility == "public"

    def test_update_dataset_multiple_fields(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test updating multiple dataset fields at once.

        Should update all specified fields.
        """
        # Create dataset
        dataset = Dataset(
            id="ds_update_multi",
            name="Original Name",
            description="Original description",
            owner_id=mock_current_user["sub"],
            storage_path="datasets/ds_update_multi/",
            storage_type="s3",
            format="images",
            num_images=5,
            visibility="private",
            status="active",
        )
        labeler_db.add(dataset)

        # Create owner permission
        permission = DatasetPermission(
            dataset_id="ds_update_multi",
            user_id=mock_current_user["sub"],
            role="owner",
            granted_by=mock_current_user["sub"],
            granted_at=datetime.utcnow(),
        )
        labeler_db.add(permission)
        labeler_db.commit()

        # Mock require_dataset_permission
        def mock_require_permission(required_role: str):
            def dependency():
                return permission
            return dependency

        app.dependency_overrides[require_dataset_permission] = mock_require_permission

        update_data = {
            "name": "Updated Name",
            "description": "Updated description",
            "visibility": "public"
        }

        response = authenticated_client.put(
            "/api/v1/datasets/ds_update_multi",
            json=update_data
        )

        app.dependency_overrides.clear()

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated description"
        assert data["visibility"] == "public"

    def test_update_dataset_not_found(self, authenticated_client):
        """
        Test updating non-existent dataset.

        Should return 404 Not Found.
        """
        update_data = {
            "name": "Updated Name",
            "description": "Updated description"
        }

        # Mock require_dataset_permission to pass (will fail on dataset lookup)
        def mock_require_permission(required_role: str):
            def dependency():
                return MagicMock()
            return dependency

        app.dependency_overrides[require_dataset_permission] = mock_require_permission

        response = authenticated_client.put(
            "/api/v1/datasets/ds_nonexistent",
            json=update_data
        )

        app.dependency_overrides.clear()

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_dataset_requires_owner_permission(self, authenticated_client, labeler_db):
        """
        Test that updating dataset requires owner permission.

        Should return 403 if user is not owner.
        """
        # Create dataset owned by someone else
        dataset = Dataset(
            id="ds_update_forbidden",
            name="Test Dataset",
            description="Test description",
            owner_id="other-user-id",
            storage_path="datasets/ds_update_forbidden/",
            storage_type="s3",
            format="images",
            num_images=5,
            visibility="private",
            status="active",
        )
        labeler_db.add(dataset)
        labeler_db.commit()

        update_data = {
            "name": "Updated Name",
            "description": "Updated description"
        }

        # Don't mock permission - let it fail naturally
        response = authenticated_client.put(
            "/api/v1/datasets/ds_update_forbidden",
            json=update_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_dataset_unauthenticated(self, client):
        """
        Test updating dataset without authentication.

        Should return 403 Forbidden.
        """
        update_data = {
            "name": "Updated Name",
            "description": "Updated description"
        }

        response = client.put(
            "/api/v1/datasets/ds_test_001",
            json=update_data
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestListDatasetImages:
    """Test cases for GET /api/v1/datasets/{dataset_id}/images endpoint."""

    @patch('app.services.storage_folder_service.storage_client')
    def test_list_dataset_images_success(self, mock_storage, authenticated_client, labeler_db, test_dataset):
        """
        Test successful image listing with presigned URLs.

        Should return images with presigned URLs.
        """
        # Create image metadata records
        for i in range(5):
            image = ImageMetadata(
                id=f"test_image_{i}.jpg",
                dataset_id=test_dataset.id,
                s3_key=f"datasets/{test_dataset.id}/test_image_{i}.jpg",
                width=800,
                height=600,
                size=50000,
                format="jpg",
                uploaded_at=datetime.utcnow(),
            )
            labeler_db.add(image)
        labeler_db.commit()

        # Mock storage client
        mock_storage.generate_presigned_url.return_value = "https://s3.amazonaws.com/presigned-url"

        response = authenticated_client.get(f"/api/v1/datasets/{test_dataset.id}/images")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) <= 12  # Default limit is 12
        assert len(data) == 5  # We have 5 images

        # Verify image structure
        for image in data:
            assert "id" in image
            assert "file_name" in image
            assert "url" in image
            assert "width" in image
            assert "height" in image

    def test_list_dataset_images_empty(self, authenticated_client, test_dataset):
        """
        Test listing images for dataset with no images.

        Should return empty list.
        """
        response = authenticated_client.get(f"/api/v1/datasets/{test_dataset.id}/images")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data == []

    @patch('app.services.storage_folder_service.storage_client')
    def test_list_dataset_images_custom_limit(self, mock_storage, authenticated_client, labeler_db, test_dataset):
        """
        Test listing images with custom limit.

        Should return at most the specified number of images.
        """
        # Create more images than the limit
        for i in range(20):
            image = ImageMetadata(
                id=f"test_image_{i}.jpg",
                dataset_id=test_dataset.id,
                s3_key=f"datasets/{test_dataset.id}/test_image_{i}.jpg",
                width=800,
                height=600,
                size=50000,
                format="jpg",
                uploaded_at=datetime.utcnow(),
            )
            labeler_db.add(image)
        labeler_db.commit()

        mock_storage.generate_presigned_url.return_value = "https://s3.amazonaws.com/presigned-url"

        response = authenticated_client.get(f"/api/v1/datasets/{test_dataset.id}/images?limit=5")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) == 5

    @patch('app.services.storage_folder_service.storage_client')
    def test_list_dataset_images_random_order(self, mock_storage, authenticated_client, labeler_db, test_dataset):
        """
        Test listing images with random=true.

        Should return images in random order.
        """
        # Create images
        for i in range(10):
            image = ImageMetadata(
                id=f"test_image_{i}.jpg",
                dataset_id=test_dataset.id,
                s3_key=f"datasets/{test_dataset.id}/test_image_{i}.jpg",
                width=800,
                height=600,
                size=50000,
                format="jpg",
                uploaded_at=datetime.utcnow(),
            )
            labeler_db.add(image)
        labeler_db.commit()

        mock_storage.generate_presigned_url.return_value = "https://s3.amazonaws.com/presigned-url"

        response = authenticated_client.get(f"/api/v1/datasets/{test_dataset.id}/images?random=true")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) <= 12

    @patch('app.services.storage_folder_service.storage_client')
    def test_list_dataset_images_sequential_order(self, mock_storage, authenticated_client, labeler_db, test_dataset):
        """
        Test listing images with random=false.

        Should return images in upload order.
        """
        # Create images
        for i in range(10):
            image = ImageMetadata(
                id=f"test_image_{i}.jpg",
                dataset_id=test_dataset.id,
                s3_key=f"datasets/{test_dataset.id}/test_image_{i}.jpg",
                width=800,
                height=600,
                size=50000,
                format="jpg",
                uploaded_at=datetime.utcnow(),
            )
            labeler_db.add(image)
        labeler_db.commit()

        mock_storage.generate_presigned_url.return_value = "https://s3.amazonaws.com/presigned-url"

        response = authenticated_client.get(f"/api/v1/datasets/{test_dataset.id}/images?random=false")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert len(data) <= 12

    def test_list_dataset_images_not_found(self, authenticated_client):
        """
        Test listing images for non-existent dataset.

        Should return 404 Not Found.
        """
        response = authenticated_client.get("/api/v1/datasets/ds_nonexistent/images")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_list_dataset_images_unauthenticated(self, client, test_dataset):
        """
        Test listing images without authentication.

        Should return 403 Forbidden.
        """
        response = client.get(f"/api/v1/datasets/{test_dataset.id}/images")

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestGetDatasetSize:
    """Test cases for GET /api/v1/datasets/{dataset_id}/size endpoint."""

    def test_get_dataset_size_with_images(self, authenticated_client, labeler_db, test_dataset):
        """
        Test getting dataset size with images.

        Should return accurate size statistics.
        """
        # Create image metadata with known sizes
        total_bytes = 0
        for i in range(3):
            size = 1024 * 1024 * (i + 1)  # 1MB, 2MB, 3MB
            total_bytes += size
            image = ImageMetadata(
                id=f"test_image_{i}.jpg",
                dataset_id=test_dataset.id,
                s3_key=f"datasets/{test_dataset.id}/test_image_{i}.jpg",
                width=800,
                height=600,
                size=size,
                format="jpg",
                uploaded_at=datetime.utcnow(),
            )
            labeler_db.add(image)
        labeler_db.commit()

        response = authenticated_client.get(f"/api/v1/datasets/{test_dataset.id}/size")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_images"] == 3
        assert data["total_bytes"] == total_bytes
        assert data["total_mb"] == round(total_bytes / (1024 * 1024), 2)
        assert data["total_gb"] == round(total_bytes / (1024 * 1024 * 1024), 2)

    def test_get_dataset_size_empty(self, authenticated_client, test_dataset):
        """
        Test getting size of empty dataset.

        Should return zero statistics.
        """
        response = authenticated_client.get(f"/api/v1/datasets/{test_dataset.id}/size")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_images"] == 0
        assert data["total_bytes"] == 0
        assert data["total_mb"] == 0
        assert data["total_gb"] == 0

    def test_get_dataset_size_not_found(self, authenticated_client):
        """
        Test getting size of non-existent dataset.

        Should return 404 Not Found.
        """
        response = authenticated_client.get("/api/v1/datasets/ds_nonexistent/size")

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_get_dataset_size_unauthenticated(self, client, test_dataset):
        """
        Test getting dataset size without authentication.

        Should return 403 Forbidden.
        """
        response = client.get(f"/api/v1/datasets/{test_dataset.id}/size")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_dataset_size_large_dataset(self, authenticated_client, labeler_db, test_dataset):
        """
        Test getting size of large dataset.

        Should handle large byte values correctly.
        """
        # Create images totaling over 1GB
        total_bytes = 0
        for i in range(10):
            size = 150 * 1024 * 1024  # 150MB each
            total_bytes += size
            image = ImageMetadata(
                id=f"large_image_{i}.jpg",
                dataset_id=test_dataset.id,
                s3_key=f"datasets/{test_dataset.id}/large_image_{i}.jpg",
                width=4000,
                height=3000,
                size=size,
                format="jpg",
                uploaded_at=datetime.utcnow(),
            )
            labeler_db.add(image)
        labeler_db.commit()

        response = authenticated_client.get(f"/api/v1/datasets/{test_dataset.id}/size")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_images"] == 10
        assert data["total_bytes"] == total_bytes
        assert data["total_gb"] > 1.0  # Should be over 1GB
