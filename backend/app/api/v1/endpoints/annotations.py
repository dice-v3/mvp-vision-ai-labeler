"""Annotation endpoints."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, distinct
import boto3
from botocore.config import Config

from app.core.database import get_platform_db, get_labeler_db
from app.core.security import get_current_user, require_project_permission
from app.core.config import settings
# from app.db.models.user import User
from app.db.models.labeler import Dataset, Annotation, AnnotationHistory, AnnotationProject
from app.schemas.annotation import (
    AnnotationCreate,
    AnnotationUpdate,
    AnnotationResponse,
    AnnotationHistoryResponse,
    AnnotationBatchCreate,
    AnnotationBatchResponse,
    AnnotationConfirmRequest,
    BulkConfirmRequest,
    ConfirmResponse,
    BulkConfirmResponse,
)
from app.services.image_status_service import update_image_status
from app.services.image_lock_service import ImageLockService
# REFACTORING: Use task registry instead of hardcoded mapping
from app.tasks import task_registry, TaskType, AnnotationType

router = APIRouter()


# REFACTORING: Removed get_task_type_from_annotation()
# Task type is now stored directly in annotation.task_type column
# No more inference needed!


# Phase 8.5.2: Image Lock Check Helper
def check_image_lock(
    db: Session,
    project_id: str,
    image_id: str,
    user_id: str,
):
    """
    Check if user has lock on the image.

    Auto-acquires/refreshes lock if:
    - No lock exists (user gets the lock automatically)
    - Lock exists for the same user (auto-refresh)

    Raises HTTPException only if:
    - Image is locked by a DIFFERENT user

    This ensures smooth single-user workflows while still protecting
    against concurrent edits by multiple users.

    NOTE: This function will flush changes but NOT commit.
    The calling endpoint is responsible for committing the transaction.
    """
    # Cleanup expired locks first
    ImageLockService.cleanup_expired_locks(db)

    # Get lock status
    lock = ImageLockService.get_lock_status(db, project_id, image_id)

    if not lock:
        # No lock exists - auto-acquire for this user
        # This prevents usability issues in single-user workflows
        ImageLockService.acquire_lock(db, project_id, image_id, user_id)
        db.flush()  # Flush but don't commit - let endpoint handle commit
        return

    if lock['user_id'] != user_id:
        # Locked by another user - reject the request
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Image {image_id} is locked by another user. Cannot edit.",
        )

    # Lock exists for the same user - refresh it automatically
    # Directly update the lock without committing
    from datetime import datetime, timedelta
    from app.db.models.labeler import ImageLock
    from sqlalchemy import and_

    lock_obj = db.query(ImageLock).filter(
        and_(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        )
    ).first()

    if lock_obj:
        now = datetime.utcnow()
        lock_obj.heartbeat_at = now
        lock_obj.expires_at = now + timedelta(minutes=5)
        db.flush()  # Flush but don't commit - let endpoint handle commit


async def create_history_entry(
    db: Session,
    annotation_id: int,
    project_id: str,
    action: str,
    previous_state: dict = None,
    new_state: dict = None,
    changed_by: int = None,
):
    """Create annotation history entry."""
    history = AnnotationHistory(
        annotation_id=annotation_id,
        project_id=project_id,
        action=action,
        previous_state=previous_state,
        new_state=new_state,
        changed_by=changed_by,
        timestamp=datetime.utcnow(),
    )
    db.add(history)
    db.flush()
    return history


async def update_project_stats(
    db: Session,
    project_id: str,
    user_id: str,
):
    """Update project statistics after annotation changes."""
    project = db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        return

    # Count total annotations
    total_annotations = db.query(func.count(Annotation.id)).filter(
        Annotation.project_id == project_id
    ).scalar()

    # Count unique annotated images
    annotated_images = db.query(func.count(distinct(Annotation.image_id))).filter(
        Annotation.project_id == project_id
    ).scalar()

    # Update project
    project.total_annotations = total_annotations
    project.annotated_images = annotated_images
    project.last_updated_by = user_id
    project.updated_at = datetime.utcnow()

    db.flush()


@router.post("", response_model=AnnotationResponse, tags=["Annotations"])
async def create_annotation(
    annotation: AnnotationCreate,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Create new annotation.

    - **project_id**: Project ID
    - **image_id**: Image ID
    - **annotation_type**: Type of annotation (classification, bbox, etc.)
    - **geometry**: Geometry data (flexible JSONB)
    - **class_id**: Class ID (optional)
    - **class_name**: Class name (optional)
    - **attributes**: Additional attributes (optional)
    - **confidence**: Confidence score 0-100 (optional)
    - **notes**: Notes (optional)
    """
    # Verify project exists and check permission
    from app.db.models.labeler import ProjectPermission
    from app.core.security import ROLE_HIERARCHY

    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == annotation.project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {annotation.project_id} not found",
        )

    # Check permission (requires annotator role or higher)
    permission = labeler_db.query(ProjectPermission).filter(
        ProjectPermission.project_id == annotation.project_id,
        ProjectPermission.user_id == current_user["sub"],
    ).first()

    if not permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You don't have access to project {annotation.project_id}",
        )

    user_role_level = ROLE_HIERARCHY.get(permission.role, 0)
    required_role_level = ROLE_HIERARCHY.get("annotator", 0)

    if user_role_level < required_role_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied. Required role: annotator, your role: {permission.role}",
        )

    # Phase 8.5.2: Check image lock (strict lock policy)
    check_image_lock(labeler_db, annotation.project_id, annotation.image_id, current_user["sub"])

    # REFACTORING: Infer and store task_type using task registry
    # This is done ONCE at creation time, not on every query!
    if annotation.annotation_type == 'no_object':
        # For no_object, get task_type from attributes
        task_type_str = (annotation.attributes or {}).get('task_type')
        if not task_type_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="no_object annotation requires task_type in attributes",
            )
    else:
        # Use task registry for reverse lookup
        try:
            ann_type = AnnotationType(annotation.annotation_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown annotation_type: {annotation.annotation_type}",
            )

        task_type_enum = task_registry.get_task_for_annotation_type(ann_type)
        if not task_type_enum:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No task type found for annotation_type: {annotation.annotation_type}",
            )
        task_type_str = task_type_enum.value

    # Create annotation
    # no_object annotations are automatically confirmed since they represent
    # an explicit decision that the image has no objects
    annotation_state = "confirmed" if annotation.annotation_type == "no_object" else "draft"

    new_annotation = Annotation(
        project_id=annotation.project_id,
        image_id=annotation.image_id,
        annotation_type=annotation.annotation_type,
        task_type=task_type_str,  # REFACTORING: Store task_type directly!
        geometry=annotation.geometry,
        class_id=annotation.class_id,
        class_name=annotation.class_name,
        attributes=annotation.attributes or {},
        confidence=annotation.confidence,
        notes=annotation.notes,
        created_by=current_user["sub"],
        is_verified=False,
        annotation_state=annotation_state,
    )

    labeler_db.add(new_annotation)
    labeler_db.flush()

    # Create history entry
    await create_history_entry(
        db=labeler_db,
        annotation_id=new_annotation.id,
        project_id=annotation.project_id,
        action="create",
        new_state={
            "annotation_type": annotation.annotation_type,
            "task_type": task_type_str,  # Include task_type in history
            "geometry": annotation.geometry,
            "class_id": annotation.class_id,
            "class_name": annotation.class_name,
        },
        changed_by=current_user["sub"],
    )

    # Update project stats
    await update_project_stats(
        db=labeler_db,
        project_id=annotation.project_id,
        user_id=current_user["sub"],
    )

    # REFACTORING: Update image annotation status with task_type
    # No more inference - task_type is already stored!
    await update_image_status(
        db=labeler_db,
        project_id=annotation.project_id,
        image_id=annotation.image_id,
        task_type=task_type_str,
    )

    labeler_db.commit()
    labeler_db.refresh(new_annotation)

    # Add user info
    response_dict = {
        **new_annotation.__dict__,
        "created_by_name": current_user.get("name"),
        "confirmed_by_name": None,  # New annotations are in draft state
    }

    return AnnotationResponse.model_validate(response_dict)


