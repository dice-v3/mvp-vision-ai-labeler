/**
 * Canvas Component
 *
 * Main image viewer with zoom/pan controls and annotation rendering
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
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
} from '@/lib/annotation/hooks';
// Phase 18.4: Overlay Components
import { LockOverlay } from './overlays/LockOverlay';

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const {
    currentImage,
    annotations,
    selectedAnnotationId,
    selectAnnotation,
    canvas: canvasState,
    tool,
    setTool,
    isDrawing,
    drawingStart,
    preferences,
    setZoom,
    setPan,
    setCursor,
    startDrawing,
    updateDrawing,
    finishDrawing,
    addAnnotation,
    project,
    isAnnotationVisible,
    currentIndex,
    images,
    goToNextImage,
    goToPrevImage,
    setCurrentIndex,
    currentTask, // Phase 2.9
    deleteAnnotation,
    updateAnnotation: updateAnnotationStore, // Phase 2.10: For undo/redo history
    // Multi-image selection
    selectedImageIds,
    clearImageSelection,
    getCurrentClasses, // Phase 2.9: Get task-specific classes
    selectedVertexIndex, // Polygon vertex editing
    selectedBboxHandle, // Bbox handle editing
    // Phase 2.10: Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    // Phase 2.10.3: Minimap state
    showMinimap,
    // Phase 11: Diff mode
    diffMode,
    getDiffForCurrentImage,
  } = useAnnotationStore();

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

  // Render canvas
  useEffect(() => {
    if (!canvasRef.current || !image || !imageLoaded || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to container size
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas with dark/light mode aware color
    ctx.fillStyle = preferences.darkMode ? '#1f2937' : '#f3f4f6'; // gray-800 : gray-100
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate image position (centered and scaled)
    const { zoom, pan } = canvasState;
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;

    const x = (canvas.width - scaledWidth) / 2 + pan.x;
    const y = (canvas.height - scaledHeight) / 2 + pan.y;

    // Draw grid if enabled and zoomed in
    if (preferences.showGrid && zoom > 1.0) {
      drawGrid(ctx, canvas.width, canvas.height, x, y, scaledWidth, scaledHeight, zoom);
    }

    // Draw image
    ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

    // Draw annotations
    drawAnnotations(ctx, x, y, zoom);

    // Draw drawing preview
    if (isDrawing && drawingStart && tool === 'bbox') {
      drawBboxPreview(ctx, x, y, zoom);
    }

    // Draw polygon preview
    if (tool === 'polygon' && polygonVertices.length > 0) {
      drawPolygonPreview(ctx, x, y, zoom);
    }

    // Draw polyline preview
    if (tool === 'polyline' && polylineVertices.length > 0) {
      drawPolylinePreview(ctx, x, y, zoom);
    }

    // Draw circle preview (center-edge)
    if (tool === 'circle' && circleCenter) {
      drawCirclePreview(ctx, x, y, zoom);
    }

    // Draw circle 3-point preview
    if (tool === 'circle3p' && circle3pPoints.length > 0) {
      drawCircle3pPreview(ctx, x, y, zoom);
    }

    // Draw crosshair if drawing tool is active
    if ((tool === 'bbox' || tool === 'polygon' || tool === 'polyline' || tool === 'circle' || tool === 'circle3p') && !isDrawing && preferences.showLabels) {
      drawCrosshair(ctx, canvas.width, canvas.height);
    }

    // Draw selected vertex highlight (polygon and polyline)
    if (selectedVertexIndex !== null && selectedAnnotationId) {
      const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (selectedAnn && (selectedAnn.geometry.type === 'polygon' || selectedAnn.geometry.type === 'polyline')) {
        const points = selectedAnn.geometry.points;
        if (selectedVertexIndex < points.length) {
          const [px, py] = points[selectedVertexIndex];
          const scaledPx = px * zoom + x;
          const scaledPy = py * zoom + y;

          // Draw highlight ring around selected vertex
          ctx.strokeStyle = '#f59e0b'; // amber-500
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(scaledPx, scaledPy, 10, 0, Math.PI * 2);
          ctx.stroke();

          // Draw inner fill
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(scaledPx, scaledPy, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Draw selected bbox handle highlight
    if (selectedBboxHandle && selectedAnnotationId) {
      const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (selectedAnn && selectedAnn.geometry.type === 'bbox') {
        const [bx, by, bw, bh] = selectedAnn.geometry.bbox;
        const scaledX = bx * zoom + x;
        const scaledY = by * zoom + y;
        const scaledW = bw * zoom;
        const scaledH = bh * zoom;

        // Get handle position
        let hx = 0, hy = 0;
        switch (selectedBboxHandle) {
          case 'nw': hx = scaledX; hy = scaledY; break;
          case 'ne': hx = scaledX + scaledW; hy = scaledY; break;
          case 'sw': hx = scaledX; hy = scaledY + scaledH; break;
          case 'se': hx = scaledX + scaledW; hy = scaledY + scaledH; break;
          case 'n': hx = scaledX + scaledW / 2; hy = scaledY; break;
          case 's': hx = scaledX + scaledW / 2; hy = scaledY + scaledH; break;
          case 'w': hx = scaledX; hy = scaledY + scaledH / 2; break;
          case 'e': hx = scaledX + scaledW; hy = scaledY + scaledH / 2; break;
        }

        // Draw highlight ring around selected handle
        ctx.strokeStyle = '#f59e0b'; // amber-500
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(hx, hy, 10, 0, Math.PI * 2);
        ctx.stroke();

        // Draw inner fill
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw selected circle handle highlight
    if (selectedCircleHandle && selectedAnnotationId) {
      const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (selectedAnn && selectedAnn.geometry.type === 'circle') {
        const center = selectedAnn.geometry.center;
        const radius = selectedAnn.geometry.radius;
        const scaledCenterX = center[0] * zoom + x;
        const scaledCenterY = center[1] * zoom + y;
        const scaledRadius = radius * zoom;

        // Get handle position
        let hx = 0, hy = 0;
        switch (selectedCircleHandle) {
          case 'n': hx = scaledCenterX; hy = scaledCenterY - scaledRadius; break;
          case 's': hx = scaledCenterX; hy = scaledCenterY + scaledRadius; break;
          case 'e': hx = scaledCenterX + scaledRadius; hy = scaledCenterY; break;
          case 'w': hx = scaledCenterX - scaledRadius; hy = scaledCenterY; break;
        }

        // Draw highlight ring around selected handle
        ctx.strokeStyle = '#f59e0b'; // amber-500
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(hx, hy, 10, 0, Math.PI * 2);
        ctx.stroke();

        // Draw inner fill
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [image, imageLoaded, canvasState, annotations, selectedAnnotationId, isDrawing, drawingStart, tool, preferences, project, polygonVertices, selectedVertexIndex, selectedBboxHandle, polylineVertices, circleCenter, circle3pPoints, selectedCircleHandle]);

  // Draw grid
  // Phase 18.2: Drawing helper functions moved to @/lib/annotation/utils
  // - drawGrid ??renderHelpers.drawGrid
  // - snapshotToAnnotation ??annotationHelpers.snapshotToAnnotation

  // Draw annotations using Tool system
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

  // Phase 18.2: drawNoObjectBadge moved to renderHelpers.drawNoObjectBadge

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

  // Phase 18.2: drawCrosshair moved to renderHelpers.drawCrosshair

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
  const handleClassSelectorClose = () => {
    setShowClassSelector(false);
    setPendingBbox(null);
    // Also clear pending polyline and circle
    delete (window as any).__pendingPolyline;
    delete (window as any).__pendingCircle;
    delete (window as any).__pendingPolygon;
  };

  // Phase 2.7: Confirm Image handler
  // Handle No Object annotation (supports batch operation)
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
        toast.success(`${targetImageIds.length}媛??대?吏瑜?No Object濡?泥섎━?덉뒿?덈떎.`, 3000);
      } catch (err) {
        console.error('Failed to create no_object annotation:', err);
        setBatchProgress(null);
        toast.error('No Object 泥섎━???ㅽ뙣?덉뒿?덈떎.');
      }
    };

    // Show confirm dialog
    const message = isBatch
      ? `?좏깮??${targetImageIds.length}媛??대?吏瑜?No Object濡?泥섎━?⑸땲?? 湲곗〈 ?덉씠釉붿? ??젣?⑸땲??`
      : annotations.length > 0
        ? `湲곗〈 ${annotations.length}媛쒖쓽 ?덉씠釉붿씠 ??젣?⑸땲?? 怨꾩냽?섏떆寃좎뒿?덇퉴?`
        : '???대?吏瑜?No Object濡?泥섎━?섏떆寃좎뒿?덇퉴?';

    confirm({
      title: 'No Object ?ㅼ젙',
      message,
      confirmText: '?뺤씤',
      cancelText: '痍⑥냼',
      onConfirm: processNoObject,
    });
  }, [currentImage, project, addAnnotation, annotations, deleteAnnotation, selectedImageIds]);

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
        toast.success(`${targetImageIds.length}媛??대?吏?먯꽌 ${totalDeleted}媛??덉씠釉붿쓣 ??젣?덉뒿?덈떎.`, 3000);
      } catch (err) {
        console.error('Failed to delete annotations:', err);
        setBatchProgress(null);
        toast.error('??젣???ㅽ뙣?덉뒿?덈떎.');
      }
    };

    // Show confirm dialog
    const message = isBatch
      ? `?좏깮??${targetImageIds.length}媛??대?吏??紐⑤뱺 ?덉씠釉붿쓣 ??젣?⑸땲??`
      : `?꾩옱 ?대?吏??${annotations.length}媛??덉씠釉붿쓣 紐⑤몢 ??젣?섏떆寃좎뒿?덇퉴?`;

    confirm({
      title: '紐⑤뱺 ?덉씠釉???젣',
      message,
      confirmText: '??젣',
      cancelText: '痍⑥냼',
      onConfirm: processDelete,
    });
  }, [project, currentImage, annotations, deleteAnnotation, selectedImageIds]);

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
          toast.success(`${targetImageIds.length}媛??대?吏瑜??뺤젙?덉뒿?덈떎.`, 3000);
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
        toast.error('?뺤젙???ㅽ뙣?덉뒿?덈떎.');
      } finally {
        setConfirmingImage(false);
      }
    };

    // Show confirm dialog for batch operations
    if (isBatch) {
      confirm({
        title: '?대?吏 ?뺤젙',
        message: `?좏깮??${targetImageIds.length}媛??대?吏瑜??뺤젙?섏떆寃좎뒿?덇퉴?`,
        confirmText: '?뺤젙',
        cancelText: '痍⑥냼',
        onConfirm: processConfirm,
      });
    } else {
      processConfirm();
    }
  }, [currentImage, project, confirmingImage, annotations, images, currentIndex, goToNextImage, setCurrentIndex, selectedImageIds, clearImageSelection, currentTask]);

  // Phase 2.7: Keyboard shortcuts for Canvas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields or when modals are open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        showClassSelector // Don't interfere with ClassSelectorModal keyboard events
      ) {
        return;
      }

      // Phase 11: Escape key to exit diff mode (without confirmation)
      if (e.key === 'Escape' && diffMode.enabled) {
        e.preventDefault();
        console.log('[Canvas] Escape pressed in diff mode, exiting...');
        const { exitDiffMode } = useAnnotationStore.getState();
        exitDiffMode().then(() => {
          console.log('[Canvas] Successfully exited diff mode');
          toast.success('Exited diff mode');
        }).catch((error) => {
          console.error('[Canvas] Failed to exit diff mode:', error);
          toast.error('Failed to exit diff mode');
        });
        return;
      }

      // Phase 2.10.2: Magnifier manual activation (Z key without Ctrl/Cmd) - Toggle mode
      if (e.key === 'z' && !e.ctrlKey && !e.metaKey) {
        // Calculate current magnifier state
        const currentlyShown = !magnifierForceOff && (
          manualMagnifierActive ||
          (isDrawingTool(tool) && preferences.autoMagnifier)
        );

        if (currentlyShown) {
          // Magnifier is currently shown, force it off
          setMagnifierForceOff(true);
          setManualMagnifierActive(false);
        } else {
          // Magnifier is hidden, turn on manual magnifier
          setMagnifierForceOff(false);
          setManualMagnifierActive(true);
        }
        return;
      }

      // Phase 2.10.3: Minimap toggle (M key)
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey) {
        const currentShowMinimap = useAnnotationStore.getState().showMinimap;
        const newShowMinimap = !currentShowMinimap;
        useAnnotationStore.setState({ showMinimap: newShowMinimap });
        toast.success(`Minimap ${newShowMinimap ? 'shown' : 'hidden'}`);
        return;
      }

      // Phase 2.10: Undo/Redo shortcuts
      // Ctrl+Z / Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
          toast.success('Undone');
        }
        return;
      }

      // Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo()) {
          redo();
          toast.success('Redone');
        }
        return;
      }

      // Enter: Close polygon (if drawing)
      if (e.key === 'Enter' && tool === 'polygon' && polygonVertices.length >= 3 && image) {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const { zoom, pan } = canvasState;
        const scaledWidth = image.width * zoom;
        const scaledHeight = image.height * zoom;
        const imgX = (rect.width - scaledWidth) / 2 + pan.x;
        const imgY = (rect.height - scaledHeight) / 2 + pan.y;

        // Convert canvas coords to image coords
        const imagePoints = polygonVertices.map(([vx, vy]): [number, number] => [
          (vx - imgX) / zoom,
          (vy - imgY) / zoom,
        ]);

        // Store pending polygon and show class selector
        setPendingBbox(null);
        (window as any).__pendingPolygon = imagePoints;
        setShowClassSelector(true);
        setPolygonVertices([]);
        return;
      }

      // Escape: Cancel polygon drawing
      if (e.key === 'Escape' && tool === 'polygon' && polygonVertices.length > 0) {
        e.preventDefault();
        setPolygonVertices([]);
        return;
      }

      // Enter: Complete polyline (if drawing)
      if (e.key === 'Enter' && tool === 'polyline' && polylineVertices.length >= 2 && image) {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const { zoom, pan } = canvasState;
        const scaledWidth = image.width * zoom;
        const scaledHeight = image.height * zoom;
        const imgX = (rect.width - scaledWidth) / 2 + pan.x;
        const imgY = (rect.height - scaledHeight) / 2 + pan.y;

        // Convert canvas coords to image coords
        const imagePoints = polylineVertices.map(([vx, vy]): [number, number] => [
          Math.round(((vx - imgX) / zoom) * 100) / 100,
          Math.round(((vy - imgY) / zoom) * 100) / 100,
        ]);

        // Store pending polyline and show class selector
        (window as any).__pendingPolyline = imagePoints;
        console.log('[Polyline] Set pending polyline:', imagePoints);
        setShowClassSelector(true);
        setPolylineVertices([]);
        return;
      }

      // Escape: Cancel polyline drawing
      if (e.key === 'Escape' && tool === 'polyline' && polylineVertices.length > 0) {
        e.preventDefault();
        setPolylineVertices([]);
        return;
      }

      // Escape: Cancel circle drawing
      if (e.key === 'Escape' && tool === 'circle' && circleCenter) {
        e.preventDefault();
        setCircleCenter(null);
        return;
      }

      // Escape: Cancel circle3p drawing
      if (e.key === 'Escape' && tool === 'circle3p' && circle3pPoints.length > 0) {
        e.preventDefault();
        setCircle3pPoints([]);
        return;
      }

      // Arrow keys: Move selected bbox handle or entire bbox
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedVertexIndex === null && selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
        if (selectedAnn && selectedAnn.geometry.type === 'bbox' && image) {
          e.preventDefault();
          e.stopPropagation();

          let [newX, newY, newW, newH] = selectedAnn.geometry.bbox;

          // Move amount (hold Shift for larger steps)
          const step = e.shiftKey ? 10 : 1;

          if (selectedBboxHandle) {
            // Move only the selected handle
            const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
            const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;

            switch (selectedBboxHandle) {
              case 'nw': // Top-left corner
                newX += dx;
                newY += dy;
                newW -= dx;
                newH -= dy;
                break;
              case 'ne': // Top-right corner
                newY += dy;
                newW += dx;
                newH -= dy;
                break;
              case 'sw': // Bottom-left corner
                newX += dx;
                newW -= dx;
                newH += dy;
                break;
              case 'se': // Bottom-right corner
                newW += dx;
                newH += dy;
                break;
              case 'n': // Top edge
                newY += dy;
                newH -= dy;
                break;
              case 's': // Bottom edge
                newH += dy;
                break;
              case 'w': // Left edge
                newX += dx;
                newW -= dx;
                break;
              case 'e': // Right edge
                newW += dx;
                break;
            }

            // Ensure minimum size
            if (newW < 10) newW = 10;
            if (newH < 10) newH = 10;
          } else {
            // Move entire bbox
            switch (e.key) {
              case 'ArrowUp':
                newY = Math.max(0, newY - step);
                break;
              case 'ArrowDown':
                newY = Math.min(image.height - newH, newY + step);
                break;
              case 'ArrowLeft':
                newX = Math.max(0, newX - step);
                break;
              case 'ArrowRight':
                newX = Math.min(image.width - newW, newX + step);
                break;
            }
          }

          // Clip to image bounds and round to 2 decimal places
          newX = Math.round(Math.max(0, Math.min(image.width - newW, newX)) * 100) / 100;
          newY = Math.round(Math.max(0, Math.min(image.height - newH, newY)) * 100) / 100;
          newW = Math.round(newW * 100) / 100;
          newH = Math.round(newH * 100) / 100;

          // Update annotation in store (with history recording)
          const updatedGeometry = {
            type: 'bbox' as const,
            bbox: [newX, newY, newW, newH] as [number, number, number, number],
          };
          updateAnnotationStore(selectedAnnotationId, {
            geometry: updatedGeometry,
          });

          // Save to backend
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              type: 'bbox',
              bbox: [newX, newY, newW, newH],
              image_width: image.width,
              image_height: image.height,
            },
          };
          updateAnnotation(selectedAnnotationId, updateData)
            .then(() => {
              // Update image status to in-progress
              if (currentImage) {
                const updatedCurrentImage = {
                  ...currentImage,
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
                  ),
                }));
              }
            })
            .catch((error) => {
              console.error('Failed to move bbox:', error);
            });

          return;
        }
      }

      // Arrow keys: Resize selected circle handle or move entire circle
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedVertexIndex === null && selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
        if (selectedAnn && selectedAnn.geometry.type === 'circle' && image) {
          e.preventDefault();
          e.stopPropagation();

          let center = [...selectedAnn.geometry.center] as [number, number];
          let radius = selectedAnn.geometry.radius;

          // Move amount (hold Shift for larger steps)
          const step = e.shiftKey ? 10 : 1;

          if (selectedCircleHandle) {
            // Resize radius based on handle direction
            let radiusDelta = 0;

            switch (selectedCircleHandle) {
              case 'n': // Top handle
                radiusDelta = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
                break;
              case 's': // Bottom handle
                radiusDelta = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
                break;
              case 'e': // Right handle
                radiusDelta = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
                break;
              case 'w': // Left handle
                radiusDelta = e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0;
                break;
            }

            radius = Math.max(5, radius + radiusDelta);
          } else {
            // Move entire circle
            switch (e.key) {
              case 'ArrowUp':
                center[1] = Math.max(radius, center[1] - step);
                break;
              case 'ArrowDown':
                center[1] = Math.min(image.height - radius, center[1] + step);
                break;
              case 'ArrowLeft':
                center[0] = Math.max(radius, center[0] - step);
                break;
              case 'ArrowRight':
                center[0] = Math.min(image.width - radius, center[0] + step);
                break;
            }
          }

          // Round to 2 decimal places
          center[0] = Math.round(center[0] * 100) / 100;
          center[1] = Math.round(center[1] * 100) / 100;
          radius = Math.round(radius * 100) / 100;

          // Update annotation in store (with history recording)
          const updatedCircleGeometry = {
            type: 'circle' as const,
            center: center as [number, number],
            radius,
          };
          updateAnnotationStore(selectedAnnotationId, {
            geometry: updatedCircleGeometry,
          });

          // Save to backend
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              type: 'circle',
              center,
              radius,
              image_width: image.width,
              image_height: image.height,
            },
          };
          updateAnnotation(selectedAnnotationId, updateData)
            .then(() => {
              // Update image status to in-progress
              if (currentImage) {
                const updatedCurrentImage = {
                  ...currentImage,
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
                  ),
                }));
              }
            })
            .catch((error) => {
              console.error('Failed to move/resize circle:', error);
            });

          return;
        }
      }

      // Arrow keys: Move selected vertex (polygon or polyline - override image navigation)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedVertexIndex !== null && selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
        if (selectedAnn && (selectedAnn.geometry.type === 'polygon' || selectedAnn.geometry.type === 'polyline') && image) {
          e.preventDefault();
          e.stopPropagation();

          const points = selectedAnn.geometry.points;
          const [px, py] = points[selectedVertexIndex];

          // Move amount (hold Shift for larger steps)
          const step = e.shiftKey ? 10 : 1;

          let newX = px;
          let newY = py;

          switch (e.key) {
            case 'ArrowUp':
              newY = Math.round(Math.max(0, py - step) * 100) / 100;
              break;
            case 'ArrowDown':
              newY = Math.round(Math.min(image.height, py + step) * 100) / 100;
              break;
            case 'ArrowLeft':
              newX = Math.round(Math.max(0, px - step) * 100) / 100;
              break;
            case 'ArrowRight':
              newX = Math.round(Math.min(image.width, px + step) * 100) / 100;
              break;
          }

          // Update annotation in store (with history recording)
          const newPoints = [...points];
          newPoints[selectedVertexIndex] = [newX, newY];

          const updatedPolygonGeometry = {
            type: 'polygon' as const,
            points: newPoints,
          };
          updateAnnotationStore(selectedAnnotationId, {
            geometry: updatedPolygonGeometry,
          });

          // Save to backend (debounced would be better, but for now immediate)
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              type: 'polygon',
              points: newPoints,
              image_width: image.width,
              image_height: image.height,
            },
          };
          updateAnnotation(selectedAnnotationId, updateData)
            .then(() => {
              // Update image status to in-progress
              if (currentImage) {
                const updatedCurrentImage = {
                  ...currentImage,
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
                  ),
                }));
              }
            })
            .catch((error) => {
              console.error('Failed to move vertex:', error);
            });

          return;
        }
      }

      // Delete/Backspace: Delete selected vertex (minimum 3 for polygon, 2 for polyline)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedVertexIndex !== null && selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
        if (selectedAnn && (selectedAnn.geometry.type === 'polygon' || selectedAnn.geometry.type === 'polyline')) {
          const points = selectedAnn.geometry.points;
          const geometryType = selectedAnn.geometry.type;
          const minVertices = geometryType === 'polygon' ? 3 : 2;

          // Must keep minimum vertices
          if (points.length <= minVertices) {
            const typeName = geometryType === 'polygon' ? 'Polygon' : 'Polyline';
            toast.warning(`${typeName}? 理쒖냼 ${minVertices}媛쒖쓽 vertex媛 ?꾩슂?⑸땲??`, 3000);
            return;
          }

          e.preventDefault();

          // Remove the selected vertex
          const newPoints = points.filter((_, i) => i !== selectedVertexIndex);

          // Update annotation in store (with history recording)
          const updatedPolyGeometry = {
            type: geometryType as 'polygon' | 'polyline',
            points: newPoints,
          };
          updateAnnotationStore(selectedAnnotationId, {
            geometry: updatedPolyGeometry,
          });

          // Save to backend
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              type: geometryType,
              points: newPoints,
              image_width: image.width,
              image_height: image.height,
            },
          };
          updateAnnotation(selectedAnnotationId, updateData)
            .then(() => {
              // Update image status to in-progress
              if (currentImage) {
                const updatedCurrentImage = {
                  ...currentImage,
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
                  ),
                }));
              }
            })
            .catch((error) => {
              console.error('Failed to delete vertex:', error);
              toast.error('Vertex ??젣???ㅽ뙣?덉뒿?덈떎.');
            });

          // Clear vertex selection
          setSelectedVertexIndex(null);
          return;
        }
      }

      // Space: Confirm Image (supports batch)
      // Must have annotations or no_object to confirm (same condition as button)
      const canConfirm = (annotations.length > 0 || (currentImage as any)?.has_no_object) && !isImageConfirmed;
      if (e.key === ' ' && canConfirm) {
        e.preventDefault();
        handleConfirmImage();
      }

      // 0: No Object
      if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleNoObject();
      }

      // Delete: Delete all annotations (supports batch)
      // Only if no annotation is selected (individual annotation delete is handled by useKeyboardShortcuts)
      if (e.key === 'Delete' && !selectedAnnotationId && (selectedImageIds.length > 0 || annotations.length > 0)) {
        e.preventDefault();
        handleDeleteAllAnnotations();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleConfirmImage, isImageConfirmed, annotations, handleNoObject, selectedImageIds, handleDeleteAllAnnotations, currentImage, selectedAnnotationId, tool, polygonVertices, image, canvasState, selectedVertexIndex, selectedBboxHandle, selectedCircleHandle, polylineVertices, circleCenter, circle3pPoints, undo, redo, canUndo, canRedo, diffMode, showClassSelector, manualMagnifierActive, magnifierForceOff, preferences.autoMagnifier, isDrawingTool]);

  // Phase 2.10.2: Z key release handler removed - now using toggle mode instead
  // (Toggle mode is more reliable in remote desktop environments)

  // Mouse wheel handler (zoom)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(canvasState.zoom + delta);
  };

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
          {/* Tool selector - top center */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center gap-2 shadow-lg z-10">
        <button
          onClick={() => setTool('select')}
          className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
            tool === 'select'
              ? 'bg-violet-500 text-white'
              : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title="Select Tool (Q)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <span>Select</span>
        </button>

        {/* Phase 2.9: Show BBox tool for detection tasks */}
        {currentTask === 'detection' && (
          <button
            onClick={() => setTool('bbox')}
            className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
              tool === 'bbox'
                ? 'bg-violet-500 text-white'
                : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title="Bounding Box (B)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
            </svg>
            <span>BBox</span>
          </button>
        )}

        {/* Polygon tool for segmentation tasks */}
        {currentTask === 'segmentation' && (
          <button
            onClick={() => setTool('polygon')}
            className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
              tool === 'polygon'
                ? 'bg-violet-500 text-white'
                : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title="Polygon (P)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span>Polygon</span>
          </button>
        )}

        {/* Classification tool for classification tasks */}
        {currentTask === 'classification' && (
          <button
            onClick={() => setTool('classification')}
            className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
              tool === 'classification'
                ? 'bg-violet-500 text-white'
                : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title="Classify (W)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span>Classify</span>
          </button>
        )}

        {/* Geometry tools for geometry tasks */}
        {currentTask === 'geometry' && (
          <>
            <button
              onClick={() => setTool('polyline')}
              className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
                tool === 'polyline'
                  ? 'bg-violet-500 text-white'
                  : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title="Polyline (L)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l6-6 4 4 8-8" />
              </svg>
              <span>Polyline</span>
            </button>
            <button
              onClick={() => setTool('circle')}
              className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
                tool === 'circle'
                  ? 'bg-violet-500 text-white'
                  : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title="Circle - Center Edge (E)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="2" r="1.5" fill="currentColor" />
              </svg>
              <span>Circle(2P)</span>
            </button>
            <button
              onClick={() => setTool('circle3p')}
              className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
                tool === 'circle3p'
                  ? 'bg-violet-500 text-white'
                  : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title="Circle - 3 Points (R)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <circle cx="12" cy="2" r="1.5" fill="currentColor" />
                <circle cx="4" cy="16" r="1.5" fill="currentColor" />
                <circle cx="20" cy="16" r="1.5" fill="currentColor" />
              </svg>
              <span>Circle(3P)</span>
            </button>
          </>
        )}
      </div>
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

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center gap-2 shadow-lg">
        {/* Undo button */}
        <button
          onClick={() => {
            if (canUndo()) {
              undo();
              toast.success('Undone');
            }
          }}
          disabled={!canUndo()}
          className={`
            w-8 h-8 flex items-center justify-center rounded transition-colors
            ${canUndo()
              ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }
          `}
          title="Undo (Ctrl+Z)"
        >
          <ArrowUturnLeftIcon className="w-4 h-4" />
        </button>

        {/* Redo button */}
        <button
          onClick={() => {
            if (canRedo()) {
              redo();
              toast.success('Redone');
            }
          }}
          disabled={!canRedo()}
          className={`
            w-8 h-8 flex items-center justify-center rounded transition-colors
            ${canRedo()
              ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }
          `}
          title="Redo (Ctrl+Y)"
        >
          <ArrowUturnRightIcon className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>

        {/* Zoom out button */}
        <button
          onClick={() => setZoom(canvasState.zoom - 0.25)}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-900 dark:text-white"
          title="Zoom Out (Ctrl+-)"
        >
          ??
        </button>
        <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-center">
          {Math.round(canvasState.zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(canvasState.zoom + 0.25)}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-900 dark:text-white"
          title="Zoom In (Ctrl++)"
        >
          +
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, y: 0 });
          }}
          className="px-3 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-xs text-gray-900 dark:text-white"
          title="Fit to Screen (Ctrl+0)"
        >
          Fit
        </button>
      </div>

      {/* Navigation controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-3 shadow-lg">
        <button
          onClick={goToPrevImage}
          disabled={currentIndex === 0}
          className="text-gray-900 dark:text-white disabled:text-gray-400 dark:disabled:text-gray-600 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:cursor-not-allowed"
          title="Previous Image (??"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm text-gray-900 dark:text-white font-medium min-w-[60px] text-center">
          {currentIndex + 1} / {images.length}
        </span>
        <button
          onClick={goToNextImage}
          disabled={currentIndex >= images.length - 1}
          className="text-gray-900 dark:text-white disabled:text-gray-400 dark:disabled:text-gray-600 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:cursor-not-allowed"
          title="Next Image (??"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

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

      {/* Utility buttons (top-right) */}
      <div className="absolute top-4 right-4 flex flex-row gap-2">
        {/* No Object button */}
        <button
          onClick={handleNoObject}
          className="w-10 h-10 bg-gray-600 hover:bg-gray-700 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105"
          title="No Object (0)"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} strokeDasharray="4 2" />
          </svg>
        </button>

        {/* Delete all annotations button */}
        <button
          onClick={handleDeleteAllAnnotations}
          disabled={annotations.length === 0 && selectedImageIds.length === 0}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105 ${
            annotations.length > 0 || selectedImageIds.length > 0
              ? 'bg-red-400 hover:bg-red-500'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
          title="Delete All Annotations (Del)"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

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
    </div>
  );
}
