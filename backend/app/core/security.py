"""
Security & Authentication

Handles JWT token validation and user authentication.
Shares JWT secret with the Platform for seamless authentication.
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_platform_db, get_labeler_db


# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Bearer token
security = HTTPBearer()


# =============================================================================
# Password Utilities
# =============================================================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Generate password hash."""
    return pwd_context.hash(password)


# =============================================================================
# JWT Token Utilities
# =============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token.

    Args:
        data: Payload data (typically user_id, email, etc.)
        expires_delta: Token expiration time

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """
    Decode and validate JWT token.

    Args:
        token: JWT token string

    Returns:
        Decoded token payload

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# =============================================================================
# Authentication Dependencies
# =============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_platform_db),
):
    """
    Dependency to get current authenticated user.

    Validates JWT token and retrieves user from Platform database.

    Usage:
        @app.get("/me")
        def get_me(current_user = Depends(get_current_user)):
            return current_user
    """
    token = credentials.credentials
    payload = decode_access_token(token)

    user_id: int = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Import here to avoid circular imports
    from app.db.models.platform import User

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user


async def get_current_active_user(
    current_user = Depends(get_current_user),
):
    """
    Dependency to get current active user.

    Usage:
        @app.get("/protected")
        def protected_route(current_user = Depends(get_current_active_user)):
            return {"user": current_user.email}
    """
    return current_user


async def get_current_admin_user(
    current_user = Depends(get_current_user),
):
    """
    Dependency to get current admin user.

    Raises 403 if user is not an admin.

    Usage:
        @app.delete("/datasets/{id}")
        def delete_dataset(
            id: str,
            current_user = Depends(get_current_admin_user)
        ):
            # Only admins can delete
            pass
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


# =============================================================================
# Dataset Permission Middleware (2025-11-21)
# =============================================================================

def require_dataset_permission(required_role: str = "member"):
    """
    Dependency factory to check dataset permissions.

    Args:
        required_role: Required permission role ('owner' or 'member')
                      - 'owner': Only dataset owner can access
                      - 'member': Dataset owner or members can access

    Returns:
        Dependency function that validates dataset access

    Usage:
        @router.delete("/datasets/{dataset_id}")
        async def delete_dataset(
            dataset_id: str,
            current_user = Depends(get_current_user),
            _permission = Depends(require_dataset_permission("owner")),
        ):
            # Only owners can delete
            pass

        @router.get("/datasets/{dataset_id}/images")
        async def list_images(
            dataset_id: str,
            current_user = Depends(get_current_user),
            _permission = Depends(require_dataset_permission("member")),
        ):
            # Owners and members can view
            pass
    """
    async def check_permission(
        dataset_id: str,
        current_user = Depends(get_current_user),
        labeler_db: Session = Depends(get_labeler_db),
    ):
        # Import here to avoid circular imports
        from app.db.models.labeler import DatasetPermission

        # Check if user has permission
        permission = (
            labeler_db.query(DatasetPermission)
            .filter(
                DatasetPermission.dataset_id == dataset_id,
                DatasetPermission.user_id == current_user.id,
            )
            .first()
        )

        if not permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have access to dataset {dataset_id}",
            )

        # Check role requirement
        if required_role == "owner" and permission.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Owner permission required",
            )

        return permission

    return check_permission
