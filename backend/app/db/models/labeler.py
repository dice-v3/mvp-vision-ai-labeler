"""
Labeler Database Models (Read-Write)

These models represent tables in the Labeler database.
Labeler has FULL access to these tables.

IMPORTANT (2025-11-21):
- Dataset and DatasetPermission tables MOVED from Platform DB to Labeler DB
- Labeler now fully owns dataset management
- Platform DB only used for users table (read-only)
"""

from datetime import datetime
from typing import Dict, List

from sqlalchemy import (
    Boolean, Column, DateTime, Integer, String, Text, ARRAY,
    BigInteger, Index, JSON, ForeignKey, UniqueConstraint, CheckConstraint
)
from sqlalchemy.dialects.postgresql import JSONB

from app.core.database import LabelerBase


class Dataset(LabelerBase):
    """
    Dataset model - MOVED from Platform DB to Labeler DB (2025-11-21).

    Labeler now fully owns dataset management.
    """

    __tablename__ = "datasets"

    # Primary key
    id = Column(String(100), primary_key=True)

    # Basic info
    name = Column(String(200), nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, nullable=False, index=True)  # References Platform users.id (NO FK, different DB)

    # Dataset configuration
    visibility = Column(String(20), nullable=False, default="private")
    tags = Column(Text)  # JSON stored as Text

    # Storage information
    storage_path = Column(String(500), nullable=False)
    storage_type = Column(String(20), nullable=False, default="s3")

    # Dataset format and content
    format = Column(String(50), nullable=False, default="images")
    labeled = Column(Boolean, nullable=False, default=False)
    annotation_path = Column(String(500))

    # Phase 16.6: Task-type tracking for Platform integration
    # Tracks which task types have been published (e.g., ['detection', 'segmentation'])
    published_task_types = Column(ARRAY(String(20)), nullable=False, default=[])

    # Statistics
    num_classes = Column(Integer)
    num_images = Column(Integer, nullable=False, default=0)
    class_names = Column(Text)  # JSON stored as Text

    # Snapshot info
    is_snapshot = Column(Boolean, nullable=False, default=False)
    parent_dataset_id = Column(String(100))
    snapshot_created_at = Column(DateTime)
    version_tag = Column(String(50))

    # Status and integrity
    status = Column(String(20), nullable=False, default="active")
    integrity_status = Column(String(20), nullable=False, default="valid")

    # Versioning
    version = Column(Integer, nullable=False, default=1)
    content_hash = Column(String(64))
    last_modified_at = Column(DateTime)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Split configuration
    split_config = Column(Text)  # JSON stored as Text

    __table_args__ = (
        Index("ix_datasets_owner_id_created_at", "owner_id", "created_at"),
    )

    # Compatibility properties for existing code
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


