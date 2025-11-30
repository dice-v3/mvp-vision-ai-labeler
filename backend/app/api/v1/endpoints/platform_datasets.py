"""
Platform Dataset API Endpoints (Phase 16.5)

Read-only dataset query endpoints for Platform team.

Uses Hybrid JWT authentication for secure service-to-service communication.

These endpoints allow Platform to:
- Query dataset metadata for training jobs
- Check user permissions on datasets
- List available datasets with filters
- Generate presigned download URLs
"""

import json
from datetime import datetime
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_labeler_db, get_user_db
from app.core.service_jwt import (
    get_service_jwt_payload,
    require_service_scope,
    extract_user_id_from_jwt,
)
from app.db.models.labeler import Dataset, DatasetPermission
from app.db.models.user import User
from app.schemas.platform import (
    PlatformDatasetResponse,
    PlatformDatasetListResponse,
    PlatformDatasetBatchRequest,
    PlatformDatasetBatchResponse,
    PlatformDatasetBatchItem,
    PlatformPermissionCheckResponse,
    PlatformDownloadUrlRequest,
    PlatformDownloadUrlResponse,
    PlatformDownloadManifest,
)

router = APIRouter()


def _parse_json_field(field_value: Optional[str]) -> Optional[List[str]]:
    """Parse JSON string field to list."""
    if not field_value:
        return None
    try:
        parsed = json.loads(field_value)
        return parsed if isinstance(parsed, list) else None
    except (json.JSONDecodeError, TypeError):
        return None


def _dataset_to_platform_response(
    dataset: Dataset,
    db: Session = None,
    task_type: Optional[str] = None,
) -> PlatformDatasetResponse:
    """
    Convert Dataset model to PlatformDatasetResponse.

    If task_type is provided, returns task-specific statistics from latest AnnotationVersion.
    Otherwise, returns dataset-level statistics.
    """
    from app.db.models.labeler import AnnotationProject, AnnotationVersion

    # Default values from Dataset table
    num_classes = dataset.num_classes
    num_images = dataset.num_images
    class_names = _parse_json_field(dataset.class_names)
    annotation_path = dataset.annotation_path

    # Phase 16.6: If task_type provided, get task-specific statistics
    if task_type and db:
        # Find the project for this dataset
        project = db.query(AnnotationProject).filter(
            AnnotationProject.dataset_id == dataset.id
        ).first()

        if project:
            # Get latest version for this task_type
            latest_version = (
                db.query(AnnotationVersion)
                .filter(
                    AnnotationVersion.project_id == project.id,
                    AnnotationVersion.task_type == task_type,
                )
                .order_by(AnnotationVersion.created_at.desc())
                .first()
            )

            if latest_version:
                # Use task-specific statistics
                num_images = latest_version.image_count or num_images
                annotation_path = latest_version.export_path
                # num_classes would need to be extracted from export_path JSON
                # For now, keep dataset-level num_classes

    return PlatformDatasetResponse(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description,
        format=dataset.format,
        labeled=dataset.labeled,
        storage_type=dataset.storage_type,
        storage_path=dataset.storage_path,
        annotation_path=annotation_path,
        num_classes=num_classes,
        num_images=num_images,
        class_names=class_names,
        published_task_types=dataset.published_task_types or [],  # Phase 16.6
        tags=_parse_json_field(dataset.tags),
        visibility=dataset.visibility,
        owner_id=dataset.owner_id,
        version=dataset.version,
        content_hash=dataset.content_hash,
        created_at=dataset.created_at,
        updated_at=dataset.updated_at,
    )


@router.get(
    "/{dataset_id}",
    response_model=PlatformDatasetResponse,
    tags=["Platform Integration"],
    summary="Get dataset by ID (Platform)",
)
async def get_dataset_for_platform(
    dataset_id: str,
    jwt_payload: Dict[str, Any] = Depends(get_service_jwt_payload),
    _scope: Dict = Depends(require_service_scope("labeler:read")),
    db: Session = Depends(get_labeler_db),
):
    """
    Get dataset metadata by ID (Platform API).

    This endpoint is used by Platform for training job creation.
    Requires Hybrid JWT with 'labeler:read' scope.

    Args:
        dataset_id: Dataset ID (e.g., 'ds_c75023ca76d7448b')
        jwt_payload: Authenticated JWT payload from Platform
        db: Database session

    Returns:
        Complete dataset metadata

    Raises:
        401: Invalid or missing JWT
        403: Insufficient permissions
        404: Dataset not found
    """
    # Query dataset
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} not found",
        )

    return _dataset_to_platform_response(dataset)


