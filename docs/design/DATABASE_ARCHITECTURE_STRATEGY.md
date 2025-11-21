# Database Architecture & Role Separation Strategy

**Date**: 2025-11-21
**Status**: Planning
**Version**: 1.0

---

## 1. Current Architecture Overview

### 1.1 Two-Database Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Labeler Backend                         │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────┐        │
│  │   Platform DB        │      │    Labeler DB        │        │
│  │   (Read-Only)        │      │   (Read-Write)       │        │
│  │                      │      │                      │        │
│  │ - users              │      │ - annotation_projects│        │
│  │ - datasets           │      │ - annotations        │        │
│  │ - snapshots          │      │ - images             │        │
│  │ - dataset_permissions│      │ - annotation_versions│        │
│  │   (NEW)              │      │ - image_annotation_  │        │
│  │                      │      │   status             │        │
│  └──────────────────────┘      └──────────────────────┘        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Characteristics**:
- **NO Foreign Key Constraints** between databases
- Platform DB: PostgreSQL (read-only access for Labeler)
- Labeler DB: PostgreSQL (full read-write access)
- Two separate SQLAlchemy engines

---

## 2. Database Role Separation (Current)

### 2.1 Platform DB Responsibilities

**Owner**: Platform Backend
**Access**: Labeler has **READ-ONLY** access

| Table | Purpose | Owner | Labeler Access |
|-------|---------|-------|----------------|
| `users` | User accounts, authentication | Platform | Read (for user lookup) |
| `datasets` | Dataset metadata, storage paths | Platform | Read (for dataset info) |
| `snapshots` | Dataset snapshots | Platform | Read |
| `dataset_permissions` | Dataset access control (NEW) | Platform | Read |

**Platform DB Data**:
- **User Management**: email, hashed_password, system_role
- **Dataset Metadata**: name, description, owner_id, storage_path
- **Access Control**: Who can access which dataset (owner/member)
- **Storage Information**: S3 paths, file counts, content hash

**Platform Backend Responsibilities**:
- User authentication & authorization
- Dataset creation/deletion
- Permission management (invite, change role, remove)
- S3 bucket management
- Dataset-level metadata updates

---

### 2.2 Labeler DB Responsibilities

**Owner**: Labeler Backend
**Access**: Full read-write

| Table | Purpose | Dependencies |
|-------|---------|--------------|
| `annotation_projects` | Project configuration, task types, classes | `datasets.id` (no FK) |
| `annotations` | Annotation data (bbox, polygon, etc.) | `annotation_projects.id` |
| `images` | Image records with presigned URLs | `datasets.id` (no FK) |
| `annotation_versions` | Published annotation versions | `annotation_projects.id` |
| `annotation_snapshots` | Snapshot of annotations at publish time | `annotation_versions.id` |
| `image_annotation_status` | Image-level annotation status | `images.id`, `annotation_projects.id` |

**Labeler DB Data**:
- **Annotation Data**: All bbox, polygon, classification annotations
- **Project Configuration**: task_types, task_config, task_classes
- **Image Tracking**: file_path, file_name, presigned URLs
- **Versioning**: Annotation versions, snapshots
- **Statistics**: Annotation counts, image status

**Labeler Backend Responsibilities**:
- Annotation CRUD operations
- Project configuration management
- Class management (per task type)
- Image status tracking
- Annotation export (COCO, YOLO, DICE)
- Versioning and snapshots

---

## 3. Data Ownership & Synchronization Strategy

### 3.1 Master-Slave Relationships

| Data Type | Master (Source of Truth) | Slave (Cached Copy) |
|-----------|--------------------------|---------------------|
| User Information | Platform DB `users` | Labeler references by `user_id` only |
| Dataset Metadata | Platform DB `datasets` | Labeler reads on-demand |
| Dataset Permissions | Platform DB `dataset_permissions` | Labeler reads for access control |
| Annotation Data | Labeler DB `annotations` | None (Labeler owns) |
| Project Config | Labeler DB `annotation_projects` | None (Labeler owns) |

### 3.2 Current Synchronization Strategy

**Read-Heavy Pattern**: Labeler reads from Platform DB, never writes

