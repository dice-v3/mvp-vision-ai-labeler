"""
Service JWT Authentication (Phase 16.5)

Handles Hybrid JWT authentication for Platform-to-Labeler communication.
Shares SERVICE_JWT_SECRET with Platform for seamless service integration.

JWT Payload Structure:
{
    "sub": "123",              # user_id (string)
    "service": "platform",      # service name
    "scopes": ["labeler:read"], # permissions
    "type": "service",          # token type
    "iat": timestamp,
    "exp": timestamp,           # 5min for user requests, 1h for background
}

Scopes:
- labeler:read    -> GET operations
- labeler:write   -> POST/PUT operations
- labeler:delete  -> DELETE operations
"""

from datetime import datetime
from typing import Dict, Any, List, Optional

from fastapi import HTTPException, status, Header, Depends
import jwt
from jwt import PyJWTError

from app.core.config import settings


# =============================================================================
# JWT Verification
# =============================================================================

def verify_service_jwt(token: str) -> Dict[str, Any]:
    """
    Verify Hybrid JWT token from Platform service.

    Args:
        token: JWT token string (without "Bearer " prefix)

    Returns:
        Decoded JWT payload

    Raises:
        HTTPException: If token is invalid, expired, or malformed
    """
    try:
        payload = jwt.decode(
            token,
            settings.SERVICE_JWT_SECRET,
            algorithms=[settings.SERVICE_JWT_ALGORITHM],
        )
        return payload
    except PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid service token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def validate_service_jwt_payload(payload: Dict[str, Any]) -> None:
    """
    Validate JWT payload structure and required fields.

    Args:
        payload: Decoded JWT payload

    Raises:
        HTTPException: If payload is missing required fields or invalid
    """
    # Check required fields
    required_fields = ["sub", "service", "type", "scopes"]
    missing_fields = [field for field in required_fields if field not in payload]

    if missing_fields:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Missing required fields in JWT: {', '.join(missing_fields)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate type field
    if payload["type"] != "service":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token type: {payload['type']} (expected 'service')",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate service field
    if payload["service"] != "platform":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid service: {payload['service']} (expected 'platform')",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Validate scopes is a list
    if not isinstance(payload["scopes"], list):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Scopes must be a list",
            headers={"WWW-Authenticate": "Bearer"},
        )


def extract_user_id_from_jwt(payload: Dict[str, Any]) -> int:
    """
    Extract user_id from JWT payload.

    Args:
        payload: Decoded JWT payload

    Returns:
        User ID as integer

    Raises:
        HTTPException: If user_id is missing or invalid
    """
    user_id_str = payload.get("sub")

    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing user_id in JWT",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid user_id in JWT: {user_id_str}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def check_jwt_scopes(payload: Dict[str, Any], required_scopes: List[str]) -> None:
    """
    Check if JWT has required scopes.

    Args:
        payload: Decoded JWT payload
        required_scopes: List of required scopes (e.g., ["labeler:read"])

    Raises:
        HTTPException: If JWT lacks required scopes
    """
    token_scopes = payload.get("scopes", [])

    missing_scopes = [scope for scope in required_scopes if scope not in token_scopes]

    if missing_scopes:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Missing required scopes: {', '.join(missing_scopes)}",
        )


# =============================================================================
# FastAPI Dependencies
# =============================================================================

async def get_service_jwt_payload(
    authorization: str = Header(..., description="Bearer token from Platform service")
) -> Dict[str, Any]:
    """
    FastAPI dependency to extract and verify service JWT from Authorization header.

    Args:
        authorization: Authorization header value (e.g., "Bearer eyJ...")

    Returns:
        Decoded and validated JWT payload

    Raises:
        HTTPException: If token is missing, invalid, or malformed

    Usage:
        @router.get("/datasets/{dataset_id}")
        async def get_dataset(
            dataset_id: str,
            jwt_payload: Dict = Depends(get_service_jwt_payload),
        ):
            user_id = extract_user_id_from_jwt(jwt_payload)
            ...
    """
    # Extract token from "Bearer <token>"
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format (expected 'Bearer <token>')",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization[7:]  # Remove "Bearer " prefix

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify and decode JWT
    payload = verify_service_jwt(token)

    # Validate payload structure
    validate_service_jwt_payload(payload)

    return payload


def require_service_scope(*required_scopes: str):
    """
    Dependency factory to check service JWT scopes.

    Args:
        *required_scopes: Required scopes (e.g., "labeler:read", "labeler:write")

    Returns:
        FastAPI dependency function that validates scopes

    Usage:
        @router.get("/datasets/{dataset_id}")
        async def get_dataset(
            dataset_id: str,
            jwt_payload: Dict = Depends(get_service_jwt_payload),
            _scope: Dict = Depends(require_service_scope("labeler:read")),
        ):
            user_id = extract_user_id_from_jwt(jwt_payload)
            ...

        @router.post("/datasets/{dataset_id}/download-url")
        async def download_dataset(
            dataset_id: str,
            jwt_payload: Dict = Depends(get_service_jwt_payload),
            _scope: Dict = Depends(require_service_scope("labeler:read", "labeler:write")),
        ):
            ...
    """
    async def check_scopes(
        jwt_payload: Dict[str, Any] = Depends(get_service_jwt_payload)
    ) -> Dict[str, Any]:
        """Check if JWT has required scopes."""
        check_jwt_scopes(jwt_payload, list(required_scopes))
        return jwt_payload

    return check_scopes


# =============================================================================
# User Context for Database Queries
# =============================================================================

async def get_service_user_id(
    jwt_payload: Dict[str, Any] = Depends(get_service_jwt_payload)
) -> int:
    """
    FastAPI dependency to extract user_id from service JWT.

    This is useful when you need the user_id directly without the full payload.

    Args:
        jwt_payload: Decoded JWT payload from get_service_jwt_payload

    Returns:
        User ID as integer

    Usage:
        @router.get("/datasets/{dataset_id}")
        async def get_dataset(
            dataset_id: str,
            user_id: int = Depends(get_service_user_id),
            db: Session = Depends(get_labeler_db),
        ):
            # Use user_id for permission checks
            ...
    """
    return extract_user_id_from_jwt(jwt_payload)
