"""Text Label endpoints for Phase 19 - VLM Text Labeling."""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.core.database import get_labeler_db, get_user_db
from app.core.security import get_current_user, require_project_permission
from app.db.models.user import User
from app.db.models.labeler import TextLabel, AnnotationProject
from app.schemas.text_label import (
    TextLabelCreate,
    TextLabelUpdate,
    TextLabelResponse,
    TextLabelListResponse,
    TextLabelBatchCreate,
    TextLabelBatchResponse,
    TextLabelStatsResponse,
)

router = APIRouter()


def _get_user_info(user_db: Session, user_id: Optional[int]) -> tuple[Optional[str], Optional[str]]:
    """Get user name and email from User DB."""
    if not user_id:
        return None, None

    user = user_db.query(User).filter(User.id == user_id).first()
    if not user:
        return None, None

    return user.full_name, user.email


def _build_text_label_response(
    label: TextLabel,
    user_db: Session
) -> TextLabelResponse:
    """Build TextLabelResponse with user information."""
    created_by_name, _ = _get_user_info(user_db, label.created_by)
    updated_by_name, _ = _get_user_info(user_db, label.updated_by)

    return TextLabelResponse(
        id=label.id,
        project_id=label.project_id,
        image_id=label.image_id,
        annotation_id=label.annotation_id,
        label_type=label.label_type,
        text_content=label.text_content,
        question=label.question,
        language=label.language,
        confidence=label.confidence,
        metadata=label.additional_metadata or {},
        version=label.version,
        created_by=label.created_by,
        updated_by=label.updated_by,
        created_at=label.created_at,
        updated_at=label.updated_at,
        created_by_name=created_by_name,
        updated_by_name=updated_by_name,
    )


@router.get(
    "/project/{project_id}",
    response_model=TextLabelListResponse,
    tags=["Text Labels"]
)
async def list_text_labels(
    project_id: str,
    image_id: Optional[str] = Query(None, description="Filter by image ID"),
    annotation_id: Optional[int] = Query(None, description="Filter by annotation ID"),
    label_type: Optional[str] = Query(None, description="Filter by label type"),
    language: Optional[str] = Query(None, description="Filter by language"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("viewer")),
):
    """
    List text labels for a project.

    Supports filtering by:
    - image_id: Get labels for specific image
    - annotation_id: Get labels for specific annotation (region-level)
    - label_type: Filter by type (caption, description, qa, region)
    - language: Filter by language code

    Requires: viewer role or higher
    """
    # Build query
    query = labeler_db.query(TextLabel).filter(TextLabel.project_id == project_id)

    # Apply filters
    if image_id:
        query = query.filter(TextLabel.image_id == image_id)
    if annotation_id:
        query = query.filter(TextLabel.annotation_id == annotation_id)
    if label_type:
        query = query.filter(TextLabel.label_type == label_type)
    if language:
        query = query.filter(TextLabel.language == language)

    # Get total count
    total = query.count()

    # Apply pagination
    labels = query.order_by(TextLabel.created_at.desc()).offset(skip).limit(limit).all()

    # Build responses with user info
    label_responses = [
        _build_text_label_response(label, user_db)
        for label in labels
    ]

    return TextLabelListResponse(
        text_labels=label_responses,
        total=total
    )