class DatasetPermission(LabelerBase):
    """
    Dataset permission model - MOVED from Platform DB to Labeler DB (2025-11-21).

    Manages dataset access control (owner/member roles).
    """

    __tablename__ = "dataset_permissions"

    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign keys
    dataset_id = Column(
        String(100),
        ForeignKey('datasets.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    user_id = Column(Integer, nullable=False, index=True)  # References Platform users.id (NO FK, different DB)

    # Permission info
    role = Column(String(20), nullable=False)  # 'owner' or 'member'
    granted_by = Column(Integer, nullable=False)  # User ID who granted this permission
    granted_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('dataset_id', 'user_id', name='uq_dataset_user'),
        CheckConstraint("role IN ('owner', 'member')", name='ck_dataset_permissions_role'),
        Index("ix_dataset_permissions_dataset_user", "dataset_id", "user_id"),
    )

    def __repr__(self):
        return f"<DatasetPermission(dataset_id='{self.dataset_id}', user_id={self.user_id}, role='{self.role}')>"


# Phase 8.1: Project-based Permission System (unified RBAC)
class ProjectPermission(LabelerBase):
    """
    Project permission model - Unified permission system (Phase 8.1).

    Replaces DatasetPermission with 5-role RBAC system.
    Since Dataset ↔ Project is 1:1, project-level permissions are the single source of truth.

    Roles (hierarchy: owner > admin > reviewer > annotator > viewer):
    - owner: Full control (can delete project/dataset, manage all)
    - admin: Manage members, classes, review (cannot delete dataset)
    - reviewer: Annotate + review others' work
    - annotator: Annotate own work only
    - viewer: Read-only access
    """

    __tablename__ = "project_permissions"

    # Primary key
    id = Column(Integer, primary_key=True, autoincrement=True)

    # Foreign keys
    project_id = Column(
        String(50),
        ForeignKey('annotation_projects.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    user_id = Column(Integer, nullable=False, index=True)  # References Platform users.id (NO FK, different DB)

    # Permission info
    role = Column(String(20), nullable=False)  # 'owner', 'admin', 'reviewer', 'annotator', 'viewer'
    granted_by = Column(Integer, nullable=False)  # User ID who granted this permission
    granted_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('project_id', 'user_id', name='uq_project_user'),
        CheckConstraint("role IN ('owner', 'admin', 'reviewer', 'annotator', 'viewer')", name='ck_project_permissions_role'),
        Index("ix_project_permissions_project_user", "project_id", "user_id"),
    )

    def __repr__(self):
        return f"<ProjectPermission(project_id='{self.project_id}', user_id={self.user_id}, role='{self.role}')>"


# Phase 2.12: Performance Optimization - Image Metadata Table
class ImageMetadata(LabelerBase):
    """
    Image metadata table for fast lookups without S3 list operations.

    Phase 2.12: Store image metadata in DB to avoid expensive S3 list_objects calls.
    - Enables true pagination with offset/limit
    - Drastically improves performance (DB query vs S3 API)
    - Presigned URLs still generated on-demand
    """

    __tablename__ = "image_metadata"

    # Primary key
    id = Column(String(200), primary_key=True)  # Image ID (relative path with extension, e.g., "train/good/001.png")

    # Foreign keys
    dataset_id = Column(
        String(100),
        ForeignKey('datasets.id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )

    # Image info
    file_name = Column(String(500), nullable=False)  # Full filename with extension
    s3_key = Column(String(1000), nullable=False)  # Full S3 key path
    folder_path = Column(String(1000))  # Folder path within dataset (e.g., "train/defect")

    # File metadata
    size = Column(BigInteger, nullable=False)  # File size in bytes
    width = Column(Integer)  # Image width in pixels (optional)
    height = Column(Integer)  # Image height in pixels (optional)

    # Timestamps
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    last_modified = Column(DateTime, nullable=False, default=datetime.utcnow)

    # Indexes for fast queries
    __table_args__ = (
        Index("ix_image_metadata_dataset", "dataset_id"),
        Index("ix_image_metadata_folder", "dataset_id", "folder_path"),
        Index("ix_image_metadata_uploaded", "dataset_id", "uploaded_at"),
    )

    def __repr__(self):
        return f"<ImageMetadata(id='{self.id}', file_name='{self.file_name}', dataset_id='{self.dataset_id}')>"


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

    # Classes definition (task-based structure)
    # Structure: {task_type: {class_id: {name, color, image_count, bbox_count}}}
    # Example: {"classification": {"1": {"name": "cat", "color": "#ff0000"}}, "detection": {"1": {...}}}
    # REFACTORING: Only task_classes, legacy 'classes' field REMOVED
    task_classes = Column(JSONB, nullable=False, default={})

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

    # REFACTORING: Task type for direct filtering (no more inference needed!)
    # Maps to app.tasks.TaskType enum values
    task_type = Column(String(50), nullable=False, index=True)

    # Geometry data (flexible JSONB)
    geometry = Column(JSONB, nullable=False)

    # Class information
    class_id = Column(String(50))
    class_name = Column(String(255))

    # Additional attributes
    attributes = Column(JSONB, default={})

    # Confidence/score (for AI-assisted annotations)
    confidence = Column(Integer)  # 0-100

    # Phase 8.5.1: Optimistic locking
    version = Column(Integer, nullable=False, default=1, index=True)

    # Metadata
    created_by = Column(Integer, nullable=False)
    updated_by = Column(Integer)
    is_verified = Column(Boolean, default=False)
    notes = Column(Text)

    # Phase 2.7: Annotation confirmation
    annotation_state = Column(String(20), nullable=False, default="draft", index=True)  # draft, confirmed, verified
    confirmed_at = Column(DateTime)
    confirmed_by = Column(Integer)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_annotations_project_image", "project_id", "image_id"),
        Index("ix_annotations_project_type", "project_id", "annotation_type"),
        # REFACTORING: Add compound index for task_type filtering (10x faster queries!)
        Index("ix_annotations_project_task", "project_id", "task_type"),
        Index("ix_annotations_project_image_task", "project_id", "image_id", "task_type"),
        Index("ix_annotations_created_by", "created_by"),
    )

    def __repr__(self):
        return f"<Annotation(id={self.id}, type='{self.annotation_type}', state='{self.annotation_state}')>"


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


class ImageAnnotationStatus(LabelerBase):
    """Phase 2.7: Image annotation status tracking.
    Phase 2.9: Added task_type for task-specific status tracking.
    """

    __tablename__ = "image_annotation_status"

    id = Column(Integer, primary_key=True)
    project_id = Column(String(50), nullable=False, index=True)
    image_id = Column(String(255), nullable=False, index=True)

    # Phase 2.9: Task type for task-specific status
    task_type = Column(String(50), nullable=True, index=True)  # Nullable for backward compatibility

    # Status: not-started, in-progress, completed
    status = Column(String(20), nullable=False, default="not-started", index=True)

    # Timestamps
    first_modified_at = Column(DateTime)  # First time annotation was created
    last_modified_at = Column(DateTime)   # Last modification
    confirmed_at = Column(DateTime)       # When image was confirmed

    # Annotation counts
    total_annotations = Column(Integer, nullable=False, default=0)
    confirmed_annotations = Column(Integer, nullable=False, default=0)
    draft_annotations = Column(Integer, nullable=False, default=0)

    # Image confirmation flag
    is_image_confirmed = Column(Boolean, nullable=False, default=False)

    __table_args__ = (
        Index("ix_image_annotation_status_project_status", "project_id", "status"),
        # Phase 2.9: Unique constraint for (project, image, task_type)
        Index("ix_image_annotation_status_project_image_task", "project_id", "image_id", "task_type", unique=True),
    )

    def __repr__(self):
        return f"<ImageAnnotationStatus(image_id='{self.image_id}', status='{self.status}', total={self.total_annotations})>"


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


class AnnotationVersion(LabelerBase):
    """Phase 2.8: Annotation version tracking."""

    __tablename__ = "annotation_versions"

    id = Column(Integer, primary_key=True)
    project_id = Column(String(50), nullable=False, index=True)

    # Phase 2.9: Task-specific versioning
    task_type = Column(String(20), nullable=False, index=True)  # 'classification', 'detection', 'segmentation'

    # Version info
    version_number = Column(String(20), nullable=False)  # "v1.0", "v1.1", etc.
    version_type = Column(String(20), nullable=False)     # 'working' | 'published'

    # Metadata
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    created_by = Column(Integer)  # Platform User ID (no FK constraint)
    description = Column(Text)

    # Snapshot counts
    annotation_count = Column(Integer)
    image_count = Column(Integer)

    # Export info (for published versions)
    export_format = Column(String(20))  # 'coco' | 'yolo' | 'voc'
    export_path = Column(Text)
    download_url = Column(Text)  # Presigned S3 URL
    download_url_expires_at = Column(DateTime)  # When the presigned URL expires

    __table_args__ = (
        Index("ix_annotation_versions_project_task_version", "project_id", "task_type", "version_number", unique=True),
        Index("ix_annotation_versions_project_type", "project_id", "version_type"),
        Index("ix_annotation_versions_task_type", "task_type"),
    )

    def __repr__(self):
        return f"<AnnotationVersion(id={self.id}, version='{self.version_number}', type='{self.version_type}')>"


class AnnotationSnapshot(LabelerBase):
    """Phase 2.8: Immutable snapshot of annotations for each version."""

    __tablename__ = "annotation_snapshots"

    id = Column(BigInteger, primary_key=True)
    version_id = Column(Integer, nullable=False, index=True)
    annotation_id = Column(BigInteger, nullable=False, index=True)

    # Snapshot data (full annotation state as JSON)
    snapshot_data = Column(JSONB, nullable=False)

    __table_args__ = (
        Index("ix_annotation_snapshots_version", "version_id"),
        Index("ix_annotation_snapshots_annotation", "annotation_id"),
    )

    def __repr__(self):
        return f"<AnnotationSnapshot(id={self.id}, version_id={self.version_id}, annotation_id={self.annotation_id})>"


class ImageLock(LabelerBase):
    """Phase 8.5.2: Image locks for concurrent editing protection."""

    __tablename__ = "image_locks"

    id = Column(Integer, primary_key=True)
    project_id = Column(String(50), nullable=False, index=True)
    image_id = Column(String(255), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)

    locked_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False, index=True)
    heartbeat_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('project_id', 'image_id', name='uq_project_image_lock'),
    )

    def __repr__(self):
        return f"<ImageLock(id={self.id}, project_id='{self.project_id}', image_id='{self.image_id}', user_id={self.user_id})>"


class Invitation(LabelerBase):
    """
    Project invitation model (Phase 8.2).

    Manages project invitations independently from Platform.
    Supports 5-role RBAC system with token-based invitation workflow.
    """

    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String(255), nullable=False, unique=True, index=True)
    project_id = Column(String(50), nullable=False, index=True)
    inviter_id = Column(Integer, nullable=False, index=True)  # User DB user.id
    invitee_id = Column(Integer, nullable=False, index=True)  # User DB user.id
    invitee_email = Column(String(255), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # owner/admin/reviewer/annotator/viewer
    status = Column(String(20), nullable=False, index=True)  # pending/accepted/expired/cancelled
    message = Column(Text)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime)
    cancelled_at = Column(DateTime)

    def __repr__(self):
        return f"<Invitation(id={self.id}, project_id='{self.project_id}', status='{self.status}')>"

    @property
    def is_valid(self) -> bool:
        """Check if invitation is still valid."""
        if self.status != "pending":
            return False
        return datetime.utcnow() < self.expires_at


