"""
Phase 8.5.2: Image Lock Service

Manages image locks for concurrent editing protection.

Features:
- Acquire lock when user opens image
- Auto-expire locks after 5 minutes
- Heartbeat mechanism to keep lock alive
- Cleanup expired locks
- Check lock status
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models.labeler import ImageLock


class ImageLockService:
    """Service for managing image locks."""

    # Lock duration: 5 minutes
    LOCK_DURATION = timedelta(minutes=5)

    @staticmethod
    def cleanup_expired_locks(db: Session) -> int:
        """
        Remove all expired locks from database.

        Returns:
            Number of locks removed
        """
        now = datetime.utcnow()
        expired_locks = db.query(ImageLock).filter(
            ImageLock.expires_at < now
        ).all()

        count = len(expired_locks)
        for lock in expired_locks:
            db.delete(lock)

        db.commit()
        return count

    @staticmethod
    def acquire_lock(
        db: Session,
        project_id: str,
        image_id: str,
        user_id: str,
    ) -> Dict:
        """
        Acquire lock on an image for a user.

        Cases:
        1. No existing lock → Create new lock
        2. Lock exists, owned by same user → Refresh lock
        3. Lock exists, owned by different user:
           - If expired → Take over lock
           - If active → Reject with lock info

        Returns:
            {
                "status": "acquired" | "already_locked" | "refreshed",
                "lock": {
                    "image_id": str,
                    "user_id": int,
                    "locked_at": datetime,
                    "expires_at": datetime,
                },
                "locked_by": {  # Only if already_locked
                    "user_id": int,
                    "locked_at": datetime,
                    "expires_at": datetime,
                }
            }
        """
        # Cleanup expired locks first
        ImageLockService.cleanup_expired_locks(db)

        now = datetime.utcnow()
        expires_at = now + ImageLockService.LOCK_DURATION

        # Check for existing lock
        existing_lock = db.query(ImageLock).filter(
            and_(
                ImageLock.project_id == project_id,
                ImageLock.image_id == image_id,
            )
        ).first()

        if existing_lock:
            # Case 2: Lock owned by same user → Refresh
            if existing_lock.user_id == user_id:
                existing_lock.heartbeat_at = now
                existing_lock.expires_at = expires_at
                db.commit()

                return {
                    "status": "refreshed",
                    "lock": {
                        "image_id": existing_lock.image_id,
                        "user_id": existing_lock.user_id,
                        "locked_at": existing_lock.locked_at,
                        "expires_at": existing_lock.expires_at,
                        "heartbeat_at": existing_lock.heartbeat_at,
                    }
                }

            # Case 3: Lock owned by different user
            return {
                "status": "already_locked",
                "locked_by": {
                    "image_id": existing_lock.image_id,
                    "user_id": existing_lock.user_id,
                    "locked_at": existing_lock.locked_at,
                    "expires_at": existing_lock.expires_at,
                    "heartbeat_at": existing_lock.heartbeat_at,
                }
            }

        # Case 1: No existing lock → Create new
        new_lock = ImageLock(
            project_id=project_id,
            image_id=image_id,
            user_id=user_id,
            locked_at=now,
            expires_at=expires_at,
            heartbeat_at=now,
        )
        db.add(new_lock)
        db.commit()
        db.refresh(new_lock)

        return {
            "status": "acquired",
            "lock": {
                "image_id": new_lock.image_id,
                "user_id": new_lock.user_id,
                "locked_at": new_lock.locked_at,
                "expires_at": new_lock.expires_at,
                "heartbeat_at": new_lock.heartbeat_at,
            }
        }

    @staticmethod
    def release_lock(
        db: Session,
        project_id: str,
        image_id: str,
        user_id: str,
    ) -> Dict:
        """
        Release lock on an image.

        Only the user who owns the lock can release it.

        Returns:
            {
                "status": "released" | "not_locked" | "not_owner"
            }
        """
        lock = db.query(ImageLock).filter(
            and_(
                ImageLock.project_id == project_id,
                ImageLock.image_id == image_id,
            )
        ).first()

        if not lock:
            return {"status": "not_locked"}

        if lock.user_id != user_id:
            return {"status": "not_owner"}

        db.delete(lock)
        db.commit()

        return {"status": "released"}

    @staticmethod
    def heartbeat(
        db: Session,
        project_id: str,
        image_id: str,
        user_id: str,
    ) -> Dict:
        """
        Send heartbeat to keep lock alive.

        Updates heartbeat_at and extends expires_at.

        Returns:
            {
                "status": "updated" | "not_locked" | "not_owner",
                "lock": { ... }  # If updated
            }
        """
        lock = db.query(ImageLock).filter(
            and_(
                ImageLock.project_id == project_id,
                ImageLock.image_id == image_id,
            )
        ).first()

        if not lock:
            return {"status": "not_locked"}

        if lock.user_id != user_id:
            return {"status": "not_owner"}

        now = datetime.utcnow()
        lock.heartbeat_at = now
        lock.expires_at = now + ImageLockService.LOCK_DURATION
        db.commit()

        return {
            "status": "updated",
            "lock": {
                "image_id": lock.image_id,
                "user_id": lock.user_id,
                "locked_at": lock.locked_at,
                "expires_at": lock.expires_at,
                "heartbeat_at": lock.heartbeat_at,
            }
        }

    @staticmethod
    def get_project_locks(
        db: Session,
        project_id: str,
    ) -> List[Dict]:
        """
        Get all active locks for a project.

        Useful for showing lock indicators in ImageList.

        Returns:
            [
                {
                    "image_id": str,
                    "user_id": int,
                    "locked_at": datetime,
                    "expires_at": datetime,
                    "heartbeat_at": datetime,
                },
                ...
            ]
        """
        # Cleanup expired locks first
        ImageLockService.cleanup_expired_locks(db)

        locks = db.query(ImageLock).filter(
            ImageLock.project_id == project_id
        ).all()

        return [
            {
                "image_id": lock.image_id,
                "user_id": lock.user_id,
                "locked_at": lock.locked_at,
                "expires_at": lock.expires_at,
                "heartbeat_at": lock.heartbeat_at,
            }
            for lock in locks
        ]

    @staticmethod
    def get_lock_status(
        db: Session,
        project_id: str,
        image_id: str,
    ) -> Optional[Dict]:
        """
        Get lock status for a specific image.

        Returns:
            None if not locked, or:
            {
                "user_id": int,
                "locked_at": datetime,
                "expires_at": datetime,
                "heartbeat_at": datetime,
            }
        """
        # Cleanup expired locks first
        ImageLockService.cleanup_expired_locks(db)

        lock = db.query(ImageLock).filter(
            and_(
                ImageLock.project_id == project_id,
                ImageLock.image_id == image_id,
            )
        ).first()

        if not lock:
            return None

        return {
            "image_id": lock.image_id,
            "user_id": lock.user_id,
            "locked_at": lock.locked_at,
            "expires_at": lock.expires_at,
            "heartbeat_at": lock.heartbeat_at,
        }

    @staticmethod
    def force_release_lock(
        db: Session,
        project_id: str,
        image_id: str,
    ) -> Dict:
        """
        Force release a lock (admin/owner action).

        Returns:
            {
                "status": "released" | "not_locked"
            }
        """
        lock = db.query(ImageLock).filter(
            and_(
                ImageLock.project_id == project_id,
                ImageLock.image_id == image_id,
            )
        ).first()

        if not lock:
            return {"status": "not_locked"}

        db.delete(lock)
        db.commit()

        return {"status": "released"}
