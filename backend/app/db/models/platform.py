"""
Platform Database Models (Read-Only)

These models represent tables in the Platform database.
Labeler only has READ access to these tables.
"""

from datetime import datetime
from typing import List

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, ARRAY, DECIMAL
from sqlalchemy.orm import relationship

from app.core.database import PlatformBase


class User(PlatformBase):
    """User model from Platform database."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    company = Column(String(100))
    division = Column(String(100))
    department = Column(String(255))
    system_role = Column(String(20))  # 'admin' or 'user'
    is_active = Column(Boolean, default=True)
    badge_color = Column(String(20))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def is_admin(self) -> bool:
        """Check if user is admin based on system_role."""
        return self.system_role == "admin"

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}')>"


class Dataset(PlatformBase):
    """Dataset model from Platform database."""

    __tablename__ = "datasets"

    id = Column(String(100), primary_key=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, index=True)
    visibility = Column(String(20), nullable=False)
    tags = Column(Text)  # JSON stored as Text
    storage_path = Column(String(500), nullable=False)
    storage_type = Column(String(20), nullable=False)
    format = Column(String(50), nullable=False)
    labeled = Column(Boolean, nullable=False)
    annotation_path = Column(String(500))
    num_classes = Column(Integer)
    num_images = Column(Integer, nullable=False)
    class_names = Column(Text)  # JSON stored as Text
    is_snapshot = Column(Boolean, nullable=False)
    parent_dataset_id = Column(String(100))
    snapshot_created_at = Column(DateTime)
    version_tag = Column(String(50))
    status = Column(String(20), nullable=False)
    integrity_status = Column(String(20), nullable=False)
    version = Column(Integer, nullable=False)
    content_hash = Column(String(64))
    last_modified_at = Column(DateTime)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)
    split_config = Column(Text)  # JSON stored as Text

    # Compatibility properties for Labeler
    @property
    def num_items(self) -> int:
        """Alias for num_images."""
        return self.num_images or 0

    @property
    def source(self) -> str:
        """Map storage_type to source."""
        return self.storage_type or "upload"

    def __repr__(self):
        return f"<Dataset(id='{self.id}', name='{self.name}')>"


class Snapshot(PlatformBase):
    """Snapshot model from Platform database."""

    __tablename__ = "snapshots"

    id = Column(String(50), primary_key=True)
    dataset_id = Column(String(50), nullable=False, index=True)
    snapshot_type = Column(String(50), nullable=False)
    storage_path = Column(Text, nullable=False)
    snapshot_metadata = Column("metadata", Text)  # JSONB stored as Text for read-only access
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Snapshot(id='{self.id}', dataset_id='{self.dataset_id}')>"
