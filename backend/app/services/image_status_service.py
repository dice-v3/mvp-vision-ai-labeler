"""
Image Annotation Status Service

Automatically updates image_annotation_status table based on annotation changes.

Phase 2.9: Added task_type support for task-specific status tracking.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models.labeler import Annotation, ImageAnnotationStatus

# Phase 2.9: Mapping from annotation_type to task_type
ANNOTATION_TYPE_TO_TASK = {
    'bbox': 'detection',
    'rotated_bbox': 'detection',
    'polygon': 'segmentation',
    'classification': 'classification',
    'keypoint': 'keypoint',
    'line': 'line',
}


async def update_image_status(
    db: Session,
    project_id: str,
    image_id: str,
    task_type: Optional[str] = None,  # Phase 2.9: Task type for filtering
) -> Optional[ImageAnnotationStatus]:
    """
    Update or create image_annotation_status record for a given image.

    This function should be called after any annotation CRUD operation:
    - After creating an annotation
    - After updating an annotation (especially state changes)
    - After deleting an annotation

    Phase 2.9: Supports task_type to track status per task.

    Args:
        db: Database session
        project_id: Project ID
        image_id: Image ID
        task_type: Optional task type to filter annotations (Phase 2.9)

    Returns:
        Updated or created ImageAnnotationStatus record, or None if no annotations exist
    """
    # Query all annotations for this image
    # Phase 2.9: Filter by task_type if provided
    query = db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.image_id == image_id
    )

    if task_type:
        # Filter annotations by annotation_type that matches the task_type
        annotation_types = [ann_type for ann_type, task in ANNOTATION_TYPE_TO_TASK.items() if task == task_type]
        if annotation_types:
            query = query.filter(Annotation.annotation_type.in_(annotation_types))

    annotations = query.all()

    # Get or create status record
    # Phase 2.9: Include task_type in query
    status_query = db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id,
        ImageAnnotationStatus.image_id == image_id
    )

    if task_type:
        status_query = status_query.filter(ImageAnnotationStatus.task_type == task_type)
    else:
        status_query = status_query.filter(ImageAnnotationStatus.task_type.is_(None))

    status_record = status_query.first()

    # If no annotations exist
    if not annotations:
        if status_record:
            # Delete the status record if all annotations were deleted
            db.delete(status_record)
            db.flush()
        return None

    # Calculate counts
    total_count = len(annotations)
    confirmed_count = sum(1 for ann in annotations if ann.annotation_state == "confirmed")
    draft_count = sum(1 for ann in annotations if ann.annotation_state == "draft")

    # Find first and last modified times
    created_times = [ann.created_at for ann in annotations if ann.created_at]
    updated_times = [ann.updated_at for ann in annotations if ann.updated_at]

    first_modified = min(created_times) if created_times else datetime.utcnow()
    last_modified = max(updated_times) if updated_times else datetime.utcnow()

    # Determine status based on annotation states and confirmation flag
    if status_record and status_record.is_image_confirmed:
        # If image is confirmed, status is completed
        new_status = "completed"
    elif total_count > 0:
        # If there are annotations but image not confirmed, status is in-progress
        new_status = "in-progress"
    else:
        # No annotations
        new_status = "not-started"

    # Create or update status record
    if not status_record:
        status_record = ImageAnnotationStatus(
            project_id=project_id,
            image_id=image_id,
            task_type=task_type,  # Phase 2.9: Set task_type
            status=new_status,
            first_modified_at=first_modified,
            last_modified_at=last_modified,
            total_annotations=total_count,
            confirmed_annotations=confirmed_count,
            draft_annotations=draft_count,
            is_image_confirmed=False,
        )
        db.add(status_record)
    else:
        # Update existing record
        status_record.status = new_status
        status_record.last_modified_at = last_modified
        status_record.total_annotations = total_count
        status_record.confirmed_annotations = confirmed_count
        status_record.draft_annotations = draft_count

        # Update first_modified_at if needed (shouldn't change, but just in case)
        if not status_record.first_modified_at or first_modified < status_record.first_modified_at:
            status_record.first_modified_at = first_modified

    db.flush()
    return status_record


async def confirm_image_status(
    db: Session,
    project_id: str,
    image_id: str,
    task_type: Optional[str] = None,  # Phase 2.9: Task type for filtering
) -> ImageAnnotationStatus:
    """
    Mark an image as confirmed (completed).

    This sets is_image_confirmed = True and status = 'completed'.
    Should be called when user clicks "Confirm Image" button.

    Phase 2.9: Supports task_type for task-specific confirmation.

    Args:
        db: Database session
        project_id: Project ID
        image_id: Image ID
        task_type: Optional task type (Phase 2.9)

    Returns:
        Updated ImageAnnotationStatus record
    """
    # First ensure the status record is up to date
    await update_image_status(db, project_id, image_id, task_type)

    # Get the status record (should exist after update_image_status)
    # Phase 2.9: Include task_type in query
    status_query = db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id,
        ImageAnnotationStatus.image_id == image_id
    )

    if task_type:
        status_query = status_query.filter(ImageAnnotationStatus.task_type == task_type)
    else:
        status_query = status_query.filter(ImageAnnotationStatus.task_type.is_(None))

    status_record = status_query.first()

    if not status_record:
        # Create a new one if it doesn't exist (edge case)
        status_record = ImageAnnotationStatus(
            project_id=project_id,
            image_id=image_id,
            task_type=task_type,  # Phase 2.9: Set task_type
            status="completed",
            first_modified_at=datetime.utcnow(),
            last_modified_at=datetime.utcnow(),
            confirmed_at=datetime.utcnow(),
            total_annotations=0,
            confirmed_annotations=0,
            draft_annotations=0,
            is_image_confirmed=True,
        )
        db.add(status_record)
    else:
        # Mark as confirmed
        status_record.is_image_confirmed = True
        status_record.confirmed_at = datetime.utcnow()
        status_record.status = "completed"

    db.flush()
    return status_record


async def unconfirm_image_status(
    db: Session,
    project_id: str,
    image_id: str,
    task_type: Optional[str] = None,  # Phase 2.9: Task type for filtering
) -> ImageAnnotationStatus:
    """
    Unmark an image as confirmed.

    This sets is_image_confirmed = False and recalculates status.

    Phase 2.9: Supports task_type for task-specific unconfirmation.

    Args:
        db: Database session
        project_id: Project ID
        image_id: Image ID
        task_type: Optional task type (Phase 2.9)

    Returns:
        Updated ImageAnnotationStatus record
    """
    # Get the status record
    # Phase 2.9: Include task_type in query
    status_query = db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id,
        ImageAnnotationStatus.image_id == image_id
    )

    if task_type:
        status_query = status_query.filter(ImageAnnotationStatus.task_type == task_type)
    else:
        status_query = status_query.filter(ImageAnnotationStatus.task_type.is_(None))

    status_record = status_query.first()

    if status_record:
        # Unconfirm the image
        status_record.is_image_confirmed = False
        status_record.confirmed_at = None

        # Recalculate status
        if status_record.total_annotations > 0:
            status_record.status = "in-progress"
        else:
            status_record.status = "not-started"

        db.flush()

    # Update counts and status
    # Phase 2.9: Pass task_type to update_image_status
    await update_image_status(db, project_id, image_id, task_type)

    return status_record
