"""Dataset endpoints (read-only from Platform DB)."""

import uuid
import json
import boto3
from botocore.client import Config
from typing import List, Optional, Dict, Set
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_platform_db, get_labeler_db
from app.core.security import get_current_user
from app.core.config import settings
from app.db.models.platform import Dataset, User
from app.db.models.labeler import AnnotationProject, Annotation
from app.schemas.dataset import (
    DatasetResponse,
    DeleteDatasetRequest,
    DeleteDatasetResponse,
    DeletionImpactResponse,
)
from app.schemas.project import ProjectResponse
from app.services.dataset_delete_service import (
    calculate_deletion_impact,
    delete_dataset_complete,
)

router = APIRouter()


class ImageResponse(BaseModel):
    """Image response with presigned URL."""
    id: int
    file_name: str
    width: Optional[int] = None
    height: Optional[int] = None
    url: str  # Presigned URL for viewing

    class Config:
        from_attributes = True


def generate_distinct_color(index: int, total: int) -> str:
    """Generate visually distinct colors using HSL color space."""
    # Use golden ratio conjugate for better color distribution
    golden_ratio = 0.618033988749895
    hue = (index * golden_ratio) % 1.0

    # Use high saturation and medium lightness for vibrant, distinguishable colors
    saturation = 0.7
    lightness = 0.5

    # Convert HSL to RGB
    def hsl_to_rgb(h, s, l):
        c = (1 - abs(2 * l - 1)) * s
        x = c * (1 - abs((h * 6) % 2 - 1))
        m = l - c / 2

        if h < 1/6:
            r, g, b = c, x, 0
        elif h < 2/6:
            r, g, b = x, c, 0
        elif h < 3/6:
            r, g, b = 0, c, x
        elif h < 4/6:
            r, g, b = 0, x, c
        elif h < 5/6:
            r, g, b = x, 0, c
        else:
            r, g, b = c, 0, x

        r, g, b = int((r + m) * 255), int((g + m) * 255), int((b + m) * 255)
        return f"#{r:02x}{g:02x}{b:02x}"

    return hsl_to_rgb(hue, saturation, lightness)


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
        content = response['Body'].read().decode('utf-8')
        return json.loads(content)
    except Exception as e:
        print(f"Error loading annotations from S3: {e}")
        return None


