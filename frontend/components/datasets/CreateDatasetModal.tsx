'use client';

/**
 * Dataset Form Modal (Create/Edit)
 *
 * Modal for creating or editing dataset with:
 * - Dataset name (required)
 * - Description (optional)
 * - Visibility (public/private)
 * - Task types can be added later
 */

import { useState, useEffect } from 'react';
import { createDataset, updateDataset } from '@/lib/api/datasets';
import type { Dataset } from '@/lib/types';

interface CreateDatasetModalProps {
  mode: 'create' | 'edit';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  dataset?: Dataset; // For edit mode
}

export default function CreateDatasetModal({
  mode = 'create',
  isOpen,
  onClose,
  onSuccess,
  dataset,
}: CreateDatasetModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Initialize form when dataset changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && dataset) {
      setName(dataset.name || '');
      setDescription(dataset.description || '');
      setVisibility(dataset.visibility as 'private' | 'public' || 'private');
    } else {
      // Reset for create mode
      setName('');
      setDescription('');
      setVisibility('private');
    }
  }, [mode, dataset, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('데이터셋 이름을 입력해주세요');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (mode === 'create') {
        await createDataset({
          name: name.trim(),
          description: description.trim() || undefined,
          task_types: [], // Empty - can be added later
          visibility: visibility,
        });
      } else {
        await updateDataset(dataset!.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          visibility: visibility,
        });
      }

      // Success
      setName('');
      setDescription('');
      setVisibility('private');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : mode === 'create' ? '데이터셋 생성에 실패했습니다' : '데이터셋 수정에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setName('');
      setDescription('');
      setVisibility('private');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'create' ? '새 데이터셋 생성' : '데이터셋 정보 수정'}
          </h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Dataset Name */}
          <div>
            <label htmlFor="dataset-name" className="block text-sm font-medium text-gray-700 mb-1">
              데이터셋 이름 <span className="text-red-500">*</span>
            </label>
            <input
              id="dataset-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="예: My Dataset"
              autoFocus
              maxLength={200}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="dataset-description" className="block text-sm font-medium text-gray-700 mb-1">
              설명 (선택)
            </label>
            <textarea
              id="dataset-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500 resize-none"
              placeholder="데이터셋에 대한 설명을 입력하세요"
            />
          </div>

          {/* Visibility */}
          <div>
            <label htmlFor="dataset-visibility" className="block text-sm font-medium text-gray-700 mb-1">
              공개 범위
            </label>
            <select
              id="dataset-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'private' | 'public')}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="private">Private - 멤버만 접근 가능</option>
              <option value="public">Public - 누구나 볼 수 있음</option>
            </select>
          </div>

          {/* Info Note - Only show in create mode */}
          {mode === 'create' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium">데이터셋이 비어있는 상태로 생성됩니다</p>
                  <p className="text-blue-700 mt-1">작업 유형과 이미지는 나중에 추가할 수 있습니다</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {submitting && (
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <span>
              {mode === 'create'
                ? (submitting ? '생성 중...' : '생성')
                : (submitting ? '저장 중...' : '저장')}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
