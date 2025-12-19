"""Authentication endpoints.

Keycloak handles all authentication. This module only provides
the /me endpoint to retrieve current user info from token.
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.schemas.auth import KeycloakUserResponse

router = APIRouter()


@router.get("/me", response_model=KeycloakUserResponse, tags=["Authentication"])
async def get_current_user_info(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get current user information from Keycloak token.

    Requires valid Keycloak access token in Authorization header.

    Returns user info extracted from the token:
    - sub: Keycloak user ID (UUID)
    - email: User email
    - name: Full name
    - roles: List of assigned roles
    - is_admin: Whether user has admin role
    """
    return KeycloakUserResponse(**current_user)
