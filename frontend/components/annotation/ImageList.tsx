/**
 * Image List Component
 *
 * Displays thumbnail grid of all images in the project
 */

'use client';

import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { useState, useEffect, useRef } from 'react';
import { getProjectImages, getProjectImageStatuses } from '@/lib/api/projects';

type FilterType = 'all' | 'not-started' | 'in-progress' | 'completed';

export default function ImageList() {
  const {
    project,
    images,
    totalImages,
    currentIndex,
    setCurrentIndex,
    annotations,
    preferences,
    setPreference,
    currentTask, // Phase 2.9: Task context
    loadMoreImages, // Phase 2.12: Load more images
    backgroundLoading, // Phase 2.12: Background loading state
    // Multi-image selection
    selectedImageIds,
    toggleImageSelection,
    selectImageRange,
    clearImageSelection,
    isImageSelected,
  } = useAnnotationStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [searchText, setSearchText] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);  // Phase 2.12: Loading state for pagination
  const currentImageRef = useRef<HTMLDivElement | HTMLTableRowElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Phase 2.7: Get image status from real data
  // Phase 2.9: TODO - Filter status by currentTask
  // Currently shows aggregate status across all tasks
  // Future: Backend should return task-specific status in image_annotation_status
  const getImageStatus = (img: any): 'not-started' | 'in-progress' | 'completed' => {
    // Use status from image_annotation_status table
    if (img.status) {
      return img.status as 'not-started' | 'in-progress' | 'completed';
    }
    // Fallback for images without status entry
    const count = img.annotation_count || 0;
    if (img.is_confirmed) return 'completed';
    if (count > 0) return 'in-progress';
    return 'not-started';
  };

  // Phase 2.12: Load more images function
  const handleLoadMore = async () => {
    if (!project?.id || loadingMore) return;

    setLoadingMore(true);
    try {
      const offset = images.length;
      const limit = 50;

      // Fetch next batch of images
      const imageResponse = await getProjectImages(project.id, limit, offset);

      // Fetch image statuses for the new images
      const imageStatusesResponse = await getProjectImageStatuses(project.id, currentTask || undefined, limit, offset);
      const imageStatusMap = new Map(
        imageStatusesResponse.statuses.map(s => [s.image_id, s])
      );

      // Convert to ImageData format with status info
      const convertedImages = imageResponse.images.map(img => {
        const imgId = String(img.id);
        const status = imageStatusMap.get(imgId);
        return {
          ...img,
          id: imgId,
          annotation_count: status?.total_annotations || 0,
          is_confirmed: status?.is_image_confirmed || false,
          status: status?.status || 'not-started',
          confirmed_at: status?.confirmed_at,
          has_no_object: status?.has_no_object || false,
        };
      });

      // Append new images to the store
      loadMoreImages(convertedImages);
    } catch (error) {
      console.error('Failed to load more images:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Phase 2.7: Enhanced Status Badge Component
  const StatusBadge = ({ status }: { status: 'not-started' | 'in-progress' | 'completed' }) => {
    if (status === 'completed') {
      return (
        <div className="bg-green-500 rounded-full w-5 h-5 flex items-center justify-center shadow-sm ring-2 ring-green-400 ring-opacity-50" title="Completed">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        </div>
      );
    }
    if (status === 'in-progress') {
      return (
        <div className="bg-yellow-500 rounded-full w-5 h-5 flex items-center justify-center shadow-sm ring-2 ring-yellow-400 ring-opacity-50" title="In Progress">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="bg-gray-400 dark:bg-gray-600 rounded-full w-5 h-5 flex items-center justify-center shadow-sm" title="Not Started">
        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
    );
  };

  const filteredImages = images.filter((img, idx) => {
    // Filter by status
    if (filter !== 'all') {
      const status = getImageStatus(img);
      if (status !== filter) return false;
    }

    // Filter by search text
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      const fileName = img.file_name || '';
      const folder = img.folder_path || '';
      return fileName.toLowerCase().includes(searchLower) || folder.toLowerCase().includes(searchLower);
    }

    return true;
  });

  const handleImageClick = (e: React.MouseEvent, index: number, imageId: string) => {
    // Prevent text selection on shift+click
    if (e.shiftKey) {
      e.preventDefault();
    }

    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: Toggle individual selection
      toggleImageSelection(imageId, index);
    } else if (e.shiftKey) {
      // Shift+Click: Range selection from current image
      selectImageRange(index);
    } else {
      // Normal click: Navigate and select this image as anchor
      setCurrentIndex(index);
      // Set this image as the only selected one (anchor for Ctrl+click additions)
      useAnnotationStore.setState({
        selectedImageIds: [imageId],
        lastClickedImageIndex: index
      });
    }
  };

  // Auto-scroll to current image
  useEffect(() => {
    if (currentImageRef.current && containerRef.current) {
      currentImageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

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
            {selectedImageIds.length > 0 ? (
              <button
                onClick={() => clearImageSelection()}
                className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                title="Clear selection"
              >
                {selectedImageIds.length} selected
              </button>
            ) : (
              <span className="text-xs text-gray-600 dark:text-gray-500">
                {filteredImages.length} / {images.length}
              </span>
            )}
          </div>
        </div>

        {/* Search input */}
        <div className="mb-2 relative">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search images..."
            className="w-full px-2 py-1 pl-7 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-300 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:border-violet-500"
          />
          <svg
            className="w-3.5 h-3.5 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
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
      <div ref={containerRef} className="flex-1 overflow-y-auto p-2 select-none">
        {filteredImages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            No images match filter
          </div>
        ) : preferences.imageListView === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredImages.map((img, idx) => {
              const actualIndex = images.indexOf(img);
              const isCurrent = actualIndex === currentIndex;
              const isSelected = isImageSelected(img.id);
              const status = getImageStatus(img);

              return (
                <div
                  key={img.id}
                  ref={isCurrent ? currentImageRef as any : null}
                >
                  <button
                    onClick={(e) => handleImageClick(e, actualIndex, img.id)}
                    className={`relative aspect-[3/2] rounded overflow-hidden transition-all w-full ${
                      isCurrent
                        ? 'ring-2 ring-violet-500 scale-[1.02]'
                        : isSelected
                        ? 'ring-2 ring-blue-500'
                        : 'ring-1 ring-gray-600 hover:ring-gray-500'
                    }`}
                    title={`${img.file_name}${isSelected ? ' (Selected)' : ''}`}
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

                  {/* Selection checkbox indicator */}
                  {isSelected && (
                    <div className="absolute top-1 left-1 bg-blue-500 rounded w-5 h-5 flex items-center justify-center shadow-sm">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    </div>
                  )}

                  {/* Status indicator */}
                  <div className="absolute top-1 right-1 flex items-center gap-1">
                    {/* No Object indicator */}
                    {(img as any).has_no_object && (
                      <div className="bg-gray-600 rounded-full w-5 h-5 flex items-center justify-center shadow-sm" title="No Object">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} strokeDasharray="4 2" />
                        </svg>
                      </div>
                    )}
                    <StatusBadge status={status} />
                  </div>

                  {/* Current image indicator */}
                  {isCurrent && (
                    <div className="absolute inset-0 bg-violet-500/10 pointer-events-none" />
                  )}
                  </button>
                </div>
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
                  <th className="text-center py-1.5 px-2 font-medium w-8">St</th>
                </tr>
              </thead>
              <tbody>
                {filteredImages.map((img, idx) => {
                  const actualIndex = images.indexOf(img);
                  const isCurrent = actualIndex === currentIndex;
                  const isSelected = isImageSelected(img.id);
                  const annCount = img.annotation_count || 0;
                  const status = getImageStatus(img);

                  return (
                    <tr
                      key={img.id}
                      ref={isCurrent ? currentImageRef as any : null}
                      onClick={(e) => handleImageClick(e, actualIndex, img.id)}
                      className={`cursor-pointer transition-all border-b border-gray-300 dark:border-gray-700/50 ${
                        isCurrent
                          ? 'bg-violet-500/20'
                          : isSelected
                          ? 'bg-blue-500/20'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      title={`${img.file_name}${isSelected ? ' (Selected)' : ''}`}
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
                      <td className="py-1.5 px-2">
                        <div className="flex justify-center items-center gap-1">
                          {/* No Object indicator */}
                          {(img as any).has_no_object && (
                            <div className="bg-gray-600 rounded-full w-4 h-4 flex items-center justify-center" title="No Object">
                              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} strokeDasharray="4 2" />
                              </svg>
                            </div>
                          )}
                          <StatusBadge status={status} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phase 2.12: Load More Button */}
        {images.length < totalImages && (
          <div className="mt-4 flex justify-center">
            {/* Load More button - gray dashed border with + icon, or spinner */}
            <button
              onClick={handleLoadMore}
              disabled={loadingMore || backgroundLoading}
              className="w-10 h-10 flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-gray-500 dark:text-gray-400 rounded-full transition-all"
              title={`Load More (${images.length} / ${totalImages})`}
            >
              {(loadingMore || backgroundLoading) ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