# ============================================================================
# Phase 15: Admin Dashboard & Audit Models
# ============================================================================

class AuditLog(LabelerBase):
    """
    Audit log model for Phase 15 - Admin Dashboard.

    Tracks all system actions for security, compliance, and troubleshooting.
    Stores in Labeler DB (UserDB cannot be modified).

    Use Cases:
    - Security auditing (who did what, when)
    - Compliance requirements (data access tracking)
    - Troubleshooting (error investigation)
    - User activity analysis

    Performance Notes:
    - Uses BigInteger for high-volume logging
    - Optimized indexes for common queries (timestamp, user_id, action)
    - JSONB for flexible detail storage
    """

    __tablename__ = "audit_logs"

    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)

    # Core audit fields
    timestamp = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    user_id = Column(Integer, nullable=True, index=True)  # Nullable for system events
    action = Column(String(100), nullable=False, index=True)  # 'create', 'update', 'delete', 'login', etc.

    # Resource identification
    resource_type = Column(String(50), nullable=True)  # 'dataset', 'project', 'annotation', 'user', etc.
    resource_id = Column(String(255), nullable=True)  # ID of the affected resource

    # Additional context
    details = Column(JSONB, nullable=True)  # Flexible JSON for action-specific data

    # Request metadata
    ip_address = Column(String(50), nullable=True)  # INET type in PostgreSQL
    user_agent = Column(Text, nullable=True)
    session_id = Column(String(255), nullable=True, index=True)

    # Status tracking
    status = Column(String(20), nullable=False, default='success')  # 'success', 'failure', 'error'
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        Index('ix_audit_logs_resource', 'resource_type', 'resource_id'),
        Index('ix_audit_logs_timestamp_desc', timestamp.desc()),
    )

    def __repr__(self):
        return (f"<AuditLog(id={self.id}, action='{self.action}', "
                f"resource='{self.resource_type}/{self.resource_id}', status='{self.status}')>")

    @property
    def is_success(self) -> bool:
        """Check if action was successful."""
        return self.status == 'success'


