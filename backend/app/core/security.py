"""
Security & Authentication

Handles Keycloak OIDC token validation and user authentication.
"""

from typing import Dict, Any
import jwt

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_labeler_db
from app.core.keycloak import keycloak_auth


# JWT Bearer token
security = HTTPBearer()


# =============================================================================
# Authentication Dependencies
# =============================================================================

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict[str, Any]:
    """
    Dependency to get current authenticated user from Keycloak token.

    Validates JWT token issued by Keycloak and extracts user information.

    Usage:
        @app.get("/me")
        def get_me(current_user = Depends(get_current_user)):
            return current_user

    Returns:
        User info dictionary with fields:
        - sub: Keycloak user ID (UUID)
        - email: User email
        - name: Full name
        - roles: List of roles
        - is_admin: Whether user has admin role
    """
    token = credentials.credentials

    try:
        payload = keycloak_auth.verify_token(token)
        user_info = keycloak_auth.get_user_info_from_token(payload)
        return user_info

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidIssuerError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token issuer",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_active_user(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Dependency to get current active user.

    Usage:
        @app.get("/protected")
        def protected_route(current_user = Depends(get_current_active_user)):
            return {"user": current_user["email"]}
    """
    # Keycloak handles user active status
    # If token is valid, user is considered active
    return current_user


async def get_current_admin_user(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Dependency to get current admin user.

    Raises 403 if user does not have admin role in Keycloak.

    Usage:
        @app.delete("/datasets/{id}")
        def delete_dataset(
            id: str,
            current_user = Depends(get_current_admin_user)
        ):
            # Only admins can delete
            pass
    """
    if not current_user.get("is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


# =============================================================================
# Dataset Permission Middleware
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
    """
    async def check_permission(
        dataset_id: str,
        current_user: Dict[str, Any] = Depends(get_current_user),
        labeler_db: Session = Depends(get_labeler_db),
    ):
        from app.db.models.labeler import DatasetPermission

        # Use Keycloak user ID (sub) for permission lookup
        user_id = current_user.get("sub")

        permission = (
            labeler_db.query(DatasetPermission)
            .filter(
                DatasetPermission.dataset_id == dataset_id,
                DatasetPermission.user_id == user_id,
            )
            .first()
        )

        if not permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have access to dataset {dataset_id}",
            )

        if required_role == "owner" and permission.role != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Owner permission required",
            )

        return permission

    return check_permission


# =============================================================================
# Project Permission Middleware (Phase 8.1)
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
    """
    async def check_permission(
        project_id: str,
        current_user: Dict[str, Any] = Depends(get_current_user),
        labeler_db: Session = Depends(get_labeler_db),
    ):
        from app.db.models.labeler import ProjectPermission, AnnotationProject

        # Use Keycloak user ID (sub) for permission lookup
        user_id = current_user.get("sub")

        # Support both dataset_id (ds_xxx) and project_id (proj_xxx)
        actual_project_id = project_id
        if project_id.startswith('ds_'):
            project = (
                labeler_db.query(AnnotationProject)
                .filter(AnnotationProject.dataset_id == project_id)
                .first()
            )
            if project:
                actual_project_id = project.id

        permission = (
            labeler_db.query(ProjectPermission)
            .filter(
                ProjectPermission.project_id == actual_project_id,
                ProjectPermission.user_id == user_id,
            )
            .first()
        )

        if not permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have access to project {project_id}",
            )

        user_role_level = ROLE_HIERARCHY.get(permission.role, 0)
        required_role_level = ROLE_HIERARCHY.get(required_role, 0)

        if user_role_level < required_role_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required role: {required_role}, your role: {permission.role}",
            )

        return permission

    return check_permission
