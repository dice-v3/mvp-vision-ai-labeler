'use client';

/**
 * Delete Dataset Modal
 *
 * Provides a confirmation modal for dataset deletion with:
 * - Deletion impact preview
 * - Dataset name confirmation
 * - Optional backup creation
 * - Loading states and error handling
 */

import { useState, useEffect } from 'react';
import { getDeletionImpact, deleteDataset } from '@/lib/api/datasets';

interface DeletionImpact {
  dataset_id: string;
  dataset_name: string;
  projects: Array<{
    project_id: string;
    project_name: string;
    task_types: string[];
    annotation_count: number;
    image_count: number;
    version_count: number;
  }>;
  total_projects: number;
  total_images: number;
  total_annotations: number;
  total_versions: number;
  storage_size_mb: number;
  file_counts: {
    annotations: number;
    exports: number;
    images: number;
  };
}

interface DeleteDatasetModalProps {
  datasetId: string;
  datasetName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeleteDatasetModal({
  datasetId,
  datasetName,
  isOpen,
  onClose,
  onSuccess,
}: DeleteDatasetModalProps) {
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactError, setImpactError] = useState('');

  const [nameConfirmation, setNameConfirmation] = useState('');
  const [createBackup, setCreateBackup] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Load deletion impact when modal opens
  useEffect(() => {
    if (isOpen && datasetId) {
      loadDeletionImpact();
    } else {
      // Reset state when modal closes
      setImpact(null);
      setNameConfirmation('');
      setCreateBackup(false);
      setDeleteError('');
    }
  }, [isOpen, datasetId]);

  const loadDeletionImpact = async () => {
    setImpactLoading(true);
    setImpactError('');
    try {
      const data = await getDeletionImpact(datasetId);
      setImpact(data);
    } catch (err) {
      setImpactError(err instanceof Error ? err.message : '삭제 영향 분석을 불러오는데 실패했습니다');
    } finally {
      setImpactLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!impact) return;

    setDeleting(true);
    setDeleteError('');

    try {
      await deleteDataset(datasetId, {
        dataset_name_confirmation: nameConfirmation,
        create_backup: createBackup,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '데이터셋 삭제에 실패했습니다');
    } finally {
      setDeleting(false);
    }
  };

  const isNameMatching = nameConfirmation === datasetName;
  const canDelete = isNameMatching && impact && !deleting;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">데이터셋 삭제</h2>
              <p className="text-sm text-gray-500 mt-1">이 작업은 되돌릴 수 없습니다</p>
            </div>
            <button
              onClick={onClose}
              disabled={deleting}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Deletion Impact */}
          {impactLoading ? (
            <div className="text-center py-8">
              <svg className="animate-spin h-8 w-8 text-violet-600 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-gray-600 mt-2">삭제 영향 분석 중...</p>
            </div>
          ) : impactError ? (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-800">{impactError}</p>
            </div>
          ) : impact ? (
            <div className="space-y-4">
              {/* Warning */}
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-semibold text-red-900">다음 항목들이 영구적으로 삭제됩니다:</h3>
                    <p className="text-sm text-red-800 mt-1">
                      이 작업은 되돌릴 수 없습니다. 신중하게 확인해주세요.
                    </p>
                  </div>
                </div>
              </div>

              {/* Impact Statistics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-xs text-gray-500">프로젝트</p>
                  <p className="text-2xl font-bold text-gray-900">{impact.total_projects}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-xs text-gray-500">이미지</p>
                  <p className="text-2xl font-bold text-gray-900">{impact.total_images}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-xs text-gray-500">어노테이션</p>
                  <p className="text-2xl font-bold text-gray-900">{impact.total_annotations}</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="text-xs text-gray-500">버전</p>
                  <p className="text-2xl font-bold text-gray-900">{impact.total_versions}</p>
                </div>
              </div>

              {/* Storage Impact */}
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">저장공간</p>
                  <p className="text-lg font-bold text-gray-900">{impact.storage_size_mb.toFixed(2)} MB</p>
                </div>
                <div className="mt-2 flex items-center space-x-4 text-xs text-gray-600">
                  <span>이미지: {impact.file_counts.images}</span>
                  <span>주석: {impact.file_counts.annotations}</span>
                  <span>내보내기: {impact.file_counts.exports}</span>
                </div>
              </div>

              {/* Project Details */}
              {impact.projects.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">영향받는 프로젝트:</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {impact.projects.map((project) => (
                      <div key={project.project_id} className="p-2 rounded bg-gray-50 text-sm">
                        <p className="font-medium text-gray-900">{project.project_name}</p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {project.annotation_count} 어노테이션, {project.version_count} 버전
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Backup Option */}
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createBackup}
                    onChange={(e) => setCreateBackup(e.target.checked)}
                    disabled={deleting}
                    className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">삭제 전 백업 생성</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      모든 어노테이션을 DICE 형식으로 백업합니다 (권장)
                    </p>
                  </div>
                </label>
              </div>

              {/* Name Confirmation */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  확인을 위해 데이터셋 이름을 입력하세요: <span className="font-mono text-violet-600">{datasetName}</span>
                </label>
                <input
                  type="text"
                  value={nameConfirmation}
                  onChange={(e) => setNameConfirmation(e.target.value)}
                  disabled={deleting}
                  placeholder={datasetName}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                    nameConfirmation && !isNameMatching ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                />
                {nameConfirmation && !isNameMatching && (
                  <p className="text-xs text-red-600 mt-1">데이터셋 이름이 일치하지 않습니다</p>
                )}
              </div>

              {/* Delete Error */}
              {deleteError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm text-red-800">{deleteError}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {deleting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>삭제 중...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>영구 삭제</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
