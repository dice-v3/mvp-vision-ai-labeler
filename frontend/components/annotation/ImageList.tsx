/**
 * Image List Component
 *
 * Displays thumbnail grid of all images in the project
 */

'use client';

import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { useState } from 'react';

type FilterType = 'all' | 'not-started' | 'in-progress' | 'completed';

export default function ImageList() {
  const {
    images,
    currentIndex,
    setCurrentIndex,
    annotations,
    preferences,
    setPreference,
  } = useAnnotationStore();

  const [filter, setFilter] = useState<FilterType>('all');

  // Get annotation counts per image (simplified - would need to fetch from API in production)
  const getImageStatus = (imageId: string): 'not-started' | 'in-progress' | 'completed' => {
    // For now, just check current image annotations
    // In production, this should be stored in image metadata
    return 'not-started';
  };

  const filteredImages = images.filter((img, idx) => {
    if (filter === 'all') return true;
    const status = getImageStatus(img.id);
    return status === filter;
  });

  const handleImageClick = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with filter */}
      <div className="p-3 border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-400">Images</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreference('imageListView', preferences.imageListView === 'grid' ? 'list' : 'grid')}
              className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title={preferences.imageListView === 'grid' ? 'Switch to List View' : 'Switch to Grid View'}
            >
              {preferences.imageListView === 'grid' ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
              )}
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-500">
              {filteredImages.length} / {images.length}
            </span>
          </div>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
          className="w-full px-2 py-1 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-300 focus:outline-none focus:border-violet-500"
        >
          <option value="all">All Images</option>
          <option value="not-started">Not Started</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Image grid/list */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredImages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            No images match filter
          </div>
        ) : preferences.imageListView === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredImages.map((img, idx) => {
              const actualIndex = images.indexOf(img);
              const isCurrent = actualIndex === currentIndex;
              const status = getImageStatus(img.id);

              return (
                <button
                  key={img.id}
                  onClick={() => handleImageClick(actualIndex)}
                  className={`relative aspect-[3/2] rounded overflow-hidden transition-all ${
                    isCurrent
                      ? 'ring-2 ring-violet-500 scale-[1.02]'
                      : 'ring-1 ring-gray-600 hover:ring-gray-500'
                  }`}
                  title={img.file_name}
                >
                  {/* Thumbnail image */}
                  <img
                    src={img.url}
                    alt={img.file_name}
                    className="w-full h-full object-cover bg-gray-900"
                    loading="lazy"
                  />

                  {/* Image number badge */}
                  <div className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] text-white font-medium">
                    {actualIndex + 1}
                  </div>

                  {/* Status indicator */}
                  {status === 'completed' && (
                    <div className="absolute top-1 right-1 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {status === 'in-progress' && (
                    <div className="absolute top-1 right-1 bg-yellow-500 rounded-full w-4 h-4" />
                  )}

                  {/* Current image indicator */}
                  {isCurrent && (
                    <div className="absolute inset-0 bg-violet-500/10 pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col">
            <table className="w-full text-xs">
              <thead className="text-[10px] text-gray-600 dark:text-gray-500 border-b border-gray-300 dark:border-gray-700">
                <tr>
                  <th className="text-left py-1.5 px-2 font-medium w-8">#</th>
                  <th className="text-left py-1.5 px-2 font-medium">Name</th>
                  <th className="text-center py-1.5 px-2 font-medium w-12">Ann</th>
                </tr>
              </thead>
              <tbody>
                {filteredImages.map((img, idx) => {
                  const actualIndex = images.indexOf(img);
                  const isCurrent = actualIndex === currentIndex;
                  const annCount = img.annotation_count || 0;

                  return (
                    <tr
                      key={img.id}
                      onClick={() => handleImageClick(actualIndex)}
                      className={`cursor-pointer transition-all border-b border-gray-300 dark:border-gray-700/50 ${
                        isCurrent
                          ? 'bg-violet-500/20'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      title={img.file_name}
                    >
                      <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400 font-medium">
                        {actualIndex + 1}
                      </td>
                      <td className="py-1.5 px-2 text-gray-900 dark:text-gray-300 truncate max-w-0">
                        {img.file_name}
                      </td>
                      <td className="py-1.5 px-2 text-center text-gray-600 dark:text-gray-500">
                        {annCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
