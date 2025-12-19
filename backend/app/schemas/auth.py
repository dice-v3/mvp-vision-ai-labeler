"""Authentication schemas for Keycloak OIDC."""

from typing import Optional, List
from pydantic import BaseModel, EmailStr


class KeycloakUserResponse(BaseModel):
    """User information from Keycloak token."""
    sub: str  # Keycloak user ID (UUID)
    email: Optional[str] = None
    email_verified: bool = False
    name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    preferred_username: Optional[str] = None
    roles: List[str] = []
    is_admin: bool = False

    class Config:
        from_attributes = True


# Alias for backward compatibility
UserResponse = KeycloakUserResponse
