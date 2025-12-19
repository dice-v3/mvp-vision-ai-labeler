"""
Keycloak Authentication Module

Handles Keycloak OIDC token validation and user info extraction.
"""

import httpx
import jwt
from jwt import PyJWKClient
from typing import Optional, Dict, Any
from functools import lru_cache
from datetime import datetime, timedelta

from app.core.config import settings


class KeycloakAuth:
    """Keycloak authentication handler."""

    def __init__(
        self,
        server_url: str,
        realm: str,
        client_id: str,
        client_secret: str,
    ):
        self.server_url = server_url.rstrip("/")
        self.realm = realm
        self.client_id = client_id
        self.client_secret = client_secret
        self.issuer = f"{self.server_url}/realms/{self.realm}"
        self.jwks_uri = f"{self.issuer}/protocol/openid-connect/certs"
        self._jwks_client: Optional[PyJWKClient] = None
        self._jwks_cache_time: Optional[datetime] = None
        self._jwks_cache_ttl = timedelta(hours=1)

    def _get_jwks_client(self) -> PyJWKClient:
        """Get or create JWKS client with caching."""
        now = datetime.utcnow()

        # Refresh JWKS client if cache expired or not initialized
        if (
            self._jwks_client is None
            or self._jwks_cache_time is None
            or now - self._jwks_cache_time > self._jwks_cache_ttl
        ):
            self._jwks_client = PyJWKClient(self.jwks_uri)
            self._jwks_cache_time = now

        return self._jwks_client

    def verify_token(self, token: str) -> Dict[str, Any]:
        """
        Verify and decode Keycloak access token.

        Args:
            token: JWT access token from Keycloak

        Returns:
            Decoded token payload

        Raises:
            jwt.InvalidTokenError: If token is invalid
            jwt.ExpiredSignatureError: If token is expired
        """
        jwks_client = self._get_jwks_client()

        # Get signing key from JWKS
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and verify token
        # Note: audience verification is disabled because frontend and backend
        # use different client IDs. Issuer verification ensures the token is
        # from our Keycloak realm.
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=self.issuer,
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iss": True,
                "verify_aud": False,  # Frontend uses different client ID
            },
        )

        return payload

    def get_user_info_from_token(self, token_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract user information from token payload.

        Args:
            token_payload: Decoded JWT payload

        Returns:
            User info dictionary with standardized fields
        """
        # Extract realm roles
        realm_access = token_payload.get("realm_access", {})
        realm_roles = realm_access.get("roles", [])

        # Extract client roles
        resource_access = token_payload.get("resource_access", {})
        client_access = resource_access.get(self.client_id, {})
        client_roles = client_access.get("roles", [])

        # Combine all roles
        all_roles = list(set(realm_roles + client_roles))

        return {
            "sub": token_payload.get("sub"),  # Keycloak User ID (UUID)
            "email": token_payload.get("email"),
            "email_verified": token_payload.get("email_verified", False),
            "name": token_payload.get("name"),
            "given_name": token_payload.get("given_name"),
            "family_name": token_payload.get("family_name"),
            "preferred_username": token_payload.get("preferred_username"),
            "roles": all_roles,
            "is_admin": "admin" in all_roles,
        }

    async def get_user_info_async(self, access_token: str) -> Dict[str, Any]:
        """
        Fetch user info from Keycloak userinfo endpoint.

        Args:
            access_token: Valid access token

        Returns:
            User info from Keycloak
        """
        userinfo_url = f"{self.issuer}/protocol/openid-connect/userinfo"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                userinfo_url,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()


# Global Keycloak auth instance
keycloak_auth = KeycloakAuth(
    server_url=settings.KEYCLOAK_SERVER_URL,
    realm=settings.KEYCLOAK_REALM,
    client_id=settings.KEYCLOAK_CLIENT_ID,
    client_secret=settings.KEYCLOAK_CLIENT_SECRET,
)
