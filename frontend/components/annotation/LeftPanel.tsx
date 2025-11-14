/**
 * Left Panel Component
 *
 * Contains: Tools, Image List, Class List, Settings
 */

'use client';

import { useAnnotationStore } from '@/lib/stores/annotationStore';
import ImageList from './ImageList';

export default function LeftPanel() {
  const { panels, tool, setTool, project, toggleLeftPanel } = useAnnotationStore();

  if (!panels.left) {
    return (
      <button
        onClick={toggleLeftPanel}
        className="w-8 h-full bg-gray-800 border-r border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-colors"
        title="Show Left Panel ([)"
      >
        <span className="text-gray-400 text-xs">▶</span>
      </button>
    );
  }

  return (
    <div className="w-[280px] bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 ease-in-out">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Tools</h3>
        <button
          onClick={toggleLeftPanel}
          className="text-gray-400 hover:text-white text-xs"
          title="Hide Left Panel ([)"
        >
          ◀
        </button>
      </div>

      {/* Tools Section */}
      <div className="p-4 border-b border-gray-700">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setTool('select')}
            className={`p-3 rounded-lg border-2 transition-all ${
              tool === 'select'
                ? 'border-violet-500 bg-violet-500/20 text-violet-400'
                : 'border-gray-700 hover:border-gray-600 text-gray-400'
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
                ? 'border-violet-500 bg-violet-500/20 text-violet-400'
                : 'border-gray-700 hover:border-gray-600 text-gray-400'
            }`}
            title="Bounding Box (R)"
          >
            <div className="text-lg">▭</div>
            <div className="text-xs mt-1">BBox</div>
          </button>
        </div>
      </div>

      {/* Image List Section */}
      <div className="border-b border-gray-700 h-[300px]">
        <ImageList />
      </div>

      {/* Class List Section */}
      <div className="flex-1 overflow-y-auto p-4">
        <h4 className="text-xs font-semibold text-gray-400 mb-2">Classes</h4>
        {project && Object.entries(project.classes).map(([classId, classInfo], index) => (
          <div
            key={classId}
            className="flex items-center gap-2 p-2 rounded hover:bg-gray-700 cursor-pointer mb-1"
          >
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: classInfo.color }}
            ></div>
            <span className="text-sm text-gray-300 flex-1">{classInfo.name}</span>
            <span className="text-xs text-gray-500">{index + 1}</span>
          </div>
        ))}
        {(!project || Object.keys(project.classes).length === 0) && (
          <div className="text-xs text-gray-500">No classes defined</div>
        )}
      </div>

      {/* Settings Section */}
      <div className="p-4 border-t border-gray-700">
        <h4 className="text-xs font-semibold text-gray-400 mb-2">Settings</h4>
        <div className="text-xs text-gray-500">Settings coming soon...</div>
      </div>
    </div>
  );
}
