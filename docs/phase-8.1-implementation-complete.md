# Phase 8.1 Implementation Complete

**Date**: 2025-11-23
**Status**: ✅ Backend Complete - Ready for Migration

## Summary

Phase 8.1 (Unified Permission System) has been successfully implemented. The new ProjectPermission system with 5-role RBAC is now ready for deployment.

---

## ✅ Completed Tasks

### Phase 8.1.1: Database Schema ✅
- Created Alembic migration: `20251123_1000_add_project_permissions_table.py`
- Added `ProjectPermission` model to `backend/app/db/models/labeler.py`
- Added ProjectPermission schemas to `backend/app/schemas/permission.py`
- **Roles**: owner, admin, reviewer, annotator, viewer
- **Role Hierarchy**: owner(5) > admin(4) > reviewer(3) > annotator(2) > viewer(1)

### Phase 8.1.2: Data Migration ✅
- Created migration script: `backend/scripts/migrate_dataset_permissions_to_project.py`
- **Role Mapping**:
  - DatasetPermission.owner → ProjectPermission.owner
  - DatasetPermission.member → ProjectPermission.annotator

### Phase 8.1.3: API Implementation ✅

#### Permission System ✅
- Added `require_project_permission()` helper in `backend/app/core/security.py`
- Supports role hierarchy (higher roles inherit lower role permissions)

#### New Project Permission Endpoints ✅
Created `backend/app/api/v1/endpoints/project_permissions.py`:
- `GET /api/v1/projects/{project_id}/permissions` - List permissions (viewer+)
- `POST /api/v1/projects/{project_id}/permissions` - Add member (admin+)
- `PATCH /api/v1/projects/{project_id}/permissions/{user_id}` - Update role (admin+)
- `DELETE /api/v1/projects/{project_id}/permissions/{user_id}` - Remove member (admin+)
- `POST /api/v1/projects/{project_id}/transfer-ownership` - Transfer ownership (owner only)

#### Updated Image Lock Endpoints ✅
Updated `backend/app/api/v1/endpoints/image_locks.py`:
- **Breaking Change**: `POST /api/v1/image-locks/acquire` → `POST /api/v1/image-locks/{project_id}/{image_id}/acquire`
- All endpoints now use `require_project_permission()`
- Permission requirements:
  - Acquire/release lock: annotator+
  - View locks: viewer+
  - Force release: admin+

#### Updated Annotation Endpoints ✅
Updated `backend/app/api/v1/endpoints/annotations.py`:
- `POST /annotations` - create_annotation (annotator+)
- `POST /annotations/batch` - batch_create_annotations (annotator+)
- `GET /annotations/project/{project_id}` - list_project_annotations (viewer+)
- `GET /annotations/history/project/{project_id}` - list_project_history (viewer+)
- `POST /annotations/import/project/{project_id}` - import_annotations (annotator+)

#### Frontend API Client Updated ✅
Updated `frontend/lib/api/image-locks.ts`:
- Changed `acquireLock()` to use path parameters instead of request body
- Removed unused `LockAcquireRequest` interface

---

## ⏳ User Action Required

### Step 1: Run Database Migrations

```bash
# 1. Run Alembic migration
cd backend
alembic upgrade head

# 2. Run data migration script (dry-run first to preview)
python scripts/migrate_dataset_permissions_to_project.py --dry-run

# 3. Run actual migration
python scripts/migrate_dataset_permissions_to_project.py
```

### Step 2: Verify Migration

After running the migration, verify the results:
```bash
# Check project_permissions table
psql -d labeler_db -c "SELECT role, COUNT(*) FROM project_permissions GROUP BY role;"

# Expected output:
#     role     | count
# -------------+-------
#  owner       |   X
#  annotator   |   Y
```

### Step 3: Test Permission System

1. **Test Project Permission Management**:
   - List permissions: `GET /api/v1/projects/{project_id}/permissions`
   - Add member: `POST /api/v1/projects/{project_id}/permissions`
   - Update role: `PATCH /api/v1/projects/{project_id}/permissions/{user_id}`

2. **Test Image Locks with New Permissions**:
   - Acquire lock (annotator role): `POST /api/v1/image-locks/{project_id}/{image_id}/acquire`
   - View locks (viewer role): `GET /api/v1/image-locks/{project_id}`
   - Force release (admin role): `DELETE /api/v1/image-locks/{project_id}/{image_id}/force`

3. **Test Annotations with New Permissions**:
   - Create annotation (annotator role)
   - List annotations (viewer role)

---

## 🔧 Technical Details

### Permission Check Flow

