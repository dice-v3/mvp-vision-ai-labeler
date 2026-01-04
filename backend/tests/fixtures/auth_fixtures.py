"""
Authentication fixtures for mocking Keycloak authentication in tests.

Provides mock users, token validation, and auth dependency overrides.
"""

import pytest
from typing import Dict, Any
from unittest.mock import Mock, patch

from app.core.security import get_current_user, get_current_admin_user
from app.main import app


# =============================================================================
# Mock User Data
# =============================================================================

@pytest.fixture
def test_user_id() -> str:
    """Provide a test user ID (Keycloak sub)."""
    return "test-user-id-12345678-1234-1234-1234-123456789abc"


@pytest.fixture
def mock_current_user(test_user_id: str) -> Dict[str, Any]:
    """
    Provide mock authenticated user data.

    Returns user info that would normally come from Keycloak token.

    Usage:
        def test_endpoint(authenticated_client, mock_current_user):
            # Client will use this user
            assert mock_current_user["email"] == "test@example.com"
    """
    return {
        "sub": test_user_id,
        "email": "test@example.com",
        "email_verified": True,
        "name": "Test User",
        "given_name": "Test",
        "family_name": "User",
        "preferred_username": "testuser",
        "roles": ["user"],
        "is_admin": False,
    }


@pytest.fixture
def mock_admin_user(test_user_id: str) -> Dict[str, Any]:
    """
    Provide mock admin user data.

    Usage:
        def test_admin_endpoint(admin_client, mock_admin_user):
            # Client will use this admin user
            assert mock_admin_user["is_admin"] is True
    """
    return {
        "sub": "admin-user-id-12345678-1234-1234-1234-123456789abc",
        "email": "admin@example.com",
        "email_verified": True,
        "name": "Admin User",
        "given_name": "Admin",
        "family_name": "User",
        "preferred_username": "admin",
        "roles": ["user", "admin"],
        "is_admin": True,
    }


@pytest.fixture
def mock_reviewer_user() -> Dict[str, Any]:
    """Provide mock reviewer user data."""
    return {
        "sub": "reviewer-user-id-12345678-1234-1234-1234-123456789abc",
        "email": "reviewer@example.com",
        "email_verified": True,
        "name": "Reviewer User",
        "given_name": "Reviewer",
        "family_name": "User",
        "preferred_username": "reviewer",
        "roles": ["user", "reviewer"],
        "is_admin": False,
    }


# =============================================================================
# Mock Keycloak Auth
# =============================================================================

@pytest.fixture
def mock_keycloak_auth():
    """
    Mock the keycloak_auth module for token validation.

    Usage:
        def test_with_mock_keycloak(mock_keycloak_auth):
            # Keycloak token validation is now mocked
            pass
    """
    with patch("app.core.security.keycloak_auth") as mock_auth:
        # Mock verify_token to return a valid payload
        mock_auth.verify_token.return_value = {
            "sub": "test-user-id-12345678-1234-1234-1234-123456789abc",
            "email": "test@example.com",
            "name": "Test User",
            "realm_access": {"roles": ["user"]},
            "resource_access": {},
        }

        # Mock get_user_info_from_token
        mock_auth.get_user_info_from_token.return_value = {
            "sub": "test-user-id-12345678-1234-1234-1234-123456789abc",
            "email": "test@example.com",
            "email_verified": True,
            "name": "Test User",
            "given_name": "Test",
            "family_name": "User",
            "preferred_username": "testuser",
            "roles": ["user"],
            "is_admin": False,
        }

        yield mock_auth


@pytest.fixture
def mock_token_payload(test_user_id: str) -> Dict[str, Any]:
    """Provide mock JWT token payload."""
    return {
        "sub": test_user_id,
        "email": "test@example.com",
        "name": "Test User",
        "given_name": "Test",
        "family_name": "User",
        "preferred_username": "testuser",
        "email_verified": True,
        "realm_access": {
            "roles": ["user"],
        },
        "resource_access": {},
        "iat": 1609459200,  # 2021-01-01 00:00:00
        "exp": 1609545600,  # 2021-01-02 00:00:00
        "iss": "http://localhost:8080/realms/mvp-vision",
        "aud": "labeler-backend",
    }


# =============================================================================
# Dependency Overrides
# =============================================================================

@pytest.fixture
def override_get_current_user(mock_current_user: Dict[str, Any]):
    """
    Override the get_current_user dependency to return mock user.

    Automatically applied when using authenticated_client fixture.
    """
    async def _override():
        return mock_current_user

    app.dependency_overrides[get_current_user] = _override

    yield _override

    # Clean up
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]


@pytest.fixture
def override_get_admin_user(mock_admin_user: Dict[str, Any]):
    """
    Override the get_current_admin_user dependency to return admin user.

    Automatically applied when using admin_client fixture.
    """
    from app.core.security import get_current_admin_user

    async def _override():
        return mock_admin_user

    app.dependency_overrides[get_current_user] = _override
    app.dependency_overrides[get_current_admin_user] = _override

    yield _override

    # Clean up
    if get_current_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_user]
    if get_current_admin_user in app.dependency_overrides:
        del app.dependency_overrides[get_current_admin_user]


@pytest.fixture
def create_mock_user():
    """
    Factory fixture to create custom mock users.

    Usage:
        def test_custom_user(create_mock_user):
            custom_user = create_mock_user(
                email="custom@example.com",
                roles=["annotator"],
            )
            assert custom_user["email"] == "custom@example.com"
    """
    def _create_mock_user(
        user_id: str = "custom-user-id",
        email: str = "custom@example.com",
        name: str = "Custom User",
        roles: list = None,
        is_admin: bool = False,
    ) -> Dict[str, Any]:
        if roles is None:
            roles = ["user"]

        return {
            "sub": user_id,
            "email": email,
            "email_verified": True,
            "name": name,
            "given_name": name.split()[0] if " " in name else name,
            "family_name": name.split()[-1] if " " in name else "",
            "preferred_username": email.split("@")[0],
            "roles": roles,
            "is_admin": is_admin,
        }

    return _create_mock_user


# =============================================================================
# Authorization Header Helpers
# =============================================================================

@pytest.fixture
def auth_headers(test_user_id: str) -> Dict[str, str]:
    """
    Provide authentication headers with mock token.

    Usage:
        def test_with_headers(client, auth_headers):
            response = client.get("/api/v1/me", headers=auth_headers)
    """
    return {
        "Authorization": "Bearer mock-test-token-12345",
    }


@pytest.fixture
def admin_auth_headers() -> Dict[str, str]:
    """Provide admin authentication headers."""
    return {
        "Authorization": "Bearer mock-admin-token-12345",
    }


# Export all fixtures
__all__ = [
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
    "test_user_id",
]