@router.get("/{annotation_id}", response_model=AnnotationResponse, tags=["Annotations"])
async def get_annotation(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get annotation by ID."""
    annotation = labeler_db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation {annotation_id} not found",
        )

    # User info removed - User DB dependency eliminated
    created_by_name = None
    updated_by_name = None
    confirmed_by_name = None

    # User lookups commented out - no User DB access
    # if annotation.created_by:
    #     user = user_db.query(User).filter(User.id == annotation.created_by).first()
    #     if user:
    #         created_by_name = user.full_name
    #
    # if annotation.updated_by:
    #     user = user_db.query(User).filter(User.id == annotation.updated_by).first()
    #     if user:
    #         updated_by_name = user.full_name
    #
    # if annotation.confirmed_by:
    #     user = user_db.query(User).filter(User.id == annotation.confirmed_by).first()
    #     if user:
    #         confirmed_by_name = user.full_name

    response_dict = {
        **annotation.__dict__,
        "created_by_name": created_by_name,
        "updated_by_name": updated_by_name,
        "confirmed_by_name": confirmed_by_name,
    }

    return AnnotationResponse.model_validate(response_dict)


@router.put("/{annotation_id}", response_model=AnnotationResponse, tags=["Annotations"])
async def update_annotation(
    annotation_id: int,
    update_data: AnnotationUpdate,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update annotation."""
    annotation = labeler_db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation {annotation_id} not found",
        )

    # Phase 8.5.1: Basic permission check (before full RBAC)
    # Users can only update their own annotations or owner can update any
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == annotation.project_id
    ).first()

    is_owner = project and project.owner_id == current_user["sub"]
    is_creator = annotation.created_by == current_user["sub"]

    if not (is_owner or is_creator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this annotation",
        )

    # Phase 8.5.2: Check image lock (strict lock policy)
    check_image_lock(labeler_db, annotation.project_id, annotation.image_id, current_user["sub"])

    # Phase 8.5.1: Optimistic locking - check version
    if update_data.version is not None:
        if update_data.version != annotation.version:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "conflict",
                    "message": "Annotation modified by another user",
                    "current_version": annotation.version,
                    "your_version": update_data.version,
                    "last_updated_by": annotation.updated_by,
                    "last_updated_at": annotation.updated_at.isoformat() if annotation.updated_at else None,
                },
            )

    # Store previous state
    previous_state = {
        "geometry": annotation.geometry,
        "class_id": annotation.class_id,
        "class_name": annotation.class_name,
        "attributes": annotation.attributes,
        "confidence": annotation.confidence,
        "is_verified": annotation.is_verified,
        "notes": annotation.notes,
    }

    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    # Exclude version from update_dict (we increment it separately)
    update_dict.pop('version', None)

    for key, value in update_dict.items():
        setattr(annotation, key, value)

    annotation.updated_by = current_user["sub"]
    annotation.updated_at = datetime.utcnow()

    # Phase 8.5.1: Increment version for optimistic locking
    annotation.version += 1

    # Store new state
    new_state = {
        "geometry": annotation.geometry,
        "class_id": annotation.class_id,
        "class_name": annotation.class_name,
        "attributes": annotation.attributes,
        "confidence": annotation.confidence,
        "is_verified": annotation.is_verified,
        "notes": annotation.notes,
    }

    # Create history entry
    await create_history_entry(
        db=labeler_db,
        annotation_id=annotation_id,
        project_id=annotation.project_id,
        action="update",
        previous_state=previous_state,
        new_state=new_state,
        changed_by=current_user["sub"],
    )

    # Update project stats
    await update_project_stats(
        db=labeler_db,
        project_id=annotation.project_id,
        user_id=current_user["sub"],
    )

    # Phase 2.7: Update image annotation status
    task_type = annotation.task_type
    await update_image_status(
        db=labeler_db,
        project_id=annotation.project_id,
        image_id=annotation.image_id,
        task_type=task_type,
    )

    labeler_db.commit()
    labeler_db.refresh(annotation)

    # User info removed - User DB dependency eliminated
    updated_by_name = current_user.get("name")
    created_by_name = None
    confirmed_by_name = None

    # User lookups commented out - no User DB access
    # if annotation.created_by:
    #     user = user_db.query(User).filter(User.id == annotation.created_by).first()
    #     if user:
    #         created_by_name = user.full_name
    #
    # if annotation.confirmed_by:
    #     user = user_db.query(User).filter(User.id == annotation.confirmed_by).first()
    #     if user:
    #         confirmed_by_name = user.full_name

    response_dict = {
        **annotation.__dict__,
        "created_by_name": created_by_name,
        "updated_by_name": updated_by_name,
        "confirmed_by_name": confirmed_by_name,
    }

    return AnnotationResponse.model_validate(response_dict)


