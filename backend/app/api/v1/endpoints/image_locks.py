"""
Phase 8.5.2: Image Lock API Endpoints

Endpoints for managing image locks during concurrent editing.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_labeler_db, get_platform_db
from app.core.security import get_current_user, require_project_permission
# from app.db.models.user import User
from app.db.models.labeler import AnnotationProject
from app.services.image_lock_service import ImageLockService


router = APIRouter()


# ============================================================================
# Schemas
# ============================================================================

class LockInfo(BaseModel):
    """Lock information."""
    image_id: str
    user_id: int
    locked_at: datetime
    expires_at: datetime
    heartbeat_at: datetime

    # User info (joined from Platform DB)
    user_name: Optional[str] = None
    user_email: Optional[str] = None


class LockAcquireResponse(BaseModel):
    """Response to lock acquire request."""
    status: str  # "acquired", "already_locked", "refreshed"
    lock: Optional[LockInfo] = None
    locked_by: Optional[LockInfo] = None


class LockReleaseResponse(BaseModel):
    """Response to lock release request."""
    status: str  # "released", "not_locked", "not_owner"


class HeartbeatResponse(BaseModel):
    """Response to heartbeat request."""
    status: str  # "updated", "not_locked", "not_owner"
    lock: Optional[LockInfo] = None


class ProjectLocksResponse(BaseModel):
    """Response with all active locks for a project."""
    locks: List[LockInfo]


# ============================================================================
# Helper Functions
# ============================================================================

# def enrich_lock_with_user_info(lock_data: dict, user_db: Session) -> dict:
#     """Add user name and email to lock data (Phase 9: from User DB)."""
#     user = user_db.query(User).filter(User.id == lock_data['user_id']).first()
#     if user:
#         lock_data['user_name'] = user.full_name
#         lock_data['user_email'] = user.email
#     return lock_data




# ============================================================================
# Endpoints
# ============================================================================

@router.post("/{project_id}/{image_id:path}/acquire", response_model=LockAcquireResponse, tags=["Image Locks"])
async def acquire_lock(
    project_id: str,
    image_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _permission=Depends(require_project_permission("annotator")),
):
    """
    Acquire lock on an image.

    Requires: annotator role or higher

    Cases:
    - No existing lock → Create new lock (status: "acquired")
    - Lock exists, owned by same user → Refresh lock (status: "refreshed")
    - Lock exists, owned by different user → Reject (status: "already_locked")
    """
    # Acquire lock
    result = ImageLockService.acquire_lock(
        db=labeler_db,
        project_id=project_id,
        image_id=image_id,
        user_id=current_user.id,
    )

    # Enrich with user info
    # if result.get('lock'):
    #     result['lock'] = enrich_lock_with_user_info(result['lock'], user_db)

    # if result.get('locked_by'):
    #     result['locked_by'] = enrich_lock_with_user_info(result['locked_by'], user_db)

    return result


@router.delete("/{project_id}/{image_id:path}", response_model=LockReleaseResponse, tags=["Image Locks"])
async def release_lock(
    project_id: str,
    image_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _permission=Depends(require_project_permission("annotator")),
):
    """
    Release lock on an image.

    Requires: annotator role or higher
    Only the user who owns the lock can release it.
    """
    # Release lock
    result = ImageLockService.release_lock(
        db=labeler_db,
        project_id=project_id,
        image_id=image_id,
        user_id=current_user.id,
    )

    return result


@router.post("/{project_id}/{image_id:path}/heartbeat", response_model=HeartbeatResponse, tags=["Image Locks"])
async def send_heartbeat(
    project_id: str,
    image_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _permission=Depends(require_project_permission("annotator")),
):
    """
    Send heartbeat to keep lock alive.

    Requires: annotator role or higher
    Should be called every 2 minutes to prevent lock expiration (5-minute timeout).
    """
    # Send heartbeat
    result = ImageLockService.heartbeat(
        db=labeler_db,
        project_id=project_id,
        image_id=image_id,
        user_id=current_user.id,
    )

    # Enrich with user info
    # if result.get('lock'):
    #     result['lock'] = enrich_lock_with_user_info(result['lock'], user_db)

    return result


@router.get("/{project_id}", response_model=ProjectLocksResponse, tags=["Image Locks"])
async def get_project_locks(
    project_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _permission=Depends(require_project_permission("viewer")),
):
    """
    Get all active locks for a project.

    Requires: viewer role or higher
    Useful for showing lock indicators in ImageList.
    Returns locks with user information.
    """
    # Get all locks
    locks = ImageLockService.get_project_locks(
        db=labeler_db,
        project_id=project_id,
    )

    # Enrich with user info
    # enriched_locks = [
    #     enrich_lock_with_user_info(lock, user_db)
    #     for lock in locks
    # ]

    return {"locks": locks}


@router.get("/{project_id}/{image_id:path}/status", tags=["Image Locks"])
async def get_lock_status(
    project_id: str,
    image_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _permission=Depends(require_project_permission("viewer")),
):
    """
    Get lock status for a specific image.

    Requires: viewer role or higher
    Returns null if not locked, or lock information if locked.
    """
    # Get lock status
    lock = ImageLockService.get_lock_status(
        db=labeler_db,
        project_id=project_id,
        image_id=image_id,
    )

    if not lock:
        return None

    # Enrich with user info
    # return enrich_lock_with_user_info(lock, user_db)
    return lock


@router.delete("/{project_id}/{image_id:path}/force", response_model=LockReleaseResponse, tags=["Image Locks"])
async def force_release_lock(
    project_id: str,
    image_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _permission=Depends(require_project_permission("admin")),
):
    """
    Force release a lock (admin/owner action).

    Requires: admin role or higher
    Can be used by project admins/owners to release any lock.
    """
    # Force release
    result = ImageLockService.force_release_lock(
        db=labeler_db,
        project_id=project_id,
        image_id=image_id,
    )

    return result
