/**
 * Annotation Versions Component
 *
 * Displays published versions with detail modal
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { listVersions, type Version } from '@/lib/api/export';
import VersionHistoryModal from './VersionHistoryModal';

export default function AnnotationHistory() {
  const [isCollapsed, setIsCollapsed] = useState(false); // Default: expanded
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { project, images } = useAnnotationStore();

  // Load published versions
  const loadVersions = useCallback(async () => {
    if (!project?.id) return;

    try {
      setLoading(true);
      const result = await listVersions(project.id);
      const publishedVersions = result.versions
        .filter((v) => v.version_type === 'published')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3); // Show only latest 3

      setVersions(publishedVersions);
    } catch (error) {
      console.error('Failed to load versions:', error);
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  // Initial load
  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  // Listen for version published event
  useEffect(() => {
    const handleVersionPublished = () => {
      loadVersions();
    };

    window.addEventListener('versionPublished', handleVersionPublished);
    return () => window.removeEventListener('versionPublished', handleVersionPublished);
  }, [loadVersions]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="border-t border-b border-gray-300 dark:border-gray-700">
      {/* Header */}
      <div
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-400">
            Annotation Versions
          </h4>
          <span className="text-[10px] text-gray-500 dark:text-gray-600">
            ({versions.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Expand icon for detailed modal */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            className="p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
            title="View detailed version history"
          >
            <svg
              className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
          {/* Collapse icon */}
          <svg
            className={`w-3.5 h-3.5 text-gray-600 dark:text-gray-400 transition-transform ${
              isCollapsed ? '' : 'rotate-180'
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Version List */}
      {!isCollapsed && (
        <div className="max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-500">
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-500">
              No versions published yet
            </div>
          ) : (
            <div className="divide-y divide-gray-300 dark:divide-gray-700/50">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => setIsModalOpen(true)}
                  title={`${version.version_number} - ${version.image_count || 0}/${images.length} images${version.created_by_name ? ` by ${version.created_by_name}` : ''}${version.description ? ` - ${version.description}` : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-medium text-violet-600 dark:text-violet-400 flex-shrink-0">
                        {version.version_number}
                      </span>
                      <span className="text-[10px] text-gray-600 dark:text-gray-500 flex-shrink-0">
                        {formatDate(version.created_at)}
                      </span>
                      {version.created_by_name && (
                        <span className="text-[10px] text-gray-500 dark:text-gray-600 flex-shrink-0 truncate max-w-[80px]" title={version.created_by_name}>
                          {version.created_by_name}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-600 dark:text-gray-500 flex-shrink-0">
                      {version.image_count || 0}/{images.length}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Version History Modal */}
      {project && (
        <VersionHistoryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          projectId={project.id}
        />
      )}
    </div>
  );
}