@router.get(
    "",
    response_model=PlatformDatasetListResponse,
    tags=["Platform Integration"],
    summary="List datasets (Platform)",
)
async def list_datasets_for_platform(
    user_id: Optional[int] = Query(None, description="Filter by owner user ID"),
    visibility: Optional[str] = Query(None, description="Filter by visibility (public/private/organization)"),
    labeled: Optional[bool] = Query(None, description="Filter by labeled status"),
    format: Optional[str] = Query(None, description="Filter by format (coco/yolo/dice/imagefolder)"),
    task_type: Optional[str] = Query(None, description="Filter by task type (detection/segmentation/classification)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Items per page (max 200)"),
    jwt_payload: Dict[str, Any] = Depends(get_service_jwt_payload),
    _scope: Dict = Depends(require_service_scope("labeler:read")),
    db: Session = Depends(get_labeler_db),
):
    """
    List datasets with filters (Platform API).

    Used by Platform to show available datasets for training jobs.
    Requires Hybrid JWT with 'labeler:read' scope.

    Query Parameters:
        - user_id: Filter by owner
        - visibility: public/private/organization
        - labeled: true/false
        - format: coco/yolo/dice/imagefolder
        - task_type: Filter by published task type (detection/segmentation/classification)
        - page: Page number (default 1)
        - limit: Items per page (default 50, max 200)

    Returns:
        Paginated list of datasets

    Example:
        GET /api/v1/platform/datasets?visibility=public&labeled=true&task_type=detection&limit=10
    """
    # Build query
    query = db.query(Dataset)

    # Apply filters
    if user_id is not None:
        query = query.filter(Dataset.owner_id == user_id)
    if visibility:
        query = query.filter(Dataset.visibility == visibility)
    if labeled is not None:
        query = query.filter(Dataset.labeled == labeled)
    if format:
        query = query.filter(Dataset.format == format)
    if task_type:
        # Phase 16.6: Filter by published task type using PostgreSQL array containment
        # This uses the GIN index created in migration for efficient querying
        query = query.filter(Dataset.published_task_types.contains([task_type]))

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * limit
    datasets = query.order_by(Dataset.created_at.desc()).offset(offset).limit(limit).all()

    return PlatformDatasetListResponse(
        total=total,
        page=page,
        limit=limit,
        datasets=[_dataset_to_platform_response(ds, db=db, task_type=task_type) for ds in datasets],
    )


@router.post(
    "/batch",
    response_model=PlatformDatasetBatchResponse,
    tags=["Platform Integration"],
    summary="Get multiple datasets (Platform)",
)
async def get_datasets_batch_for_platform(
    request: PlatformDatasetBatchRequest,
    jwt_payload: Dict[str, Any] = Depends(get_service_jwt_payload),
    _scope: Dict = Depends(require_service_scope("labeler:read")),
    db: Session = Depends(get_labeler_db),
):
    """
    Get multiple datasets in a single request (Platform API).

    Used by Platform to fetch dataset metadata for multiple training jobs.
    Requires Hybrid JWT with 'labeler:read' scope.

    Request Body:
        {
            "dataset_ids": ["ds_123", "ds_456", "ds_789"],
            "fields": ["id", "name", "num_images", "format", "storage_path"]  // optional
        }

    Returns:
        Dict mapping dataset_id -> dataset data
        Missing datasets are listed in errors

    Example:
        POST /api/v1/platform/datasets/batch
        {
            "dataset_ids": ["ds_c75023ca76d7448b", "ds_abc123"],
            "fields": ["id", "name", "num_images"]
        }
    """
    datasets_dict = {}
    errors_dict = {}

    # Query all requested datasets
    datasets = db.query(Dataset).filter(Dataset.id.in_(request.dataset_ids)).all()

    # Create lookup dict
    found_datasets = {ds.id: ds for ds in datasets}

    # Process each requested ID
    for dataset_id in request.dataset_ids:
        if dataset_id in found_datasets:
            dataset = found_datasets[dataset_id]

            # If specific fields requested, return partial response
            if request.fields:
                partial_data = {"id": dataset.id}
                for field in request.fields:
                    if field == "id":
                        continue  # Already included
                    elif field == "name":
                        partial_data["name"] = dataset.name
                    elif field == "format":
                        partial_data["format"] = dataset.format
                    elif field == "num_images":
                        partial_data["num_images"] = dataset.num_images
                    elif field == "storage_path":
                        partial_data["storage_path"] = dataset.storage_path
                    elif field == "num_classes":
                        partial_data["num_classes"] = dataset.num_classes
                    elif field == "class_names":
                        partial_data["class_names"] = _parse_json_field(dataset.class_names)
                    elif field == "labeled":
                        partial_data["labeled"] = dataset.labeled
                    elif field == "visibility":
                        partial_data["visibility"] = dataset.visibility
                    elif field == "owner_id":
                        partial_data["owner_id"] = dataset.owner_id

                datasets_dict[dataset_id] = PlatformDatasetBatchItem(**partial_data)
            else:
                # Return full dataset response
                datasets_dict[dataset_id] = _dataset_to_platform_response(dataset)
        else:
            # Dataset not found
            datasets_dict[dataset_id] = None
            errors_dict[dataset_id] = "Dataset not found"

    return PlatformDatasetBatchResponse(
        datasets=datasets_dict,
        errors=errors_dict,
    )


