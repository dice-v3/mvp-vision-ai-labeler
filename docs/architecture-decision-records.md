# Architecture Decision Records (ADR)

**Project**: Vision AI Labeler
**Created**: 2025-11-22

This document records important architectural decisions made during the development of the Vision AI Labeler platform.

---

## Table of Contents

1. [ADR-001: Dataset-Project 1:1 Relationship](#adr-001-dataset-project-11-relationship)
2. [ADR-002: Permission System Unification](#adr-002-permission-system-unification)
3. [ADR-003: Phase 8.5 First Implementation](#adr-003-phase-85-first-implementation)

---

## ADR-001: Dataset-Project 1:1 Relationship

**Date**: 2025-11-22
**Status**: ✅ Accepted
**Decision Makers**: Development Team

### Context

During Phase 8 (Collaboration Features) planning, we needed to clarify the relationship between Dataset and AnnotationProject entities.

**Current Implementation**:
```python
class Dataset:
    id: String(100) (PK)
    owner_id: Integer
    # ... dataset metadata

class AnnotationProject:
    id: String(50) (PK)
    dataset_id: String(50) (UNIQUE)  # 1:1 constraint
    owner_id: Integer

    # Multi-task support (already exists!)
    task_types: ARRAY(String(50))  # ['detection', 'classification', 'segmentation']
    task_classes: JSONB  # {task_type: {class_id: {...}}}
```

**Question**: Should we change to 1:N (one Dataset → multiple Projects)?

### Options Considered

#### Option A: Maintain 1:1 Relationship ✅ SELECTED

**Pros**:
- ✅ Simplicity: Single source of truth
- ✅ Already supports multi-task: One project can have detection + classification + segmentation simultaneously
- ✅ No code changes needed
- ✅ Permission system easier to manage
- ✅ No data integrity issues

**Cons**:
- ❌ Less flexibility for hypothetical future use cases

**Implementation**:
- Keep `dataset_id UNIQUE` constraint
- One project per dataset
- Multi-task handled via `task_types` array

#### Option B: Change to 1:N Relationship

**Pros**:
- ✅ Flexibility: Multiple teams working on different aspects
- ✅ Separation of concerns (e.g., "Production" vs "Research" projects)

**Cons**:
- ❌ Unnecessary complexity: Multi-task already supported
- ❌ Permission confusion: Which project controls what?
- ❌ Code refactoring required (remove UNIQUE constraint)
- ❌ No clear use cases identified

**Use case analysis**:
```
Hypothetical: Dataset "MVTec-AD" (10,000 images)
  ├─ Project 1: "Defect Detection" (detection only)
  ├─ Project 2: "Classification" (classification only)
  └─ Project 3: "Segmentation" (segmentation only)

Reality: This is ALREADY possible in ONE project:
  └─ Project: "Complete Annotation"
       ├─ detection task
       ├─ classification task
       └─ segmentation task
```

**Conclusion**: No real benefit for 1:N.

#### Option C: N:1 Relationship

**Pros**:
- None identified

**Cons**:
- ❌ Extreme complexity
- ❌ Merging datasets better handled by creating new dataset
- ❌ No use cases

### Decision

**Selected: Option A (Maintain 1:1)**

**Rationale**:
1. **Existing multi-task support**: The `task_types` array already enables multiple annotation tasks in a single project
2. **Simplicity**: 1:1 relationship is easier to understand and maintain
3. **No use cases**: We couldn't identify real-world scenarios requiring 1:N
4. **Permission clarity**: Single project = single permission model
5. **YAGNI principle**: Don't add complexity for hypothetical future needs

### Consequences

**Positive**:
- ✅ Keep existing schema
- ✅ Simpler permission system
- ✅ Easier to reason about data flow
- ✅ No migration needed

**Negative**:
- ⚠️ If 1:N is needed later, requires schema migration
- Mitigation: Can revisit if real use cases emerge

**Migration**: None required (keeping current structure)

### Implementation Notes

```python
# Confirmed constraints:
class AnnotationProject:
    dataset_id = Column(String(50), nullable=False, unique=True, index=True)  # KEEP UNIQUE

# Multi-task support (already implemented):
task_types = Column(ARRAY(String(50)))  # ['detection', 'classification', ...]
task_classes = Column(JSONB)  # {task_type: {class_id: {...}}}
```

---

## ADR-002: Permission System Unification

**Date**: 2025-11-22
**Status**: ✅ Accepted
**Decision Makers**: Development Team

### Context

Currently, we have **two separate permission systems**:

1. **DatasetPermission** (existing):
   - Roles: `owner`, `member`
   - Controls dataset access

2. **ProjectPermission** (planned for Phase 8.1):
   - Roles: `owner`, `admin`, `reviewer`, `annotator`, `viewer`
   - Controls annotation access

**Problem**: Since Dataset ↔ Project is 1:1, having two permission systems creates:
- Redundancy
- Data integrity issues (what if Dataset owner ≠ Project owner?)
- Synchronization overhead
- Confusion

### Options Considered

#### Option A: Unified Permission System (ProjectPermission only) ✅ SELECTED

**Approach**: Use **ProjectPermission** as the single source of truth

```python
# Remove or deprecate DatasetPermission
# Use only ProjectPermission with 5 roles

class ProjectPermission:
    project_id: String(50)  # Reference to AnnotationProject
    user_id: Integer
    role: String(20)  # 'owner', 'admin', 'reviewer', 'annotator', 'viewer'
    granted_by: Integer
    granted_at: DateTime

# Synchronization rule:
# Dataset.owner_id = AnnotationProject.owner_id (automatic)
```

**Role Capabilities**:

| Role | View | Annotate | Review | Manage Classes | Manage Members | Delete Dataset |
|------|------|----------|--------|----------------|----------------|----------------|
| owner | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| reviewer | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| annotator | ✅ | ✅ (own only) | ❌ | ❌ | ❌ | ❌ |
| viewer | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Pros**:
- ✅ Single source of truth
- ✅ No synchronization needed
- ✅ Finer-grained roles (5 vs 2)
- ✅ Easier to reason about
- ✅ Matches user mental model (permissions tied to projects, not datasets)

**Cons**:
- ⚠️ Need to migrate existing DatasetPermission data
- ⚠️ Dataset-level operations need permission lookup via Project

**Migration Strategy**:
```python
# Step 1: Create ProjectPermission table
# Step 2: Migrate data
for dataset_perm in DatasetPermission.all():
    project = AnnotationProject.query.filter_by(dataset_id=dataset_perm.dataset_id).first()
    if project:
        # Map roles: owner→owner, member→annotator
        new_role = 'owner' if dataset_perm.role == 'owner' else 'annotator'
        ProjectPermission.create(
            project_id=project.id,
            user_id=dataset_perm.user_id,
            role=new_role,
            granted_by=dataset_perm.granted_by,
            granted_at=dataset_perm.granted_at
        )

# Step 3: Mark DatasetPermission as deprecated
# Step 4: Update all API endpoints to use ProjectPermission
```

#### Option B: Keep Both Permission Systems

**Approach**: Maintain DatasetPermission + ProjectPermission with sync logic

```python
# Synchronization rules:
# - Dataset owner → automatic Project owner
# - Dataset member → automatic Project member (default: annotator)
# - Changes to DatasetPermission trigger ProjectPermission updates
```

**Pros**:
- ✅ No migration needed
- ✅ Dataset operations clearly separate

**Cons**:
- ❌ Complexity: Two sources of truth
- ❌ Synchronization bugs likely
- ❌ Confusing for users (which permission applies when?)
- ❌ More code to maintain

#### Option C: Unified Permission System (DatasetPermission only)

**Approach**: Extend DatasetPermission with more roles

**Pros**:
- ✅ Less migration (just add roles)

**Cons**:
- ❌ Conceptually wrong: Permissions should be on Projects (where work happens), not Datasets (just data storage)
- ❌ Doesn't match user mental model
- ❌ Future confusion if we ever need 1:N

### Decision

**Selected: Option A (Unified - ProjectPermission only)**

**Rationale**:
1. **Single source of truth**: Eliminates synchronization issues
2. **User mental model**: Permissions tied to projects (where annotation work happens)
3. **Finer-grained roles**: 5 roles vs 2 (owner, admin, reviewer, annotator, viewer)
4. **Future-proof**: If we ever go 1:N, project-level permissions make more sense
5. **Cleaner API**: All permission endpoints under `/projects/{id}/permissions`

### Consequences

**Positive**:
- ✅ Simpler architecture
- ✅ Better role granularity
- ✅ Matches user expectations
- ✅ Easier to test

**Negative**:
- ⚠️ Migration required for existing DatasetPermission data
- ⚠️ Dataset APIs need to lookup project first
- Mitigation: Migration script + backward compatibility layer during transition

**Breaking Changes**:
- DatasetPermission API endpoints deprecated
- Existing client code needs update

### Implementation Plan

**Phase 1**: Create ProjectPermission (Phase 8.1)
```python
# New table
class ProjectPermission(LabelerBase):
    __tablename__ = "project_permissions"

    id = Column(Integer, primary_key=True)
    project_id = Column(String(50), ForeignKey('annotation_projects.id', ondelete='CASCADE'))
    user_id = Column(Integer, index=True)
    role = Column(String(20))  # owner, admin, reviewer, annotator, viewer
    granted_by = Column(Integer)
    granted_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('project_id', 'user_id'),
        CheckConstraint("role IN ('owner', 'admin', 'reviewer', 'annotator', 'viewer')"),
    )
```

**Phase 2**: Migrate existing permissions
```bash
python backend/scripts/migrate_dataset_permissions_to_project.py
```

**Phase 3**: Update API endpoints
```python
# OLD (deprecated):
GET /datasets/{id}/permissions
POST /datasets/{id}/permissions/invite

# NEW:
GET /projects/{id}/permissions
POST /projects/{id}/permissions/invite
```

**Phase 4**: Backward compatibility (6 months)
```python
# Keep DatasetPermission table but mark as deprecated
# Sync writes to both tables during transition
# Remove after all clients updated
```

**Phase 5**: Cleanup
```python
# After 6 months:
# - Remove DatasetPermission table
# - Remove sync logic
# - Remove old API endpoints
```

### Validation

**Before migration**:
```sql
SELECT COUNT(*) FROM dataset_permissions;  -- 150 rows
```

**After migration**:
```sql
SELECT COUNT(*) FROM project_permissions;  -- 150 rows (verified)
SELECT role, COUNT(*) FROM project_permissions GROUP BY role;
-- owner: 50
-- annotator: 100 (migrated from 'member')
```

---

## ADR-003: Phase 8.5 First Implementation

**Date**: 2025-11-22
**Status**: ✅ Accepted
**Decision Makers**: Development Team

### Context

Original Phase 8 plan:
```
8.1 RBAC (18h) → 8.2 Task Assignment (18h) → 8.3 Review (17h)
→ 8.4 Activity (9h) → 8.5 Concurrent Handling (14h)
```

**Question**: Should we implement Phase 8.5 (Concurrent Handling) first?

### Options Considered

#### Option A: Original Order (8.1 → 8.2 → 8.3 → 8.4 → 8.5)

**Pros**:
- ✅ Logical progression
- ✅ RBAC provides foundation

**Cons**:
- ❌ Delayed value delivery (8.5 comes last)
- ❌ 18h + 18h + 17h + 9h = 62h before concurrent protection
- ❌ Team continues working without edit conflict protection

#### Option B: Implement 8.5 First ✅ SELECTED

**Pros**:
- ✅ **Immediate value**: Concurrent editing protection in 14h (2 weeks)
- ✅ **Zero dependencies**: 8.5 doesn't need RBAC, tasks, or reviews
- ✅ **Lower risk**: Simpler feature to start with
- ✅ **Faster feedback**: Can validate locking mechanism early
- ✅ **Team can use immediately**: No waiting for RBAC setup

**Cons**:
- ⚠️ Non-sequential implementation
- Mitigation: Well-isolated feature, no conflicts with other phases

**Dependency Analysis**:
```
Phase 8.5 needs:
✅ User authentication (JWT) - EXISTS
✅ Annotation model - EXISTS
✅ Annotation CRUD API - EXISTS
❌ RBAC - NOT NEEDED (uses existing owner check)
❌ Tasks - NOT NEEDED
❌ Reviews - NOT NEEDED
❌ Activity log - NOT NEEDED
```

### Decision

**Selected: Option B (Implement 8.5 First)**

**Rationale**:
1. **Immediate value**: Concurrent editing is needed NOW
2. **No dependencies**: Can implement independently
3. **Risk reduction**: Start with simpler feature
4. **Learning curve**: Practice before complex RBAC
5. **User feedback**: Get real usage data on locking mechanism

### Consequences

**Positive**:
- ✅ Concurrent protection available in 2 weeks
- ✅ Reduced risk (simple feature first)
- ✅ Early user feedback
- ✅ Team productivity boost (no edit conflicts)

**Negative**:
- ⚠️ Implementation order differs from planning doc
- Mitigation: Update planning doc to reflect new order

**Timeline Impact**:
```
Before: 62h wait for concurrent protection
After:  14h to concurrent protection (4.4x faster)
```

### Implementation Order

**New sequence**:
```
Phase 0: Architecture Decisions (1-2h) ✅ THIS DOCUMENT
  ↓
Phase 8.5: Concurrent Handling (14h) ⬅️ NEXT
  ├─ 8.5.1: Optimistic Locking (6h)
  └─ 8.5.2: Annotation Locks (8h)
  ↓
Phase 8.1: RBAC (18h)
  ↓
Phase 8.2: Task Assignment (18h)
  ↓
Phase 8.3: Review & Approval (17h)
  ↓
Phase 8.4: Activity Logging (9h)
```

**Total time**: Still 76h (same)
**Value delivery**: Much faster ⚡

### Phase 8.5 Scope

**8.5.1: Optimistic Locking** (6h)
```python
# Add version field
class Annotation:
    version = Column(Integer, default=1)

# Update logic
def update_annotation(annotation_id, request):
    annotation = get_annotation(annotation_id)

    if request.version != annotation.version:
        raise HTTPException(409, "Annotation modified by another user")

    # Update fields...
    annotation.version += 1
    db.commit()
```

**8.5.2: Annotation Locks** (8h)
```python
# New table
class AnnotationLock:
    annotation_id: BigInteger (UNIQUE)
    user_id: Integer
    locked_at: DateTime
    expires_at: DateTime  # 5-minute expiration
    heartbeat_at: DateTime

# APIs
POST /annotations/{id}/lock        # Acquire
DELETE /annotations/{id}/lock      # Release
POST /annotations/{id}/lock/heartbeat  # Keep alive
```

**Frontend**:
- Lock indicator on annotations
- Auto-heartbeat every 2 minutes
- Conflict resolution UI

---

## Summary

### Decisions Made

1. **ADR-001**: Keep Dataset ↔ Project **1:1** relationship
   - Multi-task support already exists
   - Simplicity over hypothetical flexibility

2. **ADR-002**: Unify permissions under **ProjectPermission**
   - 5 roles (owner, admin, reviewer, annotator, viewer)
   - Single source of truth
   - DatasetPermission deprecated

3. **ADR-003**: Implement **Phase 8.5 first**
   - Concurrent handling before RBAC
   - Faster value delivery (14h vs 62h)
   - Zero dependencies

### Next Steps

1. ✅ Document architecture decisions (THIS FILE)
2. ⬜ Update `docs/implementation-plan-collaboration-features.md`
3. ⬜ Create branch: `feature/phase-8.5-concurrent-handling`
4. ⬜ Implement Phase 8.5.1 (Optimistic Locking)
5. ⬜ Implement Phase 8.5.2 (Annotation Locks)
6. ⬜ Test concurrent editing scenarios
7. ⬜ Deploy and validate

---

**Document Version**: 1.0
**Last Updated**: 2025-11-22
**Status**: Active
