"""
Image Schemas

Pydantic models for image-related API requests and responses.
"""

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
