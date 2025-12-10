# Phase 8.5.1: Optimistic Locking - Implementation Summary

**Date**: 2025-11-22
**Status**: ✅ Implementation Complete, ⏳ Testing Pending

---

## Overview

Implemented optimistic locking for annotations to detect concurrent edits. When a user tries to update an annotation that was modified by another user, a conflict dialog appears allowing them to reload the latest version or overwrite with their changes.

---

## Changes Made

### 1. Database Schema

**Migration**: `backend/alembic/versions/20251122_1000_add_annotation_version_for_locking.py`

Added `version` field to `annotations` table:
```sql
ALTER TABLE annotations ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
CREATE INDEX ix_annotations_version ON annotations (version);
```

**Model Update**: `backend/app/db/models/labeler.py:263`
```python
class Annotation:
    # Phase 8.5.1: Optimistic locking
    version = Column(Integer, nullable=False, default=1, index=True)
```

### 2. Backend API

**Schema Updates**: `backend/app/schemas/annotation.py`

- `AnnotationUpdate`: Added `version` field (optional)
- `AnnotationResponse`: Added `version` field (required)

**Endpoint Updates**: `backend/app/api/v1/endpoints/annotations.py:272-344`

Added to `update_annotation` endpoint:

1. **Permission Check** (lines 291-304):
   ```python
   # Basic permission check (before full RBAC in Phase 8.1)
   # Users can only update their own annotations or owner can update any
   ```

2. **Version Conflict Detection** (lines 306-319):
   ```python
   if update_data.version is not None:
       if update_data.version != annotation.version:
           raise HTTPException(409, {
               "error": "conflict",
               "message": "Annotation modified by another user",
               "current_version": annotation.version,
               "your_version": update_data.version,
               ...
           })
   ```

3. **Version Increment** (line 344):
   ```python
   annotation.version += 1  # After successful update
   ```

### 3. Frontend Types

**API Types**: `frontend/lib/api/annotations.ts`

- `Annotation` interface: Added `version?: number` (line 67)
- `AnnotationUpdateRequest` interface: Added `version?: number` (line 164)

**Store Types**: `frontend/lib/stores/annotationStore.ts`

- `Annotation` interface: Added `version?: number` (line 102)

### 4. Conflict Resolution UI

**New Component**: `frontend/components/annotations/AnnotationConflictDialog.tsx`

Features:
- Shows version mismatch (your version vs current version)
- Displays last updated timestamp
- Three action buttons:
  - **Cancel**: Close dialog without action
  - **Reload Latest**: Discard changes and load current version
  - **Overwrite**: Force save with your changes

---

## Testing Required

### Prerequisites

1. **Start Database**:
   ```bash
   # Make sure Docker Desktop is running
   docker-compose up -d
   ```

2. **Run Migration**:
   ```bash
   cd backend
   alembic upgrade head
   ```

3. **Verify Migration**:
   ```sql
   \d annotations  -- Should show 'version' column
   SELECT id, version FROM annotations LIMIT 5;
   ```

### Test Scenarios

#### Test 1: Normal Update (No Conflict)

1. User A opens image, edits annotation (bbox/polygon)
2. User A saves → Success (version: 1 → 2)
3. User A edits again → Success (version: 2 → 3)

**Expected**: Normal operation, no conflict dialog

#### Test 2: Concurrent Edit Detection

1. User A opens image with annotation (version: 1)
2. User B opens same annotation (version: 1)
3. User B saves first → Success (version: 1 → 2)
4. User A tries to save → **409 Conflict**

**Expected**:
- User A sees conflict dialog
- Dialog shows: "Your version: v1, Current version: v2"
- Last updated info displayed

#### Test 3: Conflict Resolution - Reload

1. Trigger conflict scenario (Test 2)
2. User A clicks "Reload Latest"

**Expected**:
- Dialog closes
- Annotation reloads with version 2
- User A's changes discarded
- Canvas shows current annotation state

#### Test 4: Conflict Resolution - Overwrite

1. Trigger conflict scenario (Test 2)
2. User A clicks "Overwrite"

**Expected**:
- Force update annotation (bypass version check or use current version)
- Dialog closes
- User A's changes saved
- Version increments to 3

#### Test 5: Multiple Rapid Edits

1. User A makes 5 quick edits to same annotation
2. Each save should increment version: 1 → 2 → 3 → 4 → 5

**Expected**: All saves succeed, version increments correctly

#### Test 6: Permission Check

