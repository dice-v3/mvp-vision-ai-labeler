"""Annotation project endpoints."""

from typing import List
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_platform_db, get_labeler_db
from app.core.security import get_current_user
from app.core.storage import storage_client
from app.db.models.platform import User, Dataset
from app.db.models.labeler import AnnotationProject
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.schemas.image import ImageListResponse, ImageMetadata

router = APIRouter()


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
