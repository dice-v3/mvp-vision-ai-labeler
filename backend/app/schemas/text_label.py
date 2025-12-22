"""Text Label schemas for Phase 19 - VLM Text Labeling."""

from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field, validator


class TextLabelCreate(BaseModel):
    """Create text label request."""
    project_id: str
    image_id: str
    annotation_id: Optional[int] = None  # NULL = image-level, set = region-level
    label_type: str = Field(default="caption", description="Type: caption, description, qa, region")
    text_content: str = Field(..., min_length=1, max_length=10000, description="Main text content")
    question: Optional[str] = Field(None, max_length=5000, description="Question for VQA type")
    language: str = Field(default="en", min_length=2, max_length=10, description="Language code (ISO 639-1)")
    confidence: Optional[int] = Field(None, ge=0, le=100, description="Confidence score 0-100")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")

    @validator('label_type')
    def validate_label_type(cls, v):
        """Validate label type."""
        allowed_types = ['caption', 'description', 'qa', 'region']
        if v not in allowed_types:
            raise ValueError(f"label_type must be one of {allowed_types}")
        return v

    @validator('question')
    def validate_question(cls, v, values):
        """Validate question field for VQA type."""
        if values.get('label_type') == 'qa' and not v:
            raise ValueError("question is required for label_type='qa'")
        return v


class TextLabelUpdate(BaseModel):
    """Update text label request."""
    text_content: Optional[str] = Field(None, min_length=1, max_length=10000)
    question: Optional[str] = Field(None, max_length=5000)
    language: Optional[str] = Field(None, min_length=2, max_length=10)
    confidence: Optional[int] = Field(None, ge=0, le=100)
    metadata: Optional[Dict[str, Any]] = None

    # Optimistic locking
    version: Optional[int] = Field(None, description="Current version for conflict detection")


class TextLabelResponse(BaseModel):
    """Text label response."""
    id: int
    project_id: str
    image_id: str
    annotation_id: Optional[int] = None
    label_type: str
    text_content: str
    question: Optional[str] = None
    language: str
    confidence: Optional[int] = None
    metadata: Dict[str, Any]
    version: int
    created_by: int
    updated_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    # User information (joined from User DB)
    created_by_name: Optional[str] = None
    updated_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class TextLabelListResponse(BaseModel):
    """List text labels response."""
    text_labels: List[TextLabelResponse]
    total: int


class TextLabelBatchCreate(BaseModel):
    """Batch create text labels request."""
    text_labels: List[TextLabelCreate]


class TextLabelBatchResponse(BaseModel):
    """Batch create text labels response."""
    created: int
    failed: int
    text_label_ids: List[int]
    errors: List[str] = []


class TextLabelStatsResponse(BaseModel):
    """Text label statistics response."""
    project_id: str
    total_labels: int
    by_type: Dict[str, int]  # {'caption': 10, 'description': 5, 'qa': 3}
    by_language: Dict[str, int]  # {'en': 15, 'ko': 3}
    images_with_labels: int
    annotations_with_labels: int


class TextLabelExportRequest(BaseModel):
    """Export text labels request."""
    project_id: str
    export_format: str = Field(..., description="Format: jsonl, visual_genome, csv")
    image_ids: Optional[List[str]] = None
    label_types: Optional[List[str]] = None  # Filter by type
    languages: Optional[List[str]] = None  # Filter by language
    include_metadata: bool = True

    @validator('export_format')
    def validate_export_format(cls, v):
        """Validate export format."""
        allowed_formats = ['jsonl', 'visual_genome', 'csv', 'coco_captions']
        if v not in allowed_formats:
            raise ValueError(f"export_format must be one of {allowed_formats}")
        return v


# ===== Phase 19.8: Text Label Versioning Schemas =====


class TextLabelVersionPublishRequest(BaseModel):
    """Publish text labels version request."""
    version: Optional[str] = Field(None, description="Version number (auto-generated if not provided)")
    notes: Optional[str] = Field(None, max_length=5000, description="Optional publish notes")


class TextLabelVersionResponse(BaseModel):
    """Text label version response (summary)."""
    id: int
    project_id: str
    version: str
    published_at: datetime
    published_by: int
    label_count: int
    image_level_count: int
    region_level_count: int
    notes: Optional[str] = None

    # User information (joined from User DB)
    published_by_name: Optional[str] = None
    published_by_email: Optional[str] = None

    class Config:
        from_attributes = True


class TextLabelVersionDetail(BaseModel):
    """Text label version detail (includes full snapshot)."""
    id: int
    project_id: str
    version: str
    published_at: datetime
    published_by: int
    label_count: int
    image_level_count: int
    region_level_count: int
    notes: Optional[str] = None

    # Full snapshot data
    text_labels_snapshot: List[Dict[str, Any]]

    # User information
    published_by_name: Optional[str] = None
    published_by_email: Optional[str] = None

    class Config:
        from_attributes = True


class TextLabelVersionListResponse(BaseModel):
    """List text label versions response."""
    versions: List[TextLabelVersionResponse]
    total: int
