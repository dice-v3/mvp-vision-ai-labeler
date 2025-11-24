"""
User Database Models (Read-Only)

Phase 9: User data separated into shared SQLite database.
These models represent tables in the User database.
Labeler only has READ access to these tables.
"""

from datetime import datetime
from typing import List

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import UserBase


class User(UserBase):
    """User model from User database (SQLite)."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    company = Column(String(100))
    company_custom = Column(String(255))
    division = Column(String(100))
    division_custom = Column(String(255))
    department = Column(String(255))
    organization_id = Column(Integer)
    phone_number = Column(String(50))
    bio = Column(Text)
    system_role = Column(String(11), nullable=False)  # 'admin' or 'user'
    is_active = Column(Boolean, nullable=False, default=True)
    avatar_name = Column(String(100))
    badge_color = Column(String(20))
    password_reset_token = Column(String(255))
    password_reset_expires = Column(DateTime)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def is_admin(self) -> bool:
        """Check if user is admin based on system_role."""
        return self.system_role == "admin"

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}')>"


class Organization(UserBase):
    """Organization model from User database."""

    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    company = Column(String(255), nullable=False)
    division = Column(String(255))
    max_users = Column(Integer)
    max_storage_gb = Column(Integer)
    max_gpu_hours_per_month = Column(Integer)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<Organization(id={self.id}, name='{self.name}')>"
