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

export default function TopBar() {
  const router = useRouter();
  const { project, images, currentIndex, saveStatus, lastSaved } = useAnnotationStore();
  const [isReimporting, setIsReimporting] = useState(false);

  const formatSaveStatus = () => {
    if (saveStatus === 'saved' && lastSaved) {
      const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
      if (seconds < 60) return `✓ Saved ${seconds}s ago`;
      return `✓ Saved ${Math.floor(seconds / 60)}m ago`;
    }
    if (saveStatus === 'saving') return '💾 Saving...';
    if (saveStatus === 'error') return '⚠ Error saving';
    return '✓ Saved';
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
    <div className="h-[60px] bg-gray-800 border-b border-gray-700 flex items-center px-6">
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={() => router.push('/')}
          className="text-gray-400 hover:text-white transition-colors text-sm"
          title="Back to Dashboard"
        >
          ← Back
        </button>
        <span className="text-gray-600">|</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {project?.name || 'Loading...'}
          </span>
          {project && project.task_types && project.task_types.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-violet-500/20 text-violet-400">
              {project.task_types.join(', ')}
            </span>
          )}
        </div>
        <span className="text-sm text-gray-400">
          Image {currentIndex + 1} / {images.length}
        </span>
        <div className="flex-1">
          <div className="w-full max-w-xs bg-gray-700 rounded-full h-1.5">
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
          onClick={handleReimport}
          disabled={isReimporting}
          className="px-3 py-1.5 text-xs bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white rounded transition-colors"
          title="Force re-import annotations from annotations.json"
        >
          {isReimporting ? '⏳ Importing...' : '🔄 Re-import'}
        </button>
        <span className={`text-xs ${saveStatus === 'error' ? 'text-red-400' : 'text-green-400'}`}>
          {formatSaveStatus()}
        </span>
        <button
          className="text-sm text-gray-400 hover:text-white transition-colors"
          title="Fullscreen (F)"
        >
          ⛶
        </button>
      </div>
    </div>
  );
}
