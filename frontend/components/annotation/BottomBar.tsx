/**
 * Bottom Bar Component
 *
 * Navigation controls, bulk actions, AI assist
 */

'use client';

import { useAnnotationStore } from '@/lib/stores/annotationStore';

export default function BottomBar() {
  const {
    images,
    currentIndex,
    annotations,
    goToNextImage,
    goToPrevImage,
    clearAnnotations,
  } = useAnnotationStore();

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < images.length - 1;

  const handleClearAll = () => {
    if (annotations.length === 0) return;
    if (confirm(`Delete all ${annotations.length} annotations on this image?`)) {
      clearAnnotations();
    }
  };

  return (
    <div className="h-[80px] bg-gray-800 border-t border-gray-700 flex items-center px-6">
      {/* Navigation */}
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={goToPrevImage}
          disabled={!canGoPrev}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            canGoPrev
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title="Previous Image (A)"
        >
          ◀ Prev
        </button>

        <div className="text-sm text-gray-400">
          Image <span className="text-white font-medium">{currentIndex + 1}</span> of {images.length}
        </div>

        <button
          onClick={goToNextImage}
          disabled={!canGoNext}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            canGoNext
              ? 'bg-gray-700 hover:bg-gray-600 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title="Next Image (D)"
        >
          Next ▶
        </button>

        {/* Progress Percentage */}
        <div className="ml-4 text-xs text-gray-500">
          {images.length > 0 ? Math.round(((currentIndex + 1) / images.length) * 100) : 0}% complete
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleClearAll}
          disabled={annotations.length === 0}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            annotations.length > 0
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
          title="Delete All Annotations"
        >
          🗑 Delete All
        </button>

        <button
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors text-white"
          title="Copy from Previous Image (Ctrl+V)"
        >
          📋 Copy
        </button>

        <button
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm transition-colors text-white"
          title="AI Assist (Ctrl+Shift+A)"
        >
          🤖 AI Assist
        </button>
      </div>
    </div>
  );
}
