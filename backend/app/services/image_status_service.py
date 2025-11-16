"""
Image Annotation Status Service

Automatically updates image_annotation_status table based on annotation changes.
"""

from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models.labeler import Annotation, ImageAnnotationStatus


async def update_image_status(
    db: Session,
    project_id: str,
    image_id: str,
) -> Optional[ImageAnnotationStatus]:
    """
    Update or create image_annotation_status record for a given image.

    This function should be called after any annotation CRUD operation:
    - After creating an annotation
    - After updating an annotation (especially state changes)
    - After deleting an annotation

    Args:
        db: Database session
        project_id: Project ID
        image_id: Image ID

    Returns:
        Updated or created ImageAnnotationStatus record, or None if no annotations exist
    """
    # Query all annotations for this image
    annotations = db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.image_id == image_id
    ).all()

    # Get or create status record
    status_record = db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id,
        ImageAnnotationStatus.image_id == image_id
    ).first()

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
) -> ImageAnnotationStatus:
    """
    Mark an image as confirmed (completed).

    This sets is_image_confirmed = True and status = 'completed'.
    Should be called when user clicks "Confirm Image" button.

    Args:
        db: Database session
        project_id: Project ID
        image_id: Image ID

    Returns:
        Updated ImageAnnotationStatus record
    """
    # First ensure the status record is up to date
    await update_image_status(db, project_id, image_id)

    # Get the status record (should exist after update_image_status)
    status_record = db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id,
        ImageAnnotationStatus.image_id == image_id
    ).first()

    if not status_record:
        # Create a new one if it doesn't exist (edge case)
        status_record = ImageAnnotationStatus(
            project_id=project_id,
            image_id=image_id,
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
) -> ImageAnnotationStatus:
    """
    Unmark an image as confirmed.

    This sets is_image_confirmed = False and recalculates status.

    Args:
        db: Database session
        project_id: Project ID
        image_id: Image ID

    Returns:
        Updated ImageAnnotationStatus record
    """
    # Get the status record
    status_record = db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id,
        ImageAnnotationStatus.image_id == image_id
    ).first()

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
    await update_image_status(db, project_id, image_id)

    return status_record
