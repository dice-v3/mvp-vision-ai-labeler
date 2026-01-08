/**
 * CanvasActionBar Component
 *
 * Action buttons for canvas operations (No Object, Delete All)
 * Phase 18.8.3: Extracted from Canvas.tsx (lines 1430-1458)
 *
 * @module components/annotation/canvas-ui/CanvasActionBar
 */

'use client';

import React from 'react';

export interface CanvasActionBarProps {
  /** Number of annotations on current image */
  annotationCount: number;
  /** Number of selected images in batch mode */
  selectedImageCount: number;
  /** Callback for "No Object" button */
  onNoObject: () => void;
  /** Callback for "Delete All" button */
  onDeleteAll: () => void;
  /** Callback for "Image-level Text Label" button (Phase 19) */
  onImageLevelTextLabel?: () => void;
  /** Number of image-level text labels (Phase 19) */
  imageLevelLabelCount?: number;
}

/**
 * Canvas action bar component
 *
 * Displays action buttons in the top-right corner:
 * 1. **Image-level Text Label** (violet button, Phase 19):
 *    - Opens image-level text label dialog (caption, description, VQA)
 *    - Badge shows count when labels exist
 *
 * 2. **No Object** (gray button, keyboard: 0):
 *    - Marks image(s) as having no objects to annotate
 *
 * 3. **Delete All Annotations** (red button, keyboard: Del):
 *    - Deletes all annotations from image(s)
 *    - Disabled when no annotations exist and no images selected
 *    - Button color indicates state (gray when disabled, red when enabled)
 *
 * Phase 18.8.3: Extracted from Canvas component
 * Phase 19: Added image-level text label button
 */
export const CanvasActionBar = React.memo(function CanvasActionBar(props: CanvasActionBarProps): JSX.Element {
  const { annotationCount, selectedImageCount, onNoObject, onDeleteAll, onImageLevelTextLabel, imageLevelLabelCount = 0 } = props;

  const hasAnnotationsOrSelection = annotationCount > 0 || selectedImageCount > 0;
  const hasImageLevelLabels = imageLevelLabelCount > 0;

  return (
    <div className="absolute top-4 right-4 flex flex-row gap-2">
      {/* Phase 19: Image-level text label button */}
      {onImageLevelTextLabel && (
        <button
          onClick={onImageLevelTextLabel}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 relative ${
            hasImageLevelLabels
              ? 'bg-violet-600 hover:bg-violet-700'
              : 'bg-violet-500 hover:bg-violet-600'
          }`}
          title="Image-level Text Label (Caption, Description, VQA)"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <text x="6" y="18" fontSize="16" fontWeight="bold" fontFamily="Georgia, Times New Roman, serif" fill="white" stroke="none">T</text>
          </svg>
          {/* Badge showing label count */}
          {hasImageLevelLabels && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center">
              <span className="text-violet-600 text-xs font-bold">{imageLevelLabelCount}</span>
            </div>
          )}
        </button>
      )}

      {/* No Object button */}
      <button
        onClick={onNoObject}
        className="w-10 h-10 bg-gray-600 hover:bg-gray-700 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105"
        title="No Object (0)"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} strokeDasharray="4 2" />
        </svg>
      </button>

      {/* Delete all annotations button */}
      <button
        onClick={onDeleteAll}
        disabled={!hasAnnotationsOrSelection}
        className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 ${
          hasAnnotationsOrSelection
            ? 'bg-red-400 hover:bg-red-500'
            : 'bg-gray-400 cursor-not-allowed'
        }`}
        title="Delete All Annotations (Del)"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
});
