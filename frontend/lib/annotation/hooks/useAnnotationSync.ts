/**
 * useAnnotationSync Hook
 *
 * Manages annotation version conflict detection and resolution.
 * Handles optimistic updates with version checking and conflict dialogs.
 *
 * Phase 18.3: Canvas Architecture Refactoring
 * Phase 8.5.1: Version Conflict Detection (extracted from Canvas.tsx lines 136-142, 197-233)
 *
 * @module hooks/useAnnotationSync
 */

import { useState, useCallback } from 'react';
import type { ConflictInfo } from '@/components/annotations/AnnotationConflictDialog';
import { updateAnnotation } from '@/lib/api/annotations';
import type { AnnotationUpdateRequest } from '@/lib/api/annotations';
import type { Annotation } from '@/lib/types/annotation';

/**
 * Pending annotation update
 */
export interface PendingUpdate {
  annotationId: string;
  data: AnnotationUpdateRequest;
}

/**
 * Hook return type
 */
export interface UseAnnotationSyncReturn {
  // Conflict state
  conflictDialogOpen: boolean;
  setConflictDialogOpen: (open: boolean) => void;
  conflictInfo: ConflictInfo | null;
  setConflictInfo: (info: ConflictInfo | null) => void;
  pendingAnnotationUpdate: PendingUpdate | null;
  setPendingAnnotationUpdate: (update: PendingUpdate | null) => void;

  // Conflict handling
  updateAnnotationWithVersionCheck: (
    annotationId: string,
    updateData: AnnotationUpdateRequest,
    annotations: Annotation[]
  ) => Promise<void>;
  clearConflict: () => void;
}

/**
 * Annotation sync and conflict resolution hook
 *
 * Handles:
 * - Version conflict detection (409 Conflict responses)
 * - Conflict dialog state management
 * - Pending update tracking for retry after conflict resolution
 * - Optimistic update error handling
 *
 * @returns Conflict state and handlers
 *
 * @example
 * ```tsx
 * const {
 *   conflictDialogOpen,
 *   conflictInfo,
 *   updateAnnotationWithVersionCheck,
 *   clearConflict
 * } = useAnnotationSync();
 *
 * // Update with version check
 * try {
 *   await updateAnnotationWithVersionCheck(
 *     annotationId,
 *     { geometry: newGeometry },
 *     annotations
 *   );
 * } catch (error) {
 *   // Conflict dialog will be shown automatically
 * }
 *
 * // Handle conflict resolution
 * if (conflictDialogOpen) {
 *   // Show dialog with conflictInfo
 * }
 * ```
 */
export function useAnnotationSync(): UseAnnotationSyncReturn {
  // Conflict state
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [pendingAnnotationUpdate, setPendingAnnotationUpdate] = useState<PendingUpdate | null>(null);

  /**
   * Update annotation with version conflict checking
   *
   * Includes current version in update request and handles 409 Conflict responses
   * by showing conflict dialog and storing pending update for retry.
   *
   * @param annotationId - Annotation ID to update
   * @param updateData - Update data (geometry, class_id, etc.)
   * @param annotations - Current annotations array to get version
   * @throws Error if update fails (including version conflicts)
   */
  const updateAnnotationWithVersionCheck = useCallback(
    async (
      annotationId: string,
      updateData: AnnotationUpdateRequest,
      annotations: Annotation[]
    ) => {
      try {
        // Find annotation in store to get current version
        const annotation = annotations.find(ann => ann.id === annotationId);

        // Include version in update request
        const dataWithVersion = {
          ...updateData,
          version: annotation?.version,
        };

        await updateAnnotation(annotationId, dataWithVersion);

      } catch (error: any) {
        // Handle version conflict (409 Conflict)
        if (error.response?.status === 409) {
          const detail = error.response.data.detail;

          setConflictInfo({
            annotationId,
            currentVersion: detail.current_version,
            yourVersion: detail.your_version,
            lastUpdatedBy: detail.last_updated_by,
            lastUpdatedAt: detail.last_updated_at,
            message: detail.message,
          });

          setPendingAnnotationUpdate({ annotationId, data: updateData });
          setConflictDialogOpen(true);

          throw error; // Re-throw so caller knows it failed
        } else {
          // Other error
          throw error;
        }
      }
    },
    []
  );

  /**
   * Clear conflict state
   *
   * Resets conflict dialog and pending update.
   */
  const clearConflict = useCallback(() => {
    setConflictDialogOpen(false);
    setConflictInfo(null);
    setPendingAnnotationUpdate(null);
  }, []);

  return {
    // Conflict state
    conflictDialogOpen,
    setConflictDialogOpen,
    conflictInfo,
    setConflictInfo,
    pendingAnnotationUpdate,
    setPendingAnnotationUpdate,

    // Conflict handling
    updateAnnotationWithVersionCheck,
    clearConflict,
  };
}
