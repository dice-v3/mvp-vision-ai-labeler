# Phase 8.5: Concurrent Handling - Revised Design

**Date**: 2025-11-22
**Status**: In Progress
**Changes**: Image Lock (instead of Annotation Lock)

---

## Design Change: Image Lock vs Annotation Lock

### Original Plan
- **Annotation Lock**: Lock individual annotations
- Problem: Too granular, complex UI

### Revised Plan ✅
- **Image Lock**: Lock entire image when user starts working
- Benefits:
  - ✅ Intuitive ("I'm working on this image")
  - ✅ Easy to display in ImageList
  - ✅ Matches user workflow
  - ✅ Simpler implementation

### User Feedback
> "이미지 Lock 상태를 이미지 리스트에서 쉽게 알 수 있게 자물쇠 아이콘을 표시해주면 좋겠어."

---

## Phase 8.5.1: Optimistic Locking (6h)

**No changes** - Still at annotation level for conflict detection

### Database Migration

```python
# backend/alembic/versions/20251122_add_annotation_version.py

def upgrade():
    op.add_column('annotations', sa.Column('version', sa.Integer(), server_default='1'))
    op.execute("UPDATE annotations SET version = 1 WHERE version IS NULL")
    op.alter_column('annotations', 'version', nullable=False)

def downgrade():
    op.drop_column('annotations', 'version')
```

### Backend: Annotation Update with Version Check

```python
# backend/app/api/v1/endpoints/annotations.py

from pydantic import BaseModel

class AnnotationUpdate(BaseModel):
    version: int  # Required!
    geometry: Optional[dict] = None
    class_id: Optional[str] = None
    # ... other fields

@router.put("/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    annotation_id: int,
    update_data: AnnotationUpdate,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """Update annotation with optimistic locking."""
    annotation = labeler_db.query(Annotation).filter_by(id=annotation_id).first()
    if not annotation:
        raise HTTPException(404, "Annotation not found")

    # Basic permission: own annotation OR project owner
    project = labeler_db.query(AnnotationProject).filter_by(id=annotation.project_id).first()
    is_owner = annotation.created_by == current_user.id
    is_project_owner = project.owner_id == current_user.id

    if not (is_owner or is_project_owner):
        raise HTTPException(403, "Not authorized to edit this annotation")

    # ⭐ Optimistic locking check
    if update_data.version != annotation.version:
        raise HTTPException(
            409,
            detail={
                "error": "conflict",
                "message": f"Annotation has been modified by another user. "
                          f"Expected version {update_data.version}, current version {annotation.version}. "
                          f"Please refresh and try again.",
                "expected_version": update_data.version,
                "current_version": annotation.version,
            }
        )

    # Update fields (exclude version)
    update_dict = update_data.model_dump(exclude_unset=True, exclude={'version'})
    for key, value in update_dict.items():
        setattr(annotation, key, value)

    # Increment version
    annotation.version += 1
    annotation.updated_by = current_user.id
    annotation.updated_at = datetime.utcnow()

    labeler_db.commit()
    labeler_db.refresh(annotation)

    return AnnotationResponse.model_validate(annotation)
```

### Frontend: Version Handling

```typescript
// frontend/lib/stores/annotationStore.ts

interface Annotation {
  id: number;
  version: number;  // ⭐ Add version field
  geometry: any;
  // ... other fields
}

// Update annotation function
const updateAnnotation = async (annotationId: number, updates: Partial<Annotation>) => {
  const annotation = annotations.find(a => a.id === annotationId);
  if (!annotation) return;

  try {
    const response = await fetch(`/api/v1/annotations/${annotationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        ...updates,
        version: annotation.version,  // ⭐ Include current version
      }),
    });

    if (response.status === 409) {
      // Conflict detected
      const error = await response.json();

      // Show conflict dialog
      const shouldRefresh = await confirm(
        `This annotation was modified by another user.\n\n` +
        `Your version: ${error.expected_version}\n` +
        `Current version: ${error.current_version}\n\n` +
        `Click OK to refresh and see the latest version.`
      );

      if (shouldRefresh) {
        // Reload annotation from server
        await loadAnnotations(annotation.project_id, annotation.image_id);
      }
      return;
    }

    if (!response.ok) throw new Error(await response.text());

    const updated = await response.json();

    // Update local state with new version
    set((state) => ({
      annotations: state.annotations.map(a =>
        a.id === annotationId ? updated : a
      ),
    }));

    toast.success('Annotation updated');
  } catch (error) {
    toast.error('Failed to update annotation');
  }
};
```

---

## Phase 8.5.2: Image Locks (8h)

**Changed from Annotation Lock to Image Lock**

### Database Schema

```sql
CREATE TABLE image_locks (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    image_id VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL,

    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    heartbeat_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

    CONSTRAINT uq_project_image_lock UNIQUE (project_id, image_id)
);

