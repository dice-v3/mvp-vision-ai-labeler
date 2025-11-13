"""Annotation project schemas."""

from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class ProjectCreate(BaseModel):
    """Create annotation project request."""
    name: str
    description: Optional[str] = None
    dataset_id: str
    task_types: List[str]  # ["classification", "bbox", "polygon", etc.]
    task_config: Dict[str, Any]  # Task-specific configuration
    classes: Dict[str, Any]  # Class definitions
    settings: Optional[Dict[str, Any]] = None


class ProjectUpdate(BaseModel):
    """Update annotation project request."""
    name: Optional[str] = None
    description: Optional[str] = None
    task_config: Optional[Dict[str, Any]] = None
    classes: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class ProjectResponse(BaseModel):
    """Annotation project response."""
    id: str
    name: str
    description: Optional[str] = None
    dataset_id: str
    owner_id: int
    task_types: List[str]
    task_config: Dict[str, Any]
    classes: Dict[str, Any]
    settings: Dict[str, Any]
    total_images: int
    annotated_images: int
    total_annotations: int
    status: str
    created_at: datetime
    updated_at: datetime

    # Dataset information (joined)
    dataset_name: Optional[str] = None
    dataset_num_items: Optional[int] = None

    class Config:
        from_attributes = True
