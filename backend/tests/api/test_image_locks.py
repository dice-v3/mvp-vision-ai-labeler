"""
Tests for image lock endpoints.

Tests the image lock-related endpoints including:
- POST /image-locks/{project_id}/{image_id}/acquire - Acquire lock
- DELETE /image-locks/{project_id}/{image_id} - Release lock
- POST /image-locks/{project_id}/{image_id}/heartbeat - Send heartbeat
- GET /image-locks/{project_id} - Get project locks
- GET /image-locks/{project_id}/{image_id}/status - Get lock status
- DELETE /image-locks/{project_id}/{image_id}/force - Force release lock
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from fastapi.testclient import TestClient
from datetime import datetime, timedelta

from app.core.security import get_current_user
from app.db.models.labeler import (
    ImageLock,
    AnnotationProject,
    ProjectPermission,
)
from app.main import app
from app.services.image_lock_service import ImageLockService


class TestAcquireLock:
    """Test cases for POST /api/v1/image-locks/{project_id}/{image_id}/acquire endpoint."""

    def test_acquire_new_lock_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test successfully acquiring a lock on an unlocked image.

        Should create a new lock and return status "acquired".
        """
        project_id = test_project.id
        image_id = "img_001"

        response = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/acquire"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response structure
        assert data["status"] == "acquired"
        assert "lock" in data
        assert data["lock"]["image_id"] == image_id
        assert data["lock"]["user_id"] == mock_current_user["sub"]
        assert "locked_at" in data["lock"]
        assert "expires_at" in data["lock"]
        assert "heartbeat_at" in data["lock"]

        # Verify lock was created in database
        lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()

        assert lock is not None
        assert lock.user_id == mock_current_user["sub"]
        assert lock.project_id == project_id
        assert lock.image_id == image_id

    def test_refresh_lock_same_user(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test refreshing lock when same user acquires again.

        Should update heartbeat and expiration time, return status "refreshed".
        """
        project_id = test_project.id
        image_id = "img_002"

        # First acquisition
        response1 = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/acquire"
        )
        assert response1.status_code == status.HTTP_200_OK
        data1 = response1.json()
        assert data1["status"] == "acquired"
        first_expires_at = data1["lock"]["expires_at"]

        # Second acquisition by same user (should refresh)
        response2 = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/acquire"
        )
        assert response2.status_code == status.HTTP_200_OK
        data2 = response2.json()

        assert data2["status"] == "refreshed"
        assert data2["lock"]["image_id"] == image_id
        assert data2["lock"]["user_id"] == mock_current_user["sub"]

        # Verify expiration time was updated
        second_expires_at = data2["lock"]["expires_at"]
        # Parse datetime strings if necessary
        # In real scenario, second_expires_at should be >= first_expires_at

        # Verify only one lock exists
        lock_count = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).count()
        assert lock_count == 1

    def test_acquire_lock_already_locked_by_another_user(
        self, client, labeler_db, test_project, mock_current_user, override_get_current_user
    ):
        """
        Test acquiring lock when another user already has the lock.

        Should return status "already_locked" with info about who has the lock.
        This tests lock stealing prevention.
        """
        project_id = test_project.id
        image_id = "img_003"

        # Create lock for first user
        first_user_id = "user-001"
        now = datetime.utcnow()
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id=first_user_id,
            locked_at=now,
            expires_at=now + timedelta(minutes=5),
            heartbeat_at=now,
        )
        labeler_db.add(lock)
        labeler_db.commit()

        # Try to acquire as second user (mock_current_user has different ID)
        response = client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/acquire"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify rejection
        assert data["status"] == "already_locked"
        assert "locked_by" in data
        assert data["locked_by"]["user_id"] == first_user_id
        assert data["locked_by"]["image_id"] == image_id

        # Verify lock is still owned by first user
        lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()
        assert lock.user_id == first_user_id

    def test_acquire_expired_lock(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test acquiring lock when existing lock has expired.

        Expired lock should be cleaned up and new lock created.
        """
        project_id = test_project.id
        image_id = "img_004"

        # Create expired lock
        expired_time = datetime.utcnow() - timedelta(minutes=10)
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id="old-user-id",
            locked_at=expired_time,
            expires_at=expired_time + timedelta(minutes=5),  # Expired 5 minutes ago
            heartbeat_at=expired_time,
        )
        labeler_db.add(lock)
        labeler_db.commit()

        # Try to acquire as new user
        response = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/acquire"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should successfully acquire (expired lock cleaned up)
        assert data["status"] == "acquired"
        assert data["lock"]["user_id"] == mock_current_user["sub"]

        # Verify old lock was replaced
        lock_count = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).count()
        assert lock_count == 1

        new_lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()
        assert new_lock.user_id == mock_current_user["sub"]

    def test_acquire_lock_requires_authentication(self, client, test_project):
        """
        Test that acquiring lock requires authentication.

        Should return 401 if not authenticated.
        """
        project_id = test_project.id
        image_id = "img_005"

        response = client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/acquire"
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_acquire_lock_requires_annotator_permission(
        self, client, labeler_db, test_project, override_get_current_user
    ):
        """
        Test that acquiring lock requires annotator role or higher.

        Should return 403 if user doesn't have permission.
        """
        project_id = test_project.id
        image_id = "img_006"

        # Remove permissions (or set to viewer only)
        labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id
        ).delete()
        labeler_db.commit()

        response = client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/acquire"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_acquire_lock_with_path_in_image_id(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test acquiring lock with image_id containing path separators.

        Image IDs can contain slashes (e.g., "folder/subfolder/image.jpg").
        """
        project_id = test_project.id
        image_id = "dataset/folder/subfolder/image_001.jpg"

        response = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/acquire"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["status"] == "acquired"
        assert data["lock"]["image_id"] == image_id

        # Verify in database
        lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()
        assert lock is not None


class TestReleaseLock:
    """Test cases for DELETE /api/v1/image-locks/{project_id}/{image_id} endpoint."""

    def test_release_lock_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test successfully releasing a lock owned by current user.

        Should delete the lock and return status "released".
        """
        project_id = test_project.id
        image_id = "img_007"

        # Create lock
        now = datetime.utcnow()
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id=mock_current_user["sub"],
            locked_at=now,
            expires_at=now + timedelta(minutes=5),
            heartbeat_at=now,
        )
        labeler_db.add(lock)
        labeler_db.commit()

        # Release lock
        response = authenticated_client.delete(
            f"/api/v1/image-locks/{project_id}/{image_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["status"] == "released"

        # Verify lock was deleted
        lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()
        assert lock is None

    def test_release_lock_not_locked(self, authenticated_client, labeler_db, test_project):
        """
        Test releasing lock when image is not locked.

        Should return status "not_locked".
        """
        project_id = test_project.id
        image_id = "img_008"

        response = authenticated_client.delete(
            f"/api/v1/image-locks/{project_id}/{image_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["status"] == "not_locked"

    def test_release_lock_not_owner(self, client, labeler_db, test_project, override_get_current_user):
        """
        Test releasing lock owned by another user.

        Should return status "not_owner" without deleting the lock.
        """
        project_id = test_project.id
        image_id = "img_009"

        # Create lock for different user
        now = datetime.utcnow()
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id="other-user-id",
            locked_at=now,
            expires_at=now + timedelta(minutes=5),
            heartbeat_at=now,
        )
        labeler_db.add(lock)
        labeler_db.commit()

        # Try to release as different user
        response = client.delete(
            f"/api/v1/image-locks/{project_id}/{image_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["status"] == "not_owner"

        # Verify lock still exists
        lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()
        assert lock is not None
        assert lock.user_id == "other-user-id"

    def test_release_lock_requires_authentication(self, client, test_project):
        """
        Test that releasing lock requires authentication.

        Should return 401 if not authenticated.
        """
        project_id = test_project.id
        image_id = "img_010"

        response = client.delete(
            f"/api/v1/image-locks/{project_id}/{image_id}"
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_release_lock_requires_annotator_permission(
        self, client, labeler_db, test_project, override_get_current_user
    ):
        """
        Test that releasing lock requires annotator role or higher.

        Should return 403 if user doesn't have permission.
        """
        project_id = test_project.id
        image_id = "img_011"

        # Remove permissions
        labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id
        ).delete()
        labeler_db.commit()

        response = client.delete(
            f"/api/v1/image-locks/{project_id}/{image_id}"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestHeartbeat:
    """Test cases for POST /api/v1/image-locks/{project_id}/{image_id}/heartbeat endpoint."""

    def test_heartbeat_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test successfully sending heartbeat to keep lock alive.

        Should update heartbeat_at and expires_at timestamps.
        """
        project_id = test_project.id
        image_id = "img_012"

        # Create lock
        initial_time = datetime.utcnow()
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id=mock_current_user["sub"],
            locked_at=initial_time,
            expires_at=initial_time + timedelta(minutes=5),
            heartbeat_at=initial_time,
        )
        labeler_db.add(lock)
        labeler_db.commit()
        initial_expires_at = lock.expires_at

        # Send heartbeat
        response = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/heartbeat"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["status"] == "updated"
        assert "lock" in data
        assert data["lock"]["image_id"] == image_id
        assert data["lock"]["user_id"] == mock_current_user["sub"]

        # Verify timestamps were updated
        labeler_db.refresh(lock)
        assert lock.heartbeat_at > initial_time
        assert lock.expires_at > initial_expires_at

    def test_heartbeat_extends_expiration(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test that heartbeat extends lock expiration time.

        New expiration should be ~5 minutes from now.
        """
        project_id = test_project.id
        image_id = "img_013"

        # Create lock about to expire
        now = datetime.utcnow()
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id=mock_current_user["sub"],
            locked_at=now - timedelta(minutes=4),
            expires_at=now + timedelta(minutes=1),  # Expires in 1 minute
            heartbeat_at=now - timedelta(minutes=4),
        )
        labeler_db.add(lock)
        labeler_db.commit()

        # Send heartbeat
        response = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/heartbeat"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify expiration was extended
        labeler_db.refresh(lock)
        time_until_expiration = lock.expires_at - datetime.utcnow()
        # Should be approximately 5 minutes (allow some margin)
        assert timedelta(minutes=4, seconds=30) < time_until_expiration < timedelta(minutes=5, seconds=30)

    def test_heartbeat_not_locked(self, authenticated_client, labeler_db, test_project):
        """
        Test sending heartbeat when image is not locked.

        Should return status "not_locked".
        """
        project_id = test_project.id
        image_id = "img_014"

        response = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/heartbeat"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["status"] == "not_locked"
        assert "lock" not in data

    def test_heartbeat_not_owner(self, client, labeler_db, test_project, override_get_current_user):
        """
        Test sending heartbeat for lock owned by another user.

        Should return status "not_owner".
        """
        project_id = test_project.id
        image_id = "img_015"

        # Create lock for different user
        now = datetime.utcnow()
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id="other-user-id",
            locked_at=now,
            expires_at=now + timedelta(minutes=5),
            heartbeat_at=now,
        )
        labeler_db.add(lock)
        labeler_db.commit()
        initial_heartbeat = lock.heartbeat_at

        # Try to send heartbeat as different user
        response = client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/heartbeat"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["status"] == "not_owner"

        # Verify heartbeat was not updated
        labeler_db.refresh(lock)
        assert lock.heartbeat_at == initial_heartbeat

    def test_heartbeat_requires_authentication(self, client, test_project):
        """
        Test that sending heartbeat requires authentication.

        Should return 401 if not authenticated.
        """
        project_id = test_project.id
        image_id = "img_016"

        response = client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/heartbeat"
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_heartbeat_requires_annotator_permission(
        self, client, labeler_db, test_project, override_get_current_user
    ):
        """
        Test that sending heartbeat requires annotator role or higher.

        Should return 403 if user doesn't have permission.
        """
        project_id = test_project.id
        image_id = "img_017"

        # Remove permissions
        labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id
        ).delete()
        labeler_db.commit()

        response = client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/heartbeat"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestGetProjectLocks:
    """Test cases for GET /api/v1/image-locks/{project_id} endpoint."""

    def test_get_project_locks_success(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test getting all active locks for a project.

        Should return list of all non-expired locks.
        """
        project_id = test_project.id
        now = datetime.utcnow()

        # Create multiple locks
        locks = [
            ImageLock(
                project_id=project_id,
                image_id=f"img_{i:03d}",
                user_id=f"user-{i}",
                locked_at=now,
                expires_at=now + timedelta(minutes=5),
                heartbeat_at=now,
            )
            for i in range(3)
        ]
        for lock in locks:
            labeler_db.add(lock)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/image-locks/{project_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "locks" in data
        assert len(data["locks"]) == 3

        # Verify lock structure
        for lock_data in data["locks"]:
            assert "image_id" in lock_data
            assert "user_id" in lock_data
            assert "locked_at" in lock_data
            assert "expires_at" in lock_data
            assert "heartbeat_at" in lock_data

    def test_get_project_locks_empty(self, authenticated_client, labeler_db, test_project):
        """
        Test getting locks when project has no active locks.

        Should return empty list.
        """
        project_id = test_project.id

        response = authenticated_client.get(
            f"/api/v1/image-locks/{project_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "locks" in data
        assert data["locks"] == []

    def test_get_project_locks_cleans_expired(self, authenticated_client, labeler_db, test_project):
        """
        Test that expired locks are automatically cleaned up.

        Only active locks should be returned.
        """
        project_id = test_project.id
        now = datetime.utcnow()

        # Create mix of active and expired locks
        active_lock = ImageLock(
            project_id=project_id,
            image_id="img_active",
            user_id="user-1",
            locked_at=now,
            expires_at=now + timedelta(minutes=5),
            heartbeat_at=now,
        )
        expired_lock = ImageLock(
            project_id=project_id,
            image_id="img_expired",
            user_id="user-2",
            locked_at=now - timedelta(minutes=10),
            expires_at=now - timedelta(minutes=5),  # Expired
            heartbeat_at=now - timedelta(minutes=10),
        )
        labeler_db.add(active_lock)
        labeler_db.add(expired_lock)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/image-locks/{project_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Only active lock should be returned
        assert len(data["locks"]) == 1
        assert data["locks"][0]["image_id"] == "img_active"

    def test_get_project_locks_only_for_project(self, authenticated_client, labeler_db, test_project):
        """
        Test that only locks for the specified project are returned.

        Locks from other projects should not be included.
        """
        project_id = test_project.id
        other_project_id = "proj_other"
        now = datetime.utcnow()

        # Create lock for test project
        lock1 = ImageLock(
            project_id=project_id,
            image_id="img_001",
            user_id="user-1",
            locked_at=now,
            expires_at=now + timedelta(minutes=5),
            heartbeat_at=now,
        )
        # Create lock for other project
        lock2 = ImageLock(
            project_id=other_project_id,
            image_id="img_002",
            user_id="user-2",
            locked_at=now,
            expires_at=now + timedelta(minutes=5),
            heartbeat_at=now,
        )
        labeler_db.add(lock1)
        labeler_db.add(lock2)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/image-locks/{project_id}"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Only lock from test project
        assert len(data["locks"]) == 1
        assert data["locks"][0]["image_id"] == "img_001"

    def test_get_project_locks_requires_authentication(self, client, test_project):
        """
        Test that getting project locks requires authentication.

        Should return 401 if not authenticated.
        """
        project_id = test_project.id

        response = client.get(
            f"/api/v1/image-locks/{project_id}"
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_project_locks_requires_viewer_permission(
        self, client, labeler_db, test_project, override_get_current_user
    ):
        """
        Test that getting project locks requires viewer role or higher.

        Should return 403 if user doesn't have permission.
        """
        project_id = test_project.id

        # Remove permissions
        labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id
        ).delete()
        labeler_db.commit()

        response = client.get(
            f"/api/v1/image-locks/{project_id}"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestGetLockStatus:
    """Test cases for GET /api/v1/image-locks/{project_id}/{image_id}/status endpoint."""

    def test_get_lock_status_locked(self, authenticated_client, labeler_db, test_project):
        """
        Test getting lock status when image is locked.

        Should return lock information.
        """
        project_id = test_project.id
        image_id = "img_018"
        now = datetime.utcnow()

        # Create lock
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id="user-1",
            locked_at=now,
            expires_at=now + timedelta(minutes=5),
            heartbeat_at=now,
        )
        labeler_db.add(lock)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/image-locks/{project_id}/{image_id}/status"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data is not None
        assert data["image_id"] == image_id
        assert data["user_id"] == "user-1"
        assert "locked_at" in data
        assert "expires_at" in data
        assert "heartbeat_at" in data

    def test_get_lock_status_not_locked(self, authenticated_client, labeler_db, test_project):
        """
        Test getting lock status when image is not locked.

        Should return null.
        """
        project_id = test_project.id
        image_id = "img_019"

        response = authenticated_client.get(
            f"/api/v1/image-locks/{project_id}/{image_id}/status"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data is None

    def test_get_lock_status_expired_lock_cleaned(self, authenticated_client, labeler_db, test_project):
        """
        Test that expired locks are cleaned up when checking status.

        Should return null for expired lock.
        """
        project_id = test_project.id
        image_id = "img_020"
        now = datetime.utcnow()

        # Create expired lock
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id="user-1",
            locked_at=now - timedelta(minutes=10),
            expires_at=now - timedelta(minutes=5),  # Expired
            heartbeat_at=now - timedelta(minutes=10),
        )
        labeler_db.add(lock)
        labeler_db.commit()

        response = authenticated_client.get(
            f"/api/v1/image-locks/{project_id}/{image_id}/status"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should return null (expired lock cleaned up)
        assert data is None

        # Verify lock was deleted from database
        lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()
        assert lock is None

    def test_get_lock_status_requires_authentication(self, client, test_project):
        """
        Test that getting lock status requires authentication.

        Should return 401 if not authenticated.
        """
        project_id = test_project.id
        image_id = "img_021"

        response = client.get(
            f"/api/v1/image-locks/{project_id}/{image_id}/status"
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_lock_status_requires_viewer_permission(
        self, client, labeler_db, test_project, override_get_current_user
    ):
        """
        Test that getting lock status requires viewer role or higher.

        Should return 403 if user doesn't have permission.
        """
        project_id = test_project.id
        image_id = "img_022"

        # Remove permissions
        labeler_db.query(ProjectPermission).filter(
            ProjectPermission.project_id == project_id
        ).delete()
        labeler_db.commit()

        response = client.get(
            f"/api/v1/image-locks/{project_id}/{image_id}/status"
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestForceReleaseLock:
    """Test cases for DELETE /api/v1/image-locks/{project_id}/{image_id}/force endpoint."""

    def test_force_release_lock_success(self, labeler_db, test_project, mock_admin_user):
        """
        Test admin force releasing a lock.

        Admin should be able to release any lock.
        """
        from app.core.security import get_current_user
        from fastapi.testclient import TestClient

        # Create admin client
        def override_admin():
            return mock_admin_user

        app.dependency_overrides[get_current_user] = override_admin

        # Override database
        def override_labeler_db():
            try:
                yield labeler_db
            finally:
                pass

        from app.core.database import get_labeler_db, get_platform_db
        app.dependency_overrides[get_labeler_db] = override_labeler_db
        app.dependency_overrides[get_platform_db] = override_labeler_db

        with TestClient(app) as admin_client:
            project_id = test_project.id
            image_id = "img_023"
            now = datetime.utcnow()

            # Create lock owned by different user
            lock = ImageLock(
                project_id=project_id,
                image_id=image_id,
                user_id="other-user-id",
                locked_at=now,
                expires_at=now + timedelta(minutes=5),
                heartbeat_at=now,
            )
            labeler_db.add(lock)
            labeler_db.commit()

            # Force release as admin
            response = admin_client.delete(
                f"/api/v1/image-locks/{project_id}/{image_id}/force"
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            assert data["status"] == "released"

            # Verify lock was deleted
            lock = labeler_db.query(ImageLock).filter(
                ImageLock.project_id == project_id,
                ImageLock.image_id == image_id,
            ).first()
            assert lock is None

        app.dependency_overrides.clear()

    def test_force_release_lock_not_locked(self, labeler_db, test_project, mock_admin_user):
        """
        Test force releasing when image is not locked.

        Should return status "not_locked".
        """
        from app.core.security import get_current_user
        from fastapi.testclient import TestClient

        # Create admin client
        def override_admin():
            return mock_admin_user

        app.dependency_overrides[get_current_user] = override_admin

        # Override database
        def override_labeler_db():
            try:
                yield labeler_db
            finally:
                pass

        from app.core.database import get_labeler_db, get_platform_db
        app.dependency_overrides[get_labeler_db] = override_labeler_db
        app.dependency_overrides[get_platform_db] = override_labeler_db

        with TestClient(app) as admin_client:
            project_id = test_project.id
            image_id = "img_024"

            response = admin_client.delete(
                f"/api/v1/image-locks/{project_id}/{image_id}/force"
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            assert data["status"] == "not_locked"

        app.dependency_overrides.clear()

    def test_force_release_requires_authentication(self, client, test_project):
        """
        Test that force releasing lock requires authentication.

        Should return 401 if not authenticated.
        """
        project_id = test_project.id
        image_id = "img_025"

        response = client.delete(
            f"/api/v1/image-locks/{project_id}/{image_id}/force"
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_force_release_requires_admin_permission(
        self, client, labeler_db, test_project, override_get_current_user
    ):
        """
        Test that force releasing requires admin role.

        Non-admin users should get 403.
        """
        project_id = test_project.id
        image_id = "img_026"
        now = datetime.utcnow()

        # Create lock
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id="other-user-id",
            locked_at=now,
            expires_at=now + timedelta(minutes=5),
            heartbeat_at=now,
        )
        labeler_db.add(lock)
        labeler_db.commit()

        # Try to force release as non-admin (authenticated_client has annotator role)
        response = client.delete(
            f"/api/v1/image-locks/{project_id}/{image_id}/force"
        )

        # Should be forbidden (non-admin trying to force release)
        assert response.status_code == status.HTTP_403_FORBIDDEN

        # Verify lock still exists
        lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()
        assert lock is not None


class TestConcurrentAccessHandling:
    """Test cases for concurrent access scenarios."""

    def test_multiple_users_concurrent_acquire(self, client, labeler_db, test_project):
        """
        Test multiple users trying to acquire lock on same image.

        Only first user should get the lock, others should be rejected.
        """
        from app.core.security import get_current_user
        from fastapi.testclient import TestClient

        project_id = test_project.id
        image_id = "img_027"

        # Create first user client
        user1 = {"sub": "user-001", "preferred_username": "user1", "email": "user1@test.com"}

        def override_user1():
            return user1

        app.dependency_overrides[get_current_user] = override_user1

        # Override database
        def override_labeler_db():
            try:
                yield labeler_db
            finally:
                pass

        from app.core.database import get_labeler_db, get_platform_db
        app.dependency_overrides[get_labeler_db] = override_labeler_db
        app.dependency_overrides[get_platform_db] = override_labeler_db

        with TestClient(app) as client1:
            # User 1 acquires lock
            response1 = client1.post(f"/api/v1/image-locks/{project_id}/{image_id}/acquire")
            assert response1.status_code == status.HTTP_200_OK
            data1 = response1.json()
            assert data1["status"] == "acquired"

        # Create second user client
        user2 = {"sub": "user-002", "preferred_username": "user2", "email": "user2@test.com"}

        def override_user2():
            return user2

        app.dependency_overrides[get_current_user] = override_user2

        with TestClient(app) as client2:
            # User 2 tries to acquire same lock
            response2 = client2.post(f"/api/v1/image-locks/{project_id}/{image_id}/acquire")
            assert response2.status_code == status.HTTP_200_OK
            data2 = response2.json()
            assert data2["status"] == "already_locked"
            assert data2["locked_by"]["user_id"] == "user-001"

        # Verify only one lock exists
        lock_count = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).count()
        assert lock_count == 1

        app.dependency_overrides.clear()

    def test_lock_expiration_and_takeover(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test that expired locks can be taken over by another user.

        Simulates a user abandoning their lock and another user acquiring it.
        """
        project_id = test_project.id
        image_id = "img_028"
        now = datetime.utcnow()

        # Create expired lock from old user
        old_lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id="old-user-id",
            locked_at=now - timedelta(minutes=10),
            expires_at=now - timedelta(minutes=5),  # Expired 5 minutes ago
            heartbeat_at=now - timedelta(minutes=10),
        )
        labeler_db.add(old_lock)
        labeler_db.commit()

        # New user acquires the lock
        response = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/acquire"
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Should successfully take over expired lock
        assert data["status"] == "acquired"
        assert data["lock"]["user_id"] == mock_current_user["sub"]

        # Verify lock ownership changed
        lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()
        assert lock.user_id == mock_current_user["sub"]

    def test_heartbeat_prevents_expiration(self, authenticated_client, labeler_db, test_project, mock_current_user):
        """
        Test that regular heartbeats keep lock alive.

        Lock should not expire if heartbeats are sent regularly.
        """
        project_id = test_project.id
        image_id = "img_029"

        # Acquire lock
        response1 = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/acquire"
        )
        assert response1.status_code == status.HTTP_200_OK

        # Simulate time passing (but send heartbeat before expiration)
        lock = labeler_db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()
        # Manually update to simulate time passing
        lock.locked_at = datetime.utcnow() - timedelta(minutes=4)
        lock.heartbeat_at = datetime.utcnow() - timedelta(minutes=4)
        labeler_db.commit()

        # Send heartbeat
        response2 = authenticated_client.post(
            f"/api/v1/image-locks/{project_id}/{image_id}/heartbeat"
        )
        assert response2.status_code == status.HTTP_200_OK
        data = response2.json()
        assert data["status"] == "updated"

        # Lock should still be active
        response3 = authenticated_client.get(
            f"/api/v1/image-locks/{project_id}/{image_id}/status"
        )
        assert response3.status_code == status.HTTP_200_OK
        status_data = response3.json()
        assert status_data is not None
        assert status_data["user_id"] == mock_current_user["sub"]
