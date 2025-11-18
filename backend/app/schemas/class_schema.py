"""Class management schemas."""

from typing import Optional
from pydantic import BaseModel, Field


class ClassInfo(BaseModel):
    """Class information."""
    name: str = Field(..., description="Class name")
    color: str = Field(..., description="Color in hex format (e.g., #FF5733)")
    description: Optional[str] = Field(None, description="Class description")

    class Config:
        from_attributes = True


class ClassCreateRequest(BaseModel):
    """Request to add a new class to a project."""
    class_id: str = Field(..., description="Unique class ID (e.g., '1', 'person', etc.)")
    name: str = Field(..., description="Class name")
    color: str = Field(..., description="Color in hex format (e.g., #FF5733)")
    description: Optional[str] = Field(None, description="Class description")


class ClassUpdateRequest(BaseModel):
    """Request to update a class."""
    name: Optional[str] = Field(None, description="New class name")
    color: Optional[str] = Field(None, description="New color in hex format")
    description: Optional[str] = Field(None, description="New description")


class ClassResponse(BaseModel):
    """Response after class operation."""
    class_id: str
    name: str
    color: str
    description: Optional[str] = None
    image_count: int = 0
    bbox_count: int = 0

    class Config:
        from_attributes = True
