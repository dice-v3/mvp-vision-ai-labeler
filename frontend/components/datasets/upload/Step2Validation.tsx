'use client';

/**
 * Step 2: Validation & Conflict Resolution
 *
 * - Detect duplicate files
 * - Allow user to choose resolution strategy
 * - Show validation summary
 */

import { useState, useEffect } from 'react';
import { previewUpload, type UploadPreview } from '@/lib/api/datasets';
import type { FileMappingInfo } from './MultiStepUploadModal';

interface Step2ValidationProps {
  datasetId: string;
  fileMappings: FileMappingInfo[];
  targetFolder: string;
  onNext: (resolutions: Record<string, 'overwrite' | 'skip' | 'rename'>) => void;
  onBack: () => void;
  onCancel: () => void;
}

export default function Step2Validation({
  datasetId,
  fileMappings,
  targetFolder,
  onNext,
  onBack,
  onCancel,
}: Step2ValidationProps) {
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolutions, setResolutions] = useState<Record<string, 'overwrite' | 'skip' | 'rename'>>({});
  const [bulkAction, setBulkAction] = useState<'overwrite' | 'skip' | 'rename'>('overwrite');

  useEffect(() => {
    loadPreview();
  }, []);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError('');

      const fileMappingsForAPI = fileMappings.map(m => ({
        filename: m.file.name,
        relative_path: m.finalPath,
        size: m.size,
      }));

      const result = await previewUpload(datasetId, {
        file_mappings: fileMappingsForAPI,
        target_folder: targetFolder,
      });

      setPreview(result);

      // Initialize resolutions with default 'overwrite'
      const initialResolutions: Record<string, 'overwrite' | 'skip' | 'rename'> = {};
      result.duplicate_files.forEach(file => {
        initialResolutions[file.path] = 'overwrite';
      });
      setResolutions(initialResolutions);

    } catch (err) {
      setError(err instanceof Error ? err.message : '검증에 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleResolutionChange = (path: string, action: 'overwrite' | 'skip' | 'rename') => {
    setResolutions(prev => ({
      ...prev,
      [path]: action
    }));
  };

  const handleBulkApply = () => {
    if (preview) {
      const bulkResolutions: Record<string, 'overwrite' | 'skip' | 'rename'> = {};
      preview.duplicate_files.forEach(file => {
        bulkResolutions[file.path] = bulkAction;
      });
      setResolutions(bulkResolutions);
    }
  };

  const handleNext = () => {
    onNext(resolutions);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-violet-600 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-sm text-gray-600">검증 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-sm text-red-800">{error}</p>
          <div className="mt-4 space-x-3">
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← 이전
            </button>
            <button
              onClick={loadPreview}
              className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  const hasConflicts = preview.duplicate_files.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Summary */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">✅ 업로드 검증 결과</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4 bg-green-50">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {preview.summary.total_new}
            </div>
            <div className="text-xs text-gray-600">새 파일</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 bg-yellow-50">
            <div className="text-2xl font-bold text-yellow-600 mb-1">
              {preview.summary.total_duplicates}
            </div>
            <div className="text-xs text-gray-600">중복 파일</div>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {preview.summary.total_files}
            </div>
            <div className="text-xs text-gray-600">전체 파일</div>
          </div>
        </div>
      </div>

      {/* Duplicates */}
      {hasConflicts && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">⚠️ 중복 파일 처리 방법</h3>
            <div className="flex items-center space-x-2">
              <label className="text-xs text-gray-600">일괄 적용:</label>
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value as any)}
                className="text-xs border border-gray-300 rounded px-2 py-1"
              >
                <option value="overwrite">덮어쓰기</option>
                <option value="skip">스킵</option>
                <option value="rename">이름 변경</option>
              </select>
              <button
                onClick={handleBulkApply}
                className="px-3 py-1 text-xs font-medium text-white bg-violet-600 rounded hover:bg-violet-700"
              >
                적용
              </button>
            </div>
          </div>

          <div className="border border-yellow-200 rounded-lg bg-yellow-50 p-4 max-h-96 overflow-y-auto">
            <div className="space-y-3">
              {preview.duplicate_files.map((file, index) => (
                <div key={index} className="bg-white rounded border border-yellow-200 p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.filename}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        경로: {file.path}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        크기: {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`resolution-${index}`}
                        checked={resolutions[file.path] === 'overwrite'}
                        onChange={() => handleResolutionChange(file.path, 'overwrite')}
                        className="text-violet-600"
                      />
                      <span className="text-xs text-gray-700">덮어쓰기</span>
                    </label>
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`resolution-${index}`}
                        checked={resolutions[file.path] === 'skip'}
                        onChange={() => handleResolutionChange(file.path, 'skip')}
                        className="text-violet-600"
                      />
                      <span className="text-xs text-gray-700">스킵</span>
                    </label>
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`resolution-${index}`}
                        checked={resolutions[file.path] === 'rename'}
                        onChange={() => handleResolutionChange(file.path, 'rename')}
                        className="text-violet-600"
                      />
                      <span className="text-xs text-gray-700">이름 변경</span>
                    </label>
                  </div>

                  {resolutions[file.path] === 'overwrite' && (
                    <div className="mt-2 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                      ⚠️ 기존 파일이 삭제됩니다
                    </div>
                  )}
                  {resolutions[file.path] === 'rename' && (
                    <div className="mt-2 text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                      📝 {file.filename.replace(/(\.[^.]+)$/, '_new$1')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Files Preview */}
      {preview.new_files.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            ✨ 새로 추가될 파일 ({preview.new_files.length}개)
          </h3>
          <div className="border border-gray-200 rounded-lg bg-gray-50 p-3 max-h-48 overflow-y-auto">
            <div className="space-y-1 text-xs">
              {preview.new_files.slice(0, 20).map((file, index) => (
                <div key={index} className="flex items-center justify-between py-1">
                  <span className="text-gray-700 truncate flex-1">{file.path}</span>
                  <span className="text-gray-500 ml-2">{formatFileSize(file.size)}</span>
                </div>
              ))}
              {preview.new_files.length > 20 && (
                <p className="text-gray-500 text-center py-1">
                  ... 외 {preview.new_files.length - 20}개 파일
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← 이전
        </button>
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
          >
            다음: 어노테이션 →
          </button>
        </div>
      </div>
    </div>
  );
}
