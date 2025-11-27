"""
Security & Authentication

Handles JWT token validation and user authentication.
Shares JWT secret with the Platform for seamless authentication.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_platform_db, get_user_db, get_labeler_db


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
# User Caching for Performance
# =============================================================================

# In-memory user cache with TTL
# Format: {user_id: (user_object, expiry_timestamp)}
_user_cache: Dict[int, Tuple[any, datetime]] = {}
USER_CACHE_TTL = 30  # seconds


def _get_cached_user(user_id: int):
    """Get user from cache if not expired."""
    if user_id in _user_cache:
        user_obj, expiry = _user_cache[user_id]
        if datetime.utcnow() < expiry:
            return user_obj
        else:
            # Remove expired entry
            del _user_cache[user_id]
    return None


def _cache_user(user_id: int, user_obj):
    """Cache user object with TTL."""
    expiry = datetime.utcnow() + timedelta(seconds=USER_CACHE_TTL)
    _user_cache[user_id] = (user_obj, expiry)


# =============================================================================
# Authentication Dependencies
# =============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_user_db),
):
    """
    Dependency to get current authenticated user.

    Phase 9: Validates JWT token and retrieves user from User database (PostgreSQL).

    Performance: Uses in-memory cache with 30-second TTL to reduce DB queries.

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

    # Check cache first
    cached_user = _get_cached_user(user_id)
    if cached_user is not None:
        return cached_user

    # Import here to avoid circular imports
    from app.db.models.user import User

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

    # Cache user for future requests
    _cache_user(user_id, user)

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


# =============================================================================
# Project Permission Middleware (Phase 8.1 - 2025-11-23)
# =============================================================================

# Role hierarchy: owner > admin > reviewer > annotator > viewer
ROLE_HIERARCHY = {
    'owner': 5,
    'admin': 4,
    'reviewer': 3,
    'annotator': 2,
    'viewer': 1,
}


def require_project_permission(required_role: str = "viewer"):
    """
    Dependency factory to check project permissions with role hierarchy.

    Args:
        required_role: Minimum required permission role
                      - 'owner': Full control (delete dataset, manage all)
                      - 'admin': Manage members, classes, review
                      - 'reviewer': Annotate + review others' work
                      - 'annotator': Annotate own work only
                      - 'viewer': Read-only access

    Role hierarchy: owner > admin > reviewer > annotator > viewer
    Higher roles automatically have lower role permissions.

    Returns:
        Dependency function that validates project access

    Usage:
        @router.delete("/projects/{project_id}")
        async def delete_project(
            project_id: str,
            current_user = Depends(get_current_user),
            _permission = Depends(require_project_permission("owner")),
        ):
            # Only owners can delete
            pass

        @router.post("/projects/{project_id}/annotations")
        async def create_annotation(
            project_id: str,
            current_user = Depends(get_current_user),
            _permission = Depends(require_project_permission("annotator")),
        ):
            # Annotators and above can create annotations
            pass
    """
    async def check_permission(
        project_id: str,
        current_user = Depends(get_current_user),
        labeler_db: Session = Depends(get_labeler_db),
    ):
        # Import here to avoid circular imports
        from app.db.models.labeler import ProjectPermission, AnnotationProject

        # Support both dataset_id (ds_xxx) and project_id (proj_xxx)
        # If project_id starts with 'ds_', it's a dataset_id, find the actual project
        actual_project_id = project_id
        if project_id.startswith('ds_'):
            project = (
                labeler_db.query(AnnotationProject)
                .filter(AnnotationProject.dataset_id == project_id)
                .first()
            )
            if project:
                actual_project_id = project.id

        # Check if user has permission
        permission = (
            labeler_db.query(ProjectPermission)
            .filter(
                ProjectPermission.project_id == actual_project_id,
                ProjectPermission.user_id == current_user.id,
            )
            .first()
        )

        if not permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have access to project {project_id}",
            )

        # Check role hierarchy
        user_role_level = ROLE_HIERARCHY.get(permission.role, 0)
        required_role_level = ROLE_HIERARCHY.get(required_role, 0)

        if user_role_level < required_role_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required role: {required_role}, your role: {permission.role}",
            )

        return permission

    return check_permission


# =============================================================================
# Service Account Authentication (Phase 16 - Platform Integration)
# =============================================================================

async def get_current_service_account(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_labeler_db),
):
    """
    Dependency to get current authenticated service account.

    Phase 16: Validates API key and retrieves service account from Labeler database.

    Service accounts authenticate using API keys in the format:
    Authorization: Bearer sa_{prefix}_{secret}

    Usage:
        @app.get("/api/v1/platform/datasets/{dataset_id}")
        def get_dataset_for_platform(
            dataset_id: str,
            service_account = Depends(get_current_service_account)
        ):
            return dataset_data

    Args:
        credentials: HTTP Bearer token credentials
        db: Database session (Labeler DB)

    Returns:
        ServiceAccount object

    Raises:
        HTTPException: If API key is invalid, expired, or inactive
    """
    from app.services.service_account_service import verify_api_key

    api_key = credentials.credentials

    # Verify API key
    service_account = verify_api_key(db, api_key)

    if not service_account:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not service_account.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Service account is inactive",
        )

    if service_account.is_expired:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Service account has expired",
        )

    return service_account


def require_scope(required_scope: str):
    """
    Dependency factory to check service account scope.

    Args:
        required_scope: Required scope (e.g., "datasets:read", "datasets:download")

    Returns:
        Dependency function that validates service account has the required scope

    Usage:
        @router.get("/platform/datasets/{dataset_id}")
        async def get_dataset(
            dataset_id: str,
            service_account = Depends(get_current_service_account),
            _scope = Depends(require_scope("datasets:read")),
        ):
            # Only service accounts with "datasets:read" scope can access
            return dataset_data

        @router.get("/platform/datasets/{dataset_id}/download")
        async def get_download_url(
            dataset_id: str,
            service_account = Depends(get_current_service_account),
            _scope = Depends(require_scope("datasets:download")),
        ):
            # Only service accounts with "datasets:download" scope can access
            return {"download_url": "..."}
    """
    async def check_scope(
        service_account = Depends(get_current_service_account),
    ):
        if not service_account.has_scope(required_scope):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Scope '{required_scope}' required. Your scopes: {', '.join(service_account.scopes or [])}",
            )
        return service_account

    return check_scope
