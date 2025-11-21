'use client';

/**
 * Step 1: File Selection & Storage Location
 *
 * - Select files or folders
 * - Choose target folder in storage
 * - Preview final structure
 */

import { useState, useRef, useEffect } from 'react';
import { getStorageStructure, type FolderInfo } from '@/lib/api/datasets';
import type { FileMappingInfo } from './MultiStepUploadModal';

interface Step1FileSelectionProps {
  datasetId: string;
  onNext: (files: File[], targetFolder: string, mappings: FileMappingInfo[]) => void;
  onCancel: () => void;
}

export default function Step1FileSelection({
  datasetId,
  onNext,
  onCancel,
}: Step1FileSelectionProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [stripTopLevel, setStripTopLevel] = useState(true);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFolderStructure();
  }, [datasetId]);

  const loadFolderStructure = async () => {
    try {
      setLoading(true);
      const structure = await getStorageStructure(datasetId);
      setFolders(structure.folders);
    } catch (err) {
      console.error('Failed to load folder structure:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const normalizedName = newFolderName.trim().replace(/\/+$/, '') + '/';
      setTargetFolder(normalizedName);
      setNewFolderName('');
    }
  };

  const calculateFileMappings = (): FileMappingInfo[] => {
    return selectedFiles.map(file => {
      // @ts-ignore
      let originalPath = file.webkitRelativePath || file.name;
      let finalPath = originalPath;

      // Strip top-level folder if selected
      if (stripTopLevel && originalPath.includes('/')) {
        const parts = originalPath.split('/');
        if (parts.length > 1) {
          finalPath = parts.slice(1).join('/');
        }
      }

      // Apply target folder
      if (targetFolder) {
        finalPath = `${targetFolder}${finalPath}`;
      }

      return {
        file,
        originalPath,
        finalPath,
        size: file.size,
      };
    });
  };

  const handleNext = () => {
    if (selectedFiles.length === 0) {
      alert('최소 1개 이상의 파일을 선택해주세요');
      return;
    }

    // Hard limit: 50,000 files (technical/memory constraint)
    if (selectedFiles.length > 50000) {
      alert(
        `⚠️ 파일이 너무 많습니다 (최대 50,000개)\n\n` +
        `현재: ${selectedFiles.length.toLocaleString()}개\n` +
        `브라우저 메모리 제한으로 50,000개까지만 지원됩니다.\n\n` +
        `여러 번 나눠서 업로드해주세요.`
      );
      return;
    }

    // Warning for very large uploads (>10,000)
    if (selectedFiles.length > 10000) {
      const confirmed = confirm(
        `⚠️ 대용량 업로드: ${selectedFiles.length.toLocaleString()}개 파일\n\n` +
        `배치 업로드가 자동으로 진행됩니다 (500개씩 분할)\n` +
        `예상 배치 수: ${Math.ceil(selectedFiles.length / 500)}개\n\n` +
        `업로드 시간이 오래 걸릴 수 있습니다.\n` +
        `계속하시겠습니까?`
      );
      if (!confirmed) return;
    }
    // Warning for large uploads (>5,000)
    else if (selectedFiles.length > 5000) {
      const confirmed = confirm(
        `⚠️ ${selectedFiles.length.toLocaleString()}개의 파일을 업로드합니다.\n\n` +
        `배치 업로드로 진행됩니다 (500개씩 분할)\n` +
        `파일이 많을수록 업로드 시간이 오래 걸립니다.\n` +
        `계속하시겠습니까?`
      );
      if (!confirmed) return;
    }

    const mappings = calculateFileMappings();
    onNext(selectedFiles, targetFolder, mappings);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  const fileMappings = calculateFileMappings();
  // @ts-ignore
  const isFromFolder = selectedFiles.length > 0 && selectedFiles[0]?.webkitRelativePath;

  return (
    <div className="p-6 space-y-6">
      {/* File Selection */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">📁 업로드할 파일 선택</h3>
        <p className="text-xs text-gray-500 mb-3">
          지원 포맷: JPG, PNG, GIF, BMP, WEBP, TIFF, ZIP
        </p>

        {/* Hidden inputs */}
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept="image/*,.zip"
          onChange={handleImageFileChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          /* @ts-ignore */
          webkitdirectory="true"
          directory="true"
          multiple
          onChange={handleFolderSelect}
          className="hidden"
        />

        {/* Upload buttons */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-colors"
          >
            <div className="flex flex-col items-center justify-center text-gray-600">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span className="text-sm font-medium">파일 선택</span>
              <span className="text-xs text-gray-500 mt-0.5">이미지, ZIP</span>
            </div>
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-colors"
          >
            <div className="flex flex-col items-center justify-center text-gray-600">
              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="text-sm font-medium">폴더 선택</span>
              <span className="text-xs text-gray-500 mt-0.5">구조 유지</span>
            </div>
          </button>
        </div>

        {/* Selected files */}
        {selectedFiles.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-900">
                {selectedFiles.length}개 파일 선택됨 ({formatFileSize(totalSize)})
                {isFromFolder && (
                  <span className="ml-2 text-violet-600">(폴더)</span>
                )}
              </p>
              <button
                onClick={() => setSelectedFiles([])}
                className="text-xs text-red-600 hover:text-red-800"
              >
                전체 제거
              </button>
            </div>
            {/* Warning for large file counts */}
            {selectedFiles.length > 50000 && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                ⚠️ 파일이 너무 많습니다. 최대 50,000개까지 업로드할 수 있습니다.
              </div>
            )}
            {selectedFiles.length > 10000 && selectedFiles.length <= 50000 && (
              <div className="mb-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-700">
                ⚠️ 대용량 업로드: 배치 {Math.ceil(selectedFiles.length / 500)}개로 분할 전송됩니다.
              </div>
            )}
            {selectedFiles.length > 5000 && selectedFiles.length <= 10000 && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                ⚠️ 대용량 업로드: 배치 업로드로 진행됩니다.
              </div>
            )}
            <div className="max-h-32 overflow-y-auto space-y-1">
              {selectedFiles.slice(0, 10).map((file, index) => (
                <div key={index} className="flex items-center justify-between text-xs py-1">
                  {/* @ts-ignore */}
                  <span className="truncate flex-1 text-gray-700">{file.webkitRelativePath || file.name}</span>
                  <div className="flex items-center space-x-2 ml-2">
                    <span className="text-gray-500">{formatFileSize(file.size)}</span>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              {selectedFiles.length > 10 && (
                <p className="text-xs text-gray-500 text-center py-1">
                  ... 외 {selectedFiles.length - 10}개 파일
                </p>
              )}
            </div>
          </div>
        )}

        {/* Strip top-level option */}
        {isFromFolder && (
          <div className="mt-3">
            <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={stripTopLevel}
                onChange={(e) => setStripTopLevel(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span>최상위 폴더명 제거 (권장)</span>
            </label>
            <p className="text-xs text-gray-500 ml-6 mt-1">
              예: MyFolder/train/img.jpg → train/img.jpg
            </p>
          </div>
        )}
      </div>

      {/* Storage Location */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">💾 Storage 저장 위치</h3>

        {loading ? (
          <div className="text-center py-4 text-gray-500">
            <p className="text-sm">폴더 구조 로딩 중...</p>
          </div>
        ) : (
          <>
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto mb-3">
              {folders.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  아직 폴더가 없습니다. 새 폴더를 만들거나 루트에 저장하세요.
                </div>
              ) : (
                folders.map((folder) => (
                  <button
                    key={folder.path}
                    onClick={() => setTargetFolder(folder.path === '/' ? '' : folder.path)}
                    className={`w-full px-4 py-2 text-left text-sm border-b border-gray-100 hover:bg-violet-50 transition-colors ${
                      targetFolder === (folder.path === '/' ? '' : folder.path)
                        ? 'bg-violet-100 text-violet-900 font-medium'
                        : 'text-gray-700'
                    }`}
                    style={{ paddingLeft: `${(folder.depth + 1) * 12}px` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span>{folder.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {folder.file_count}개 파일
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Create new folder */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="새 폴더 이름"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                생성
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-2">
              현재 저장 위치: <span className="font-mono text-xs font-medium text-gray-700">
                datasets/{datasetId}/images/{targetFolder || ''}
              </span>
            </p>
          </>
        )}
      </div>

      {/* Preview */}
      {selectedFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">📊 최종 Storage 구조 미리보기</h3>
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-48 overflow-y-auto">
            <p className="text-xs font-medium text-gray-700 mb-2">datasets/{datasetId}/images/</p>
            <div className="space-y-0.5 font-mono text-xs">
              {fileMappings.slice(0, 15).map((mapping, index) => (
                <div key={index} className="text-gray-600 pl-4">
                  ├─ <span className="text-violet-600">{mapping.finalPath}</span> ✨
                </div>
              ))}
              {fileMappings.length > 15 && (
                <div className="text-gray-500 pl-4">
                  ... 외 {fileMappings.length - 15}개 파일
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          취소
        </button>
        <button
          onClick={handleNext}
          disabled={selectedFiles.length === 0}
          className="px-6 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          다음: 검증 →
        </button>
      </div>
    </div>
  );
}