```python
# Example: Get user info from Platform DB
@router.get("/users/{user_id}")
def get_user(user_id: int, platform_db: Session = Depends(get_platform_db)):
    user = platform_db.query(User).filter(User.id == user_id).first()
    return user  # Read-only, never commit()

# Example: Create annotation in Labeler DB
@router.post("/annotations")
def create_annotation(
    annotation: AnnotationCreate,
    labeler_db: Session = Depends(get_labeler_db),
):
    new_annotation = Annotation(**annotation.dict())
    labeler_db.add(new_annotation)
    labeler_db.commit()  # Write to Labeler DB only
    return new_annotation
```

**Problem**: No automatic sync mechanism
- If Platform deletes a dataset, Labeler DB has orphaned data
- If Platform changes user email, Labeler cache is stale
- No referential integrity enforcement

---

## 4. Critical Issues with Current Architecture

### 4.1 Orphaned Data Problem

**Scenario**: User deletes dataset in Platform
```
Platform DB: DELETE FROM datasets WHERE id = 'dataset_123';
Labeler DB:  (Still has annotation_projects, annotations, images for 'dataset_123')
```

**Result**: Orphaned data in Labeler DB

**Current Solution (Phase 2.10.1)**:
- Labeler deletion endpoint cascades to both DBs
- Manual cleanup required

### 4.2 Permission Enforcement

**Scenario**: Check if user can delete image

**Option 1: Query Platform DB every time** (Current)
```python
def check_permission(user_id: int, dataset_id: str, platform_db: Session):
    perm = platform_db.query(DatasetPermission).filter(
        DatasetPermission.dataset_id == dataset_id,
        DatasetPermission.user_id == user_id
    ).first()

    if not perm or perm.role != 'owner':
        raise HTTPException(403, "Only owners can delete images")
```

**Pros**: Always up-to-date
**Cons**: Extra DB query on every request, network latency

**Option 2: Cache in Labeler DB** (Not implemented)
```python
# Cache permission in Labeler DB
class CachedPermission(LabelerBase):
    dataset_id = Column(String)
    user_id = Column(Integer)
    role = Column(String)
    synced_at = Column(DateTime)
```

**Pros**: Fast lookup
**Cons**: Stale data, complex cache invalidation

### 4.3 No Transactional Integrity

**Scenario**: Create dataset + project atomically

**Current (Non-atomic)**:
```python
# Step 1: Create in Platform DB
platform_db.execute("INSERT INTO datasets ...")
platform_db.commit()

# Step 2: Create in Labeler DB (separate transaction)
labeler_db.execute("INSERT INTO annotation_projects ...")
labeler_db.commit()  # If this fails, dataset exists but no project!
```

**Problem**: If step 2 fails, dataset exists in Platform but no project in Labeler

**No rollback mechanism** across databases

---

## 5. Proposed Architecture: Hybrid Approach

### 5.1 Option A: Direct DB Access (Current - Keep)

**Architecture**:
```
┌────────────────┐
│ Labeler Backend│
│                │
│  ┌─────────┐   │     ┌─────────────┐
│  │ Service │───┼────▶│ Platform DB │ (Read-Only)
│  │  Layer  │   │     └─────────────┘
│  │         │   │     ┌─────────────┐
│  │         │───┼────▶│ Labeler DB  │ (Read-Write)
│  └─────────┘   │     └─────────────┘
└────────────────┘
```

**Data Flow**:
1. User request → Labeler Backend
2. Read user/permission from Platform DB
3. Write annotations to Labeler DB
4. Return response

**Pros**:
- Simple, low latency
- No additional infrastructure
- Direct SQL queries (efficient)

**Cons**:
- No transactional integrity across DBs
- Manual permission checks
- Orphaned data risk

**Use Cases**: Internal tool, MVP, small teams

---

### 5.2 Option B: Platform API Gateway (Recommended for Production)

**Architecture**:
```
┌────────────────┐                    ┌─────────────────┐
│ Labeler Backend│                    │ Platform Backend│
│                │                    │                 │
│  ┌─────────┐   │  HTTP REST API     │  ┌──────────┐   │
│  │ Service │───┼───────────────────▶│  │ Datasets │   │
│  │  Layer  │   │  POST /datasets    │  │    API   │   │
│  │         │   │  GET /permissions  │  └──────────┘   │
│  │         │   │                    │       │         │
│  │         │───┼─────┐              │       ▼         │
│  └─────────┘   │     │              │  ┌──────────┐   │
│       │        │     │              │  │Platform  │   │
│       ▼        │     │              │  │   DB     │   │
│  ┌─────────┐   │     │              │  └──────────┘   │
│  │Labeler  │   │     │              └─────────────────┘
│  │   DB    │   │     │
│  └─────────┘   │     │
└────────────────┘     │
                       │
                       ▼
                 ┌─────────────┐
                 │  S3 Bucket  │
                 └─────────────┘
```