class UserSession(LabelerBase):
    """
    User session tracking model for Phase 15 - Admin Dashboard.

    Tracks user login/logout sessions for analytics and monitoring.
    Stores in Labeler DB (UserDB cannot be modified).

    Use Cases:
    - User activity analytics (session duration, active users)
    - Session monitoring (concurrent sessions, peak hours)
    - Compliance (user access records)

    Features:
    - Session duration calculation (logout_at - login_at)
    - Last activity tracking (for idle session detection)
    - Multiple sessions per user supported
    """

    __tablename__ = "user_sessions"

    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)

    # User identification
    user_id = Column(Integer, nullable=False, index=True)  # References User DB user.id
    session_id = Column(String(255), nullable=False, unique=True, index=True)  # JWT token or UUID

    # Session lifecycle
    login_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    logout_at = Column(DateTime, nullable=True)
    last_activity_at = Column(DateTime, nullable=True)

    # Request metadata
    ip_address = Column(String(50), nullable=True)  # INET type in PostgreSQL
    user_agent = Column(Text, nullable=True)

    # Calculated fields
    duration_seconds = Column(Integer, nullable=True)  # Calculated on logout

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return (f"<UserSession(id={self.id}, user_id={self.user_id}, "
                f"session_id='{self.session_id[:8]}...', login_at={self.login_at})>")

    @property
    def is_active(self) -> bool:
        """Check if session is still active (not logged out)."""
        return self.logout_at is None

    @property
    def duration(self) -> int | None:
        """Calculate session duration in seconds."""
        if self.logout_at and self.login_at:
            return int((self.logout_at - self.login_at).total_seconds())
        elif self.last_activity_at and self.login_at:
            # For active sessions, use last activity
            return int((self.last_activity_at - self.login_at).total_seconds())
        return None


