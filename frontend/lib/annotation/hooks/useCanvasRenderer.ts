/**
 * useCanvasRenderer Hook
 *
 * Manages canvas rendering including image, annotations, tool previews, and overlays.
 * Handles the main rendering useEffect and all related rendering functions.
 *
 * Phase 18.4: Canvas Architecture Refactoring
 * Extracted from Canvas.tsx lines 346-641 (~296 lines)
 *
 * @module hooks/useCanvasRenderer
 */

import { useEffect, useCallback } from 'react';
import type { CanvasRenderContext } from '@/lib/annotation';
import type { Annotation } from '@/lib/types/annotation';
import { ToolRegistry, bboxTool } from '@/lib/annotation';
import { drawGrid, drawCrosshair, drawNoObjectBadge, snapshotToAnnotation, drawTextLabelButton } from '@/lib/annotation/utils';
import { useTextLabelStore } from '@/lib/stores/textLabelStore';
import { useAnnotationStore } from '@/lib/stores/annotationStore';

/**
 * Hook parameters
 */
export interface UseCanvasRendererParams {
  // Refs
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  image: HTMLImageElement | null;
  imageLoaded: boolean;

  // Store state
  canvasState: any;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  selectedVertexIndex: number | null;
  selectedBboxHandle: string | null;
  selectedCircleHandle: string | null;
  preferences: any;
  project: any;
  tool: string | null;
  diffMode: any;
  isDrawing: boolean;
  drawingStart: { x: number; y: number } | null;

  // Tool state
  polygonVertices: [number, number][];
  polylineVertices: [number, number][];
  circleCenter: [number, number] | null;
  circle3pPoints: [number, number][];

  // Helpers
  isAnnotationVisible: (id: string) => boolean;
  getCurrentClasses: () => Record<string, any>;
  getDiffForCurrentImage: () => any;

  // Tool renderers from useToolRenderer
  drawBboxPreview: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => void;
  drawPolygonPreview: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => void;
  drawPolylinePreview: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => void;
  drawCirclePreview: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => void;
  drawCircle3pPreview: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => void;
}

/**
 * Canvas renderer hook
 *
 * Encapsulates all canvas rendering logic in a single useEffect.
 * Handles rendering of image, grid, annotations, tool previews, and selection highlights.
 *
 * @param params - Hook parameters
 *
 * @example
 * ```tsx
 * useCanvasRenderer({
 *   canvasRef,
 *   containerRef,
 *   image,
 *   imageLoaded,
 *   canvasState,
 *   annotations,
 *   selectedAnnotationId,
 *   preferences,
 *   tool,
 *   ...
 * });
 * ```
 */