def calculate_class_statistics(project_id: str, labeler_db: Session) -> Dict[str, Dict]:
    """Calculate bbox count and image count for each class from Labeler DB."""
    from collections import defaultdict

    # Query all annotations for this project
    annotations = labeler_db.query(Annotation).filter(
        Annotation.project_id == project_id
    ).all()

    # Calculate statistics per class
    class_stats = defaultdict(lambda: {'image_ids': set(), 'bbox_count': 0})

    for ann in annotations:
        class_id = ann.class_id
        if class_id:
            class_stats[class_id]['image_ids'].add(ann.image_id)
            class_stats[class_id]['bbox_count'] += 1

    # Convert to final format
    result = {}
    for class_id, stats in class_stats.items():
        result[class_id] = {
            'image_count': len(stats['image_ids']),
            'bbox_count': stats['bbox_count'],
        }

    return result


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
        # Initialize with EMPTY task types - users will add them manually
        task_types = []
        task_config = {}
        task_classes = {}
        classes = {}
        annotated_images = 0
        total_annotations = 0

        # If dataset is labeled, load existing annotations for statistics and classes
        # but DON'T auto-assign task types
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

                # Calculate per-class statistics
                from collections import defaultdict
                class_stats = defaultdict(lambda: {'image_ids': set(), 'bbox_count': 0})

                for ann in annotations_list:
                    cat_id = ann.get('category_id')
                    img_id = ann.get('image_id')
                    class_stats[cat_id]['image_ids'].add(img_id)
                    class_stats[cat_id]['bbox_count'] += 1

                # Extract classes from categories with generated colors and statistics
                # Store in legacy 'classes' field for now
                categories = annotations_data.get('categories', [])
                if categories:
                    total_categories = len(categories)
                    classes = {}
                    for idx, cat in enumerate(categories):
                        cat_id = str(cat['id'])
                        # Generate distinct color or use provided color
                        color = cat.get('color') or generate_distinct_color(idx, total_categories)

                        # Get statistics for this class
                        stats = class_stats.get(cat['id'], {'image_ids': set(), 'bbox_count': 0})

                        classes[cat_id] = {
                            'name': cat['name'],
                            'color': color,
                            'image_count': len(stats['image_ids']),
                            'bbox_count': stats['bbox_count'],
                        }

        project = AnnotationProject(
            id=f"proj_{uuid.uuid4().hex[:12]}",
            name=dataset.name,
            description=f"Annotation project for {dataset.name}",
            dataset_id=dataset_id,
            owner_id=current_user.id,
            task_types=task_types,
            task_config=task_config,
            task_classes=task_classes,  # Phase 2.9: Task-based classes
            classes=classes,  # Legacy field
            settings={},
            total_images=dataset.num_images or 0,
            annotated_images=annotated_images,
            total_annotations=total_annotations,
            status="active",
            last_updated_by=current_user.id,
        )
        labeler_db.add(project)
        labeler_db.commit()
        labeler_db.refresh(project)

    # Calculate real-time class statistics from Labeler DB
    live_class_stats = calculate_class_statistics(project.id, labeler_db)

    # Update project.classes with live statistics
    updated_classes = dict(project.classes) if project.classes else {}
    for class_id, class_info in updated_classes.items():
        stats = live_class_stats.get(class_id, {'image_count': 0, 'bbox_count': 0})
        class_info['image_count'] = stats['image_count']
        class_info['bbox_count'] = stats['bbox_count']

    # Get dataset name from Platform DB
    dataset_name = dataset.name

    # Fetch user info if last_updated_by is set
    last_updated_by_name = None
    last_updated_by_email = None
    if project.last_updated_by:
        user = platform_db.query(User).filter(User.id == project.last_updated_by).first()
        if user:
            last_updated_by_name = user.full_name
            last_updated_by_email = user.email

    # Build response
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        dataset_id=project.dataset_id,
        owner_id=project.owner_id,
        task_types=project.task_types,
        task_config=project.task_config,
        task_classes=project.task_classes or {},  # Phase 2.9: Task-based classes
        classes=updated_classes,  # Legacy field for backward compatibility
        settings=project.settings,
        total_images=project.total_images,
        annotated_images=project.annotated_images,
        total_annotations=project.total_annotations,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        last_updated_by=project.last_updated_by,
        last_updated_by_name=last_updated_by_name,
        last_updated_by_email=last_updated_by_email,
        dataset_name=dataset_name,
        dataset_num_items=dataset.num_images,
    )


