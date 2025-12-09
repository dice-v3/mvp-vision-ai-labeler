'use client';

/**
 * Upload Dataset Modal
 *
 * Modal for uploading new dataset with:
 * - Dataset name and description
 * - Image files (individual or ZIP)
 * - Optional annotation file (COCO/DICE format)
 * - Progress tracking
 */

import { useState, useRef } from 'react';
import { addImagesToDataset } from '@/lib/api/datasets';
import { toast } from '@/lib/stores/toastStore';

interface UploadDatasetModalProps {
  datasetId: string;
  datasetName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadDatasetModal({
  datasetId,
  datasetName,
  isOpen,
  onClose,
  onSuccess,
}: UploadDatasetModalProps) {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [annotationFile, setAnnotationFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const annotationInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImageFiles(Array.from(e.target.files));
    }
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // When selecting a folder, files will include all files with their relative paths
      setImageFiles(Array.from(e.target.files));
    }
  };

  const handleAnnotationFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAnnotationFile(e.target.files[0]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (imageFiles.length === 0) {
      setError('최소 1개 이상의 이미지 파일을 선택해주세요');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      const response = await addImagesToDataset(
        datasetId,
        imageFiles,
        annotationFile || undefined,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      toast.success(`이미지 ${response.images_uploaded}개가 업로드되었습니다`);

      // Reset form
      setImageFiles([]);
      setAnnotationFile(null);
      setUploadProgress(0);

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드에 실패했습니다');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setImageFiles([]);
      setAnnotationFile(null);
      setError('');
      setUploadProgress(0);
      onClose();
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">이미지 업로드</h2>
            <p className="text-sm text-gray-500 mt-1">{datasetName}</p>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">

          {/* Image Files */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이미지 파일 <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              지원 포맷: JPG, PNG, GIF, BMP, WEBP, TIFF, ZIP
            </p>
            <div className="space-y-2">
              {/* Hidden file inputs */}
              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*,.zip"
                onChange={handleImageFileChange}
                disabled={uploading}
                className="hidden"
              />
              <input
                ref={folderInputRef}
                type="file"
                /* @ts-ignore - webkitdirectory is not in the TS types */
                webkitdirectory="true"
                directory="true"
                multiple
                onChange={handleFolderSelect}
                disabled={uploading}
                className="hidden"
              />

              {/* Upload buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={uploading}
                  className="px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* File List */}
              {imageFiles.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-xs text-gray-600 mb-2">
                    {imageFiles.length}개 파일 선택됨
                    {/* @ts-ignore - webkitRelativePath exists on File */}
                    {imageFiles[0]?.webkitRelativePath && (
                      <span className="ml-2 text-violet-600">(폴더 구조 유지)</span>
                    )}
                  </p>
                  {imageFiles.map((file, index) => {
                    /* @ts-ignore - webkitRelativePath exists on File */
                    const displayPath = file.webkitRelativePath || file.name;
                    return (
                      <div key={index} className="flex items-center justify-between py-1 text-sm">
                        <span className="truncate flex-1 text-gray-700" title={displayPath}>
                          {displayPath}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                          {!uploading && (
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Annotation File */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              어노테이션 파일 (선택)
            </label>
            <div className="space-y-2">
              <input
                ref={annotationInputRef}
                type="file"
                accept=".json"
                onChange={handleAnnotationFileChange}
                disabled={uploading}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => annotationInputRef.current?.click()}
                disabled={uploading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm text-gray-600"
              >
                {annotationFile ? annotationFile.name : 'COCO/DICE 형식 JSON 파일 선택'}
              </button>
              {annotationFile && !uploading && (
                <button
                  type="button"
                  onClick={() => setAnnotationFile(null)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  제거
                </button>
              )}
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">업로드 중...</span>
                <span className="text-sm text-blue-700">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
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

          {/* Footer - inside form for submit button to work */}
          <div className="pt-4 mt-4 border-t border-gray-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={uploading || imageFiles.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {uploading && (
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <span>{uploading ? '업로드 중...' : '업로드'}</span>
          </button>
          </div>
        </form>
      </div>
    </div>
  );
}