**Data Flow**:
1. User creates dataset
2. Labeler → `POST /platform/api/v1/datasets`
3. Platform creates dataset + permissions in Platform DB
4. Platform returns dataset_id
5. Labeler creates project in Labeler DB (reference dataset_id)

**Key Changes**:

**Platform Backend provides**:
```
POST   /api/v1/datasets                    # Create dataset
DELETE /api/v1/datasets/{id}               # Delete dataset
GET    /api/v1/datasets/{id}/permissions   # List permissions
POST   /api/v1/datasets/{id}/permissions   # Invite user
PUT    /api/v1/datasets/{id}/permissions/{user_id}  # Change role
DELETE /api/v1/datasets/{id}/permissions/{user_id}  # Remove user
GET    /api/v1/users/search?email={email}  # User lookup
POST   /api/v1/storage/upload               # Upload to S3
```

**Labeler Backend changes**:
```python
# Instead of direct DB access
platform_db.query(Dataset).filter(...)

# Call Platform API
response = requests.post(
    "http://platform-backend/api/v1/datasets",
    json={"name": "...", "owner_id": current_user.id}
)
dataset = response.json()
```

**Pros**:
- Platform owns all dataset/permission logic
- Transactional integrity (Platform ensures consistency)
- Easier to add features (versioning, audit log)
- Clean separation of concerns

**Cons**:
- HTTP overhead (latency)
- Platform backend must be running
- More complex deployment

**Migration Path**:
1. **Phase 1** (Current): Direct DB access
2. **Phase 2**: Add Platform API endpoints
3. **Phase 3**: Migrate Labeler to use API
4. **Phase 4**: Remove Labeler's Platform DB access

---

### 5.3 Option C: Event-Driven Architecture (Future)

**Architecture**:
```
┌────────────────┐      Events       ┌─────────────────┐
│ Labeler Backend│◀─────────────────▶│ Platform Backend│
│                │                    │                 │
│                │  Message Queue     │                 │
│  ┌─────────┐   │  (RabbitMQ/Kafka)  │  ┌──────────┐   │
│  │Consumer │◀──┼─────┐      ┌───────┼─▶│Publisher │   │
│  └─────────┘   │     │      │       │  └──────────┘   │
│       │        │     │      │       │                 │
│       ▼        │     ▼      ▼       │                 │
│  ┌─────────┐   │  ┌─────────────┐   │  ┌──────────┐   │
│  │Labeler  │   │  │   Message   │   │  │Platform  │   │
│  │   DB    │   │  │    Queue    │   │  │   DB     │   │
│  └─────────┘   │  └─────────────┘   │  └──────────┘   │
└────────────────┘                    └─────────────────┘
```

**Event Types**:
- `dataset.created` → Labeler creates project
- `dataset.deleted` → Labeler deletes annotations
- `user.permission_changed` → Labeler invalidates cache
- `annotation.published` → Platform updates dataset metadata

**Pros**:
- Async, decoupled
- High scalability
- Event replay for debugging
- Eventual consistency

**Cons**:
- Complex infrastructure (message queue)
- Eventual consistency (not immediate)
- Harder to debug

**Use Cases**: Large-scale production, multi-tenant

---

## 6. Recommended Strategy for Phase 2.10

### 6.1 Short-term (MVP): Option A - Direct DB Access

**Rationale**: Already implemented, works for small teams

**Implementation**:
```python
# Permission check using Platform DB
def require_dataset_permission(role: str = "member"):
    def decorator(func):
        async def wrapper(
            dataset_id: str,
            current_user: User = Depends(get_current_user),
            platform_db: Session = Depends(get_platform_db),
        ):
            # Query Platform DB directly
            perm = platform_db.query(DatasetPermission).filter(
                DatasetPermission.dataset_id == dataset_id,
                DatasetPermission.user_id == current_user.id
            ).first()

            if not perm:
                raise HTTPException(403, "No access to dataset")

            if role == "owner" and perm.role != "owner":
                raise HTTPException(403, "Owner permission required")

            return await func(dataset_id, current_user, platform_db)
        return wrapper
    return decorator
```

