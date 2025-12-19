/**
 * useBatchOperations Hook
 *
 * Manages batch operations for multiple images in the Canvas component
 * Phase 18.8.2: Extracted from Canvas.tsx (308 lines)
 *
 * Batch operations handled:
 * - No Object: Mark images as having no objects (batch supported)
 * - Delete All Annotations: Delete all annotations from images (batch supported)
 * - Confirm Image: Confirm images as complete (batch supported)
 *
 * @module lib/annotation/hooks/useBatchOperations
 */

import { useCallback } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { toast } from '@/lib/stores/toastStore';
import { confirm } from '@/lib/stores/confirmStore';
import { createAnnotation, deleteAnnotation as deleteAnnotationAPI, getProjectAnnotations } from '@/lib/api/annotations';
import type { AnnotationCreateRequest } from '@/lib/api/annotations';
import { confirmImage } from '@/lib/api/projects';
import type { Annotation } from '@/lib/stores/annotationStore';

/**
 * Parameters for batch operations hook
 */
export interface UseBatchOperationsParams {
  // Current state
  project: any;
  currentImage: any;
  currentTask: string | null;
  annotations: Annotation[];
  images: any[];
  currentIndex: number;
  selectedImageIds: string[];
  isImageLocked: boolean;
  confirmingImage: boolean;

  // State setters
  setConfirmingImage: (confirming: boolean) => void;
  setBatchProgress: (progress: { current: number; total: number } | null) => void;

  // Store actions
  addAnnotation: (annotation: any) => void;
  deleteAnnotation: (id: string) => void;
  clearImageSelection: () => void;
  goToNextImage: () => void;
  setCurrentIndex: (index: number) => void;
}

/**
 * Return type for batch operations hook
 */
export interface UseBatchOperationsReturn {
  /** Mark images as having no objects (batch supported) */
  handleNoObject: () => Promise<void>;
  /** Delete all annotations from images (batch supported) */
  handleDeleteAllAnnotations: () => Promise<void>;
  /** Confirm images as complete (batch supported) */
  handleConfirmImage: () => Promise<void>;
}

/**
 * Custom hook for Canvas batch operations
 *
 * Provides three main batch operations:
 * 1. No Object: Deletes existing annotations and creates a no_object annotation
 * 2. Delete All: Removes all annotations from selected images
 * 3. Confirm Image: Marks images as completed and confirmed
 *
 * All operations support both single-image and batch modes based on selectedImageIds
 */
