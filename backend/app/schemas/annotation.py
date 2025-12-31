"""Annotation schemas."""

from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel


class AnnotationCreate(BaseModel):
    """Create annotation request."""
    project_id: str
    image_id: str
    annotation_type: str  # classification, bbox, rotated_bbox, polygon, line, open_vocab
    geometry: Dict[str, Any]  # Flexible geometry data
    class_id: Optional[str] = None
    class_name: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None
    confidence: Optional[int] = None  # 0-100
    notes: Optional[str] = None


class AnnotationUpdate(BaseModel):
    """Update annotation request."""
    geometry: Optional[Dict[str, Any]] = None
    class_id: Optional[str] = None
    class_name: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None
    confidence: Optional[int] = None
    is_verified: Optional[bool] = None
    notes: Optional[str] = None

    # Phase 8.5.1: Optimistic locking
    version: Optional[int] = None  # Current version for conflict detection


class AnnotationResponse(BaseModel):
    """Annotation response."""
    id: int
    project_id: str
    image_id: str
    annotation_type: str
    geometry: Dict[str, Any]
    class_id: Optional[str] = None
    class_name: Optional[str] = None
    attributes: Dict[str, Any]
    confidence: Optional[int] = None
    created_by: str  # Keycloak user sub (UUID)
    updated_by: Optional[str] = None  # Keycloak user sub (UUID)
    is_verified: bool
    notes: Optional[str] = None

    # Phase 8.5.1: Optimistic locking
    version: int

    # Phase 2.7: Confirmation fields
    annotation_state: str = "draft"  # draft, confirmed, verified
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None  # Keycloak user sub (UUID)

    created_at: datetime
    updated_at: datetime

    # User information (joined from Platform DB)
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None
    confirmed_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class AnnotationHistoryResponse(BaseModel):
    """Annotation history response."""
    id: int
    annotation_id: int
    project_id: str
    action: str  # create, update, delete, restore
    previous_state: Optional[Dict[str, Any]] = None
    new_state: Optional[Dict[str, Any]] = None
    changed_by: str  # Keycloak user sub (UUID)
    timestamp: datetime

    # User information
    changed_by_name: Optional[str] = None
    changed_by_email: Optional[str] = None

    class Config:
        from_attributes = True


class AnnotationBatchCreate(BaseModel):
    """Batch create annotations request."""
    annotations: List[AnnotationCreate]


class AnnotationBatchResponse(BaseModel):
    """Batch create annotations response."""
    created: int
    failed: int
    annotation_ids: List[int]
    errors: List[str] = []


# Phase 2.7: Confirmation Schemas
class AnnotationConfirmRequest(BaseModel):
    """Confirm annotation request."""
    pass  # No additional fields needed - just POST to confirm


class BulkConfirmRequest(BaseModel):
    """Bulk confirm annotations request."""
    annotation_ids: List[int]


class ConfirmResponse(BaseModel):
    """Confirmation response."""
    annotation_id: int
    annotation_state: str
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None  # Keycloak user sub (UUID)
    confirmed_by_name: Optional[str] = None


class BulkConfirmResponse(BaseModel):
    """Bulk confirm response."""
    confirmed: int
    failed: int
    results: List[ConfirmResponse]
    errors: List[str] = []