CREATE INDEX ix_image_locks_project_image ON image_locks(project_id, image_id);
CREATE INDEX ix_image_locks_user ON image_locks(user_id);
CREATE INDEX ix_image_locks_expires ON image_locks(expires_at);
```

**Key Changes**:
- ✅ Lock by `(project_id, image_id)` instead of `annotation_id`
- ✅ One lock per image (UNIQUE constraint)
- ✅ Easy to query for ImageList display

### Model

```python
# backend/app/db/models/labeler.py

class ImageLock(LabelerBase):
    """
    Image lock for concurrent editing protection.

    When a user opens an image for annotation, acquire a lock.
    Lock expires after 5 minutes without heartbeat.
    """
    __tablename__ = "image_locks"

    id = Column(Integer, primary_key=True)
    project_id = Column(String(50), nullable=False, index=True)
    image_id = Column(String(255), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)

    locked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    heartbeat_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint('project_id', 'image_id', name='uq_project_image_lock'),
        Index('ix_image_locks_project_image', 'project_id', 'image_id'),
        Index('ix_image_locks_expires', 'expires_at'),
    )

    def __repr__(self):
        return f"<ImageLock(project={self.project_id}, image={self.image_id}, user={self.user_id})>"
```

### Lock Service

```python
# backend/app/services/image_lock_service.py

from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import Optional
from ..db.models.labeler import ImageLock

class ImageLockService:
    """Service for managing image locks."""

    LOCK_DURATION = timedelta(minutes=5)  # Lock expires after 5 minutes

    @staticmethod
    def cleanup_expired_locks(db: Session):
        """Remove expired locks."""
        db.query(ImageLock).filter(
            ImageLock.expires_at < datetime.utcnow()
        ).delete()
        db.commit()

    @staticmethod
    def acquire_lock(
        db: Session,
        project_id: str,
        image_id: str,
        user_id: int
    ) -> tuple[bool, Optional[dict]]:
        """
        Try to acquire lock on image.

        Returns:
            (success: bool, existing_lock_info: dict | None)
        """
        # Cleanup expired locks first
        ImageLockService.cleanup_expired_locks(db)

        # Check existing lock
        existing = db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
        ).first()

        if existing:
            if existing.user_id == user_id:
                # Refresh own lock
                existing.heartbeat_at = datetime.utcnow()
                existing.expires_at = datetime.utcnow() + ImageLockService.LOCK_DURATION
                db.commit()
                return True, None
            else:
                # Locked by another user
                return False, {
                    'user_id': existing.user_id,
                    'locked_at': existing.locked_at,
                    'expires_at': existing.expires_at,
                }

        # Create lock
        lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id=user_id,
            expires_at=datetime.utcnow() + ImageLockService.LOCK_DURATION,
        )
        db.add(lock)
        db.commit()
        return True, None

    @staticmethod
    def release_lock(
        db: Session,
        project_id: str,
        image_id: str,
        user_id: int
    ):
        """Release lock if owned by user."""
        db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
            ImageLock.user_id == user_id,
        ).delete()
        db.commit()

    @staticmethod
    def heartbeat(
        db: Session,
        project_id: str,
        image_id: str,
        user_id: int
    ) -> bool:
        """
        Send heartbeat to keep lock alive.

        Returns:
            True if successful, False if lock lost
        """
        lock = db.query(ImageLock).filter(
            ImageLock.project_id == project_id,
            ImageLock.image_id == image_id,
            ImageLock.user_id == user_id,
        ).first()

        if not lock:
            return False

        lock.heartbeat_at = datetime.utcnow()
        lock.expires_at = datetime.utcnow() + ImageLockService.LOCK_DURATION
        db.commit()
        return True

    @staticmethod
    def get_project_locks(
        db: Session,
        project_id: str
    ) -> dict[str, dict]:
        """
        Get all active locks for a project.

        Returns:
            {image_id: {user_id, locked_at, expires_at}}
        """
        ImageLockService.cleanup_expired_locks(db)

        locks = db.query(ImageLock).filter(
            ImageLock.project_id == project_id
        ).all()

        return {
            lock.image_id: {
                'user_id': lock.user_id,
                'locked_at': lock.locked_at,
                'expires_at': lock.expires_at,
            }
            for lock in locks
        }
