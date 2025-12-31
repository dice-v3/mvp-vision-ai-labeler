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


class AddTaskTypeRequest(BaseModel):
    """Add a new task type to project."""
    task_type: str  # 'classification', 'detection', 'segmentation', etc.

    class Config:
        json_schema_extra = {
            "example": {
                "task_type": "detection"
            }
        }


class ProjectResponse(BaseModel):
    """Annotation project response - REFACTORED."""
    id: str
    name: str
    description: Optional[str] = None
    dataset_id: str
    owner_id: str  # Keycloak user sub (UUID)
    task_types: List[str]
    task_config: Dict[str, Any]
    task_classes: Dict[str, Dict[str, Any]] = {}  # Task-based classes (REFACTORED: classes field removed)
    settings: Dict[str, Any]
    total_images: int
    annotated_images: int
    total_annotations: int
    status: str
    created_at: datetime
    updated_at: datetime
    last_updated_by: Optional[int] = None

    # Dataset information (joined)
    dataset_name: Optional[str] = None
    dataset_num_items: Optional[int] = None

    # User information (joined from Platform DB)
    last_updated_by_name: Optional[str] = None
    last_updated_by_email: Optional[str] = None

    class Config:
        from_attributes = True
