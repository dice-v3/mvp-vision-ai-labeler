/**
 * Top Bar Component
 *
 * Project info, progress, save status, controls
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { listVersions } from '@/lib/api/export';
import ExportModal from './ExportModal';

export default function TopBar() {
  const router = useRouter();
  const { project, images, currentIndex, preferences, setPreference } = useAnnotationStore();
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string>('');
  const [versionDate, setVersionDate] = useState<string>('');

  // Fetch latest version info
  const fetchLatestVersion = useCallback(async () => {
    if (!project?.id) return;

    try {
      const result = await listVersions(project.id);
      const publishedVersions = result.versions
        .filter((v) => v.version_type === 'published')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (publishedVersions.length > 0) {
        const latest = publishedVersions[0];
        setLatestVersion(latest.version_number);
        const date = new Date(latest.created_at);
        setVersionDate(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
    } catch (error) {
      console.error('Failed to fetch version:', error);
    }
  }, [project?.id]);

  useEffect(() => {
    fetchLatestVersion();
  }, [fetchLatestVersion]);

  return (
    <div className="h-[60px] bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex items-center px-6">
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={() => router.push('/')}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm"
          title="Back to Dashboard"
        >
          ← Back
        </button>
        <span className="text-gray-400 dark:text-gray-600">|</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {project?.name || 'Loading...'}
          </span>
          {project && project.taskTypes && project.taskTypes.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-violet-500/20 text-violet-600 dark:text-violet-400">
              {project.taskTypes.join(', ')}
            </span>
          )}
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Image {currentIndex + 1} / {images.length}
        </span>
        <div className="flex-1">
          <div className="w-full max-w-xs bg-gray-300 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="h-full bg-gradient-to-r from-violet-600 to-purple-600 rounded-full transition-all"
              style={{
                width: `${images.length > 0 ? ((currentIndex + 1) / images.length) * 100 : 0}%`,
              }}
            ></div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* Publish Button */}
        <button
          onClick={() => setIsExportModalOpen(true)}
          className="px-4 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors font-medium"
          title="Publish new version"
        >
          Publish
        </button>

        {/* Version Info */}
        {latestVersion ? (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {latestVersion} {versionDate && `(${versionDate})`}
          </span>
        ) : (
          <span className="text-xs text-gray-500 dark:text-gray-500">No version</span>
        )}

        <span className="text-gray-400 dark:text-gray-600">|</span>

        {/* Dark/Light Mode Toggle */}
        <button
          onClick={() => setPreference('darkMode', !preferences.darkMode)}
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          title={preferences.darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {preferences.darkMode ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Fullscreen */}
        <button
          className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
          title="Fullscreen (F)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        {/* Menu Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            title="More options"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsExportModalOpen(true);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Export/Publish Modal */}
      {project && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          projectId={project.id}
          mode="publish"
          onPublishSuccess={fetchLatestVersion}
        />
      )}
    </div>
  );
}