@router.delete("/{annotation_id}", tags=["Annotations"])
async def delete_annotation(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Delete annotation."""
    annotation = labeler_db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation {annotation_id} not found",
        )

    project_id = annotation.project_id
    image_id = annotation.image_id  # Phase 2.7: Store image_id before deletion
    task_type = annotation.task_type  # Store task_type before deletion

    # Phase 8.5.2: Check permission and image lock
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    is_owner = project and project.owner_id == current_user["sub"]
    is_creator = annotation.created_by == current_user["sub"]

    if not (is_owner or is_creator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this annotation",
        )

    # Phase 8.5.2: Check image lock (strict lock policy)
    check_image_lock(labeler_db, project_id, image_id, current_user["sub"])

    # Store state before deletion
    previous_state = {
        "annotation_type": annotation.annotation_type,
        "geometry": annotation.geometry,
        "class_id": annotation.class_id,
        "class_name": annotation.class_name,
        "image_id": annotation.image_id,
    }

    # Create history entry before deletion
    await create_history_entry(
        db=labeler_db,
        annotation_id=annotation_id,
        project_id=project_id,
        action="delete",
        previous_state=previous_state,
        changed_by=current_user["sub"],
    )

    # Delete annotation
    labeler_db.delete(annotation)

    # Update project stats
    await update_project_stats(
        db=labeler_db,
        project_id=project_id,
        user_id=current_user["sub"],
    )

    # Phase 2.7: Update image annotation status after deletion
    await update_image_status(
        db=labeler_db,
        project_id=project_id,
        image_id=image_id,
        task_type=task_type,
    )

    labeler_db.commit()

    return {"message": f"Annotation {annotation_id} deleted successfully"}


@router.get("/project/{project_id}", response_model=List[AnnotationResponse], tags=["Annotations"])
async def list_project_annotations(
    project_id: str,
    skip: int = 0,
    limit: int = 1000,
    image_id: Optional[str] = None,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _permission=Depends(require_project_permission("viewer")),
):
    """
    List annotations for a project.

    Requires: viewer role or higher

    - **project_id**: Project ID
    - **skip**: Number of records to skip
    - **limit**: Maximum number of records to return
    - **image_id**: Filter by image ID (optional)
    """
    query = labeler_db.query(Annotation).filter(Annotation.project_id == project_id)

    if image_id:
        query = query.filter(Annotation.image_id == image_id)

    annotations = query.offset(skip).limit(min(limit, 1000)).all()

    # User info removed - User DB dependency eliminated
    # Fetch user info for all unique user IDs (Phase 9: from User DB)
    # user_ids = set()
    # for ann in annotations:
    #     if ann.created_by:
    #         user_ids.add(ann.created_by)
    #     if ann.updated_by:
    #         user_ids.add(ann.updated_by)
    #     if ann.confirmed_by:
    #         user_ids.add(ann.confirmed_by)
    #
    # users = {}
    # if user_ids:
    #     user_results = user_db.query(User).filter(User.id.in_(user_ids)).all()
    #     users = {u.id: u.full_name for u in user_results}

    # Build responses with user names set to None
    result = []
    for ann in annotations:
        response_dict = {
            **ann.__dict__,
            "created_by_name": None,
            "updated_by_name": None,
            "confirmed_by_name": None,
        }
        result.append(AnnotationResponse.model_validate(response_dict))

    return result


@router.post("/batch", response_model=AnnotationBatchResponse, tags=["Annotations"])
async def batch_create_annotations(
    batch: AnnotationBatchCreate,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Batch create annotations.

    Requires: annotator role or higher on all projects
    Useful for importing existing annotations or bulk operations.
    """
    from app.db.models.labeler import ProjectPermission
    from app.core.security import ROLE_HIERARCHY

    created_ids = []
    errors = []

    # Cache permission checks for each project
    checked_projects = {}

    for idx, annotation_data in enumerate(batch.annotations):
        try:
            project_id = annotation_data.project_id

            # Check permission once per project
            if project_id not in checked_projects:
                # Verify project exists
                project = labeler_db.query(AnnotationProject).filter(
                    AnnotationProject.id == project_id
                ).first()

                if not project:
                    errors.append(f"Index {idx}: Project {project_id} not found")
                    checked_projects[project_id] = False
                    continue

                # Check permission (requires annotator role or higher)
                permission = labeler_db.query(ProjectPermission).filter(
                    ProjectPermission.project_id == project_id,
                    ProjectPermission.user_id == current_user["sub"],
                ).first()

                if not permission:
                    errors.append(f"Index {idx}: No access to project {project_id}")
                    checked_projects[project_id] = False
                    continue

                user_role_level = ROLE_HIERARCHY.get(permission.role, 0)
                required_role_level = ROLE_HIERARCHY.get("annotator", 0)

                if user_role_level < required_role_level:
                    errors.append(f"Index {idx}: Insufficient permissions for project {project_id}")
                    checked_projects[project_id] = False
                    continue

                checked_projects[project_id] = True

            # Skip if permission check failed for this project
            if not checked_projects[project_id]:
                continue

            # Create annotation
            # no_object annotations are automatically confirmed
            ann_state = "confirmed" if annotation_data.annotation_type == "no_object" else "draft"

            new_annotation = Annotation(
                project_id=annotation_data.project_id,
                image_id=annotation_data.image_id,
                annotation_type=annotation_data.annotation_type,
                geometry=annotation_data.geometry,
                class_id=annotation_data.class_id,
                class_name=annotation_data.class_name,
                attributes=annotation_data.attributes or {},
                confidence=annotation_data.confidence,
                notes=annotation_data.notes,
                created_by=current_user["sub"],
                is_verified=False,
                annotation_state=ann_state,
            )

            labeler_db.add(new_annotation)
            labeler_db.flush()

            # Create history entry
            await create_history_entry(
                db=labeler_db,
                annotation_id=new_annotation.id,
                project_id=annotation_data.project_id,
                action="create",
                new_state={
                    "annotation_type": annotation_data.annotation_type,
                    "geometry": annotation_data.geometry,
                    "class_id": annotation_data.class_id,
                },
                changed_by=current_user["sub"],
            )

            created_ids.append(new_annotation.id)

        except Exception as e:
            errors.append(f"Index {idx}: {str(e)}")

    # Update project stats for all affected projects
    affected_projects = set(ann.project_id for ann in batch.annotations)
    for project_id in affected_projects:
        await update_project_stats(
            db=labeler_db,
            project_id=project_id,
            user_id=current_user["sub"],
        )

    labeler_db.commit()

    return AnnotationBatchResponse(
        created=len(created_ids),
        failed=len(errors),
        annotation_ids=created_ids,
        errors=errors,
    )


@router.get("/history/project/{project_id}", response_model=List[AnnotationHistoryResponse], tags=["Annotation History"])
async def list_project_history(
    project_id: str,
    skip: int = 0,
    limit: int = 100,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _permission=Depends(require_project_permission("viewer")),
):
    """
    Get annotation history for a project.

    Requires: viewer role or higher
    Returns recent annotation changes for activity timeline.

    - **project_id**: Project ID
    - **skip**: Number of records to skip
    - **limit**: Maximum number of records to return (max 100)
    """
    history_entries = (
        labeler_db.query(AnnotationHistory)
        .filter(AnnotationHistory.project_id == project_id)
        .order_by(AnnotationHistory.timestamp.desc())
        .offset(skip)
        .limit(min(limit, 100))
        .all()
    )

    # User info removed - User DB dependency eliminated
    # Fetch user info (Phase 9: from User DB)
    # user_ids = set(h.changed_by for h in history_entries if h.changed_by)
    # users = {}
    # if user_ids:
    #     user_results = user_db.query(User).filter(User.id.in_(user_ids)).all()
    #     users = {u.id: {"name": u.full_name, "email": u.email} for u in user_results}

    # Build responses with user info set to None
    result = []
    for history in history_entries:
        response_dict = {
            **history.__dict__,
            "changed_by_name": None,
            "changed_by_email": None,
        }
        result.append(AnnotationHistoryResponse.model_validate(response_dict))

    return result


@router.get("/history/annotation/{annotation_id}", response_model=List[AnnotationHistoryResponse], tags=["Annotation History"])
async def list_annotation_history(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get history for a specific annotation.

    Useful for seeing all changes made to a single annotation.

    - **annotation_id**: Annotation ID
    """
    history_entries = (
        labeler_db.query(AnnotationHistory)
        .filter(AnnotationHistory.annotation_id == annotation_id)
        .order_by(AnnotationHistory.timestamp.desc())
        .all()
    )

    # User info removed - User DB dependency eliminated
    # Fetch user info (Phase 9: from User DB)
    # user_ids = set(h.changed_by for h in history_entries if h.changed_by)
    # users = {}
    # if user_ids:
    #     user_results = user_db.query(User).filter(User.id.in_(user_ids)).all()
    #     users = {u.id: {"name": u.full_name, "email": u.email} for u in user_results}

    # Build responses with user info set to None
    result = []
    for history in history_entries:
        response_dict = {
            **history.__dict__,
            "changed_by_name": None,
            "changed_by_email": None,
        }
        result.append(AnnotationHistoryResponse.model_validate(response_dict))

    return result


# Phase 2.7: Annotation Confirmation Endpoints
@router.post("/{annotation_id}/confirm", response_model=ConfirmResponse, tags=["Annotation Confirmation"])
async def confirm_annotation(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Confirm an annotation.

    Changes annotation state from 'draft' to 'confirmed'.
    Records who confirmed and when.
    """
    annotation = labeler_db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation {annotation_id} not found",
        )

    # Update annotation state
    previous_state = annotation.annotation_state
    annotation.annotation_state = "confirmed"
    annotation.confirmed_at = datetime.utcnow()
    annotation.confirmed_by = current_user["sub"]
    annotation.updated_at = datetime.utcnow()

    # Phase 8.5.1: Increment version for optimistic locking
    annotation.version += 1

    # Create history entry
    await create_history_entry(
        db=labeler_db,
        annotation_id=annotation_id,
        project_id=annotation.project_id,
        action="confirm",
        previous_state={"annotation_state": previous_state},
        new_state={"annotation_state": "confirmed"},
        changed_by=current_user["sub"],
    )

    # Phase 2.7: Update image annotation status
    task_type = annotation.task_type
    await update_image_status(
        db=labeler_db,
        project_id=annotation.project_id,
        image_id=annotation.image_id,
        task_type=task_type,
    )

    labeler_db.commit()
    labeler_db.refresh(annotation)

    return ConfirmResponse(
        annotation_id=annotation.id,
        annotation_state=annotation.annotation_state,
        confirmed_at=annotation.confirmed_at,
        confirmed_by=annotation.confirmed_by,
        confirmed_by_name=current_user.get("name"),
    )


@router.post("/{annotation_id}/unconfirm", response_model=ConfirmResponse, tags=["Annotation Confirmation"])
async def unconfirm_annotation(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Unconfirm an annotation.

    Changes annotation state from 'confirmed' back to 'draft'.
    Clears confirmation metadata.
    """
    annotation = labeler_db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation {annotation_id} not found",
        )

    # Update annotation state
    previous_state = annotation.annotation_state
    annotation.annotation_state = "draft"
    annotation.confirmed_at = None
    annotation.confirmed_by = None
    annotation.updated_at = datetime.utcnow()

    # Phase 8.5.1: Increment version for optimistic locking
    annotation.version += 1

    # Create history entry
    await create_history_entry(
        db=labeler_db,
        annotation_id=annotation_id,
        project_id=annotation.project_id,
        action="unconfirm",
        previous_state={"annotation_state": previous_state},
        new_state={"annotation_state": "draft"},
        changed_by=current_user["sub"],
    )

    # Phase 2.7: Update image annotation status
    task_type = annotation.task_type
    await update_image_status(
        db=labeler_db,
        project_id=annotation.project_id,
        image_id=annotation.image_id,
        task_type=task_type,
    )

    labeler_db.commit()
    labeler_db.refresh(annotation)

    return ConfirmResponse(
        annotation_id=annotation.id,
        annotation_state=annotation.annotation_state,
        confirmed_at=annotation.confirmed_at,
        confirmed_by=annotation.confirmed_by,
        confirmed_by_name=None,
    )


@router.post("/bulk-confirm", response_model=BulkConfirmResponse, tags=["Annotation Confirmation"])
async def bulk_confirm_annotations(
    request: BulkConfirmRequest,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Bulk confirm multiple annotations.

    Confirms all specified annotations in a single transaction.
    Returns success/failure counts and details.
    """
    results = []
    errors = []
    confirmed_count = 0
    failed_count = 0
    affected_images = set()  # Phase 2.7: Track affected images for status update

    for annotation_id in request.annotation_ids:
        try:
            annotation = labeler_db.query(Annotation).filter(
                Annotation.id == annotation_id
            ).first()

            if not annotation:
                errors.append(f"Annotation {annotation_id} not found")
                failed_count += 1
                continue

            # Update annotation state
            previous_state = annotation.annotation_state
            annotation.annotation_state = "confirmed"
            annotation.confirmed_at = datetime.utcnow()
            annotation.confirmed_by = current_user["sub"]
            annotation.updated_at = datetime.utcnow()

            # Phase 8.5.1: Increment version for optimistic locking
            annotation.version += 1

            # Create history entry
            await create_history_entry(
                db=labeler_db,
                annotation_id=annotation_id,
                project_id=annotation.project_id,
                action="confirm",
                previous_state={"annotation_state": previous_state},
                new_state={"annotation_state": "confirmed"},
                changed_by=current_user["sub"],
            )

            # Phase 2.7: Track affected image for status update
            task_type = annotation.task_type
            affected_images.add((annotation.project_id, annotation.image_id, task_type))

            confirmed_count += 1
            results.append(ConfirmResponse(
                annotation_id=annotation.id,
                annotation_state=annotation.annotation_state,
                confirmed_at=annotation.confirmed_at,
                confirmed_by=annotation.confirmed_by,
                confirmed_by_name=current_user.get("name"),
            ))

        except Exception as e:
            errors.append(f"Annotation {annotation_id}: {str(e)}")
            failed_count += 1

    # Phase 2.7: Update image annotation status for all affected images
    for project_id, image_id, task_type in affected_images:
        await update_image_status(
            db=labeler_db,
            project_id=project_id,
            image_id=image_id,
            task_type=task_type,
        )

    labeler_db.commit()

    return BulkConfirmResponse(
        confirmed=confirmed_count,
        failed=failed_count,
        results=results,
        errors=errors,
    )


def load_annotations_from_s3(annotation_path: str) -> Optional[Dict]:
    """Load annotations.json from S3/MinIO storage."""
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version='s3v4')
        )

        response = s3_client.get_object(
            Bucket=settings.S3_BUCKET_DATASETS,
            Key=annotation_path
        )
        import json
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    except Exception as e:
        print(f"Error loading annotations from S3: {e}")
        return None