**Usage**:
```python
@router.delete("/datasets/{dataset_id}/images/{image_id}")
@require_dataset_permission(role="owner")
async def delete_image(dataset_id: str, image_id: str, ...):
    # Only owners can execute this
    ...
```

**Add to TODO**:
- Phase 2.10.2.2: Permission middleware (5h)
- Create `dataset_permissions` table in Platform DB
- Implement decorator-based permission checks

---

### 6.2 Mid-term (Production): Option B - Platform API Gateway

**Migration Timeline**:
- **Week 12**: Platform backend implements dataset APIs
- **Week 13**: Labeler migrates to use Platform APIs
- **Week 14**: Remove direct Platform DB access

**Platform API Implementation** (Platform Team):
```python
# Platform Backend
@router.post("/api/v1/datasets")
async def create_dataset(
    dataset: DatasetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Create dataset in Platform DB
    new_dataset = Dataset(
        id=generate_id(),
        name=dataset.name,
        owner_id=current_user.id,
        ...
    )
    db.add(new_dataset)

    # Create owner permission
    permission = DatasetPermission(
        dataset_id=new_dataset.id,
        user_id=current_user.id,
        role="owner",
        granted_by=current_user.id
    )
    db.add(permission)
    db.commit()

    return new_dataset
```

**Labeler API Client** (Labeler Team):
```python
# Labeler Backend
class PlatformClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url
        self.api_key = api_key

    async def create_dataset(self, name: str, owner_id: int) -> dict:
        response = await httpx.post(
            f"{self.base_url}/api/v1/datasets",
            json={"name": name, "owner_id": owner_id},
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        response.raise_for_status()
        return response.json()

    async def check_permission(self, dataset_id: str, user_id: int) -> dict:
        response = await httpx.get(
            f"{self.base_url}/api/v1/datasets/{dataset_id}/permissions/{user_id}",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        return response.json()
```

**Add to TODO**:
- Phase 4.6: Platform API Integration (Week 12, 15h)
- Platform Backend: Implement dataset CRUD APIs
- Labeler Backend: Add Platform API client
- Migration script: Test API integration

---

## 7. Database Schema Changes for Phase 2.10

### 7.1 Platform DB (NEW Table)

**Create `dataset_permissions` table**:
```sql
CREATE TABLE dataset_permissions (
    id SERIAL PRIMARY KEY,
    dataset_id VARCHAR(100) NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL,  -- 'owner' or 'member'
    granted_by INTEGER NOT NULL,
    granted_at TIMESTAMP DEFAULT NOW(),

    CONSTRAINT fk_dataset
        FOREIGN KEY (dataset_id)
        REFERENCES datasets(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_granted_by
        FOREIGN KEY (granted_by)
        REFERENCES users(id),

    CONSTRAINT unique_user_dataset
        UNIQUE (dataset_id, user_id),

    CONSTRAINT check_role
        CHECK (role IN ('owner', 'member')),

    CONSTRAINT check_at_least_one_owner
        CHECK (
            -- Ensure at least one owner per dataset
            -- This is enforced at application level
        )
);

CREATE INDEX idx_dataset_permissions_dataset ON dataset_permissions(dataset_id);
CREATE INDEX idx_dataset_permissions_user ON dataset_permissions(user_id);
```

**SQLAlchemy Model** (Platform Backend):
```python
class DatasetPermission(Base):
    __tablename__ = "dataset_permissions"

    id = Column(Integer, primary_key=True)
    dataset_id = Column(String(100), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    role = Column(String(20), nullable=False)  # 'owner' or 'member'
    granted_by = Column(Integer, nullable=False)
    granted_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        ForeignKeyConstraint(['dataset_id'], ['datasets.id'], ondelete='CASCADE'),
        ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        ForeignKeyConstraint(['granted_by'], ['users.id']),
        UniqueConstraint('dataset_id', 'user_id'),
        CheckConstraint("role IN ('owner', 'member')"),
    )
```

**Labeler Read-Only Model**:
```python
# backend/app/db/models/platform.py
class DatasetPermission(PlatformBase):
    """Dataset permission model from Platform database (READ-ONLY)."""

    __tablename__ = "dataset_permissions"

    id = Column(Integer, primary_key=True)
    dataset_id = Column(String(100), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    role = Column(String(20), nullable=False)
    granted_by = Column(Integer, nullable=False)
    granted_at = Column(DateTime)
```

---

### 7.2 Labeler DB (No Schema Changes)

No new tables needed for permissions (Platform DB owns this)

