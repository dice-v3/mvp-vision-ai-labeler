"""
Admin System Statistics API for Phase 15 - Admin Dashboard

Provides admin-only endpoints for system-wide statistics and metrics.

Endpoints:
- GET /api/v1/admin/stats/overview - Comprehensive system overview
- GET /api/v1/admin/stats/users - User activity statistics
- GET /api/v1/admin/stats/resources - Resource usage statistics
- GET /api/v1/admin/stats/performance - Performance metrics
- GET /api/v1/admin/stats/sessions - Session statistics

All endpoints require admin privileges (system_role = 'admin').
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_admin_user
from app.core.database import get_labeler_db, get_user_db
from app.db.models.user import User
from app.services import system_stats_service


router = APIRouter()


# =============================================================================
# System Overview
# =============================================================================

@router.get("/overview", response_model=Dict[str, Any])
async def get_system_overview(
    days: int = Query(default=7, ge=1, le=90, description="Number of days for time-based metrics"),
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get comprehensive system overview statistics.

    Requires admin privileges.

    Args:
        days: Number of days for time-based metrics (1-90, default 7)

    Returns:
        Complete system statistics including:
        - User activity (total, active, new users)
        - Resource usage (datasets, images, annotations, storage)
        - Performance metrics (annotation rates, task distribution)
        - Session statistics (active sessions, duration)
    """
    return system_stats_service.get_system_overview(
        user_db=user_db,
        labeler_db=labeler_db,
        days=days
    )


# =============================================================================
# User Activity Statistics
# =============================================================================

@router.get("/users", response_model=Dict[str, Any])
async def get_user_activity_stats(
    days: int = Query(default=30, ge=1, le=90, description="Number of days to analyze"),
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get user activity statistics.

    Requires admin privileges.

    Args:
        days: Number of days to analyze (1-90, default 30)

    Returns:
        {
            "total_users": 42,
            "active_users_7d": 15,
            "active_users_30d": 25,
            "new_users_7d": 3,
            "new_users_30d": 8,
            "registration_trend": [...],
            "login_activity": {...}
        }
    """
    return system_stats_service.get_user_activity_stats(
        user_db=user_db,
        labeler_db=labeler_db,
        days=days
    )


# =============================================================================
# Resource Usage Statistics
# =============================================================================

@router.get("/resources", response_model=Dict[str, Any])
async def get_resource_usage_stats(
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get resource usage statistics.

    Requires admin privileges.

    Returns:
        {
            "datasets": {"total": 42, "by_status": {...}},
            "images": {"total": 125430},
            "annotations": {"total": 543210, "by_task_type": {...}, "recent_7d": 1234},
            "storage": {"total_bytes": 52428800000, "total_gb": 48.8}
        }
    """
    return system_stats_service.get_resource_usage_stats(
        labeler_db=labeler_db,
        user_db=user_db
    )


# =============================================================================
# Performance Metrics
# =============================================================================

@router.get("/performance", response_model=Dict[str, Any])
async def get_performance_metrics(
    days: int = Query(default=7, ge=1, le=90, description="Number of days to analyze"),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get performance metrics.

    Requires admin privileges.

    Args:
        days: Number of days to analyze (1-90, default 7)

    Returns:
        {
            "annotation_rate": {
                "daily": [...],
                "average_per_day": 123.45,
                "total_period": 864
            },
            "task_distribution": {...},
            "top_annotators": [...]
        }
    """
    return system_stats_service.get_performance_metrics(
        labeler_db=labeler_db,
        days=days
    )


# =============================================================================
# Session Statistics
# =============================================================================

@router.get("/sessions", response_model=Dict[str, Any])
async def get_session_stats(
    days: int = Query(default=7, ge=1, le=90, description="Number of days to analyze"),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get user session statistics.

    Requires admin privileges.

    Args:
        days: Number of days to analyze (1-90, default 7)

    Returns:
        {
            "total_sessions": 123,
            "active_sessions": 5,
            "avg_duration_seconds": 1234,
            "avg_duration_minutes": 20.6,
            "sessions_by_day": [...]
        }
    """
    return system_stats_service.get_session_stats(
        labeler_db=labeler_db,
        days=days
    )