@router.get(
    "/{dataset_id}/permissions/{user_id}",
    response_model=PlatformPermissionCheckResponse,
    tags=["Platform Integration"],
    summary="Check user dataset permission (Platform)",
)
async def check_dataset_permission_for_platform(
    dataset_id: str,
    user_id: int,
    jwt_payload: Dict[str, Any] = Depends(get_service_jwt_payload),
    _scope: Dict = Depends(require_service_scope("labeler:read")),
    labeler_db: Session = Depends(get_labeler_db),
    user_db: Session = Depends(get_user_db),
):
    """
    Check if a user has access to a dataset (Platform API).

    Used by Platform to verify user permissions before training job creation.
    Requires Hybrid JWT with 'labeler:read' scope.

    Permission Logic:
    1. Owner: User owns the dataset (dataset.owner_id == user_id)
    2. Public: Dataset is public (visibility == 'public')
    3. Explicit Permission: User has DatasetPermission record
    4. Organization Member: User is in same organization as owner (TODO)

    Args:
        dataset_id: Dataset ID
        user_id: User ID to check
        jwt_payload: Authenticated JWT payload from Platform
        labeler_db: Labeler database session
        user_db: User database session

    Returns:
        Permission check result with access status and reason

    Raises:
        401: Invalid or missing JWT
        403: Insufficient permissions
        404: Dataset not found

    Example:
        GET /api/v1/platform/datasets/ds_c75023ca76d7448b/permissions/42
        Response:
        {
            "dataset_id": "ds_c75023ca76d7448b",
            "user_id": 42,
            "has_access": true,
            "role": "owner",
            "reason": "owner"
        }
    """
    # Query dataset
    dataset = labeler_db.query(Dataset).filter(Dataset.id == dataset_id).first()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} not found",
        )

    # Check 1: Owner
    if dataset.owner_id == user_id:
        return PlatformPermissionCheckResponse(
            dataset_id=dataset_id,
            user_id=user_id,
            has_access=True,
            role="owner",
            reason="owner",
        )

    # Check 2: Public dataset
    if dataset.visibility == "public":
        # Check if user has explicit permission (to determine role)
        permission = (
            labeler_db.query(DatasetPermission)
            .filter(
                DatasetPermission.dataset_id == dataset_id,
                DatasetPermission.user_id == user_id,
            )
            .first()
        )

        return PlatformPermissionCheckResponse(
            dataset_id=dataset_id,
            user_id=user_id,
            has_access=True,
            role=permission.role if permission else None,
            reason="public_dataset",
        )

    # Check 3: Explicit permission
    permission = (
        labeler_db.query(DatasetPermission)
        .filter(
            DatasetPermission.dataset_id == dataset_id,
            DatasetPermission.user_id == user_id,
        )
        .first()
    )

    if permission:
        return PlatformPermissionCheckResponse(
            dataset_id=dataset_id,
            user_id=user_id,
            has_access=True,
            role=permission.role,
            reason="explicit_permission",
        )

    # Check 4: Organization member (TODO - requires organization membership logic)
    # For now, we'll skip this check as it requires cross-DB joins
    # and organization membership tables
    #
    # user = user_db.query(User).filter(User.id == user_id).first()
    # owner = user_db.query(User).filter(User.id == dataset.owner_id).first()
    # if user and owner and user.organization_id == owner.organization_id:
    #     return PlatformPermissionCheckResponse(
    #         dataset_id=dataset_id,
    #         user_id=user_id,
    #         has_access=True,
    #         role="member",
    #         reason="organization_member",
    #     )

    # No access
    return PlatformPermissionCheckResponse(
        dataset_id=dataset_id,
        user_id=user_id,
        has_access=False,
        role=None,
        reason="no_access",
    )


