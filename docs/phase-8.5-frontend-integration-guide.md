# Phase 8.5: Frontend Integration Guide

**Date**: 2025-11-22
**Status**: ✅ Backend Complete, ✅ API Client Created, 📝 Integration Guide

---

## Overview

This guide shows how to integrate Phase 8.5 features into the frontend:
1. **Optimistic Locking**: Handle version conflicts when updating annotations
2. **Image Locks**: Acquire/release locks when opening/closing images

---

## 1. Optimistic Locking Integration

### Location

Any component that updates annotations (e.g., Canvas, annotation editor)

### Implementation

```typescript
import { useState } from 'react';
import { updateAnnotation } from '@/lib/api/annotations';
import { AnnotationConflictDialog, ConflictInfo } from '@/components/annotations/AnnotationConflictDialog';

function AnnotationCanvas() {
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<{
    annotationId: string;
    data: any;
  } | null>(null);

  // Handle annotation update with version check
  const handleAnnotationUpdate = async (annotationId: string, updateData: any) => {
    try {
      // Get current annotation from state
      const annotation = annotations.find(a => a.id === annotationId);

      // Include current version in update request
      await updateAnnotation(annotationId, {
        ...updateData,
        version: annotation?.version,
      });

      // Success - reload annotations
      await reloadAnnotations();

    } catch (error: any) {
      if (error.response?.status === 409) {
        // Version conflict detected
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
        console.error('Annotation update failed:', error);
        toast.error('Failed to update annotation');
      }
    }
  };

  // Conflict resolution: Reload latest version
  const handleConflictReload = async () => {
    setConflictDialogOpen(false);
    setPendingUpdate(null);
    setConflictInfo(null);

    // Reload annotations to get latest version
    await reloadAnnotations();
    toast.info('Reloaded latest version');
  };

  // Conflict resolution: Overwrite with your changes
  const handleConflictOverwrite = async () => {
    if (!pendingUpdate || !conflictInfo) return;

    try {
      // Force update with current version
      await updateAnnotation(pendingUpdate.annotationId, {
        ...pendingUpdate.data,
        version: conflictInfo.currentVersion, // Use current version to pass check
      });

      setConflictDialogOpen(false);
      setPendingUpdate(null);
      setConflictInfo(null);

      await reloadAnnotations();
      toast.success('Changes saved');

    } catch (error) {
      console.error('Overwrite failed:', error);
      toast.error('Failed to overwrite changes');
    }
  };

  // Conflict resolution: Cancel
  const handleConflictCancel = () => {
    setConflictDialogOpen(false);
    setPendingUpdate(null);
    setConflictInfo(null);
  };

  return (
    <div>
      {/* Your canvas component */}
      <Canvas
        annotations={annotations}
        onAnnotationUpdate={handleAnnotationUpdate}
      />

      {/* Conflict resolution dialog */}
      <AnnotationConflictDialog
        isOpen={conflictDialogOpen}
        conflict={conflictInfo}
        onReload={handleConflictReload}
        onOverwrite={handleConflictOverwrite}
        onCancel={handleConflictCancel}
      />
    </div>
  );
}
```

---

## 2. Image Lock Integration

### A. Lock Acquisition in Canvas/Image Viewer