class SystemStatsCache(LabelerBase):
    """
    System statistics cache model for Phase 15 - Admin Dashboard.

    Caches pre-calculated statistics to avoid expensive queries.
    Stores in Labeler DB with TTL support.

    Use Cases:
    - Dashboard KPI cards (total users, datasets, annotations)
    - Chart data (trends, growth, activity)
    - Performance metrics (avoid recalculating expensive aggregations)

    Features:
    - Flexible JSONB storage for any metric type
    - TTL support (expires_at)
    - Background job updates (every 5-15 minutes)

    Example Usage:
    ```python
    # Store cached metric
    cache = SystemStatsCache(
        metric_name='total_users',
        metric_value={'count': 42, 'active': 35},
        calculated_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(minutes=15)
    )

    # Retrieve cached metric
    cached = db.query(SystemStatsCache).filter(
        SystemStatsCache.metric_name == 'total_users',
        SystemStatsCache.expires_at > datetime.utcnow()
    ).first()
    ```
    """

    __tablename__ = "system_stats_cache"

    # Primary key
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # Cache identification
    metric_name = Column(String(100), nullable=False, index=True)  # e.g., 'total_users', 'active_datasets'

    # Cache data
    metric_value = Column(JSONB, nullable=False)  # Flexible JSON structure

    # Cache metadata
    calculated_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    expires_at = Column(DateTime, nullable=True, index=True)  # TTL support

    # Timestamps
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return (f"<SystemStatsCache(id={self.id}, metric='{self.metric_name}', "
                f"calculated_at={self.calculated_at}, expires_at={self.expires_at})>")

    @property
    def is_expired(self) -> bool:
        """Check if cache has expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if cache is still valid."""
        return not self.is_expired
