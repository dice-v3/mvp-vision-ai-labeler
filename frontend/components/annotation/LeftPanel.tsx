/**
 * Left Panel Component
 *
 * Contains: Tools, Image List, Class List, Settings
 */

'use client';

import { useAnnotationStore } from '@/lib/stores/annotationStore';
import ImageList from './ImageList';
import AnnotationHistory from './AnnotationHistory';

export default function LeftPanel() {
  const { panels, tool, setTool, project, toggleLeftPanel } = useAnnotationStore();

  if (!panels.left) {
    return (
      <button
        onClick={toggleLeftPanel}
        className="w-8 h-full bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group"
        title="Show Left Panel ([)"
      >
        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="w-[280px] bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out">
      {/* Header */}
      <div className="p-4 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tools</h3>
        <button
          onClick={toggleLeftPanel}
          className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          title="Hide Left Panel ([)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Tools Section */}
      <div className="p-4 border-b border-gray-300 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTool('select')}
            className={`p-3 rounded-lg border-2 transition-all ${
              tool === 'select'
                ? 'border-violet-500 bg-violet-500/20 text-violet-600 dark:text-violet-400'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
            }`}
            title="Select Tool (V)"
          >
            <div className="text-lg">↖</div>
            <div className="text-xs mt-1">Select</div>
          </button>
          <button
            onClick={() => setTool('bbox')}
            className={`p-3 rounded-lg border-2 transition-all ${
              tool === 'bbox'
                ? 'border-violet-500 bg-violet-500/20 text-violet-600 dark:text-violet-400'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
            }`}
            title="Bounding Box (R)"
          >
            <div className="text-lg">▭</div>
            <div className="text-xs mt-1">BBox</div>
          </button>
        </div>
      </div>

      {/* Annotation History Section */}
      <AnnotationHistory />

      {/* Image List Section */}
      <div className="flex-1 overflow-y-auto">
        <ImageList />
      </div>
    </div>
  );
}
