/**
 * Right Panel Component
 *
 * Contains: Current Annotation Details, Annotations List, Image Metadata
 */

'use client';

import { useAnnotationStore } from '@/lib/stores/annotationStore';
import {
  deleteAnnotation as deleteAnnotationAPI,
  confirmAnnotation,
  unconfirmAnnotation,
  getProjectAnnotations,
} from '@/lib/api/annotations';
import { useState, useEffect } from 'react';
import AddClassModal from './AddClassModal';
import AnnotationHistory from './AnnotationHistory';
import { getProjectById } from '@/lib/api/projects';
import { reorderClasses } from '@/lib/api/classes';
import Minimap from './Minimap';

export default function RightPanel() {
  const {
    panels,
    annotations,
    selectedAnnotationId,
    selectAnnotation,
    deleteAnnotation,
    toggleRightPanel,
    project,
    toggleAnnotationVisibility,
    toggleAllAnnotationsVisibility,
    isAnnotationVisible,
    showAllAnnotations,
    images,
    getCurrentClasses, // Phase 2.9: Get task-specific classes
    currentTask,
    // Phase 2.10.3: Minimap support
    canvasRef,
    imageRef,
    canvas: canvasState,
    setPan,
    showMinimap,
    currentImage,
  } = useAnnotationStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [classStats, setClassStats] = useState<Record<string, { bboxCount: number; imageCount: number }>>({});
  const [isReordering, setIsReordering] = useState(false);
  const [focusedClassId, setFocusedClassId] = useState<string | null>(null);

  // Phase 2.10.3: Minimap viewport change handler
  const handleMinimapViewportChange = (x: number, y: number) => {
    setPan({ x, y });
  };

  // Get sorted classes by order
  const getSortedClasses = () => {
    const currentClasses = getCurrentClasses();
    return Object.entries(currentClasses).sort(
      (a, b) => (a[1].order || 0) - (b[1].order || 0)
    );
  };

  // Handle class reordering
  const handleMoveClass = async (classId: string, direction: 'up' | 'down') => {
    if (!project || isReordering) return;

    const sortedClasses = getSortedClasses();
    const currentIndex = sortedClasses.findIndex(([id]) => id === classId);

    if (currentIndex === -1) return;
    if (direction === 'up' && currentIndex === 0) return;
    if (direction === 'down' && currentIndex === sortedClasses.length - 1) return;

    setIsReordering(true);
    // Keep focus on the class being moved
    setFocusedClassId(classId);

    try {
      // Create new order
      const newOrder = sortedClasses.map(([id]) => id);
      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

      // Swap positions
      [newOrder[currentIndex], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[currentIndex]];

      // Call API with current task type
      await reorderClasses(project.id, newOrder, currentTask || undefined);

      // Refresh project data
      await handleClassAdded();
    } catch (err) {
      console.error('Failed to reorder classes:', err);
    } finally {
      setIsReordering(false);
    }
  };

  // Phase 2.9: Map annotation_type to task type for filtering
  const getTaskTypeForAnnotation = (annotationType: string): string => {
    const mapping: Record<string, string> = {
      'bbox': 'detection',
      'rotated_bbox': 'detection',
      'polygon': 'segmentation',
      'classification': 'classification',
      'keypoint': 'keypoint',
      'line': 'line',
    };
    return mapping[annotationType] || annotationType;
  };

  // Load class statistics from annotations (filtered by current task)
  useEffect(() => {
    if (!project?.id) return;

    const loadClassStats = async () => {
      try {
        const allAnnotations = await getProjectAnnotations(project.id);

        // Phase 2.9: Filter annotations by current task
        const filteredAnnotations = allAnnotations.filter((ann: any) => {
          const annTaskType = getTaskTypeForAnnotation(ann.annotation_type);
          return !currentTask || annTaskType === currentTask;
        });

        // Calculate bbox count and unique image count per class
        const stats: Record<string, { bboxCount: number; imageIds: Set<string> }> = {};

        filteredAnnotations.forEach((ann: any) => {
          const classId = ann.class_id || ann.classId;
          if (!classId) return;

          if (!stats[classId]) {
            stats[classId] = { bboxCount: 0, imageIds: new Set() };
          }

          stats[classId].bboxCount++;
          const imageId = ann.image_id || ann.imageId;
          if (imageId) {
            stats[classId].imageIds.add(imageId);
          }
        });

        // Convert to final format
        const finalStats: Record<string, { bboxCount: number; imageCount: number }> = {};
        Object.entries(stats).forEach(([classId, data]) => {
          finalStats[classId] = {
            bboxCount: data.bboxCount,
            imageCount: data.imageIds.size,
          };
        });

        setClassStats(finalStats);
      } catch (error) {
        console.error('Failed to load class statistics:', error);
      }
    };

    loadClassStats();
  }, [project?.id, annotations, currentTask]); // Phase 2.9: Reload when task changes

  // Refresh project data after adding a class
  const handleClassAdded = async () => {
    if (!project) return;
    try {
      const updatedProject = await getProjectById(project.id);
      // Update project in store with converted format
      useAnnotationStore.setState({
        project: {
          id: updatedProject.id,
          name: updatedProject.name,
          datasetId: updatedProject.dataset_id,
          taskTypes: updatedProject.task_types,
          taskClasses: updatedProject.task_classes || {}, // Phase 2.9
          classes: updatedProject.classes, // Legacy
          taskConfig: updatedProject.task_config,
        }
      });
    } catch (error) {
      console.error('Failed to refresh project:', error);
    }
  };

  const handleConfirmToggle = async (annotationId: string, currentState: string) => {
    setConfirmingId(annotationId);
    try {
      const isConfirmed = currentState === 'confirmed';
      console.log('[handleConfirmToggle] Starting:', { annotationId, currentState, isConfirmed });

      let response;
      if (isConfirmed) {
        // Unconfirm: confirmed → draft
        response = await unconfirmAnnotation(annotationId);
        console.log('[handleConfirmToggle] Unconfirm response:', response);
      } else {
        // Confirm: draft → confirmed
        response = await confirmAnnotation(annotationId);
        console.log('[handleConfirmToggle] Confirm response:', response);
      }

      // Update local state with response data
      const updatedAnnotations = annotations.map(ann =>
        ann.id === annotationId
          ? {
              ...ann,
              annotation_state: response.annotation_state,
              confirmed_at: response.confirmed_at,
              confirmed_by: response.confirmed_by,
              confirmed_by_name: response.confirmed_by_name,
            }
          : ann
      );

      console.log('[handleConfirmToggle] Updated annotation:', updatedAnnotations.find(a => a.id === annotationId));

      // Update store
      useAnnotationStore.setState({ annotations: updatedAnnotations });

      // Phase 2.7: Update image status in the image list
      // After confirm/unconfirm, recalculate the current image's status based on updated annotations
      if (currentImage?.id) {
        // Check if all annotations for this image are confirmed
        const imageAnnotations = updatedAnnotations.filter(ann => ann.imageId === currentImage.id);
        const allConfirmed = imageAnnotations.length > 0 && imageAnnotations.every(ann => (ann as any).annotation_state === 'confirmed');
        const imageStatus = allConfirmed ? 'completed' : (imageAnnotations.length > 0 ? 'in-progress' : 'not-started');

        console.log('[handleConfirmToggle] Calculated image status:', {
          imageId: currentImage.id,
          totalAnnotations: imageAnnotations.length,
          allConfirmed,
          imageStatus,
        });

        // Update the image in the store
        useAnnotationStore.setState((state) => ({
          images: state.images.map(img =>
            img.id === currentImage.id
              ? {
                  ...img,
                  is_confirmed: allConfirmed,
                  status: imageStatus,
                  annotation_count: imageAnnotations.length,
                }
              : img
          )
        }));
      }

      // Show success toast
      const { toast } = await import('@/lib/stores/toastStore');
      toast.success(isConfirmed ? 'Annotation unconfirmed' : 'Annotation confirmed');

    } catch (err: any) {
      console.error('[handleConfirmToggle] ERROR:', err);
      const { toast } = await import('@/lib/stores/toastStore');
      toast.error(`Failed to ${currentState === 'confirmed' ? 'unconfirm' : 'confirm'} annotation: ${err.message || 'Unknown error'}`);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDelete = async (annotationId: string) => {
    if (!confirm('Delete this annotation?')) return;

    setDeletingId(annotationId);
    try {
      // Delete from backend
      await deleteAnnotationAPI(annotationId);
      // Delete from store
      deleteAnnotation(annotationId);
    } catch (err) {
      console.error('Failed to delete annotation:', err);
      // TODO: Show error toast
    } finally {
      setDeletingId(null);
    }
  };

  if (!panels.right) {
    return (
      <button
        onClick={toggleRightPanel}
        className="w-8 h-full bg-gray-100 dark:bg-gray-800 border-l border-gray-300 dark:border-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group"
        title="Show Right Panel (])"
      >
        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    );
  }

  return (
    <div className="w-[320px] bg-gray-100 dark:bg-gray-800 border-l border-gray-300 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out">
      {/* Header */}
      <div className="p-4 border-b border-gray-300 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Annotations ({annotations.length})</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleAllAnnotationsVisibility}
            className={`p-1 transition-colors ${
              showAllAnnotations
                ? 'text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300'
                : 'text-gray-400 hover:text-gray-600'
            }`}
            title={showAllAnnotations ? 'Hide all annotations' : 'Show all annotations'}
          >
            {showAllAnnotations ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            )}
          </button>
          <button
            onClick={toggleRightPanel}
            className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            title="Hide Right Panel (])"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Annotations List */}
      <div className="overflow-y-auto p-4 border-b border-gray-300 dark:border-gray-700">
        {annotations.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-500">
            <p className="text-sm">No annotations yet</p>
            <p className="text-xs mt-2">
              {currentTask === 'classification'
                ? 'Select a class above to classify this image'
                : 'Draw a bbox to start labeling'}
            </p>
          </div>
        )}

        {annotations.map((ann, index) => {
          // Support both camelCase and snake_case
          const classId = (ann as any).classId || (ann as any).class_id;
          const className = (ann as any).className || (ann as any).class_name;
          // Phase 2.9: Use getCurrentClasses() for task-specific classes
          const currentClasses = getCurrentClasses();
          const classInfo = classId ? currentClasses[classId] : null;
          const color = classInfo?.color || '#6b7280';
          const isVisible = isAnnotationVisible(ann.id);

          // Phase 2.7: Get annotation state
          const annotationState = (ann as any).annotation_state || (ann as any).annotationState || 'draft';
          const isConfirmed = annotationState === 'confirmed';

          // Debug log
          if (ann.id === 2004) {
            console.log('[RightPanel] Annotation 2004:', {
              annotation_state: (ann as any).annotation_state,
              annotationState: (ann as any).annotationState,
              computed_annotationState: annotationState,
              isConfirmed,
              ann
            });
          }

          return (
            <div
              key={ann.id}
              className={`p-2 rounded-lg mb-1.5 cursor-pointer transition-all ${
                ann.id === selectedAnnotationId
                  ? 'bg-violet-500/20 border border-violet-500'
                  : 'bg-gray-200 dark:bg-gray-700 border border-transparent hover:border-gray-400 dark:hover:border-gray-600'
              }`}
              onClick={() => selectAnnotation(ann.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-300 truncate">
                    {className || 'Unlabeled'}
                  </span>
                  {isConfirmed && (
                    <span className="text-green-500 text-[10px]" title="Confirmed">✓</span>
                  )}
                  {!isConfirmed && (
                    <span className="text-gray-400 dark:text-gray-500 text-[10px]" title="Draft">(draft)</span>
                  )}
                  {ann.geometry.type === 'bbox' && (
                    <span className="text-[10px] text-gray-600 dark:text-gray-500">
                      {Math.round(ann.geometry.bbox[2])}×{Math.round(ann.geometry.bbox[3])}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* Phase 2.7: Confirm/Unconfirm button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfirmToggle(ann.id, annotationState);
                    }}
                    disabled={confirmingId === ann.id}
                    className={`p-1 transition-colors flex-shrink-0 ${
                      isConfirmed
                        ? 'text-green-500 hover:text-green-600 dark:text-green-400 dark:hover:text-green-300'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={isConfirmed ? 'Unconfirm annotation' : 'Confirm annotation'}
                  >
                    {confirmingId === ann.id ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : isConfirmed ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="2" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAnnotationVisibility(ann.id);
                    }}
                    className={`p-1 transition-colors flex-shrink-0 ${
                      isVisible
                        ? 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                    title={isVisible ? 'Hide annotation' : 'Show annotation'}
                  >
                    {isVisible ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(ann.id);
                    }}
                    disabled={deletingId === ann.id}
                    className="p-1 text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    title="Delete annotation"
                  >
                    {deletingId === ann.id ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Class List Section */}
      <div
        className="flex-1 overflow-y-auto p-3"
        onClick={(e) => {
          // Clear focus when clicking on empty space (not on a class item)
          if (e.target === e.currentTarget) {
            setFocusedClassId(null);
          }
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Classes</h4>
          <button
            onClick={() => setIsAddClassModalOpen(true)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Add new class"
          >
            <svg className="w-3 h-3 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {project && annotations.length > 0 && (() => {
          // Get unique class IDs in current image
          const currentImageClasses = new Map<string, number>();
          annotations.forEach(ann => {
            const classId = (ann as any).classId || (ann as any).class_id;
            if (classId) {
              currentImageClasses.set(classId, (currentImageClasses.get(classId) || 0) + 1);
            }
          });

          if (currentImageClasses.size > 0) {
            return (
              <>
                <div className="mb-2">
                  <div className="text-[9px] text-gray-600 dark:text-gray-500 mb-1 uppercase tracking-wider">Current Image</div>
                  {Array.from(currentImageClasses.entries()).map(([classId, count]) => {
                    // Phase 2.9: Use getCurrentClasses() for task-specific classes
                    const currentClasses = getCurrentClasses();
                    const classInfo = currentClasses[classId];
                    if (!classInfo) return null;
                    return (
                      <div
                        key={classId}
                        className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer mb-0.5 bg-violet-500/10"
                      >
                        <div
                          className="w-3 h-3 rounded flex-shrink-0"
                          style={{ backgroundColor: classInfo.color }}
                        ></div>
                        <span className="text-[11px] text-gray-900 dark:text-gray-300 flex-1 truncate" title={classInfo.name}>
                          {classInfo.name}
                        </span>
                        <span className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">{count}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-gray-300 dark:border-gray-700 my-2"></div>
              </>
            );
          }
          return null;
        })()}

        {/* Phase 2.9: Display only classes for current task (sorted by order) */}
        {project && (() => {
          const sortedClasses = getSortedClasses();
          return sortedClasses.map(([classId, classInfo], index) => {
            // Get stats from loaded class statistics
            const stats = classStats[classId] || { bboxCount: 0, imageCount: 0 };
            const isFirst = index === 0;
            const isLast = index === sortedClasses.length - 1;
            const isFocused = focusedClassId === classId;

            return (
              <div
                key={classId}
                className={`flex items-center gap-1 px-2 py-1 rounded mb-0.5 group cursor-pointer ${
                  isFocused
                    ? 'bg-violet-100 dark:bg-violet-900/30 ring-1 ring-violet-400'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                onClick={() => setFocusedClassId(classId)}
              >
                {/* Reorder buttons */}
                <div className={`flex flex-col gap-0 transition-opacity ${
                  isFocused ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveClass(classId, 'up'); }}
                    disabled={isFirst || isReordering}
                    className={`p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ${
                      isFirst ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 dark:text-gray-400'
                    }`}
                    title="Move up"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveClass(classId, 'down'); }}
                    disabled={isLast || isReordering}
                    className={`p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 ${
                      isLast ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' : 'text-gray-500 dark:text-gray-400'
                    }`}
                    title="Move down"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Order number */}
                <span className="text-[9px] text-gray-400 dark:text-gray-500 w-3 text-center flex-shrink-0">
                  {index}
                </span>

                {/* Color indicator */}
                <div
                  className="w-3 h-3 rounded flex-shrink-0"
                  style={{ backgroundColor: classInfo.color }}
                ></div>

                {/* Class name */}
                <span className="text-[11px] text-gray-900 dark:text-gray-300 flex-1 truncate" title={classInfo.name}>
                  {classInfo.name}
                </span>

                {/* Stats */}
                <div className="flex items-center gap-1.5 text-[10px] text-gray-600 dark:text-gray-500">
                  <span title={`${stats.bboxCount} bounding boxes across ${stats.imageCount} images`}>
                    {stats.bboxCount} ({stats.imageCount})
                  </span>
                </div>
              </div>
            );
          });
        })()}
        {/* Phase 2.9: Check current task classes */}
        {(!project || Object.keys(getCurrentClasses()).length === 0) && (
          <div className="text-[10px] text-gray-600 dark:text-gray-500">
            No classes defined for {currentTask || 'current task'}
          </div>
        )}
      </div>

      {/* Annotation Versions Section */}
      <AnnotationHistory />

      {/* Phase 2.10.3: Minimap */}
      {showMinimap && canvasRef && imageRef && currentImage && (
        <div className="border-t border-gray-300 dark:border-gray-700 p-3">
          <Minimap
            canvasRef={canvasRef}
            imageRef={imageRef}
            annotations={annotations}
            viewport={{
              x: canvasState.pan.x,
              y: canvasState.pan.y,
              scale: canvasState.zoom,
            }}
            onViewportChange={handleMinimapViewportChange}
            width={280}
            height={210}
          />
        </div>
      )}

      {/* Add Class Modal */}
      {project && (
        <AddClassModal
          isOpen={isAddClassModalOpen}
          onClose={() => setIsAddClassModalOpen(false)}
          projectId={project.id}
          onClassAdded={handleClassAdded}
          currentTask={currentTask}
        />
      )}
    </div>
  );
}
