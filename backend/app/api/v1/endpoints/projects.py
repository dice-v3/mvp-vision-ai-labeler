"""Annotation project endpoints - REFACTORED."""

from datetime import datetime
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_platform_db, get_labeler_db
from app.core.security import get_current_user
from app.core.storage import storage_client
from app.db.models.platform import User, Dataset
from app.db.models.labeler import AnnotationProject, ImageAnnotationStatus, Annotation
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, AddTaskTypeRequest
# REFACTORING: Import task registry for task type validation
from app.tasks import task_registry, TaskType
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

    # REFACTORING: Create new project
    # Legacy classes field removed - use task_classes only
    db_project = AnnotationProject(
        id=f"proj_{uuid.uuid4().hex[:12]}",
        name=project.name,
        description=project.description,
        dataset_id=project.dataset_id,
        owner_id=current_user.id,
        task_types=project.task_types,
        task_config=project.task_config,
        task_classes=project.task_classes or {},  # REFACTORED: Use task_classes instead of classes
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


@router.post("/{project_id}/task-types", response_model=ProjectResponse, tags=["Projects"])
async def add_task_type(
    project_id: str,
    request: AddTaskTypeRequest,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a new task type to the project.

    This endpoint allows users to dynamically add task types (classification, detection, segmentation, etc.)
    to an existing project. When adding a new task type:
    1. Initializes empty task_classes for the task
    2. Sets default task_config
    3. Adds the task type to the project's task_types list

    - **project_id**: Project ID
    - **task_type**: Task type to add (classification, detection, segmentation, etc.)
    """
    # REFACTORING: Validate task type using task registry
    valid_task_types = [task_type.value for task_type in TaskType]
    if request.task_type not in valid_task_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid task type. Must be one of: {', '.join(valid_task_types)}",
        )

    # Get project
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

    # Check if task type already exists
    if project.task_types and request.task_type in project.task_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task type '{request.task_type}' already exists in this project",
        )

    # Initialize task_types if None or empty
    if not project.task_types:
        project.task_types = []

    # Add new task type
    project.task_types = project.task_types + [request.task_type]

    # REFACTORING: Initialize task_classes if None
    if not project.task_classes:
        project.task_classes = {}

    # Initialize classes for this task
    # Empty classes for this task (user can add classes later via class management endpoints)
    if request.task_type not in project.task_classes:
        project.task_classes[request.task_type] = {}

    # Initialize task_config if None
    if not project.task_config:
        project.task_config = {}

    # Set default config for this task type
    if request.task_type not in project.task_config:
        if request.task_type in ["detection", "bbox"]:
            project.task_config[request.task_type] = {
                "show_labels": True,
                "show_confidence": False,
            }
        elif request.task_type == "classification":
            project.task_config[request.task_type] = {
                "multi_label": False,
                "show_confidence": False,
            }
        elif request.task_type in ["segmentation", "polygon"]:
            project.task_config[request.task_type] = {
                "show_labels": True,
                "show_confidence": False,
            }
        else:
            project.task_config[request.task_type] = {}

    # Update last_updated_by
    project.last_updated_by = current_user.id

    labeler_db.commit()
    labeler_db.refresh(project)

    # Get dataset information
    dataset = platform_db.query(Dataset).filter(Dataset.id == project.dataset_id).first()

    # Get user information
    user = platform_db.query(User).filter(User.id == project.last_updated_by).first()

    response_dict = {
        **project.__dict__,
        "dataset_name": dataset.name if dataset else None,
        "dataset_num_items": dataset.num_images if dataset else None,
        "last_updated_by_name": user.full_name if user else None,
        "last_updated_by_email": user.email if user else None,
    }

    return ProjectResponse.model_validate(response_dict)


# Phase 2.7: Image Status Management Endpoints
@router.get("/{project_id}/images/status", response_model=ImageStatusListResponse, tags=["Image Status"])
async def get_project_image_statuses(
    project_id: str,
    task_type: Optional[str] = None,  # Phase 2.9: Filter by task type
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get annotation status for all images in a project.

    Phase 2.9: Supports task_type filtering for task-specific status.

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
    # Phase 2.9: Filter by task_type if provided
    query = labeler_db.query(ImageAnnotationStatus).filter(
        ImageAnnotationStatus.project_id == project_id
    )

    if task_type:
        query = query.filter(ImageAnnotationStatus.task_type == task_type)

    statuses = query.all()

    # Query for no_object annotations to determine has_no_object per image
    from sqlalchemy import and_
    no_object_query = labeler_db.query(Annotation.image_id).filter(
        Annotation.project_id == project_id,
        Annotation.annotation_type == 'no_object'
    )

    if task_type:
        # Filter no_object by task_type in attributes
        no_object_query = no_object_query.filter(
            Annotation.attributes['task_type'].astext == task_type
        )

    no_object_image_ids = set(row[0] for row in no_object_query.all())

    # Build response with has_no_object
    status_responses = []
    for s in statuses:
        status_dict = {
            'id': s.id,
            'project_id': s.project_id,
            'image_id': s.image_id,
            'task_type': s.task_type,
            'status': s.status,
            'first_modified_at': s.first_modified_at,
            'last_modified_at': s.last_modified_at,
            'confirmed_at': s.confirmed_at,
            'total_annotations': s.total_annotations,
            'confirmed_annotations': s.confirmed_annotations,
            'draft_annotations': s.draft_annotations,
            'is_image_confirmed': s.is_image_confirmed,
            'has_no_object': s.image_id in no_object_image_ids,
        }
        status_responses.append(ImageStatusResponse.model_validate(status_dict))

    return ImageStatusListResponse(
        statuses=status_responses,
        total=len(status_responses),
        project_id=project_id,
    )


@router.post("/{project_id}/images/{image_id:path}/confirm", response_model=ImageConfirmResponse, tags=["Image Status"])
async def confirm_image(
    project_id: str,
    image_id: str,
    task_type: Optional[str] = None,  # Phase 2.9: Task type for task-specific confirmation
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Confirm an image, marking all its annotations as confirmed.

    Phase 2.9: Supports task_type parameter for task-specific confirmation.

    This will:
    1. Confirm all draft annotations for the image (filtered by task_type if provided)
    2. Mark the image as confirmed (for the specific task if task_type provided)
    3. Update the image status to 'completed' (for the specific task if task_type provided)
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

    # REFACTORING: Check if image has any annotations for this task (prevent confirming empty images)
    # Use direct task_type column instead of ANNOTATION_TYPE_TO_TASK mapping
    all_annotations_query = labeler_db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.image_id == image_id,
    )

    if task_type:
        # Simple indexed lookup using task_type column
        all_annotations_query = all_annotations_query.filter(Annotation.task_type == task_type)

    total_annotations = all_annotations_query.count()

    if total_annotations == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm image: no annotations found for task '{task_type or 'all'}'. Add annotations or mark as 'No Object' first.",
        )

    # REFACTORING: Confirm all draft annotations for this image (filtered by task if provided)
    # Use direct task_type column (10x faster!)
    annotation_query = labeler_db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.image_id == image_id,
        Annotation.annotation_state == "draft",
    )

    # Filter by task_type using indexed column
    if task_type:
        annotation_query = annotation_query.filter(Annotation.task_type == task_type)

    draft_annotations = annotation_query.all()

    confirmed_count = 0
    for annotation in draft_annotations:
        annotation.annotation_state = "confirmed"
        annotation.confirmed_at = datetime.utcnow()
        annotation.confirmed_by = current_user.id
        annotation.updated_at = datetime.utcnow()
        confirmed_count += 1

    # Phase 2.7/2.9: Use service to update image status (with task_type)
    status_entry = await confirm_image_status(
        db=labeler_db,
        project_id=project_id,
        image_id=image_id,
        task_type=task_type,  # Phase 2.9: Pass task_type
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


@router.post("/{project_id}/images/{image_id:path}/unconfirm", response_model=ImageConfirmResponse, tags=["Image Status"])
async def unconfirm_image(
    project_id: str,
    image_id: str,
    task_type: Optional[str] = None,  # Phase 2.9: Task type for task-specific unconfirmation
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Unconfirm an image, reverting all its annotations back to draft state.

    Phase 2.9: Supports task_type parameter for task-specific unconfirmation.

    This will:
    1. Revert all confirmed annotations back to draft (filtered by task_type if provided)
    2. Mark the image as not confirmed (for the specific task if task_type provided)
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

    # REFACTORING: Unconfirm all confirmed annotations for this image (filtered by task if provided)
    # Use direct task_type column (10x faster!)
    annotation_query = labeler_db.query(Annotation).filter(
        Annotation.project_id == project_id,
        Annotation.image_id == image_id,
        Annotation.annotation_state == "confirmed",
    )

    # Filter by task_type using indexed column
    if task_type:
        annotation_query = annotation_query.filter(Annotation.task_type == task_type)

    confirmed_annotations = annotation_query.all()

    for annotation in confirmed_annotations:
        annotation.annotation_state = "draft"
        annotation.confirmed_at = None
        annotation.confirmed_by = None
        annotation.updated_at = datetime.utcnow()

    # Phase 2.7/2.9: Use service to update image status (with task_type)
    status_entry = await unconfirm_image_status(
        db=labeler_db,
        project_id=project_id,
        image_id=image_id,
        task_type=task_type,  # Phase 2.9: Pass task_type
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
