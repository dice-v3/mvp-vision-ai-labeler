/**
 * useMouseHandlers Hook
 *
 * Manages all mouse event handlers for the Canvas component.
 * Extracted from Canvas.tsx during Phase 18.5 refactoring.
 *
 * Handles:
 * - Mouse down: Tool activation, selection, resize/drag start
 * - Mouse move: Cursor updates, drag operations, drawing preview
 * - Mouse up: Save operations, drawing completion
 *
 * Phase 18.5: Canvas Architecture Refactoring
 * Extracted from Canvas.tsx lines 730-1978 (~1,250 lines)
 *
 * @module hooks/useMouseHandlers
 */

import React, { useCallback } from 'react';
import type { Annotation } from '@/lib/types/annotation';
import type { AnnotationCreateRequest, AnnotationUpdateRequest } from '@/lib/api/annotations';
import { updateAnnotation, createAnnotation, deleteAnnotation as deleteAnnotationAPI, getProjectAnnotations } from '@/lib/api/annotations';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { useTextLabelStore } from '@/lib/stores/textLabelStore';
import { toast } from '@/lib/stores/toastStore';
import { Circle3pTool } from '@/lib/annotation/tools/Circle3pTool';
import {
  getHandleAtPosition,
  pointInBbox,
  getCursorForHandle,
  getPointOnEdge,
} from '@/lib/annotation/utils';
import { polygonTool, polylineTool, circleTool } from '@/lib/annotation';

/**
 * Mouse handler dependencies
 */
export interface UseMouseHandlersParams {
  // Refs
  canvasRef: React.RefObject<HTMLCanvasElement>;
  image: HTMLImageElement | null;

  // Store state
  currentImage: any;
  project: any;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  canvasState: any;
  tool: string | null;
  currentTask: string;
  selectedImageIds: string[];
  isImageLocked: boolean;

  // Store actions
  selectAnnotation: (id: string | null) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setCursor: (cursor: { x: number; y: number }) => void;
  startDrawing: (pos: { x: number; y: number }) => void;
  updateDrawing: (pos: { x: number; y: number }) => void;
  finishDrawing: () => void;
  addAnnotation: (ann: any) => void;
  deleteAnnotation: (id: string) => void;
  isAnnotationVisible: (id: string) => boolean;
  clearImageSelection: () => void;
  getCurrentClasses: () => Record<string, any>;

  // UI state
  showClassSelector: boolean;
  setShowClassSelector: (show: boolean) => void;
  canvasCursor: string;
  setCanvasCursor: (cursor: string) => void;
  setCursorPos: (pos: { x: number; y: number }) => void;
  setBatchProgress: (progress: { current: number; total: number } | null) => void;

  // Tool state
  pendingBbox: { x: number; y: number; w: number; h: number } | null;
  setPendingBbox: (bbox: { x: number; y: number; w: number; h: number } | null) => void;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  setResizeHandle: (handle: string | null) => void;
  resizeStart: any;
  setResizeStart: (start: any) => void;
  polygonVertices: [number, number][];
  setPolygonVertices: (vertices: [number, number][]) => void;
  isDraggingVertex: boolean;
  setIsDraggingVertex: (dragging: boolean) => void;
  setDraggedVertexIndex: (index: number | null) => void;
  isDraggingPolygon: boolean;
  setIsDraggingPolygon: (dragging: boolean) => void;
  polygonDragStart: any;
  setPolygonDragStart: (start: any) => void;
  polylineVertices: [number, number][];
  setPolylineVertices: (vertices: [number, number][]) => void;
  circleCenter: [number, number] | null;
  setCircleCenter: (center: [number, number] | null) => void;
  isDraggingCircle: boolean;
  setIsDraggingCircle: (dragging: boolean) => void;
  circleDragStart: any;
  setCircleDragStart: (start: any) => void;
  isResizingCircle: boolean;
  setIsResizingCircle: (resizing: boolean) => void;
  circleResizeStart: any;
  setCircleResizeStart: (start: any) => void;
  setSelectedCircleHandle: (handle: string | null) => void;
  circle3pPoints: [number, number][];
  setCircle3pPoints: (points: [number, number][]) => void;

  // Transform state
  isPanning: boolean;
  setIsPanning: (panning: boolean) => void;
  panStart: { x: number; y: number } | null;
  setPanStart: (start: { x: number; y: number } | null) => void;

  // Helpers
  setSelectedVertexIndex: (index: number | null) => void;
  setSelectedBboxHandle: (handle: string | null) => void;
  isDrawing: boolean;
  drawingStart: { x: number; y: number } | null;
}

/**
 * Hook return type
 */
export interface UseMouseHandlersReturn {
  handleMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleMouseUp: (e: React.MouseEvent<HTMLCanvasElement>) => Promise<void>;
}

/**
 * Mouse event handlers hook
 *
 * Centralizes all mouse event handling logic for the Canvas component.
 * This hook manages the complex state transitions and tool-specific behaviors
 * for annotation creation, selection, and manipulation.
 *
 * @param params - Hook parameters
 * @returns Mouse event handlers
 *
 * @example
 * ```tsx
 * const { handleMouseDown, handleMouseMove, handleMouseUp } = useMouseHandlers({
 *   canvasRef,
 *   image,
 *   currentImage,
 *   ...
 * });
 *
 * <canvas
 *   onMouseDown={handleMouseDown}
 *   onMouseMove={handleMouseMove}
 *   onMouseUp={handleMouseUp}
 * />
 * ```
 */
