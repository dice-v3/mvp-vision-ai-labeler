"""
Tests for export and version endpoints.

Tests the export and version-related endpoints including:
- POST /export/projects/{project_id}/export - Export annotations
- POST /export/projects/{project_id}/versions/publish - Publish version
- GET /export/projects/{project_id}/versions - List versions
"""

import pytest
import json
import zipfile
import io
from unittest.mock import patch, MagicMock, call
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime, timedelta

from app.core.security import get_current_user
from app.db.models.labeler import (
    Annotation,
    AnnotationProject,
    AnnotationVersion,
    AnnotationSnapshot,
    ProjectPermission,
    Dataset,
)
from app.main import app


class TestExportAnnotations:
    """Test cases for POST /api/v1/export/projects/{project_id}/export endpoint."""

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_coco')
    @patch('app.api.v1.endpoints.export.get_coco_stats')
    def test_export_coco_success(
        self,
        mock_coco_stats,
        mock_export_coco,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test successful export in COCO format.

        Should generate COCO JSON, upload to S3, and return download URL.
        """
        # Mock COCO export
        coco_data = {
            "info": {"description": "Test export"},
            "images": [{"id": 1, "file_name": "img_001.jpg"}],
            "annotations": [{"id": 1, "image_id": 1, "category_id": 1}],
            "categories": [{"id": 1, "name": "person"}]
        }
        mock_export_coco.return_value = coco_data
        mock_coco_stats.return_value = {
            "annotation_count": 1,
            "image_count": 1
        }

        # Mock storage upload
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/export_20260104_120000/annotations_coco.json",
            "https://s3.amazonaws.com/bucket/export.json?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )

        export_request = {
            "project_id": test_project.id,
            "export_format": "coco",
            "include_draft": False,
            "image_ids": None
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/export",
            json=export_request
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response structure
        assert "export_path" in data
        assert "download_url" in data
        assert "download_url_expires_at" in data
        assert data["export_format"] == "coco"
        assert data["annotation_count"] == 1
        assert data["image_count"] == 1
        assert data["file_size_bytes"] > 0

        # Verify COCO export was called
        mock_export_coco.assert_called_once()
        call_kwargs = mock_export_coco.call_args.kwargs
        assert call_kwargs["project_id"] == test_project.id
        assert call_kwargs["include_draft"] is False
        assert call_kwargs["image_ids"] is None

        # Verify storage upload was called
        mock_storage.upload_export.assert_called_once()

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_yolo')
    @patch('app.api.v1.endpoints.export.get_yolo_stats')
    def test_export_yolo_success(
        self,
        mock_yolo_stats,
        mock_export_yolo,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test successful export in YOLO format.

        Should generate YOLO zip file with labels and classes.txt.
        """
        # Mock YOLO export
        mock_export_yolo.return_value = (
            {"img_001.jpg": "0 0.5 0.5 0.2 0.2\n"},  # image_annotations
            "person\ncar\n"  # classes.txt
        )
        mock_yolo_stats.return_value = {
            "annotation_count": 1,
            "image_count": 1
        }

        # Mock storage upload
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/export_20260104_120000/annotations_yolo.zip",
            "https://s3.amazonaws.com/bucket/export.zip?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )

        export_request = {
            "project_id": test_project.id,
            "export_format": "yolo",
            "include_draft": False,
            "image_ids": None
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/export",
            json=export_request
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response structure
        assert data["export_format"] == "yolo"
        assert data["annotation_count"] == 1
        assert data["image_count"] == 1
        assert data["file_size_bytes"] > 0

        # Verify YOLO export was called
        mock_export_yolo.assert_called_once()

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_dice')
    @patch('app.api.v1.endpoints.export.get_dice_stats')
    def test_export_dice_success(
        self,
        mock_dice_stats,
        mock_export_dice,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test successful export in DICE format.

        Should generate DICE JSON format.
        """
        # Mock DICE export
        dice_data = {
            "version": "1.0",
            "images": [{"id": "img_001", "annotations": []}]
        }
        mock_export_dice.return_value = dice_data
        mock_dice_stats.return_value = {
            "annotation_count": 1,
            "image_count": 1
        }

        # Mock storage upload
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/export_20260104_120000/annotations.json",
            "https://s3.amazonaws.com/bucket/export.json?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )

        export_request = {
            "project_id": test_project.id,
            "export_format": "dice",
            "include_draft": False,
            "image_ids": None
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/export",
            json=export_request
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response structure
        assert data["export_format"] == "dice"
        assert data["annotation_count"] == 1
        assert data["image_count"] == 1

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_coco')
    @patch('app.api.v1.endpoints.export.get_coco_stats')
    def test_export_with_draft_annotations(
        self,
        mock_coco_stats,
        mock_export_coco,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test export with include_draft flag.

        Should include draft annotations in export.
        """
        # Mock COCO export
        coco_data = {
            "info": {"description": "Test export with drafts"},
            "images": [{"id": 1, "file_name": "img_001.jpg"}],
            "annotations": [
                {"id": 1, "image_id": 1, "category_id": 1},
                {"id": 2, "image_id": 1, "category_id": 1}
            ],
            "categories": [{"id": 1, "name": "person"}]
        }
        mock_export_coco.return_value = coco_data
        mock_coco_stats.return_value = {
            "annotation_count": 2,
            "image_count": 1
        }

        # Mock storage upload
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/export_20260104_120000/annotations_coco.json",
            "https://s3.amazonaws.com/bucket/export.json?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )

        export_request = {
            "project_id": test_project.id,
            "export_format": "coco",
            "include_draft": True,  # Include draft annotations
            "image_ids": None
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/export",
            json=export_request
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify include_draft was passed to export service
        call_kwargs = mock_export_coco.call_args.kwargs
        assert call_kwargs["include_draft"] is True

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_coco')
    @patch('app.api.v1.endpoints.export.get_coco_stats')
    def test_export_specific_images(
        self,
        mock_coco_stats,
        mock_export_coco,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test export with specific image_ids filter.

        Should export only specified images.
        """
        # Mock COCO export
        coco_data = {
            "info": {"description": "Test export"},
            "images": [{"id": 1, "file_name": "img_001.jpg"}],
            "annotations": [{"id": 1, "image_id": 1, "category_id": 1}],
            "categories": [{"id": 1, "name": "person"}]
        }
        mock_export_coco.return_value = coco_data
        mock_coco_stats.return_value = {
            "annotation_count": 1,
            "image_count": 1
        }

        # Mock storage upload
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/export_20260104_120000/annotations_coco.json",
            "https://s3.amazonaws.com/bucket/export.json?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )

        export_request = {
            "project_id": test_project.id,
            "export_format": "coco",
            "include_draft": False,
            "image_ids": ["img_001", "img_002"]  # Specific images
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/export",
            json=export_request
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify image_ids was passed to export service
        call_kwargs = mock_export_coco.call_args.kwargs
        assert call_kwargs["image_ids"] == ["img_001", "img_002"]

    def test_export_project_not_found(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        mock_current_user
    ):
        """
        Test export with non-existent project.

        Should return 404 error.
        """
        export_request = {
            "project_id": "proj_nonexistent",
            "export_format": "coco",
            "include_draft": False,
            "image_ids": None
        }

        response = authenticated_client.post(
            "/api/v1/export/projects/proj_nonexistent/export",
            json=export_request
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_export_unsupported_format(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test export with unsupported format.

        Should return 400 error.
        """
        export_request = {
            "project_id": test_project.id,
            "export_format": "unsupported_format",
            "include_draft": False,
            "image_ids": None
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/export",
            json=export_request
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "unsupported export format" in response.json()["detail"].lower()

    def test_export_unauthenticated(
        self,
        client,
        labeler_db,
        platform_db,
        test_project
    ):
        """
        Test export without authentication.

        Should return 403 error.
        """
        export_request = {
            "project_id": test_project.id,
            "export_format": "coco",
            "include_draft": False,
            "image_ids": None
        }

        response = client.post(
            f"/api/v1/export/projects/{test_project.id}/export",
            json=export_request
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_export_requires_admin_permission(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user,
        create_project_permission
    ):
        """
        Test export requires admin role.

        Viewer role should be denied.
        """
        # Create viewer permission (not admin)
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=mock_current_user["sub"],
            role="viewer"
        )

        export_request = {
            "project_id": test_project.id,
            "export_format": "coco",
            "include_draft": False,
            "image_ids": None
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/export",
            json=export_request
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_coco')
    def test_export_service_error(
        self,
        mock_export_coco,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test export handles service errors gracefully.

        Should return 500 error when export service fails.
        """
        # Mock export service to raise exception
        mock_export_coco.side_effect = Exception("Export service failed")

        export_request = {
            "project_id": test_project.id,
            "export_format": "coco",
            "include_draft": False,
            "image_ids": None
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/export",
            json=export_request
        )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "failed to export" in response.json()["detail"].lower()


class TestPublishVersion:
    """Test cases for POST /api/v1/export/projects/{project_id}/versions/publish endpoint."""

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_dice')
    @patch('app.api.v1.endpoints.export.get_dice_stats')
    @patch('app.api.v1.endpoints.export.export_to_coco')
    @patch('app.api.v1.endpoints.export.get_coco_stats')
    def test_publish_version_success(
        self,
        mock_coco_stats,
        mock_export_coco,
        mock_dice_stats,
        mock_export_dice,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test successful version publish with auto-generated version number.

        Should create version, snapshots, and upload to S3.
        """
        # Create some annotations for the project
        annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            geometry={"type": "bbox", "bbox": [100, 100, 50, 50]},
            class_id="cls_person",
            class_name="person",
            annotation_state="confirmed",
            created_by=mock_current_user["sub"],
            version=1
        )
        labeler_db.add(annotation)
        labeler_db.commit()

        # Mock DICE export
        dice_data = {"version": "1.0", "images": []}
        mock_export_dice.return_value = dice_data
        mock_dice_stats.return_value = {
            "annotation_count": 1,
            "image_count": 1
        }

        # Mock COCO export
        coco_data = {"info": {}, "images": [], "annotations": [], "categories": []}
        mock_export_coco.return_value = coco_data
        mock_coco_stats.return_value = {
            "annotation_count": 1,
            "image_count": 1
        }

        # Mock storage upload
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/detection/v1.0/annotations.json",
            "https://s3.amazonaws.com/bucket/export.json?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )
        mock_storage.update_platform_annotations.return_value = f"datasets/{test_project.dataset_id}/detection/v1.0/annotations.json"

        publish_request = {
            "task_type": "detection",
            "version_number": None,  # Auto-generate
            "description": "First release",
            "export_format": "coco",
            "include_draft": False
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response structure
        assert data["project_id"] == test_project.id
        assert data["task_type"] == "detection"
        assert data["version_number"] == "v1.0"  # Auto-generated
        assert data["version_type"] == "published"
        assert data["description"] == "First release"
        assert data["annotation_count"] == 1
        assert data["image_count"] == 1
        assert data["export_format"] == "dice"  # Primary format
        assert "export_path" in data
        assert "download_url" in data
        assert data["created_by"] == mock_current_user["sub"]

        # Verify version was created in database
        version = labeler_db.query(AnnotationVersion).filter(
            AnnotationVersion.project_id == test_project.id,
            AnnotationVersion.task_type == "detection",
            AnnotationVersion.version_number == "v1.0"
        ).first()
        assert version is not None
        assert version.version_type == "published"

        # Verify annotation snapshots were created
        snapshots = labeler_db.query(AnnotationSnapshot).filter(
            AnnotationSnapshot.version_id == version.id
        ).all()
        assert len(snapshots) == 1
        assert snapshots[0].annotation_id == annotation.id
        assert snapshots[0].snapshot_data["annotation_type"] == "bbox"

        # Verify platform annotations were updated
        mock_storage.update_platform_annotations.assert_called_once()

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_dice')
    @patch('app.api.v1.endpoints.export.get_dice_stats')
    def test_publish_version_custom_version_number(
        self,
        mock_dice_stats,
        mock_export_dice,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test version publish with custom version number.

        Should use provided version number instead of auto-generating.
        """
        # Mock DICE export
        dice_data = {"version": "1.0", "images": []}
        mock_export_dice.return_value = dice_data
        mock_dice_stats.return_value = {
            "annotation_count": 0,
            "image_count": 0
        }

        # Mock storage upload
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/detection/v2.5/annotations.json",
            "https://s3.amazonaws.com/bucket/export.json?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )
        mock_storage.update_platform_annotations.return_value = f"datasets/{test_project.dataset_id}/detection/v2.5/annotations.json"

        publish_request = {
            "task_type": "detection",
            "version_number": "v2.5",  # Custom version
            "description": "Custom version",
            "export_format": "dice",
            "include_draft": False
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["version_number"] == "v2.5"

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_dice')
    @patch('app.api.v1.endpoints.export.get_dice_stats')
    def test_publish_version_increments_version_number(
        self,
        mock_dice_stats,
        mock_export_dice,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test version publish auto-increments from latest version.

        Should increment to v2.0 when v1.0 exists.
        """
        # Create existing version v1.0
        existing_version = AnnotationVersion(
            project_id=test_project.id,
            task_type="detection",
            version_number="v1.0",
            version_type="published",
            created_by=mock_current_user["sub"],
            annotation_count=0,
            image_count=0,
            export_format="dice",
            export_path="exports/v1.0/annotations.json",
            download_url="https://s3.amazonaws.com/bucket/v1.0.json",
            download_url_expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        labeler_db.add(existing_version)
        labeler_db.commit()

        # Mock DICE export
        dice_data = {"version": "1.0", "images": []}
        mock_export_dice.return_value = dice_data
        mock_dice_stats.return_value = {
            "annotation_count": 0,
            "image_count": 0
        }

        # Mock storage upload
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/detection/v2.0/annotations.json",
            "https://s3.amazonaws.com/bucket/export.json?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )
        mock_storage.update_platform_annotations.return_value = f"datasets/{test_project.dataset_id}/detection/v2.0/annotations.json"

        publish_request = {
            "task_type": "detection",
            "version_number": None,  # Auto-generate (should be v2.0)
            "description": "Second release",
            "export_format": "dice",
            "include_draft": False
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["version_number"] == "v2.0"  # Incremented

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_dice')
    @patch('app.api.v1.endpoints.export.get_dice_stats')
    def test_publish_version_duplicate_version_number(
        self,
        mock_dice_stats,
        mock_export_dice,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test version publish with duplicate version number.

        Should return 409 conflict error.
        """
        # Create existing version v1.0
        existing_version = AnnotationVersion(
            project_id=test_project.id,
            task_type="detection",
            version_number="v1.0",
            version_type="published",
            created_by=mock_current_user["sub"],
            annotation_count=0,
            image_count=0,
            export_format="dice",
            export_path="exports/v1.0/annotations.json",
            download_url="https://s3.amazonaws.com/bucket/v1.0.json",
            download_url_expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        labeler_db.add(existing_version)
        labeler_db.commit()

        publish_request = {
            "task_type": "detection",
            "version_number": "v1.0",  # Duplicate
            "description": "Duplicate version",
            "export_format": "dice",
            "include_draft": False
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_409_CONFLICT
        assert "already exists" in response.json()["detail"].lower()

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_dice')
    @patch('app.api.v1.endpoints.export.get_dice_stats')
    def test_publish_version_with_draft_annotations(
        self,
        mock_dice_stats,
        mock_export_dice,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test version publish with include_draft flag.

        Should include draft annotations in snapshots.
        """
        # Create draft annotation
        draft_annotation = Annotation(
            project_id=test_project.id,
            image_id="img_001",
            annotation_type="bbox",
            geometry={"type": "bbox", "bbox": [100, 100, 50, 50]},
            class_id="cls_person",
            class_name="person",
            annotation_state="draft",  # Draft state
            created_by=mock_current_user["sub"],
            version=1
        )
        labeler_db.add(draft_annotation)
        labeler_db.commit()

        # Mock DICE export
        dice_data = {"version": "1.0", "images": []}
        mock_export_dice.return_value = dice_data
        mock_dice_stats.return_value = {
            "annotation_count": 1,
            "image_count": 1
        }

        # Mock storage upload
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/detection/v1.0/annotations.json",
            "https://s3.amazonaws.com/bucket/export.json?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )
        mock_storage.update_platform_annotations.return_value = f"datasets/{test_project.dataset_id}/detection/v1.0/annotations.json"

        publish_request = {
            "task_type": "detection",
            "version_number": "v1.0",
            "description": "With drafts",
            "export_format": "dice",
            "include_draft": True  # Include drafts
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify draft annotation was included
        version = labeler_db.query(AnnotationVersion).filter(
            AnnotationVersion.project_id == test_project.id,
            AnnotationVersion.version_number == "v1.0"
        ).first()
        snapshots = labeler_db.query(AnnotationSnapshot).filter(
            AnnotationSnapshot.version_id == version.id
        ).all()
        assert len(snapshots) == 1

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_dice')
    @patch('app.api.v1.endpoints.export.get_dice_stats')
    @patch('app.api.v1.endpoints.export.export_to_yolo')
    @patch('app.api.v1.endpoints.export.get_yolo_stats')
    def test_publish_version_yolo_format(
        self,
        mock_yolo_stats,
        mock_export_yolo,
        mock_dice_stats,
        mock_export_dice,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test version publish with YOLO format.

        Should create both DICE (primary) and YOLO exports.
        """
        # Mock DICE export (primary)
        dice_data = {"version": "1.0", "images": []}
        mock_export_dice.return_value = dice_data
        mock_dice_stats.return_value = {
            "annotation_count": 0,
            "image_count": 0
        }

        # Mock YOLO export (additional)
        mock_export_yolo.return_value = (
            {},  # image_annotations
            "person\n"  # classes.txt
        )
        mock_yolo_stats.return_value = {
            "annotation_count": 0,
            "image_count": 0
        }

        # Mock storage upload (called twice: DICE + YOLO)
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/detection/v1.0/annotations.json",
            "https://s3.amazonaws.com/bucket/export.json?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )
        mock_storage.update_platform_annotations.return_value = f"datasets/{test_project.dataset_id}/detection/v1.0/annotations.json"

        publish_request = {
            "task_type": "detection",
            "version_number": "v1.0",
            "description": "YOLO export",
            "export_format": "yolo",  # Request YOLO format
            "include_draft": False
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify both DICE and YOLO exports were called
        mock_export_dice.assert_called_once()
        mock_export_yolo.assert_called_once()

        # Verify storage upload was called twice (DICE + YOLO)
        assert mock_storage.upload_export.call_count == 2

    def test_publish_version_project_not_found(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        mock_current_user
    ):
        """
        Test version publish with non-existent project.

        Should return 404 error.
        """
        publish_request = {
            "task_type": "detection",
            "version_number": "v1.0",
            "description": "Test",
            "export_format": "dice",
            "include_draft": False
        }

        response = authenticated_client.post(
            "/api/v1/export/projects/proj_nonexistent/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_publish_version_unauthenticated(
        self,
        client,
        labeler_db,
        platform_db,
        test_project
    ):
        """
        Test version publish without authentication.

        Should return 403 error.
        """
        publish_request = {
            "task_type": "detection",
            "version_number": "v1.0",
            "description": "Test",
            "export_format": "dice",
            "include_draft": False
        }

        response = client.post(
            f"/api/v1/export/projects/{test_project.id}/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_publish_version_requires_admin_permission(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user,
        create_project_permission
    ):
        """
        Test version publish requires admin role.

        Viewer role should be denied.
        """
        # Create viewer permission (not admin)
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=mock_current_user["sub"],
            role="viewer"
        )

        publish_request = {
            "task_type": "detection",
            "version_number": "v1.0",
            "description": "Test",
            "export_format": "dice",
            "include_draft": False
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_dice')
    def test_publish_version_service_error(
        self,
        mock_export_dice,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test version publish handles service errors gracefully.

        Should return 500 error and rollback transaction.
        """
        # Mock export service to raise exception
        mock_export_dice.side_effect = Exception("Export service failed")

        publish_request = {
            "task_type": "detection",
            "version_number": "v1.0",
            "description": "Test",
            "export_format": "dice",
            "include_draft": False
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "failed to publish" in response.json()["detail"].lower()

        # Verify no version was created
        versions = labeler_db.query(AnnotationVersion).filter(
            AnnotationVersion.project_id == test_project.id
        ).all()
        assert len(versions) == 0

    @patch('app.api.v1.endpoints.export.storage_client')
    @patch('app.api.v1.endpoints.export.export_to_dice')
    @patch('app.api.v1.endpoints.export.get_dice_stats')
    def test_publish_version_updates_dataset_labeled_status(
        self,
        mock_dice_stats,
        mock_export_dice,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        test_dataset,
        mock_current_user
    ):
        """
        Test version publish updates dataset labeled status.

        Should set dataset.labeled = True and update published_task_types.
        """
        # Ensure dataset is initially not labeled
        test_dataset.labeled = False
        test_dataset.published_task_types = []
        labeler_db.commit()

        # Mock DICE export
        dice_data = {"version": "1.0", "images": []}
        mock_export_dice.return_value = dice_data
        mock_dice_stats.return_value = {
            "annotation_count": 0,
            "image_count": 0
        }

        # Mock storage upload
        mock_storage.upload_export.return_value = (
            f"exports/{test_project.id}/detection/v1.0/annotations.json",
            "https://s3.amazonaws.com/bucket/export.json?signature=abc",
            datetime.utcnow() + timedelta(hours=1)
        )
        mock_storage.update_platform_annotations.return_value = f"datasets/{test_project.dataset_id}/detection/v1.0/annotations.json"

        publish_request = {
            "task_type": "detection",
            "version_number": "v1.0",
            "description": "First release",
            "export_format": "dice",
            "include_draft": False
        }

        response = authenticated_client.post(
            f"/api/v1/export/projects/{test_project.id}/versions/publish",
            json=publish_request
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify dataset was updated
        labeler_db.refresh(test_dataset)
        assert test_dataset.labeled is True
        assert "detection" in test_dataset.published_task_types


class TestListVersions:
    """Test cases for GET /api/v1/export/projects/{project_id}/versions endpoint."""

    def test_list_versions_success(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test successful version listing.

        Should return all published and working versions.
        """
        # Create published version
        published_version = AnnotationVersion(
            project_id=test_project.id,
            task_type="detection",
            version_number="v1.0",
            version_type="published",
            created_by=mock_current_user["sub"],
            description="First release",
            annotation_count=10,
            image_count=5,
            export_format="dice",
            export_path="exports/v1.0/annotations.json",
            download_url="https://s3.amazonaws.com/bucket/v1.0.json",
            download_url_expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        labeler_db.add(published_version)

        # Create working version
        working_version = AnnotationVersion(
            project_id=test_project.id,
            task_type="detection",
            version_number="working",
            version_type="working",
            created_by=mock_current_user["sub"],
            description="Current work",
            annotation_count=12,
            image_count=6,
            export_format="dice",
            export_path="exports/working/annotations.json",
            download_url="https://s3.amazonaws.com/bucket/working.json",
            download_url_expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        labeler_db.add(working_version)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/export/projects/{test_project.id}/versions"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response structure
        assert "versions" in data
        assert "total" in data
        assert "project_id" in data
        assert data["project_id"] == test_project.id
        assert data["total"] == 2

        # Verify both versions are returned
        versions = data["versions"]
        assert len(versions) == 2

        # Verify version details
        version_numbers = [v["version_number"] for v in versions]
        assert "v1.0" in version_numbers
        assert "working" in version_numbers

    def test_list_versions_empty(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test version listing with no versions.

        Should return empty list.
        """
        response = authenticated_client.get(
            f"/api/v1/export/projects/{test_project.id}/versions"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total"] == 0
        assert len(data["versions"]) == 0

    def test_list_versions_ordered_by_created_at(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test versions are ordered by created_at descending.

        Should return newest versions first.
        """
        # Create older version
        old_version = AnnotationVersion(
            project_id=test_project.id,
            task_type="detection",
            version_number="v1.0",
            version_type="published",
            created_by=mock_current_user["sub"],
            annotation_count=0,
            image_count=0,
            export_format="dice",
            export_path="exports/v1.0/annotations.json",
            download_url="https://s3.amazonaws.com/bucket/v1.0.json",
            download_url_expires_at=datetime.utcnow() + timedelta(hours=1),
            created_at=datetime.utcnow() - timedelta(days=7)
        )
        labeler_db.add(old_version)

        # Create newer version
        new_version = AnnotationVersion(
            project_id=test_project.id,
            task_type="detection",
            version_number="v2.0",
            version_type="published",
            created_by=mock_current_user["sub"],
            annotation_count=0,
            image_count=0,
            export_format="dice",
            export_path="exports/v2.0/annotations.json",
            download_url="https://s3.amazonaws.com/bucket/v2.0.json",
            download_url_expires_at=datetime.utcnow() + timedelta(hours=1),
            created_at=datetime.utcnow() - timedelta(days=1)
        )
        labeler_db.add(new_version)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/export/projects/{test_project.id}/versions"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify newest version is first
        versions = data["versions"]
        assert versions[0]["version_number"] == "v2.0"
        assert versions[1]["version_number"] == "v1.0"

    @patch('app.api.v1.endpoints.export.storage_client')
    def test_list_versions_regenerates_expired_urls(
        self,
        mock_storage,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test expired URLs are regenerated.

        Should regenerate presigned URLs that have expired.
        """
        # Create version with expired URL
        expired_version = AnnotationVersion(
            project_id=test_project.id,
            task_type="detection",
            version_number="v1.0",
            version_type="published",
            created_by=mock_current_user["sub"],
            annotation_count=0,
            image_count=0,
            export_format="dice",
            export_path="exports/v1.0/annotations.json",
            download_url="https://s3.amazonaws.com/bucket/old.json",
            download_url_expires_at=datetime.utcnow() - timedelta(hours=1)  # Expired
        )
        labeler_db.add(expired_version)
        labeler_db.commit()

        # Mock URL regeneration
        new_expires = datetime.utcnow() + timedelta(hours=1)
        mock_storage.regenerate_presigned_url.return_value = (
            "https://s3.amazonaws.com/bucket/new.json?signature=xyz",
            new_expires
        )

        response = authenticated_client.get(
            f"/api/v1/export/projects/{test_project.id}/versions"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify URL was regenerated
        mock_storage.regenerate_presigned_url.assert_called_once_with(
            expired_version.export_path
        )

        # Verify version has new URL
        versions = data["versions"]
        assert "new.json" in versions[0]["download_url"]

    def test_list_versions_project_not_found(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        mock_current_user
    ):
        """
        Test version listing with non-existent project.

        Should return 404 error.
        """
        response = authenticated_client.get(
            "/api/v1/export/projects/proj_nonexistent/versions"
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_list_versions_unauthenticated(
        self,
        client,
        labeler_db,
        platform_db,
        test_project
    ):
        """
        Test version listing without authentication.

        Should return 403 error.
        """
        response = client.get(
            f"/api/v1/export/projects/{test_project.id}/versions"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_list_versions_requires_viewer_permission(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user,
        create_project_permission
    ):
        """
        Test version listing requires viewer role or higher.

        Should succeed with viewer permission.
        """
        # Create viewer permission
        create_project_permission(
            labeler_db,
            project_id=test_project.id,
            user_id=mock_current_user["sub"],
            role="viewer"
        )

        response = authenticated_client.get(
            f"/api/v1/export/projects/{test_project.id}/versions"
        )

        assert response.status_code == status.HTTP_200_OK

    def test_list_versions_response_structure(
        self,
        authenticated_client,
        labeler_db,
        platform_db,
        test_project,
        mock_current_user
    ):
        """
        Test version response includes all required fields.

        Should return complete version information.
        """
        # Create version
        version = AnnotationVersion(
            project_id=test_project.id,
            task_type="detection",
            version_number="v1.0",
            version_type="published",
            created_by=mock_current_user["sub"],
            description="Test version",
            annotation_count=10,
            image_count=5,
            export_format="dice",
            export_path="exports/v1.0/annotations.json",
            download_url="https://s3.amazonaws.com/bucket/v1.0.json",
            download_url_expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        labeler_db.add(version)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/export/projects/{test_project.id}/versions"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify version structure
        version_data = data["versions"][0]
        assert "id" in version_data
        assert "project_id" in version_data
        assert "task_type" in version_data
        assert "version_number" in version_data
        assert "version_type" in version_data
        assert "created_at" in version_data
        assert "created_by" in version_data
        assert "description" in version_data
        assert "annotation_count" in version_data
        assert "image_count" in version_data
        assert "export_format" in version_data
        assert "export_path" in version_data
        assert "download_url" in version_data
        assert "download_url_expires_at" in version_data

        # Verify values
        assert version_data["project_id"] == test_project.id
        assert version_data["task_type"] == "detection"
        assert version_data["version_number"] == "v1.0"
        assert version_data["version_type"] == "published"
        assert version_data["description"] == "Test version"
        assert version_data["annotation_count"] == 10
        assert version_data["image_count"] == 5
        assert version_data["export_format"] == "dice"


# =============================================================================
# Fixture Helpers
# =============================================================================

@pytest.fixture
def create_project_permission():
    """Factory fixture to create project permissions."""
    def _create_permission(
        db: Session,
        project_id: str,
        user_id: str,
        role: str = "viewer"
    ) -> ProjectPermission:
        permission = ProjectPermission(
            project_id=project_id,
            user_id=user_id,
            role=role
        )
        db.add(permission)
        db.commit()
        db.refresh(permission)
        return permission
    return _create_permission
