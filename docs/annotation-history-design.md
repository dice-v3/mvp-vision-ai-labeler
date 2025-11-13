# Annotation History Management Design

## Overview

This document describes the design and implementation strategy for annotation history tracking in the Vision AI Labeler system.

## Background

### Requirements
- Track who made changes to annotations
- Display "Last updated by [User] at [Time]" information
- Support future expansion to detailed audit logging
- Avoid conflicts with Platform DB (read-only access)

### Constraints
- Labeler has **read-only** access to Platform DB
- Labeler has **read-write** access to Labeler DB
- Must not modify Platform DB tables (User, Dataset, etc.)
- Should be scalable for future audit requirements

## Architecture Decision

### Database Separation

```
┌─────────────────────────┐
│   Platform DB           │
│   (Read-Only)          │
│                         │
│   ┌──────────┐         │
│   │  User    │         │
│   │  Dataset │         │
│   └──────────┘         │
└─────────────────────────┘
           ↑
           │ Read Only
           │
┌─────────────────────────┐
│   Labeler DB            │
│   (Read-Write)         │
│                         │
│   ┌──────────────────┐ │
│   │ AnnotationProject│ │
│   │  - last_updated_by│ │ ← Stores Platform User ID
│   │  - updated_at    │ │
│   ├──────────────────┤ │
│   │ Annotation       │ │
│   │  - created_by    │ │
│   │  - updated_by    │ │
│   ├──────────────────┤ │
│   │ AnnotationHistory│ │ ← Already exists for undo/redo
│   │  - changed_by    │ │
│   │  - timestamp     │ │
│   └──────────────────┘ │
└─────────────────────────┘
```

### Key Principle: Foreign Key Reference (No Constraint)

```python
# Labeler DB stores Platform User ID as INTEGER
# NO foreign key constraint because it references external DB
last_updated_by = Column(Integer, index=True)  # Platform User.id

# At query time, join with Platform DB
user_info = platform_db.query(User).filter(User.id == project.last_updated_by).first()
```

## Implementation Phases

### Phase 1: Basic User Tracking (Current MVP)

**Goal**: Track and display who last updated the project

**Schema Changes**:
```sql
-- Add to annotation_projects table
ALTER TABLE annotation_projects
ADD COLUMN last_updated_by INTEGER;

CREATE INDEX ix_annotation_projects_last_updated_by
ON annotation_projects(last_updated_by);
```

**Model Changes**:
```python
class AnnotationProject(LabelerBase):
    # Existing fields
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # New field
    last_updated_by = Column(Integer, index=True)  # Platform User ID
```

**API Response**:
```json
{
  "id": "proj_abc123",
  "updated_at": "2025-11-13T10:30:00Z",
  "last_updated_by": 1,
  "last_updated_by_name": "Admin User",  // Joined from Platform DB
  "last_updated_by_email": "admin@example.com"
}
```

**Frontend Display**:
```
Last updated by Admin User at 2025-11-13 10:30
```

### Phase 2: Enhanced Tracking

**Goal**: Distinguish between project config changes and annotation changes

**Schema Changes**:
```sql
ALTER TABLE annotation_projects
ADD COLUMN last_annotation_at TIMESTAMP,
ADD COLUMN last_project_config_at TIMESTAMP;
```

**Model Changes**:
```python
class AnnotationProject(LabelerBase):
    last_updated_by = Column(Integer, index=True)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Detailed tracking
    last_annotation_at = Column(DateTime)        # Last annotation edit
    last_project_config_at = Column(DateTime)    # Last project settings change
```

**Usage**:
```python
# When annotation is modified
project.last_annotation_at = datetime.utcnow()
project.last_updated_by = current_user.id

# When project settings are changed
project.last_project_config_at = datetime.utcnow()
project.last_updated_by = current_user.id
```

### Phase 3: Full Audit Log

**Goal**: Detailed change tracking for compliance and analytics

**Use Existing Table**: `annotation_history` (already in schema)

**Model** (already exists):
```python
class AnnotationHistory(LabelerBase):
    __tablename__ = "annotation_history"

    id = Column(BigInteger, primary_key=True)
    annotation_id = Column(BigInteger, nullable=False, index=True)
    project_id = Column(String(50), nullable=False, index=True)
    action = Column(String(20), nullable=False)  # create, update, delete, restore
    previous_state = Column(JSONB)
    new_state = Column(JSONB)
    changed_by = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
```

**Usage**:
```python
# On every annotation change
await create_history_entry({
    "annotation_id": annotation_id,
    "project_id": project_id,
    "action": "update",
    "previous_state": old_data,
    "new_state": new_data,
    "changed_by": current_user.id
})
```

**Query Examples**:
```python
# Recent changes by user
recent = db.query(AnnotationHistory)\
    .filter(changed_by == user_id)\
    .order_by(timestamp.desc())\
    .limit(10).all()

# Project activity timeline
timeline = db.query(AnnotationHistory)\
    .filter(project_id == pid)\
    .order_by(timestamp.desc()).all()
```

### Phase 4: Advanced Features (Future)

**Milestone Snapshots**:
```python
# S3 structure
s3://annotations/project_id/
  annotations.json              # Latest (with S3 versioning)
  milestones/
    v1.0.0_2025-11-13.json     # Major milestone
    v1.1.0_2025-12-01.json
```