@router.get("/{dataset_id}/images", response_model=List[ImageResponse], tags=["Datasets"])
async def list_dataset_images(
    dataset_id: str,
    limit: int = 12,
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get list of images for a dataset with presigned URLs.

    - **dataset_id**: Dataset ID
    - **limit**: Maximum number of images to return (default 12)
    """
    # Verify dataset exists
    dataset = platform_db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} not found",
        )

    images = []

    # Try to load annotations.json if available
    if dataset.annotation_path:
        annotations_data = load_annotations_from_s3(dataset.annotation_path)
        if annotations_data:
            images = annotations_data.get('images', [])

    # If no annotations.json or empty, list images directly from S3
    if not images:
        try:
            s3_client = boto3.client(
                's3',
                endpoint_url=settings.S3_ENDPOINT,
                aws_access_key_id=settings.S3_ACCESS_KEY,
                aws_secret_access_key=settings.S3_SECRET_KEY,
                region_name=settings.S3_REGION,
                config=Config(signature_version='s3v4')
            )

            # List objects in the images/ directory
            images_prefix = f"{dataset.storage_path.rstrip('/')}/images/"
            response = s3_client.list_objects_v2(
                Bucket=settings.S3_BUCKET_DATASETS,
                Prefix=images_prefix,
                MaxKeys=limit
            )

            # Convert S3 objects to image format
            if 'Contents' in response:
                for idx, obj in enumerate(response['Contents']):
                    # Get the full key
                    full_key = obj['Key']
                    # Skip if it's a directory marker
                    if full_key.endswith('/'):
                        continue

                    # Extract relative path from images/ directory
                    # e.g., "datasets/{id}/images/bottle/broken_large/000.png" -> "bottle/broken_large/000.png"
                    if '/images/' in full_key:
                        relative_path = full_key.split('/images/', 1)[1]
                    else:
                        relative_path = full_key.split('/')[-1]

                    if not relative_path:
                        continue

                    images.append({
                        'id': idx + 1,
                        'file_name': relative_path,  # Store relative path from images/
                        'width': None,
                        'height': None,
                    })
        except Exception as e:
            print(f"Error listing images from S3: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to list images: {str(e)}",
            )

    if not images:
        return []

    # Limit number of images
    images = images[:limit]

    # Generate presigned URLs
    s3_client = boto3.client(
        's3',
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=Config(signature_version='s3v4')
    )

    result = []
    for img in images:
        try:
            # Construct S3 key: datasets/{dataset_id}/images/{file_name}
            s3_key = f"{dataset.storage_path.rstrip('/')}/images/{img['file_name']}"
            print(f"DEBUG: Generating presigned URL for s3_key: {s3_key}")

            # Generate presigned URL (valid for 1 hour)
            url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': settings.S3_BUCKET_DATASETS,
                    'Key': s3_key
                },
                ExpiresIn=3600
            )
            print(f"DEBUG: Generated URL: {url}")

            result.append(ImageResponse(
                id=img['id'],
                file_name=img['file_name'],
                width=img.get('width'),
                height=img.get('height'),
                url=url
            ))
        except Exception as e:
            print(f"Error generating presigned URL for {img.get('file_name')}: {e}")
            continue

    return result


@router.get("/{dataset_id}/deletion-impact", response_model=DeletionImpactResponse, tags=["Datasets"])
async def get_deletion_impact(
    dataset_id: str,
    platform_db: Session = Depends(get_platform_db),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Preview the impact of deleting a dataset.

    Returns information about:
    - Number of projects that will be deleted
    - Number of images affected
    - Number of annotations that will be deleted
    - Number of export versions that will be deleted
    - Storage size that will be freed

    - **dataset_id**: Dataset ID
    """
    try:
        impact = calculate_deletion_impact(labeler_db, platform_db, dataset_id)
        return DeletionImpactResponse(**impact.to_dict())
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to calculate deletion impact: {str(e)}"
        )


@router.delete("/{dataset_id}", response_model=DeleteDatasetResponse, tags=["Datasets"])
async def delete_dataset(
    dataset_id: str,
    request: DeleteDatasetRequest,
    platform_db: Session = Depends(get_platform_db),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a dataset completely.

    This will:
    1. Delete all annotation projects for the dataset
    2. Delete all annotations in Labeler DB
    3. Delete all image annotation statuses
    4. Delete all export versions
    5. Delete all S3 files (images, annotations, exports)
    6. Delete the dataset record from Platform DB

    **IMPORTANT**: This is a destructive operation and cannot be undone.
    You must confirm by providing the exact dataset name.

    - **dataset_id**: Dataset ID
    - **request**: Deletion request with confirmation
    """
    # Verify dataset exists
    dataset = platform_db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} not found"
        )

    # Verify dataset name confirmation
    if request.dataset_name_confirmation != dataset.name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dataset name confirmation does not match. Expected: '{dataset.name}'"
        )

    # Check permissions - only owner can delete
    if dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the dataset owner can delete the dataset"
        )

    try:
        # Perform complete deletion
        result = delete_dataset_complete(
            labeler_db=labeler_db,
            platform_db=platform_db,
            dataset_id=dataset_id,
            create_backup=request.create_backup
        )

        return DeleteDatasetResponse(**result)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete dataset: {str(e)}"
        )
