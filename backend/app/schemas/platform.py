"""
Platform Integration Schemas (Phase 16)

Response schemas for Platform team API endpoints.
These schemas provide dataset metadata for training jobs.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class PlatformDatasetResponse(BaseModel):
    """
    Dataset response schema for Platform API.

    Used by Platform team for training job creation.
    Contains complete dataset metadata from Labeler DB.
    """
    id: str
    name: str
    description: Optional[str] = None
    format: str  # 'coco', 'yolo', 'dice', 'imagefolder'
    labeled: bool
    storage_type: str  # 'r2', 's3'
    storage_path: str
    annotation_path: Optional[str] = None

    # Statistics
    num_classes: Optional[int] = None
    num_images: int
    class_names: Optional[List[str]] = None

    # Metadata
    tags: Optional[List[str]] = None
    visibility: str  # 'private', 'public', 'organization'
    owner_id: int

    # Versioning
    version: int
    content_hash: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PlatformDatasetListResponse(BaseModel):
    """
    Paginated list of datasets for Platform API.
    """
    total: int
    page: int
    limit: int
    datasets: List[PlatformDatasetResponse]


class PlatformDatasetBatchRequest(BaseModel):
    """
    Request schema for batch dataset query.

    Platform can request multiple datasets at once.
    """
    dataset_ids: List[str] = Field(..., min_items=1, max_items=50, description="Dataset IDs to fetch")
    fields: Optional[List[str]] = Field(
        None,
        description="Specific fields to return (optional). If None, returns all fields."
    )


class PlatformDatasetBatchItem(BaseModel):
    """
    Single dataset item in batch response.
    Can be partial if specific fields were requested.
    """
    id: str
    name: Optional[str] = None
    format: Optional[str] = None
    num_images: Optional[int] = None
    storage_path: Optional[str] = None
    # ... other fields are optional based on request


class PlatformDatasetBatchResponse(BaseModel):
    """
    Response schema for batch dataset query.

    Returns dict of dataset_id -> dataset data.
    Missing or forbidden datasets are listed in errors.
    """
    datasets: Dict[str, Optional[PlatformDatasetBatchItem]]
    errors: Dict[str, str] = {}  # dataset_id -> error message


class PlatformPermissionCheckResponse(BaseModel):
    """
    Response schema for permission check.

    Tells Platform whether a user can access a dataset.
    """
    dataset_id: str
    user_id: int
    has_access: bool
    role: Optional[str] = None  # 'owner' or 'member'
    reason: str  # 'owner', 'public_dataset', 'organization_member', 'explicit_permission', 'no_access'


class PlatformDownloadUrlRequest(BaseModel):
    """
    Request schema for generating dataset download URL.
    """
    user_id: int = Field(..., description="User ID requesting download")
    expiration_seconds: int = Field(3600, ge=60, le=86400, description="URL expiration time (60s - 24h)")
    purpose: Optional[str] = Field(None, description="Purpose of download (e.g., 'training_job_123')")


class PlatformDownloadManifest(BaseModel):
    """
    Manifest describing the contents of the download.
    """
    images: str = "images/"
    annotations: Optional[str] = None
    readme: str = "README.md"


class PlatformDownloadUrlResponse(BaseModel):
    """
    Response schema for dataset download URL.

    Contains presigned R2 URL for Platform training service to download.
    """
    dataset_id: str
    download_url: str
    expires_at: datetime
    format: str = "zip"
    size_bytes: Optional[int] = None
    manifest: PlatformDownloadManifest
