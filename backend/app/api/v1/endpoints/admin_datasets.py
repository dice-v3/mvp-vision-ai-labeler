"""
Admin Dataset Management API for Phase 15 - Admin Dashboard

Provides admin-only endpoints for dataset management and monitoring.

Endpoints:
- GET /api/v1/admin/datasets/overview - Dataset overview statistics
- GET /api/v1/admin/datasets/recent - Recent dataset updates
- GET /api/v1/admin/datasets/{id}/details - Dataset detail statistics
- GET /api/v1/admin/datasets/{id}/progress - Labeling progress statistics
- GET /api/v1/admin/datasets/{id}/activity - Recent activity timeline

All endpoints require admin privileges (system_role = 'admin').
"""

from typing import Dict, List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_admin_user
from app.core.database import get_labeler_db, get_user_db
from app.db.models.user import User
from app.services import admin_stats_service


router = APIRouter()


# =============================================================================
# Dataset Overview Endpoints
# =============================================================================

@router.get("/overview", response_model=Dict[str, Any])
async def get_datasets_overview(
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get high-level overview statistics for all datasets.

    Requires admin privileges.

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
    return admin_stats_service.get_datasets_overview_stats(
        labeler_db=labeler_db,
        user_db=user_db
    )


@router.get("/recent", response_model=List[Dict[str, Any]])
async def get_recent_datasets(
    limit: int = Query(default=10, ge=1, le=100, description="Number of recent updates to return"),
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get recently updated datasets with owner information.

    Requires admin privileges.

    Args:
        limit: Number of recent updates to return (1-100, default 10)

    Returns:
        List of recent dataset updates with owner emails
    """
    return admin_stats_service.get_recent_dataset_updates(
        labeler_db=labeler_db,
        user_db=user_db,
        limit=limit
    )


# =============================================================================
# Dataset Detail Endpoints
# =============================================================================

@router.get("/{dataset_id}/details", response_model=Dict[str, Any])
async def get_dataset_details(
    dataset_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get detailed statistics for a specific dataset.

    Requires admin privileges.

    Args:
        dataset_id: Dataset ID

    Returns:
        {
            "dataset": {...},
            "projects": [...],
            "storage_info": {...}
        }

    Raises:
        404: Dataset not found
    """
    result = admin_stats_service.get_dataset_detail_stats(
        dataset_id=dataset_id,
        labeler_db=labeler_db,
        user_db=user_db
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset {dataset_id} not found"
        )

    return result


@router.get("/{dataset_id}/progress", response_model=Dict[str, Any])
async def get_labeling_progress(
    dataset_id: str,
    project_id: Optional[str] = Query(default=None, description="Optional project ID to filter by"),
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get labeling progress statistics for a dataset or project.

    Requires admin privileges.

    Args:
        dataset_id: Dataset ID
        project_id: Optional project ID (if None, aggregates all projects)

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
            "total_images": 170,
            "completed_images": 20,
            "user_contributions": [...]
        }
    """
    return admin_stats_service.get_labeling_progress_stats(
        dataset_id=dataset_id,
        project_id=project_id,
        labeler_db=labeler_db,
        user_db=user_db
    )


@router.get("/{dataset_id}/activity", response_model=List[Dict[str, Any]])
async def get_recent_activity(
    dataset_id: str,
    days: int = Query(default=7, ge=1, le=90, description="Number of days to look back"),
    limit: int = Query(default=50, ge=1, le=200, description="Maximum number of activities to return"),
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get recent activity timeline for a dataset.

    Requires admin privileges.

    Args:
        dataset_id: Dataset ID
        days: Number of days to look back (1-90, default 7)
        limit: Maximum number of activities to return (1-200, default 50)

    Returns:
        List of activity events sorted by timestamp (newest first)
    """
    return admin_stats_service.get_recent_activity_timeline(
        dataset_id=dataset_id,
        labeler_db=labeler_db,
        user_db=user_db,
        days=days,
        limit=limit
    )
