"""
System Statistics Service for Phase 15 - Admin Dashboard

Provides system-wide statistics for admin dashboard.
Aggregates data across User DB and Labeler DB.

Features:
- User activity statistics (registrations, logins, active users)
- Resource usage statistics (datasets, images, annotations, storage)
- Performance metrics (annotation rates, task distribution)
- Time-based trends and aggregations

Performance:
- Optimized queries with proper indexing
- Can be cached in system_stats_cache table for expensive queries
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy import func, and_, or_, distinct
from sqlalchemy.orm import Session

from app.db.models.labeler import (
    Dataset, AnnotationProject, Annotation,
    ImageAnnotationStatus, ImageMetadata, AuditLog, UserSession
)
# from app.db.models.user import User  # Commented out - User model no longer used


# =============================================================================
# User Activity Statistics
# =============================================================================

def get_user_activity_stats(
    user_db: Optional[Session] = None,
    labeler_db: Optional[Session] = None,
    days: int = 30
) -> Dict[str, Any]:
    """
    Get user activity statistics.

    Args:
        user_db: User database session
        labeler_db: Labeler database session
        days: Number of days to look back for active users

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
    now = datetime.utcnow()
    cutoff_7d = now - timedelta(days=7)
    cutoff_30d = now - timedelta(days=30)

    # Total users
    # total_users = user_db.query(User).filter(User.is_active == True).count()
    total_users = 0  # User model no longer available

    # New users (last 7 and 30 days)
    # new_users_7d = user_db.query(User).filter(
    #     User.created_at >= cutoff_7d
    # ).count()
    new_users_7d = 0  # User model no longer available

    # new_users_30d = user_db.query(User).filter(
    #     User.created_at >= cutoff_30d
    # ).count()
    new_users_30d = 0  # User model no longer available

    # Active users (users who created annotations recently)
    active_users_7d = 0
    active_users_30d = 0
    if labeler_db:
        active_users_7d = labeler_db.query(
            func.count(distinct(Annotation.created_by))
        ).filter(
            and_(
                Annotation.created_by.isnot(None),
                Annotation.created_at >= cutoff_7d
            )
        ).scalar() or 0

        active_users_30d = labeler_db.query(
            func.count(distinct(Annotation.created_by))
        ).filter(
            and_(
                Annotation.created_by.isnot(None),
                Annotation.created_at >= cutoff_30d
            )
        ).scalar() or 0

    # Registration trend (last 30 days, by day)
    registration_trend = []
    # for i in range(days):
    #     day_start = now - timedelta(days=i+1)
    #     day_end = now - timedelta(days=i)
    #
    #     count = user_db.query(User).filter(
    #         and_(
    #             User.created_at >= day_start,
    #             User.created_at < day_end
    #         )
    #     ).count()
    #
    #     registration_trend.append({
    #         "date": day_start.strftime("%Y-%m-%d"),
    #         "count": count
    #     })
    #
    # registration_trend.reverse()  # Oldest to newest
    # User model no longer available - returning empty trend

    # Login activity (from audit logs)
    login_count_7d = 0
    login_count_30d = 0
    if labeler_db:
        login_count_7d = labeler_db.query(AuditLog).filter(
            and_(
                AuditLog.action == 'login',
                AuditLog.timestamp >= cutoff_7d
            )
        ).count()

        login_count_30d = labeler_db.query(AuditLog).filter(
            and_(
                AuditLog.action == 'login',
                AuditLog.timestamp >= cutoff_30d
            )
        ).count()

    return {
        "total_users": total_users,
        "active_users_7d": active_users_7d,
        "active_users_30d": active_users_30d,
        "new_users_7d": new_users_7d,
        "new_users_30d": new_users_30d,
        "registration_trend": registration_trend,
        "login_activity": {
            "logins_7d": login_count_7d,
            "logins_30d": login_count_30d,
        }
    }


# =============================================================================
# Resource Usage Statistics
# =============================================================================

