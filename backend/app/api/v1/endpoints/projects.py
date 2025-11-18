"""Annotation project endpoints."""

from datetime import datetime
from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_platform_db, get_labeler_db
from app.core.security import get_current_user
from app.core.storage import storage_client
from app.db.models.platform import User, Dataset
from app.db.models.labeler import AnnotationProject, ImageAnnotationStatus, Annotation
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.schemas.image import (
    ImageListResponse,
    ImageMetadata,
    ImageStatusResponse,
    ImageStatusListResponse,
    ImageConfirmRequest,
    ImageConfirmResponse,
)
from app.schemas.class_schema import ClassCreateRequest, ClassUpdateRequest, ClassResponse
from app.services.image_status_service import confirm_image_status, unconfirm_image_status
from app.api.v1.endpoints import projects_classes

router = APIRouter()

# Include class management endpoints
router.include_router(projects_classes.router, prefix="", tags=["Classes"])


@router.post("", response_model=ProjectResponse, tags=["Projects"], status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create new annotation project.

    - **name**: Project name
    - **dataset_id**: Dataset ID from Platform
    - **task_types**: List of task types (classification, bbox, polygon, etc.)
    - **task_config**: Task-specific configuration
    - **classes**: Class definitions
    """
    # Verify dataset exists in Platform DB
    dataset = platform_db.query(Dataset).filter(Dataset.id == project.dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {project.dataset_id} not found",
        )

    # Create new project
    db_project = AnnotationProject(
        id=f"proj_{uuid.uuid4().hex[:12]}",
        name=project.name,
        description=project.description,
        dataset_id=project.dataset_id,
        owner_id=current_user.id,
        task_types=project.task_types,
        task_config=project.task_config,
        classes=project.classes,
        settings=project.settings or {},
        total_images=dataset.num_items,
    )

    labeler_db.add(db_project)
    labeler_db.commit()
    labeler_db.refresh(db_project)

    # Add dataset information
    response_dict = {
        **db_project.__dict__,
        "dataset_name": dataset.name,
        "dataset_num_items": dataset.num_items,
    }

    return ProjectResponse.model_validate(response_dict)


@router.get("", response_model=List[ProjectResponse], tags=["Projects"])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get list of annotation projects.

    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return (max 100)
    """
    # Query projects
    projects = (
        labeler_db.query(AnnotationProject)
        .filter(AnnotationProject.owner_id == current_user.id)
        .offset(skip)
        .limit(min(limit, 100))
        .all()
    )

    # Get dataset information for each project
    result = []
    for project in projects:
        dataset = platform_db.query(Dataset).filter(Dataset.id == project.dataset_id).first()

        response_dict = {
            **project.__dict__,
            "dataset_name": dataset.name if dataset else None,
            "dataset_num_items": dataset.num_items if dataset else None,
        }
        result.append(ProjectResponse.model_validate(response_dict))

    return result


@router.get("/{project_id}/images", response_model=ImageListResponse, tags=["Projects"])
async def list_project_images(
    project_id: str,
    limit: int = 1000,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get list of images in a project.

    Returns all images from the dataset with presigned URLs for browser access.

    - **project_id**: Project ID
    - **limit**: Maximum number of images to return (default: 1000)
    """
    # Get project
    project = labeler_db.query(AnnotationProject).filter(AnnotationProject.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this project",
        )

    # Get images from storage
    try:
        images_data = storage_client.list_dataset_images(
            dataset_id=project.dataset_id,
            prefix="images/",
            max_keys=min(limit, 1000)
        )

        # Convert to ImageMetadata objects
        images = [ImageMetadata(**img) for img in images_data]

        return ImageListResponse(
            images=images,
            total=len(images),
            dataset_id=project.dataset_id,
            project_id=project_id
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list images: {str(e)}"
        )


@router.get("/{project_id}", response_model=ProjectResponse, tags=["Projects"])
async def get_project(
    project_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get annotation project by ID.

    - **project_id**: Project ID
    """
    project = labeler_db.query(AnnotationProject).filter(AnnotationProject.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this project",
        )

    # Get dataset information
    dataset = platform_db.query(Dataset).filter(Dataset.id == project.dataset_id).first()

    response_dict = {
        **project.__dict__,
        "dataset_name": dataset.name if dataset else None,
        "dataset_num_items": dataset.num_items if dataset else None,
    }

    return ProjectResponse.model_validate(response_dict)


@router.patch("/{project_id}", response_model=ProjectResponse, tags=["Projects"])
async def update_project(
    project_id: str,
    updates: ProjectUpdate,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update annotation project.

    - **project_id**: Project ID
    """
    project = labeler_db.query(AnnotationProject).filter(AnnotationProject.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this project",
        )

    # Update fields
    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    labeler_db.commit()
    labeler_db.refresh(project)

    # Get dataset information
    dataset = platform_db.query(Dataset).filter(Dataset.id == project.dataset_id).first()

    response_dict = {
        **project.__dict__,
        "dataset_name": dataset.name if dataset else None,
        "dataset_num_items": dataset.num_items if dataset else None,
    }

    return ProjectResponse.model_validate(response_dict)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Projects"])
async def delete_project(
    project_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete annotation project.

    - **project_id**: Project ID
    """
    project = labeler_db.query(AnnotationProject).filter(AnnotationProject.id == project_id).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this project",
        )

    labeler_db.delete(project)
    labeler_db.commit()

    return None


# Phase 2.7: Image Status Management Endpoints
@router.get("/{project_id}/images/status", response_model=ImageStatusListResponse, tags=["Image Status"])
async def get_project_image_statuses(
    project_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get annotation status for all images in a project.

    Returns status information including:
    - Image completion status (not-started, in-progress, completed)
    - Annotation counts (total, confirmed, draft)
    - Image confirmation status
    - Timestamp information
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

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this project",
        )

    # Get all image statuses for the project
    statuses = labeler_db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id
    ).all()

    return ImageStatusListResponse(
        statuses=[ImageStatusResponse.model_validate(s) for s in statuses],
        total=len(statuses),
        project_id=project_id,
    )


@router.post("/{project_id}/images/{image_id}/confirm", response_model=ImageConfirmResponse, tags=["Image Status"])
async def confirm_image(
    project_id: str,
    image_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm an image, marking all its annotations as confirmed.

    This will:
    1. Confirm all draft annotations for the image
    2. Mark the image as confirmed
    3. Update the image status to 'completed'
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

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this project",
        )

    # Get or create image annotation status
    status_entry = labeler_db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id,
        ImageAnnotationStatus.image_id == image_id,
    ).first()

    if not status_entry:
        # Create new status entry
        status_entry = ImageAnnotationStatus(
            project_id=project_id,
            image_id=image_id,
            status="not-started",
            total_annotations=0,
            confirmed_annotations=0,
            draft_annotations=0,
            is_image_confirmed=False,
        )
        labeler_db.add(status_entry)
        labeler_db.flush()

    # Confirm all draft annotations for this image
    draft_annotations = labeler_db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.image_id == image_id,
        Annotation.annotation_state == "draft",
    ).all()

    confirmed_count = 0
    for annotation in draft_annotations:
        annotation.annotation_state = "confirmed"
        annotation.confirmed_at = datetime.utcnow()
        annotation.confirmed_by = current_user.id
        annotation.updated_at = datetime.utcnow()
        confirmed_count += 1

    # Phase 2.7: Use service to update image status
    status_entry = await confirm_image_status(
        db=labeler_db,
        project_id=project_id,
        image_id=image_id,
    )

    labeler_db.commit()
    labeler_db.refresh(status_entry)

    return ImageConfirmResponse(
        image_id=image_id,
        is_confirmed=status_entry.is_image_confirmed,
        confirmed_at=status_entry.confirmed_at,
        status=status_entry.status,
        total_annotations=status_entry.total_annotations,
        confirmed_annotations=status_entry.confirmed_annotations,
    )


