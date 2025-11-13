"""
Labeler Database Models (Read-Write)

These models represent tables in the Labeler database.
Labeler has FULL access to these tables.
"""

from datetime import datetime
from typing import Dict, List

from sqlalchemy import (
    Boolean, Column, DateTime, Integer, String, Text, ARRAY,
    BigInteger, Index, JSON
)
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import LabelerBase


class AnnotationProject(LabelerBase):
    """Annotation project."""

    __tablename__ = "annotation_projects"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    dataset_id = Column(String(50), nullable=False, unique=True, index=True)  # 1:1 with Dataset
    owner_id = Column(Integer, nullable=False, index=True)

    # Task configuration
    task_types = Column(ARRAY(String(50)), nullable=False)
    task_config = Column(JSONB, nullable=False)

    # Classes definition
    classes = Column(JSONB, nullable=False)

    # Project settings
    settings = Column(JSONB, default={})

    # Statistics
    total_images = Column(Integer, default=0)
    annotated_images = Column(Integer, default=0)
    total_annotations = Column(Integer, default=0)

    # Status
    status = Column(String(20), default="active")

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # History tracking
    last_updated_by = Column(Integer, index=True)  # Platform User ID (no FK constraint)

    __table_args__ = (
        Index("ix_annotation_projects_owner_id_created_at", "owner_id", "created_at"),
    )

    def __repr__(self):
        return f"<AnnotationProject(id='{self.id}', name='{self.name}')>"


class Annotation(LabelerBase):
    """Annotation (supports all task types)."""

    __tablename__ = "annotations"

    id = Column(BigInteger, primary_key=True)
    project_id = Column(String(50), nullable=False, index=True)
    image_id = Column(String(255), nullable=False, index=True)

    # Annotation type: classification, bbox, rotated_bbox, polygon, line, open_vocab
    annotation_type = Column(String(20), nullable=False, index=True)

    # Geometry data (flexible JSONB)
    geometry = Column(JSONB, nullable=False)

    # Class information
    class_id = Column(String(50))
    class_name = Column(String(255))

    # Additional attributes
    attributes = Column(JSONB, default={})

    # Confidence/score (for AI-assisted annotations)
    confidence = Column(Integer)  # 0-100

    # Metadata
    created_by = Column(Integer, nullable=False)
    updated_by = Column(Integer)
    is_verified = Column(Boolean, default=False)
    notes = Column(Text)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_annotations_project_image", "project_id", "image_id"),
        Index("ix_annotations_project_type", "project_id", "annotation_type"),
        Index("ix_annotations_created_by", "created_by"),
    )

    def __repr__(self):
        return f"<Annotation(id={self.id}, type='{self.annotation_type}')>"


class AnnotationHistory(LabelerBase):
    """Annotation edit history (for undo/redo)."""

    __tablename__ = "annotation_history"

    id = Column(BigInteger, primary_key=True)
    annotation_id = Column(BigInteger, nullable=False, index=True)
    project_id = Column(String(50), nullable=False, index=True)

    # Action type: create, update, delete, restore
    action = Column(String(20), nullable=False)

    # Previous state (for undo)
    previous_state = Column(JSONB)

    # New state (for redo)
    new_state = Column(JSONB)

    # Metadata
    changed_by = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_annotation_history_annotation_timestamp", "annotation_id", "timestamp"),
    )

    def __repr__(self):
        return f"<AnnotationHistory(id={self.id}, action='{self.action}')>"


class AnnotationTask(LabelerBase):
    """Annotation task assignment."""

    __tablename__ = "annotation_tasks"

    id = Column(String(50), primary_key=True)
    project_id = Column(String(50), nullable=False, index=True)

    # Task details
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Assignment
    assignee_id = Column(Integer, index=True)
    reviewer_id = Column(Integer)

    # Image list
    image_ids = Column(ARRAY(String(255)))

    # Progress
    total_images = Column(Integer, default=0)
    completed_images = Column(Integer, default=0)

    # Status: pending, in_progress, review, completed
    status = Column(String(20), default="pending", index=True)

    # Deadlines
    due_date = Column(DateTime)
    completed_at = Column(DateTime)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_annotation_tasks_assignee_status", "assignee_id", "status"),
    )

    def __repr__(self):
        return f"<AnnotationTask(id='{self.id}', name='{self.name}')>"


class Comment(LabelerBase):
    """Comment on image or annotation."""

    __tablename__ = "comments"

    id = Column(BigInteger, primary_key=True)
    project_id = Column(String(50), nullable=False, index=True)
    image_id = Column(String(255), nullable=False, index=True)
    annotation_id = Column(BigInteger, index=True)

    # Comment content
    text = Column(Text, nullable=False)

    # Threading
    parent_id = Column(BigInteger)
    thread_id = Column(BigInteger)

    # Status
    resolved = Column(Boolean, default=False)

    # Metadata
    author_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_comments_project_image", "project_id", "image_id"),
    )

    def __repr__(self):
        return f"<Comment(id={self.id}, author_id={self.author_id})>"
