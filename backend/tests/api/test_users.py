"""
Tests for user endpoints.

Tests the user-related endpoints including:
- GET /search - Search users by email or name
- GET /me - Get current user information
- GET /{user_id} - Get user information by ID
"""

import pytest
from unittest.mock import patch
from fastapi import status
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app


class TestSearchUsers:
    """Test cases for GET /api/v1/users/search endpoint."""

    def test_search_users_authenticated(self, authenticated_client):
        """
        Test user search with valid authentication.

        Should return empty results with message (Keycloak integration pending).
        """
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "test@example.com"}
        )

        assert response.status_code == 200
        data = response.json()

        # Should return empty results with message
        assert data["users"] == []
        assert data["total"] == 0
        assert "Keycloak Admin API" in data["message"]

    def test_search_users_with_pagination(self, authenticated_client):
        """
        Test user search with pagination parameters.

        Should respect limit and offset parameters.
        """
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "test", "limit": 20, "offset": 10}
        )

        assert response.status_code == 200
        data = response.json()

        # Verify pagination parameters are returned
        assert data["limit"] == 20
        assert data["offset"] == 10
        assert data["users"] == []
        assert data["total"] == 0

    def test_search_users_default_pagination(self, authenticated_client):
        """
        Test user search with default pagination values.

        Should use default limit=10 and offset=0.
        """
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "test"}
        )

        assert response.status_code == 200
        data = response.json()

        assert data["limit"] == 10
        assert data["offset"] == 0

    def test_search_users_limit_boundary_max(self, authenticated_client):
        """
        Test user search with maximum allowed limit (50).

        Should accept limit=50 as it's within bounds.
        """
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "test", "limit": 50}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 50

    def test_search_users_limit_boundary_min(self, authenticated_client):
        """
        Test user search with minimum allowed limit (1).

        Should accept limit=1 as it's within bounds.
        """
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "test", "limit": 1}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 1

    def test_search_users_limit_exceeds_max(self, authenticated_client):
        """
        Test user search with limit exceeding maximum (>50).

        Should return validation error.
        """
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "test", "limit": 100}
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_search_users_limit_below_min(self, authenticated_client):
        """
        Test user search with limit below minimum (<1).

        Should return validation error.
        """
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "test", "limit": 0}
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_search_users_negative_offset(self, authenticated_client):
        """
        Test user search with negative offset.

        Should return validation error.
        """
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "test", "offset": -1}
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_search_users_empty_query(self, authenticated_client):
        """
        Test user search with empty query string.

        Should return validation error (min_length=1).
        """
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": ""}
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_search_users_missing_query(self, authenticated_client):
        """
        Test user search without query parameter.

        Should return validation error (query is required).
        """
        response = authenticated_client.get("/api/v1/users/search")

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_search_users_without_auth(self, client):
        """
        Test user search without authentication.

        Should return 403 Forbidden.
        """
        response = client.get(
            "/api/v1/users/search",
            params={"q": "test"}
        )

        assert response.status_code == 403

    def test_search_users_with_admin(self, admin_client):
        """
        Test user search as admin user.

        Should work the same as regular user (returns empty results).
        """
        response = admin_client.get(
            "/api/v1/users/search",
            params={"q": "admin"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["users"] == []
        assert data["total"] == 0

    def test_search_users_various_query_formats(self, authenticated_client):
        """
        Test user search with various query formats.

        Should accept email-like and name-like queries.
        """
        # Email format
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "user@example.com"}
        )
        assert response.status_code == 200

        # Name format
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "John Doe"}
        )
        assert response.status_code == 200

        # Partial match
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "john"}
        )
        assert response.status_code == 200

    def test_search_users_special_characters(self, authenticated_client):
        """
        Test user search with special characters in query.

        Should handle special characters without errors.
        """
        response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "test+user@example.com"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["users"] == []


