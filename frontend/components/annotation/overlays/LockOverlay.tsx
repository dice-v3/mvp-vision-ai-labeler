/**
 * LockOverlay Component
 *
 * Displays lock status and overlay when image is locked by another user.
 * Shows different states based on whether current user has the lock.
 *
 * Phase 18.4: Canvas Architecture Refactoring
 * Phase 8.5.2: Image Locks (extracted from Canvas.tsx lines 3717-3762)
 *
 * @module components/annotation/overlays/LockOverlay
 */

'use client';

import React from 'react';

/**
 * Lock overlay props
 */
export interface LockOverlayProps {
  /** Whether current user has acquired the lock */
  isImageLocked: boolean;
  /** Name of user who has the lock (if not current user) */
  lockedByUser: string | null;
  /** Whether there's a current image to lock */
  hasCurrentImage: boolean;
}

/**
 * Lock status and overlay component
 *
 * Displays two distinct UI states:
 * 1. **Lock Acquired** (isImageLocked = true):
 *    - Small green badge at top-left: "You have exclusive editing access"
 *
 * 2. **Lock Not Acquired** (isImageLocked = false):
 *    - Full-screen overlay with blur backdrop
 *    - Lock icon and "Image Locked" title
 *    - Shows either:
 *      - "Currently locked by {user}" (if lockedByUser provided)
 *      - "Click the image to acquire lock" (if no lockedByUser)
 *
 * @param props - Lock overlay props
 * @returns Lock overlay UI
 *
 * @example
 * ```tsx
 * <LockOverlay
 *   isImageLocked={true}
 *   lockedByUser={null}
 *   hasCurrentImage={true}
 * />
 * ```
 */
export function LockOverlay(props: LockOverlayProps): JSX.Element | null {
  const { isImageLocked, lockedByUser, hasCurrentImage } = props;

  if (!hasCurrentImage) {
    return null;
  }

  return (
    <>
      {/* Lock Status Indicator (when user has the lock) */}
      {isImageLocked && (
        <div className="absolute top-20 left-4 z-10 bg-green-100 text-green-800 px-3 py-1.5 rounded-lg shadow text-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>You have exclusive editing access</span>
        </div>
      )}

      {/* Locked Overlay (when lock is not acquired) */}
      {!isImageLocked && (
        <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white/20 backdrop-blur-md rounded-2xl shadow-2xl p-8 max-w-md mx-4 flex flex-col items-center text-center pointer-events-auto">
            {/* Lock Icon */}
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg
                className="w-10 h-10 text-gray-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 mb-4">Image Locked</h3>

            {/* Lock Status Message */}
            {lockedByUser ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
                Currently locked by <span className="font-semibold">{lockedByUser}</span>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-800">
                Click the image to acquire lock
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