**Rollback Capability**:
```python
async def rollback_to_version(project_id, version):
    # Restore from S3 snapshot or rebuild from history
    snapshot = await load_snapshot(project_id, version)
    await restore_annotations(project_id, snapshot)
```

**Diff Viewer**:
```python
# Compare two versions
diff = compare_annotations(version_a, version_b)
# Returns: added, deleted, modified annotations
```

## Platform Synchronization (Future)

When Platform needs to know about annotation updates:

### Option 1: Event Bus (Recommended)
```python
# Labeler publishes events
await event_bus.publish("annotation.completed", {
    "dataset_id": dataset_id,
    "project_id": project_id,
    "completed_by": user_id,
    "timestamp": datetime.utcnow(),
    "stats": {
        "total_annotations": 209,
        "annotated_images": 32
    }
})

# Platform subscribes and updates its own DB
@event_bus.subscribe("annotation.completed")
async def update_dataset_status(event):
    await platform_db.execute(
        "UPDATE datasets SET labeled = true WHERE id = :id",
        {"id": event.dataset_id}
    )
```

### Option 2: Webhook
```python
# Labeler calls Platform webhook
async def notify_platform_completion(dataset_id):
    await httpx.post(
        f"{PLATFORM_URL}/webhooks/annotation-completed",
        json={"dataset_id": dataset_id}
    )
```

### Option 3: Scheduled Sync
```python
# Periodic job (e.g., every 5 minutes)
async def sync_annotation_status():
    completed_projects = await get_recently_completed_projects()
    for project in completed_projects:
        await notify_platform(project.dataset_id)
```

## Security Considerations

### User ID Validation
```python
# Always validate user_id exists in Platform DB
async def validate_user(user_id: int, platform_db: Session):
    user = platform_db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return user
```

### Read-Only Enforcement
```python
# Platform DB connection uses read-only user
PLATFORM_DB_USER = "labeler_readonly"  # Has SELECT permission only
```

## Performance Considerations

### Indexes
```sql
-- Critical for filtering and sorting
CREATE INDEX ix_annotation_projects_last_updated_by ON annotation_projects(last_updated_by);
CREATE INDEX ix_annotation_projects_updated_at ON annotation_projects(updated_at);
CREATE INDEX ix_annotation_history_project_timestamp ON annotation_history(project_id, timestamp);
CREATE INDEX ix_annotation_history_changed_by ON annotation_history(changed_by);
```

### Caching
```python
# Cache user info to reduce Platform DB queries
@cache(ttl=300)  # 5 minutes
async def get_user_info(user_id: int):
    return await platform_db.query(User).filter(User.id == user_id).first()
```

### Pagination
```python
# Always paginate history queries
history = db.query(AnnotationHistory)\
    .filter(project_id == pid)\
    .order_by(timestamp.desc())\
    .offset(skip)\
    .limit(100)\
    .all()
```

## Migration Path

### Step 1: Add Column (Non-Breaking)
```sql
ALTER TABLE annotation_projects ADD COLUMN last_updated_by INTEGER;
CREATE INDEX ix_annotation_projects_last_updated_by ON annotation_projects(last_updated_by);
```

### Step 2: Backfill Existing Data
```python
# Set last_updated_by = owner_id for existing projects
UPDATE annotation_projects
SET last_updated_by = owner_id
WHERE last_updated_by IS NULL;
```

### Step 3: Deploy Code
- Backend: Update AnnotationProject model
- Backend: Update project endpoints to set last_updated_by
- Frontend: Display last updated info

### Step 4: Make Column NOT NULL (Optional)
```sql
-- After confirming all projects have last_updated_by
ALTER TABLE annotation_projects ALTER COLUMN last_updated_by SET NOT NULL;
```

## Testing Strategy

### Unit Tests
```python
def test_update_project_sets_last_updated_by():
    project = update_project(project_id, changes, user_id=123)
    assert project.last_updated_by == 123
    assert project.updated_at is not None
```

### Integration Tests
```python
def test_project_response_includes_user_info():
    response = client.get(f"/api/v1/datasets/{dataset_id}/project")
    assert "last_updated_by_name" in response.json()
```

### Load Tests
```python
# Verify index performance
@pytest.mark.benchmark
def test_query_projects_by_updated_by():
    projects = db.query(AnnotationProject)\
        .filter(last_updated_by == user_id)\
        .all()
    # Should complete in < 100ms with index
```

## Rollout Plan

1. **Week 1**: Phase 1 implementation and testing
2. **Week 2**: Deploy to staging, gather feedback
3. **Week 3**: Deploy to production
4. **Month 2**: Collect usage data, plan Phase 2
5. **Quarter 2**: Implement Phase 3 based on needs

## Success Metrics

- **Phase 1**: 100% of projects show "Last updated by" info
- **Phase 2**: < 50ms query time for project list with user info
- **Phase 3**: Full audit trail for compliance requirements
- **User Satisfaction**: Positive feedback on history visibility

## References

- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Alembic Migrations](https://alembic.sqlalchemy.org/)
- [PostgreSQL Indexing Best Practices](https://www.postgresql.org/docs/current/indexes.html)

## Changelog

- 2025-11-13: Initial design document created