class TestGetCurrentUserInfo:
    """Test cases for GET /api/v1/users/me endpoint."""

    def test_get_me_authenticated(self, authenticated_client, mock_current_user):
        """
        Test /me endpoint with valid authentication.

        Should return current user information from token.
        """
        response = authenticated_client.get("/api/v1/users/me")

        assert response.status_code == 200
        data = response.json()

        # Verify all expected fields
        assert data["id"] == mock_current_user["sub"]
        assert data["email"] == mock_current_user["email"]
        assert data["name"] == mock_current_user["name"]
        assert data["full_name"] == mock_current_user["name"]
        assert data["roles"] == mock_current_user["roles"]
        assert data["is_admin"] == mock_current_user["is_admin"]

    def test_get_me_admin_user(self, admin_client, mock_admin_user):
        """
        Test /me endpoint with admin user.

        Should return admin user information with is_admin=True.
        """
        response = admin_client.get("/api/v1/users/me")

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == mock_admin_user["sub"]
        assert data["email"] == mock_admin_user["email"]
        assert data["is_admin"] is True
        assert "admin" in data["roles"]

    def test_get_me_without_auth(self, client):
        """
        Test /me endpoint without authentication.

        Should return 403 Forbidden.
        """
        response = client.get("/api/v1/users/me")

        assert response.status_code == 403

    def test_get_me_response_structure(self, authenticated_client):
        """
        Test that response has correct structure.

        Should include all required fields.
        """
        response = authenticated_client.get("/api/v1/users/me")

        assert response.status_code == 200
        data = response.json()

        # Required fields
        assert "id" in data
        assert "email" in data
        assert "name" in data
        assert "full_name" in data
        assert "roles" in data
        assert "is_admin" in data

        # Type validation
        assert isinstance(data["id"], str)
        assert isinstance(data["roles"], list)
        assert isinstance(data["is_admin"], bool)

    def test_get_me_with_custom_roles(self, client, create_mock_user):
        """
        Test /me endpoint with user having custom roles.

        Should return all assigned roles.
        """
        custom_user = create_mock_user(
            email="annotator@example.com",
            name="Annotator User",
            roles=["user", "annotator", "reviewer"],
            is_admin=False,
        )

        async def override_custom_user(*args, **kwargs):
            return custom_user

        app.dependency_overrides[get_current_user] = override_custom_user

        try:
            response = client.get(
                "/api/v1/users/me",
                headers={"Authorization": "Bearer custom-token"}
            )

            assert response.status_code == 200
            data = response.json()

            assert "annotator" in data["roles"]
            assert "reviewer" in data["roles"]
            assert len(data["roles"]) == 3
            assert data["is_admin"] is False
        finally:
            app.dependency_overrides.clear()

    def test_get_me_with_minimal_user_data(self, client):
        """
        Test /me endpoint with minimal user data.

        Should handle users with missing optional fields.
        """
        minimal_user = {
            "sub": "minimal-user-id",
            "email": None,
            "name": None,
            "roles": [],
            "is_admin": False,
        }

        async def override_minimal_user(*args, **kwargs):
            return minimal_user

        app.dependency_overrides[get_current_user] = override_minimal_user

        try:
            response = client.get(
                "/api/v1/users/me",
                headers={"Authorization": "Bearer minimal-token"}
            )

            assert response.status_code == 200
            data = response.json()

            assert data["id"] == "minimal-user-id"
            assert data["email"] is None
            assert data["name"] is None
            assert data["full_name"] is None
            assert data["roles"] == []
            assert data["is_admin"] is False
        finally:
            app.dependency_overrides.clear()

    def test_get_me_roles_is_list(self, authenticated_client):
        """
        Test that roles field is always a list.

        Even if empty, should be a list type.
        """
        response = authenticated_client.get("/api/v1/users/me")

        assert response.status_code == 200
        data = response.json()

        assert isinstance(data["roles"], list)

    def test_get_me_field_types(self, authenticated_client):
        """
        Test that all fields have correct types.

        Validates type safety of response.
        """
        response = authenticated_client.get("/api/v1/users/me")

        assert response.status_code == 200
        data = response.json()

        # String fields (can be None)
        assert data["id"] is None or isinstance(data["id"], str)
        assert data["email"] is None or isinstance(data["email"], str)
        assert data["name"] is None or isinstance(data["name"], str)
        assert data["full_name"] is None or isinstance(data["full_name"], str)

        # Always these types
        assert isinstance(data["roles"], list)
        assert isinstance(data["is_admin"], bool)


