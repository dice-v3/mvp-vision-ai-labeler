/**
 * useImageManagement Hook
 *
 * Manages image loading, caching, and locking for the Canvas component.
 * Handles image lock acquisition, heartbeat, and release.
 *
 * Phase 18.3: Canvas Architecture Refactoring
 * Phase 8.5.2: Image Locks (extracted from Canvas.tsx lines 250-374)
 *
 * @module hooks/useImageManagement
 */

import { useState, useEffect, RefObject } from 'react';
import { imageLockAPI } from '@/lib/api/image-locks';
import type { LockAcquireResponse } from '@/lib/api/image-locks';
import { toast } from '@/lib/stores/toastStore';
import { useAnnotationStore } from '@/lib/stores/annotationStore';

/**
 * Image object from annotation store
 */
export interface ImageData {
  id: number;
  url: string;
  [key: string]: any;
}

/**
 * Project object from annotation store
 */
export interface ProjectData {
  id: number;
  [key: string]: any;
}

/**
 * Hook parameters
 */
export interface UseImageManagementParams {
  currentImage: ImageData | null;
  project: ProjectData | null;
  imageRef: RefObject<HTMLImageElement>;
}

/**
 * Hook return type
 */
export interface UseImageManagementReturn {
  // Image state
  image: HTMLImageElement | null;
  imageLoaded: boolean;

  // Lock state
  isImageLocked: boolean;
  lockedByUser: string | null;
  showLockedDialog: boolean;
  setShowLockedDialog: (show: boolean) => void;

  // Lock actions
  acquireLock: () => Promise<void>;
  releaseLock: () => Promise<void>;
}

/**
 * Image loading and lock management hook
 *
 * Handles:
 * - Image loading with crossOrigin support
 * - Image lock acquisition (5-minute timeout)
 * - Heartbeat to keep lock alive (every 2 minutes)
 * - Lock release on unmount or image change
 * - Real-time lock status updates
 *
 * @param params - Hook parameters
 * @returns Image state, lock state, and actions
 *
 * @example
 * ```tsx
 * const {
 *   image,
 *   imageLoaded,
 *   isImageLocked,
 *   lockedByUser
 * } = useImageManagement({
 *   currentImage,
 *   project,
 *   imageRef
 * });
 *
 * // Check if can edit
 * if (!isImageLocked) {
 *   console.log(`Image locked by ${lockedByUser}`);
 * }
 * ```
 */