```

### API Endpoints

```python
# backend/app/api/v1/endpoints/image_locks.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_labeler_db, get_platform_db
from app.core.security import get_current_user
from app.db.models.platform import User
from app.services.image_lock_service import ImageLockService
from pydantic import BaseModel

router = APIRouter()

class LockAcquireRequest(BaseModel):
    project_id: str
    image_id: str

class LockResponse(BaseModel):
    success: bool
    locked_by: Optional[int] = None
    locked_by_name: Optional[str] = None
    locked_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

@router.post("/locks/acquire", response_model=LockResponse)
async def acquire_image_lock(
    request: LockAcquireRequest,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Acquire lock on an image.

    Called when user opens an image for annotation.
    """
    success, existing = ImageLockService.acquire_lock(
        labeler_db,
        request.project_id,
        request.image_id,
        current_user.id,
    )

    if success:
        return LockResponse(success=True)

    # Get lock owner info
    user = platform_db.query(User).filter_by(id=existing['user_id']).first()

    return LockResponse(
        success=False,
        locked_by=existing['user_id'],
        locked_by_name=user.full_name if user else None,
        locked_at=existing['locked_at'],
        expires_at=existing['expires_at'],
    )


@router.post("/locks/release")
async def release_image_lock(
    request: LockAcquireRequest,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Release lock on an image.

    Called when user closes/leaves an image.
    """
    ImageLockService.release_lock(
        labeler_db,
        request.project_id,
        request.image_id,
        current_user.id,
    )
    return {"message": "Lock released"}


@router.post("/locks/heartbeat")
async def lock_heartbeat(
    request: LockAcquireRequest,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send heartbeat to keep lock alive.

    Called every 2 minutes while user is working on image.
    """
    success = ImageLockService.heartbeat(
        labeler_db,
        request.project_id,
        request.image_id,
        current_user.id,
    )

    if not success:
        raise HTTPException(410, "Lock has been lost")

    return {"message": "Heartbeat received"}


@router.get("/projects/{project_id}/locks")
async def get_project_locks(
    project_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get all active locks for a project.

    Used by ImageList to show lock indicators.
    """
    locks_dict = ImageLockService.get_project_locks(labeler_db, project_id)

    # Join user info
    user_ids = {lock['user_id'] for lock in locks_dict.values()}
    users = {u.id: u for u in platform_db.query(User).filter(User.id.in_(user_ids)).all()}

    # Format response
    result = {}
    for image_id, lock in locks_dict.items():
        user = users.get(lock['user_id'])
        result[image_id] = {
            'user_id': lock['user_id'],
            'user_name': user.full_name if user else None,
            'locked_at': lock['locked_at'],
            'expires_at': lock['expires_at'],
        }

    return result
```

### Frontend: ImageList with Lock Indicators

```typescript
// frontend/components/annotation/ImageList.tsx

import { LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/outline';
import { useEffect, useState } from 'react';

interface ImageLock {
  user_id: number;
  user_name: string;
  locked_at: string;
  expires_at: string;
}

export default function ImageList({ projectId, images, onSelectImage }) {
  const [locks, setLocks] = useState<Record<string, ImageLock>>({});

  // Load locks on mount and every 30 seconds
  useEffect(() => {
    loadLocks();
    const interval = setInterval(loadLocks, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [projectId]);

  const loadLocks = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/locks`, {
        headers: { 'Authorization': `Bearer ${getToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLocks(data);
      }
    } catch (error) {
      console.error('Failed to load locks:', error);
    }
  };

  return (
    <div className="space-y-2">
      {images.map(image => {
        const lock = locks[image.image_id];
        const isLocked = !!lock;
        const isMyLock = lock?.user_id === currentUserId;

        return (
          <div
            key={image.image_id}
            onClick={() => onSelectImage(image)}
            className={`
              p-3 rounded cursor-pointer
              ${isLocked && !isMyLock ? 'opacity-60' : 'hover:bg-gray-100'}
            `}
          >
            <div className="flex items-center gap-2">
              {/* Lock indicator */}
              {isLocked ? (
                <div className="flex items-center gap-1">
                  <LockClosedIcon className={`w-4 h-4 ${isMyLock ? 'text-green-600' : 'text-red-600'}`} />
                  {!isMyLock && (
                    <span className="text-xs text-red-600" title={`Locked by ${lock.user_name}`}>
                      {lock.user_name}
                    </span>
                  )}
                </div>
              ) : (
                <LockOpenIcon className="w-4 h-4 text-gray-400" />
              )}

              {/* Thumbnail */}
              <img
                src={image.thumbnail_url || image.url}
                alt={image.file_name}
                className="w-16 h-16 object-cover rounded"
              />

              {/* Image info */}
              <div className="flex-1">
                <div className="font-medium">{image.file_name}</div>
                <div className="text-sm text-gray-500">
                  {image.width} × {image.height}
                </div>
              </div>

              {/* Status */}
              <div className={`px-2 py-1 rounded text-xs ${
                image.status === 'completed' ? 'bg-green-100 text-green-800' :
                image.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {image.status}
              </div>
            </div>

            {/* Lock warning */}
            {isLocked && !isMyLock && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                🔒 {lock.user_name} is currently working on this image
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

### Frontend: Auto Lock/Unlock in Canvas

```typescript
// frontend/components/annotation/Canvas.tsx

useEffect(() => {
  if (!currentImage || !project) return;

  let heartbeatInterval: NodeJS.Timeout;

  // Acquire lock when image opens
  const acquireLock = async () => {
    try {
      const res = await fetch('/api/v1/locks/acquire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          project_id: project.id,
          image_id: currentImage.image_id,
        }),
      });

      const result = await res.json();

      if (!result.success) {
        // Someone else has lock
        const confirm = await showConfirm(
          `This image is being edited by ${result.locked_by_name}.\n\n` +
          `Opening in read-only mode. Your changes will not be saved.`
        );
        setReadOnlyMode(true);
        return;
      }

      // Lock acquired - start heartbeat
      heartbeatInterval = setInterval(async () => {
        try {
          await fetch('/api/v1/locks/heartbeat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              project_id: project.id,
              image_id: currentImage.image_id,
            }),
          });
        } catch (error) {
          console.error('Heartbeat failed:', error);
          toast.error('Lock lost - your changes may not be saved');
          clearInterval(heartbeatInterval);
        }
      }, 120000); // Every 2 minutes

    } catch (error) {
      console.error('Failed to acquire lock:', error);
      setReadOnlyMode(true);
    }
  };

  // Release lock on cleanup
  const releaseLock = async () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    try {
      await fetch('/api/v1/locks/release', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          project_id: project.id,
          image_id: currentImage.image_id,
        }),
      });
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  };

  acquireLock();

  return () => {
    releaseLock();
  };
}, [currentImage, project]);
```

---

## Timeline

### Week 1 (Now)
- ✅ Design revision (Image Lock)
- ⬜ Phase 8.5.1 implementation (6h)
  - Migration: Add version field
  - Update annotation API
  - Frontend version handling
  - Conflict dialog

### Week 2
- ⬜ Phase 8.5.2 implementation (8h)
  - Migration: Create image_locks table
  - ImageLockService
  - Lock APIs
  - ImageList lock indicators
  - Canvas auto lock/unlock
  - Heartbeat mechanism

### Week 3
- ⬜ Testing
  - Concurrent editing scenarios
  - Lock expiration
  - Heartbeat failure
  - Conflict resolution

---

## Summary

**Key Changes from Original Design**:
- ❌ ~~Annotation Lock~~ (too granular)
- ✅ **Image Lock** (intuitive, user-friendly)
- ✅ Lock indicators in ImageList (🔒 icon)
- ✅ Auto lock/unlock when opening/closing images
- ✅ Read-only mode when locked by others

**Benefits**:
- ✅ User can see at a glance which images are being worked on
- ✅ Prevents editing conflicts at image level
- ✅ Simple mental model: "This image is mine to work on"
- ✅ Better collaboration UX

**Next**: Start implementation!
