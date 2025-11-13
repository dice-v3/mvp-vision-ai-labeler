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
    username = Column(String(100))
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    badge_color = Column(String(7), default="#9333ea")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}')>"


class Dataset(PlatformBase):
    """Dataset model from Platform database."""

    __tablename__ = "datasets"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, nullable=False, index=True)
    format = Column(String(50), nullable=False)
    source = Column(String(50), default="upload")
    visibility = Column(String(20), default="private")
    labeled = Column(Boolean, default=False)
    num_items = Column(Integer, default=0)
    size_mb = Column(DECIMAL(10, 2))
    storage_path = Column(Text)
    tags = Column(ARRAY(Text))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
