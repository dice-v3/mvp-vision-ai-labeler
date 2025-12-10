"""
Audit Service for Phase 15 - Admin Dashboard

Provides centralized audit logging for all system actions.
Stores audit logs in Labeler DB with async, non-blocking writes.

Features:
- Comprehensive action logging (CRUD, auth, permission changes)
- Async logging for performance (doesn't block requests)
- IP address and user agent tracking
- Session tracking
- Flexible JSONB details storage

Usage:
```python
from app.services.audit_service import log_action, log_create, log_update

# Log generic action
await log_action(
    user_id=user.id,
    action='dataset_export',
    resource_type='dataset',
    resource_id='ds_123',
    details={'format': 'COCO', 'size_mb': 45.2},
    request=request
)

# Log creation
await log_create(user.id, 'project', 'proj_456', {'name': 'New Project'})

# Log update
await log_update(user.id, 'annotation', 'ann_789', {
    'old_class': 'car',
    'new_class': 'truck'
})
```
"""

import asyncio
from datetime import datetime
from typing import Dict, Optional, Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.database import LabelerSessionLocal
from app.db.models.labeler import AuditLog


# =============================================================================
# Core Audit Logging Functions
# =============================================================================

async def log_action(
    user_id: Optional[int],
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
    status: str = "success",
    error_message: Optional[str] = None,
    session_id: Optional[str] = None,
) -> None:
    """
    Log an action to the audit log (async, non-blocking).

    Args:
        user_id: ID of user performing action (None for system events)
        action: Action type (e.g., 'create', 'update', 'delete', 'login')
        resource_type: Type of resource affected (e.g., 'dataset', 'project')
        resource_id: ID of the affected resource
        details: Additional context as JSONB
        request: FastAPI Request object (for IP, user agent)
        status: Action status ('success', 'failure', 'error')
        error_message: Error message if status is not success
        session_id: User session ID (JWT token or UUID)

    Note: This function is async and non-blocking. The actual DB write
    happens in a background task to avoid slowing down API responses.
    """
    # Extract metadata from request if provided
    ip_address = None
    user_agent = None

    if request:
        # Get client IP (handle proxies)
        ip_address = request.client.host if request.client else None

        # Handle X-Forwarded-For header (reverse proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip_address = forwarded_for.split(",")[0].strip()

        # Get user agent
        user_agent = request.headers.get("User-Agent")

    # Create audit log entry in background task
    asyncio.create_task(
        _write_audit_log(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
            session_id=session_id,
            status=status,
            error_message=error_message,
        )
    )


async def _write_audit_log(
    user_id: Optional[int],
    action: str,
    resource_type: Optional[str],
    resource_id: Optional[str],
    details: Optional[Dict[str, Any]],
    ip_address: Optional[str],
    user_agent: Optional[str],
    session_id: Optional[str],
    status: str,
    error_message: Optional[str],
) -> None:
    """
    Internal function to write audit log to database (async).

    This runs in a background task to avoid blocking the main request.
    """
    try:
        db = LabelerSessionLocal()
        try:
            audit_log = AuditLog(
                timestamp=datetime.utcnow(),
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
                ip_address=ip_address,
                user_agent=user_agent,
                session_id=session_id,
                status=status,
                error_message=error_message,
            )

            db.add(audit_log)
            db.commit()
        finally:
            db.close()
    except Exception as e:
        # Don't let audit logging failures break the application
        # Log to stderr but don't raise
        import sys
        print(f"[AUDIT ERROR] Failed to write audit log: {e}", file=sys.stderr)


# =============================================================================
# Convenience Functions for Common Actions
# =============================================================================

