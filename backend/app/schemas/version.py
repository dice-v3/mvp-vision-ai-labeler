"""Version management schemas."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class VersionPublishRequest(BaseModel):
    """Publish new version request."""
    task_type: str  # Phase 2.9: Task type (classification, detection, segmentation)
    version_number: Optional[str] = None  # Auto-generated if not provided (e.g., "v1.0")
    description: Optional[str] = None
    export_format: str  # 'coco' | 'yolo' | 'dice'
    include_draft: bool = False  # Whether to include draft annotations in export


class VersionResponse(BaseModel):
    """Version response."""
    id: int
    project_id: str
    task_type: Optional[str] = None  # Phase 2.9: Task type (optional for backward compatibility)
    version_number: str
    version_type: str  # 'working' | 'published'
    created_at: datetime
    created_by: Optional[int] = None
    description: Optional[str] = None
    annotation_count: Optional[int] = None
    image_count: Optional[int] = None
    export_format: Optional[str] = None
    export_path: Optional[str] = None
    download_url: Optional[str] = None
    download_url_expires_at: Optional[datetime] = None

    # User information (joined from Platform DB)
    created_by_name: Optional[str] = None
    created_by_email: Optional[str] = None

    class Config:
        from_attributes = True


class VersionListResponse(BaseModel):
    """List of versions response."""
    versions: List[VersionResponse]
    total: int
    project_id: str


class ExportRequest(BaseModel):
    """Export annotations request."""
    project_id: str
    export_format: str  # 'coco' | 'yolo' | 'voc'
    include_draft: bool = False  # Whether to include draft annotations
    image_ids: Optional[List[str]] = None  # Export specific images only (None = all)


class ExportResponse(BaseModel):
    """Export annotations response."""
    export_path: str
    download_url: str
    download_url_expires_at: datetime
    export_format: str
    annotation_count: int
    image_count: int
    file_size_bytes: Optional[int] = None