export function useMouseHandlers(params: UseMouseHandlersParams): UseMouseHandlersReturn {
  const {
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
  } = params;

  // Phase 19: VLM Text Labeling store
  const { openDialogForAnnotation } = useTextLabelStore();

  /**
   * Mouse down handler
   *
   * Handles:
   * - Lock validation for creation tools
   * - Selection and manipulation (select mode)
   * - Pan gesture initiation
   * - Tool-specific creation workflows
   */
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !image) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { zoom, pan } = canvasState;
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;
    const imgX = (rect.width - scaledWidth) / 2 + pan.x;
    const imgY = (rect.height - scaledHeight) / 2 + pan.y;

    // Phase 19: Check if clicking on text label button (before other checks)
    const BUTTON_SIZE = 24;
    for (const ann of annotations) {
      if (!isAnnotationVisible(ann.id)) continue;
      if (ann.geometry.type === 'no_object' || ann.geometry.type === 'classification') continue;

      // Get bounding box for the annotation
      let bbox: { x: number; y: number; width: number; height: number } | null = null;

      if (ann.geometry.type === 'bbox') {
        const [bx, by, bw, bh] = ann.geometry.bbox;
        bbox = { x: bx, y: by, width: bw, height: bh };
      } else if (ann.geometry.type === 'polygon' && ann.geometry.bbox) {
        const [bx, by, bw, bh] = ann.geometry.bbox;
        bbox = { x: bx, y: by, width: bw, height: bh };
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

      if (!bbox) continue;

      // Calculate button position (bottom-left of bbox)
      const buttonX = bbox.x * zoom + imgX;
      const buttonY = bbox.y * zoom + imgY + bbox.height * zoom - BUTTON_SIZE;

      // Check if click is within button bounds
      if (
        x >= buttonX &&
        x <= buttonX + BUTTON_SIZE &&
        y >= buttonY &&
        y <= buttonY + BUTTON_SIZE
      ) {
        // Open text label dialog for this annotation
        const annotationId = parseInt(ann.id);
        if (!isNaN(annotationId)) {
          openDialogForAnnotation(annotationId);
        }
        return; // Prevent other click handlers
      }
    }

    // Phase 8.5.2: Block annotation creation without lock (strict lock policy)
    // Allow pan and selection (read-only), block creation tools
    const isCreationTool = tool !== 'pan' && tool !== 'select';

    if (!isImageLocked && isCreationTool) {
      // Lock overlay is already visible, no need for toast
      return;
    }

    // Only handle selection and resizing in select mode
    if (tool === 'select') {
      // Check if clicking on a handle of the selected annotation
      if (selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);

        // Handle bbox resize
        if (selectedAnn && selectedAnn.geometry.type === 'bbox') {
          const [bboxX, bboxY, bboxW, bboxH] = selectedAnn.geometry.bbox;

          const scaledX = bboxX * zoom + imgX;
          const scaledY = bboxY * zoom + imgY;
          const scaledW = bboxW * zoom;
          const scaledH = bboxH * zoom;

          const handle = getHandleAtPosition(x, y, scaledX, scaledY, scaledW, scaledH);
          if (handle) {
            // Phase 8.5.2: Block resize without lock
            if (!isImageLocked) {
              return;
            }
            // Select handle and start resizing
            setSelectedBboxHandle(handle);
            setIsResizing(true);
            setResizeHandle(handle);
            setResizeStart({ x, y, bbox: [bboxX, bboxY, bboxW, bboxH] });
            setCanvasCursor(getCursorForHandle(handle));
            return;
          }
        }

        // Handle polygon vertex drag or polygon move
        if (selectedAnn && selectedAnn.geometry.type === 'polygon') {
          const points = selectedAnn.geometry.points;

          // Check if clicking on a vertex
          const vertexThreshold = 8;
          for (let i = 0; i < points.length; i++) {
            const [px, py] = points[i];
            const scaledPx = px * zoom + imgX;
            const scaledPy = py * zoom + imgY;
            const dx = x - scaledPx;
            const dy = y - scaledPy;
            if (Math.sqrt(dx * dx + dy * dy) < vertexThreshold) {
              // Phase 8.5.2: Block vertex drag without lock
              if (!isImageLocked) {
                return;
              }
              // Select and start vertex drag
              setSelectedVertexIndex(i);
              setIsDraggingVertex(true);
              setDraggedVertexIndex(i);
              setCanvasCursor('move');
              return;
            }
          }

          // Check if clicking on an edge (to add vertex)
          const imageX = (x - imgX) / zoom;
          const imageY = (y - imgY) / zoom;
          const edgeResult = getPointOnEdge(imageX, imageY, points, vertexThreshold / zoom);
          if (edgeResult && image) {
            // Phase 8.5.2: Block vertex addition without lock
            if (!isImageLocked) {
              return;
            }
            // Insert new vertex after the edge's first vertex
            const newPoints = [...points];
            newPoints.splice(edgeResult.edgeIndex + 1, 0, edgeResult.point);

            // Update store
            useAnnotationStore.setState({
              annotations: annotations.map(ann =>
                ann.id === selectedAnnotationId
                  ? {
                      ...ann,
                      geometry: {
                        ...ann.geometry,
                        points: newPoints,
                      },
                    }
                  : ann
              ),
            });

            // Select the new vertex
            setSelectedVertexIndex(edgeResult.edgeIndex + 1);

            // Save to backend
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
                console.error('Failed to add vertex:', error);
                toast.error('Vertex 추가에 실패했습니다.');
              });

            return;
          }

          // Check if clicking inside polygon (for moving)
          // imageX, imageY already calculated above for edge detection
          if (polygonTool.isPointInside(imageX, imageY, selectedAnn)) {
            // Start polygon drag (clear vertex selection)
            setSelectedVertexIndex(null);
            setIsDraggingPolygon(true);
            setPolygonDragStart({ x, y, points: points.map(p => [...p] as [number, number]) });
            setCanvasCursor('move');
            return;
          }
        }

        // Handle polyline vertex drag or polyline move
        if (selectedAnn && selectedAnn.geometry.type === 'polyline') {
          const points = selectedAnn.geometry.points;

          // Check if clicking on a vertex
          const vertexThreshold = 8;
          for (let i = 0; i < points.length; i++) {
            const [px, py] = points[i];
            const scaledPx = px * zoom + imgX;
            const scaledPy = py * zoom + imgY;
            const dx = x - scaledPx;
            const dy = y - scaledPy;
            if (Math.sqrt(dx * dx + dy * dy) < vertexThreshold) {
              // Select and start vertex drag
              setSelectedVertexIndex(i);
              setIsDraggingVertex(true);
              setDraggedVertexIndex(i);
              setCanvasCursor('move');
              return;
            }
          }

          // Check if clicking on an edge (to add vertex)
          const imageX = (x - imgX) / zoom;
          const imageY = (y - imgY) / zoom;
          const edgeResult = getPointOnEdge(imageX, imageY, points, vertexThreshold / zoom);
          if (edgeResult && image) {
            // Phase 8.5.2: Block vertex addition without lock
            if (!isImageLocked) {
              return;
            }
            // Insert new vertex after the edge's first vertex
            const newPoints = [...points];
            newPoints.splice(edgeResult.edgeIndex + 1, 0, edgeResult.point);

            // Update store
            useAnnotationStore.setState({
              annotations: annotations.map(ann =>
                ann.id === selectedAnnotationId
                  ? {
                      ...ann,
                      geometry: {
                        ...ann.geometry,
                        points: newPoints,
                      },
                    }
                  : ann
              ),
            });

            // Select the new vertex
            setSelectedVertexIndex(edgeResult.edgeIndex + 1);

            // Save to backend
            const updateData: AnnotationUpdateRequest = {
              geometry: {
                type: 'polyline',
                points: newPoints,
                image_width: image.width,
                image_height: image.height,
              },
            };
            updateAnnotation(selectedAnnotationId, updateData)
              .then(() => {
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
                console.error('Failed to add vertex:', error);
                toast.error('Vertex 추가에 실패했습니다.');
              });

            return;
          }

          // Check if clicking on polyline (for moving)
          if (polylineTool.isPointInside(imageX, imageY, selectedAnn)) {
            // Start polyline drag (clear vertex selection)
            setSelectedVertexIndex(null);
            setIsDraggingPolygon(true); // Reuse polygon drag state for polyline
            setPolygonDragStart({ x, y, points: points.map(p => [...p] as [number, number]) });
            setCanvasCursor('move');
            return;
          }
        }

        // Handle circle move or resize
        if (selectedAnn && selectedAnn.geometry.type === 'circle') {
          const center = selectedAnn.geometry.center;
          const radius = selectedAnn.geometry.radius;

          // Convert to canvas coordinates
          const scaledCenterX = center[0] * zoom + imgX;
          const scaledCenterY = center[1] * zoom + imgY;
          const scaledRadius = radius * zoom;

          // Check if clicking on radius handles (N, S, E, W)
          const handleThreshold = 8;
          const handles = [
            { name: 'n', x: scaledCenterX, y: scaledCenterY - scaledRadius }, // N
            { name: 's', x: scaledCenterX, y: scaledCenterY + scaledRadius }, // S
            { name: 'e', x: scaledCenterX + scaledRadius, y: scaledCenterY }, // E
            { name: 'w', x: scaledCenterX - scaledRadius, y: scaledCenterY }, // W
          ];

          for (const handle of handles) {
            const dx = x - handle.x;
            const dy = y - handle.y;
            if (Math.sqrt(dx * dx + dy * dy) < handleThreshold) {
              // Start circle resize
              setIsResizingCircle(true);
              setCircleResizeStart({ x, y, radius, handle: handle.name });
              setSelectedCircleHandle(handle.name);
              setCanvasCursor('pointer');
              return;
            }
          }

          // Check if clicking on center (for moving)
          const dxCenter = x - scaledCenterX;
          const dyCenter = y - scaledCenterY;
          if (Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter) < handleThreshold) {
            // Start circle move (clear handle selection)
            setSelectedCircleHandle(null);
            setIsDraggingCircle(true);
            setCircleDragStart({ x, y, center: [...center] as [number, number] });
            setCanvasCursor('move');
            return;
          }

          // Check if clicking inside circle (for moving)
          const imageX = (x - imgX) / zoom;
          const imageY = (y - imgY) / zoom;
          if (circleTool.isPointInside(imageX, imageY, selectedAnn)) {
            // Start circle move (clear handle selection)
            setSelectedCircleHandle(null);
            setIsDraggingCircle(true);
            setCircleDragStart({ x, y, center: [...center] as [number, number] });
            setCanvasCursor('move');
            return;
          }
        }
      }

      // Clear vertex/handle selection when clicking elsewhere
      setSelectedVertexIndex(null);
      setSelectedBboxHandle(null);
      setSelectedCircleHandle(null);

      // Check if clicking on any annotation to select it
      let clickedAnnotation: typeof annotations[0] | null = null;
      for (const ann of annotations) {
        if (!isAnnotationVisible(ann.id)) continue;

        if (ann.geometry.type === 'bbox') {
          const [bboxX, bboxY, bboxW, bboxH] = ann.geometry.bbox;
          const scaledX = bboxX * zoom + imgX;
          const scaledY = bboxY * zoom + imgY;
          const scaledW = bboxW * zoom;
          const scaledH = bboxH * zoom;

          if (pointInBbox(x, y, scaledX, scaledY, scaledW, scaledH)) {
            clickedAnnotation = ann;
            break;
          }
        } else if (ann.geometry.type === 'polygon') {
          // Convert canvas coords to image coords
          const imageX = (x - imgX) / zoom;
          const imageY = (y - imgY) / zoom;
          if (polygonTool.isPointInside(imageX, imageY, ann)) {
            clickedAnnotation = ann;
            break;
          }
        } else if (ann.geometry.type === 'polyline') {
          // Convert canvas coords to image coords
          const imageX = (x - imgX) / zoom;
          const imageY = (y - imgY) / zoom;
          if (polylineTool.isPointInside(imageX, imageY, ann)) {
            clickedAnnotation = ann;
            break;
          }
        } else if (ann.geometry.type === 'circle') {
          // Convert canvas coords to image coords
          const imageX = (x - imgX) / zoom;
          const imageY = (y - imgY) / zoom;
          if (circleTool.isPointInside(imageX, imageY, ann)) {
            clickedAnnotation = ann;
            break;
          }
        }
      }

      if (clickedAnnotation) {
        // Select the clicked annotation
        selectAnnotation(clickedAnnotation.id);
        // Set cursor to move since we're inside the annotation
        setCanvasCursor('move');
        return;
      }

      // If nothing clicked, deselect
      if (selectedAnnotationId) {
        selectAnnotation(null);
      }
    }

    // If select tool is active, start panning
    if (tool === 'select') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // If middle button or shift+click, start panning
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Check if click is within image bounds
    const isInImage = x >= imgX && x <= imgX + scaledWidth && y >= imgY && y <= imgY + scaledHeight;

    // Check if classes are available for the current task
    const currentClasses = getCurrentClasses();
    const hasClasses = Object.keys(currentClasses).length > 0;

    // If bbox tool is active, start drawing (only within image)
    if (tool === 'bbox' && isInImage) {
      if (!hasClasses) {
        toast.warning(`'${currentTask}' task에 등록된 클래스가 없습니다. 먼저 클래스를 추가해주세요.`, 4000);
        return;
      }
      startDrawing({ x, y });
    }

    // If polygon tool is active, add vertex or close polygon (only within image)
    if (tool === 'polygon' && isInImage) {
      if (!hasClasses && polygonVertices.length === 0) {
        toast.warning(`'${currentTask}' task에 등록된 클래스가 없습니다. 먼저 클래스를 추가해주세요.`, 4000);
        return;
      }
      const closeThreshold = 15;

      // Check if closing polygon (click near first vertex)
      if (polygonVertices.length >= 3) {
        const [firstX, firstY] = polygonVertices[0];
        const dx = x - firstX;
        const dy = y - firstY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < closeThreshold) {
          // Close polygon - convert canvas coords to image coords
          const imagePoints = polygonVertices.map(([vx, vy]): [number, number] => [
            (vx - imgX) / zoom,
            (vy - imgY) / zoom,
          ]);

          // Store pending polygon and show class selector
          setPendingBbox(null); // Clear any pending bbox
          // Store polygon points in a temporary state (reuse pendingBbox pattern)
          (window as any).__pendingPolygon = imagePoints;
          setShowClassSelector(true);
          setPolygonVertices([]);
          return;
        }
      }

      // Add vertex
      setPolygonVertices([...polygonVertices, [x, y]]);
    }

    // If classification tool is active, show class selector (only within image)
    if (tool === 'classification' && isInImage) {
      if (!hasClasses) {
        toast.warning(`'${currentTask}' task에 등록된 클래스가 없습니다. 먼저 클래스를 추가해주세요.`, 4000);
        return;
      }
      setShowClassSelector(true);
    }

    // If polyline tool is active, add vertex (only within image)
    if (tool === 'polyline' && isInImage) {
      if (!hasClasses && polylineVertices.length === 0) {
        toast.warning(`'${currentTask}' task에 등록된 클래스가 없습니다. 먼저 클래스를 추가해주세요.`, 4000);
        return;
      }
      // Add vertex
      setPolylineVertices([...polylineVertices, [x, y]]);
    }

    // If circle tool is active (center-edge mode)
    if (tool === 'circle' && isInImage) {
      if (!hasClasses) {
        toast.warning(`'${currentTask}' task에 등록된 클래스가 없습니다. 먼저 클래스를 추가해주세요.`, 4000);
        return;
      }

      if (!circleCenter) {
        // First click: set center
        setCircleCenter([x, y]);
      } else {
        // Second click: complete circle
        const dx = x - circleCenter[0];
        const dy = y - circleCenter[1];
        const radius = Math.sqrt(dx * dx + dy * dy);

        if (radius > 5) {
          // Convert canvas coords to image coords
          const centerImageX = (circleCenter[0] - imgX) / zoom;
          const centerImageY = (circleCenter[1] - imgY) / zoom;
          const radiusImage = radius / zoom;

          // Store pending circle and show class selector
          const pendingCircleData = {
            center: [
              Math.round(centerImageX * 100) / 100,
              Math.round(centerImageY * 100) / 100,
            ] as [number, number],
            radius: Math.round(radiusImage * 100) / 100,
          };
          (window as any).__pendingCircle = pendingCircleData;
          console.log('[Circle] Set pending circle:', pendingCircleData);
          setShowClassSelector(true);
        }
        setCircleCenter(null);
      }
    }

    // If circle3p tool is active (3-point mode)
    if (tool === 'circle3p' && isInImage) {
      if (!hasClasses && circle3pPoints.length === 0) {
        toast.warning(`'${currentTask}' task에 등록된 클래스가 없습니다. 먼저 클래스를 추가해주세요.`, 4000);
        return;
      }

      if (circle3pPoints.length < 2) {
        // Add point
        setCircle3pPoints([...circle3pPoints, [x, y]]);
      } else {
        // Third click: complete circle
        const p1: [number, number] = [(circle3pPoints[0][0] - imgX) / zoom, (circle3pPoints[0][1] - imgY) / zoom];
        const p2: [number, number] = [(circle3pPoints[1][0] - imgX) / zoom, (circle3pPoints[1][1] - imgY) / zoom];
        const p3: [number, number] = [(x - imgX) / zoom, (y - imgY) / zoom];

        const result = Circle3pTool.calculateCircleFrom3Points(p1, p2, p3);

        if (result) {
          // Store pending circle and show class selector
          (window as any).__pendingCircle = result;
          console.log('[Circle3P] Set pending circle:', result);
          setShowClassSelector(true);
        } else {
          toast.warning('세 점이 일직선상에 있어 원을 만들 수 없습니다.', 3000);
        }
        setCircle3pPoints([]);
      }
    }
  }, [
    canvasRef,
    image,
    canvasState,
    tool,
    selectedAnnotationId,
    annotations,
    isImageLocked,
    currentTask,
    polygonVertices,
    polylineVertices,
    circleCenter,
    circle3pPoints,
    isAnnotationVisible,
    getCurrentClasses,
    selectAnnotation,
    setSelectedBboxHandle,
    setIsResizing,
    setResizeHandle,
    setResizeStart,
    setCanvasCursor,
    setSelectedVertexIndex,
    setIsDraggingVertex,
    setDraggedVertexIndex,
    setIsDraggingPolygon,
    setPolygonDragStart,
    setSelectedCircleHandle,
    setIsResizingCircle,
    setCircleResizeStart,
    setIsDraggingCircle,
    setCircleDragStart,
    setIsPanning,
    setPanStart,
    startDrawing,
    setShowClassSelector,
    setPolygonVertices,
    setPolylineVertices,
    setCircleCenter,
    setCircle3pPoints,
    currentImage,
    setPendingBbox,
  ]);

  /**
   * Mouse move handler
   *
   * Handles:
   * - Cursor position updates
   * - Cursor style management
   * - Drag operations (vertex, polygon, circle, bbox, pan)
   */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !image) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Phase 2.10.2: Update cursor position for magnifier
    setCursorPos({ x, y });

    // Update cursor style based on position (before setCursor to avoid render race)
    if (!isResizing && !isDrawing && !isPanning && !isDraggingVertex && !isDraggingPolygon && !isDraggingCircle && !isResizingCircle) {
      const { zoom, pan } = canvasState;
      const scaledWidth = image.width * zoom;
      const scaledHeight = image.height * zoom;
      const imgX = (rect.width - scaledWidth) / 2 + pan.x;
      const imgY = (rect.height - scaledHeight) / 2 + pan.y;

      // Check if mouse is within image bounds
      const isInImage = x >= imgX && x <= imgX + scaledWidth && y >= imgY && y <= imgY + scaledHeight;

      // Default cursor based on tool and image position
      let newCursor = 'default';
      if (isInImage) {
        newCursor = (tool === 'bbox' || tool === 'polygon' || tool === 'polyline' || tool === 'circle' || tool === 'circle3p') ? 'crosshair' : 'default';
      }

      // Check if near first vertex for polygon closing
      if (tool === 'polygon' && polygonVertices.length >= 3) {
        const [firstX, firstY] = polygonVertices[0];
        const dx = x - firstX;
        const dy = y - firstY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 15) {
          newCursor = 'pointer';
        }
      }

      // Check if hovering over selected annotation's handle (only in select mode)
      if (tool === 'select' && selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);

        if (selectedAnn && selectedAnn.geometry.type === 'bbox') {
          const [bboxX, bboxY, bboxW, bboxH] = selectedAnn.geometry.bbox;
          const scaledX = bboxX * zoom + imgX;
          const scaledY = bboxY * zoom + imgY;
          const scaledW = bboxW * zoom;
          const scaledH = bboxH * zoom;

          const handle = getHandleAtPosition(x, y, scaledX, scaledY, scaledW, scaledH);
          if (handle) {
            newCursor = getCursorForHandle(handle);
          } else if (pointInBbox(x, y, scaledX, scaledY, scaledW, scaledH)) {
            newCursor = 'move';
          }
        }

        // Check polygon vertices and inside
        if (selectedAnn && selectedAnn.geometry.type === 'polygon') {
          const points = selectedAnn.geometry.points;
          const vertexThreshold = 8;

          // Check vertices first
          let onVertex = false;
          for (const [px, py] of points) {
            const scaledPx = px * zoom + imgX;
            const scaledPy = py * zoom + imgY;
            const dx = x - scaledPx;
            const dy = y - scaledPy;
            if (Math.sqrt(dx * dx + dy * dy) < vertexThreshold) {
              newCursor = 'move';
              onVertex = true;
              break;
            }
          }

          // Check inside polygon
          if (!onVertex) {
            const imageX = (x - imgX) / zoom;
            const imageY = (y - imgY) / zoom;
            if (polygonTool.isPointInside(imageX, imageY, selectedAnn)) {
              newCursor = 'move';
            }
          }
        }
      }

      // Check if hovering over any annotation (for click to select) - only in select mode
      if (tool === 'select' && isInImage && newCursor === 'default') {
        for (const ann of annotations) {
          if (!isAnnotationVisible(ann.id)) continue;

          if (ann.geometry.type === 'bbox') {
            const [bboxX, bboxY, bboxW, bboxH] = ann.geometry.bbox;
            const scaledX = bboxX * zoom + imgX;
            const scaledY = bboxY * zoom + imgY;
            const scaledW = bboxW * zoom;
            const scaledH = bboxH * zoom;

            if (pointInBbox(x, y, scaledX, scaledY, scaledW, scaledH)) {
              newCursor = 'pointer';
              break;
            }
          } else if (ann.geometry.type === 'polygon') {
            const imageX = (x - imgX) / zoom;
            const imageY = (y - imgY) / zoom;
            if (polygonTool.isPointInside(imageX, imageY, ann)) {
              newCursor = 'pointer';
              break;
            }
          } else if (ann.geometry.type === 'polyline') {
            const imageX = (x - imgX) / zoom;
            const imageY = (y - imgY) / zoom;
            if (polylineTool.isPointInside(imageX, imageY, ann)) {
              newCursor = 'pointer';
              break;
            }
          } else if (ann.geometry.type === 'circle') {
            const imageX = (x - imgX) / zoom;
            const imageY = (y - imgY) / zoom;
            if (circleTool.isPointInside(imageX, imageY, ann)) {
              newCursor = 'pointer';
              break;
            }
          }
        }
      }

      // Update cursor state
      setCanvasCursor(newCursor);
    }

    // Update cursor position for crosshair (after cursor style update)
    setCursor({ x, y });

    // Handle bbox resizing
    if (isResizing && resizeStart && selectedAnnotationId) {
      const { zoom } = canvasState;
      const deltaX = (x - resizeStart.x) / zoom;
      const deltaY = (y - resizeStart.y) / zoom;

      const [origX, origY, origW, origH] = resizeStart.bbox;

      let newX = origX;
      let newY = origY;
      let newW = origW;
      let newH = origH;

      // Update bbox based on handle
      const handle = resizeStart.handle || 'se';
      if (handle.includes('n')) {
        newY = origY + deltaY;
        newH = origH - deltaY;
      }
      if (handle.includes('s')) {
        newH = origH + deltaY;
      }
      if (handle.includes('w')) {
        newX = origX + deltaX;
        newW = origW - deltaX;
      }
      if (handle.includes('e')) {
        newW = origW + deltaX;
      }

      // Ensure minimum size
      if (newW < 5) newW = 5;
      if (newH < 5) newH = 5;

      // Round to 2 decimal places
      newX = Math.round(newX * 100) / 100;
      newY = Math.round(newY * 100) / 100;
      newW = Math.round(newW * 100) / 100;
      newH = Math.round(newH * 100) / 100;

      useAnnotationStore.setState({
        annotations: annotations.map(ann =>
          ann.id === selectedAnnotationId
            ? {
                ...ann,
                geometry: {
                  ...ann.geometry,
                  bbox: [newX, newY, newW, newH],
                },
              }
            : ann
        ),
      });
      return;
    }

    // Handle vertex dragging
    if (isDraggingVertex && selectedAnnotationId) {
      const { zoom, pan } = canvasState;
      const scaledWidth = image.width * zoom;
      const scaledHeight = image.height * zoom;
      const imgX = (rect.width - scaledWidth) / 2 + pan.x;
      const imgY = (rect.height - scaledHeight) / 2 + pan.y;

      const imageX = (x - imgX) / zoom;
      const imageY = (y - imgY) / zoom;

      // Clip to image bounds and round to 2 decimal places
      const clippedX = Math.round(Math.max(0, Math.min(image.width, imageX)) * 100) / 100;
      const clippedY = Math.round(Math.max(0, Math.min(image.height, imageY)) * 100) / 100;

      const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (selectedAnn && (selectedAnn.geometry.type === 'polygon' || selectedAnn.geometry.type === 'polyline')) {
        const points = selectedAnn.geometry.points;
        const selectedVertexIndex = useAnnotationStore.getState().selectedVertexIndex;
        if (selectedVertexIndex !== null && selectedVertexIndex < points.length) {
          const newPoints = points.map((p, i): [number, number] =>
            i === selectedVertexIndex ? [clippedX, clippedY] : p
          );

          useAnnotationStore.setState({
            annotations: annotations.map(ann =>
              ann.id === selectedAnnotationId
                ? {
                    ...ann,
                    geometry: {
                      ...ann.geometry,
                      points: newPoints,
                    },
                  }
                : ann
            ),
          });
        }
      }
      return;
    }

    // Handle polygon dragging
    if (isDraggingPolygon && polygonDragStart && selectedAnnotationId) {
      const { zoom, pan } = canvasState;
      const scaledWidth = image.width * zoom;
      const scaledHeight = image.height * zoom;
      const imgX = (rect.width - scaledWidth) / 2 + pan.x;
      const imgY = (rect.height - scaledHeight) / 2 + pan.y;

      // Calculate delta in image coordinates
      const deltaX = (x - polygonDragStart.x) / zoom;
      const deltaY = (y - polygonDragStart.y) / zoom;

      // Move all vertices
      const newPoints = polygonDragStart.points.map(([px, py]): [number, number] => {
        // Clip to image bounds and round to 2 decimal places
        const newX = Math.round(Math.max(0, Math.min(image.width, px + deltaX)) * 100) / 100;
        const newY = Math.round(Math.max(0, Math.min(image.height, py + deltaY)) * 100) / 100;
        return [newX, newY];
      });

      useAnnotationStore.setState({
        annotations: annotations.map(ann =>
          ann.id === selectedAnnotationId
            ? {
                ...ann,
                geometry: {
                  ...ann.geometry,
                  points: newPoints,
                },
              }
            : ann
        ),
      });
      return;
    }

    // Handle circle dragging
    if (isDraggingCircle && circleDragStart && selectedAnnotationId) {
      const { zoom, pan } = canvasState;
      const scaledWidth = image.width * zoom;
      const scaledHeight = image.height * zoom;
      const imgX = (rect.width - scaledWidth) / 2 + pan.x;
      const imgY = (rect.height - scaledHeight) / 2 + pan.y;

      // Calculate delta in image coordinates
      const deltaX = (x - circleDragStart.x) / zoom;
      const deltaY = (y - circleDragStart.y) / zoom;

      // Move center
      const newCenterX = Math.round(Math.max(0, Math.min(image.width, circleDragStart.center[0] + deltaX)) * 100) / 100;
      const newCenterY = Math.round(Math.max(0, Math.min(image.height, circleDragStart.center[1] + deltaY)) * 100) / 100;

      useAnnotationStore.setState({
        annotations: annotations.map(ann =>
          ann.id === selectedAnnotationId
            ? {
                ...ann,
                geometry: {
                  ...ann.geometry,
                  center: [newCenterX, newCenterY],
                },
              }
            : ann
        ),
      });
      return;
    }

    // Handle circle resizing
    if (isResizingCircle && circleResizeStart && selectedAnnotationId) {
      const { zoom } = canvasState;

      // Calculate delta based on handle direction
      const deltaX = (x - circleResizeStart.x) / zoom;
      const deltaY = (y - circleResizeStart.y) / zoom;

      let delta = 0;
      switch (circleResizeStart.handle) {
        case 'n':
          // N handle: up (negative deltaY) should increase radius
          delta = -deltaY;
          break;
        case 's':
          // S handle: down (positive deltaY) should increase radius
          delta = deltaY;
          break;
        case 'e':
          // E handle: right (positive deltaX) should increase radius
          delta = deltaX;
          break;
        case 'w':
          // W handle: left (negative deltaX) should increase radius
          delta = -deltaX;
          break;
        default:
          delta = Math.sqrt(deltaX * deltaX + deltaY * deltaY) * Math.sign(deltaX + deltaY);
      }

      // New radius
      const newRadius = Math.round(Math.max(5, circleResizeStart.radius + delta) * 100) / 100;

      useAnnotationStore.setState({
        annotations: annotations.map(ann =>
          ann.id === selectedAnnotationId
            ? {
                ...ann,
                geometry: {
                  ...ann.geometry,
                  radius: newRadius,
                },
              }
            : ann
        ),
      });
      return;
    }

    // Handle panning
    if (isPanning && panStart) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setPan({
        x: canvasState.pan.x + deltaX,
        y: canvasState.pan.y + deltaY,
      });
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Handle drawing
    if (isDrawing) {
      updateDrawing({ x, y });
    }
  }, [
    canvasRef,
    image,
    canvasState,
    tool,
    selectedAnnotationId,
    annotations,
    isResizing,
    isDrawing,
    isPanning,
    isDraggingVertex,
    isDraggingPolygon,
    isDraggingCircle,
    isResizingCircle,
    polygonVertices,
    resizeStart,
    polygonDragStart,
    circleDragStart,
    circleResizeStart,
    panStart,
    isAnnotationVisible,
    setCursorPos,
    setCanvasCursor,
    setCursor,
    setPan,
    setPanStart,
    updateDrawing,
  ]);

  /**
   * Mouse up handler
   *
   * Handles:
   * - Ending drag operations with backend saves
   * - Drawing completion
   * - Image status updates
   */
  const handleMouseUp = useCallback(async (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Stop vertex dragging and save to backend
    if (isDraggingVertex && selectedAnnotationId) {
      setIsDraggingVertex(false);
      setDraggedVertexIndex(null);
      setCanvasCursor('move');

      // Save updated polygon/polyline to backend
      const updatedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (updatedAnn && (updatedAnn.geometry.type === 'polygon' || updatedAnn.geometry.type === 'polyline') && project && currentImage && image) {
        try {
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              ...updatedAnn.geometry,
              image_width: image.width,
              image_height: image.height,
            },
          };
          await updateAnnotation(updatedAnn.id, updateData);

          // Update image status to in-progress and unconfirm
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
        } catch (error) {
          console.error('Failed to save vertex change:', error);
          toast.error('Failed to save changes');
        }
      }
      return;
    }

    // Stop polygon/polyline dragging and save to backend
    if (isDraggingPolygon && selectedAnnotationId) {
      setIsDraggingPolygon(false);
      setPolygonDragStart(null);
      setCanvasCursor('move');

      // Save updated polygon/polyline to backend
      const updatedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (updatedAnn && (updatedAnn.geometry.type === 'polygon' || updatedAnn.geometry.type === 'polyline') && project && currentImage && image) {
        try {
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              ...updatedAnn.geometry,
              image_width: image.width,
              image_height: image.height,
            },
          };
          await updateAnnotation(updatedAnn.id, updateData);

          // Update image status to in-progress and unconfirm
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
        } catch (error) {
          console.error('Failed to save polygon/polyline move:', error);
          toast.error('Failed to save changes');
        }
      }
      return;
    }

    // Stop circle dragging and save to backend
    if (isDraggingCircle && selectedAnnotationId) {
      setIsDraggingCircle(false);
      setCircleDragStart(null);
      setCanvasCursor('move');

      // Save updated circle to backend
      const updatedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (updatedAnn && updatedAnn.geometry.type === 'circle' && project && currentImage && image) {
        try {
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              ...updatedAnn.geometry,
              image_width: image.width,
              image_height: image.height,
            },
          };
          await updateAnnotation(updatedAnn.id, updateData);

          // Update image status to in-progress and unconfirm
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
        } catch (error) {
          console.error('Failed to save circle move:', error);
          toast.error('Failed to save changes');
        }
      }
      return;
    }

    // Stop circle resizing and save to backend
    if (isResizingCircle && selectedAnnotationId) {
      setIsResizingCircle(false);
      setCircleResizeStart(null);
      // Keep selectedCircleHandle for keyboard control
      setCanvasCursor('move');

      // Save updated circle to backend
      const updatedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (updatedAnn && updatedAnn.geometry.type === 'circle' && project && currentImage && image) {
        try {
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              ...updatedAnn.geometry,
              image_width: image.width,
              image_height: image.height,
            },
          };
          await updateAnnotation(updatedAnn.id, updateData);

          // Update image status to in-progress and unconfirm
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
        } catch (error) {
          console.error('Failed to save circle resize:', error);
          toast.error('Failed to save changes');
        }
      }
      return;
    }

    // Stop resizing and save to backend
    if (isResizing && selectedAnnotationId) {
      setIsResizing(false);
      setResizeHandle(null);
      setResizeStart(null);
      // Reset cursor to move (still inside bbox)
      setCanvasCursor('move');

      // Save updated bbox to backend (with clipping)
      const updatedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (updatedAnn && updatedAnn.geometry.type === 'bbox' && project && currentImage) {
        try {
          // Get bbox values
          const bbox = updatedAnn.geometry.bbox as number[];
          let [bx, by, bw, bh] = bbox;

          // Clip to image bounds
          const imgWidth = image?.width || currentImage.width || 0;
          const imgHeight = image?.height || currentImage.height || 0;
          let wasClipped = false;

          // Clip left edge
          if (bx < 0) {
            bw += bx;
            bx = 0;
            wasClipped = true;
          }
          // Clip top edge
          if (by < 0) {
            bh += by;
            by = 0;
            wasClipped = true;
          }
          // Clip right edge
          if (bx + bw > imgWidth) {
            bw = imgWidth - bx;
            wasClipped = true;
          }
          // Clip bottom edge
          if (by + bh > imgHeight) {
            bh = imgHeight - by;
            wasClipped = true;
          }

          // Ensure positive dimensions
          bw = Math.max(0, bw);
          bh = Math.max(0, bh);

          // Round to 2 decimal places
          bx = Math.round(bx * 100) / 100;
          by = Math.round(by * 100) / 100;
          bw = Math.round(bw * 100) / 100;
          bh = Math.round(bh * 100) / 100;

          // Show warning if clipped
          if (wasClipped) {
            toast.warning('BBox가 이미지 영역을 벗어나 자동으로 조정되었습니다.', 4000);
          }

          // Update geometry with clipped values
          const clippedGeometry = {
            type: 'bbox',
            bbox: [bx, by, bw, bh],
            image_width: imgWidth,
            image_height: imgHeight,
          };

          // Update local store with clipped geometry
          useAnnotationStore.setState((state) => ({
            annotations: state.annotations.map(ann =>
              ann.id === selectedAnnotationId
                ? { ...ann, geometry: clippedGeometry }
                : ann
            )
          }));

          const updateData: AnnotationUpdateRequest = {
            geometry: clippedGeometry,
          };
          await updateAnnotation(selectedAnnotationId, updateData);

          // Update image status to in_progress and unconfirm
          // Update both images array and currentImage for immediate UI update
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
            )
          }));
        } catch (err) {
          console.error('Failed to update annotation:', err);
          // TODO: Show error toast
        }
      }
      return;
    }

    // Stop panning
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    // Finish drawing
    if (isDrawing && drawingStart && image) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentPos = canvasState.cursor;

      // Calculate bbox in canvas coordinates
      const x1 = Math.min(drawingStart.x, currentPos.x);
      const y1 = Math.min(drawingStart.y, currentPos.y);
      const w = Math.abs(currentPos.x - drawingStart.x);
      const h = Math.abs(currentPos.y - drawingStart.y);

      // Only create annotation if bbox has minimum size
      if (w > 5 && h > 5) {
        // Convert canvas coordinates to image coordinates
        const { zoom, pan } = canvasState;
        const scaledWidth = image.width * zoom;
        const scaledHeight = image.height * zoom;
        const imgX = (rect.width - scaledWidth) / 2 + pan.x;
        const imgY = (rect.height - scaledHeight) / 2 + pan.y;

        // Calculate bbox in image coordinates
        const bboxX = (x1 - imgX) / zoom;
        const bboxY = (y1 - imgY) / zoom;
        const bboxW = w / zoom;
        const bboxH = h / zoom;

        // Store pending bbox and show class selector
        setPendingBbox({ x: bboxX, y: bboxY, w: bboxW, h: bboxH });
        setShowClassSelector(true);
      }

      finishDrawing();
    }
  }, [
    isDraggingVertex,
    isDraggingPolygon,
    isDraggingCircle,
    isResizingCircle,
    isResizing,
    isPanning,
    isDrawing,
    selectedAnnotationId,
    annotations,
    project,
    currentImage,
    image,
    drawingStart,
    canvasState,
    canvasRef,
    setIsDraggingVertex,
    setDraggedVertexIndex,
    setCanvasCursor,
    setIsDraggingPolygon,
    setPolygonDragStart,
    setIsDraggingCircle,
    setCircleDragStart,
    setIsResizingCircle,
    setCircleResizeStart,
    setSelectedCircleHandle,
    setIsResizing,
    setResizeHandle,
    setResizeStart,
    setIsPanning,
    setPanStart,
    setPendingBbox,
    setShowClassSelector,
    finishDrawing,
  ]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}
