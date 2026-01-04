"""
Tests for admin audit log endpoints.

Tests the admin-only endpoints for audit log management:
- GET /api/v1/admin/audit-logs - List audit logs (paginated, filtered)
- GET /api/v1/admin/audit-logs/{id} - Get audit log detail
- GET /api/v1/admin/audit-logs/stats/summary - Get audit log statistics
- GET /api/v1/admin/audit-logs/meta/actions - Get available actions
- GET /api/v1/admin/audit-logs/meta/resource-types - Get available resource types

All endpoints require admin privileges (is_admin = True).
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json

from app.db.models.labeler import AuditLog
from app.main import app


# =============================================================================
# Test List Audit Logs Endpoint
# =============================================================================


class TestListAuditLogs:
    """Tests for GET /api/v1/admin/audit-logs."""

    def test_list_audit_logs_empty(self, admin_client, labeler_db):
        """Test listing audit logs when database is empty."""
        response = admin_client.get("/api/v1/admin/audit-logs")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["limit"] == 50
        assert data["offset"] == 0
        assert data["items"] == []

    def test_list_audit_logs_with_data(self, admin_client, labeler_db, test_user_id):
        """Test listing audit logs with sample data."""
        # Create sample audit logs
        log1 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
            details={"name": "Test Dataset"},
            timestamp=datetime.utcnow() - timedelta(hours=2),
        )
        log2 = AuditLog(
            user_id=test_user_id,
            action="update",
            resource_type="project",
            resource_id="proj_001",
            status="success",
            timestamp=datetime.utcnow() - timedelta(hours=1),
        )
        labeler_db.add_all([log1, log2])
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert data["limit"] == 50
        assert data["offset"] == 0
        assert len(data["items"]) == 2

        # Verify ordered by timestamp descending (newest first)
        assert data["items"][0]["action"] == "update"
        assert data["items"][1]["action"] == "create"

    def test_list_audit_logs_pagination_default(self, admin_client, labeler_db, test_user_id):
        """Test pagination with default parameters."""
        # Create 5 audit logs
        for i in range(5):
            log = AuditLog(
                user_id=test_user_id,
                action=f"action_{i}",
                resource_type="dataset",
                resource_id=f"ds_{i:03d}",
                status="success",
                timestamp=datetime.utcnow() - timedelta(hours=i),
            )
            labeler_db.add(log)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 5
        assert data["limit"] == 50
        assert data["offset"] == 0
        assert len(data["items"]) == 5

    def test_list_audit_logs_pagination_custom(self, admin_client, labeler_db, test_user_id):
        """Test pagination with custom limit and offset."""
        # Create 10 audit logs
        for i in range(10):
            log = AuditLog(
                user_id=test_user_id,
                action=f"action_{i}",
                resource_type="dataset",
                resource_id=f"ds_{i:03d}",
                status="success",
                timestamp=datetime.utcnow() - timedelta(hours=i),
            )
            labeler_db.add(log)
        labeler_db.commit()

        # Get page 2 with limit 3
        response = admin_client.get("/api/v1/admin/audit-logs?limit=3&offset=3")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 10
        assert data["limit"] == 3
        assert data["offset"] == 3
        assert len(data["items"]) == 3

    def test_list_audit_logs_filter_by_user_id(self, admin_client, labeler_db, test_user_id):
        """Test filtering audit logs by user_id."""
        # Create logs for different users
        log1 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
        )
        log2 = AuditLog(
            user_id="other_user_id",
            action="create",
            resource_type="dataset",
            resource_id="ds_002",
            status="success",
        )
        labeler_db.add_all([log1, log2])
        labeler_db.commit()

        response = admin_client.get(f"/api/v1/admin/audit-logs?user_id={test_user_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["user_id"] == test_user_id

    def test_list_audit_logs_filter_by_action(self, admin_client, labeler_db, test_user_id):
        """Test filtering audit logs by action type."""
        # Create logs with different actions
        log1 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
        )
        log2 = AuditLog(
            user_id=test_user_id,
            action="delete",
            resource_type="dataset",
            resource_id="ds_002",
            status="success",
        )
        log3 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="project",
            resource_id="proj_001",
            status="success",
        )
        labeler_db.add_all([log1, log2, log3])
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs?action=create")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2
        assert all(item["action"] == "create" for item in data["items"])

    def test_list_audit_logs_filter_by_resource_type(self, admin_client, labeler_db, test_user_id):
        """Test filtering audit logs by resource type."""
        # Create logs with different resource types
        log1 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
        )
        log2 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="project",
            resource_id="proj_001",
            status="success",
        )
        log3 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="annotation",
            resource_id="ann_001",
            status="success",
        )
        labeler_db.add_all([log1, log2, log3])
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs?resource_type=dataset")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["resource_type"] == "dataset"

    def test_list_audit_logs_filter_by_status(self, admin_client, labeler_db, test_user_id):
        """Test filtering audit logs by status."""
        # Create logs with different statuses
        log1 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
        )
        log2 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_002",
            status="failure",
            error_message="Validation failed",
        )
        log3 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_003",
            status="error",
            error_message="Database error",
        )
        labeler_db.add_all([log1, log2, log3])
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs?status=success")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["items"]) == 1
        assert data["items"][0]["status"] == "success"

    def test_list_audit_logs_filter_by_date_range(self, admin_client, labeler_db, test_user_id):
        """Test filtering audit logs by date range."""
        now = datetime.utcnow()

        # Create logs at different times
        log1 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
            timestamp=now - timedelta(days=10),
        )
        log2 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_002",
            status="success",
            timestamp=now - timedelta(days=5),
        )
        log3 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_003",
            status="success",
            timestamp=now - timedelta(days=1),
        )
        labeler_db.add_all([log1, log2, log3])
        labeler_db.commit()

        # Filter for logs from the last 7 days
        start_date = (now - timedelta(days=7)).isoformat()
        end_date = now.isoformat()

        response = admin_client.get(
            f"/api/v1/admin/audit-logs?start_date={start_date}&end_date={end_date}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2  # log2 and log3
        assert len(data["items"]) == 2

    def test_list_audit_logs_filter_by_start_date_only(self, admin_client, labeler_db, test_user_id):
        """Test filtering audit logs by start_date only."""
        now = datetime.utcnow()

        # Create logs at different times
        log1 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
            timestamp=now - timedelta(days=10),
        )
        log2 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_002",
            status="success",
            timestamp=now - timedelta(days=1),
        )
        labeler_db.add_all([log1, log2])
        labeler_db.commit()

        # Filter for logs from the last 5 days
        start_date = (now - timedelta(days=5)).isoformat()

        response = admin_client.get(f"/api/v1/admin/audit-logs?start_date={start_date}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1  # Only log2
        assert len(data["items"]) == 1

    def test_list_audit_logs_multiple_filters(self, admin_client, labeler_db, test_user_id):
        """Test filtering audit logs with multiple filters combined."""
        now = datetime.utcnow()

        # Create various logs
        log1 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
            timestamp=now - timedelta(hours=1),
        )
        log2 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="project",
            resource_id="proj_001",
            status="success",
            timestamp=now - timedelta(hours=2),
        )
        log3 = AuditLog(
            user_id="other_user",
            action="create",
            resource_type="dataset",
            resource_id="ds_002",
            status="success",
            timestamp=now - timedelta(hours=3),
        )
        log4 = AuditLog(
            user_id=test_user_id,
            action="delete",
            resource_type="dataset",
            resource_id="ds_003",
            status="success",
            timestamp=now - timedelta(hours=4),
        )
        labeler_db.add_all([log1, log2, log3, log4])
        labeler_db.commit()

        # Filter: user_id=test_user_id, action=create, resource_type=dataset
        response = admin_client.get(
            f"/api/v1/admin/audit-logs?user_id={test_user_id}&action=create&resource_type=dataset"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1  # Only log1 matches all filters
        assert len(data["items"]) == 1
        assert data["items"][0]["resource_id"] == "ds_001"

    def test_list_audit_logs_response_structure(self, admin_client, labeler_db, test_user_id):
        """Test audit log response structure includes all required fields."""
        # Create audit log with all fields populated
        log = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
            details={"name": "Test Dataset", "size": 1024},
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            session_id="session_123",
        )
        labeler_db.add(log)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs")

        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1

        item = data["items"][0]
        assert "id" in item
        assert "timestamp" in item
        assert "user_id" in item
        assert "user_email" in item  # May be None (User DB disabled)
        assert "action" in item
        assert "resource_type" in item
        assert "resource_id" in item
        assert "details" in item
        assert "ip_address" in item
        assert "user_agent" in item
        assert "session_id" in item
        assert "status" in item
        assert "error_message" in item

        # Verify values
        assert item["user_id"] == test_user_id
        assert item["action"] == "create"
        assert item["resource_type"] == "dataset"
        assert item["resource_id"] == "ds_001"
        assert item["status"] == "success"
        assert item["details"]["name"] == "Test Dataset"
        assert item["ip_address"] == "192.168.1.1"
        assert item["user_agent"] == "Mozilla/5.0"
        assert item["session_id"] == "session_123"

    def test_list_audit_logs_limit_validation_min(self, admin_client, labeler_db):
        """Test limit parameter validation (minimum value)."""
        response = admin_client.get("/api/v1/admin/audit-logs?limit=0")

        assert response.status_code == 422  # Validation error

    def test_list_audit_logs_limit_validation_max(self, admin_client, labeler_db):
        """Test limit parameter validation (maximum value)."""
        response = admin_client.get("/api/v1/admin/audit-logs?limit=501")

        assert response.status_code == 422  # Validation error

    def test_list_audit_logs_offset_validation(self, admin_client, labeler_db):
        """Test offset parameter validation (negative value)."""
        response = admin_client.get("/api/v1/admin/audit-logs?offset=-1")

        assert response.status_code == 422  # Validation error

    def test_list_audit_logs_requires_admin(self, authenticated_client, labeler_db):
        """Test that listing audit logs requires admin privileges."""
        response = authenticated_client.get("/api/v1/admin/audit-logs")

        assert response.status_code == 403

    def test_list_audit_logs_unauthenticated(self, client, labeler_db):
        """Test that listing audit logs requires authentication."""
        response = client.get("/api/v1/admin/audit-logs")

        assert response.status_code == 403


# =============================================================================
# Test Get Audit Log Detail Endpoint
# =============================================================================


class TestGetAuditLogDetail:
    """Tests for GET /api/v1/admin/audit-logs/{log_id}."""

    def test_get_audit_log_detail_success(self, admin_client, labeler_db, test_user_id):
        """Test successful audit log detail retrieval."""
        # Create audit log
        log = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
            details={"name": "Test Dataset"},
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            session_id="session_123",
        )
        labeler_db.add(log)
        labeler_db.commit()
        labeler_db.refresh(log)

        response = admin_client.get(f"/api/v1/admin/audit-logs/{log.id}")

        assert response.status_code == 200
        data = response.json()

        # Verify all fields
        assert data["id"] == log.id
        assert data["user_id"] == test_user_id
        assert data["action"] == "create"
        assert data["resource_type"] == "dataset"
        assert data["resource_id"] == "ds_001"
        assert data["status"] == "success"
        assert data["details"]["name"] == "Test Dataset"
        assert data["ip_address"] == "192.168.1.1"
        assert data["user_agent"] == "Mozilla/5.0"
        assert data["session_id"] == "session_123"
        assert "timestamp" in data
        assert "created_at" in data
        assert "user_email" in data  # May be None

    def test_get_audit_log_detail_with_error(self, admin_client, labeler_db, test_user_id):
        """Test audit log detail with error information."""
        # Create audit log with error
        log = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="error",
            error_message="Database connection failed",
            details={"error_code": 500},
        )
        labeler_db.add(log)
        labeler_db.commit()
        labeler_db.refresh(log)

        response = admin_client.get(f"/api/v1/admin/audit-logs/{log.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "error"
        assert data["error_message"] == "Database connection failed"
        assert data["details"]["error_code"] == 500

    def test_get_audit_log_detail_not_found(self, admin_client, labeler_db):
        """Test audit log not found (404)."""
        response = admin_client.get("/api/v1/admin/audit-logs/99999")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_audit_log_detail_requires_admin(self, authenticated_client, labeler_db, test_user_id):
        """Test that getting audit log detail requires admin privileges."""
        # Create audit log
        log = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
        )
        labeler_db.add(log)
        labeler_db.commit()
        labeler_db.refresh(log)

        response = authenticated_client.get(f"/api/v1/admin/audit-logs/{log.id}")

        assert response.status_code == 403

    def test_get_audit_log_detail_unauthenticated(self, client, labeler_db, test_user_id):
        """Test that getting audit log detail requires authentication."""
        # Create audit log
        log = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
        )
        labeler_db.add(log)
        labeler_db.commit()
        labeler_db.refresh(log)

        response = client.get(f"/api/v1/admin/audit-logs/{log.id}")

        assert response.status_code == 403


# =============================================================================
# Test Get Audit Log Statistics Endpoint
# =============================================================================


class TestGetAuditLogStats:
    """Tests for GET /api/v1/admin/audit-logs/stats/summary."""

    def test_get_audit_log_stats_success(self, admin_client, labeler_db, test_user_id):
        """Test successful audit log statistics retrieval."""
        now = datetime.utcnow()

        # Create various audit logs in the last 7 days
        logs = [
            AuditLog(
                user_id=test_user_id,
                action="create",
                resource_type="dataset",
                resource_id="ds_001",
                status="success",
                timestamp=now - timedelta(days=1),
            ),
            AuditLog(
                user_id=test_user_id,
                action="update",
                resource_type="project",
                resource_id="proj_001",
                status="success",
                timestamp=now - timedelta(days=2),
            ),
            AuditLog(
                user_id="other_user",
                action="delete",
                resource_type="annotation",
                resource_id="ann_001",
                status="failure",
                timestamp=now - timedelta(days=3),
            ),
            AuditLog(
                user_id=test_user_id,
                action="create",
                resource_type="dataset",
                resource_id="ds_002",
                status="error",
                timestamp=now - timedelta(days=4),
            ),
        ]
        labeler_db.add_all(logs)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs/stats/summary")

        assert response.status_code == 200
        data = response.json()

        # Verify structure
        assert "total_logs" in data
        assert "by_action" in data
        assert "by_status" in data
        assert "by_resource_type" in data
        assert "unique_users" in data
        assert "time_range" in data

        # Verify counts
        assert data["total_logs"] == 4
        assert data["by_action"]["create"] == 2
        assert data["by_action"]["update"] == 1
        assert data["by_action"]["delete"] == 1
        assert data["by_status"]["success"] == 2
        assert data["by_status"]["failure"] == 1
        assert data["by_status"]["error"] == 1
        assert data["by_resource_type"]["dataset"] == 2
        assert data["by_resource_type"]["project"] == 1
        assert data["by_resource_type"]["annotation"] == 1
        assert data["unique_users"] == 2

        # Verify time range
        assert data["time_range"]["days"] == 7

    def test_get_audit_log_stats_custom_days(self, admin_client, labeler_db, test_user_id):
        """Test audit log statistics with custom days parameter."""
        now = datetime.utcnow()

        # Create logs at different times
        log1 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
            timestamp=now - timedelta(days=1),
        )
        log2 = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_002",
            status="success",
            timestamp=now - timedelta(days=10),
        )
        labeler_db.add_all([log1, log2])
        labeler_db.commit()

        # Query for last 15 days (should include both logs)
        response = admin_client.get("/api/v1/admin/audit-logs/stats/summary?days=15")

        assert response.status_code == 200
        data = response.json()
        assert data["total_logs"] == 2
        assert data["time_range"]["days"] == 15

        # Query for last 5 days (should include only log1)
        response = admin_client.get("/api/v1/admin/audit-logs/stats/summary?days=5")

        assert response.status_code == 200
        data = response.json()
        assert data["total_logs"] == 1
        assert data["time_range"]["days"] == 5

    def test_get_audit_log_stats_empty(self, admin_client, labeler_db):
        """Test audit log statistics with no logs."""
        response = admin_client.get("/api/v1/admin/audit-logs/stats/summary")

        assert response.status_code == 200
        data = response.json()

        assert data["total_logs"] == 0
        assert data["by_action"] == {}
        assert data["by_status"] == {}
        assert data["by_resource_type"] == {}
        assert data["unique_users"] == 0

    def test_get_audit_log_stats_days_validation_min(self, admin_client, labeler_db):
        """Test days parameter validation (minimum value)."""
        response = admin_client.get("/api/v1/admin/audit-logs/stats/summary?days=0")

        assert response.status_code == 422  # Validation error

    def test_get_audit_log_stats_days_validation_max(self, admin_client, labeler_db):
        """Test days parameter validation (maximum value)."""
        response = admin_client.get("/api/v1/admin/audit-logs/stats/summary?days=91")

        assert response.status_code == 422  # Validation error

    def test_get_audit_log_stats_excludes_old_logs(self, admin_client, labeler_db, test_user_id):
        """Test that statistics exclude logs outside the time range."""
        now = datetime.utcnow()

        # Create logs outside the 7-day window
        old_log = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
            timestamp=now - timedelta(days=10),
        )
        recent_log = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_002",
            status="success",
            timestamp=now - timedelta(days=1),
        )
        labeler_db.add_all([old_log, recent_log])
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs/stats/summary?days=7")

        assert response.status_code == 200
        data = response.json()
        assert data["total_logs"] == 1  # Only recent_log

    def test_get_audit_log_stats_requires_admin(self, authenticated_client, labeler_db):
        """Test that getting audit log stats requires admin privileges."""
        response = authenticated_client.get("/api/v1/admin/audit-logs/stats/summary")

        assert response.status_code == 403

    def test_get_audit_log_stats_unauthenticated(self, client, labeler_db):
        """Test that getting audit log stats requires authentication."""
        response = client.get("/api/v1/admin/audit-logs/stats/summary")

        assert response.status_code == 403


# =============================================================================
# Test Get Available Actions Endpoint
# =============================================================================


class TestGetAvailableActions:
    """Tests for GET /api/v1/admin/audit-logs/meta/actions."""

    def test_get_available_actions_success(self, admin_client, labeler_db, test_user_id):
        """Test successful retrieval of available actions."""
        # Create logs with different actions
        logs = [
            AuditLog(
                user_id=test_user_id,
                action="create",
                resource_type="dataset",
                resource_id="ds_001",
                status="success",
            ),
            AuditLog(
                user_id=test_user_id,
                action="update",
                resource_type="dataset",
                resource_id="ds_001",
                status="success",
            ),
            AuditLog(
                user_id=test_user_id,
                action="delete",
                resource_type="dataset",
                resource_id="ds_001",
                status="success",
            ),
            AuditLog(
                user_id=test_user_id,
                action="login",
                resource_type=None,
                resource_id=None,
                status="success",
            ),
        ]
        labeler_db.add_all(logs)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs/meta/actions")

        assert response.status_code == 200
        actions = response.json()

        assert isinstance(actions, list)
        assert "create" in actions
        assert "update" in actions
        assert "delete" in actions
        assert "login" in actions
        assert len(actions) == 4

    def test_get_available_actions_empty(self, admin_client, labeler_db):
        """Test getting available actions when database is empty."""
        response = admin_client.get("/api/v1/admin/audit-logs/meta/actions")

        assert response.status_code == 200
        actions = response.json()
        assert actions == []

    def test_get_available_actions_deduplicates(self, admin_client, labeler_db, test_user_id):
        """Test that available actions are deduplicated."""
        # Create multiple logs with same action
        logs = [
            AuditLog(
                user_id=test_user_id,
                action="create",
                resource_type="dataset",
                resource_id=f"ds_{i:03d}",
                status="success",
            )
            for i in range(5)
        ]
        labeler_db.add_all(logs)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs/meta/actions")

        assert response.status_code == 200
        actions = response.json()

        assert len(actions) == 1
        assert "create" in actions

    def test_get_available_actions_requires_admin(self, authenticated_client, labeler_db):
        """Test that getting available actions requires admin privileges."""
        response = authenticated_client.get("/api/v1/admin/audit-logs/meta/actions")

        assert response.status_code == 403

    def test_get_available_actions_unauthenticated(self, client, labeler_db):
        """Test that getting available actions requires authentication."""
        response = client.get("/api/v1/admin/audit-logs/meta/actions")

        assert response.status_code == 403


# =============================================================================
# Test Get Available Resource Types Endpoint
# =============================================================================


class TestGetAvailableResourceTypes:
    """Tests for GET /api/v1/admin/audit-logs/meta/resource-types."""

    def test_get_available_resource_types_success(self, admin_client, labeler_db, test_user_id):
        """Test successful retrieval of available resource types."""
        # Create logs with different resource types
        logs = [
            AuditLog(
                user_id=test_user_id,
                action="create",
                resource_type="dataset",
                resource_id="ds_001",
                status="success",
            ),
            AuditLog(
                user_id=test_user_id,
                action="create",
                resource_type="project",
                resource_id="proj_001",
                status="success",
            ),
            AuditLog(
                user_id=test_user_id,
                action="create",
                resource_type="annotation",
                resource_id="ann_001",
                status="success",
            ),
        ]
        labeler_db.add_all(logs)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs/meta/resource-types")

        assert response.status_code == 200
        resource_types = response.json()

        assert isinstance(resource_types, list)
        assert "dataset" in resource_types
        assert "project" in resource_types
        assert "annotation" in resource_types
        assert len(resource_types) == 3

    def test_get_available_resource_types_empty(self, admin_client, labeler_db):
        """Test getting available resource types when database is empty."""
        response = admin_client.get("/api/v1/admin/audit-logs/meta/resource-types")

        assert response.status_code == 200
        resource_types = response.json()
        assert resource_types == []

    def test_get_available_resource_types_deduplicates(self, admin_client, labeler_db, test_user_id):
        """Test that available resource types are deduplicated."""
        # Create multiple logs with same resource type
        logs = [
            AuditLog(
                user_id=test_user_id,
                action="create",
                resource_type="dataset",
                resource_id=f"ds_{i:03d}",
                status="success",
            )
            for i in range(5)
        ]
        labeler_db.add_all(logs)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs/meta/resource-types")

        assert response.status_code == 200
        resource_types = response.json()

        assert len(resource_types) == 1
        assert "dataset" in resource_types

    def test_get_available_resource_types_excludes_null(self, admin_client, labeler_db, test_user_id):
        """Test that null resource types are excluded."""
        # Create logs with and without resource types
        logs = [
            AuditLog(
                user_id=test_user_id,
                action="login",
                resource_type=None,
                resource_id=None,
                status="success",
            ),
            AuditLog(
                user_id=test_user_id,
                action="create",
                resource_type="dataset",
                resource_id="ds_001",
                status="success",
            ),
        ]
        labeler_db.add_all(logs)
        labeler_db.commit()

        response = admin_client.get("/api/v1/admin/audit-logs/meta/resource-types")

        assert response.status_code == 200
        resource_types = response.json()

        assert len(resource_types) == 1
        assert "dataset" in resource_types
        assert None not in resource_types

    def test_get_available_resource_types_requires_admin(self, authenticated_client, labeler_db):
        """Test that getting available resource types requires admin privileges."""
        response = authenticated_client.get("/api/v1/admin/audit-logs/meta/resource-types")

        assert response.status_code == 403

    def test_get_available_resource_types_unauthenticated(self, client, labeler_db):
        """Test that getting available resource types requires authentication."""
        response = client.get("/api/v1/admin/audit-logs/meta/resource-types")

        assert response.status_code == 403


# =============================================================================
# Integration Tests
# =============================================================================


class TestAuditLogIntegration:
    """Integration tests for audit log endpoints."""

    def test_all_endpoints_require_admin(self, authenticated_client, labeler_db, test_user_id):
        """Test that all audit log endpoints require admin role."""
        # Create a test audit log
        log = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
        )
        labeler_db.add(log)
        labeler_db.commit()
        labeler_db.refresh(log)

        # All endpoints should return 403 for non-admin
        endpoints = [
            "/api/v1/admin/audit-logs",
            f"/api/v1/admin/audit-logs/{log.id}",
            "/api/v1/admin/audit-logs/stats/summary",
            "/api/v1/admin/audit-logs/meta/actions",
            "/api/v1/admin/audit-logs/meta/resource-types",
        ]

        for endpoint in endpoints:
            response = authenticated_client.get(endpoint)
            assert response.status_code == 403, f"Expected 403 for {endpoint}, got {response.status_code}"

    def test_all_endpoints_accessible_by_admin(self, admin_client, labeler_db, test_user_id):
        """Test that all audit log endpoints are accessible by admin users."""
        # Create a test audit log
        log = AuditLog(
            user_id=test_user_id,
            action="create",
            resource_type="dataset",
            resource_id="ds_001",
            status="success",
        )
        labeler_db.add(log)
        labeler_db.commit()
        labeler_db.refresh(log)

        # All endpoints should return 200 for admin
        endpoints = [
            "/api/v1/admin/audit-logs",
            f"/api/v1/admin/audit-logs/{log.id}",
            "/api/v1/admin/audit-logs/stats/summary",
            "/api/v1/admin/audit-logs/meta/actions",
            "/api/v1/admin/audit-logs/meta/resource-types",
        ]

        for endpoint in endpoints:
            response = admin_client.get(endpoint)
            assert response.status_code == 200, f"Expected 200 for {endpoint}, got {response.status_code}"

    def test_complete_audit_workflow(self, admin_client, labeler_db, test_user_id):
        """Test a complete audit log workflow."""
        now = datetime.utcnow()

        # Step 1: Create various audit logs
        logs = [
            AuditLog(
                user_id=test_user_id,
                action="create",
                resource_type="dataset",
                resource_id="ds_001",
                status="success",
                timestamp=now - timedelta(days=1),
            ),
            AuditLog(
                user_id=test_user_id,
                action="update",
                resource_type="dataset",
                resource_id="ds_001",
                status="success",
                timestamp=now - timedelta(hours=12),
            ),
            AuditLog(
                user_id=test_user_id,
                action="delete",
                resource_type="project",
                resource_id="proj_001",
                status="failure",
                error_message="Permission denied",
                timestamp=now - timedelta(hours=6),
            ),
        ]
        labeler_db.add_all(logs)
        labeler_db.commit()

        # Step 2: Get available actions and resource types
        actions_response = admin_client.get("/api/v1/admin/audit-logs/meta/actions")
        assert actions_response.status_code == 200
        actions = actions_response.json()
        assert "create" in actions
        assert "update" in actions
        assert "delete" in actions

        resource_types_response = admin_client.get("/api/v1/admin/audit-logs/meta/resource-types")
        assert resource_types_response.status_code == 200
        resource_types = resource_types_response.json()
        assert "dataset" in resource_types
        assert "project" in resource_types

        # Step 3: Get statistics
        stats_response = admin_client.get("/api/v1/admin/audit-logs/stats/summary")
        assert stats_response.status_code == 200
        stats = stats_response.json()
        assert stats["total_logs"] == 3
        assert stats["by_action"]["create"] == 1
        assert stats["by_status"]["success"] == 2
        assert stats["by_status"]["failure"] == 1

        # Step 4: List logs filtered by resource type
        list_response = admin_client.get("/api/v1/admin/audit-logs?resource_type=dataset")
        assert list_response.status_code == 200
        list_data = list_response.json()
        assert list_data["total"] == 2

        # Step 5: Get detail for a specific log
        log_id = list_data["items"][0]["id"]
        detail_response = admin_client.get(f"/api/v1/admin/audit-logs/{log_id}")
        assert detail_response.status_code == 200
        detail = detail_response.json()
        assert detail["id"] == log_id
        assert detail["resource_type"] == "dataset"
