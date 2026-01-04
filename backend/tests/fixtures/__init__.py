"""
Test fixtures package.

This package contains pytest fixtures for testing the backend API:

- auth_fixtures: Mock authentication and user data
- db_fixtures: Database models and test data factories

All fixtures are automatically loaded by pytest through conftest.py.
"""

from backend.tests.fixtures.auth_fixtures import (
    mock_current_user,
    mock_admin_user,
    mock_reviewer_user,
    mock_keycloak_auth,
    mock_token_payload,
    override_get_current_user,
    override_get_admin_user,
    create_mock_user,
    auth_headers,
    admin_auth_headers,
)

from backend.tests.fixtures.db_fixtures import (
    test_user_id,
    test_dataset_id,
    test_project_id,
    test_dataset,
    test_project,
    create_dataset,
    create_project,
    create_project_permission,
    create_dataset_permission,
    create_annotation_class,
    create_annotation,
)

__all__ = [
    # Auth fixtures
    "mock_current_user",
    "mock_admin_user",
    "mock_reviewer_user",
    "mock_keycloak_auth",
    "mock_token_payload",
    "override_get_current_user",
    "override_get_admin_user",
    "create_mock_user",
    "auth_headers",
    "admin_auth_headers",
    # DB fixtures
    "test_user_id",
    "test_dataset_id",
    "test_project_id",
    "test_dataset",
    "test_project",
    "create_dataset",
    "create_project",
    "create_project_permission",
    "create_dataset_permission",
    "create_annotation_class",
    "create_annotation",
]
