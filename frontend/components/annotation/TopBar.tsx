/**
 * Top Bar Component
 *
 * Project info, progress, save status, controls
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { importAnnotationsFromJson } from '@/lib/api/annotations';
import ExportModal from './ExportModal';
import VersionHistoryModal from './VersionHistoryModal';

export default function TopBar() {
  const router = useRouter();
  const { project, images, currentIndex, saveStatus, lastSaved, preferences, setPreference } = useAnnotationStore();
  const [isReimporting, setIsReimporting] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportMode, setExportMode] = useState<'export' | 'publish'>('export');
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

  const formatSaveStatus = () => {
    if (saveStatus === 'saved' && lastSaved) {
      const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      if (seconds < 60) return `Saved ${seconds}s ago`;
      return `Saved ${Math.floor(seconds / 60)}m ago`;
    }
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'error') return 'Error saving';
    return 'Saved';
  };

  const handleReimport = async () => {
    if (!project?.id) return;

    const confirmed = window.confirm(
      'Re-import annotations from annotations.json?\n\nThis will delete all existing annotations and re-import from the JSON file.'
    );

    if (!confirmed) return;

    setIsReimporting(true);
    try {
      console.log('Starting force re-import...');
      const result = await importAnnotationsFromJson(project.id, true);
      console.log('Re-import result:', result);
      alert(`Success! Imported ${result.imported} annotations.\n\nThe page will now reload.`);
      window.location.reload();
    } catch (error: any) {
      console.error('Re-import failed:', error);
      alert(`Failed to re-import: ${error.message || error}`);
      setIsReimporting(false);
    }
  };

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
        <button
          onClick={handleReimport}
          disabled={isReimporting}
          className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded transition-colors"
          title="Force re-import annotations from annotations.json"
        >
          {isReimporting ? 'Importing...' : 'Re-import'}
        </button>
        <span className="text-gray-400 dark:text-gray-600">|</span>
        <button
          onClick={() => {
            setExportMode('export');
            setIsExportModalOpen(true);
          }}
          className="px-3 py-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded transition-colors"
          title="Export annotations in various formats"
        >
          Export
        </button>
        <button
          onClick={() => {
            setExportMode('publish');
            setIsExportModalOpen(true);
          }}
          className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
          title="Publish new version"
        >
          Publish Version
        </button>
        <button
          onClick={() => setIsVersionHistoryOpen(true)}
          className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white rounded transition-colors"
          title="View version history"
        >
          Versions
        </button>
        <span className={`text-xs ${saveStatus === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {formatSaveStatus()}
        </span>
        <button
          className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors"
          title="Fullscreen (F)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Export Modal */}
      {project && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          projectId={project.id}
          mode={exportMode}
        />
      )}

      {/* Version History Modal */}
      {project && (
        <VersionHistoryModal
          isOpen={isVersionHistoryOpen}
          onClose={() => setIsVersionHistoryOpen(false)}
          projectId={project.id}
        />
      )}
    </div>
  );
}
