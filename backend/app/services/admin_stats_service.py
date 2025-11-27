"""
Admin Statistics Service for Phase 15 - Admin Dashboard

Provides statistical queries for admin dashboard.
Aggregates data across Labeler DB and User DB.

Features:
- Dataset statistics (total, images, storage, annotations)
- User activity statistics
- Recent updates timeline
- Cross-DB aggregation (Labeler + User DB)

Performance:
- Optimized queries with indexes
- Can be cached in system_stats_cache table (future enhancement)
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy import func, and_, or_
from sqlalchemy.orm import Session

from app.db.models.labeler import (
    Dataset, AnnotationProject, Annotation,
    ImageAnnotationStatus, ImageMetadata
)
from app.db.models.user import User


# =============================================================================
# Dataset Overview Statistics
# =============================================================================

def get_datasets_overview_stats(
    labeler_db: Session,
    user_db: Session
) -> Dict[str, Any]:
    """
    Get high-level overview statistics for all datasets.

    Returns:
        {
            "total_datasets": 42,
            "total_images": 125430,
            "total_size_bytes": 52428800000,
            "total_annotations": 543210,
            "datasets_by_status": {
                "active": 35,
                "completed": 5,
                "archived": 2
            }
        }
    """
    # Total datasets
    total_datasets = labeler_db.query(Dataset).count()

    # Total images (sum from all datasets)
    total_images = labeler_db.query(func.sum(Dataset.num_images)).scalar() or 0

    # Total storage (sum from ImageMetadata)
    total_size = labeler_db.query(func.sum(ImageMetadata.size)).scalar() or 0

    # Total annotations across all projects
    total_annotations = labeler_db.query(Annotation).count()

    # Datasets by status
    status_counts = labeler_db.query(
        Dataset.status,
        func.count(Dataset.id)
    ).group_by(Dataset.status).all()

    datasets_by_status = {status: count for status, count in status_counts}

    return {
        "total_datasets": total_datasets,
        "total_images": int(total_images),
        "total_size_bytes": int(total_size) if total_size else 0,
        "total_annotations": total_annotations,
        "datasets_by_status": datasets_by_status,
    }


def get_recent_dataset_updates(
    labeler_db: Session,
    user_db: Session,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Get recently updated datasets with owner information.

    Args:
        labeler_db: Labeler database session
        user_db: User database session
        limit: Number of recent updates to return

    Returns:
        List of dicts with dataset info and owner email
    """
    # Get recently updated datasets
    recent_datasets = labeler_db.query(Dataset).order_by(
        Dataset.updated_at.desc()
    ).limit(limit).all()

    result = []
    for dataset in recent_datasets:
        # Get owner info from User DB (cross-DB query)
        owner = user_db.query(User).filter(User.id == dataset.owner_id).first()

        result.append({
            "dataset_id": dataset.id,
            "name": dataset.name,
            "last_updated": dataset.updated_at.isoformat() if dataset.updated_at else None,
            "updated_by": owner.email if owner else None,
            "status": dataset.status,
            "num_images": dataset.num_images,
        })

    return result


# =============================================================================
# Dataset Detail Statistics
# =============================================================================

def get_dataset_detail_stats(
    dataset_id: str,
    labeler_db: Session,
    user_db: Session
) -> Dict[str, Any]:
    """
    Get detailed statistics for a specific dataset.

    Returns:
        {
            "dataset": {...},
            "projects": [...],
            "user_permissions": [...],
            "storage_info": {...},
            "recent_activity": [...]
        }
    """
    # Get dataset
    dataset = labeler_db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        return None

    # Get owner info
    owner = user_db.query(User).filter(User.id == dataset.owner_id).first()

    # Get associated projects
    projects = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.dataset_id == dataset_id
    ).all()

    project_list = []
    for project in projects:
        # Count annotations for this project
        annotation_count = labeler_db.query(Annotation).filter(
            Annotation.project_id == project.id
        ).count()

        project_list.append({
            "project_id": project.id,
            "name": project.name,
            "task_types": project.task_types,
            "annotation_count": annotation_count,
            "created_at": project.created_at.isoformat() if project.created_at else None,
        })

    # Get storage info from ImageMetadata
    storage_stats = labeler_db.query(
        func.count(ImageMetadata.id).label('image_count'),
        func.sum(ImageMetadata.size).label('total_size'),
        func.avg(ImageMetadata.size).label('avg_size')
    ).filter(
        ImageMetadata.dataset_id == dataset_id
    ).first()

    storage_info = {
        "image_count": storage_stats.image_count or 0,
        "total_size_bytes": int(storage_stats.total_size) if storage_stats.total_size else 0,
        "avg_size_bytes": int(storage_stats.avg_size) if storage_stats.avg_size else 0,
    }

    return {
        "dataset": {
            "id": dataset.id,
            "name": dataset.name,
            "description": dataset.description,
            "owner_email": owner.email if owner else None,
            "owner_id": dataset.owner_id,
            "status": dataset.status,
            "created_at": dataset.created_at.isoformat() if dataset.created_at else None,
            "updated_at": dataset.updated_at.isoformat() if dataset.updated_at else None,
        },
        "projects": project_list,
        "storage_info": storage_info,
    }


