"""
Tests for version diff endpoints.

Tests the version diff-related endpoints including:
- GET /versions/{version_a_id}/compare/{version_b_id} - Compare two annotation versions
- GET /versions/{version_a_id}/compare/{version_b_id}/summary - Get version diff summary

This module tests:
- Version comparison between published versions
- Version comparison between working and published versions
- Diff generation with added/removed/modified annotations
- Version history tracking
- Conflict detection via optimistic locking
- Class-level statistics
- Image-level diff details
- Summary statistics
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import status
from datetime import datetime, timedelta

from app.services.version_diff_service import VersionDiffService
from app.db.models.labeler import AnnotationVersion, Annotation


class TestCompareVersions:
    """Test cases for GET /versions/{version_a_id}/compare/{version_b_id} endpoint."""

    def test_compare_versions_success(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test successful version comparison with complete diff data.

        Should return detailed diff with added, removed, modified annotations and summary.
        """
        # Mock version diff service response
        mock_diff_data = {
            'version_a': {
                'id': 1,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'version_b': {
                'id': 2,
                'version_number': 'v2.0',
                'version_type': 'published',
                'created_at': '2024-01-02T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'project_id': 'project_123',
            'task_type': 'detection',
            'image_diffs': {
                'img_001': {
                    'added': [
                        {
                            'annotation_id': 101,
                            'class_name': 'person',
                            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
                        }
                    ],
                    'removed': [
                        {
                            'annotation_id': 102,
                            'class_name': 'car',
                            'geometry': {'x': 200, 'y': 200, 'width': 80, 'height': 60}
                        }
                    ],
                    'modified': [
                        {
                            'old': {
                                'annotation_id': 103,
                                'class_name': 'dog',
                                'geometry': {'x': 300, 'y': 300, 'width': 40, 'height': 40}
                            },
                            'new': {
                                'annotation_id': 103,
                                'class_name': 'dog',
                                'geometry': {'x': 305, 'y': 305, 'width': 45, 'height': 45}
                            },
                            'changes': {
                                'geometry_changed': True,
                                'position_changed': True,
                                'size_changed': True
                            }
                        }
                    ],
                    'unchanged': [],
                    'summary': {
                        'added_count': 1,
                        'removed_count': 1,
                        'modified_count': 1,
                        'unchanged_count': 0,
                        'total_changes': 3
                    }
                }
            },
            'summary': {
                'images_with_changes': 1,
                'total_images': 1,
                'total_added': 1,
                'total_removed': 1,
                'total_modified': 1,
                'total_unchanged': 0,
                'total_changes': 3
            },
            'class_stats': {
                'person': {'added': 1, 'removed': 0, 'modified': 0},
                'car': {'added': 0, 'removed': 1, 'modified': 0},
                'dog': {'added': 0, 'removed': 0, 'modified': 1}
            }
        }

        with patch.object(VersionDiffService, 'calculate_version_diff', return_value=mock_diff_data):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify version metadata
        assert data['version_a']['id'] == 1
        assert data['version_a']['version_number'] == 'v1.0'
        assert data['version_b']['id'] == 2
        assert data['version_b']['version_number'] == 'v2.0'

        # Verify project context
        assert data['project_id'] == 'project_123'
        assert data['task_type'] == 'detection'

        # Verify image diffs
        assert 'img_001' in data['image_diffs']
        img_diff = data['image_diffs']['img_001']
        assert len(img_diff['added']) == 1
        assert len(img_diff['removed']) == 1
        assert len(img_diff['modified']) == 1
        assert img_diff['summary']['total_changes'] == 3

        # Verify summary statistics
        assert data['summary']['images_with_changes'] == 1
        assert data['summary']['total_added'] == 1
        assert data['summary']['total_removed'] == 1
        assert data['summary']['total_modified'] == 1
        assert data['summary']['total_changes'] == 3

        # Verify class statistics
        assert data['class_stats']['person']['added'] == 1
        assert data['class_stats']['car']['removed'] == 1
        assert data['class_stats']['dog']['modified'] == 1

    def test_compare_versions_with_image_filter(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test version comparison filtered by specific image_id.

        Should return diff data only for the specified image.
        """
        mock_diff_data = {
            'version_a': {
                'id': 1,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'version_b': {
                'id': 2,
                'version_number': 'v2.0',
                'version_type': 'published',
                'created_at': '2024-01-02T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'project_id': 'project_123',
            'task_type': 'detection',
            'image_diffs': {
                'img_specific': {
                    'added': [{'annotation_id': 101, 'class_name': 'person'}],
                    'removed': [],
                    'modified': [],
                    'unchanged': [],
                    'summary': {
                        'added_count': 1,
                        'removed_count': 0,
                        'modified_count': 0,
                        'unchanged_count': 0,
                        'total_changes': 1
                    }
                }
            },
            'summary': {
                'images_with_changes': 1,
                'total_images': 1,
                'total_added': 1,
                'total_removed': 0,
                'total_modified': 0,
                'total_unchanged': 0,
                'total_changes': 1
            },
            'class_stats': {
                'person': {'added': 1, 'removed': 0, 'modified': 0}
            }
        }

        with patch.object(VersionDiffService, 'calculate_version_diff', return_value=mock_diff_data) as mock_diff:
            response = authenticated_client.get(
                "/api/v1/version-diff/versions/1/compare/2",
                params={'image_id': 'img_specific'}
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify the service was called with image_id parameter
        mock_diff.assert_called_once()
        call_args = mock_diff.call_args
        assert call_args[1]['image_id'] == 'img_specific'

        # Verify only one image in results
        assert len(data['image_diffs']) == 1
        assert 'img_specific' in data['image_diffs']

    def test_compare_versions_no_changes(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test version comparison when versions are identical.

        Should return empty diffs with all annotations marked as unchanged.
        """
        mock_diff_data = {
            'version_a': {
                'id': 1,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'version_b': {
                'id': 2,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'project_id': 'project_123',
            'task_type': 'detection',
            'image_diffs': {},  # No changes
            'summary': {
                'images_with_changes': 0,
                'total_images': 5,
                'total_added': 0,
                'total_removed': 0,
                'total_modified': 0,
                'total_unchanged': 10,
                'total_changes': 0
            },
            'class_stats': {}
        }

        with patch.object(VersionDiffService, 'calculate_version_diff', return_value=mock_diff_data):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify no changes detected
        assert data['summary']['total_changes'] == 0
        assert data['summary']['images_with_changes'] == 0
        assert data['summary']['total_unchanged'] == 10
        assert len(data['image_diffs']) == 0
        assert len(data['class_stats']) == 0

    def test_compare_versions_working_vs_published(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test comparison between working version (-1) and published version.

        Should handle virtual working version correctly.
        """
        mock_diff_data = {
            'version_a': {
                'id': 1,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'version_b': {
                'id': -1,
                'version_number': 'Working',
                'version_type': 'working',
                'created_at': datetime.utcnow().isoformat(),
                'created_by': 0
            },
            'project_id': 'project_123',
            'task_type': 'detection',
            'image_diffs': {
                'img_001': {
                    'added': [{'annotation_id': 201, 'class_name': 'person'}],
                    'removed': [],
                    'modified': [],
                    'unchanged': [],
                    'summary': {
                        'added_count': 1,
                        'removed_count': 0,
                        'modified_count': 0,
                        'unchanged_count': 0,
                        'total_changes': 1
                    }
                }
            },
            'summary': {
                'images_with_changes': 1,
                'total_images': 1,
                'total_added': 1,
                'total_removed': 0,
                'total_modified': 0,
                'total_unchanged': 0,
                'total_changes': 1
            },
            'class_stats': {
                'person': {'added': 1, 'removed': 0, 'modified': 0}
            }
        }

        with patch.object(VersionDiffService, 'calculate_version_diff', return_value=mock_diff_data):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/-1")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify working version is included
        assert data['version_b']['id'] == -1
        assert data['version_b']['version_number'] == 'Working'
        assert data['version_b']['version_type'] == 'working'

    def test_compare_versions_invalid_version_id(self, authenticated_client, labeler_db):
        """
        Test version comparison with non-existent version ID.

        Should return 400 error with appropriate message.
        """
        with patch.object(
            VersionDiffService,
            'calculate_version_diff',
            side_effect=ValueError("Version not found")
        ):
            response = authenticated_client.get("/api/v1/version-diff/versions/9999/compare/9998")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Version not found" in response.json()['detail']

    def test_compare_versions_different_projects(self, authenticated_client, labeler_db):
        """
        Test comparison of versions from different projects.

        Should return 400 error indicating versions must be from same project.
        """
        with patch.object(
            VersionDiffService,
            'calculate_version_diff',
            side_effect=ValueError("Versions must be from the same project")
        ):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "same project" in response.json()['detail']

    def test_compare_versions_different_task_types(self, authenticated_client, labeler_db):
        """
        Test comparison of versions with different task types.

        Should return 400 error indicating versions must have same task type.
        """
        with patch.object(
            VersionDiffService,
            'calculate_version_diff',
            side_effect=ValueError("Versions must have the same task type")
        ):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "task type" in response.json()['detail']

    def test_compare_versions_unauthorized(self, client, labeler_db):
        """
        Test version comparison without authentication.

        Should return 401 Unauthorized error.
        """
        response = client.get("/api/v1/version-diff/versions/1/compare/2")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_compare_versions_service_error(self, authenticated_client, labeler_db):
        """
        Test handling of service errors during version comparison.

        Should return 500 error with appropriate message.
        """
        with patch.object(
            VersionDiffService,
            'calculate_version_diff',
            side_effect=Exception("Database connection failed")
        ):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2")

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to calculate diff" in response.json()['detail']

    def test_compare_versions_with_geometry_changes(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test version comparison detecting geometry changes.

        Should identify position, size, and shape changes in annotations.
        """
        mock_diff_data = {
            'version_a': {
                'id': 1,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'version_b': {
                'id': 2,
                'version_number': 'v2.0',
                'version_type': 'published',
                'created_at': '2024-01-02T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'project_id': 'project_123',
            'task_type': 'detection',
            'image_diffs': {
                'img_001': {
                    'added': [],
                    'removed': [],
                    'modified': [
                        {
                            'old': {
                                'annotation_id': 100,
                                'class_name': 'person',
                                'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
                            },
                            'new': {
                                'annotation_id': 100,
                                'class_name': 'person',
                                'geometry': {'x': 110, 'y': 110, 'width': 60, 'height': 60}
                            },
                            'changes': {
                                'geometry_changed': True,
                                'position_changed': True,
                                'size_changed': True,
                                'old_geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50},
                                'new_geometry': {'x': 110, 'y': 110, 'width': 60, 'height': 60}
                            }
                        }
                    ],
                    'unchanged': [],
                    'summary': {
                        'added_count': 0,
                        'removed_count': 0,
                        'modified_count': 1,
                        'unchanged_count': 0,
                        'total_changes': 1
                    }
                }
            },
            'summary': {
                'images_with_changes': 1,
                'total_images': 1,
                'total_added': 0,
                'total_removed': 0,
                'total_modified': 1,
                'total_unchanged': 0,
                'total_changes': 1
            },
            'class_stats': {
                'person': {'added': 0, 'removed': 0, 'modified': 1}
            }
        }

        with patch.object(VersionDiffService, 'calculate_version_diff', return_value=mock_diff_data):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify geometry changes detected
        modified = data['image_diffs']['img_001']['modified'][0]
        assert modified['changes']['geometry_changed'] is True
        assert modified['changes']['position_changed'] is True
        assert modified['changes']['size_changed'] is True
        assert modified['old']['geometry']['x'] == 100
        assert modified['new']['geometry']['x'] == 110

    def test_compare_versions_with_class_changes(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test version comparison detecting class reassignment.

        Should identify when annotation class is changed between versions.
        """
        mock_diff_data = {
            'version_a': {
                'id': 1,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'version_b': {
                'id': 2,
                'version_number': 'v2.0',
                'version_type': 'published',
                'created_at': '2024-01-02T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'project_id': 'project_123',
            'task_type': 'detection',
            'image_diffs': {
                'img_001': {
                    'added': [],
                    'removed': [],
                    'modified': [
                        {
                            'old': {
                                'annotation_id': 100,
                                'class_name': 'person',
                                'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
                            },
                            'new': {
                                'annotation_id': 100,
                                'class_name': 'pedestrian',
                                'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
                            },
                            'changes': {
                                'class_changed': True,
                                'old_class': 'person',
                                'new_class': 'pedestrian'
                            }
                        }
                    ],
                    'unchanged': [],
                    'summary': {
                        'added_count': 0,
                        'removed_count': 0,
                        'modified_count': 1,
                        'unchanged_count': 0,
                        'total_changes': 1
                    }
                }
            },
            'summary': {
                'images_with_changes': 1,
                'total_images': 1,
                'total_added': 0,
                'total_removed': 0,
                'total_modified': 1,
                'total_unchanged': 0,
                'total_changes': 1
            },
            'class_stats': {
                'pedestrian': {'added': 0, 'removed': 0, 'modified': 1}
            }
        }

        with patch.object(VersionDiffService, 'calculate_version_diff', return_value=mock_diff_data):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify class change detected
        modified = data['image_diffs']['img_001']['modified'][0]
        assert modified['changes']['class_changed'] is True
        assert modified['changes']['old_class'] == 'person'
        assert modified['changes']['new_class'] == 'pedestrian'


class TestGetDiffSummary:
    """Test cases for GET /versions/{version_a_id}/compare/{version_b_id}/summary endpoint."""

    def test_get_diff_summary_success(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test successful retrieval of diff summary without detailed image diffs.

        Should return summary statistics and class stats only.
        """
        mock_diff_data = {
            'version_a': {
                'id': 1,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'version_b': {
                'id': 2,
                'version_number': 'v2.0',
                'version_type': 'published',
                'created_at': '2024-01-02T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'project_id': 'project_123',
            'task_type': 'detection',
            'image_diffs': {
                'img_001': {
                    'added': [{'annotation_id': 101}],
                    'removed': [],
                    'modified': [],
                    'unchanged': [],
                    'summary': {'added_count': 1, 'removed_count': 0, 'modified_count': 0, 'unchanged_count': 0, 'total_changes': 1}
                }
            },
            'summary': {
                'images_with_changes': 1,
                'total_images': 5,
                'total_added': 10,
                'total_removed': 5,
                'total_modified': 3,
                'total_unchanged': 100,
                'total_changes': 18
            },
            'class_stats': {
                'person': {'added': 5, 'removed': 2, 'modified': 1},
                'car': {'added': 3, 'removed': 1, 'modified': 2},
                'dog': {'added': 2, 'removed': 2, 'modified': 0}
            }
        }

        with patch.object(VersionDiffService, 'calculate_version_diff', return_value=mock_diff_data):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2/summary")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify version metadata is included
        assert data['version_a']['id'] == 1
        assert data['version_a']['version_number'] == 'v1.0'
        assert data['version_b']['id'] == 2
        assert data['version_b']['version_number'] == 'v2.0'

        # Verify project context
        assert data['project_id'] == 'project_123'
        assert data['task_type'] == 'detection'

        # Verify summary is included
        assert data['summary']['images_with_changes'] == 1
        assert data['summary']['total_images'] == 5
        assert data['summary']['total_added'] == 10
        assert data['summary']['total_removed'] == 5
        assert data['summary']['total_modified'] == 3
        assert data['summary']['total_changes'] == 18

        # Verify class stats are included
        assert data['class_stats']['person']['added'] == 5
        assert data['class_stats']['car']['modified'] == 2
        assert data['class_stats']['dog']['removed'] == 2

        # Verify image_diffs is NOT included in summary
        assert 'image_diffs' not in data

    def test_get_diff_summary_no_changes(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test diff summary when versions are identical.

        Should return zero changes in summary.
        """
        mock_diff_data = {
            'version_a': {
                'id': 1,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'version_b': {
                'id': 2,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'project_id': 'project_123',
            'task_type': 'detection',
            'image_diffs': {},
            'summary': {
                'images_with_changes': 0,
                'total_images': 5,
                'total_added': 0,
                'total_removed': 0,
                'total_modified': 0,
                'total_unchanged': 50,
                'total_changes': 0
            },
            'class_stats': {}
        }

        with patch.object(VersionDiffService, 'calculate_version_diff', return_value=mock_diff_data):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2/summary")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify no changes
        assert data['summary']['total_changes'] == 0
        assert data['summary']['images_with_changes'] == 0
        assert data['summary']['total_unchanged'] == 50
        assert len(data['class_stats']) == 0

    def test_get_diff_summary_invalid_version(self, authenticated_client, labeler_db):
        """
        Test diff summary with invalid version ID.

        Should return 400 error.
        """
        with patch.object(
            VersionDiffService,
            'calculate_version_diff',
            side_effect=ValueError("Version not found")
        ):
            response = authenticated_client.get("/api/v1/version-diff/versions/9999/compare/9998/summary")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Version not found" in response.json()['detail']

    def test_get_diff_summary_unauthorized(self, client, labeler_db):
        """
        Test diff summary without authentication.

        Should return 401 Unauthorized error.
        """
        response = client.get("/api/v1/version-diff/versions/1/compare/2/summary")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_diff_summary_service_error(self, authenticated_client, labeler_db):
        """
        Test handling of service errors during summary retrieval.

        Should return 500 error.
        """
        with patch.object(
            VersionDiffService,
            'calculate_version_diff',
            side_effect=Exception("S3 connection failed")
        ):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2/summary")

        assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to calculate diff summary" in response.json()['detail']

    def test_get_diff_summary_multiple_classes(self, authenticated_client, labeler_db, mock_current_user):
        """
        Test diff summary with changes across multiple classes.

        Should correctly aggregate per-class statistics.
        """
        mock_diff_data = {
            'version_a': {
                'id': 1,
                'version_number': 'v1.0',
                'version_type': 'published',
                'created_at': '2024-01-01T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'version_b': {
                'id': 2,
                'version_number': 'v2.0',
                'version_type': 'published',
                'created_at': '2024-01-02T00:00:00',
                'created_by': mock_current_user['sub']
            },
            'project_id': 'project_123',
            'task_type': 'detection',
            'image_diffs': {},
            'summary': {
                'images_with_changes': 10,
                'total_images': 100,
                'total_added': 25,
                'total_removed': 15,
                'total_modified': 10,
                'total_unchanged': 200,
                'total_changes': 50
            },
            'class_stats': {
                'person': {'added': 10, 'removed': 5, 'modified': 3},
                'car': {'added': 8, 'removed': 6, 'modified': 4},
                'bicycle': {'added': 4, 'removed': 2, 'modified': 2},
                'traffic_light': {'added': 3, 'removed': 2, 'modified': 1}
            }
        }

        with patch.object(VersionDiffService, 'calculate_version_diff', return_value=mock_diff_data):
            response = authenticated_client.get("/api/v1/version-diff/versions/1/compare/2/summary")

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify all class statistics are present
        assert len(data['class_stats']) == 4
        assert 'person' in data['class_stats']
        assert 'car' in data['class_stats']
        assert 'bicycle' in data['class_stats']
        assert 'traffic_light' in data['class_stats']

        # Verify per-class counts
        assert data['class_stats']['person']['added'] == 10
        assert data['class_stats']['car']['removed'] == 6
        assert data['class_stats']['bicycle']['modified'] == 2


class TestVersionDiffService:
    """Test cases for VersionDiffService utility methods."""

    def test_calculate_iou_perfect_overlap(self):
        """
        Test IoU calculation for identical bounding boxes.

        Should return 1.0 for perfect overlap.
        """
        bbox1 = {'x': 100, 'y': 100, 'width': 50, 'height': 50}
        bbox2 = {'x': 100, 'y': 100, 'width': 50, 'height': 50}

        iou = VersionDiffService.calculate_iou(bbox1, bbox2)
        assert iou == 1.0

    def test_calculate_iou_no_overlap(self):
        """
        Test IoU calculation for non-overlapping boxes.

        Should return 0.0 for no overlap.
        """
        bbox1 = {'x': 0, 'y': 0, 'width': 50, 'height': 50}
        bbox2 = {'x': 100, 'y': 100, 'width': 50, 'height': 50}

        iou = VersionDiffService.calculate_iou(bbox1, bbox2)
        assert iou == 0.0

    def test_calculate_iou_partial_overlap(self):
        """
        Test IoU calculation for partially overlapping boxes.

        Should return value between 0 and 1.
        """
        bbox1 = {'x': 0, 'y': 0, 'width': 100, 'height': 100}
        bbox2 = {'x': 50, 'y': 50, 'width': 100, 'height': 100}

        iou = VersionDiffService.calculate_iou(bbox1, bbox2)
        assert 0.0 < iou < 1.0
        # Expected IoU: intersection = 50*50 = 2500, union = 10000 + 10000 - 2500 = 17500
        # IoU = 2500 / 17500 = 0.142857...
        assert abs(iou - 0.142857) < 0.0001

    def test_normalize_geometry_db_format(self):
        """
        Test geometry normalization for DB format (direct keys).

        Should preserve x, y, width, height keys.
        """
        geometry = {'x': 100, 'y': 200, 'width': 50, 'height': 60}
        normalized = VersionDiffService.normalize_geometry(geometry)

        assert normalized['x'] == 100
        assert normalized['y'] == 200
        assert normalized['width'] == 50
        assert normalized['height'] == 60

    def test_normalize_geometry_r2_format(self):
        """
        Test geometry normalization for R2/DICE format (bbox array).

        Should convert bbox array to x, y, width, height keys.
        """
        geometry = {
            'bbox': [100, 200, 50, 60],
            'type': 'bbox',
            'image_width': 1920,
            'image_height': 1080
        }
        normalized = VersionDiffService.normalize_geometry(geometry)

        assert normalized['x'] == 100
        assert normalized['y'] == 200
        assert normalized['width'] == 50
        assert normalized['height'] == 60

    def test_normalize_geometry_polygon(self):
        """
        Test geometry normalization for polygon annotations.

        Should preserve points array.
        """
        geometry = {
            'points': [[10, 20], [30, 40], [50, 60]]
        }
        normalized = VersionDiffService.normalize_geometry(geometry)

        assert 'points' in normalized
        assert normalized['points'] == [[10, 20], [30, 40], [50, 60]]

    def test_compare_annotations_no_changes(self):
        """
        Test annotation comparison when annotations are identical.

        Should return empty changes dict.
        """
        ann_old = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50},
            'confidence': 0.95,
            'attributes': {'occluded': False}
        }
        ann_new = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50},
            'confidence': 0.95,
            'attributes': {'occluded': False}
        }

        changes = VersionDiffService.compare_annotations(ann_old, ann_new)
        assert len(changes) == 0

    def test_compare_annotations_class_changed(self):
        """
        Test annotation comparison when class is changed.

        Should detect class_changed flag.
        """
        ann_old = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
        }
        ann_new = {
            'annotation_id': 100,
            'class_name': 'pedestrian',
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
        }

        changes = VersionDiffService.compare_annotations(ann_old, ann_new)
        assert changes['class_changed'] is True
        assert changes['old_class'] == 'person'
        assert changes['new_class'] == 'pedestrian'

    def test_compare_annotations_position_changed(self):
        """
        Test annotation comparison when position is changed.

        Should detect position_changed and geometry_changed flags.
        """
        ann_old = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
        }
        ann_new = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 110, 'y': 120, 'width': 50, 'height': 50}
        }

        changes = VersionDiffService.compare_annotations(ann_old, ann_new)
        assert changes['geometry_changed'] is True
        assert changes['position_changed'] is True
        assert 'size_changed' not in changes

    def test_compare_annotations_size_changed(self):
        """
        Test annotation comparison when size is changed.

        Should detect size_changed and geometry_changed flags.
        """
        ann_old = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
        }
        ann_new = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 100, 'y': 100, 'width': 60, 'height': 70}
        }

        changes = VersionDiffService.compare_annotations(ann_old, ann_new)
        assert changes['geometry_changed'] is True
        assert changes['size_changed'] is True
        assert 'position_changed' not in changes

    def test_compare_annotations_confidence_changed(self):
        """
        Test annotation comparison when confidence is changed.

        Should detect confidence_changed flag.
        """
        ann_old = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50},
            'confidence': 0.85
        }
        ann_new = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50},
            'confidence': 0.95
        }

        changes = VersionDiffService.compare_annotations(ann_old, ann_new)
        assert changes['confidence_changed'] is True
        assert changes['old_confidence'] == 0.85
        assert changes['new_confidence'] == 0.95

    def test_compare_annotations_attributes_changed(self):
        """
        Test annotation comparison when attributes are changed.

        Should detect attributes_changed flag.
        """
        ann_old = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50},
            'attributes': {'occluded': False, 'truncated': False}
        }
        ann_new = {
            'annotation_id': 100,
            'class_name': 'person',
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50},
            'attributes': {'occluded': True, 'truncated': False}
        }

        changes = VersionDiffService.compare_annotations(ann_old, ann_new)
        assert changes['attributes_changed'] is True
        assert changes['old_attributes'] == {'occluded': False, 'truncated': False}
        assert changes['new_attributes'] == {'occluded': True, 'truncated': False}

    def test_find_best_match_by_annotation_id(self):
        """
        Test finding best match using annotation_id.

        Should match by ID first before trying IoU.
        """
        annotation = {
            'annotation_id': 100,
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
        }
        candidates = [
            {'annotation_id': 99, 'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}},
            {'annotation_id': 100, 'geometry': {'x': 200, 'y': 200, 'width': 50, 'height': 50}},
            {'annotation_id': 101, 'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}},
        ]

        match, idx = VersionDiffService.find_best_match(annotation, candidates)
        assert match['annotation_id'] == 100
        assert idx == 1

    def test_find_best_match_by_iou(self):
        """
        Test finding best match using IoU when no ID match exists.

        Should match based on highest IoU above threshold.
        """
        annotation = {
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
        }
        candidates = [
            {'geometry': {'x': 0, 'y': 0, 'width': 50, 'height': 50}},  # No overlap
            {'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}},  # Perfect match
            {'geometry': {'x': 110, 'y': 110, 'width': 50, 'height': 50}},  # Partial overlap
        ]

        match, idx = VersionDiffService.find_best_match(annotation, candidates)
        assert idx == 1  # Should match the perfect overlap

    def test_find_best_match_no_match(self):
        """
        Test finding best match when no good match exists.

        Should return None when IoU is below threshold.
        """
        annotation = {
            'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
        }
        candidates = [
            {'geometry': {'x': 1000, 'y': 1000, 'width': 50, 'height': 50}},  # Far away
            {'geometry': {'x': 2000, 'y': 2000, 'width': 50, 'height': 50}},  # Far away
        ]

        match = VersionDiffService.find_best_match(annotation, candidates)
        assert match is None

    def test_parse_version_number_working(self):
        """
        Test version number parsing for Working version.

        Should return highest priority tuple.
        """
        parsed = VersionDiffService._parse_version_number('Working')
        assert parsed == (999999, 0)

    def test_parse_version_number_draft(self):
        """
        Test version number parsing for draft version.

        Should return second highest priority tuple.
        """
        parsed = VersionDiffService._parse_version_number('draft')
        assert parsed == (999998, 0)

    def test_parse_version_number_semantic(self):
        """
        Test version number parsing for semantic versions.

        Should correctly parse vX.Y format.
        """
        assert VersionDiffService._parse_version_number('v1.0') == (1, 0)
        assert VersionDiffService._parse_version_number('v2.5') == (2, 5)
        assert VersionDiffService._parse_version_number('v10.3') == (10, 3)

    def test_parse_version_number_comparison(self):
        """
        Test version number comparison for ordering.

        Should order versions correctly: v1.0 < v2.0 < draft < Working.
        """
        v1 = VersionDiffService._parse_version_number('v1.0')
        v2 = VersionDiffService._parse_version_number('v2.0')
        draft = VersionDiffService._parse_version_number('draft')
        working = VersionDiffService._parse_version_number('Working')

        assert v1 < v2 < draft < working

    def test_calculate_diff_for_image_added_annotations(self):
        """
        Test diff calculation detecting added annotations.

        Should correctly identify new annotations in version B.
        """
        snapshots_a = []
        snapshots_b = [
            {
                'annotation_id': 101,
                'class_name': 'person',
                'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
            }
        ]

        diff = VersionDiffService.calculate_diff_for_image(snapshots_a, snapshots_b)

        assert len(diff['added']) == 1
        assert len(diff['removed']) == 0
        assert len(diff['modified']) == 0
        assert len(diff['unchanged']) == 0
        assert diff['summary']['added_count'] == 1
        assert diff['summary']['total_changes'] == 1

    def test_calculate_diff_for_image_removed_annotations(self):
        """
        Test diff calculation detecting removed annotations.

        Should correctly identify annotations removed in version B.
        """
        snapshots_a = [
            {
                'annotation_id': 101,
                'class_name': 'person',
                'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
            }
        ]
        snapshots_b = []

        diff = VersionDiffService.calculate_diff_for_image(snapshots_a, snapshots_b)

        assert len(diff['added']) == 0
        assert len(diff['removed']) == 1
        assert len(diff['modified']) == 0
        assert len(diff['unchanged']) == 0
        assert diff['summary']['removed_count'] == 1
        assert diff['summary']['total_changes'] == 1

    def test_calculate_diff_for_image_modified_annotations(self):
        """
        Test diff calculation detecting modified annotations.

        Should correctly identify annotations changed between versions.
        """
        snapshots_a = [
            {
                'annotation_id': 101,
                'class_name': 'person',
                'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50}
            }
        ]
        snapshots_b = [
            {
                'annotation_id': 101,
                'class_name': 'person',
                'geometry': {'x': 110, 'y': 110, 'width': 50, 'height': 50}
            }
        ]

        diff = VersionDiffService.calculate_diff_for_image(snapshots_a, snapshots_b)

        assert len(diff['added']) == 0
        assert len(diff['removed']) == 0
        assert len(diff['modified']) == 1
        assert len(diff['unchanged']) == 0
        assert diff['summary']['modified_count'] == 1
        assert diff['summary']['total_changes'] == 1

    def test_calculate_diff_for_image_unchanged_annotations(self):
        """
        Test diff calculation detecting unchanged annotations.

        Should correctly identify annotations that are identical.
        """
        snapshots_a = [
            {
                'annotation_id': 101,
                'class_name': 'person',
                'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50},
                'confidence': 0.95,
                'attributes': {'occluded': False}
            }
        ]
        snapshots_b = [
            {
                'annotation_id': 101,
                'class_name': 'person',
                'geometry': {'x': 100, 'y': 100, 'width': 50, 'height': 50},
                'confidence': 0.95,
                'attributes': {'occluded': False}
            }
        ]

        diff = VersionDiffService.calculate_diff_for_image(snapshots_a, snapshots_b)

        assert len(diff['added']) == 0
        assert len(diff['removed']) == 0
        assert len(diff['modified']) == 0
        assert len(diff['unchanged']) == 1
        assert diff['summary']['unchanged_count'] == 1
        assert diff['summary']['total_changes'] == 0
