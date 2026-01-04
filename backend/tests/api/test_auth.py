"""
Tests for authentication endpoints.

Tests the /me endpoint including:
- Valid token authentication
- Invalid token handling
- Missing token handling
- Token claims extraction
"""

import pytest
from unittest.mock import patch
import jwt
from fastapi import HTTPException, status
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app


class TestGetCurrentUserInfo:
    """Test cases for GET /api/v1/auth/me endpoint."""

    def test_get_me_with_valid_token(self, authenticated_client, mock_current_user):
        """
        Test /me endpoint with valid authentication token.

        Should return user information extracted from valid JWT token.
        """
        response = authenticated_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        data = response.json()

        # Verify all expected fields are present
        assert data["sub"] == mock_current_user["sub"]
        assert data["email"] == mock_current_user["email"]
        assert data["name"] == mock_current_user["name"]
        assert data["given_name"] == mock_current_user["given_name"]
        assert data["family_name"] == mock_current_user["family_name"]
        assert data["preferred_username"] == mock_current_user["preferred_username"]
        assert data["email_verified"] == mock_current_user["email_verified"]
        assert data["roles"] == mock_current_user["roles"]
        assert data["is_admin"] == mock_current_user["is_admin"]

    def test_get_me_with_admin_user(self, admin_client, mock_admin_user):
        """
        Test /me endpoint with admin user token.

        Should return admin user information with is_admin=True.
        """
        response = admin_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        data = response.json()

        # Verify admin-specific fields
        assert data["sub"] == mock_admin_user["sub"]
        assert data["email"] == mock_admin_user["email"]
        assert data["is_admin"] is True
        assert "admin" in data["roles"]
        assert "user" in data["roles"]

    def test_get_me_without_token(self, client):
        """
        Test /me endpoint without authentication token.

        Should return 403 Forbidden when no Authorization header is provided.
        """
        response = client.get("/api/v1/auth/me")

        assert response.status_code == 403
        data = response.json()
        assert "detail" in data

    def test_get_me_with_expired_token(self, client):
        """
        Test /me endpoint with expired JWT token.

        Should return 401 Unauthorized with appropriate error message.
        """
        async def mock_expired_token(*args, **kwargs):
            raise jwt.ExpiredSignatureError("Token has expired")

        app.dependency_overrides[get_current_user] = mock_expired_token

        try:
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer expired-token"}
            )

            assert response.status_code == 401
            data = response.json()
            assert data["detail"] == "Token has expired"
        finally:
            app.dependency_overrides.clear()

    def test_get_me_with_invalid_token(self, client):
        """
        Test /me endpoint with invalid/malformed JWT token.

        Should return 401 Unauthorized.
        """
        async def mock_invalid_token(*args, **kwargs):
            raise jwt.InvalidTokenError("Invalid token")

        app.dependency_overrides[get_current_user] = mock_invalid_token

        try:
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer invalid-token"}
            )

            assert response.status_code == 401
            data = response.json()
            assert "Could not validate credentials" in data["detail"]
        finally:
            app.dependency_overrides.clear()

    def test_get_me_with_invalid_audience(self, client):
        """
        Test /me endpoint with token that has invalid audience.

        Should return 401 Unauthorized with audience error message.
        """
        async def mock_invalid_audience(*args, **kwargs):
            raise jwt.InvalidAudienceError("Invalid token audience")

        app.dependency_overrides[get_current_user] = mock_invalid_audience

        try:
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer token-wrong-audience"}
            )

            assert response.status_code == 401
            data = response.json()
            assert data["detail"] == "Invalid token audience"
        finally:
            app.dependency_overrides.clear()

    def test_get_me_with_invalid_issuer(self, client):
        """
        Test /me endpoint with token that has invalid issuer.

        Should return 401 Unauthorized with issuer error message.
        """
        async def mock_invalid_issuer(*args, **kwargs):
            raise jwt.InvalidIssuerError("Invalid token issuer")

        app.dependency_overrides[get_current_user] = mock_invalid_issuer

        try:
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer token-wrong-issuer"}
            )

            assert response.status_code == 401
            data = response.json()
            assert data["detail"] == "Invalid token issuer"
        finally:
            app.dependency_overrides.clear()

    def test_get_me_token_claims_extraction(self, authenticated_client, mock_current_user):
        """
        Test that all token claims are correctly extracted and returned.

        Verifies proper extraction of user information from token payload.
        """
        response = authenticated_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        data = response.json()

        # Verify UUID format for sub claim
        assert data["sub"] == mock_current_user["sub"]
        assert len(data["sub"]) > 0

        # Verify email claim
        assert data["email"] == "test@example.com"
        assert "@" in data["email"]

        # Verify name claims
        assert data["name"] == "Test User"
        assert data["given_name"] == "Test"
        assert data["family_name"] == "User"

        # Verify username claim
        assert data["preferred_username"] == "testuser"

        # Verify roles claim (should be a list)
        assert isinstance(data["roles"], list)
        assert "user" in data["roles"]

        # Verify admin flag
        assert isinstance(data["is_admin"], bool)
        assert data["is_admin"] is False

        # Verify email_verified claim
        assert isinstance(data["email_verified"], bool)

    def test_get_me_with_custom_roles(self, client, create_mock_user):
        """
        Test /me endpoint with user having custom roles.

        Verifies that custom role assignments are properly returned.
        """
        custom_user = create_mock_user(
            email="reviewer@example.com",
            name="Reviewer User",
            roles=["user", "reviewer", "annotator"],
            is_admin=False,
        )

        async def override_custom_user(*args, **kwargs):
            return custom_user

        app.dependency_overrides[get_current_user] = override_custom_user

        try:
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer custom-token"}
            )

            assert response.status_code == 200
            data = response.json()

            # Verify custom roles
            assert "user" in data["roles"]
            assert "reviewer" in data["roles"]
            assert "annotator" in data["roles"]
            assert len(data["roles"]) == 3

            # Verify still not admin
            assert data["is_admin"] is False
        finally:
            app.dependency_overrides.clear()

    def test_get_me_with_minimal_user_data(self, client):
        """
        Test /me endpoint with minimal user data (only required fields).

        Some tokens may not include all optional fields.
        """
        minimal_user = {
            "sub": "minimal-user-id",
            "email": None,
            "email_verified": False,
            "name": None,
            "given_name": None,
            "family_name": None,
            "preferred_username": None,
            "roles": [],
            "is_admin": False,
        }

        async def override_minimal_user(*args, **kwargs):
            return minimal_user

        app.dependency_overrides[get_current_user] = override_minimal_user

        try:
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer minimal-token"}
            )

            assert response.status_code == 200
            data = response.json()

            # Verify required fields
            assert data["sub"] == "minimal-user-id"
            assert data["is_admin"] is False
            assert data["email_verified"] is False

            # Verify optional fields are present but None/empty
            assert data["email"] is None
            assert data["name"] is None
            assert data["roles"] == []
        finally:
            app.dependency_overrides.clear()

    def test_get_me_authentication_error_handling(self, client):
        """
        Test /me endpoint with generic authentication error.

        Should handle unexpected authentication failures gracefully.
        """
        async def mock_auth_error(*args, **kwargs):
            raise Exception("Unexpected authentication error")

        app.dependency_overrides[get_current_user] = mock_auth_error

        try:
            response = client.get(
                "/api/v1/auth/me",
                headers={"Authorization": "Bearer error-token"}
            )

            assert response.status_code == 401
            data = response.json()
            assert "Authentication failed" in data["detail"]
        finally:
            app.dependency_overrides.clear()

    def test_get_me_response_model_validation(self, authenticated_client):
        """
        Test that response conforms to KeycloakUserResponse schema.

        Ensures all required fields are present and properly typed.
        """
        response = authenticated_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        data = response.json()

        # Required fields must be present
        required_fields = ["sub", "email_verified", "roles", "is_admin"]
        for field in required_fields:
            assert field in data, f"Required field '{field}' missing"

        # Optional fields should be present (even if None)
        optional_fields = ["email", "name", "given_name", "family_name", "preferred_username"]
        for field in optional_fields:
            assert field in data, f"Optional field '{field}' missing"

        # Type validation
        assert isinstance(data["sub"], str)
        assert isinstance(data["email_verified"], bool)
        assert isinstance(data["roles"], list)
        assert isinstance(data["is_admin"], bool)