**Only references**:
- `annotation_projects.owner_id` → Platform `users.id` (no FK)
- `annotation_projects.dataset_id` → Platform `datasets.id` (no FK)

---

## 8. Permission Check Implementation

### 8.1 Middleware Decorator

**File**: `backend/app/middleware/permissions.py`

```python
"""
Dataset Permission Middleware

Provides decorators to enforce dataset access control.
Queries Platform DB for permissions.
"""

from functools import wraps
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_platform_db
from app.db.models.platform import DatasetPermission
from app.auth.dependencies import get_current_user


def require_dataset_permission(required_role: str = "member"):
    """
    Decorator to enforce dataset permission.

    Args:
        required_role: 'owner' or 'member'

    Usage:
        @router.delete("/datasets/{id}/images/{image_id}")
        @require_dataset_permission(role="owner")
        async def delete_image(dataset_id: str, ...):
            # Only owners can delete images
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(
            dataset_id: str,
            current_user = Depends(get_current_user),
            platform_db: Session = Depends(get_platform_db),
            *args,
            **kwargs
        ):
            # Check permission in Platform DB
            permission = platform_db.query(DatasetPermission).filter(
                DatasetPermission.dataset_id == dataset_id,
                DatasetPermission.user_id == current_user.id
            ).first()

            if not permission:
                raise HTTPException(
                    status_code=403,
                    detail=f"No access to dataset {dataset_id}"
                )

            # Check role
            if required_role == "owner" and permission.role != "owner":
                raise HTTPException(
                    status_code=403,
                    detail="Owner permission required for this operation"
                )

            # Permission granted, execute function
            return await func(dataset_id, current_user, platform_db, *args, **kwargs)

        return wrapper
    return decorator


def get_user_datasets(user_id: int, platform_db: Session) -> list[str]:
    """
    Get all dataset IDs the user has access to.

    Returns:
        List of dataset IDs
    """
    permissions = platform_db.query(DatasetPermission).filter(
        DatasetPermission.user_id == user_id
    ).all()

    return [perm.dataset_id for perm in permissions]


def check_dataset_permission(dataset_id: str, user_id: int, platform_db: Session) -> str | None:
    """
    Check user's permission on a dataset.

    Returns:
        'owner', 'member', or None (no access)
    """
    permission = platform_db.query(DatasetPermission).filter(
        DatasetPermission.dataset_id == dataset_id,
        DatasetPermission.user_id == user_id
    ).first()

    return permission.role if permission else None
```

---

### 8.2 Usage Examples

**Example 1: Delete Image (Owner Only)**
```python
@router.delete("/datasets/{dataset_id}/images/{image_id}")
@require_dataset_permission(role="owner")
async def delete_image(
    dataset_id: str,
    image_id: str,
    current_user = Depends(get_current_user),
    labeler_db: Session = Depends(get_labeler_db),
):
    # Decorator ensures only owners reach here

    # Delete from Labeler DB
    image = labeler_db.query(Image).filter(Image.id == image_id).first()
    labeler_db.delete(image)
    labeler_db.commit()

    # Delete from S3
    storage_client.delete_file(image.file_path)

    return {"message": "Image deleted"}
```

**Example 2: Add Annotation (Member or Owner)**
```python
@router.post("/datasets/{dataset_id}/annotations")
@require_dataset_permission(role="member")  # Members can annotate
async def create_annotation(
    dataset_id: str,
    annotation: AnnotationCreate,
    current_user = Depends(get_current_user),
    labeler_db: Session = Depends(get_labeler_db),
):
    # Both owners and members can create annotations
    new_annotation = Annotation(**annotation.dict(), created_by=current_user.id)
    labeler_db.add(new_annotation)
    labeler_db.commit()

    return new_annotation
```

**Example 3: Filter Datasets by User**
```python
@router.get("/datasets")
async def list_datasets(
    current_user = Depends(get_current_user),
    platform_db: Session = Depends(get_platform_db),
):
    # Get dataset IDs user has access to
    dataset_ids = get_user_datasets(current_user.id, platform_db)

    # Query datasets
    datasets = platform_db.query(Dataset).filter(
        Dataset.id.in_(dataset_ids)
    ).all()

    return datasets
```

---

## 9. Comparison Matrix

