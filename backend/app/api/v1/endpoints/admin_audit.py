"""
Admin Audit Log API for Phase 15 - Admin Dashboard

Provides admin-only endpoints for viewing and managing audit logs.

Endpoints:
- GET /api/v1/admin/audit-logs - List audit logs (paginated, filtered)
- GET /api/v1/admin/audit-logs/{id} - Get audit log detail
- GET /api/v1/admin/audit-logs/stats - Get audit log statistics

All endpoints require admin privileges (system_role = 'admin').
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, and_
from sqlalchemy.orm import Session

from app.core.security import get_current_admin_user
from app.core.database import get_labeler_db, get_user_db
from app.db.models.user import User
from app.db.models.labeler import AuditLog
from app.services.audit_service import get_recent_audit_logs, get_audit_log_count


router = APIRouter()


# =============================================================================
# Audit Log Query Endpoints
# =============================================================================

@router.get("", response_model=Dict[str, Any])
async def list_audit_logs(
    limit: int = Query(default=50, ge=1, le=500, description="Number of logs per page"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    user_id: Optional[int] = Query(default=None, description="Filter by user ID"),
    action: Optional[str] = Query(default=None, description="Filter by action type"),
    resource_type: Optional[str] = Query(default=None, description="Filter by resource type"),
    status: Optional[str] = Query(default=None, description="Filter by status (success/failure/error)"),
    start_date: Optional[datetime] = Query(default=None, description="Start date for time range filter"),
    end_date: Optional[datetime] = Query(default=None, description="End date for time range filter"),
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get paginated list of audit logs with optional filters.

    Requires admin privileges.

    Args:
        limit: Number of logs per page (1-500, default 50)
        offset: Pagination offset (default 0)
        user_id: Filter by user ID
        action: Filter by action type (e.g., 'create', 'update', 'delete')
        resource_type: Filter by resource type (e.g., 'dataset', 'project')
        status: Filter by status ('success', 'failure', 'error')
        start_date: Start date for time range filter
        end_date: End date for time range filter

    Returns:
        {
            "total": 1234,
            "limit": 50,
            "offset": 0,
            "items": [...]
        }
    """
    # Build query with filters
    query = labeler_db.query(AuditLog)

    # Apply filters
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)
    if status:
        query = query.filter(AuditLog.status == status)
    if start_date:
        query = query.filter(AuditLog.timestamp >= start_date)
    if end_date:
        query = query.filter(AuditLog.timestamp <= end_date)

    # Get total count
    total = query.count()

    # Apply pagination and ordering
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset).all()

    # Enrich with user emails (cross-DB query)
    items = []
    for log in logs:
        item = {
            "id": log.id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "user_id": log.user_id,
            "user_email": None,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "ip_address": str(log.ip_address) if log.ip_address else None,
            "user_agent": log.user_agent,
            "session_id": log.session_id,
            "status": log.status,
            "error_message": log.error_message,
        }

        # Get user email from User DB
        if log.user_id:
            user = user_db.query(User).filter(User.id == log.user_id).first()
            if user:
                item["user_email"] = user.email

        items.append(item)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": items,
    }


@router.get("/{log_id}", response_model=Dict[str, Any])
async def get_audit_log_detail(
    log_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get detailed information for a specific audit log.

    Requires admin privileges.

    Args:
        log_id: Audit log ID

    Returns:
        Audit log with full details and user information

    Raises:
        404: Audit log not found
    """
    log = labeler_db.query(AuditLog).filter(AuditLog.id == log_id).first()

    if not log:
        raise HTTPException(
            status_code=404,
            detail=f"Audit log {log_id} not found"
        )

    # Get user info if available
    user_email = None
    if log.user_id:
        user = user_db.query(User).filter(User.id == log.user_id).first()
        if user:
            user_email = user.email

    return {
        "id": log.id,
        "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        "user_id": log.user_id,
        "user_email": user_email,
        "action": log.action,
        "resource_type": log.resource_type,
        "resource_id": log.resource_id,
        "details": log.details,
        "ip_address": str(log.ip_address) if log.ip_address else None,
        "user_agent": log.user_agent,
        "session_id": log.session_id,
        "status": log.status,
        "error_message": log.error_message,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


@router.get("/stats/summary", response_model=Dict[str, Any])
async def get_audit_log_stats(
    days: int = Query(default=7, ge=1, le=90, description="Number of days to analyze"),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get audit log statistics for the specified time period.

    Requires admin privileges.

    Args:
        days: Number of days to analyze (1-90, default 7)

    Returns:
        {
            "total_logs": 1234,
            "by_action": {"create": 500, "update": 400, ...},
            "by_status": {"success": 1200, "failure": 30, "error": 4},
            "by_resource_type": {"dataset": 300, "project": 200, ...},
            "unique_users": 15,
            "time_range": {"start": "...", "end": "..."}
        }
    """
    # Calculate time range
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    # Total logs in time range
    total_logs = labeler_db.query(AuditLog).filter(
        AuditLog.timestamp >= start_date
    ).count()

    # Logs by action
    by_action = {}
    action_counts = labeler_db.query(
        AuditLog.action,
        func.count(AuditLog.id)
    ).filter(
        AuditLog.timestamp >= start_date
    ).group_by(AuditLog.action).all()

    for action, count in action_counts:
        by_action[action] = count

    # Logs by status
    by_status = {}
    status_counts = labeler_db.query(
        AuditLog.status,
        func.count(AuditLog.id)
    ).filter(
        AuditLog.timestamp >= start_date
    ).group_by(AuditLog.status).all()

    for status, count in status_counts:
        by_status[status] = count

    # Logs by resource type
    by_resource_type = {}
    resource_counts = labeler_db.query(
        AuditLog.resource_type,
        func.count(AuditLog.id)
    ).filter(
        and_(
            AuditLog.timestamp >= start_date,
            AuditLog.resource_type.isnot(None)
        )
    ).group_by(AuditLog.resource_type).all()

    for resource_type, count in resource_counts:
        by_resource_type[resource_type] = count

    # Unique users
    unique_users = labeler_db.query(
        func.count(func.distinct(AuditLog.user_id))
    ).filter(
        and_(
            AuditLog.timestamp >= start_date,
            AuditLog.user_id.isnot(None)
        )
    ).scalar() or 0

    return {
        "total_logs": total_logs,
        "by_action": by_action,
        "by_status": by_status,
        "by_resource_type": by_resource_type,
        "unique_users": unique_users,
        "time_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days,
        }
    }


# =============================================================================
# Action and Resource Type Enums
# =============================================================================

@router.get("/meta/actions", response_model=List[str])
async def get_available_actions(
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get list of all action types that have been logged.

    Requires admin privileges.

    Returns:
        List of action types (e.g., ['create', 'update', 'delete', 'login', ...])
    """
    actions = labeler_db.query(AuditLog.action).distinct().all()
    return [action[0] for action in actions if action[0]]


@router.get("/meta/resource-types", response_model=List[str])
async def get_available_resource_types(
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get list of all resource types that have been logged.

    Requires admin privileges.

    Returns:
        List of resource types (e.g., ['dataset', 'project', 'annotation', ...])
    """
    resource_types = labeler_db.query(AuditLog.resource_type).distinct().all()
    return [rt[0] for rt in resource_types if rt[0]]