```typescript
import { useState, useEffect } from 'react';
import { imageLockAPI, LockAcquireResponse } from '@/lib/api/image-locks';
import { toast } from 'react-hot-toast';

function ImageCanvas({ projectId, imageId }: { projectId: string; imageId: string }) {
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedDialogOpen, setLockedDialogOpen] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);

  // Acquire lock when image opens
  useEffect(() => {
    if (!imageId) return;

    const acquireImageLock = async () => {
      try {
        const result: LockAcquireResponse = await imageLockAPI.acquireLock(
          projectId,
          imageId
        );

        if (result.status === 'already_locked') {
          // Image is locked by another user
          setLockedBy(result.locked_by?.user_name || 'another user');
          setLockedDialogOpen(true);
          setIsLocked(false);
          return;
        }

        // Lock acquired or refreshed
        setIsLocked(true);
        toast.success(
          result.status === 'acquired'
            ? 'Image locked for editing'
            : 'Lock refreshed'
        );

        // Start heartbeat
        startHeartbeat();

      } catch (error) {
        console.error('Failed to acquire lock:', error);
        toast.error('Failed to acquire lock on image');
      }
    };

    acquireImageLock();

    // Cleanup: Release lock when unmounting
    return () => {
      releaseLockOnUnmount();
    };
  }, [imageId, projectId]);

  // Start heartbeat to keep lock alive
  const startHeartbeat = () => {
    // Clear existing interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    // Send heartbeat every 2 minutes (lock expires after 5 minutes)
    const interval = setInterval(async () => {
      try {
        await imageLockAPI.sendHeartbeat(projectId, imageId);
        console.log('Heartbeat sent');
      } catch (error) {
        console.error('Heartbeat failed:', error);
        toast.error('Lost lock on image');
        clearInterval(interval);
        setIsLocked(false);
      }
    }, 2 * 60 * 1000); // Every 2 minutes

    setHeartbeatInterval(interval);
  };

  // Release lock when component unmounts
  const releaseLockOnUnmount = async () => {
    // Clear heartbeat
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    // Release lock
    if (isLocked && imageId) {
      try {
        await imageLockAPI.releaseLock(projectId, imageId);
        console.log('Lock released');
      } catch (error) {
        console.error('Failed to release lock:', error);
      }
    }
  };

  // Manual lock release (when user closes image)
  const handleCloseImage = async () => {
    await releaseLockOnUnmount();
    // Navigate away or close image viewer
  };

  return (
    <div>
      {/* Lock status indicator */}
      {isLocked && (
        <div className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm">
          🔒 You have exclusive editing access
        </div>
      )}

      {/* Canvas/Image viewer */}
      <div className="canvas-container">
        {/* Your canvas component */}
      </div>

      {/* Image locked by another user dialog */}
      {lockedDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setLockedDialogOpen(false)} />
          <div className="relative bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-2">Image Locked</h3>
            <p className="text-gray-700 mb-4">
              This image is currently being edited by <strong>{lockedBy}</strong>.
              Please wait or choose another image.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setLockedDialogOpen(false)}
                className="flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Choose Another Image
              </button>
              <button
                onClick={async () => {
                  setLockedDialogOpen(false);
                  // Retry acquiring lock
                  const result = await imageLockAPI.acquireLock(projectId, imageId);
                  if (result.status !== 'already_locked') {
                    setIsLocked(true);
                    startHeartbeat();
                  } else {
                    toast.error('Image is still locked');
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### B. Lock Indicators in ImageList

```typescript
import { useState, useEffect } from 'react';
import { LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline';
import { imageLockAPI, LockInfo } from '@/lib/api/image-locks';

function ImageList({ projectId, images, currentUser }: ImageListProps) {
  const [projectLocks, setProjectLocks] = useState<Record<string, LockInfo>>({});
  const [loading, setLoading] = useState(true);

  // Load all project locks on mount
  useEffect(() => {
    loadProjectLocks();

    // Refresh locks every 30 seconds
    const interval = setInterval(loadProjectLocks, 30 * 1000);

    return () => clearInterval(interval);
  }, [projectId]);

  // Load all locks for the project
  const loadProjectLocks = async () => {
    try {
      const locks = await imageLockAPI.getProjectLocks(projectId);

      // Convert array to map for easy lookup
      const lockMap: Record<string, LockInfo> = {};
      locks.forEach(lock => {
        lockMap[lock.image_id] = lock;
      });

      setProjectLocks(lockMap);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load project locks:', error);
      setLoading(false);
    }
  };

  // Render individual image item
  const renderImageItem = (image: ImageData) => {
    const lock = projectLocks[image.id];
    const isLocked = !!lock;
    const isMyLock = lock?.user_id === currentUser.id;

    return (
      <div
        key={image.id}
        className="image-item relative cursor-pointer hover:bg-gray-50"
        onClick={() => handleImageClick(image.id)}
      >
        {/* Thumbnail */}
        <img
          src={image.thumbnail_url || image.url}
          alt={image.file_name}
          className="w-full h-32 object-cover rounded"
        />

        {/* Lock indicator - top-right corner */}
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 px-2 py-1 rounded shadow">
          {isLocked ? (
            <>
              <LockClosedIcon
                className={`w-4 h-4 ${isMyLock ? 'text-green-600' : 'text-red-600'}`}
                title={isMyLock ? 'Locked by you' : `Locked by ${lock.user_name}`}
              />
              {!isMyLock && (
                <span className="text-xs text-red-600" title={`Locked by ${lock.user_name}`}>
                  {lock.user_name}
                </span>
              )}
            </>
          ) : (
            <LockOpenIcon
              className="w-4 h-4 text-gray-400"
              title="Available for editing"
            />
          )}
        </div>

        {/* Image name */}
        <div className="p-2">
          <p className="text-sm truncate">{image.file_name}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="image-list grid grid-cols-3 gap-4 p-4">
      {loading ? (
        <div className="col-span-3 text-center py-8 text-gray-500">
          Loading locks...
        </div>
      ) : (
        images.map(renderImageItem)
      )}
    </div>
  );
}
```

---

## 3. Testing the Integration

### Test 1: Optimistic Locking

**Setup**: Open same annotation in two browser tabs

1. **Tab A**: Edit annotation, don't save yet
2. **Tab B**: Edit same annotation, save → Success (version: 1 → 2)
3. **Tab A**: Try to save → **Conflict dialog appears**
4. **Tab A**: Click "Reload Latest" → Sees Tab B's changes
5. **Tab A**: Make new edit, save → Success (version: 2 → 3)

### Test 2: Image Locking

**Setup**: Open same image in two browser tabs

1. **Tab A**: Open Image 1 → Lock acquired ✅
2. **Tab B**: Try to open Image 1 → **"Image locked by [User A]" dialog**
3. **Tab B**: Choose another image → Works fine
4. **Tab A**: Close Image 1 → Lock released
5. **Tab B**: Retry Image 1 → Lock acquired ✅

### Test 3: Lock Expiration

**Setup**: Test automatic lock expiration

1. **Tab A**: Open Image 1 → Lock acquired
2. **Tab A**: Close browser tab (no proper cleanup)
3. Wait 5 minutes
4. **Tab B**: Open Image 1 → Lock acquired (expired lock auto-cleaned)

### Test 4: Heartbeat Mechanism

**Setup**: Test lock keep-alive

1. **Tab A**: Open Image 1 → Lock acquired
2. Wait 3 minutes (watch network tab for heartbeat requests every 2 min)
3. **Expected**: Heartbeat sent at 2 min mark
4. Lock expires_at extended to now + 5 min
5. Lock remains active

### Test 5: Lock Indicators

**Setup**: Test visual indicators

1. **Tab A**: Open Image 1 → 🔒 Green lock icon on Image 1 in list
2. **Tab B**: View image list → 🔒 Red lock icon with user name on Image 1
3. **Tab B**: Other images show 🔓 gray open lock
4. **Tab A**: Close Image 1 → All locks refresh, Image 1 shows 🔓

---

## 4. File Locations

### Files to Modify

1. **Canvas/Image Viewer Component**:
   - File: `frontend/app/projects/[projectId]/annotate/page.tsx` or similar
   - Add: Lock acquisition, heartbeat, cleanup
   - Lines: ~50-100 additional

2. **ImageList Component**:
   - File: `frontend/components/annotations/ImageList.tsx` or similar
   - Add: Lock indicators, project locks loading
   - Lines: ~30-50 additional

3. **Annotation Update Handler**:
   - File: Where annotations are updated (Canvas, editor, etc.)
   - Add: Version conflict handling, dialog integration
   - Lines: ~40-60 additional

### Files Already Created

✅ `frontend/lib/api/image-locks.ts` - API client (148 lines)
✅ `frontend/components/annotations/AnnotationConflictDialog.tsx` - Conflict UI (131 lines)

---

## 5. Performance Considerations

### Network Traffic

| Operation | Frequency | Size | Impact |
|-----------|-----------|------|--------|
| Acquire lock | Once per image open | ~200 bytes | Negligible |
| Heartbeat | Every 2 minutes | ~50 bytes | Negligible |
| Release lock | Once per image close | ~50 bytes | Negligible |
| Load project locks | Every 30 seconds | ~100-500 bytes | Low |

**Total**: < 1 KB per minute during active editing

### User Experience

- Lock acquisition: < 100ms (instant)
- Lock indicators: Auto-refresh every 30s
- Heartbeat: Background, non-blocking
- Version conflicts: Instant detection

---

## 6. Error Handling

### Common Errors

**Error**: `409 Conflict` when updating annotation
```typescript
// Already handled by conflict dialog
if (error.response?.status === 409) {
  showConflictDialog();
}
```

**Error**: Lock acquisition fails
```typescript
try {
  await imageLockAPI.acquireLock(projectId, imageId);
} catch (error) {
  toast.error('Failed to lock image. Please try again.');
  // Don't show canvas, return to image list
}
```

**Error**: Heartbeat fails (network issue)
```typescript
// Clear interval and notify user
clearInterval(heartbeatInterval);
toast.error('Lost connection. Please refresh.');
setIsLocked(false);
```

**Error**: Lock already held by another user
```typescript
if (result.status === 'already_locked') {
  showLockedDialog(result.locked_by?.user_name);
  // Show retry button or return to image list
}
```

---

## 7. Cleanup Checklist

When unmounting Canvas/Image Viewer:

- [ ] Clear heartbeat interval
- [ ] Release lock via API
- [ ] Clear local lock state
- [ ] Remove event listeners

```typescript
useEffect(() => {
  return () => {
    // Cleanup on unmount
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    if (isLocked) {
      imageLockAPI.releaseLock(projectId, imageId).catch(console.error);
    }
  };
}, []);
```

---

## 8. Next Steps

1. ✅ Create API client (`frontend/lib/api/image-locks.ts`)
2. 📝 Follow this guide to integrate into Canvas
3. 📝 Follow this guide to integrate into ImageList
4. 🧪 Test all scenarios
5. 🚀 Deploy and monitor

---

**Integration Time Estimate**: 2-3 hours
**Testing Time**: 1-2 hours

**Total**: 3-5 hours for complete frontend integration
