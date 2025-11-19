"""Class management schemas."""

from typing import Optional, List
from pydantic import BaseModel, Field


class ClassInfo(BaseModel):
    """Class information."""
    name: str = Field(..., description="Class name")
    color: str = Field(..., description="Color in hex format (e.g., #FF5733)")
    description: Optional[str] = Field(None, description="Class description")
    order: int = Field(0, description="Display order (0-based)")

    class Config:
        from_attributes = True


class ClassCreateRequest(BaseModel):
    """Request to add a new class to a project."""
    # class_id is now optional - will be auto-generated if not provided
    class_id: Optional[str] = Field(None, description="Unique class ID (auto-generated if not provided)")
    name: str = Field(..., description="Class name")
    color: str = Field(..., description="Color in hex format (e.g., #FF5733)")
    description: Optional[str] = Field(None, description="Class description")


class ClassUpdateRequest(BaseModel):
    """Request to update a class."""
    name: Optional[str] = Field(None, description="New class name")
    color: Optional[str] = Field(None, description="New color in hex format")
    description: Optional[str] = Field(None, description="New description")
    order: Optional[int] = Field(None, description="New display order")


class ClassReorderRequest(BaseModel):
    """Request to reorder classes."""
    class_ids: List[str] = Field(..., description="List of class IDs in desired order")


class ClassResponse(BaseModel):
    """Response after class operation."""
    class_id: str
    name: str
    color: str
    description: Optional[str] = None
    order: int = 0
    image_count: int = 0
    bbox_count: int = 0

    class Config:
        from_attributes = True