@router.post("/{project_id}/images/{image_id}/unconfirm", response_model=ImageConfirmResponse, tags=["Image Status"])
async def unconfirm_image(
    project_id: str,
    image_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Unconfirm an image, reverting all its annotations back to draft state.

    This will:
    1. Revert all confirmed annotations back to draft
    2. Mark the image as not confirmed
    3. Update the image status to 'in-progress' if there are annotations
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

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this project",
        )

    # Get image annotation status
    status_entry = labeler_db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id,
        ImageAnnotationStatus.image_id == image_id,
    ).first()

    if not status_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image {image_id} status not found",
        )

    # Unconfirm all confirmed annotations for this image
    confirmed_annotations = labeler_db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.image_id == image_id,
        Annotation.annotation_state == "confirmed",
    ).all()

    for annotation in confirmed_annotations:
        annotation.annotation_state = "draft"
        annotation.confirmed_at = None
        annotation.confirmed_by = None
        annotation.updated_at = datetime.utcnow()

    # Phase 2.7: Use service to update image status
    status_entry = await unconfirm_image_status(
        db=labeler_db,
        project_id=project_id,
        image_id=image_id,
    )

    labeler_db.commit()
    labeler_db.refresh(status_entry)

    return ImageConfirmResponse(
        image_id=image_id,
        is_confirmed=status_entry.is_image_confirmed,
        confirmed_at=status_entry.confirmed_at,
        status=status_entry.status,
        total_annotations=status_entry.total_annotations,
        confirmed_annotations=status_entry.confirmed_annotations,
    )