export function useBatchOperations(params: UseBatchOperationsParams): UseBatchOperationsReturn {
  const {
    project,
    currentImage,
    currentTask,
    annotations,
    images,
    currentIndex,
    selectedImageIds,
    isImageLocked,
    confirmingImage,
    setConfirmingImage,
    setBatchProgress,
    addAnnotation,
    deleteAnnotation,
    clearImageSelection,
    goToNextImage,
    setCurrentIndex,
  } = params;

  const handleNoObject = useCallback(async () => {
    if (!project) return;

    // Determine target images
    const targetImageIds = selectedImageIds.length > 0 ? selectedImageIds : (currentImage ? [currentImage.id] : []);
    if (targetImageIds.length === 0) return;

    const isBatch = targetImageIds.length > 1;

    const processNoObject = async () => {
      try {
        setBatchProgress({ current: 0, total: targetImageIds.length });

        for (let i = 0; i < targetImageIds.length; i++) {
          const imageId = targetImageIds[i];
          setBatchProgress({ current: i + 1, total: targetImageIds.length });

          // Get existing annotations for this image
          const existingAnnotations = await getProjectAnnotations(project.id, imageId);

          // Delete existing annotations
          for (const ann of existingAnnotations) {
            await deleteAnnotationAPI(ann.id);
            // If this is the current image, also remove from store
            if (imageId === currentImage?.id) {
              deleteAnnotation(ann.id);
            }
          }

          // Create no_object annotation with task context
          const annotationData: AnnotationCreateRequest = {
            project_id: project.id,
            image_id: imageId,
            annotation_type: 'no_object',
            geometry: { type: 'no_object' },
            class_id: null,
            class_name: '__background__',
            attributes: { task_type: currentTask },
          };

          const savedAnnotation = await createAnnotation(annotationData);

          // If this is the current image, add to store
          if (imageId === currentImage?.id) {
            addAnnotation({
              id: savedAnnotation.id.toString(),
              projectId: project.id,
              imageId: imageId,
              annotationType: 'no_object',
              classId: null,
              className: '__background__',
              geometry: { type: 'no_object' },
              confidence: savedAnnotation.confidence,
              attributes: savedAnnotation.attributes,
              createdAt: savedAnnotation.created_at ? new Date(savedAnnotation.created_at) : undefined,
              updatedAt: savedAnnotation.updated_at ? new Date(savedAnnotation.updated_at) : undefined,
            });
          }

          // Update image status
          useAnnotationStore.setState((state) => {
            const updatedImages = state.images.map(img =>
              img.id === imageId
                ? {
                    ...img,
                    annotation_count: 1,
                    status: 'in-progress',
                    has_no_object: true,
                    is_confirmed: false,  // Not confirmed yet, just assigned
                  }
                : img
            );
            // Also update currentImage if it's the same image
            const updatedCurrentImage = state.currentImage?.id === imageId
              ? updatedImages.find(img => img.id === imageId) || state.currentImage
              : state.currentImage;
            return { images: updatedImages, currentImage: updatedCurrentImage };
          });
        }

        setBatchProgress(null);
        // Keep multi-selection after batch operation
        toast.success(`${targetImageIds.length}개 이미지를 No Object로 처리했습니다.`, 3000);
      } catch (err) {
        console.error('Failed to create no_object annotation:', err);
        setBatchProgress(null);
        toast.error('No Object 처리에 실패했습니다.');
      }
    };

    // Show confirm dialog
    const message = isBatch
      ? `선택한 ${targetImageIds.length}개 이미지를 No Object로 처리합니까? 기존 라벨은 삭제됩니다.`
      : annotations.length > 0
        ? `기존 ${annotations.length}개의 라벨이 삭제됩니다. 계속하시겠습니까?`
        : '이 이미지를 No Object로 처리하시겠습니까?';

    confirm({
      title: 'No Object 설정',
      message,
      confirmText: '확인',
      cancelText: '취소',
      onConfirm: processNoObject,
    });
  }, [currentImage, project, addAnnotation, annotations, deleteAnnotation, selectedImageIds, setBatchProgress, currentTask]);

  // Handle delete all annotations (supports batch operation)
  const handleDeleteAllAnnotations = useCallback(async () => {
    if (!project) return;

    // Determine target images
    const targetImageIds = selectedImageIds.length > 0 ? selectedImageIds : (currentImage ? [currentImage.id] : []);
    if (targetImageIds.length === 0) return;

    // For single image without selection, check if there are annotations
    if (targetImageIds.length === 1 && targetImageIds[0] === currentImage?.id && annotations.length === 0) {
      return;
    }

    // Phase 8.5.2: Block deletion without lock for single current image
    const isSingleCurrentImage = targetImageIds.length === 1 && targetImageIds[0] === currentImage?.id;
    if (isSingleCurrentImage && !isImageLocked) {
      // Lock overlay is already visible, no need for toast
      return;
    }

    const isBatch = targetImageIds.length > 1;

    const processDelete = async () => {
      try {
        setBatchProgress({ current: 0, total: targetImageIds.length });
        let totalDeleted = 0;

        for (let i = 0; i < targetImageIds.length; i++) {
          const imageId = targetImageIds[i];
          setBatchProgress({ current: i + 1, total: targetImageIds.length });

          // Get existing annotations for this image
          const existingAnnotations = await getProjectAnnotations(project.id, imageId);

          // Delete all annotations
          for (const ann of existingAnnotations) {
            await deleteAnnotationAPI(ann.id);
            // If this is the current image, also remove from store
            if (imageId === currentImage?.id) {
              deleteAnnotation(ann.id);
            }
            totalDeleted++;
          }

          // Update image status
          useAnnotationStore.setState((state) => {
            const updatedImages = state.images.map(img =>
              img.id === imageId
                ? {
                    ...img,
                    annotation_count: 0,
                    status: 'not-started',
                    has_no_object: false,
                    is_confirmed: false,  // Reset confirmation on delete
                  }
                : img
            );
            // Also update currentImage if it's the same image
            const updatedCurrentImage = state.currentImage?.id === imageId
              ? updatedImages.find(img => img.id === imageId) || state.currentImage
              : state.currentImage;
            return { images: updatedImages, currentImage: updatedCurrentImage };
          });
        }

        setBatchProgress(null);
        // Keep multi-selection after batch operation
        toast.success(`${targetImageIds.length}개 이미지에서 ${totalDeleted}개 라벨을 삭제했습니다.`, 3000);
      } catch (err) {
        console.error('Failed to delete annotations:', err);
        setBatchProgress(null);
        toast.error('삭제에 실패했습니다.');
      }
    };

    // Show confirm dialog
    const message = isBatch
      ? `선택한 ${targetImageIds.length}개 이미지의 모든 라벨을 삭제합니까?`
      : `현재 이미지의 ${annotations.length}개 라벨을 모두 삭제하시겠습니까?`;

    confirm({
      title: '모든 라벨 삭제',
      message,
      confirmText: '삭제',
      cancelText: '취소',
      onConfirm: processDelete,
    });
  }, [project, currentImage, annotations, deleteAnnotation, selectedImageIds, isImageLocked, setBatchProgress]);

  const handleConfirmImage = useCallback(async () => {
    if (!project) return;
    if (confirmingImage) return;

    // Determine target images
    const targetImageIds = selectedImageIds.length > 0 ? selectedImageIds : (currentImage ? [currentImage.id] : []);
    if (targetImageIds.length === 0) return;

    const isBatch = targetImageIds.length > 1;

    const processConfirm = async () => {
      setConfirmingImage(true);
      try {
        if (isBatch) {
          // Batch confirm
          setBatchProgress({ current: 0, total: targetImageIds.length });

          for (let i = 0; i < targetImageIds.length; i++) {
            const imageId = targetImageIds[i];
            setBatchProgress({ current: i + 1, total: targetImageIds.length });

            // Call API to confirm image
            await confirmImage(project.id, imageId, currentTask || undefined);
          }

          // Update all confirmed images status
          useAnnotationStore.setState((state) => ({
            images: state.images.map(img =>
              targetImageIds.includes(img.id)
                ? {
                    ...img,
                    is_confirmed: true,
                    status: 'completed',
                    confirmed_at: new Date().toISOString(),
                  }
                : img
            )
          }));

          // If current image was in selection, reload its annotations from server
          if (currentImage && targetImageIds.includes(currentImage.id)) {
            const { getProjectAnnotations } = await import('@/lib/api/annotations');
            const freshAnnotations = await getProjectAnnotations(
              project.id,
              currentImage.id
            );
            useAnnotationStore.setState({ annotations: freshAnnotations });
          }

          setBatchProgress(null);
          clearImageSelection();
          toast.success(`${targetImageIds.length}개 이미지를 확정했습니다.`, 3000);
        } else {
        // Single image confirm (existing logic)
        if (!currentImage) return;

        await confirmImage(project.id, currentImage.id, currentTask || undefined);

        // Reload annotations from server to get updated version and confirm info
        const { getProjectAnnotations } = await import('@/lib/api/annotations');
        const freshAnnotations = await getProjectAnnotations(
          project.id,
          currentImage.id
        );

        useAnnotationStore.setState({ annotations: freshAnnotations });

        // Update current image status
        const updatedImages = images.map(img =>
          img.id === currentImage.id
            ? {
                ...img,
                is_confirmed: true,
                status: 'completed',
                confirmed_at: new Date().toISOString(),
              }
            : img
        );

        useAnnotationStore.setState({ images: updatedImages });

        // Auto-navigate to next incomplete image (in-progress or not-started)
        const nextIncompleteIndex = updatedImages.findIndex((img, idx) => {
          if (idx <= currentIndex) return false;
          const status = (img as any).status || 'not-started';
          return status === 'in-progress' || status === 'not-started';
        });

        if (nextIncompleteIndex !== -1) {
          setCurrentIndex(nextIncompleteIndex);
        } else {
          goToNextImage();
        }
        }
      } catch (err) {
        console.error('Failed to confirm image:', err);
        setBatchProgress(null);
        toast.error('확정에 실패했습니다.');
      } finally {
        setConfirmingImage(false);
      }
    };

    // Show confirm dialog for batch operations
    if (isBatch) {
      confirm({
        title: '이미지 확정',
        message: `선택한 ${targetImageIds.length}개 이미지를 확정하시겠습니까?`,
        confirmText: '확정',
        cancelText: '취소',
        onConfirm: processConfirm,
      });
    } else {
      processConfirm();
    }
  }, [currentImage, project, confirmingImage, images, currentIndex, goToNextImage, setCurrentIndex, selectedImageIds, clearImageSelection, currentTask, setConfirmingImage, setBatchProgress]);

  return {
    handleNoObject,
    handleDeleteAllAnnotations,
    handleConfirmImage,
  };
}
