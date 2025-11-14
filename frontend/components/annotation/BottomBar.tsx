/**
 * Bottom Bar Component
 *
 * Navigation controls, bulk actions, AI assist
 */

'use client';

import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { deleteAnnotation as deleteAnnotationAPI } from '@/lib/api/annotations';
import { useState } from 'react';

export default function BottomBar() {
  const {
    images,
    currentIndex,
    annotations,
    goToNextImage,
    goToPrevImage,
    clearAnnotations,
  } = useAnnotationStore();

  const [isDeleting, setIsDeleting] = useState(false);

  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < images.length - 1;

  const handleClearAll = async () => {
    if (annotations.length === 0) return;
    if (!confirm(`Delete all ${annotations.length} annotations on this image?`)) return;

    setIsDeleting(true);
    try {
      // Delete all from backend
      await Promise.all(
        annotations.map((ann) => deleteAnnotationAPI(ann.id))
      );
      // Clear from store
      clearAnnotations();
    } catch (err) {
      console.error('Failed to delete annotations:', err);
      // TODO: Show error toast
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="h-[80px] bg-gray-100 dark:bg-gray-800 border-t border-gray-300 dark:border-gray-700 flex items-center px-6">
      {/* Navigation */}
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={goToPrevImage}
          disabled={!canGoPrev}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            canGoPrev
              ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
          title="Previous Image (A)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          Image <span className="text-gray-900 dark:text-white font-medium">{currentIndex + 1}</span> of {images.length}
        </div>

        <button
          onClick={goToNextImage}
          disabled={!canGoNext}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            canGoNext
              ? 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
          title="Next Image (D)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Progress Percentage */}
        <div className="ml-4 text-xs text-gray-600 dark:text-gray-500">
          {images.length > 0 ? Math.round(((currentIndex + 1) / images.length) * 100) : 0}% complete
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleClearAll}
          disabled={annotations.length === 0 || isDeleting}
          className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
            annotations.length > 0 && !isDeleting
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
          }`}
          title="Delete All Annotations"
        >
          {isDeleting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Deleting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete All
            </>
          )}
        </button>

        <button
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors text-white flex items-center gap-2"
          title="Copy from Previous Image (Ctrl+V)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </button>
      </div>
    </div>
  );
}
