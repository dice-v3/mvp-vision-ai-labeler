"""Dataset schemas."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from decimal import Decimal


class DatasetResponse(BaseModel):
    """Dataset information from Platform DB."""
    id: str
    name: str
    description: Optional[str] = None
    owner_id: int
    format: str
    source: str
    visibility: str
    labeled: bool
    num_items: int
    size_mb: Optional[Decimal] = None
    storage_path: Optional[str] = None
    tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    # Owner information (joined from User table)
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    owner_badge_color: Optional[str] = None

    class Config:
        from_attributes = True


class DeleteDatasetRequest(BaseModel):
    """Request to delete a dataset."""
    dataset_name_confirmation: str
    create_backup: bool = False

    class Config:
        json_schema_extra = {
            "example": {
                "dataset_name_confirmation": "My Dataset Name",
                "create_backup": False
            }
        }


class DeletionImpactResponse(BaseModel):
    """Preview of what will be deleted."""
    dataset_id: str
    dataset_name: str
    projects: List[Dict[str, Any]]
    total_projects: int
    total_images: int
    total_annotations: int
    total_versions: int
    storage_size_mb: float
    file_counts: Dict[str, int]

    class Config:
        from_attributes = True


class DeleteDatasetResponse(BaseModel):
    """Response after dataset deletion."""
    dataset_id: str
    dataset_name: str
    deleted: bool
    backup_created: bool
    backup_files: Dict[str, str]
    labeler_deletions: Dict[str, int]
    s3_deletions: Dict[str, int]
    impact: DeletionImpactResponse

    class Config:
        from_attributes = True