def get_resource_usage_stats(
    labeler_db: Session,
    user_db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Get resource usage statistics.

    Returns:
        {
            "datasets": {...},
            "images": {...},
            "annotations": {...},
            "storage": {...}
        }
    """
    # Dataset stats
    total_datasets = labeler_db.query(Dataset).count()
    datasets_by_status = labeler_db.query(
        Dataset.status,
        func.count(Dataset.id)
    ).group_by(Dataset.status).all()

    # Image stats
    total_images = labeler_db.query(func.sum(Dataset.num_images)).scalar() or 0
    total_storage = labeler_db.query(func.sum(ImageMetadata.size)).scalar() or 0

    # Annotation stats
    total_annotations = labeler_db.query(Annotation).count()

    annotations_by_task = labeler_db.query(
        Annotation.task_type,
        func.count(Annotation.id)
    ).group_by(Annotation.task_type).all()

    # Recent activity (last 7 days)
    cutoff_7d = datetime.utcnow() - timedelta(days=7)

    new_annotations_7d = labeler_db.query(Annotation).filter(
        Annotation.created_at >= cutoff_7d
    ).count()

    return {
        "datasets": {
            "total": total_datasets,
            "by_status": {status: count for status, count in datasets_by_status}
        },
        "images": {
            "total": int(total_images)
        },
        "annotations": {
            "total": total_annotations,
            "by_task_type": {task: count for task, count in annotations_by_task},
            "recent_7d": new_annotations_7d
        },
        "storage": {
            "total_bytes": int(total_storage) if total_storage else 0,
            "total_gb": round((total_storage or 0) / (1024 ** 3), 2)
        }
    }


# =============================================================================
# Performance Metrics
# =============================================================================

def get_performance_metrics(
    labeler_db: Session,
    days: int = 7
) -> Dict[str, Any]:
    """
    Get performance metrics.

    Args:
        labeler_db: Labeler database session
        days: Number of days to analyze

    Returns:
        {
            "annotation_rate": {...},
            "task_distribution": {...},
            "top_annotators": [...]
        }
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Annotation rate (annotations per day)
    daily_annotations = []
    for i in range(days):
        day_start = datetime.utcnow() - timedelta(days=i+1)
        day_end = datetime.utcnow() - timedelta(days=i)

        count = labeler_db.query(Annotation).filter(
            and_(
                Annotation.created_at >= day_start,
                Annotation.created_at < day_end
            )
        ).count()

        daily_annotations.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "count": count
        })

    daily_annotations.reverse()  # Oldest to newest

    # Average annotations per day
    total_annotations_period = sum(d["count"] for d in daily_annotations)
    avg_annotations_per_day = total_annotations_period / days if days > 0 else 0

    # Task distribution (last N days)
    task_distribution = labeler_db.query(
        Annotation.task_type,
        func.count(Annotation.id)
    ).filter(
        Annotation.created_at >= cutoff
    ).group_by(Annotation.task_type).all()

    # Top annotators (last N days)
    top_annotators = labeler_db.query(
        Annotation.created_by,
        func.count(Annotation.id).label('annotation_count')
    ).filter(
        and_(
            Annotation.created_by.isnot(None),
            Annotation.created_at >= cutoff
        )
    ).group_by(Annotation.created_by).order_by(
        func.count(Annotation.id).desc()
    ).limit(10).all()

    return {
        "annotation_rate": {
            "daily": daily_annotations,
            "average_per_day": round(avg_annotations_per_day, 2),
            "total_period": total_annotations_period
        },
        "task_distribution": {
            task: count for task, count in task_distribution
        },
        "top_annotators": [
            {"user_id": user_id, "annotation_count": count}
            for user_id, count in top_annotators
        ]
    }


# =============================================================================
# Session Statistics
# =============================================================================

def get_session_stats(
    labeler_db: Session,
    days: int = 7
) -> Dict[str, Any]:
    """
    Get user session statistics.

    Args:
        labeler_db: Labeler database session
        days: Number of days to analyze

    Returns:
        {
            "total_sessions": 123,
            "active_sessions": 5,
            "avg_duration_seconds": 1234,
            "sessions_by_day": [...]
        }
    """
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Total sessions in period
    total_sessions = labeler_db.query(UserSession).filter(
        UserSession.login_at >= cutoff
    ).count()

    # Active sessions (no logout yet)
    active_sessions = labeler_db.query(UserSession).filter(
        UserSession.logout_at.is_(None)
    ).count()

    # Average session duration (for completed sessions)
    avg_duration = labeler_db.query(
        func.avg(UserSession.duration_seconds)
    ).filter(
        and_(
            UserSession.login_at >= cutoff,
            UserSession.duration_seconds.isnot(None)
        )
    ).scalar()

    # Sessions by day
    sessions_by_day = []
    for i in range(days):
        day_start = datetime.utcnow() - timedelta(days=i+1)
        day_end = datetime.utcnow() - timedelta(days=i)

        count = labeler_db.query(UserSession).filter(
            and_(
                UserSession.login_at >= day_start,
                UserSession.login_at < day_end
            )
        ).count()

        sessions_by_day.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "count": count
        })

    sessions_by_day.reverse()  # Oldest to newest

    return {
        "total_sessions": total_sessions,
        "active_sessions": active_sessions,
        "avg_duration_seconds": int(avg_duration) if avg_duration else 0,
        "avg_duration_minutes": round((avg_duration or 0) / 60, 1),
        "sessions_by_day": sessions_by_day
    }


# =============================================================================
# Comprehensive Overview
# =============================================================================

def get_system_overview(
    user_db: Optional[Session] = None,
    labeler_db: Optional[Session] = None,
    days: int = 7
) -> Dict[str, Any]:
    """
    Get comprehensive system overview.

    Combines all statistics into a single response.

    Args:
        user_db: User database session
        labeler_db: Labeler database session
        days: Number of days for time-based metrics

    Returns:
        Complete system statistics
    """
    return {
        "user_activity": get_user_activity_stats(user_db, labeler_db, days),
        "resource_usage": get_resource_usage_stats(labeler_db, user_db),
        "performance": get_performance_metrics(labeler_db, days),
        "sessions": get_session_stats(labeler_db, days),
        "generated_at": datetime.utcnow().isoformat(),
        "time_period_days": days
    }
