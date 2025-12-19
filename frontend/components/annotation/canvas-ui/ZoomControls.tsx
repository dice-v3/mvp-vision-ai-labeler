/**
 * ZoomControls Component
 *
 * Zoom and undo/redo controls for the canvas
 * Phase 18.8.3: Extracted from Canvas.tsx (lines 1267-1342)
 *
 * @module components/annotation/canvas-ui/ZoomControls
 */

'use client';

import React from 'react';
import { ArrowUturnLeftIcon, ArrowUturnRightIcon } from '@heroicons/react/24/outline';

export interface ZoomControlsProps {
  /** Current zoom level (1.0 = 100%) */
  zoom: number;
  /** Pan offset */
  pan: { x: number; y: number };
  /** Callback when zoom changes */
  onZoomChange: (zoom: number) => void;
  /** Callback when pan changes */
  onPanChange: (pan: { x: number; y: number }) => void;
  /** Undo function */
  onUndo: () => void;
  /** Redo function */
  onRedo: () => void;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
}

/**
 * Zoom controls component
 *
 * Displays:
 * - Undo/Redo buttons with keyboard shortcuts (Ctrl+Z, Ctrl+Y)
 * - Zoom in/out buttons (Ctrl++, Ctrl+-)
 * - Current zoom percentage
 * - Fit to screen button (Ctrl+0)
 *
 * Phase 18.8.3: Extracted from Canvas component
 */
export const ZoomControls = React.memo(function ZoomControls(props: ZoomControlsProps): JSX.Element {
  const {
    zoom,
    pan,
    onZoomChange,
    onPanChange,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
  } = props;

  return (
    <div className="absolute bottom-4 left-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center gap-2 shadow-lg">
      {/* Undo button */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`
          w-8 h-8 flex items-center justify-center rounded transition-colors
          ${canUndo
            ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
          }
        `}
        title="Undo (Ctrl+Z)"
      >
        <ArrowUturnLeftIcon className="w-4 h-4" />
      </button>

      {/* Redo button */}
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`
          w-8 h-8 flex items-center justify-center rounded transition-colors
          ${canRedo
            ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
            : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
          }
        `}
        title="Redo (Ctrl+Y)"
      >
        <ArrowUturnRightIcon className="w-4 h-4" />
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>

      {/* Zoom out button */}
      <button
        onClick={() => onZoomChange(zoom - 0.25)}
        className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-900 dark:text-white"
        title="Zoom Out (Ctrl+-)"
      >
        −
      </button>
      <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-center">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => onZoomChange(zoom + 0.25)}
        className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-900 dark:text-white"
        title="Zoom In (Ctrl++)"
      >
        +
      </button>
      <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
      <button
        onClick={() => {
          onZoomChange(1.0);
          onPanChange({ x: 0, y: 0 });
        }}
        className="px-3 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-xs text-gray-900 dark:text-white"
        title="Fit to Screen (Ctrl+0)"
      >
        Fit
      </button>
    </div>
  );
});
