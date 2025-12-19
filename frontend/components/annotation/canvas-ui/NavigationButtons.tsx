/**
 * NavigationButtons Component
 *
 * Image navigation controls
 * Phase 18.8.3: Extracted from Canvas.tsx (lines 1344-1369)
 *
 * @module components/annotation/canvas-ui/NavigationButtons
 */

'use client';

import React from 'react';

export interface NavigationButtonsProps {
  /** Current image index (0-based) */
  currentIndex: number;
  /** Total number of images */
  totalImages: number;
  /** Callback for previous image */
  onPrevious: () => void;
  /** Callback for next image */
  onNext: () => void;
}

/**
 * Navigation buttons component
 *
 * Displays:
 * - Previous image button (← arrow key)
 * - Current position indicator (e.g., "3 / 10")
 * - Next image button (→ arrow key)
 *
 * Buttons are automatically disabled at boundaries (first/last image)
 *
 * Phase 18.8.3: Extracted from Canvas component
 */
export const NavigationButtons = React.memo(function NavigationButtons(props: NavigationButtonsProps): JSX.Element {
  const { currentIndex, totalImages, onPrevious, onNext } = props;

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-3 shadow-lg">
      <button
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="text-gray-900 dark:text-white disabled:text-gray-400 dark:disabled:text-gray-600 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:cursor-not-allowed"
        title="Previous Image (←)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span className="text-sm text-gray-900 dark:text-white font-medium min-w-[60px] text-center">
        {currentIndex + 1} / {totalImages}
      </span>
      <button
        onClick={onNext}
        disabled={currentIndex >= totalImages - 1}
        className="text-gray-900 dark:text-white disabled:text-gray-400 dark:disabled:text-gray-600 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:cursor-not-allowed"
        title="Next Image (→)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
});
