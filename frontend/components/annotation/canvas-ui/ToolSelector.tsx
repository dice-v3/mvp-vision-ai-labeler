/**
 * ToolSelector Component
 *
 * Tool selection buttons for different annotation tasks
 * Phase 18.8.3: Extracted from Canvas.tsx (lines 1129-1252)
 *
 * @module components/annotation/canvas-ui/ToolSelector
 */

'use client';

import React from 'react';

export interface ToolSelectorProps {
  /** Current selected tool */
  tool: string;
  /** Current task type (detection, segmentation, classification, geometry) */
  currentTask: string | null;
  /** Callback when tool is selected */
  onToolSelect: (tool: string) => void;
}

/**
 * Tool selector component
 *
 * Displays tool buttons based on current task type:
 * - All tasks: Select tool
 * - Detection: BBox tool
 * - Segmentation: Polygon tool
 * - Classification: Classify tool
 * - Geometry: Polyline, Circle(2P), Circle(3P) tools
 *
 * Phase 18.8.3: Extracted from Canvas component for better modularity
 */
export const ToolSelector = React.memo(function ToolSelector(props: ToolSelectorProps): JSX.Element {
  const { tool, currentTask, onToolSelect } = props;

  return (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center gap-2 shadow-lg z-10">
      <button
        onClick={() => onToolSelect('select')}
        className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
          tool === 'select'
            ? 'bg-violet-500 text-white'
            : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
        title="Select Tool (Q)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <span>Select</span>
      </button>

      {/* Phase 2.9: Show BBox tool for detection tasks */}
      {currentTask === 'detection' && (
        <button
          onClick={() => onToolSelect('bbox')}
          className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
            tool === 'bbox'
              ? 'bg-violet-500 text-white'
              : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title="Bounding Box (B)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
          </svg>
          <span>BBox</span>
        </button>
      )}

      {/* Polygon tool for segmentation tasks */}
      {currentTask === 'segmentation' && (
        <button
          onClick={() => onToolSelect('polygon')}
          className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
            tool === 'polygon'
              ? 'bg-violet-500 text-white'
              : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title="Polygon (P)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span>Polygon</span>
        </button>
      )}

      {/* Classification tool for classification tasks */}
      {currentTask === 'classification' && (
        <button
          onClick={() => onToolSelect('classification')}
          className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
            tool === 'classification'
              ? 'bg-violet-500 text-white'
              : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title="Classify (W)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span>Classify</span>
        </button>
      )}

      {/* Geometry tools for geometry tasks */}
      {currentTask === 'geometry' && (
        <>
          <button
            onClick={() => onToolSelect('polyline')}
            className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
              tool === 'polyline'
                ? 'bg-violet-500 text-white'
                : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title="Polyline (L)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l6-6 4 4 8-8" />
            </svg>
            <span>Polyline</span>
          </button>
          <button
            onClick={() => onToolSelect('circle')}
            className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
              tool === 'circle'
                ? 'bg-violet-500 text-white'
                : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title="Circle - Center Edge (E)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="2" r="1.5" fill="currentColor" />
            </svg>
            <span>Circle(2P)</span>
          </button>
          <button
            onClick={() => onToolSelect('circle3p')}
            className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
              tool === 'circle3p'
                ? 'bg-violet-500 text-white'
                : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title="Circle - 3 Points (R)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <circle cx="12" cy="2" r="1.5" fill="currentColor" />
              <circle cx="4" cy="16" r="1.5" fill="currentColor" />
              <circle cx="20" cy="16" r="1.5" fill="currentColor" />
            </svg>
            <span>Circle(3P)</span>
          </button>
        </>
      )}
    </div>
  );
});
