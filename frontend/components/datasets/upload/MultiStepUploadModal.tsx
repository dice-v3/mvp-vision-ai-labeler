'use client';

/**
 * Multi-Step Upload Modal
 *
 * 4-step upload process:
 * Step 1: File selection & storage location
 * Step 2: Validation & conflict resolution
 * Step 3: Annotation file (optional)
 * Step 4: Upload execution
 */

import { useState } from 'react';
import Step1FileSelection from './Step1FileSelection';
import Step2Validation from './Step2Validation';
import Step3Annotation from './Step3Annotation';
import Step4Upload from './Step4Upload';

interface MultiStepUploadModalProps {
  datasetId: string;
  datasetName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export type UploadStep = 1 | 2 | 3 | 4;

export interface FileWithPath extends File {
  webkitRelativePath?: string;
}

export interface FileMappingInfo {
  file: File;
  originalPath: string;  // webkitRelativePath or file.name
  finalPath: string;     // After applying target folder and stripping
  size: number;
}

export default function MultiStepUploadModal({
  datasetId,
  datasetName,
  isOpen,
  onClose,
  onSuccess,
}: MultiStepUploadModalProps) {
  const [currentStep, setCurrentStep] = useState<UploadStep>(1);

  // Step 1 state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [fileMappings, setFileMappings] = useState<FileMappingInfo[]>([]);

  // Step 2 state
  const [duplicateResolutions, setDuplicateResolutions] = useState<Record<string, 'overwrite' | 'skip' | 'rename'>>({});

  // Step 3 state
  const [annotationFile, setAnnotationFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    // Reset all state
    setCurrentStep(1);
    setSelectedFiles([]);
    setTargetFolder('');
    setFileMappings([]);
    setDuplicateResolutions({});
    setAnnotationFile(null);
    onClose();
  };

  const handleStep1Complete = (
    files: File[],
    folder: string,
    mappings: FileMappingInfo[]
  ) => {
    setSelectedFiles(files);
    setTargetFolder(folder);
    setFileMappings(mappings);
    setCurrentStep(2);
  };

  const handleStep2Complete = (resolutions: Record<string, 'overwrite' | 'skip' | 'rename'>) => {
    setDuplicateResolutions(resolutions);
    setCurrentStep(3);
  };

  const handleStep3Complete = (file: File | null) => {
    setAnnotationFile(file);
    setCurrentStep(4);
  };

  const handleStep3Skip = () => {
    setAnnotationFile(null);
    setCurrentStep(4);
  };

  const handleUploadComplete = () => {
    onSuccess();
    handleClose();
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as UploadStep);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return '파일 선택 & 저장 위치';
      case 2: return '검증 & 충돌 해결';
      case 3: return '어노테이션 파일';
      case 4: return '업로드 실행';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{getStepTitle()}</h2>
              <p className="text-sm text-gray-500 mt-1">{datasetName}</p>
            </div>
            <button
              onClick={handleClose}
              disabled={currentStep === 4}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center space-x-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    step < currentStep
                      ? 'bg-green-500 text-white'
                      : step === currentStep
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step < currentStep ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                {step < 4 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 1 && (
            <Step1FileSelection
              datasetId={datasetId}
              onNext={handleStep1Complete}
              onCancel={handleClose}
            />
          )}

          {currentStep === 2 && (
            <Step2Validation
              datasetId={datasetId}
              fileMappings={fileMappings}
              targetFolder={targetFolder}
              onNext={handleStep2Complete}
              onBack={handleBack}
              onCancel={handleClose}
            />
          )}

          {currentStep === 3 && (
            <Step3Annotation
              onNext={handleStep3Complete}
              onSkip={handleStep3Skip}
              onBack={handleBack}
            />
          )}

          {currentStep === 4 && (
            <Step4Upload
              datasetId={datasetId}
              fileMappings={fileMappings}
              targetFolder={targetFolder}
              duplicateResolutions={duplicateResolutions}
              annotationFile={annotationFile}
              onComplete={handleUploadComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
}