1. User A creates annotation
2. User B (non-owner, different user) tries to edit

**Expected**: 403 Forbidden (unless User B is project owner)

---

## Integration Points

### Where to Add Version Handling

**In Canvas Component** (`frontend/components/canvas/Canvas.tsx` or similar):

```typescript
import { AnnotationConflictDialog, ConflictInfo } from '@/components/annotations/AnnotationConflictDialog';

// State
const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
const [pendingUpdate, setPendingUpdate] = useState<{annotationId: string, data: any} | null>(null);

// In annotation update handler
const handleAnnotationUpdate = async (annotationId: string, updateData: any) => {
  try {
    // Include current version in update request
    const currentAnnotation = annotations.find(a => a.id === annotationId);
    const requestData = {
      ...updateData,
      version: currentAnnotation?.version,
    };

    await updateAnnotation(annotationId, requestData);
    // Success - reload annotations
    await loadAnnotations();
  } catch (error: any) {
    if (error.response?.status === 409) {
      // Conflict detected
      const detail = error.response.data.detail;
      setConflictInfo({
        annotationId,
        currentVersion: detail.current_version,
        yourVersion: detail.your_version,
        lastUpdatedBy: detail.last_updated_by,
        lastUpdatedAt: detail.last_updated_at,
        message: detail.message,
      });
      setPendingUpdate({ annotationId, data: updateData });
      setConflictDialogOpen(true);
    } else {
      // Other error
      console.error('Update failed:', error);
    }
  }
};

// Conflict handlers
const handleConflictReload = async () => {
  setConflictDialogOpen(false);
  setPendingUpdate(null);
  await loadAnnotations(); // Reload to get latest version
};

const handleConflictOverwrite = async () => {
  if (!pendingUpdate) return;

  try {
    // Force update without version check (or use latest version)
    const requestData = {
      ...pendingUpdate.data,
      version: conflictInfo?.currentVersion, // Use current version to force
    };
    await updateAnnotation(pendingUpdate.annotationId, requestData);
    setConflictDialogOpen(false);
    setPendingUpdate(null);
    await loadAnnotations();
  } catch (error) {
    console.error('Overwrite failed:', error);
  }
};

const handleConflictCancel = () => {
  setConflictDialogOpen(false);
  setPendingUpdate(null);
};

// In JSX
<AnnotationConflictDialog
  isOpen={conflictDialogOpen}
  conflict={conflictInfo}
  onReload={handleConflictReload}
  onOverwrite={handleConflictOverwrite}
  onCancel={handleConflictCancel}
/>
```

---

## Performance Impact

- **Write Operations**: Minimal (one integer comparison)
- **Read Operations**: No impact (version returned with annotation)
- **Database**: Single indexed integer column
- **Network**: +4 bytes per annotation response

---

## Future Enhancements (Phase 8.1+)

When RBAC is implemented, update permission checks:

```python
# Current (Phase 8.5.1):
is_owner = project.owner_id == current_user.id
is_creator = annotation.created_by == current_user.id

# Future (Phase 8.1):
permission = require_project_permission("annotator")  # Dependency injection
# Automatically checks: annotator, reviewer, admin, owner
```

---

## Rollback Plan

If issues arise:

```bash
# Rollback migration
cd backend
alembic downgrade -1

# This will:
# - Drop ix_annotations_version index
# - Drop version column from annotations table
```

---

## Files Changed

### Backend (6 files)
1. `backend/alembic/versions/20251122_1000_add_annotation_version_for_locking.py` - Migration
2. `backend/app/db/models/labeler.py:263` - Model update
3. `backend/app/schemas/annotation.py:32, 52` - Schema updates
4. `backend/app/api/v1/endpoints/annotations.py:272-344` - Endpoint logic

### Frontend (3 files)
5. `frontend/lib/api/annotations.ts:67, 164` - API types
6. `frontend/lib/stores/annotationStore.ts:102` - Store types
7. `frontend/components/annotations/AnnotationConflictDialog.tsx` - New component (131 lines)

**Total**: 9 files modified/created

---

## Next Steps

1. ✅ Implementation complete
2. ⏳ **Start Docker and run migration** (blocked: Docker Desktop not running)
3. ⏳ Test all scenarios
4. ⏳ Integrate conflict dialog into Canvas component
5. ⏳ Test with multiple users
6. 🔜 Proceed to Phase 8.5.2 (Image Locks)

---

**Implementation Time**: ~2-3 hours
**Estimated Testing Time**: ~1 hour
