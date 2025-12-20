/**
 * Canvas Component
 *
 * Main image viewer with zoom/pan controls and annotation rendering
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { useShallow } from 'zustand/react/shallow';
import ClassSelectorModal from './ClassSelectorModal';
import { createAnnotation, updateAnnotation, deleteAnnotation as deleteAnnotationAPI, getProjectAnnotations } from '@/lib/api/annotations';
import type { AnnotationCreateRequest, AnnotationUpdateRequest } from '@/lib/api/annotations';
import { confirmImage, getProjectImageStatuses } from '@/lib/api/projects';
import { ToolRegistry, bboxTool, polygonTool, polylineTool, circleTool, circle3pTool } from '@/lib/annotation';
import type { CanvasRenderContext } from '@/lib/annotation';
import { Circle3pTool } from '@/lib/annotation/tools/Circle3pTool';
import { toast } from '@/lib/stores/toastStore';
import { confirm } from '@/lib/stores/confirmStore';
import { ArrowUturnLeftIcon, ArrowUturnRightIcon } from '@heroicons/react/24/outline';
import Magnifier from './Magnifier';
// Phase 8.5.2: Image Locks
import { imageLockAPI } from '@/lib/api/image-locks';
import type { LockAcquireResponse } from '@/lib/api/image-locks';
// Phase 8.5.1: Conflict Dialog
import { AnnotationConflictDialog } from '../annotations/AnnotationConflictDialog';
import type { ConflictInfo } from '../annotations/AnnotationConflictDialog';
// Phase 11: Diff Mode Components
import DiffToolbar from './DiffToolbar';
import DiffActions from './DiffActions';
import DiffViewModeSelector from './DiffViewModeSelector';
// Phase 18.2: Utility Functions
import {
  drawGrid,
  drawCrosshair,
  drawNoObjectBadge,
  snapshotToAnnotation,
  getHandleAtPosition,
  pointInBbox,
  getCursorForHandle,
  getPointOnEdge,
} from '@/lib/annotation/utils';
// Phase 18.3: Custom Hooks
import {
  useCanvasState,
  useImageManagement,
  useToolState,
  useCanvasTransform,
  useAnnotationSync,
  useMagnifier,
  useMouseHandlers,
  useToolRenderer,
  useCanvasRenderer,
  useCanvasKeyboardShortcuts,
  useBatchOperations,
} from '@/lib/annotation/hooks';
// Phase 18.4: Overlay Components
import { LockOverlay } from './overlays/LockOverlay';
// Phase 18.8.3: Canvas UI Components
import { ToolSelector, ZoomControls, NavigationButtons, CanvasActionBar } from './canvas-ui';
// Phase 19: VLM Text Labeling
import { TextLabelDialog } from './text-labels/TextLabelDialog';
import { useTextLabelStore } from '@/lib/stores/textLabelStore';

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Phase 18.7: Optimized Zustand selectors - subscribe only to needed values
  const currentImage = useAnnotationStore(state => state.currentImage);
  const annotations = useAnnotationStore(state => state.annotations);
  const selectedAnnotationId = useAnnotationStore(state => state.selectedAnnotationId);
  const selectAnnotation = useAnnotationStore(state => state.selectAnnotation);
  const canvasState = useAnnotationStore(useShallow(state => state.canvas));
  const tool = useAnnotationStore(state => state.tool);
  const setTool = useAnnotationStore(state => state.setTool);
  const isDrawing = useAnnotationStore(state => state.isDrawing);
  const drawingStart = useAnnotationStore(state => state.drawingStart);
  const preferences = useAnnotationStore(useShallow(state => state.preferences));
  const setZoom = useAnnotationStore(state => state.setZoom);
  const setPan = useAnnotationStore(state => state.setPan);
  const setCursor = useAnnotationStore(state => state.setCursor);
  const startDrawing = useAnnotationStore(state => state.startDrawing);
  const updateDrawing = useAnnotationStore(state => state.updateDrawing);
  const finishDrawing = useAnnotationStore(state => state.finishDrawing);
  const addAnnotation = useAnnotationStore(state => state.addAnnotation);
  const project = useAnnotationStore(useShallow(state => state.project));
  const isAnnotationVisible = useAnnotationStore(state => state.isAnnotationVisible);
  const currentIndex = useAnnotationStore(state => state.currentIndex);
  const images = useAnnotationStore(state => state.images);
  const goToNextImage = useAnnotationStore(state => state.goToNextImage);
  const goToPrevImage = useAnnotationStore(state => state.goToPrevImage);
  const setCurrentIndex = useAnnotationStore(state => state.setCurrentIndex);
  const currentTask = useAnnotationStore(state => state.currentTask);
  const deleteAnnotation = useAnnotationStore(state => state.deleteAnnotation);
  const updateAnnotationStore = useAnnotationStore(state => state.updateAnnotation);
  const selectedImageIds = useAnnotationStore(state => state.selectedImageIds);
  const clearImageSelection = useAnnotationStore(state => state.clearImageSelection);
  const getCurrentClasses = useAnnotationStore(state => state.getCurrentClasses);
  const selectedVertexIndex = useAnnotationStore(state => state.selectedVertexIndex);
  const selectedBboxHandle = useAnnotationStore(state => state.selectedBboxHandle);
  // Undo/Redo selectors (group together as they're often used together)
  const { undo, redo, canUndo, canRedo } = useAnnotationStore(
    useShallow(state => ({
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo
    }))
  );
  const showMinimap = useAnnotationStore(state => state.showMinimap);
  const diffMode = useAnnotationStore(useShallow(state => state.diffMode));
  const getDiffForCurrentImage = useAnnotationStore(state => state.getDiffForCurrentImage);

  // Phase 19: VLM Text Labeling store
  const { loadTextLabelsForImage, clearTextLabels } = useTextLabelStore();

  // Phase 18.3: Custom Hooks for State Management

  // Image loading and locking
  const {
    image,
    imageLoaded,
    isImageLocked,
    lockedByUser,
    showLockedDialog,
    setShowLockedDialog,
    acquireLock,
    releaseLock,
  } = useImageManagement({
    currentImage,
    project,
    imageRef,
  });

  // Canvas UI state
  const {
    showClassSelector,
    setShowClassSelector,
    canvasCursor,
    setCanvasCursor,
    cursorPos,
    setCursorPos,
    batchProgress,
    setBatchProgress,
  } = useCanvasState();

  // Tool-specific state
  const {
    // Bbox
    pendingBbox,
    setPendingBbox,
    isResizing,
    setIsResizing,
    resizeHandle,
    setResizeHandle,
    resizeStart,
    setResizeStart,
    // Polygon
    polygonVertices,
    setPolygonVertices,
    isDraggingVertex,
    setIsDraggingVertex,
    draggedVertexIndex,
    setDraggedVertexIndex,
    isDraggingPolygon,
    setIsDraggingPolygon,
    polygonDragStart,
    setPolygonDragStart,
    // Polyline
    polylineVertices,
    setPolylineVertices,
    // Circle
    circleCenter,
    setCircleCenter,
    isDraggingCircle,
    setIsDraggingCircle,
    circleDragStart,
    setCircleDragStart,
    isResizingCircle,
    setIsResizingCircle,
    circleResizeStart,
    setCircleResizeStart,
    selectedCircleHandle,
    setSelectedCircleHandle,
    // Circle 3-point
    circle3pPoints,
    setCircle3pPoints,
    // Reset actions
    resetAllToolState,
  } = useToolState();

  // Pan/zoom transform state
  const {
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,
  } = useCanvasTransform();

  // Annotation sync and version conflicts
  const {
    conflictDialogOpen,
    setConflictDialogOpen,
    conflictInfo,
    setConflictInfo,
    pendingAnnotationUpdate,
    setPendingAnnotationUpdate,
    updateAnnotationWithVersionCheck,
  } = useAnnotationSync();

  // Magnifier state
  const {
    manualMagnifierActive,
    setManualMagnifierActive,
    magnifierForceOff,
    setMagnifierForceOff,
    magnification,
    setMagnification,
    shouldShowMagnifier,
    isDrawingTool,
  } = useMagnifier({
    preferences,
    currentTool: tool,
  });

  // Phase 18.4: Tool preview rendering
  const {
    drawBboxPreview,
    drawPolygonPreview,
    drawPolylinePreview,
    drawCirclePreview,
    drawCircle3pPreview,
  } = useToolRenderer({
    canvasRef,
    canvasState,
    preferences,
    drawingStart,
    polygonVertices,
    polylineVertices,
    circleCenter,
    circle3pPoints,
  });

  // Phase 18.4: Main canvas rendering
  useCanvasRenderer({
    canvasRef,
    containerRef,
    image,
    imageLoaded,
    canvasState,
    annotations,
    selectedAnnotationId,
    selectedVertexIndex,
    selectedBboxHandle,
    selectedCircleHandle,
    preferences,
    project,
    tool,
    diffMode,
    isDrawing,
    drawingStart,
    polygonVertices,
    polylineVertices,
    circleCenter,
    circle3pPoints,
    isAnnotationVisible,
    getCurrentClasses,
    getDiffForCurrentImage,
    drawBboxPreview,
    drawPolygonPreview,
    drawPolylinePreview,
    drawCirclePreview,
    drawCircle3pPreview,
  });

  // Local state not yet extracted to hooks
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingImage, setConfirmingImage] = useState(false);

  // Phase 2.10.3: Store canvas refs for Minimap in RightPanel
  useEffect(() => {
    useAnnotationStore.setState({ canvasRef, imageRef });
  }, []);

  // Phase 18.3: Magnifier reset and shouldShowMagnifier now in useMagnifier hook

  // Helper to set selectedVertexIndex in store
  const setSelectedVertexIndex = (index: number | null) => {
    useAnnotationStore.setState({ selectedVertexIndex: index });
  };

  // Helper to set selectedBboxHandle in store
  const setSelectedBboxHandle = (handle: string | null) => {
    useAnnotationStore.setState({ selectedBboxHandle: handle });
  };

  // Phase 2.10: Helper to update annotation with history recording
  const updateAnnotationWithHistory = async (annotationId: string, updateData: AnnotationUpdateRequest) => {
    await updateAnnotation(annotationId, updateData);
    // Update store to trigger history recording
    updateAnnotationStore(annotationId, { geometry: updateData.geometry });
  };

  // Phase 18.3: updateAnnotationWithVersionCheck now in useAnnotationSync hook
  // Wrapper for compatibility with existing code
  const updateAnnotationWithVersionCheckCompat = async (annotationId: string, updateData: AnnotationUpdateRequest) => {
    return updateAnnotationWithVersionCheck(annotationId, updateData, annotations);
  };

  // Phase 2.7: Calculate draft annotation count
  const draftAnnotations = annotations.filter(ann => {
    const state = (ann as any).annotation_state || (ann as any).annotationState || 'draft';
    return state === 'draft';
  });
  const draftCount = draftAnnotations.length;
  const isImageConfirmed = currentImage ? (currentImage as any).is_confirmed : false;

  // Phase 18.2: Helper functions moved to @/lib/annotation/utils
  // - getHandleAtPosition ??geometryHelpers.getHandleAtPosition
  // - isPointInBbox ??geometryHelpers.pointInBbox
  // - getCursorForHandle ??geometryHelpers.getCursorForHandle
  // - getPointOnEdge ??geometryHelpers.getPointOnEdge

  // Update cursor when tool changes
  useEffect(() => {
    if (tool === 'bbox' || tool === 'polygon' || tool === 'polyline' || tool === 'circle' || tool === 'circle3p') {
      setCanvasCursor('crosshair');
    } else {
      setCanvasCursor('default');
    }
  }, [tool]);

  // Phase 18.5: Mouse event handlers
  const { handleMouseDown, handleMouseMove, handleMouseUp } = useMouseHandlers({
    canvasRef,
    image,
    currentImage,
    project,
    annotations,
    selectedAnnotationId,
    canvasState,
    tool,
    currentTask,
    selectedImageIds,
    isImageLocked,
    selectAnnotation,
    setPan,
    setCursor,
    startDrawing,
    updateDrawing,
    finishDrawing,
    addAnnotation,
    deleteAnnotation,
    isAnnotationVisible,
    clearImageSelection,
    getCurrentClasses,
    showClassSelector,
    setShowClassSelector,
    canvasCursor,
    setCanvasCursor,
    setCursorPos,
    setBatchProgress,
    pendingBbox,
    setPendingBbox,
    isResizing,
    setIsResizing,
    setResizeHandle,
    resizeStart,
    setResizeStart,
    polygonVertices,
    setPolygonVertices,
    isDraggingVertex,
    setIsDraggingVertex,
    setDraggedVertexIndex,
    isDraggingPolygon,
    setIsDraggingPolygon,
    polygonDragStart,
    setPolygonDragStart,
    polylineVertices,
    setPolylineVertices,
    circleCenter,
    setCircleCenter,
    isDraggingCircle,
    setIsDraggingCircle,
    circleDragStart,
    setCircleDragStart,
    isResizingCircle,
    setIsResizingCircle,
    circleResizeStart,
    setCircleResizeStart,
    setSelectedCircleHandle,
    circle3pPoints,
    setCircle3pPoints,
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,
    setSelectedVertexIndex,
    setSelectedBboxHandle,
    isDrawing,
    drawingStart,
  });

  // Phase 18.3: Image loading and locking now handled by useImageManagement hook

  // Phase 18.4: Main rendering useEffect moved to useCanvasRenderer hook

  // Phase 18.4: Draw functions moved to useToolRenderer hook
  // (drawBboxPreview, drawPolygonPreview, drawPolylinePreview, drawCirclePreview, drawCircle3pPreview)

  // Phase 18.4: drawAnnotations function moved to useCanvasRenderer hook
  /*
  const drawAnnotations = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (!project || !canvasRef.current) return;

    const canvas = canvasRef.current;

    // Create render context for tools
    const renderCtx: CanvasRenderContext = {
      ctx,
      offsetX,
      offsetY,
      zoom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      showLabels: preferences.showLabels,
      darkMode: preferences.darkMode,
    };

    // Phase 11: Diff mode rendering
    if (diffMode.enabled && diffMode.viewMode === 'overlay') {
      const imageDiff = getDiffForCurrentImage();

      if (imageDiff) {
        // Render diff annotations with color coding
        const currentClasses = getCurrentClasses();

        // 1. Render unchanged annotations (dimmed/gray)
        imageDiff.unchanged?.forEach((snapshot: any, index: number) => {
          const ann = snapshotToAnnotation(snapshot, `unchanged-${index}`);
          const classInfo = ann.class_id ? currentClasses[ann.class_id] : null;
          const color = 'rgba(156, 163, 175, 0.4)'; // gray-400 with opacity

          const tool = ToolRegistry.getTool(ann.geometry.type);
          if (tool) {
            tool.renderAnnotation(renderCtx, ann, false, color, ann.class_name);
          }
        });

        // 2. Render removed annotations (red)
        imageDiff.removed?.forEach((snapshot: any, index: number) => {
          const ann = snapshotToAnnotation(snapshot, `removed-${index}`);
          const color = '#ef4444'; // red-500

          const tool = ToolRegistry.getTool(ann.geometry.type);
          if (tool) {
            tool.renderAnnotation(renderCtx, ann, false, color, ann.class_name);
          }
        });

        // 3. Render added annotations (green)
        imageDiff.added?.forEach((snapshot: any, index: number) => {
          const ann = snapshotToAnnotation(snapshot, `added-${index}`);
          const color = '#22c55e'; // green-500

          const tool = ToolRegistry.getTool(ann.geometry.type);
          if (tool) {
            tool.renderAnnotation(renderCtx, ann, false, color, ann.class_name);
          }
        });

        // 4. Render modified annotations (yellow/orange)
        imageDiff.modified?.forEach((modifiedAnn: any, index: number) => {
          // Render old annotation (dimmed)
          const oldAnn = snapshotToAnnotation(modifiedAnn.old, `modified-old-${index}`);
          const oldColor = 'rgba(251, 146, 60, 0.3)'; // orange-400 with low opacity
          const oldTool = ToolRegistry.getTool(oldAnn.geometry.type);
          if (oldTool) {
            oldTool.renderAnnotation(renderCtx, oldAnn, false, oldColor, oldAnn.class_name);
          }

          // Render new annotation (yellow/orange)
          const newAnn = snapshotToAnnotation(modifiedAnn.new, `modified-new-${index}`);
          const newColor = '#f59e0b'; // amber-500
          const newTool = ToolRegistry.getTool(newAnn.geometry.type);
          if (newTool) {
            newTool.renderAnnotation(renderCtx, newAnn, false, newColor, newAnn.class_name);
          }
        });

        return; // Skip normal rendering
      }
    }

    // Normal rendering (non-diff mode)
    annotations.forEach((ann) => {
      // Skip if annotation is hidden
      if (!isAnnotationVisible(ann.id)) return;

      const isSelected = ann.id === selectedAnnotationId;
      // Support both camelCase and snake_case
      const classId = (ann as any).classId || (ann as any).class_id;
      const className = (ann as any).className || (ann as any).class_name;
      // REFACTORED: Use getCurrentClasses() instead of project.classes
      const currentClasses = getCurrentClasses();
      const classInfo = classId ? currentClasses[classId] : null;
      const color = classInfo?.color || '#9333ea';

      // Handle no_object annotation specially - draw badge
      if (ann.geometry.type === 'no_object' || ann.annotationType === 'no_object') {
        drawNoObjectBadge(ctx, offsetX, offsetY);
        return;
      }

      // Get the appropriate tool for this annotation type
      const tool = ToolRegistry.getTool(ann.geometry.type);

      if (tool) {
        // Use tool to render annotation
        tool.renderAnnotation(renderCtx, ann, isSelected, color, className);

        // Render handles if selected
        if (isSelected) {
          tool.renderHandles(renderCtx, ann, color);
        }
      } else {
        // Fallback for unknown types - use bbox tool for bbox type
        if (ann.geometry.type === 'bbox') {
          bboxTool.renderAnnotation(renderCtx, ann, isSelected, color, className);
          if (isSelected) {
            bboxTool.renderHandles(renderCtx, ann, color);
          }
        }
      }
    });
  };
  */

  // Phase 18.4: All draw preview functions moved to useToolRenderer hook
  /*
  // Draw bbox preview while drawing using Tool system
  const drawBboxPreview = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (!drawingStart || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const currentPos = canvasState.cursor;

    // Create render context for tools
    const renderCtx: CanvasRenderContext = {
      ctx,
      offsetX,
      offsetY,
      zoom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      showLabels: preferences.showLabels,
      darkMode: preferences.darkMode,
    };

    // Create tool state
    const toolState = {
      isDrawing: true,
      drawingStart,
      currentCursor: currentPos,
    };

    // Use bbox tool to render preview
    bboxTool.renderPreview(renderCtx, toolState);
  };

  // Draw polygon preview while drawing
  const drawPolygonPreview = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (polygonVertices.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const currentPos = canvasState.cursor;

    // Create render context for tools
    const renderCtx: CanvasRenderContext = {
      ctx,
      offsetX,
      offsetY,
      zoom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      showLabels: preferences.showLabels,
      darkMode: preferences.darkMode,
    };

    // Create tool state
    const toolState = {
      isDrawing: true,
      drawingStart: null,
      currentCursor: currentPos,
      vertices: polygonVertices,
    };

    // Use polygon tool to render preview
    polygonTool.renderPreview(renderCtx, toolState);
  };

  // Draw polyline preview while drawing
  const drawPolylinePreview = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (polylineVertices.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const currentPos = canvasState.cursor;

    // Create render context for tools
    const renderCtx: CanvasRenderContext = {
      ctx,
      offsetX,
      offsetY,
      zoom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      showLabels: preferences.showLabels,
      darkMode: preferences.darkMode,
    };

    // Create tool state
    const toolState = {
      isDrawing: true,
      drawingStart: null,
      currentCursor: currentPos,
      vertices: polylineVertices,
    };

    // Use polyline tool to render preview
    polylineTool.renderPreview(renderCtx, toolState);
  };

  // Draw circle preview (center-edge mode)
  const drawCirclePreview = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (!circleCenter || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const currentPos = canvasState.cursor;

    // Create render context for tools
    const renderCtx: CanvasRenderContext = {
      ctx,
      offsetX,
      offsetY,
      zoom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      showLabels: preferences.showLabels,
      darkMode: preferences.darkMode,
    };

    // Create tool state
    const toolState = {
      isDrawing: true,
      drawingStart: null,
      currentCursor: currentPos,
      circleCenter: circleCenter,
    };

    // Use circle tool to render preview
    circleTool.renderPreview(renderCtx, toolState);
  };

  // Draw circle 3-point preview
  const drawCircle3pPreview = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (circle3pPoints.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const currentPos = canvasState.cursor;

    // Create render context for tools
    const renderCtx: CanvasRenderContext = {
      ctx,
      offsetX,
      offsetY,
      zoom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      showLabels: preferences.showLabels,
      darkMode: preferences.darkMode,
    };

    // Create tool state
    const toolState = {
      isDrawing: true,
      drawingStart: null,
      currentCursor: currentPos,
      circlePoints: circle3pPoints,
    };

    // Use circle3p tool to render preview
    circle3pTool.renderPreview(renderCtx, toolState);
  };
  */

  // Phase 18.5: Mouse handlers moved to useMouseHandlers hook


  // Handle class selection (supports batch operation for classification)
  const handleClassSelect = async (classId: string, className: string) => {
    if (!project) {
      return;
    }

    setShowClassSelector(false);

    // Check for pending geometry shapes first
    const hasPendingPolygon = !!(window as any).__pendingPolygon;
    const hasPendingPolyline = !!(window as any).__pendingPolyline;
    const hasPendingCircle = !!(window as any).__pendingCircle;
    const hasPendingGeometry = pendingBbox || hasPendingPolygon || hasPendingPolyline || hasPendingCircle;

    // Check if this is a batch classification operation
    const isBatchClassification = !hasPendingGeometry && selectedImageIds.length > 0;

    if (isBatchClassification) {
      // Batch classification for multiple selected images
      // Safety check: Only allow batch classification when in classification task
      if (currentTask !== 'classification') {
        console.error('[handleClassSelect] Batch classification attempted outside classification task!', { currentTask });
        toast.error('Batch classification is only allowed in classification task');
        return;
      }

      try {
        setBatchProgress({ current: 0, total: selectedImageIds.length });

        for (let i = 0; i < selectedImageIds.length; i++) {
          const imageId = selectedImageIds[i];
          setBatchProgress({ current: i + 1, total: selectedImageIds.length });

          // Delete existing classification annotations for this image
          // Safety: Double-check we're only deleting classification annotations
          const existingAnnotations = await getProjectAnnotations(project.id, imageId);

          const classificationAnnotations = existingAnnotations.filter(
            ann => ann.annotation_type === 'classification'
          );

          for (const ann of classificationAnnotations) {
            // Final safety check before delete
            if (ann.annotation_type !== 'classification') {
              console.error('[handleClassSelect] SAFETY VIOLATION: Attempted to delete non-classification annotation!', ann);
              continue; // Skip this annotation
            }

            await deleteAnnotationAPI(ann.id);
            if (imageId === currentImage?.id) {
              deleteAnnotation(ann.id);
            }
          }

          // Create new classification annotation
          const annotationData: AnnotationCreateRequest = {
            project_id: project.id,
            image_id: imageId,
            annotation_type: 'classification',
            geometry: { type: 'classification' },
            class_id: classId,
            class_name: className,
          };

          // Phase 8.5.2: Try to create annotation, skip if locked by another user
          try {
            const savedAnnotation = await createAnnotation(annotationData);

            // If this is the current image, add to store
            if (imageId === currentImage?.id) {
              addAnnotation({
                id: savedAnnotation.id.toString(),
                projectId: project.id,
                imageId: imageId,
                annotationType: 'classification',
                classId: classId,
                className: className,
                geometry: { type: 'classification' },
                confidence: savedAnnotation.confidence,
                attributes: savedAnnotation.attributes,
                createdAt: savedAnnotation.created_at ? new Date(savedAnnotation.created_at) : undefined,
                updatedAt: savedAnnotation.updated_at ? new Date(savedAnnotation.updated_at) : undefined,
              });
            }

            // Update image status
            useAnnotationStore.setState((state) => ({
              images: state.images.map(img =>
                img.id === imageId
                  ? {
                      ...img,
                      annotation_count: 1,
                      is_confirmed: false,
                      status: 'in-progress',
                    }
                  : img
              )
            }));
          } catch (lockError: any) {
            // Image is locked by another user, skip this image
            console.warn(`Skipping image ${imageId}: ${lockError.message}`);
            // Don't throw, just continue to next image
          }
        }

        setBatchProgress(null);
        clearImageSelection();
        toast.success(`${selectedImageIds.length}媛??대?吏??'${className}' ?대옒?ㅻ? ?좊떦?덉뒿?덈떎.`, 3000);
      } catch (err) {
        console.error('Failed to batch assign class:', err);
        setBatchProgress(null);
        toast.error('?대옒???좊떦???ㅽ뙣?덉뒿?덈떎.');
      }
      return;
    }

    // Single image operation (existing logic)
    if (!currentImage) return;

    setIsSaving(true);

    try {
      let annotationData: AnnotationCreateRequest;
      let annotationType: 'bbox' | 'polygon' | 'classification' | 'polyline' | 'circle';
      let geometry: any;

      // Read and immediately clear ALL pending geometry shapes to prevent reuse
      const pendingPolygon = (window as any).__pendingPolygon as [number, number][] | undefined;
      const pendingPolyline = (window as any).__pendingPolyline as [number, number][] | undefined;
      const pendingCircle = (window as any).__pendingCircle as { center: [number, number]; radius: number } | undefined;

      // Clear all pending data immediately after reading
      delete (window as any).__pendingPolygon;
      delete (window as any).__pendingPolyline;
      delete (window as any).__pendingCircle;

      // Check if this is for bbox, polygon, polyline, circle, or classification
      if (pendingPolyline) {
        // Polyline annotation
        annotationType = 'polyline';

        // Clip polyline points to image bounds
        const imgWidth = image?.width || currentImage.width || 0;
        const imgHeight = image?.height || currentImage.height || 0;

        const clippedPoints = pendingPolyline.map(([px, py]): [number, number] => [
          Math.round(Math.max(0, Math.min(imgWidth, px)) * 100) / 100,
          Math.round(Math.max(0, Math.min(imgHeight, py)) * 100) / 100,
        ]);

        geometry = {
          type: 'polyline',
          points: clippedPoints,
          image_width: imgWidth,
          image_height: imgHeight,
        };
      } else if (pendingCircle) {
        // Circle annotation
        annotationType = 'circle';

        const imgWidth = image?.width || currentImage.width || 0;
        const imgHeight = image?.height || currentImage.height || 0;

        geometry = {
          type: 'circle',
          center: pendingCircle.center,
          radius: pendingCircle.radius,
          image_width: imgWidth,
          image_height: imgHeight,
        };
      } else if (pendingPolygon) {
        // Polygon annotation
        annotationType = 'polygon';

        // Clip polygon points to image bounds and round to 2 decimal places
        const imgWidth = image?.width || currentImage.width || 0;
        const imgHeight = image?.height || currentImage.height || 0;

        const clippedPoints = pendingPolygon.map(([px, py]): [number, number] => [
          Math.round(Math.max(0, Math.min(imgWidth, px)) * 100) / 100,
          Math.round(Math.max(0, Math.min(imgHeight, py)) * 100) / 100,
        ]);

        geometry = {
          type: 'polygon',
          points: clippedPoints,
          image_width: imgWidth,
          image_height: imgHeight,
        };
      } else if (pendingBbox) {
        // BBox annotation
        annotationType = 'bbox';

        // Clip bbox to image bounds
        const imgWidth = image?.width || currentImage.width || 0;
        const imgHeight = image?.height || currentImage.height || 0;

        let { x, y, w, h } = pendingBbox;
        let wasClipped = false;

        // Clip left edge
        if (x < 0) {
          w += x; // reduce width by overflow
          x = 0;
          wasClipped = true;
        }
        // Clip top edge
        if (y < 0) {
          h += y; // reduce height by overflow
          y = 0;
          wasClipped = true;
        }
        // Clip right edge
        if (x + w > imgWidth) {
          w = imgWidth - x;
          wasClipped = true;
        }
        // Clip bottom edge
        if (y + h > imgHeight) {
          h = imgHeight - y;
          wasClipped = true;
        }

        // Ensure positive dimensions
        w = Math.max(0, w);
        h = Math.max(0, h);

        // Round to 2 decimal places
        x = Math.round(x * 100) / 100;
        y = Math.round(y * 100) / 100;
        w = Math.round(w * 100) / 100;
        h = Math.round(h * 100) / 100;

        // Show warning if clipped
        if (wasClipped) {
          toast.warning('BBox媛 ?대?吏 ?곸뿭??踰쀬뼱???먮룞?쇰줈 議곗젙?섏뿀?듬땲??', 4000);
        }

        geometry = {
          type: 'bbox',
          bbox: [x, y, w, h],
          image_width: imgWidth,
          image_height: imgHeight,
        };
      } else {
        // Classification annotation
        annotationType = 'classification';
        geometry = {
          type: 'classification',
        };

        // Delete existing classification annotations for this image (only one allowed)
        // Safety: Only delete classification annotations
        const existingClassifications = annotations.filter(
          ann => ann.annotationType === 'classification'
        );
        for (const ann of existingClassifications) {
          // Final safety check before delete
          if (ann.annotationType !== 'classification') {
            console.error('[handleClassSelect] SAFETY VIOLATION: Attempted to delete non-classification annotation in single mode!', ann);
            continue; // Skip this annotation
          }

          await deleteAnnotationAPI(ann.id);
          deleteAnnotation(ann.id);
        }
      }

      annotationData = {
        project_id: project.id,
        image_id: currentImage.id,
        annotation_type: annotationType,
        geometry: geometry,
        class_id: classId,
        class_name: className,
      };

      // Phase 8.5.2: Backend now auto-acquires/refreshes locks
      // No need for complex retry logic - just save the annotation
      // Backend will handle lock management automatically
      const savedAnnotation = await createAnnotation(annotationData);

      // Add to store (use savedAnnotation data from backend)
      addAnnotation({
        id: savedAnnotation.id.toString(),
        projectId: project.id,
        imageId: currentImage.id,
        annotationType: savedAnnotation.annotation_type,
        classId: savedAnnotation.class_id || classId,
        className: savedAnnotation.class_name || className,
        geometry: savedAnnotation.geometry,
        confidence: savedAnnotation.confidence,
        attributes: savedAnnotation.attributes,
        createdAt: savedAnnotation.created_at ? new Date(savedAnnotation.created_at) : undefined,
        updatedAt: savedAnnotation.updated_at ? new Date(savedAnnotation.updated_at) : undefined,
      });

      // Update current image status only (not all images)
      // This prevents resetting other images' status
      // Update both images array and currentImage for immediate UI update
      const updatedCurrentImage = {
        ...currentImage,
        annotation_count: ((currentImage as any).annotation_count || 0) + 1,
        is_confirmed: false,
        status: 'in-progress',
      };

      useAnnotationStore.setState((state) => ({
        currentImage: state.currentImage?.id === currentImage.id
          ? updatedCurrentImage
          : state.currentImage,
        images: state.images.map(img =>
          img.id === currentImage.id
            ? updatedCurrentImage
            : img
        )
      }));

      setPendingBbox(null);
    } catch (err) {
      console.error('Failed to save annotation:', err);
      toast.error('?대끂?뚯씠????μ뿉 ?ㅽ뙣?덉뒿?덈떎.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle class selector close
  const handleClassSelectorClose = useCallback(() => {
    setShowClassSelector(false);
    setPendingBbox(null);
    // Also clear pending polyline and circle
    delete (window as any).__pendingPolyline;
    delete (window as any).__pendingCircle;
    delete (window as any).__pendingPolygon;
  }, [setShowClassSelector, setPendingBbox]);

  // Phase 18.8.2: Batch operations extracted to custom hook
  const {
    handleNoObject,
    handleDeleteAllAnnotations,
    handleConfirmImage,
  } = useBatchOperations({
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
  });

  // Phase 18.8.1: Keyboard shortcuts extracted to custom hook
  useCanvasKeyboardShortcuts({
    canvasRef,
    image,
    currentImage,
    canvasState,
    tool,
    annotations,
    selectedAnnotationId,
    selectedVertexIndex,
    selectedBboxHandle,
    selectedCircleHandle,
    updateAnnotationStore,
    polygonVertices,
    setPolygonVertices,
    polylineVertices,
    setPolylineVertices,
    circleCenter,
    setCircleCenter,
    circle3pPoints,
    setCircle3pPoints,
    pendingBbox,
    setPendingBbox,
    showClassSelector,
    setShowClassSelector,
    setSelectedVertexIndex,
    manualMagnifierActive,
    setManualMagnifierActive,
    magnifierForceOff,
    setMagnifierForceOff,
    isDrawingTool,
    preferences,
    diffMode,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedImageIds,
    handleConfirmImage,
    handleNoObject,
    handleDeleteAllAnnotations,
    isImageConfirmed,
  });

  // Phase 2.7: Keyboard shortcuts extracted to useCanvasKeyboardShortcuts hook (Phase 18.8.1)

  // Phase 2.10.2: Z key release handler removed - now using toggle mode instead
  // (Toggle mode is more reliable in remote desktop environments)

  // Mouse wheel handler (zoom)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(canvasState.zoom + delta);
  }, [setZoom, canvasState.zoom]);

  // Phase 19: Load text labels when image changes
  useEffect(() => {
    if (currentImage && project?.id) {
      loadTextLabelsForImage(project.id, currentImage.id);
    } else {
      clearTextLabels();
    }
  }, [currentImage, project?.id, loadTextLabelsForImage, clearTextLabels]);

  if (!currentImage) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">No image selected</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 bg-white dark:bg-gray-900 relative overflow-hidden">
      {/* Phase 11: Diff Mode UI */}
      {diffMode.enabled ? (
        <>
          <DiffToolbar />
          <DiffActions />
          <DiffViewModeSelector />
        </>
      ) : (
        <>
          {/* Phase 18.8.3: Tool Selector Component */}
          <ToolSelector
            tool={tool}
            currentTask={currentTask}
            onToolSelect={setTool}
          />
        </>
      )}

      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : canvasCursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Phase 18.8.3: Zoom Controls Component */}
      <ZoomControls
        zoom={canvasState.zoom}
        pan={canvasState.pan}
        onZoomChange={setZoom}
        onPanChange={setPan}
        onUndo={() => {
          if (canUndo()) {
            undo();
            toast.success('Undone');
          }
        }}
        onRedo={() => {
          if (canRedo()) {
            redo();
            toast.success('Redone');
          }
        }}
        canUndo={canUndo()}
        canRedo={canRedo()}
      />

      {/* Phase 18.8.3: Navigation Buttons Component */}
      <NavigationButtons
        currentIndex={currentIndex}
        totalImages={images.length}
        onPrevious={goToPrevImage}
        onNext={goToNextImage}
      />

      {/* Image info */}
      {image && (
        <div className="absolute bottom-4 right-20 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-400 shadow-lg">
          {image.width} x {image.height} px
        </div>
      )}

      {/* Phase 2.7: Confirm Image button */}
      {(annotations.length > 0 || (currentImage as any)?.has_no_object) && !isImageConfirmed && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <button
            onClick={handleConfirmImage}
            disabled={confirmingImage}
            className={`px-4 py-2 rounded-lg shadow-lg font-medium text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
              draftCount > 0
                ? 'bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white'
                : 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white'
            } disabled:cursor-not-allowed`}
            title="Confirm Image (Space)"
          >
            {confirmingImage ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Confirming...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                <span>
                  {draftCount > 0
                    ? `Confirm & Next (${draftCount} draft)`
                    : 'Mark Complete & Next'}
                </span>
                <kbd className="ml-1 px-1 py-0.5 text-[10px] bg-white bg-opacity-20 rounded">
                  Space
                </kbd>
              </>
            )}
          </button>
        </div>
      )}

      {/* Image already confirmed */}
      {isImageConfirmed && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <div className="px-4 py-2 rounded-lg shadow-lg bg-gray-500 text-white font-medium text-xs flex items-center gap-2 whitespace-nowrap">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
            <span>Image Confirmed</span>
          </div>
        </div>
      )}

      {/* Phase 18.8.3: Canvas Action Bar Component */}
      <CanvasActionBar
        annotationCount={annotations.length}
        selectedImageCount={selectedImageIds.length}
        onNoObject={handleNoObject}
        onDeleteAll={handleDeleteAllAnnotations}
      />

      {/* AI Assistant button */}
      <div className="absolute bottom-4 right-4">
        <button
          className="w-12 h-12 bg-violet-600 hover:bg-violet-700 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105"
          title="AI Assistant"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </button>
      </div>

      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 bg-opacity-50">
          <svg className="animate-spin h-8 w-8 text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm text-gray-900 dark:text-gray-300">Saving annotation...</span>
        </div>
      )}

      {/* Batch progress indicator */}
      {batchProgress && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 min-w-[300px]">
            <div className="flex items-center gap-3 mb-4">
              <svg className="animate-spin h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                泥섎━ 以?.. {batchProgress.current} / {batchProgress.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Phase 2.10.2: Magnifier */}
      {shouldShowMagnifier && (
        <Magnifier
          canvasRef={canvasRef}
          cursorPosition={cursorPos}
          magnification={magnification}
          mode={preferences.magnifierMode}
          size={preferences.magnifierSize}
        />
      )}

      {/* Phase 2.10.3: Minimap moved to RightPanel */}

      {/* Class Selector Modal */}
      <ClassSelectorModal
        isOpen={showClassSelector}
        onClose={handleClassSelectorClose}
        onSelect={handleClassSelect}
      />

      {/* Phase 8.5.1: Version Conflict Dialog */}
      <AnnotationConflictDialog
        isOpen={conflictDialogOpen}
        conflict={conflictInfo}
        onReload={async () => {
          setConflictDialogOpen(false);
          setPendingAnnotationUpdate(null);
          setConflictInfo(null);
          // Reload annotations to get latest version
          if (project && currentImage) {
            try {
              const anns = await getProjectAnnotations(project.id, currentImage.id);
              // Update store with fresh annotations
              useAnnotationStore.setState({
                annotations: anns.map((ann: any) => ({
                  id: String(ann.id),
                  projectId: ann.project_id,
                  imageId: ann.image_id,
                  annotationType: ann.annotation_type,
                  geometry: ann.geometry,
                  classId: ann.class_id,
                  className: ann.class_name,
                  attributes: ann.attributes || {},
                  confidence: ann.confidence,
                  createdBy: ann.created_by,
                  version: ann.version, // Phase 8.5.1: Include version
                })),
              });
              toast.info('Reloaded latest version');
            } catch (error) {
              console.error('Failed to reload annotations:', error);
              toast.error('Failed to reload annotations');
            }
          }
        }}
        onOverwrite={async () => {
          if (!pendingAnnotationUpdate || !conflictInfo) return;

          try {
            // Force update with current version
            await updateAnnotation(pendingAnnotationUpdate.annotationId, {
              ...pendingAnnotationUpdate.data,
              version: conflictInfo.currentVersion,
            });

            setConflictDialogOpen(false);
            setPendingAnnotationUpdate(null);
            setConflictInfo(null);

            // Reload annotations
            if (project && currentImage) {
              const anns = await getProjectAnnotations(project.id, currentImage.id);
              useAnnotationStore.setState({
                annotations: anns.map((ann: any) => ({
                  id: String(ann.id),
                  projectId: ann.project_id,
                  imageId: ann.image_id,
                  annotationType: ann.annotation_type,
                  geometry: ann.geometry,
                  classId: ann.class_id,
                  className: ann.class_name,
                  attributes: ann.attributes || {},
                  confidence: ann.confidence,
                  createdBy: ann.created_by,
                  version: ann.version,
                })),
              });
            }

            toast.success('Changes saved');
          } catch (error) {
            console.error('Overwrite failed:', error);
            toast.error('Failed to overwrite changes');
          }
        }}
        onCancel={() => {
          setConflictDialogOpen(false);
          setPendingAnnotationUpdate(null);
          setConflictInfo(null);
        }}
      />

      {/* Phase 18.4: Lock Status and Overlay */}
      <LockOverlay
        isImageLocked={isImageLocked}
        lockedByUser={lockedByUser}
        hasCurrentImage={!!currentImage}
      />

      {/* Image Path Display */}
      {currentImage && (
        <div className="absolute top-32 left-4 z-10 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg shadow text-xs font-mono">
          {currentImage.id}
        </div>
      )}

      {/* Phase 19: Text Label Dialog */}
      <TextLabelDialog />
    </div>
  );
}
