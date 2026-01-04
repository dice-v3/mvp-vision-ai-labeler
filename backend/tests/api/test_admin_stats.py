"""
Tests for admin statistics endpoints.

Tests the admin-only endpoints for system-wide statistics:
- GET /api/v1/admin/stats/overview - Comprehensive system overview
- GET /api/v1/admin/stats/users - User activity statistics
- GET /api/v1/admin/stats/resources - Resource usage statistics
- GET /api/v1/admin/stats/performance - Performance metrics
- GET /api/v1/admin/stats/sessions - Session statistics

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
    AuditLog,
    UserSession,
)
from app.main import app


# =============================================================================
# Test System Overview Endpoint
# =============================================================================


class TestGetSystemOverview:
    """Tests for GET /api/v1/admin/stats/overview."""

    def test_get_overview_success(self, admin_client, labeler_db, test_user_id):
        """Test successful system overview retrieval."""
        # Create test data
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

        # Create annotations
        for i in range(5):
            ann = Annotation(
                id=f"ann_{i:03d}",
                project_id="proj_001",
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=test_user_id,
            )
            labeler_db.add(ann)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/overview")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify structure
        assert "user_activity" in data
        assert "resource_usage" in data
        assert "performance" in data
        assert "sessions" in data
        assert "generated_at" in data
        assert "time_period_days" in data

        # Verify default time period
        assert data["time_period_days"] == 7

    def test_get_overview_with_custom_days(self, admin_client, labeler_db):
        """Test overview with custom days parameter."""
        response = admin_client.get("/api/v1/admin/stats/overview?days=30")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["time_period_days"] == 30

    def test_get_overview_empty_database(self, admin_client, labeler_db):
        """Test overview with empty database."""
        response = admin_client.get("/api/v1/admin/stats/overview")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify all sections exist with empty/zero data
        assert data["resource_usage"]["datasets"]["total"] == 0
        assert data["resource_usage"]["images"]["total"] == 0
        assert data["resource_usage"]["annotations"]["total"] == 0

    def test_get_overview_days_validation_min(self, admin_client, labeler_db):
        """Test overview with days parameter below minimum (< 1)."""
        response = admin_client.get("/api/v1/admin/stats/overview?days=0")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_overview_days_validation_max(self, admin_client, labeler_db):
        """Test overview with days parameter above maximum (> 90)."""
        response = admin_client.get("/api/v1/admin/stats/overview?days=91")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_overview_requires_admin(self, authenticated_client, labeler_db):
        """Test that non-admin users cannot access overview."""
        response = authenticated_client.get("/api/v1/admin/stats/overview")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_overview_unauthenticated(self, client, labeler_db):
        """Test that unauthenticated users cannot access overview."""
        response = client.get("/api/v1/admin/stats/overview")

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test User Activity Statistics Endpoint
# =============================================================================


class TestGetUserActivityStats:
    """Tests for GET /api/v1/admin/stats/users."""

    def test_get_user_stats_success(self, admin_client, labeler_db, test_user_id):
        """Test successful user activity statistics retrieval."""
        # Create recent annotations to show active users
        now = datetime.utcnow()
        for i in range(3):
            ann = Annotation(
                id=f"ann_{i:03d}",
                project_id="proj_001",
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=test_user_id,
                created_at=now - timedelta(days=2),
            )
            labeler_db.add(ann)
        labeler_db.commit()

        # Create audit logs for login activity
        for i in range(5):
            log = AuditLog(
                user_id=test_user_id,
                action="login",
                timestamp=now - timedelta(days=i),
            )
            labeler_db.add(log)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/users")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify structure
        assert "total_users" in data
        assert "active_users_7d" in data
        assert "active_users_30d" in data
        assert "new_users_7d" in data
        assert "new_users_30d" in data
        assert "registration_trend" in data
        assert "login_activity" in data

        # Verify login activity
        assert "logins_7d" in data["login_activity"]
        assert "logins_30d" in data["login_activity"]
        assert data["login_activity"]["logins_7d"] >= 5

    def test_get_user_stats_with_custom_days(self, admin_client, labeler_db):
        """Test user stats with custom days parameter."""
        response = admin_client.get("/api/v1/admin/stats/users?days=60")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should return valid structure
        assert isinstance(data["total_users"], int)
        assert isinstance(data["active_users_7d"], int)
        assert isinstance(data["active_users_30d"], int)

    def test_get_user_stats_empty_database(self, admin_client, labeler_db):
        """Test user stats with empty database."""
        response = admin_client.get("/api/v1/admin/stats/users")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # All counts should be zero
        assert data["total_users"] == 0
        assert data["active_users_7d"] == 0
        assert data["active_users_30d"] == 0
        assert data["new_users_7d"] == 0
        assert data["new_users_30d"] == 0
        assert data["login_activity"]["logins_7d"] == 0
        assert data["login_activity"]["logins_30d"] == 0

    def test_get_user_stats_active_users(self, admin_client, labeler_db, test_user_id):
        """Test active users calculation based on annotations."""
        now = datetime.utcnow()

        # User active in last 7 days
        ann1 = Annotation(
            id="ann_001",
            project_id="proj_001",
            image_id="img_001.jpg",
            annotation_type="bbox",
            task_type="detection",
            geometry={"x": 10, "y": 10, "width": 50, "height": 50},
            created_by=test_user_id,
            created_at=now - timedelta(days=3),
        )
        labeler_db.add(ann1)

        # User active in last 30 days but not 7 days
        ann2 = Annotation(
            id="ann_002",
            project_id="proj_001",
            image_id="img_002.jpg",
            annotation_type="bbox",
            task_type="detection",
            geometry={"x": 10, "y": 10, "width": 50, "height": 50},
            created_by="user_002",
            created_at=now - timedelta(days=15),
        )
        labeler_db.add(ann2)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/users")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify active user counts
        assert data["active_users_7d"] == 1
        assert data["active_users_30d"] == 2

    def test_get_user_stats_days_validation_min(self, admin_client, labeler_db):
        """Test user stats with days parameter below minimum."""
        response = admin_client.get("/api/v1/admin/stats/users?days=0")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_user_stats_days_validation_max(self, admin_client, labeler_db):
        """Test user stats with days parameter above maximum."""
        response = admin_client.get("/api/v1/admin/stats/users?days=91")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_user_stats_requires_admin(self, authenticated_client, labeler_db):
        """Test that non-admin users cannot access user stats."""
        response = authenticated_client.get("/api/v1/admin/stats/users")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_user_stats_unauthenticated(self, client, labeler_db):
        """Test that unauthenticated users cannot access user stats."""
        response = client.get("/api/v1/admin/stats/users")

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test Resource Usage Statistics Endpoint
# =============================================================================


class TestGetResourceUsageStats:
    """Tests for GET /api/v1/admin/stats/resources."""

    def test_get_resource_stats_success(self, admin_client, labeler_db, test_user_id):
        """Test successful resource usage statistics retrieval."""
        # Create datasets
        for i in range(3):
            dataset = Dataset(
                id=f"ds_{i:03d}",
                name=f"Dataset {i}",
                owner_id=test_user_id,
                storage_path=f"s3://bucket/ds_{i:03d}",
                storage_type="s3",
                format="images",
                num_images=100 * (i + 1),
                status="active" if i < 2 else "completed",
                visibility="private",
            )
            labeler_db.add(dataset)
        labeler_db.commit()

        # Create image metadata
        for i in range(5):
            img = ImageMetadata(
                id=f"img_{i:03d}.jpg",
                dataset_id="ds_000",
                file_name=f"img_{i:03d}.jpg",
                s3_key=f"ds_000/img_{i:03d}.jpg",
                size=1024 * 1024 * 10,  # 10 MB
            )
            labeler_db.add(img)
        labeler_db.commit()

        # Create annotations
        for i in range(10):
            ann = Annotation(
                id=f"ann_{i:03d}",
                project_id="proj_001",
                image_id=f"img_{i % 5:03d}.jpg",
                annotation_type="bbox" if i % 2 == 0 else "polygon",
                task_type="detection" if i % 2 == 0 else "segmentation",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=test_user_id,
            )
            labeler_db.add(ann)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/resources")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify structure
        assert "datasets" in data
        assert "images" in data
        assert "annotations" in data
        assert "storage" in data

        # Verify dataset stats
        assert data["datasets"]["total"] == 3
        assert "by_status" in data["datasets"]
        assert data["datasets"]["by_status"]["active"] == 2
        assert data["datasets"]["by_status"]["completed"] == 1

        # Verify image stats
        assert data["images"]["total"] == 600  # 100 + 200 + 300

        # Verify annotation stats
        assert data["annotations"]["total"] == 10
        assert "by_task_type" in data["annotations"]
        assert data["annotations"]["by_task_type"]["detection"] == 5
        assert data["annotations"]["by_task_type"]["segmentation"] == 5
        assert "recent_7d" in data["annotations"]

        # Verify storage stats
        assert data["storage"]["total_bytes"] == 5 * 1024 * 1024 * 10  # 50 MB
        assert "total_gb" in data["storage"]

    def test_get_resource_stats_empty_database(self, admin_client, labeler_db):
        """Test resource stats with empty database."""
        response = admin_client.get("/api/v1/admin/stats/resources")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # All counts should be zero
        assert data["datasets"]["total"] == 0
        assert data["datasets"]["by_status"] == {}
        assert data["images"]["total"] == 0
        assert data["annotations"]["total"] == 0
        assert data["annotations"]["by_task_type"] == {}
        assert data["annotations"]["recent_7d"] == 0
        assert data["storage"]["total_bytes"] == 0
        assert data["storage"]["total_gb"] == 0

    def test_get_resource_stats_dataset_status_distribution(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test dataset status distribution."""
        statuses = ["active", "active", "completed", "archived", "pending"]
        for i, status_val in enumerate(statuses):
            dataset = Dataset(
                id=f"ds_{i:03d}",
                name=f"Dataset {i}",
                owner_id=test_user_id,
                storage_path=f"s3://bucket/ds_{i:03d}",
                storage_type="s3",
                format="images",
                num_images=10,
                status=status_val,
                visibility="private",
            )
            labeler_db.add(dataset)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/resources")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify status distribution
        assert data["datasets"]["by_status"]["active"] == 2
        assert data["datasets"]["by_status"]["completed"] == 1
        assert data["datasets"]["by_status"]["archived"] == 1
        assert data["datasets"]["by_status"]["pending"] == 1

    def test_get_resource_stats_task_type_distribution(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test annotation task type distribution."""
        task_types = [
            "detection",
            "detection",
            "detection",
            "segmentation",
            "segmentation",
            "classification",
            "keypoints",
        ]

        for i, task_type in enumerate(task_types):
            ann = Annotation(
                id=f"ann_{i:03d}",
                project_id="proj_001",
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type=task_type,
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=test_user_id,
            )
            labeler_db.add(ann)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/resources")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify task type distribution
        assert data["annotations"]["by_task_type"]["detection"] == 3
        assert data["annotations"]["by_task_type"]["segmentation"] == 2
        assert data["annotations"]["by_task_type"]["classification"] == 1
        assert data["annotations"]["by_task_type"]["keypoints"] == 1

    def test_get_resource_stats_recent_annotations(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test recent annotations count (last 7 days)."""
        now = datetime.utcnow()

        # Create annotations at different times
        # Recent (last 7 days)
        for i in range(5):
            ann = Annotation(
                id=f"ann_recent_{i:03d}",
                project_id="proj_001",
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=test_user_id,
                created_at=now - timedelta(days=3),
            )
            labeler_db.add(ann)

        # Old (> 7 days)
        for i in range(3):
            ann = Annotation(
                id=f"ann_old_{i:03d}",
                project_id="proj_001",
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=test_user_id,
                created_at=now - timedelta(days=10),
            )
            labeler_db.add(ann)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/resources")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify recent annotation count
        assert data["annotations"]["total"] == 8
        assert data["annotations"]["recent_7d"] == 5

    def test_get_resource_stats_storage_calculation(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test storage size calculation and conversion to GB."""
        # Create image metadata with various sizes
        sizes = [
            1024 * 1024 * 100,  # 100 MB
            1024 * 1024 * 200,  # 200 MB
            1024 * 1024 * 300,  # 300 MB
        ]

        for i, size in enumerate(sizes):
            img = ImageMetadata(
                id=f"img_{i:03d}.jpg",
                dataset_id="ds_001",
                file_name=f"img_{i:03d}.jpg",
                s3_key=f"ds_001/img_{i:03d}.jpg",
                size=size,
            )
            labeler_db.add(img)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/resources")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify storage stats
        total_bytes = 1024 * 1024 * 600  # 600 MB
        assert data["storage"]["total_bytes"] == total_bytes
        # 600 MB = 0.59 GB (approximately)
        assert data["storage"]["total_gb"] == pytest.approx(0.56, abs=0.1)

    def test_get_resource_stats_requires_admin(
        self, authenticated_client, labeler_db
    ):
        """Test that non-admin users cannot access resource stats."""
        response = authenticated_client.get("/api/v1/admin/stats/resources")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_resource_stats_unauthenticated(self, client, labeler_db):
        """Test that unauthenticated users cannot access resource stats."""
        response = client.get("/api/v1/admin/stats/resources")

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test Performance Metrics Endpoint
# =============================================================================


class TestGetPerformanceMetrics:
    """Tests for GET /api/v1/admin/stats/performance."""

    def test_get_performance_metrics_success(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test successful performance metrics retrieval."""
        now = datetime.utcnow()

        # Create annotations over the last few days
        for day in range(5):
            for i in range(3):
                ann = Annotation(
                    id=f"ann_day{day}_{i:03d}",
                    project_id="proj_001",
                    image_id=f"img_{i:03d}.jpg",
                    annotation_type="bbox",
                    task_type="detection",
                    geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                    created_by=test_user_id if i == 0 else f"user_{i:03d}",
                    created_at=now - timedelta(days=day + 1, hours=12),
                )
                labeler_db.add(ann)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/performance")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify structure
        assert "annotation_rate" in data
        assert "task_distribution" in data
        assert "top_annotators" in data

        # Verify annotation rate structure
        assert "daily" in data["annotation_rate"]
        assert "average_per_day" in data["annotation_rate"]
        assert "total_period" in data["annotation_rate"]

        # Verify daily array has 7 entries (default days)
        assert len(data["annotation_rate"]["daily"]) == 7

        # Verify each daily entry has date and count
        for daily_entry in data["annotation_rate"]["daily"]:
            assert "date" in daily_entry
            assert "count" in daily_entry

        # Verify averages
        assert isinstance(data["annotation_rate"]["average_per_day"], (int, float))
        assert isinstance(data["annotation_rate"]["total_period"], int)

    def test_get_performance_metrics_with_custom_days(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test performance metrics with custom days parameter."""
        now = datetime.utcnow()

        # Create annotations
        for i in range(5):
            ann = Annotation(
                id=f"ann_{i:03d}",
                project_id="proj_001",
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=test_user_id,
                created_at=now - timedelta(days=2),
            )
            labeler_db.add(ann)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/performance?days=30")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify daily array has 30 entries
        assert len(data["annotation_rate"]["daily"]) == 30

    def test_get_performance_metrics_empty_database(self, admin_client, labeler_db):
        """Test performance metrics with empty database."""
        response = admin_client.get("/api/v1/admin/stats/performance")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify empty data
        assert data["annotation_rate"]["total_period"] == 0
        assert data["annotation_rate"]["average_per_day"] == 0
        assert len(data["annotation_rate"]["daily"]) == 7
        assert data["task_distribution"] == {}
        assert data["top_annotators"] == []

    def test_get_performance_metrics_annotation_rate_calculation(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test annotation rate calculation."""
        now = datetime.utcnow()

        # Create 10 annotations per day for 5 days
        for day in range(5):
            for i in range(10):
                ann = Annotation(
                    id=f"ann_day{day}_{i:03d}",
                    project_id="proj_001",
                    image_id=f"img_{i:03d}.jpg",
                    annotation_type="bbox",
                    task_type="detection",
                    geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                    created_by=test_user_id,
                    created_at=now - timedelta(days=day + 1, hours=12),
                )
                labeler_db.add(ann)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/performance?days=7")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify annotation rate
        # 50 annotations over 7 days = 7.14 per day
        assert data["annotation_rate"]["total_period"] == 50
        assert data["annotation_rate"]["average_per_day"] == pytest.approx(
            7.14, abs=0.01
        )

    def test_get_performance_metrics_task_distribution(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test task type distribution in performance metrics."""
        now = datetime.utcnow()
        cutoff = now - timedelta(days=7)

        # Create annotations with different task types within period
        task_types = ["detection", "detection", "segmentation", "classification"]
        for i, task_type in enumerate(task_types):
            ann = Annotation(
                id=f"ann_{i:03d}",
                project_id="proj_001",
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type=task_type,
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=test_user_id,
                created_at=cutoff + timedelta(days=1),
            )
            labeler_db.add(ann)

        # Create annotation outside period (should not be counted)
        old_ann = Annotation(
            id="ann_old",
            project_id="proj_001",
            image_id="img_old.jpg",
            annotation_type="bbox",
            task_type="detection",
            geometry={"x": 10, "y": 10, "width": 50, "height": 50},
            created_by=test_user_id,
            created_at=cutoff - timedelta(days=1),
        )
        labeler_db.add(old_ann)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/performance")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify task distribution (only within period)
        assert data["task_distribution"]["detection"] == 2
        assert data["task_distribution"]["segmentation"] == 1
        assert data["task_distribution"]["classification"] == 1

    def test_get_performance_metrics_top_annotators(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test top annotators ranking."""
        now = datetime.utcnow()
        cutoff = now - timedelta(days=7)

        # Create annotations by different users
        annotators = [
            ("user_001", 10),  # Top annotator
            ("user_002", 7),
            ("user_003", 5),
            (test_user_id, 3),
        ]

        for user_id, count in annotators:
            for i in range(count):
                ann = Annotation(
                    id=f"ann_{user_id}_{i:03d}",
                    project_id="proj_001",
                    image_id=f"img_{i:03d}.jpg",
                    annotation_type="bbox",
                    task_type="detection",
                    geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                    created_by=user_id,
                    created_at=cutoff + timedelta(days=1),
                )
                labeler_db.add(ann)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/performance")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify top annotators
        assert len(data["top_annotators"]) == 4

        # Verify ordering (descending by count)
        assert data["top_annotators"][0]["user_id"] == "user_001"
        assert data["top_annotators"][0]["annotation_count"] == 10
        assert data["top_annotators"][1]["user_id"] == "user_002"
        assert data["top_annotators"][1]["annotation_count"] == 7
        assert data["top_annotators"][2]["user_id"] == "user_003"
        assert data["top_annotators"][2]["annotation_count"] == 5

    def test_get_performance_metrics_top_annotators_limit(
        self, admin_client, labeler_db
    ):
        """Test that top annotators is limited to 10."""
        now = datetime.utcnow()
        cutoff = now - timedelta(days=7)

        # Create 15 annotators with 1 annotation each
        for i in range(15):
            ann = Annotation(
                id=f"ann_{i:03d}",
                project_id="proj_001",
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=f"user_{i:03d}",
                created_at=cutoff + timedelta(days=1),
            )
            labeler_db.add(ann)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/performance")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify limit of 10
        assert len(data["top_annotators"]) == 10

    def test_get_performance_metrics_days_validation_min(
        self, admin_client, labeler_db
    ):
        """Test performance metrics with days parameter below minimum."""
        response = admin_client.get("/api/v1/admin/stats/performance?days=0")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_performance_metrics_days_validation_max(
        self, admin_client, labeler_db
    ):
        """Test performance metrics with days parameter above maximum."""
        response = admin_client.get("/api/v1/admin/stats/performance?days=91")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_performance_metrics_requires_admin(
        self, authenticated_client, labeler_db
    ):
        """Test that non-admin users cannot access performance metrics."""
        response = authenticated_client.get("/api/v1/admin/stats/performance")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_performance_metrics_unauthenticated(self, client, labeler_db):
        """Test that unauthenticated users cannot access performance metrics."""
        response = client.get("/api/v1/admin/stats/performance")

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Test Session Statistics Endpoint
# =============================================================================


class TestGetSessionStats:
    """Tests for GET /api/v1/admin/stats/sessions."""

    def test_get_session_stats_success(self, admin_client, labeler_db, test_user_id):
        """Test successful session statistics retrieval."""
        now = datetime.utcnow()

        # Create sessions
        for i in range(5):
            session = UserSession(
                id=f"session_{i:03d}",
                user_id=test_user_id,
                login_at=now - timedelta(days=i),
                logout_at=now - timedelta(days=i, hours=-2),  # 2 hour session
                duration_seconds=7200,
            )
            labeler_db.add(session)

        # Create active session (no logout)
        active_session = UserSession(
            id="session_active",
            user_id=test_user_id,
            login_at=now - timedelta(hours=1),
            logout_at=None,
            duration_seconds=None,
        )
        labeler_db.add(active_session)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/sessions")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify structure
        assert "total_sessions" in data
        assert "active_sessions" in data
        assert "avg_duration_seconds" in data
        assert "avg_duration_minutes" in data
        assert "sessions_by_day" in data

        # Verify counts
        assert data["total_sessions"] == 6
        assert data["active_sessions"] == 1

        # Verify durations
        assert data["avg_duration_seconds"] == 7200
        assert data["avg_duration_minutes"] == 120.0

        # Verify sessions_by_day has 7 entries
        assert len(data["sessions_by_day"]) == 7

    def test_get_session_stats_with_custom_days(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test session stats with custom days parameter."""
        now = datetime.utcnow()

        # Create sessions
        for i in range(3):
            session = UserSession(
                id=f"session_{i:03d}",
                user_id=test_user_id,
                login_at=now - timedelta(days=i * 10),
                logout_at=now - timedelta(days=i * 10, hours=-1),
                duration_seconds=3600,
            )
            labeler_db.add(session)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/sessions?days=30")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify sessions_by_day has 30 entries
        assert len(data["sessions_by_day"]) == 30

    def test_get_session_stats_empty_database(self, admin_client, labeler_db):
        """Test session stats with empty database."""
        response = admin_client.get("/api/v1/admin/stats/sessions")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify empty data
        assert data["total_sessions"] == 0
        assert data["active_sessions"] == 0
        assert data["avg_duration_seconds"] == 0
        assert data["avg_duration_minutes"] == 0
        assert len(data["sessions_by_day"]) == 7

    def test_get_session_stats_active_sessions_count(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test active sessions count (no logout)."""
        now = datetime.utcnow()

        # Create completed sessions
        for i in range(3):
            session = UserSession(
                id=f"session_completed_{i:03d}",
                user_id=test_user_id,
                login_at=now - timedelta(days=1),
                logout_at=now - timedelta(hours=23),
                duration_seconds=3600,
            )
            labeler_db.add(session)

        # Create active sessions
        for i in range(2):
            session = UserSession(
                id=f"session_active_{i:03d}",
                user_id=f"user_{i:03d}",
                login_at=now - timedelta(hours=1),
                logout_at=None,
                duration_seconds=None,
            )
            labeler_db.add(session)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/sessions")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify active sessions
        assert data["active_sessions"] == 2

    def test_get_session_stats_duration_calculation(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test average session duration calculation."""
        now = datetime.utcnow()

        # Create sessions with different durations
        durations = [3600, 7200, 5400]  # 1h, 2h, 1.5h

        for i, duration in enumerate(durations):
            session = UserSession(
                id=f"session_{i:03d}",
                user_id=test_user_id,
                login_at=now - timedelta(days=1),
                logout_at=now - timedelta(days=1, seconds=-duration),
                duration_seconds=duration,
            )
            labeler_db.add(session)

        # Create session without duration (should be excluded from average)
        session_no_duration = UserSession(
            id="session_no_duration",
            user_id=test_user_id,
            login_at=now - timedelta(hours=1),
            logout_at=None,
            duration_seconds=None,
        )
        labeler_db.add(session_no_duration)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/sessions")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Average of 3600, 7200, 5400 = 5400
        assert data["avg_duration_seconds"] == 5400
        assert data["avg_duration_minutes"] == 90.0

    def test_get_session_stats_sessions_by_day(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test sessions by day breakdown."""
        now = datetime.utcnow()

        # Create sessions on different days
        for day in range(5):
            for i in range(day + 1):  # More sessions on recent days
                session = UserSession(
                    id=f"session_day{day}_{i:03d}",
                    user_id=test_user_id,
                    login_at=now - timedelta(days=day + 1, hours=12),
                    logout_at=now - timedelta(days=day + 1, hours=10),
                    duration_seconds=7200,
                )
                labeler_db.add(session)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/sessions?days=7")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify sessions_by_day structure
        assert len(data["sessions_by_day"]) == 7

        # Each entry should have date and count
        for daily_entry in data["sessions_by_day"]:
            assert "date" in daily_entry
            assert "count" in daily_entry

        # Total should match
        total_from_daily = sum(d["count"] for d in data["sessions_by_day"])
        assert total_from_daily == data["total_sessions"]

    def test_get_session_stats_time_period_filtering(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test that sessions are filtered by time period."""
        now = datetime.utcnow()

        # Create sessions within period
        for i in range(3):
            session = UserSession(
                id=f"session_recent_{i:03d}",
                user_id=test_user_id,
                login_at=now - timedelta(days=3),
                logout_at=now - timedelta(days=3, hours=-1),
                duration_seconds=3600,
            )
            labeler_db.add(session)

        # Create sessions outside period
        for i in range(2):
            session = UserSession(
                id=f"session_old_{i:03d}",
                user_id=test_user_id,
                login_at=now - timedelta(days=10),
                logout_at=now - timedelta(days=10, hours=-1),
                duration_seconds=3600,
            )
            labeler_db.add(session)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/sessions?days=7")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Only sessions within 7 days should be counted
        assert data["total_sessions"] == 3

    def test_get_session_stats_days_validation_min(self, admin_client, labeler_db):
        """Test session stats with days parameter below minimum."""
        response = admin_client.get("/api/v1/admin/stats/sessions?days=0")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_session_stats_days_validation_max(self, admin_client, labeler_db):
        """Test session stats with days parameter above maximum."""
        response = admin_client.get("/api/v1/admin/stats/sessions?days=91")

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_get_session_stats_requires_admin(self, authenticated_client, labeler_db):
        """Test that non-admin users cannot access session stats."""
        response = authenticated_client.get("/api/v1/admin/stats/sessions")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_session_stats_unauthenticated(self, client, labeler_db):
        """Test that unauthenticated users cannot access session stats."""
        response = client.get("/api/v1/admin/stats/sessions")

        assert response.status_code == status.HTTP_403_FORBIDDEN


# =============================================================================
# Integration Tests
# =============================================================================


class TestAdminStatsIntegration:
    """Integration tests for admin stats endpoints."""

    def test_all_endpoints_require_admin_role(
        self, authenticated_client, labeler_db
    ):
        """Test that all admin stats endpoints require admin role."""
        endpoints = [
            "/api/v1/admin/stats/overview",
            "/api/v1/admin/stats/users",
            "/api/v1/admin/stats/resources",
            "/api/v1/admin/stats/performance",
            "/api/v1/admin/stats/sessions",
        ]

        for endpoint in endpoints:
            response = authenticated_client.get(endpoint)
            assert (
                response.status_code == status.HTTP_403_FORBIDDEN
            ), f"Endpoint {endpoint} should require admin role"

    def test_all_endpoints_accessible_by_admin(self, admin_client, labeler_db):
        """Test that all admin stats endpoints are accessible by admin users."""
        endpoints = [
            "/api/v1/admin/stats/overview",
            "/api/v1/admin/stats/users",
            "/api/v1/admin/stats/resources",
            "/api/v1/admin/stats/performance",
            "/api/v1/admin/stats/sessions",
        ]

        for endpoint in endpoints:
            response = admin_client.get(endpoint)
            assert (
                response.status_code == status.HTTP_200_OK
            ), f"Endpoint {endpoint} should be accessible by admin"

    def test_system_overview_aggregates_all_stats(
        self, admin_client, labeler_db, test_user_id
    ):
        """Test that system overview aggregates all statistics correctly."""
        now = datetime.utcnow()

        # Create comprehensive test data
        # Dataset
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

        # Annotations
        for i in range(5):
            ann = Annotation(
                id=f"ann_{i:03d}",
                project_id="proj_001",
                image_id=f"img_{i:03d}.jpg",
                annotation_type="bbox",
                task_type="detection",
                geometry={"x": 10, "y": 10, "width": 50, "height": 50},
                created_by=test_user_id,
                created_at=now - timedelta(days=2),
            )
            labeler_db.add(ann)

        # Session
        session = UserSession(
            id="session_001",
            user_id=test_user_id,
            login_at=now - timedelta(days=1),
            logout_at=now - timedelta(hours=23),
            duration_seconds=3600,
        )
        labeler_db.add(session)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/stats/overview")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify all sections have correct data
        assert data["resource_usage"]["datasets"]["total"] == 1
        assert data["resource_usage"]["annotations"]["total"] == 5
        assert data["performance"]["annotation_rate"]["total_period"] == 5
        assert data["sessions"]["total_sessions"] == 1
        assert data["user_activity"]["active_users_7d"] == 1
