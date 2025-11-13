/**
 * Right Panel Component
 *
 * Contains: Current Annotation Details, Annotations List, Image Metadata
 */

'use client';

import { useAnnotationStore } from '@/lib/stores/annotationStore';

export default function RightPanel() {
  const { panels, annotations, selectedAnnotationId, selectAnnotation, deleteAnnotation, toggleRightPanel } = useAnnotationStore();

  if (!panels.right) {
    return (
      <button
        onClick={toggleRightPanel}
        className="w-8 h-full bg-gray-800 border-l border-gray-700 flex items-center justify-center hover:bg-gray-700 transition-colors"
        title="Show Right Panel (])"
      >
        <span className="text-gray-400 text-xs">◀</span>
      </button>
    );
  }

  return (
    <div className="w-[320px] bg-gray-800 border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Annotations ({annotations.length})</h3>
        <button
          onClick={toggleRightPanel}
          className="text-gray-400 hover:text-white text-xs"
          title="Hide Right Panel (])"
        >
          ▶
        </button>
      </div>

      {/* Annotations List */}
      <div className="flex-1 overflow-y-auto p-4">
        {annotations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No annotations yet</p>
            <p className="text-xs mt-2">Draw a bbox to start labeling</p>
          </div>
        )}

        {annotations.map((ann, index) => (
          <div
            key={ann.id}
            className={`p-3 rounded-lg mb-2 cursor-pointer transition-all ${
              ann.id === selectedAnnotationId
                ? 'bg-violet-500/20 border-2 border-violet-500'
                : 'bg-gray-700 border-2 border-transparent hover:border-gray-600'
            }`}
            onClick={() => selectAnnotation(ann.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: ann.classId ? '#9333ea' : '#6b7280' }}
                ></div>
                <span className="text-sm font-medium text-gray-300">
                  {ann.className || 'Unlabeled'}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this annotation?')) {
                    deleteAnnotation(ann.id);
                  }
                }}
                className="text-red-400 hover:text-red-300 text-xs"
              >
                🗑
              </button>
            </div>

            {ann.geometry.type === 'bbox' && (
              <div className="text-xs text-gray-400">
                W: {Math.round(ann.geometry.bbox[2])} x H: {Math.round(ann.geometry.bbox[3])}
              </div>
            )}

            {ann.confidence !== undefined && (
              <div className="text-xs text-gray-400 mt-1">
                Conf: {Math.round(ann.confidence * 100)}%
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Metadata */}
      <div className="p-4 border-t border-gray-700">
        <h4 className="text-xs font-semibold text-gray-400 mb-2">Image Info</h4>
        <div className="text-xs text-gray-500">Metadata coming soon...</div>
      </div>
    </div>
  );
}
