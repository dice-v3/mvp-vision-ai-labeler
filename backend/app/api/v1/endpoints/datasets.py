"""Dataset endpoints (read-only from Platform DB)."""

import uuid
import json
import boto3
from typing import List, Optional, Dict, Set
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_platform_db, get_labeler_db
from app.core.security import get_current_user
from app.core.config import settings
from app.db.models.platform import Dataset, User
from app.db.models.labeler import AnnotationProject
from app.schemas.dataset import DatasetResponse
from app.schemas.project import ProjectResponse

router = APIRouter()


def load_annotations_from_s3(annotation_path: str) -> Optional[Dict]:
    """Load annotations.json from S3/MinIO storage."""
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION
        )

        response = s3_client.get_object(
            Bucket=settings.S3_BUCKET_DATASETS,
            Key=annotation_path
        )
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    except Exception as e:
        print(f"Error loading annotations from S3: {e}")
        return None


@router.get("", response_model=List[DatasetResponse], tags=["Datasets"])
async def list_datasets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get list of datasets from Platform database.

    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return (max 100)
    """
    # Query datasets with owner information
    datasets = (
        db.query(
            Dataset,
            User.full_name.label("owner_name"),
            User.email.label("owner_email"),
            User.badge_color.label("owner_badge_color"),
        )
        .join(User, Dataset.owner_id == User.id)
        .offset(skip)
        .limit(min(limit, 100))
        .all()
    )

    # Convert to response format
    result = []
    for dataset, owner_name, owner_email, owner_badge_color in datasets:
        dataset_dict = {
            **dataset.__dict__,
            "num_items": dataset.num_images or 0,  # Use num_images for Platform DB
            "source": dataset.storage_type or "upload",  # Use storage_type for Platform DB
            "owner_name": owner_name,
            "owner_email": owner_email,
            "owner_badge_color": owner_badge_color,
        }
        result.append(DatasetResponse.model_validate(dataset_dict))

    return result


@router.get("/{dataset_id}", response_model=DatasetResponse, tags=["Datasets"])
async def get_dataset(
    dataset_id: str,
    db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get dataset by ID from Platform database.

    - **dataset_id**: Dataset ID
    """
    # Query dataset with owner information
    result = (
        db.query(
            Dataset,
            User.full_name.label("owner_name"),
            User.email.label("owner_email"),
            User.badge_color.label("owner_badge_color"),
        )
        .join(User, Dataset.owner_id == User.id)
        .filter(Dataset.id == dataset_id)
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} not found",
        )

    dataset, owner_name, owner_email, owner_badge_color = result

    dataset_dict = {
        **dataset.__dict__,
        "num_items": dataset.num_images or 0,  # Use num_images for Platform DB
        "source": dataset.storage_type or "upload",  # Use storage_type for Platform DB
        "owner_name": owner_name,
        "owner_email": owner_email,
        "owner_badge_color": owner_badge_color,
    }

    return DatasetResponse.model_validate(dataset_dict)


@router.get("/{dataset_id}/project", response_model=ProjectResponse, tags=["Datasets"])
async def get_or_create_project_for_dataset(
    dataset_id: str,
    platform_db: Session = Depends(get_platform_db),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get or auto-create annotation project for dataset.

    This endpoint implements the 1:1 relationship between datasets and projects.
    If a project doesn't exist for the dataset, it will be created automatically
    with sensible defaults.

    - **dataset_id**: Dataset ID
    """
    # First, verify dataset exists in Platform DB
    dataset = platform_db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} not found",
        )

    # Check if project already exists in Labeler DB
    project = (
        labeler_db.query(AnnotationProject)
        .filter(AnnotationProject.dataset_id == dataset_id)
        .first()
    )

    # If not, create one with sensible defaults
    if not project:
        # Initialize default values
        task_types = ["classification"]
        task_config = {
            "classification": {
                "multi_label": False,
                "show_confidence": False,
            }
        }
        classes = {}
        annotated_images = 0
        total_annotations = 0

        # If dataset is labeled, load existing annotations
        if dataset.labeled and dataset.annotation_path:
            annotations_data = load_annotations_from_s3(dataset.annotation_path)
            if annotations_data:
                # Extract annotation statistics
                annotations_list = annotations_data.get('annotations', [])
                total_annotations = len(annotations_list)

                # Count unique annotated images
                annotated_image_ids: Set[int] = set()
                for ann in annotations_list:
                    annotated_image_ids.add(ann.get('image_id'))
                annotated_images = len(annotated_image_ids)

                # Extract classes from categories
                categories = annotations_data.get('categories', [])
                if categories:
                    classes = {
                        str(cat['id']): {
                            'name': cat['name'],
                            'color': cat.get('color', '#3b82f6'),  # Default blue
                        }
                        for cat in categories
                    }

                # Determine task types based on annotation structure
                # If annotations have 'bbox', it's detection
                if annotations_list and 'bbox' in annotations_list[0]:
                    task_types = ["detection"]
                    task_config = {
                        "detection": {
                            "show_labels": True,
                            "show_confidence": False,
                        }
                    }

        project = AnnotationProject(
            id=f"proj_{uuid.uuid4().hex[:12]}",
            name=dataset.name,
            description=f"Annotation project for {dataset.name}",
            dataset_id=dataset_id,
            owner_id=current_user.id,
            task_types=task_types,
            task_config=task_config,
            classes=classes,
            settings={},
            total_images=dataset.num_images or 0,
            annotated_images=annotated_images,
            total_annotations=total_annotations,
            status="active",
        )
        labeler_db.add(project)
        labeler_db.commit()
        labeler_db.refresh(project)

    # Get dataset name from Platform DB
    dataset_name = dataset.name

    # Build response
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        dataset_id=project.dataset_id,
        owner_id=project.owner_id,
        task_types=project.task_types,
        task_config=project.task_config,
        classes=project.classes,
        settings=project.settings,
        total_images=project.total_images,
        annotated_images=project.annotated_images,
        total_annotations=project.total_annotations,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        dataset_name=dataset_name,
    )
