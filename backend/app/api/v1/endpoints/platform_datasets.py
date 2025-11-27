"""
Platform Dataset API Endpoints (Phase 16.2)

Read-only dataset query endpoints for Platform team.
Authenticated via service accounts with 'datasets:read' scope.

These endpoints allow Platform to:
- Query dataset metadata for training jobs
- Check user permissions on datasets
- List available datasets with filters

All endpoints require service account authentication.
"""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_labeler_db, get_user_db
from app.core.security import get_current_service_account, require_scope
from app.db.models.labeler import Dataset, DatasetPermission, ServiceAccount
from app.db.models.user import User
from app.schemas.platform import (
    PlatformDatasetResponse,
    PlatformDatasetListResponse,
    PlatformDatasetBatchRequest,
    PlatformDatasetBatchResponse,
    PlatformDatasetBatchItem,
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


def _dataset_to_platform_response(dataset: Dataset) -> PlatformDatasetResponse:
    """Convert Dataset model to PlatformDatasetResponse."""
    return PlatformDatasetResponse(
        id=dataset.id,
        name=dataset.name,
        description=dataset.description,
        format=dataset.format,
        labeled=dataset.labeled,
        storage_type=dataset.storage_type,
        storage_path=dataset.storage_path,
        annotation_path=dataset.annotation_path,
        num_classes=dataset.num_classes,
        num_images=dataset.num_images,
        class_names=_parse_json_field(dataset.class_names),
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
    service_account: ServiceAccount = Depends(get_current_service_account),
    _scope: ServiceAccount = Depends(require_scope("datasets:read")),
    db: Session = Depends(get_labeler_db),
):
    """
    Get dataset metadata by ID (Platform API).

    This endpoint is used by Platform for training job creation.
    Requires service account with 'datasets:read' scope.

    Args:
        dataset_id: Dataset ID (e.g., 'ds_c75023ca76d7448b')
        service_account: Authenticated service account
        db: Database session

    Returns:
        Complete dataset metadata

    Raises:
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
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Items per page (max 200)"),
    service_account: ServiceAccount = Depends(get_current_service_account),
    _scope: ServiceAccount = Depends(require_scope("datasets:read")),
    db: Session = Depends(get_labeler_db),
):
    """
    List datasets with filters (Platform API).

    Used by Platform to show available datasets for training jobs.
    Requires service account with 'datasets:read' scope.

    Query Parameters:
        - user_id: Filter by owner
        - visibility: public/private/organization
        - labeled: true/false
        - format: coco/yolo/dice/imagefolder
        - page: Page number (default 1)
        - limit: Items per page (default 50, max 200)

    Returns:
        Paginated list of datasets

    Example:
        GET /api/v1/platform/datasets?visibility=public&labeled=true&limit=10
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

    # Get total count
    total = query.count()

    # Apply pagination
    offset = (page - 1) * limit
    datasets = query.order_by(Dataset.created_at.desc()).offset(offset).limit(limit).all()

    return PlatformDatasetListResponse(
        total=total,
        page=page,
        limit=limit,
        datasets=[_dataset_to_platform_response(ds) for ds in datasets],
    )


@router.post(
    "/batch",
    response_model=PlatformDatasetBatchResponse,
    tags=["Platform Integration"],
    summary="Get multiple datasets (Platform)",
)
async def get_datasets_batch_for_platform(
    request: PlatformDatasetBatchRequest,
    service_account: ServiceAccount = Depends(get_current_service_account),
    _scope: ServiceAccount = Depends(require_scope("datasets:read")),
    db: Session = Depends(get_labeler_db),
):
    """
    Get multiple datasets in a single request (Platform API).

    Used by Platform to fetch dataset metadata for multiple training jobs.
    Requires service account with 'datasets:read' scope.

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