| Aspect | Direct DB Access | Platform API | Event-Driven |
|--------|------------------|--------------|--------------|
| **Complexity** | Low | Medium | High |
| **Latency** | Low (direct SQL) | Medium (HTTP) | Low (async) |
| **Transactional Integrity** | ❌ No | ✅ Yes | ⚠️ Eventual |
| **Infrastructure** | 2 DBs | 2 DBs + API | 2 DBs + Queue |
| **Debugging** | Easy | Medium | Hard |
| **Scalability** | Medium | High | Very High |
| **Cost** | Low | Medium | High |
| **MVP Readiness** | ✅ Ready | ⏸️ Needs Platform API | ❌ Not ready |

---

## 10. Recommended Implementation Plan

### Phase 2.10.2: Dataset Creation & Ownership (Week 8)

**Use Direct DB Access** (Option A)

1. **Platform DB Migration** (2h)
   - Create `dataset_permissions` table
   - Add indexes

2. **Permission Middleware** (2h)
   - Implement `@require_dataset_permission` decorator
   - Implement helper functions

3. **Dataset Creation Endpoint** (3h)
   - `POST /api/v1/datasets` in Labeler
   - Create in Platform DB (via direct SQL)
   - Create permission record (owner)
   - Create in Labeler DB (annotation_project)

4. **Permission Management API** (6h)
   - Invite user endpoint
   - Change role endpoint
   - Remove user endpoint
   - Transfer ownership endpoint

5. **Frontend Permission UI** (5h)
   - Dataset detail permission section
   - Invite user modal
   - Manage permissions

**Total**: 22h (as planned)

---

### Phase 4.6: Platform API Migration (Week 12) - FUTURE

**Migrate to Platform API** (Option B)

1. **Platform Backend** (10h - Platform team)
   - Implement dataset CRUD APIs
   - Implement permission APIs
   - Implement user search API

2. **Labeler Backend** (5h - Labeler team)
   - Add Platform API client
   - Replace direct DB calls with API calls
   - Add error handling & retries

3. **Testing & Migration** (3h)
   - Integration tests
   - Gradual rollout (feature flag)
   - Remove Platform DB access

**Total**: 18h

---

## 11. Decision Summary

### For Phase 2.10 (Current Sprint):

✅ **Use Option A: Direct DB Access**

**Rationale**:
- Simple, already in use
- No Platform backend changes needed
- Low latency
- Sufficient for MVP and small teams

**Accept Trade-offs**:
- No transactional integrity
- Manual permission checks
- Orphaned data risk (mitigated by cleanup scripts)

### For Future (Post-MVP):

🎯 **Migrate to Option B: Platform API Gateway**

**Rationale**:
- Better separation of concerns
- Transactional integrity
- Easier to scale
- Platform owns permission logic

**Timeline**: Week 12+ (after Phase 2.10 complete)

---

## 12. Open Questions

1. **Platform API Availability**: When will Platform backend provide dataset APIs?
2. **Migration Strategy**: Gradual (feature flag) or big bang?
3. **Caching**: Should we cache permissions in Labeler DB for performance?
4. **Audit Log**: Where to store permission change history? (Platform or Labeler?)
5. **Multi-tenancy**: Will we need organization-level permissions?

---

## Appendix A: Platform DB Schema

**Current Schema** (Platform Backend owns):
```sql
-- Existing
CREATE TABLE users (...);
CREATE TABLE datasets (...);
CREATE TABLE snapshots (...);

-- NEW for Phase 2.10
CREATE TABLE dataset_permissions (
    id SERIAL PRIMARY KEY,
    dataset_id VARCHAR(100) NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'member')),
    granted_by INTEGER NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(dataset_id, user_id)
);
```

---

## Appendix B: API Contracts

### Labeler → Platform (Future)

**Create Dataset**:
```
POST /platform/api/v1/datasets
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "name": "My Dataset",
  "description": "...",
  "owner_id": 1
}

Response 201:
{
  "id": "ds_abc123",
  "name": "My Dataset",
  "owner_id": 1,
  "storage_path": "s3://bucket/ds_abc123/",
  "created_at": "2025-11-21T10:00:00Z"
}
```

**Invite User**:
```
POST /platform/api/v1/datasets/{id}/permissions
Content-Type: application/json

{
  "email": "user@example.com",
  "role": "member"
}

Response 200:
{
  "dataset_id": "ds_abc123",
  "user_id": 5,
  "role": "member",
  "granted_by": 1,
  "granted_at": "2025-11-21T10:05:00Z"
}
```

---

**End of Document**