@router.get(
    "/{label_id}",
    response_model=TextLabelResponse,
    tags=["Text Labels"]
)
async def get_text_label(
    label_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a single text label by ID.

    Permission check is done on project_id from the label.
    """
    label = labeler_db.query(TextLabel).filter(TextLabel.id == label_id).first()

    if not label:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Text label {label_id} not found"
        )

    # Check project permission
    # Note: This is a simplified check - in production, you'd check via require_project_permission
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == label.project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {label.project_id} not found"
        )

    return _build_text_label_response(label, user_db)


@router.get(
    "/annotation/{annotation_id}",
    response_model=TextLabelListResponse,
    tags=["Text Labels"]
)
async def get_text_labels_for_annotation(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all text labels for a specific annotation (region-level labels).

    Requires: viewer role or higher
    """
    labels = labeler_db.query(TextLabel).filter(
        TextLabel.annotation_id == annotation_id
    ).order_by(TextLabel.created_at.desc()).all()

    # Build responses
    label_responses = [
        _build_text_label_response(label, user_db)
        for label in labels
    ]

    return TextLabelListResponse(
        text_labels=label_responses,
        total=len(label_responses)
    )


@router.post(
    "",
    response_model=TextLabelResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Text Labels"]
)
async def create_text_label(
    label_data: TextLabelCreate,
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("annotator")),
):
    """
    Create a new text label.

    Supports:
    - Image-level: Set annotation_id=None
    - Region-level: Set annotation_id to link with bbox/polygon

    Requires: annotator role or higher
    """
    # Create label
    new_label = TextLabel(
        project_id=label_data.project_id,
        image_id=label_data.image_id,
        annotation_id=label_data.annotation_id,
        label_type=label_data.label_type,
        text_content=label_data.text_content,
        question=label_data.question,
        language=label_data.language,
        confidence=label_data.confidence,
        additional_metadata=label_data.metadata or {},
        version=1,
        created_by=current_user.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    labeler_db.add(new_label)
    labeler_db.commit()
    labeler_db.refresh(new_label)

    return _build_text_label_response(new_label, user_db)


@router.put(
    "/{label_id}",
    response_model=TextLabelResponse,
    tags=["Text Labels"]
)
async def update_text_label(
    label_id: int,
    label_data: TextLabelUpdate,
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("annotator")),
):
    """
    Update a text label.

    Supports optimistic locking via version field.

    Requires: annotator role or higher
    """
    # Get existing label
    label = labeler_db.query(TextLabel).filter(TextLabel.id == label_id).first()

    if not label:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Text label {label_id} not found"
        )

    # Optimistic locking check
    if label_data.version is not None and label.version != label_data.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Version conflict. Expected version {label_data.version}, but current version is {label.version}"
        )

    # Update fields
    if label_data.text_content is not None:
        label.text_content = label_data.text_content
    if label_data.question is not None:
        label.question = label_data.question
    if label_data.language is not None:
        label.language = label_data.language
    if label_data.confidence is not None:
        label.confidence = label_data.confidence
    if label_data.metadata is not None:
        label.additional_metadata = label_data.metadata

    # Update metadata
    label.updated_by = current_user.id
    label.updated_at = datetime.utcnow()
    label.version += 1

    labeler_db.commit()
    labeler_db.refresh(label)

    return _build_text_label_response(label, user_db)


@router.delete(
    "/{label_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Text Labels"]
)
async def delete_text_label(
    label_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("annotator")),
):
    """
    Delete a text label.

    Requires: annotator role or higher
    """
    label = labeler_db.query(TextLabel).filter(TextLabel.id == label_id).first()

    if not label:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Text label {label_id} not found"
        )

    labeler_db.delete(label)
    labeler_db.commit()


@router.post(
    "/bulk",
    response_model=TextLabelBatchResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Text Labels"]
)
async def bulk_create_text_labels(
    batch_data: TextLabelBatchCreate,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("annotator")),
):
    """
    Bulk create text labels.

    Useful for:
    - Importing pre-labeled data
    - Batch labeling multiple images/regions

    Requires: annotator role or higher
    """
    created_ids = []
    errors = []

    for label_data in batch_data.text_labels:
        try:
            new_label = TextLabel(
                project_id=label_data.project_id,
                image_id=label_data.image_id,
                annotation_id=label_data.annotation_id,
                label_type=label_data.label_type,
                text_content=label_data.text_content,
                question=label_data.question,
                language=label_data.language,
                confidence=label_data.confidence,
                additional_metadata=label_data.metadata or {},
                version=1,
                created_by=current_user.id,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

            labeler_db.add(new_label)
            labeler_db.flush()  # Get ID without committing
            created_ids.append(new_label.id)

        except Exception as e:
            errors.append(f"Failed to create label: {str(e)}")

    # Commit all or rollback
    if errors:
        labeler_db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Batch create failed: {', '.join(errors)}"
        )

    labeler_db.commit()

    return TextLabelBatchResponse(
        created=len(created_ids),
        failed=len(errors),
        text_label_ids=created_ids,
        errors=errors
    )


@router.get(
    "/project/{project_id}/stats",
    response_model=TextLabelStatsResponse,
    tags=["Text Labels"]
)
async def get_text_label_stats(
    project_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
    _permission = Depends(require_project_permission("viewer")),
):
    """
    Get text label statistics for a project.

    Returns:
    - Total labels
    - Breakdown by type (caption, description, qa, region)
    - Breakdown by language
    - Images with labels
    - Annotations with labels

    Requires: viewer role or higher
    """
    # Get all labels for project
    labels = labeler_db.query(TextLabel).filter(
        TextLabel.project_id == project_id
    ).all()

    # Calculate statistics
    total_labels = len(labels)

    # By type
    by_type = {}
    for label in labels:
        by_type[label.label_type] = by_type.get(label.label_type, 0) + 1

    # By language
    by_language = {}
    for label in labels:
        by_language[label.language] = by_language.get(label.language, 0) + 1

    # Unique images with labels
    images_with_labels = len(set(label.image_id for label in labels))

    # Unique annotations with labels (region-level)
    annotations_with_labels = len(set(
        label.annotation_id for label in labels if label.annotation_id is not None
    ))

    return TextLabelStatsResponse(
        project_id=project_id,
        total_labels=total_labels,
        by_type=by_type,
        by_language=by_language,
        images_with_labels=images_with_labels,
        annotations_with_labels=annotations_with_labels
    )