@router.post(
    "/{dataset_id}/download-url",
    response_model=PlatformDownloadUrlResponse,
    tags=["Platform Integration"],
    summary="Generate download URL (Platform)",
)
async def generate_download_url_for_platform(
    dataset_id: str,
    request: PlatformDownloadUrlRequest,
    jwt_payload: Dict[str, Any] = Depends(get_service_jwt_payload),
    _scope: Dict = Depends(require_service_scope("labeler:read")),
    labeler_db: Session = Depends(get_labeler_db),
):
    """
    Generate presigned download URL for dataset (Platform API).

    Used by Platform training service to download datasets.
    Requires Hybrid JWT with 'labeler:read' scope.

    Note: Currently generates presigned URL for annotation file.
    Full dataset ZIP packaging will be added in future iteration.

    Args:
        dataset_id: Dataset ID
        request: Download request (expiration, purpose)
        jwt_payload: Authenticated JWT payload from Platform
        labeler_db: Database session

    Returns:
        Presigned download URL with expiration time

    Raises:
        401: Invalid or missing JWT
        403: User lacks access to dataset or insufficient permissions
        404: Dataset not found

    Example:
        POST /api/v1/platform/datasets/ds_c75023ca76d7448b/download-url
        {
            "expiration_seconds": 3600,
            "purpose": "training_job_123"
        }
    """
    from app.core.storage import StorageClient
    from datetime import timedelta

    # Extract user_id from JWT (not from request body for security)
    user_id = extract_user_id_from_jwt(jwt_payload)

    # Query dataset
    dataset = labeler_db.query(Dataset).filter(Dataset.id == dataset_id).first()

    if not dataset:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} not found",
        )

    # Check user permission (same logic as permission check endpoint)
    has_access = False
    role = None

    # Check 1: Owner
    if dataset.owner_id == user_id:
        has_access = True
        role = "owner"
    # Check 2: Public dataset
    elif dataset.visibility == "public":
        has_access = True
    # Check 3: Explicit permission
    else:
        permission = (
            labeler_db.query(DatasetPermission)
            .filter(
                DatasetPermission.dataset_id == dataset_id,
                DatasetPermission.user_id == user_id,
            )
            .first()
        )
        if permission:
            has_access = True
            role = permission.role

    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User {user_id} does not have access to dataset {dataset_id}",
        )

    # Generate presigned URL for annotation file
    # TODO: In future, generate ZIP archive with all dataset files
    storage = StorageClient()

    if dataset.annotation_path:
        # Generate presigned URL for annotation file
        annotation_key = f"datasets/{dataset_id}/{dataset.annotation_path}"
        download_url = storage.generate_presigned_url(
            bucket=storage.datasets_bucket,
            key=annotation_key,
            expiration=request.expiration_seconds,
        )
    else:
        # No annotation file, return error
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} has no annotation file",
        )

    # Calculate expiration time
    expires_at = datetime.utcnow() + timedelta(seconds=request.expiration_seconds)

    # Create manifest
    manifest = PlatformDownloadManifest(
        images=f"datasets/{dataset_id}/images/",
        annotations=dataset.annotation_path,
        readme="README.md",
    )

    return PlatformDownloadUrlResponse(
        dataset_id=dataset_id,
        download_url=download_url,
        expires_at=expires_at,
        format="json",  # Currently annotation file only, will be "zip" when full packaging is implemented
        size_bytes=None,  # TODO: Get file size from S3 metadata
        manifest=manifest,
    )