export function useCanvasRenderer(params: UseCanvasRendererParams): void {
  const {
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
  } = params;

  // Destructure specific values to avoid object reference issues in dependencies
  const { zoom, pan } = canvasState;
  const { x: panX, y: panY } = pan;
  const { darkMode, showGrid, showLabels } = preferences;
  const { enabled: diffModeEnabled, viewMode: diffModeViewMode } = diffMode;

  // Get annotation visibility state
  const showAllAnnotations = useAnnotationStore(state => state.showAllAnnotations);
  const showTextLabelPreviews = useAnnotationStore(state => state.showTextLabelPreviews);
  const hiddenAnnotationCount = useAnnotationStore(state => state.hiddenAnnotationIds.size);

  // Get text label store for Phase 19 - VLM Text Labeling
  const { hasTextLabel, getTextLabelForAnnotation } = useTextLabelStore();
  // Subscribe to textLabels to trigger re-render when labels change
  const textLabelsCount = useTextLabelStore(state => state.textLabels.length);

  /**
   * Draw all annotations on the canvas
   */
  const drawAnnotations = useCallback((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
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
      showLabels,
      darkMode,
    };

    // Phase 11: Diff mode rendering
    if (diffModeEnabled && diffModeViewMode === 'overlay') {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project,
    canvasRef,
    // Specific primitive values instead of preferences and diffMode objects
    showLabels,
    darkMode,
    diffModeEnabled,
    diffModeViewMode,
    showAllAnnotations, // Annotation visibility toggle
    hiddenAnnotationCount, // Individual annotation visibility
    textLabelsCount, // Text label changes trigger re-render
    // getDiffForCurrentImage, getCurrentClasses, isAnnotationVisible are stable store methods
    annotations,
    selectedAnnotationId,
  ]);

  /**
   * Draw text label buttons on annotations (Phase 19 - VLM Text Labeling)
   */
  const drawTextLabelButtons = useCallback((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (diffModeEnabled) return; // Don't show buttons in diff mode

    annotations.forEach((ann) => {
      // Skip if annotation is hidden or not supported
      if (!isAnnotationVisible(ann.id)) return;
      if (ann.geometry.type === 'no_object' || ann.geometry.type === 'classification') return;

      // Get bounding box for the annotation
      let bbox: { x: number; y: number; width: number; height: number } | null = null;

      if (ann.geometry.type === 'bbox') {
        const [x, y, width, height] = ann.geometry.bbox;
        bbox = { x, y, width, height };
      } else if (ann.geometry.type === 'polygon' && ann.geometry.bbox) {
        const [x, y, width, height] = ann.geometry.bbox;
        bbox = { x, y, width, height };
      } else if (ann.geometry.type === 'circle') {
        const [cx, cy] = ann.geometry.center;
        const radius = ann.geometry.radius;
        bbox = {
          x: cx - radius,
          y: cy - radius,
          width: radius * 2,
          height: radius * 2,
        };
      }

      if (!bbox) return;

      // Check if annotation has text label and get content
      const annotationId = parseInt(ann.id);
      const hasLabel = !isNaN(annotationId) && hasTextLabel(annotationId);
      const textLabel = !isNaN(annotationId) ? getTextLabelForAnnotation(annotationId) : undefined;
      // Only show text content if preview toggle is enabled
      const textContent = showTextLabelPreviews ? textLabel?.text_content : undefined;

      // Draw text label button
      drawTextLabelButton(
        ctx,
        bbox.x * zoom + offsetX,
        bbox.y * zoom + offsetY,
        bbox.width * zoom,
        bbox.height * zoom,
        hasLabel,
        zoom,
        textContent
      );
    });
  }, [annotations, isAnnotationVisible, hasTextLabel, getTextLabelForAnnotation, showTextLabelPreviews, diffModeEnabled, textLabelsCount]);

  /**
   * Main rendering useEffect
   */
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
    ctx.fillStyle = darkMode ? '#1f2937' : '#f3f4f6'; // gray-800 : gray-100
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate image position (centered and scaled)
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;

    const x = (canvas.width - scaledWidth) / 2 + panX;
    const y = (canvas.height - scaledHeight) / 2 + panY;

    // Draw grid if enabled and zoomed in
    if (showGrid && zoom > 1.0) {
      drawGrid(ctx, canvas.width, canvas.height, x, y, scaledWidth, scaledHeight, zoom);
    }

    // Draw image
    ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

    // Draw annotations
    drawAnnotations(ctx, x, y, zoom);

    // Draw text label buttons (Phase 19)
    drawTextLabelButtons(ctx, x, y, zoom);

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
    if ((tool === 'bbox' || tool === 'polygon' || tool === 'polyline' || tool === 'circle' || tool === 'circle3p') && !isDrawing && showLabels) {
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
  }, [
    canvasRef,
    containerRef,
    image,
    imageLoaded,
    // Specific primitive values instead of canvasState object
    zoom,
    panX,
    panY,
    annotations,
    selectedAnnotationId,
    selectedVertexIndex,
    selectedBboxHandle,
    selectedCircleHandle,
    // Specific primitive values instead of preferences object
    darkMode,
    showGrid,
    showLabels,
    // project removed - it's stable and only used in drawAnnotations
    tool,
    isDrawing,
    drawingStart,
    polygonVertices,
    polylineVertices,
    circleCenter,
    circle3pPoints,
    drawAnnotations,
    drawTextLabelButtons,
    drawBboxPreview,
    drawPolygonPreview,
    drawPolylinePreview,
    drawCirclePreview,
    drawCircle3pPreview,
  ]);
}
