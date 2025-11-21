'use client';

/**
 * Step 3: Annotation File Upload (Optional)
 *
 * - Select annotation file (COCO/DICE format)
 * - Parse and show summary
 * - Skip option available
 */

import { useState, useRef } from 'react';

interface Step3AnnotationProps {
  onNext: (file: File | null) => void;
  onSkip: () => void;
  onBack: () => void;
}

export default function Step3Annotation({
  onNext,
  onSkip,
  onBack,
}: Step3AnnotationProps) {
  const [annotationFile, setAnnotationFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAnnotationFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    setAnnotationFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleNext = () => {
    onNext(annotationFile);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          📝 어노테이션 파일 업로드 (선택 사항)
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          이미지와 함께 어노테이션을 업로드할 수 있습니다. COCO 또는 DICE 형식의 JSON 파일을 지원합니다.
        </p>

        {/* File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        {!annotationFile ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-violet-500 hover:bg-violet-50 transition-colors"
          >
            <div className="flex flex-col items-center justify-center text-gray-600">
              <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium">JSON 파일 선택</span>
              <span className="text-xs text-gray-500 mt-1">COCO/DICE 형식</span>
            </div>
          </button>
        ) : (
          <div className="border border-green-200 rounded-lg p-4 bg-green-50">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900">{annotationFile.name}</p>
                </div>
                <p className="text-xs text-gray-600">
                  크기: {formatFileSize(annotationFile.size)}
                </p>
              </div>
              <button
                onClick={handleRemove}
                className="text-red-600 hover:text-red-800"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-white rounded border border-green-200 p-3">
              <p className="text-xs font-medium text-gray-700 mb-2">어노테이션 정보</p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• 형식: 업로드 시 자동 감지 (COCO/DICE)</li>
                <li>• 이미지와 파일명이 일치해야 합니다</li>
                <li>• 중복 파일을 스킵한 경우, 해당 어노테이션도 무시됩니다</li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-xs text-blue-800">
              <p className="font-medium mb-1">어노테이션 파일 형식</p>
              <p>COCO 또는 DICE 형식의 JSON 파일을 지원합니다. 파일 내 이미지 경로가 업로드할 이미지와 일치하는지 확인하세요.</p>
            </div>
          </div>
        </div>
      </div>

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
            onClick={onSkip}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            건너뛰기
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
          >
            다음: 업로드 →
          </button>
        </div>
      </div>
    </div>
  );
}
