/**
 * Export Modal Component
 *
 * Allows users to export annotations or publish versions
 */

'use client';

import { useState } from 'react';
import { exportAnnotations, publishVersion, downloadExport, type ExportResponse, type Version } from '@/lib/api/export';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  mode: 'export' | 'publish';  // Quick export or publish version
}

export default function ExportModal({ isOpen, onClose, projectId, mode }: ExportModalProps) {
  const [format, setFormat] = useState<'dice' | 'coco' | 'yolo'>('dice');
  const [includeDraft, setIncludeDraft] = useState(false);
  const [description, setDescription] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResponse | Version | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setExportResult(null);

    try {
      if (mode === 'export') {
        // Quick export
        const result = await exportAnnotations(projectId, {
          export_format: format,
          include_draft: includeDraft,
        });
        setExportResult(result);
      } else {
        // Publish version
        const result = await publishVersion(projectId, {
          export_format: format,
          include_draft: includeDraft,
          description: description || undefined,
        });
        setExportResult(result);
      }
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (!exportResult || !('download_url' in exportResult) || !exportResult.download_url) return;

    const filename = format === 'dice'
      ? 'annotations.json'
      : format === 'coco'
      ? 'annotations_coco.json'
      : 'annotations_yolo.zip';

    downloadExport(exportResult.download_url, filename);
  };

  const handleClose = () => {
    setExportResult(null);
    setError(null);
    setDescription('');
    setFormat('dice');
    setIncludeDraft(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === 'export' ? 'Export Annotations' : 'Publish Version'}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {mode === 'export'
              ? 'Download annotations in your preferred format'
              : 'Create a new version and export annotations'
            }
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {!exportResult ? (
            <>
              {/* Format Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Export Format
                </label>
                <div className="space-y-2">
                  <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="format"
                      value="dice"
                      checked={format === 'dice'}
                      onChange={(e) => setFormat(e.target.value as 'dice')}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">DICE Format</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Platform native format (recommended)
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="format"
                      value="coco"
                      checked={format === 'coco'}
                      onChange={(e) => setFormat(e.target.value as 'coco')}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">COCO Format</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Common Objects in Context (JSON)
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <input
                      type="radio"
                      name="format"
                      value="yolo"
                      checked={format === 'yolo'}
                      onChange={(e) => setFormat(e.target.value as 'yolo')}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">YOLO Format</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        YOLOv5/v8 compatible (ZIP)
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Include Draft */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeDraft}
                    onChange={(e) => setIncludeDraft(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Include draft annotations
                  </span>
                </label>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {includeDraft
                    ? 'Draft and confirmed annotations will be exported'
                    : 'Only confirmed annotations will be exported'
                  }
                </p>
              </div>

              {/* Description (only for publish mode) */}
              {mode === 'publish' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Version Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Initial release with 100 images"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    rows={3}
                  />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </>
          ) : (
            /* Export Success */
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-green-800 dark:text-green-200">
                    {mode === 'export' ? 'Export successful!' : 'Version published successfully!'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Format:</span>
                  <span className="font-medium text-gray-900 dark:text-white uppercase">{format}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Images:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {'image_count' in exportResult ? exportResult.image_count : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Annotations:</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {'annotation_count' in exportResult ? exportResult.annotation_count : 'N/A'}
                  </span>
                </div>
                {mode === 'publish' && 'version_number' in exportResult && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Version:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{exportResult.version_number}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleDownload}
                className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors"
              >
                Download File
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          {!exportResult ? (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {mode === 'export' ? 'Exporting...' : 'Publishing...'}
                  </>
                ) : (
                  mode === 'export' ? 'Export' : 'Publish Version'
                )}
              </button>
            </>
          ) : (
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
