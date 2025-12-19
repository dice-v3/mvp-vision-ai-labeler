"""
User Endpoints - Keycloak Integration

User search and info endpoints.
Note: User data now comes from Keycloak, not User DB.
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_user

router = APIRouter()


@router.get("/search", tags=["Users"])
async def search_users(
    q: str = Query(..., min_length=1, description="Search query (email or name)"),
    limit: int = Query(10, ge=1, le=50, description="Results per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Search users - Currently not available.

    User search requires Keycloak Admin API integration.
    For now, returns empty results.
    """
    # TODO: Implement Keycloak Admin API user search
    return {
        "users": [],
        "total": 0,
        "limit": limit,
        "offset": offset,
        "message": "User search requires Keycloak Admin API integration"
    }


@router.get("/me", tags=["Users"])
async def get_current_user_info(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get current user information from Keycloak token.
    """
    return {
        "id": current_user.get("sub"),
        "email": current_user.get("email"),
        "name": current_user.get("name"),
        "full_name": current_user.get("name"),
        "roles": current_user.get("roles", []),
        "is_admin": current_user.get("is_admin", False),
    }


@router.get("/{user_id}", tags=["Users"])
async def get_user_info(
    user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get user information by ID.

    Currently returns minimal info. Full implementation requires
    Keycloak Admin API integration.
    """
    # If requesting own info, return from token
    if user_id == current_user.get("sub"):
        return {
            "id": current_user.get("sub"),
            "email": current_user.get("email"),
            "name": current_user.get("name"),
            "full_name": current_user.get("name"),
            "roles": current_user.get("roles", []),
            "is_admin": current_user.get("is_admin", False),
        }

    # TODO: Implement Keycloak Admin API for other users
    return {
        "id": user_id,
        "email": None,
        "name": None,
        "full_name": None,
        "message": "User lookup requires Keycloak Admin API integration"
    }