class TestGetUserInfo:
    """Test cases for GET /api/v1/users/{user_id} endpoint."""

    def test_get_own_user_info(self, authenticated_client, mock_current_user):
        """
        Test getting own user info by ID.

        Should return full user information from token.
        """
        user_id = mock_current_user["sub"]
        response = authenticated_client.get(f"/api/v1/users/{user_id}")

        assert response.status_code == 200
        data = response.json()

        # Should return full info for own user
        assert data["id"] == user_id
        assert data["email"] == mock_current_user["email"]
        assert data["name"] == mock_current_user["name"]
        assert data["full_name"] == mock_current_user["name"]
        assert data["roles"] == mock_current_user["roles"]
        assert data["is_admin"] == mock_current_user["is_admin"]

    def test_get_other_user_info(self, authenticated_client, mock_current_user):
        """
        Test getting other user's info.

        Should return minimal info with message (Keycloak integration pending).
        """
        other_user_id = "other-user-id-12345678-1234-1234-1234-123456789abc"
        response = authenticated_client.get(f"/api/v1/users/{other_user_id}")

        assert response.status_code == 200
        data = response.json()

        # Should return minimal info for other users
        assert data["id"] == other_user_id
        assert data["email"] is None
        assert data["name"] is None
        assert data["full_name"] is None
        assert "Keycloak Admin API" in data["message"]

    def test_get_user_info_without_auth(self, client):
        """
        Test getting user info without authentication.

        Should return 403 Forbidden.
        """
        response = client.get("/api/v1/users/test-user-id")

        assert response.status_code == 403

    def test_get_user_info_admin_viewing_other(self, admin_client, mock_admin_user):
        """
        Test admin viewing other user's info.

        Should return minimal info (same as regular user).
        """
        other_user_id = "other-user-id"
        response = admin_client.get(f"/api/v1/users/{other_user_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == other_user_id
        assert data["email"] is None
        assert "Keycloak Admin API" in data["message"]

    def test_get_user_info_admin_viewing_self(self, admin_client, mock_admin_user):
        """
        Test admin viewing own info.

        Should return full admin user information.
        """
        admin_id = mock_admin_user["sub"]
        response = admin_client.get(f"/api/v1/users/{admin_id}")

        assert response.status_code == 200
        data = response.json()

        assert data["id"] == admin_id
        assert data["email"] == mock_admin_user["email"]
        assert data["is_admin"] is True

    def test_get_user_info_various_id_formats(self, authenticated_client, mock_current_user):
        """
        Test user info retrieval with various ID formats.

        Should handle different UUID and ID formats.
        """
        # Own user with UUID format
        user_id = mock_current_user["sub"]
        response = authenticated_client.get(f"/api/v1/users/{user_id}")
        assert response.status_code == 200

        # Other user with different format
        response = authenticated_client.get("/api/v1/users/user-123")
        assert response.status_code == 200

        # UUID format for other user
        response = authenticated_client.get(
            "/api/v1/users/12345678-1234-1234-1234-123456789abc"
        )
        assert response.status_code == 200

    def test_get_user_info_special_characters_in_id(self, authenticated_client):
        """
        Test user info with special characters in user ID.

        Should handle URL-encoded characters.
        """
        # User ID with URL-safe characters
        response = authenticated_client.get("/api/v1/users/user_id-123.456")
        assert response.status_code == 200

    def test_get_user_info_response_fields(self, authenticated_client, mock_current_user):
        """
        Test that response includes all expected fields.

        Validates response structure for both own and other users.
        """
        # Own user
        user_id = mock_current_user["sub"]
        response = authenticated_client.get(f"/api/v1/users/{user_id}")
        data = response.json()

        assert "id" in data
        assert "email" in data
        assert "name" in data
        assert "full_name" in data
        assert "roles" in data
        assert "is_admin" in data

        # Other user
        response = authenticated_client.get("/api/v1/users/other-user")
        data = response.json()

        assert "id" in data
        assert "email" in data
        assert "name" in data
        assert "full_name" in data
        assert "message" in data

    def test_get_user_info_idempotency(self, authenticated_client, mock_current_user):
        """
        Test that multiple requests return same data.

        Should be idempotent.
        """
        user_id = mock_current_user["sub"]

        response1 = authenticated_client.get(f"/api/v1/users/{user_id}")
        response2 = authenticated_client.get(f"/api/v1/users/{user_id}")

        assert response1.status_code == 200
        assert response2.status_code == 200
        assert response1.json() == response2.json()

    def test_get_user_info_empty_id(self, authenticated_client):
        """
        Test user info retrieval with empty user ID.

        Should return 404 or redirect to users list.
        """
        response = authenticated_client.get("/api/v1/users/")

        # Empty ID should either 404 or not match the route
        assert response.status_code in [404, 405]

    def test_get_user_info_very_long_id(self, authenticated_client):
        """
        Test user info with very long user ID.

        Should handle long IDs without errors.
        """
        long_id = "a" * 200
        response = authenticated_client.get(f"/api/v1/users/{long_id}")

        # Should return minimal info (not own user)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == long_id
        assert data["email"] is None


class TestUsersEndpointsIntegration:
    """Integration tests for user endpoints."""

    def test_me_and_user_id_consistency(self, authenticated_client, mock_current_user):
        """
        Test that /me and /{user_id} return consistent data.

        When user_id is own ID, data should match /me endpoint.
        """
        # Get data from /me
        me_response = authenticated_client.get("/api/v1/users/me")
        me_data = me_response.json()

        # Get data from /{user_id} with own ID
        user_id = mock_current_user["sub"]
        user_response = authenticated_client.get(f"/api/v1/users/{user_id}")
        user_data = user_response.json()

        # Should be the same
        assert me_data["id"] == user_data["id"]
        assert me_data["email"] == user_data["email"]
        assert me_data["name"] == user_data["name"]
        assert me_data["roles"] == user_data["roles"]
        assert me_data["is_admin"] == user_data["is_admin"]

    def test_search_and_user_info_workflow(self, authenticated_client):
        """
        Test typical workflow: search users, then get info.

        Simulates real-world usage pattern.
        """
        # Search for users
        search_response = authenticated_client.get(
            "/api/v1/users/search",
            params={"q": "test"}
        )
        assert search_response.status_code == 200

        # Even though search returns empty, try to get own info
        me_response = authenticated_client.get("/api/v1/users/me")
        assert me_response.status_code == 200
        user_id = me_response.json()["id"]

        # Get detailed info
        info_response = authenticated_client.get(f"/api/v1/users/{user_id}")
        assert info_response.status_code == 200

    def test_different_users_see_different_data(
        self, client, create_mock_user, mock_current_user
    ):
        """
        Test that different authenticated users see their own data.

        Verifies proper user isolation.
        """
        # First user
        user1 = mock_current_user

        async def override_user1(*args, **kwargs):
            return user1

        app.dependency_overrides[get_current_user] = override_user1

        try:
            response1 = client.get(
                "/api/v1/users/me",
                headers={"Authorization": "Bearer user1-token"}
            )
            data1 = response1.json()

            # Second user
            user2 = create_mock_user(
                email="user2@example.com",
                name="User Two",
            )

            async def override_user2(*args, **kwargs):
                return user2

            app.dependency_overrides[get_current_user] = override_user2

            response2 = client.get(
                "/api/v1/users/me",
                headers={"Authorization": "Bearer user2-token"}
            )
            data2 = response2.json()

            # Should be different users
            assert data1["id"] != data2["id"]
            assert data1["email"] != data2["email"]
            assert data1["name"] != data2["name"]
        finally:
            app.dependency_overrides.clear()

    def test_permissions_not_elevated_through_endpoints(
        self, authenticated_client, admin_client, mock_current_user, mock_admin_user
    ):
        """
        Test that regular users can't elevate permissions.

        Regular user should not become admin through any endpoint.
        """
        # Regular user
        response = authenticated_client.get("/api/v1/users/me")
        data = response.json()
        assert data["is_admin"] is False
        assert "admin" not in data["roles"]

        # Admin user
        admin_response = admin_client.get("/api/v1/users/me")
        admin_data = admin_response.json()
        assert admin_data["is_admin"] is True
        assert "admin" in admin_data["roles"]

        # Regular user still can't see admin info
        response = authenticated_client.get("/api/v1/users/me")
        data = response.json()
        assert data["is_admin"] is False
