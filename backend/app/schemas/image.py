"""
Image Schemas

Pydantic models for image-related API requests and responses.
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class ImageMetadata(BaseModel):
    """Image metadata with presigned URL."""

    key: str = Field(..., description="S3 object key")
    filename: str = Field(..., description="Image filename")
    size: int = Field(..., description="File size in bytes")
    last_modified: str = Field(..., description="Last modified timestamp (ISO format)")
    url: str = Field(..., description="Presigned URL for accessing the image")
    width: Optional[int] = Field(None, description="Image width in pixels")
    height: Optional[int] = Field(None, description="Image height in pixels")


class ImageListResponse(BaseModel):
    """Response for listing images."""

    images: List[ImageMetadata] = Field(..., description="List of images")
    total: int = Field(..., description="Total number of images")
    dataset_id: str = Field(..., description="Dataset ID")
    project_id: str = Field(..., description="Project ID")


# Phase 2.7: Image Status Schemas
class ImageStatusResponse(BaseModel):
    """Image annotation status response.

    Phase 2.9: Added task_type for task-specific status.
    """

    id: int
    project_id: str
    image_id: str
    task_type: Optional[str] = None  # Phase 2.9: Task type (nullable for backward compatibility)
    status: str  # not-started, in-progress, completed
    first_modified_at: Optional[datetime] = None
    last_modified_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    total_annotations: int = 0
    confirmed_annotations: int = 0
    draft_annotations: int = 0
    is_image_confirmed: bool = False

    class Config:
        from_attributes = True


class ImageStatusListResponse(BaseModel):
    """Response for listing image statuses."""

    statuses: List[ImageStatusResponse]
    total: int
    project_id: str


class ImageConfirmRequest(BaseModel):
    """Request to confirm an image."""
    pass  # No additional fields needed


class ImageConfirmResponse(BaseModel):
    """Response after confirming an image."""

    image_id: str
    is_confirmed: bool
    confirmed_at: Optional[datetime] = None
    status: str
    total_annotations: int
    confirmed_annotations: int