1. **Path Parameter Endpoints** (e.g., `/projects/{project_id}/...`):
   ```python
   @router.get("/{project_id}/...")
   async def endpoint(
       project_id: str,
       _permission=Depends(require_project_permission("viewer")),
   ):
       # Permission automatically checked before endpoint executes
   ```

2. **Request Body Endpoints** (e.g., `POST /annotations`):
   ```python
   @router.post("")
   async def create_annotation(annotation: AnnotationCreate, ...):
       # Manual permission check within endpoint
       permission = db.query(ProjectPermission).filter(...).first()
       if user_role_level < required_role_level:
           raise HTTPException(403, "Permission denied")
   ```

### Role Hierarchy Implementation

```python
ROLE_HIERARCHY = {
    'owner': 5,      # Full control
    'admin': 4,      # Manage members, classes, review
    'reviewer': 3,   # Annotate + review others
    'annotator': 2,  # Annotate own work
    'viewer': 1,     # Read-only
}

# Higher roles inherit lower role permissions
# e.g., owner can do everything annotator can do
```

---

## 📋 API Changes

### Breaking Changes

1. **Image Lock Acquire Endpoint**:
   - **Old**: `POST /api/v1/image-locks/acquire` with body `{project_id, image_id}`
   - **New**: `POST /api/v1/image-locks/{project_id}/{image_id}/acquire` with empty body

   **Frontend Fix**: Already updated in `frontend/lib/api/image-locks.ts`

### Non-Breaking Changes

All other endpoints remain backward compatible. New permission checks are added but don't change the API contract.

---

## 🔄 Backward Compatibility

- **DatasetPermission** table remains intact (not deleted)
- Existing dataset permission APIs still work
- Both systems coexist during transition period
- Full migration to ProjectPermission recommended for Phase 8.1.4+

---

## 📁 Modified Files

### Backend
1. `backend/alembic/versions/20251123_1000_add_project_permissions_table.py` - NEW
2. `backend/scripts/migrate_dataset_permissions_to_project.py` - NEW
3. `backend/app/db/models/labeler.py` - Added ProjectPermission model
4. `backend/app/schemas/permission.py` - Added ProjectPermission schemas
5. `backend/app/core/security.py` - Added require_project_permission(), ROLE_HIERARCHY
6. `backend/app/api/v1/endpoints/project_permissions.py` - NEW
7. `backend/app/api/v1/endpoints/image_locks.py` - Updated all endpoints
8. `backend/app/api/v1/endpoints/annotations.py` - Updated permission checks
9. `backend/app/api/v1/router.py` - Registered project_permissions router

### Frontend
1. `frontend/lib/api/image-locks.ts` - Updated acquireLock() endpoint

---

## 🎯 Next Steps (Phase 8.1.4+)

These tasks are **NOT** yet implemented (skipped as per user request):

1. **Invitation System**:
   - Email-based project invitations
   - Invitation tokens
   - Accept/decline workflow

2. **Frontend Permission UI**:
   - Project settings → Members tab
   - Add/remove/edit member roles
   - Transfer ownership UI
   - Role-based UI hiding (e.g., hide admin actions for viewers)

3. **Complete Dataset API Migration**:
   - Update remaining dataset endpoints to use ProjectPermission
   - Deprecate DatasetPermission APIs

4. **Permission-based UI Updates**:
   - Show/hide features based on user role
   - Disable actions user cannot perform
   - Display role badges in member lists

---

## 🐛 Known Issues / Limitations

1. **Annotation Endpoints**: Some annotation endpoints (get, update, delete by annotation_id) don't have permission checks yet. These would require looking up the project from annotation_id first.

2. **Dataset Endpoints**: Still using old DatasetPermission system. Migration planned for later phase.

3. **Frontend**: No UI for managing project permissions yet (Phase 8.1.4+).

---

## ✅ Testing Checklist

After migration, test the following:

- [ ] Can acquire lock as annotator role
- [ ] Can view locks as viewer role
- [ ] Cannot acquire lock as viewer role (should fail with 403)
- [ ] Can force release lock as admin/owner
- [ ] Cannot force release lock as annotator (should fail with 403)
- [ ] Can create annotation as annotator
- [ ] Can list annotations as viewer
- [ ] Cannot create annotation as viewer (should fail with 403)
- [ ] Can add project member as admin
- [ ] Cannot add member as annotator (should fail with 403)
- [ ] Can transfer ownership as owner only

---

## 📞 Questions?

If you encounter any issues during migration or testing, check:

1. Database migration completed: `alembic current`
2. ProjectPermission records created: `SELECT COUNT(*) FROM project_permissions;`
3. Backend logs for permission errors
4. Network tab in browser for 403 Forbidden errors

---

**Implementation Time**: ~2 hours
**Files Modified**: 10 files
**Lines of Code**: ~600 lines added
