# Database Schema Design

**Date**: 2025-01-13
**Status**: Design
**Version**: 1.0

## Table of Contents

- [Overview](#overview)
- [Schema Organization](#schema-organization)
- [Shared Tables](#shared-tables)
- [Labeler Tables](#labeler-tables)
- [Relationships](#relationships)
- [Indexes](#indexes)
- [Migration Strategy](#migration-strategy)

---

## Overview

The Labeler shares a PostgreSQL database with the Platform, using a **shared database, isolated tables** approach. This design provides data consistency while maintaining clear ownership boundaries.

**Database**: `platform` (shared)

**Table Ownership**:
- **Platform owns**: `users`, `datasets`, `training_jobs`
- **Shared**: `snapshots` (both services write)
- **Labeler owns**: `annotation_projects`, `annotations`, `annotation_tasks`, `comments`

---

## Schema Organization

### Table Prefixes

```sql
-- Platform tables (no prefix)
users
datasets
training_jobs
models
...

-- Shared tables (no prefix, coordinated access)
snapshots

-- Labeler tables (prefix: annotation_)
annotation_projects
annotation_tasks
annotations
annotation_history
comments
```

**Naming Convention**:
- Singular for table names: `user`, not `users` (SQLAlchemy convention)
- Snake_case for columns: `created_at`, `user_id`
- Foreign keys: `{table}_id` (e.g., `project_id`, `user_id`)

---

## Shared Tables

### 1. users (Platform owned, Labeler reads)

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),

    -- Roles
    role VARCHAR(50) DEFAULT 'user',  -- 'admin', 'user', 'annotator', 'reviewer'
    is_active BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP,

    -- Indexes
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role) WHERE is_active = true;
```

**Labeler Access**: Read-only
- Get user info for display
- Validate user permissions
- Assign tasks to users

---

### 2. datasets (Platform owned, Labeler reads)

```sql
CREATE TABLE datasets (
    id VARCHAR(50) PRIMARY KEY,  -- "dataset-{uuid}"
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Ownership
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Storage
    storage_type VARCHAR(20) DEFAULT 's3',  -- 's3', 'local'
    storage_path VARCHAR(500) NOT NULL,     -- "datasets/{id}/"

    -- Stats
    num_images INTEGER DEFAULT 0,
    num_classes INTEGER DEFAULT 0,
    class_names JSONB,  -- [{"id": 0, "name": "cat"}, ...]

    -- Status
    labeled BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_datasets_owner ON datasets(owner_id);
CREATE INDEX idx_datasets_labeled ON datasets(labeled) WHERE labeled = true;
```

**Labeler Access**: Read-only
- List datasets for user
- Check dataset exists before creating project
- Display dataset stats

---

### 3. snapshots (Shared - both services write)

```sql
CREATE TABLE snapshots (
    id VARCHAR(100) PRIMARY KEY,  -- "training-job-{id}" or "{dataset-id}-{version}"
    dataset_id VARCHAR(50) NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,

    -- Type
    snapshot_type VARCHAR(20) NOT NULL,  -- 'training', 'manual'
    version_tag VARCHAR(50),             -- 'v1', 'v2', 'production' (for manual snapshots)

    -- Storage
    storage_path VARCHAR(500) NOT NULL,  -- "datasets/{dataset_id}/snapshots/{id}.json"

    -- Integrity
    status VARCHAR(20) DEFAULT 'valid',  -- 'valid', 'broken', 'repairing'
    integrity_status JSONB,              -- {"missing_images": [...], "repaired_at": "..."}

    -- Stats
    total_images INTEGER NOT NULL,
    total_annotations INTEGER DEFAULT 0,

    -- Metadata
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),

    -- Relationships
    -- Foreign keys added by respective services
    -- Platform: training_job_id
    -- Labeler: annotation_project_id (optional)

    CONSTRAINT snapshot_type_check CHECK (snapshot_type IN ('training', 'manual'))
);

CREATE INDEX idx_snapshots_dataset ON snapshots(dataset_id);
CREATE INDEX idx_snapshots_type ON snapshots(snapshot_type);
CREATE INDEX idx_snapshots_status ON snapshots(status) WHERE status = 'valid';
CREATE INDEX idx_snapshots_created_at ON snapshots(created_at DESC);
```

**Access**:
- **Platform**: Writes during training job creation
- **Labeler**: Writes when creating manual version or exporting

---

## Labeler Tables

### 1. annotation_projects

The core entity representing an annotation project for a dataset.

```sql
CREATE TABLE annotation_projects (
    id VARCHAR(50) PRIMARY KEY,  -- "project-{uuid}"
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Dataset link
    dataset_id VARCHAR(50) NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,

    -- Task configuration
    task_types VARCHAR(50)[] NOT NULL,  -- ['classification', 'detection', 'segmentation']
    task_config JSONB NOT NULL,         -- Task-specific settings (see below)

    -- Classes
    classes JSONB NOT NULL,  -- [{"id": 0, "name": "cat", "color": "#FF5733", "parent_id": null}, ...]

    -- Workflow
    workflow_type VARCHAR(20) DEFAULT 'simple',  -- 'simple', 'review', 'consensus'
    enable_ai_assist BOOLEAN DEFAULT false,

    -- Stats
    total_images INTEGER DEFAULT 0,
    annotated_images INTEGER DEFAULT 0,
    reviewed_images INTEGER DEFAULT 0,

    -- Progress
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'paused', 'completed', 'archived'
    completion_percentage INTEGER DEFAULT 0,  -- 0-100

    -- Metadata
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,

    CONSTRAINT task_types_not_empty CHECK (array_length(task_types, 1) > 0),
    CONSTRAINT completion_percentage_range CHECK (completion_percentage BETWEEN 0 AND 100)
);

CREATE INDEX idx_annotation_projects_dataset ON annotation_projects(dataset_id);
CREATE INDEX idx_annotation_projects_owner ON annotation_projects(owner_id);
CREATE INDEX idx_annotation_projects_status ON annotation_projects(status);
CREATE INDEX idx_annotation_projects_created_at ON annotation_projects(created_at DESC);

-- Full-text search on name and description
CREATE INDEX idx_annotation_projects_search ON annotation_projects
    USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

**task_config Structure** (JSONB):
```json
{
  "classification": {
    "mode": "single-label",  // or "multi-label"
    "enable_group_labeling": true,
    "hierarchical": true,
    "default_class_id": 0
  },
  "detection": {
    "bbox_types": ["horizontal", "rotated"],
    "min_bbox_size": 10,  // pixels
    "enable_attributes": true,
    "attributes": [
      {"name": "occluded", "type": "boolean", "default": false},
      {"name": "truncated", "type": "boolean", "default": false},
      {"name": "difficult", "type": "boolean", "default": false}
    ]
  },
  "segmentation": {
    "types": ["polygon", "mask"],
    "min_polygon_vertices": 3,
    "enable_brush": true,
    "brush_sizes": [5, 10, 20, 50]
  },
  "line": {
    "types": ["straight", "polyline", "circle"],
    "enable_attributes": true,
    "default_line_width": 2
  },
  "open_vocab": {
    "mode": "standalone",  // or "combined"
    "max_caption_length": 500,
    "enable_llm_assist": true,
    "prompt_templates": [
      "Describe this object in detail",
      "What is unusual about this image?"
    ]
  }
}
```

---

### 2. annotations

Individual annotations stored for fast queries and filtering.

```sql
CREATE TABLE annotations (
    id BIGSERIAL PRIMARY KEY,

    -- Project & Image
    project_id VARCHAR(50) NOT NULL REFERENCES annotation_projects(id) ON DELETE CASCADE,
    image_id INTEGER NOT NULL,  -- References image in annotations.json (not a FK)
    image_filename VARCHAR(500) NOT NULL,  -- For quick lookups

    -- Annotation type
    annotation_type VARCHAR(20) NOT NULL,  -- 'bbox', 'rotated_bbox', 'polygon', 'mask', 'line', etc.

    -- Class
    class_id INTEGER NOT NULL,
    class_name VARCHAR(100),  -- Denormalized for performance

    -- Geometry (stored as JSONB for flexibility)
    geometry JSONB NOT NULL,

    -- Attributes
    attributes JSONB DEFAULT '{}',

    -- Open Vocabulary
    caption TEXT,
    caption_source VARCHAR(20),  -- 'human', 'ai'

    -- Quality
    confidence FLOAT CHECK (confidence BETWEEN 0.0 AND 1.0),
    validated BOOLEAN DEFAULT false,
    validation_errors JSONB,

    -- Workflow
    annotator_id INTEGER NOT NULL REFERENCES users(id),
    reviewer_id INTEGER REFERENCES users(id),
    annotation_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'edited'

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT annotation_type_check CHECK (
        annotation_type IN ('bbox', 'rotated_bbox', 'polygon', 'mask',
                           'line', 'polyline', 'circle', 'keypoints', 'text')
    )
);

CREATE INDEX idx_annotations_project ON annotations(project_id);
CREATE INDEX idx_annotations_image ON annotations(project_id, image_id);
CREATE INDEX idx_annotations_class ON annotations(project_id, class_id);
CREATE INDEX idx_annotations_annotator ON annotations(annotator_id);
CREATE INDEX idx_annotations_status ON annotations(annotation_status);
CREATE INDEX idx_annotations_type ON annotations(annotation_type);
CREATE INDEX idx_annotations_created_at ON annotations(created_at DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_annotations_geometry ON annotations USING gin(geometry);
CREATE INDEX idx_annotations_attributes ON annotations USING gin(attributes);

-- Full-text search on captions
CREATE INDEX idx_annotations_caption_search ON annotations
    USING gin(to_tsvector('english', COALESCE(caption, '')))
    WHERE caption IS NOT NULL;
```

**geometry Structure Examples** (JSONB):

```json
// Horizontal BBox
{
  "type": "bbox",
  "bbox": [100, 200, 300, 400],  // [x, y, width, height]
  "area": 120000
}

// Rotated BBox
{
  "type": "rotated_bbox",
  "cx": 250,
  "cy": 400,
  "width": 300,
  "height": 200,
  "angle": 45,
  "area": 60000
}

// Polygon
{
  "type": "polygon",
  "points": [[100, 200], [150, 180], [200, 220], [180, 250]],
  "area": 5000,
  "bbox": [100, 180, 100, 70]
}

// Line
{
  "type": "line",
  "p1": [100, 500],
  "p2": [800, 600],
  "width": 5
}

// Keypoints
{
  "type": "keypoints",
  "keypoints": [[512, 200, 2], [500, 180, 2], ...],  // [x, y, visibility]
  "skeleton": "coco_17",
  "num_keypoints": 15,
  "bbox": [450, 150, 150, 400]
}
```

---

### 3. annotation_tasks

Task assignment for collaborative workflows.

```sql
CREATE TABLE annotation_tasks (
    id SERIAL PRIMARY KEY,

    -- Project
    project_id VARCHAR(50) NOT NULL REFERENCES annotation_projects(id) ON DELETE CASCADE,

    -- Assignment
    assignee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigner_id INTEGER NOT NULL REFERENCES users(id),

    -- Task details
    task_name VARCHAR(255),
    task_description TEXT,

    -- Images assigned
    image_ids INTEGER[] NOT NULL,
    total_images INTEGER NOT NULL,

    -- Progress
    status VARCHAR(20) DEFAULT 'assigned',  -- 'assigned', 'in_progress', 'completed', 'reviewed'
    progress INTEGER DEFAULT 0,  -- Number of images completed
    completion_percentage INTEGER DEFAULT 0,  -- 0-100

    -- Deadlines
    assigned_at TIMESTAMP DEFAULT NOW(),
    due_date TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    reviewed_at TIMESTAMP,

    -- Review
    reviewed_by INTEGER REFERENCES users(id),
    review_status VARCHAR(20),  -- 'approved', 'rejected', 'needs_revision'
    review_comments TEXT,

    CONSTRAINT task_status_check CHECK (
        status IN ('assigned', 'in_progress', 'completed', 'reviewed')
    ),
    CONSTRAINT completion_percentage_range CHECK (completion_percentage BETWEEN 0 AND 100)
);

CREATE INDEX idx_annotation_tasks_project ON annotation_tasks(project_id);
CREATE INDEX idx_annotation_tasks_assignee ON annotation_tasks(assignee_id);
CREATE INDEX idx_annotation_tasks_status ON annotation_tasks(status);
CREATE INDEX idx_annotation_tasks_due_date ON annotation_tasks(due_date)
    WHERE status NOT IN ('completed', 'reviewed');

-- GIN index for image_ids array queries
CREATE INDEX idx_annotation_tasks_image_ids ON annotation_tasks USING gin(image_ids);
```

---

### 4. annotation_history

Track annotation edit history for audit and undo functionality.

```sql
CREATE TABLE annotation_history (
    id BIGSERIAL PRIMARY KEY,

    -- Annotation reference
    annotation_id BIGINT NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
    project_id VARCHAR(50) NOT NULL REFERENCES annotation_projects(id) ON DELETE CASCADE,

    -- Action
    action VARCHAR(20) NOT NULL,  -- 'created', 'updated', 'deleted', 'approved', 'rejected'

    -- Previous state (for undo)
    previous_geometry JSONB,
    previous_class_id INTEGER,
    previous_attributes JSONB,
    previous_caption TEXT,

    -- New state
    new_geometry JSONB,
    new_class_id INTEGER,
    new_attributes JSONB,
    new_caption TEXT,

    -- Metadata
    user_id INTEGER NOT NULL REFERENCES users(id),
    timestamp TIMESTAMP DEFAULT NOW(),

    -- Context
    change_reason TEXT,  -- Optional explanation

    CONSTRAINT history_action_check CHECK (
        action IN ('created', 'updated', 'deleted', 'approved', 'rejected')
    )
);

CREATE INDEX idx_annotation_history_annotation ON annotation_history(annotation_id);
CREATE INDEX idx_annotation_history_project ON annotation_history(project_id);
CREATE INDEX idx_annotation_history_user ON annotation_history(user_id);
CREATE INDEX idx_annotation_history_timestamp ON annotation_history(timestamp DESC);

-- Partition by month for better performance (optional)
-- CREATE TABLE annotation_history_y2025m01 PARTITION OF annotation_history
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

---

### 5. comments

Communication and notes on images or annotations.

```sql
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,

    -- Context
    project_id VARCHAR(50) NOT NULL REFERENCES annotation_projects(id) ON DELETE CASCADE,
    image_id INTEGER,  -- NULL for project-level comments
    annotation_id BIGINT REFERENCES annotations(id) ON DELETE CASCADE,  -- NULL for image-level comments

    -- Comment
    text TEXT NOT NULL,
    comment_type VARCHAR(20) DEFAULT 'general',  -- 'general', 'question', 'issue', 'note'

    -- Threading
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,  -- For replies
    thread_level INTEGER DEFAULT 0,  -- 0=root, 1=reply, 2=reply to reply

    -- Metadata
    author_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    edited BOOLEAN DEFAULT false,

    -- Status (for issue tracking)
    resolved BOOLEAN DEFAULT false,
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,

    CONSTRAINT comment_context_check CHECK (
        (image_id IS NOT NULL) OR (annotation_id IS NOT NULL) OR (image_id IS NULL AND annotation_id IS NULL)
    ),
    CONSTRAINT thread_level_check CHECK (thread_level >= 0 AND thread_level <= 5)
);

CREATE INDEX idx_comments_project ON comments(project_id);
CREATE INDEX idx_comments_image ON comments(project_id, image_id) WHERE image_id IS NOT NULL;
CREATE INDEX idx_comments_annotation ON comments(annotation_id) WHERE annotation_id IS NOT NULL;
CREATE INDEX idx_comments_author ON comments(author_id);
CREATE INDEX idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_comments_resolved ON comments(resolved) WHERE resolved = false;
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- Full-text search
CREATE INDEX idx_comments_search ON comments
    USING gin(to_tsvector('english', text));
```

---

### 6. project_members (Optional - for team collaboration)

```sql
CREATE TABLE project_members (
    project_id VARCHAR(50) NOT NULL REFERENCES annotation_projects(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Role in project
    role VARCHAR(20) NOT NULL DEFAULT 'annotator',  -- 'owner', 'admin', 'annotator', 'reviewer', 'viewer'

    -- Permissions
    can_annotate BOOLEAN DEFAULT true,
    can_review BOOLEAN DEFAULT false,
    can_export BOOLEAN DEFAULT false,
    can_manage_tasks BOOLEAN DEFAULT false,

    -- Metadata
    added_by INTEGER NOT NULL REFERENCES users(id),
    added_at TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (project_id, user_id),

    CONSTRAINT member_role_check CHECK (
        role IN ('owner', 'admin', 'annotator', 'reviewer', 'viewer')
    )
);

CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_role ON project_members(role);
```

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────┐
│    users    │───────┐
└──────┬──────┘       │
       │              │
       │ owner_id     │ created_by
       │              │
       ▼              ▼
┌─────────────┐   ┌────────────┐
│  datasets   │   │ snapshots  │
└──────┬──────┘   └────────────┘
       │
       │ dataset_id
       │
       ▼
┌──────────────────────┐
│ annotation_projects  │◄───── project_id ────┐
└───────────┬──────────┘                       │
            │                                  │
            │ project_id                       │
            │                                  │
            ├─────────────────┬────────────────┼──────────────────┐
            ▼                 ▼                ▼                  ▼
    ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  ┌───────────┐
    │ annotations  │  │ annotation_   │  │ comments    │  │ project_  │
    │              │  │ tasks         │  │             │  │ members   │
    └──────┬───────┘  └───────────────┘  └─────────────┘  └───────────┘
           │
           │ annotation_id
           │
           ▼
    ┌──────────────────┐
    │ annotation_      │
    │ history          │
    └──────────────────┘
```

### Key Relationships

```sql
-- 1:N relationships
users → annotation_projects (owner)
users → annotations (annotator)
users → annotation_tasks (assignee)
users → comments (author)

datasets → annotation_projects (one dataset, many projects)
annotation_projects → annotations
annotation_projects → annotation_tasks
annotation_projects → comments

-- N:M relationships
users ↔ annotation_projects (via project_members)

-- Self-referencing
comments → comments (parent-child, for threading)
```

---

## Indexes

### Query Performance Optimization

**Common Query Patterns**:

1. **Get projects for user**:
```sql
SELECT * FROM annotation_projects
WHERE owner_id = ?
ORDER BY created_at DESC;
-- Index: idx_annotation_projects_owner, idx_annotation_projects_created_at
```

2. **Get annotations for image**:
```sql
SELECT * FROM annotations
WHERE project_id = ? AND image_id = ?;
-- Index: idx_annotations_image (composite)
```

3. **Get pending tasks for user**:
```sql
SELECT * FROM annotation_tasks
WHERE assignee_id = ? AND status IN ('assigned', 'in_progress')
ORDER BY due_date ASC;
-- Index: idx_annotation_tasks_assignee, idx_annotation_tasks_status
```

4. **Search annotations by caption**:
```sql
SELECT * FROM annotations
WHERE to_tsvector('english', caption) @@ to_tsquery('english', 'cat');
-- Index: idx_annotations_caption_search (GIN)
```

5. **Get unresolved comments**:
```sql
SELECT * FROM comments
WHERE project_id = ? AND resolved = false
ORDER BY created_at DESC;
-- Index: idx_comments_resolved
```

### Index Monitoring

```sql
-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- Check missing indexes (slow queries)
SELECT
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## Migration Strategy

### Alembic Setup

```bash
# Initialize Alembic for Labeler
cd labeler/backend
alembic init alembic

# Configure alembic.ini
sqlalchemy.url = postgresql://platform:platform@localhost:5432/platform
```

### Migration File Structure

```
labeler/backend/alembic/versions/
├── 001_create_annotation_projects.py
├── 002_create_annotations.py
├── 003_create_annotation_tasks.py
├── 004_create_annotation_history.py
├── 005_create_comments.py
├── 006_create_project_members.py
└── 007_add_indexes.py
```

### Example Migration

```python
# labeler/backend/alembic/versions/001_create_annotation_projects.py

"""create annotation_projects table

Revision ID: 001
Revises:
Create Date: 2025-01-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, ARRAY

revision = '001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        'annotation_projects',
        sa.Column('id', sa.String(50), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('dataset_id', sa.String(50), sa.ForeignKey('datasets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('task_types', ARRAY(sa.String(50)), nullable=False),
        sa.Column('task_config', JSONB, nullable=False),
        sa.Column('classes', JSONB, nullable=False),
        sa.Column('workflow_type', sa.String(20), server_default='simple'),
        sa.Column('enable_ai_assist', sa.Boolean, server_default='false'),
        sa.Column('total_images', sa.Integer, server_default='0'),
        sa.Column('annotated_images', sa.Integer, server_default='0'),
        sa.Column('reviewed_images', sa.Integer, server_default='0'),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('completion_percentage', sa.Integer, server_default='0'),
        sa.Column('owner_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP, server_default=sa.text('NOW()')),
        sa.Column('completed_at', sa.TIMESTAMP, nullable=True),
        sa.CheckConstraint('array_length(task_types, 1) > 0', name='task_types_not_empty'),
        sa.CheckConstraint('completion_percentage BETWEEN 0 AND 100', name='completion_percentage_range')
    )

    # Create indexes
    op.create_index('idx_annotation_projects_dataset', 'annotation_projects', ['dataset_id'])
    op.create_index('idx_annotation_projects_owner', 'annotation_projects', ['owner_id'])
    op.create_index('idx_annotation_projects_status', 'annotation_projects', ['status'])
    op.create_index('idx_annotation_projects_created_at', 'annotation_projects', ['created_at'], postgresql_ops={'created_at': 'DESC'})

def downgrade():
    op.drop_table('annotation_projects')
```

### Running Migrations

```bash
# Generate new migration
alembic revision --autogenerate -m "add new field"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1

# Check current version
alembic current
```

---

## Data Consistency Rules

### 1. Annotation Count Sync

```sql
-- Trigger to update project stats when annotation is created/deleted
CREATE OR REPLACE FUNCTION update_project_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE annotation_projects
        SET total_annotations = total_annotations + 1,
            updated_at = NOW()
        WHERE id = NEW.project_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE annotation_projects
        SET total_annotations = total_annotations - 1,
            updated_at = NOW()
        WHERE id = OLD.project_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_stats
AFTER INSERT OR DELETE ON annotations
FOR EACH ROW EXECUTE FUNCTION update_project_stats();
```

### 2. Task Progress Update

```sql
-- Update task progress based on completed images
CREATE OR REPLACE FUNCTION update_task_progress()
RETURNS TRIGGER AS $$
DECLARE
    completed_count INTEGER;
BEGIN
    -- Count completed images
    SELECT COUNT(DISTINCT image_id)
    INTO completed_count
    FROM annotations
    WHERE project_id = NEW.project_id
      AND image_id = ANY(
          SELECT unnest(image_ids)
          FROM annotation_tasks
          WHERE id = NEW.task_id
      );

    -- Update task
    UPDATE annotation_tasks
    SET progress = completed_count,
        completion_percentage = (completed_count * 100.0 / total_images)::INTEGER,
        status = CASE
            WHEN completed_count = total_images THEN 'completed'
            WHEN completed_count > 0 THEN 'in_progress'
            ELSE 'assigned'
        END
    WHERE id = NEW.task_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

---

## Performance Considerations

### 1. Partitioning

For large-scale deployments, consider partitioning:

```sql
-- Partition annotations by project_id
CREATE TABLE annotations_project_001 PARTITION OF annotations
    FOR VALUES WITH (modulus 10, remainder 0);

-- Partition annotation_history by timestamp
CREATE TABLE annotation_history_y2025 PARTITION OF annotation_history
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

### 2. Archiving

```sql
-- Archive old completed projects
CREATE TABLE annotation_projects_archive (
    LIKE annotation_projects INCLUDING ALL
);

-- Move to archive
INSERT INTO annotation_projects_archive
SELECT * FROM annotation_projects
WHERE status = 'completed'
  AND completed_at < NOW() - INTERVAL '6 months';
```

### 3. Query Optimization

```sql
-- Use EXPLAIN ANALYZE to check query performance
EXPLAIN ANALYZE
SELECT * FROM annotations
WHERE project_id = 'project-123'
  AND image_id = 42;

-- Add covering indexes for common queries
CREATE INDEX idx_annotations_covering
ON annotations(project_id, image_id)
INCLUDE (annotation_type, class_id, geometry);
```

---

## Security

### Row-Level Security (RLS)

```sql
-- Enable RLS on annotation tables
ALTER TABLE annotation_projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see projects they own or are members of
CREATE POLICY project_access_policy ON annotation_projects
FOR SELECT
USING (
    owner_id = current_setting('app.user_id')::INTEGER
    OR EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = annotation_projects.id
          AND user_id = current_setting('app.user_id')::INTEGER
    )
);

-- Set user context in application
-- SET LOCAL app.user_id = 123;
```

---

## References

- [Platform Integration Strategy](./PLATFORM_INTEGRATION.md)
- [Project Design](./PROJECT_DESIGN.md)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)

---

**Last Updated**: 2025-01-13
**Status**: Design (ready for implementation)
