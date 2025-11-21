"""Dataset schemas."""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal


class DatasetCreate(BaseModel):
    """Schema for creating a new dataset."""
    name: str = Field(..., min_length=1, max_length=200, description="Dataset name")
    description: Optional[str] = Field(None, description="Dataset description")
    task_types: Optional[List[str]] = Field(default=[], description="Task types (e.g., ['detection', 'classification']). Can be empty and added later.")
    visibility: Optional[str] = Field(default="private", description="Dataset visibility (private or public)")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "My Dataset",
                "description": "A dataset for object detection",
                "task_types": [],
                "visibility": "private"
            }
        }


class DatasetUpdate(BaseModel):
    """Schema for updating dataset information."""
    name: str = Field(..., min_length=1, max_length=200, description="Dataset name")
    description: Optional[str] = Field(None, description="Dataset description")
    visibility: Optional[str] = Field(None, description="Dataset visibility (private or public)")

    class Config:
        json_schema_extra = {
            "example": {
                "name": "Updated Dataset Name",
                "description": "Updated description",
                "visibility": "private"
            }
        }


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