async def log_create(
    user_id: int,
    resource_type: str,
    resource_id: str,
    data: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Log a resource creation action.

    Args:
        user_id: ID of user creating the resource
        resource_type: Type of resource (e.g., 'dataset', 'project', 'annotation')
        resource_id: ID of the created resource
        data: Resource data (will be stored in details)
        request: FastAPI Request object
    """
    await log_action(
        user_id=user_id,
        action="create",
        resource_type=resource_type,
        resource_id=resource_id,
        details=data,
        request=request,
    )


async def log_update(
    user_id: int,
    resource_type: str,
    resource_id: str,
    changes: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Log a resource update action.

    Args:
        user_id: ID of user updating the resource
        resource_type: Type of resource
        resource_id: ID of the updated resource
        changes: Dict of changes (e.g., {'old_value': ..., 'new_value': ...})
        request: FastAPI Request object
    """
    await log_action(
        user_id=user_id,
        action="update",
        resource_type=resource_type,
        resource_id=resource_id,
        details=changes,
        request=request,
    )


async def log_delete(
    user_id: int,
    resource_type: str,
    resource_id: str,
    data: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Log a resource deletion action.

    Args:
        user_id: ID of user deleting the resource
        resource_type: Type of resource
        resource_id: ID of the deleted resource
        data: Resource data before deletion (for audit trail)
        request: FastAPI Request object
    """
    await log_action(
        user_id=user_id,
        action="delete",
        resource_type=resource_type,
        resource_id=resource_id,
        details=data,
        request=request,
    )


# =============================================================================
# Authentication Event Logging
# =============================================================================

async def log_login(
    user_id: int,
    session_id: str,
    request: Optional[Request] = None,
    success: bool = True,
) -> None:
    """
    Log a user login event.

    Args:
        user_id: ID of user logging in
        session_id: Session ID (JWT token or UUID)
        request: FastAPI Request object
        success: Whether login was successful
    """
    await log_action(
        user_id=user_id,
        action="login",
        resource_type="session",
        resource_id=session_id,
        session_id=session_id,
        request=request,
        status="success" if success else "failure",
    )


async def log_logout(
    user_id: int,
    session_id: str,
    request: Optional[Request] = None,
) -> None:
    """
    Log a user logout event.

    Args:
        user_id: ID of user logging out
        session_id: Session ID
        request: FastAPI Request object
    """
    await log_action(
        user_id=user_id,
        action="logout",
        resource_type="session",
        resource_id=session_id,
        session_id=session_id,
        request=request,
    )


# =============================================================================
# Permission Change Logging
# =============================================================================

async def log_permission_grant(
    user_id: int,
    target_user_id: int,
    project_id: str,
    role: str,
    request: Optional[Request] = None,
) -> None:
    """
    Log a permission grant action.

    Args:
        user_id: ID of user granting permission
        target_user_id: ID of user receiving permission
        project_id: Project ID
        role: Role being granted (owner/admin/reviewer/annotator/viewer)
        request: FastAPI Request object
    """
    await log_action(
        user_id=user_id,
        action="permission_grant",
        resource_type="project_permission",
        resource_id=project_id,
        details={
            "target_user_id": target_user_id,
            "role": role,
        },
        request=request,
    )


async def log_permission_revoke(
    user_id: int,
    target_user_id: int,
    project_id: str,
    request: Optional[Request] = None,
) -> None:
    """
    Log a permission revoke action.

    Args:
        user_id: ID of user revoking permission
        target_user_id: ID of user losing permission
        project_id: Project ID
        request: FastAPI Request object
    """
    await log_action(
        user_id=user_id,
        action="permission_revoke",
        resource_type="project_permission",
        resource_id=project_id,
        details={
            "target_user_id": target_user_id,
        },
        request=request,
    )


# =============================================================================
# Error Logging
# =============================================================================

async def log_error(
    user_id: Optional[int],
    action: str,
    error_message: str,
    details: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
) -> None:
    """
    Log an error event.

    Args:
        user_id: ID of user (None for system errors)
        action: Action that failed
        error_message: Error message
        details: Additional error context
        request: FastAPI Request object
    """
    await log_action(
        user_id=user_id,
        action=action,
        details=details,
        request=request,
        status="error",
        error_message=error_message,
    )


# =============================================================================
# Bulk Query Functions (for Admin Dashboard)
# =============================================================================

def get_recent_audit_logs(
    db: Session,
    limit: int = 100,
    offset: int = 0,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    status: Optional[str] = None,
) -> list[AuditLog]:
    """
    Retrieve recent audit logs with filters.

    Args:
        db: Database session
        limit: Maximum number of logs to return
        offset: Offset for pagination
        user_id: Filter by user ID
        action: Filter by action type
        resource_type: Filter by resource type
        status: Filter by status ('success', 'failure', 'error')

    Returns:
        List of AuditLog objects
    """
    query = db.query(AuditLog)

    # Apply filters
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if status:
        query = query.filter(AuditLog.status == status)

    # Order by timestamp descending (newest first)
    query = query.order_by(AuditLog.timestamp.desc())

    # Apply pagination
    query = query.limit(limit).offset(offset)

    return query.all()


def get_audit_log_count(
    db: Session,
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    status: Optional[str] = None,
) -> int:
    """
    Get total count of audit logs matching filters.

    Args:
        db: Database session
        user_id: Filter by user ID
        action: Filter by action type
        resource_type: Filter by resource type
        status: Filter by status

    Returns:
        Total count
    """
    query = db.query(AuditLog)

    # Apply same filters as get_recent_audit_logs
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if status:
        query = query.filter(AuditLog.status == status)

    return query.count()