@router.post("/import/project/{project_id}", tags=["Annotations"])
async def import_annotations_from_json(
    project_id: str,
    force: bool = Query(False, description="Force re-import by deleting existing annotations"),
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
    _permission=Depends(require_project_permission("annotator")),
):
    """
    Import annotations from annotations.json to database.

    Requires: annotator role or higher
    This endpoint loads the annotations.json file from S3 storage
    and imports all annotations into the database for the given project.
    """
    # Get project
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found"
        )

    # Get dataset from Labeler DB
    dataset = labeler_db.query(Dataset).filter(
        Dataset.id == project.dataset_id
    ).first()

    if not dataset or not dataset.annotation_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset or annotations.json not found"
        )

    # Load annotations.json from S3
    annotations_data = load_annotations_from_s3(dataset.annotation_path)

    if not annotations_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load annotations.json from storage"
        )

    # Check if annotations already exist for this project
    existing_count = labeler_db.query(func.count(Annotation.id)).filter(
        Annotation.project_id == project_id
    ).scalar()

    if existing_count > 0:
        if force:
            # Delete existing annotations
            labeler_db.query(Annotation).filter(
                Annotation.project_id == project_id
            ).delete()
            labeler_db.commit()
            print(f"Deleted {existing_count} existing annotations for project {project_id}")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project already has {existing_count} annotations. Use force=true to re-import."
            )

    # Import annotations
    annotations_list = annotations_data.get('annotations', [])
    categories = annotations_data.get('categories', [])

    # Create category_id -> category_name mapping
    cat_lookup = {cat['id']: cat for cat in categories}

    imported_count = 0
    skipped_count = 0

    for ann_data in annotations_list:
        try:
            # Extract annotation data
            image_id = str(ann_data.get('image_id'))
            category_id = str(ann_data.get('category_id'))
            bbox = ann_data.get('bbox', [])  # [x, y, width, height]

            # Skip if essential data is missing
            if not image_id or not category_id or not bbox or len(bbox) != 4:
                skipped_count += 1
                continue

            # Get category info
            category = cat_lookup.get(ann_data.get('category_id'))
            if not category:
                skipped_count += 1
                continue

            # Convert COCO bbox format [x, y, w, h] to our format
            x, y, w, h = bbox

            # Create annotation
            annotation = Annotation(
                project_id=project_id,
                image_id=image_id,
                annotation_type='bbox',
                geometry={
                    'type': 'bbox',
                    'bbox': [x, y, w, h],
                    'area': ann_data.get('area'),
                },
                class_id=category_id,
                class_name=category['name'],
                metadata={
                    'coco_annotation_id': ann_data.get('id'),
                    'area': ann_data.get('area'),
                    'iscrowd': ann_data.get('iscrowd', 0),
                    'imported_from': 'annotations.json',
                },
                created_by=current_user["sub"],
                updated_by=current_user["sub"],
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

            labeler_db.add(annotation)
            imported_count += 1

        except Exception as e:
            print(f"Error importing annotation {ann_data.get('id')}: {e}")
            skipped_count += 1
            continue

    # Commit all annotations
    try:
        labeler_db.commit()
    except Exception as e:
        labeler_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save annotations to database: {str(e)}"
        )

    # Update project statistics
    await update_project_stats(labeler_db, project_id, current_user["sub"])
    labeler_db.commit()

    return {
        "status": "success",
        "project_id": project_id,
        "imported": imported_count,
        "skipped": skipped_count,
        "total": len(annotations_list),
    }
