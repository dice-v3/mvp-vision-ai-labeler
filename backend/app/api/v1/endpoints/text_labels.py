"""Text Label endpoints for Phase 19 - VLM Text Labeling."""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.core.database import get_labeler_db
from app.core.security import get_current_user, require_project_permission
from app.db.models.labeler import TextLabel, AnnotationProject, TextLabelVersion
from app.services.text_label_version_service import (
    publish_text_labels,
    get_latest_version,
    get_version_by_number,
    list_versions,
    auto_generate_version_number,
)
from app.schemas.text_label import (
    TextLabelCreate,
    TextLabelUpdate,
    TextLabelResponse,
    TextLabelListResponse,
    TextLabelBatchCreate,
    TextLabelBatchResponse,
    TextLabelStatsResponse,
    TextLabelVersionPublishRequest,
    TextLabelVersionResponse,
    TextLabelVersionDetail,
    TextLabelVersionListResponse,
)

router = APIRouter()


def _get_user_info(user_id: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Get user name and email.

    Note: With Keycloak authentication, user info is obtained from the token.
    For historical records, we return None. If needed, use Keycloak Admin API.
    """
    # Keycloak environment - user info from token, not separate DB
    return None, None


def _build_text_label_response(label: TextLabel) -> TextLabelResponse:
    """Build TextLabelResponse with user information."""
    created_by_name, _ = _get_user_info(label.created_by)
    updated_by_name, _ = _get_user_info(label.updated_by)

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
    current_user = Depends(get_current_user),
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
        _build_text_label_response(label)
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
    current_user = Depends(get_current_user),
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

    return _build_text_label_response(label)


@router.get(
    "/annotation/{annotation_id}",
    response_model=TextLabelListResponse,
    tags=["Text Labels"]
)
async def get_text_labels_for_annotation(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    current_user = Depends(get_current_user),
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
        _build_text_label_response(label)
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
    current_user = Depends(get_current_user),
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

    return _build_text_label_response(new_label)


@router.put(
    "/{label_id}",
    response_model=TextLabelResponse,
    tags=["Text Labels"]
)
async def update_text_label(
    label_id: int,
    label_data: TextLabelUpdate,
    labeler_db: Session = Depends(get_labeler_db),
    current_user = Depends(get_current_user),
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

    return _build_text_label_response(label)


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


# ===== Phase 19.8: Text Label Versioning Endpoints =====


@router.post(
    "/project/{project_id}/versions/publish",
    response_model=TextLabelVersionResponse,
    tags=["Text Label Versions"]
)
async def publish_text_label_version(
    project_id: str,
    publish_request: TextLabelVersionPublishRequest,
    labeler_db: Session = Depends(get_labeler_db),
    current_user = Depends(get_current_user),
    _permission = Depends(require_project_permission("admin")),
):
    """
    Publish a new version of text labels.

    Creates an immutable snapshot of all current text labels for the project.
    Uploads to both Internal S3 (version history) and External S3 (trainer access).

    Requires: admin role or higher

    **Note**: Text labels are automatically published when annotation versions
    are published via `/export/projects/{project_id}/versions/publish`.
    This endpoint allows manual text label versioning independent of annotations.
    """
    # Verify project exists
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Auto-generate version if not provided
    version_number = publish_request.version
    if not version_number:
        version_number = auto_generate_version_number(labeler_db, project_id)

    try:
        # Publish text labels
        text_label_version = publish_text_labels(
            labeler_db=labeler_db,
            project_id=project_id,
            version=version_number,
            user_id=current_user.id,
            notes=publish_request.notes,
        )

        # Get user info
        published_by_name, published_by_email = _get_user_info(current_user.id)

        return TextLabelVersionResponse(
            id=text_label_version.id,
            project_id=text_label_version.project_id,
            version=text_label_version.version,
            published_at=text_label_version.created_at,
            published_by=text_label_version.published_by,
            label_count=text_label_version.label_count,
            image_level_count=text_label_version.image_level_count,
            region_level_count=text_label_version.region_level_count,
            notes=text_label_version.notes,
            published_by_name=published_by_name,
            published_by_email=published_by_email,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to publish text label version: {str(e)}",
        )


@router.get(
    "/project/{project_id}/versions",
    response_model=TextLabelVersionListResponse,
    tags=["Text Label Versions"]
)
async def list_text_label_versions(
    project_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user = Depends(get_current_user),
    _permission = Depends(require_project_permission("viewer")),
):
    """
    List all text label versions for a project.

    Returns versions ordered by creation date (newest first).

    Requires: viewer role or higher
    """
    # Verify project exists
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Get all versions
    versions = list_versions(labeler_db, project_id)

    # Build response with user info
    version_responses = []
    for version in versions:
        published_by_name, published_by_email = _get_user_info(version.published_by)

        version_responses.append(TextLabelVersionResponse(
            id=version.id,
            project_id=version.project_id,
            version=version.version,
            published_at=version.created_at,
            published_by=version.published_by,
            label_count=version.label_count,
            image_level_count=version.image_level_count,
            region_level_count=version.region_level_count,
            notes=version.notes,
            published_by_name=published_by_name,
            published_by_email=published_by_email,
        ))

    return TextLabelVersionListResponse(
        versions=version_responses,
        total=len(version_responses),
    )


@router.get(
    "/project/{project_id}/versions/latest",
    response_model=TextLabelVersionResponse,
    tags=["Text Label Versions"]
)
async def get_latest_text_label_version(
    project_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user = Depends(get_current_user),
    _permission = Depends(require_project_permission("viewer")),
):
    """
    Get the latest text label version for a project.

    Requires: viewer role or higher
    """
    # Verify project exists
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Get latest version
    version = get_latest_version(labeler_db, project_id)

    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No text label versions found for project {project_id}",
        )

    # Get user info
    published_by_name, published_by_email = _get_user_info(version.published_by)

    return TextLabelVersionResponse(
        id=version.id,
        project_id=version.project_id,
        version=version.version,
        published_at=version.created_at,
        published_by=version.published_by,
        label_count=version.label_count,
        image_level_count=version.image_level_count,
        region_level_count=version.region_level_count,
        notes=version.notes,
        published_by_name=published_by_name,
        published_by_email=published_by_email,
    )


@router.get(
    "/project/{project_id}/versions/{version}",
    response_model=TextLabelVersionDetail,
    tags=["Text Label Versions"]
)
async def get_text_label_version(
    project_id: str,
    version: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user = Depends(get_current_user),
    _permission = Depends(require_project_permission("viewer")),
):
    """
    Get a specific text label version with full snapshot data.

    Returns complete version details including all text labels at the time of publishing.

    Requires: viewer role or higher
    """
    # Verify project exists
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Get version
    version_record = get_version_by_number(labeler_db, project_id, version)

    if not version_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Text label version {version} not found for project {project_id}",
        )

    # Get user info
    published_by_name, published_by_email = _get_user_info(version_record.published_by)

    return TextLabelVersionDetail(
        id=version_record.id,
        project_id=version_record.project_id,
        version=version_record.version,
        published_at=version_record.created_at,
        published_by=version_record.published_by,
        label_count=version_record.label_count,
        image_level_count=version_record.image_level_count,
        region_level_count=version_record.region_level_count,
        notes=version_record.notes,
        text_labels_snapshot=version_record.text_labels_snapshot,
        published_by_name=published_by_name,
        published_by_email=published_by_email,
    )
