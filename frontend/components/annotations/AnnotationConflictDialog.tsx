/**
 * Phase 8.5.1: Annotation Conflict Resolution Dialog
 *
 * Shown when an annotation update fails due to optimistic locking conflict.
 * User can choose to:
 * - Reload and see the latest version
 * - Overwrite with their changes (force update)
 */

'use client';

import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export interface ConflictInfo {
  annotationId: string;
  currentVersion: number;
  yourVersion: number;
  lastUpdatedBy?: number;
  lastUpdatedAt?: string;
  message: string;
}

interface AnnotationConflictDialogProps {
  isOpen: boolean;
  conflict: ConflictInfo | null;
  onReload: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
}

export function AnnotationConflictDialog({
  isOpen,
  conflict,
  onReload,
  onOverwrite,
  onCancel,
}: AnnotationConflictDialogProps) {
  if (!isOpen || !conflict) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Annotation Conflict
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                This annotation was modified by another user
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Your version:</span>
              <span className="font-medium">v{conflict.yourVersion}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current version:</span>
              <span className="font-medium text-blue-600">v{conflict.currentVersion}</span>
            </div>
            {conflict.lastUpdatedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last updated:</span>
                <span className="font-medium">{formatDate(conflict.lastUpdatedAt)}</span>
              </div>
            )}
          </div>

          <p className="text-sm text-gray-700">
            {conflict.message}
          </p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs text-yellow-800">
              <strong>Reload Latest:</strong> Discard your changes and load the current version.
              <br />
              <strong>Overwrite:</strong> Save your changes and replace the current version.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onReload}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Reload Latest
          </button>
          <button
            onClick={onOverwrite}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
          >
            Overwrite
          </button>
        </div>
      </div>
    </div>
  );
}