export function useImageManagement(params: UseImageManagementParams): UseImageManagementReturn {
  const { currentImage, project, imageRef } = params;

  // Image state
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Lock state
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);
  const [isImageLocked, setIsImageLocked] = useState(false);
  const [lockedByUser, setLockedByUser] = useState<string | null>(null);
  const [showLockedDialog, setShowLockedDialog] = useState(false);

  /**
   * Start heartbeat to keep lock alive (every 2 minutes)
   */
  const startHeartbeat = (projectId: number, imageId: number) => {
    // Clear existing interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }

    // Send heartbeat every 2 minutes (lock expires after 5 minutes)
    const interval = setInterval(async () => {
      try {
        await imageLockAPI.sendHeartbeat(projectId, imageId);
      } catch (error) {
        console.error('[Lock] Heartbeat failed:', error);
        toast.error('Lost lock on image');
        clearInterval(interval);
        setIsImageLocked(false);
      }
    }, 2 * 60 * 1000); // Every 2 minutes

    setHeartbeatInterval(interval);
  };

  /**
   * Acquire lock on current image
   */
  const acquireLock = async () => {
    // Feature flag: Skip if lock is disabled
    if (process.env.NEXT_PUBLIC_ENABLE_IMAGE_LOCK === 'false') {
      console.log('[Lock] Image lock disabled via feature flag');
      setIsImageLocked(true); // Pretend lock is acquired
      return;
    }

    if (!currentImage || !project) return;

    try {
      const result: LockAcquireResponse = await imageLockAPI.acquireLock(
        project.id,
        currentImage.id
      );

      if (result.status === 'already_locked' && result.locked_by) {
        // Image is locked by another user
        // Phase 8.5.2: Show lock overlay instead of dialog
        setLockedByUser(result.locked_by.user_name || 'another user');
        setIsImageLocked(false);
        return;
      }

      // Lock acquired or refreshed
      setIsImageLocked(true);
      setLockedByUser(null);

      // Phase 8.5.2: Update project locks immediately for real-time sync
      if (result.lock) {
        useAnnotationStore.setState((state) => {
          const existingLocks = state.projectLocks || [];
          const updatedLocks = existingLocks.filter(lock => lock.image_id !== currentImage.id);
          return { projectLocks: [...updatedLocks, result.lock!] };
        });
      }

      // Start heartbeat
      startHeartbeat(project.id, currentImage.id);

    } catch (error) {
      console.error('Failed to acquire lock:', error);
      toast.error('Failed to lock image');
      setIsImageLocked(false);
    }
  };

  /**
   * Release lock on current image
   */
  const releaseLock = async () => {
    // Feature flag: Skip if lock is disabled
    if (process.env.NEXT_PUBLIC_ENABLE_IMAGE_LOCK === 'false') {
      console.log('[Lock] Image lock disabled via feature flag');
      return;
    }

    if (!currentImage || !project) return;

    try {
      await imageLockAPI.releaseLock(project.id, currentImage.id);

      // Phase 8.5.2: Update project locks immediately for real-time sync
      useAnnotationStore.setState((state) => {
        const existingLocks = state.projectLocks || [];
        const updatedLocks = existingLocks.filter(lock => lock.image_id !== currentImage.id);
        return { projectLocks: updatedLocks };
      });

      setIsImageLocked(false);
      setLockedByUser(null);

    } catch (error) {
      console.error('[Lock] Failed to release:', error);
    }
  };

  // Phase 8.5.2: Acquire image lock and load image when currentImage changes
  useEffect(() => {
    if (!currentImage?.url || !project?.id) {
      setImage(null);
      imageRef.current = null;
      setImageLoaded(false);
      setIsImageLocked(false);
      return;
    }

    // Phase 8.5.2: Capture current image/project IDs for cleanup
    const capturedImageId = currentImage.id;
    const capturedProjectId = project.id;
    let lockAcquired = false;

    // Phase 8.5.2: Acquire lock on image
    const acquireImageLock = async () => {
      // Feature flag: Skip if lock is disabled
      if (process.env.NEXT_PUBLIC_ENABLE_IMAGE_LOCK === 'false') {
        console.log('[Lock] Image lock disabled via feature flag (useEffect)');
        setIsImageLocked(true); // Pretend lock is acquired
        lockAcquired = false; // Don't try to release in cleanup
        return;
      }

      try {
        const result: LockAcquireResponse = await imageLockAPI.acquireLock(
          project.id,
          currentImage.id
        );

        if (result.status === 'already_locked' && result.locked_by) {
          // Image is locked by another user
          setLockedByUser(result.locked_by.user_name || 'another user');
          setIsImageLocked(false);
          lockAcquired = false;
          return;
        }

        // Lock acquired or refreshed
        setIsImageLocked(true);
        setLockedByUser(null);
        lockAcquired = true;  // Mark lock as acquired for cleanup

        // Phase 8.5.2: Update project locks immediately for real-time sync
        if (result.lock) {
          useAnnotationStore.setState((state) => {
            const existingLocks = state.projectLocks || [];
            const updatedLocks = existingLocks.filter(lock => lock.image_id !== currentImage.id);
            return { projectLocks: [...updatedLocks, result.lock!] };
          });
        }

        // Start heartbeat
        startHeartbeat(project.id, currentImage.id);

      } catch (error) {
        console.error('Failed to acquire lock:', error);
        toast.error('Failed to lock image');
        setIsImageLocked(false);
        lockAcquired = false;
      }
    };

    // Acquire lock first
    acquireImageLock();

    // Load image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load image:', currentImage.url);
      setImageLoaded(false);
    };
    img.src = currentImage.url;

    // Cleanup: Release lock when unmounting or changing image
    return () => {
      // Clear heartbeat
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        setHeartbeatInterval(null);
      }

      // Phase 8.5.2: Release lock using captured IDs
      if (lockAcquired) {
        imageLockAPI.releaseLock(capturedProjectId, capturedImageId)
          .then(() => {
            // Phase 8.5.2: Update project locks immediately for real-time sync
            useAnnotationStore.setState((state) => {
              const existingLocks = state.projectLocks || [];
              const updatedLocks = existingLocks.filter(lock => lock.image_id !== capturedImageId);
              return { projectLocks: updatedLocks };
            });
          })
          .catch((error) => {
            console.error('[Lock] Failed to release:', error);
          });
      }
    };
  }, [currentImage, project]);

  return {
    // Image state
    image,
    imageLoaded,

    // Lock state
    isImageLocked,
    lockedByUser,
    showLockedDialog,
    setShowLockedDialog,

    // Lock actions
    acquireLock,
    releaseLock,
  };
}