# =============================================================================
# Labeling Progress Statistics
# =============================================================================

def get_labeling_progress_stats(
    dataset_id: str,
    project_id: Optional[str],
    labeler_db: Session,
    user_db: Session
) -> Dict[str, Any]:
    """
    Get labeling progress statistics for a dataset or project.

    Args:
        dataset_id: Dataset ID
        project_id: Optional project ID (if None, aggregates all projects)
        labeler_db: Labeler database session
        user_db: User database session

    Returns:
        {
            "images_by_status": {
                "not_started": 100,
                "in_progress": 50,
                "completed": 20
            },
            "annotations_by_task": {
                "detection": 500,
                "segmentation": 300
            },
            "completion_rate": 0.12,
            "user_contributions": [...]
        }
    """
    # Get image annotation statuses
    status_query = labeler_db.query(
        ImageAnnotationStatus.status,
        func.count(ImageAnnotationStatus.id)
    )

    if project_id:
        status_query = status_query.filter(
            ImageAnnotationStatus.project_id == project_id
        )
    else:
        # Get all projects for this dataset
        project_ids = labeler_db.query(AnnotationProject.id).filter(
            AnnotationProject.dataset_id == dataset_id
        ).all()
        project_ids = [p[0] for p in project_ids]

        if project_ids:
            status_query = status_query.filter(
                ImageAnnotationStatus.project_id.in_(project_ids)
            )

    status_counts = status_query.group_by(ImageAnnotationStatus.status).all()

    images_by_status = {status: count for status, count in status_counts}

    # Calculate completion rate
    total_images = sum(images_by_status.values())
    completed_images = images_by_status.get('completed', 0)
    completion_rate = completed_images / total_images if total_images > 0 else 0

    # Get annotations by task type
    annotation_query = labeler_db.query(
        Annotation.task_type,
        func.count(Annotation.id)
    )

    if project_id:
        annotation_query = annotation_query.filter(
            Annotation.project_id == project_id
        )
    else:
        if project_ids:
            annotation_query = annotation_query.filter(
                Annotation.project_id.in_(project_ids)
            )

    task_counts = annotation_query.group_by(Annotation.task_type).all()
    annotations_by_task = {task: count for task, count in task_counts}

    # Get user contributions (top annotators)
    user_contrib_query = labeler_db.query(
        Annotation.created_by,
        func.count(Annotation.id).label('annotation_count')
    ).filter(
        Annotation.created_by.isnot(None)
    )

    if project_id:
        user_contrib_query = user_contrib_query.filter(
            Annotation.project_id == project_id
        )
    else:
        if project_ids:
            user_contrib_query = user_contrib_query.filter(
                Annotation.project_id.in_(project_ids)
            )

    user_contribs = user_contrib_query.group_by(
        Annotation.created_by
    ).order_by(
        func.count(Annotation.id).desc()
    ).limit(10).all()

    # Get user emails from User DB
    user_contributions = []
    for user_id, count in user_contribs:
        user = user_db.query(User).filter(User.id == user_id).first()
        user_contributions.append({
            "user_id": user_id,
            "user_email": user.email if user else "Unknown",
            "annotation_count": count,
        })

    return {
        "images_by_status": images_by_status,
        "annotations_by_task": annotations_by_task,
        "completion_rate": round(completion_rate, 4),
        "total_images": total_images,
        "completed_images": completed_images,
        "user_contributions": user_contributions,
    }


# =============================================================================
# Recent Activity Timeline
# =============================================================================

def get_recent_activity_timeline(
    dataset_id: str,
    labeler_db: Session,
    user_db: Session,
    days: int = 7,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """
    Get recent activity timeline for a dataset.

    Args:
        dataset_id: Dataset ID
        labeler_db: Labeler database session
        user_db: User database session
        days: Number of days to look back
        limit: Maximum number of activities to return

    Returns:
        List of activity events sorted by timestamp (newest first)
    """
    # Calculate cutoff date
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    # Get all projects for this dataset
    project_ids = labeler_db.query(AnnotationProject.id).filter(
        AnnotationProject.dataset_id == dataset_id
    ).all()
    project_ids = [p[0] for p in project_ids]

    if not project_ids:
        return []

    # Get recent annotations (created)
    recent_annotations = labeler_db.query(Annotation).filter(
        and_(
            Annotation.project_id.in_(project_ids),
            Annotation.created_at >= cutoff_date
        )
    ).order_by(Annotation.created_at.desc()).limit(limit).all()

    activities = []
    for ann in recent_annotations:
        user = user_db.query(User).filter(User.id == ann.created_by).first() if ann.created_by else None
        activities.append({
            "type": "annotation_created",
            "timestamp": ann.created_at.isoformat() if ann.created_at else None,
            "user_email": user.email if user else "System",
            "details": {
                "annotation_id": ann.id,
                "task_type": ann.task_type,
                "image_id": ann.image_id,
            }
        })

    # Sort by timestamp (newest first)
    activities.sort(key=lambda x: x["timestamp"], reverse=True)

    return activities[:limit]
