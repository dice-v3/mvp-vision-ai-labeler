/**
 * useToolState Hook
 *
 * Manages tool-specific state for drawing and editing annotations.
 * Consolidates 20+ tool-related useState declarations into a single managed state.
 *
 * Phase 18.3: Canvas Architecture Refactoring
 *
 * @module hooks/useToolState
 */

import { useState, useCallback } from 'react';

/**
 * Bbox tool state
 */
export interface BboxToolState {
  pendingBbox: { x: number; y: number; w: number; h: number } | null;
  isResizing: boolean;
  resizeHandle: string | null;
  resizeStart: { x: number; y: number; bbox: number[] } | null;
}

/**
 * Polygon tool state
 */
export interface PolygonToolState {
  polygonVertices: [number, number][];
  isDraggingVertex: boolean;
  draggedVertexIndex: number | null;
  isDraggingPolygon: boolean;
  polygonDragStart: { x: number; y: number; points: [number, number][] } | null;
}

/**
 * Polyline tool state
 */
export interface PolylineToolState {
  polylineVertices: [number, number][];
}

/**
 * Circle tool state
 */
export interface CircleToolState {
  circleCenter: [number, number] | null;
  isDraggingCircle: boolean;
  circleDragStart: { x: number; y: number; center: [number, number] } | null;
  isResizingCircle: boolean;
  circleResizeStart: { x: number; y: number; radius: number; handle: string } | null;
  selectedCircleHandle: string | null;
}

/**
 * Circle 3-point tool state
 */
export interface Circle3pToolState {
  circle3pPoints: [number, number][];
}

/**
 * Complete tool state
 */
export interface ToolState {
  bbox: BboxToolState;
  polygon: PolygonToolState;
  polyline: PolylineToolState;
  circle: CircleToolState;
  circle3p: Circle3pToolState;
}

/**
 * Hook return type
 */
export interface UseToolStateReturn {
  // Bbox tool
  pendingBbox: { x: number; y: number; w: number; h: number } | null;
  setPendingBbox: (bbox: { x: number; y: number; w: number; h: number } | null) => void;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  resizeHandle: string | null;
  setResizeHandle: (handle: string | null) => void;
  resizeStart: { x: number; y: number; bbox: number[] } | null;
  setResizeStart: (start: { x: number; y: number; bbox: number[] } | null) => void;

  // Polygon tool
  polygonVertices: [number, number][];
  setPolygonVertices: (vertices: [number, number][]) => void;
  isDraggingVertex: boolean;
  setIsDraggingVertex: (dragging: boolean) => void;
  draggedVertexIndex: number | null;
  setDraggedVertexIndex: (index: number | null) => void;
  isDraggingPolygon: boolean;
  setIsDraggingPolygon: (dragging: boolean) => void;
  polygonDragStart: { x: number; y: number; points: [number, number][] } | null;
  setPolygonDragStart: (start: { x: number; y: number; points: [number, number][] } | null) => void;

  // Polyline tool
  polylineVertices: [number, number][];
  setPolylineVertices: (vertices: [number, number][]) => void;

  // Circle tool
  circleCenter: [number, number] | null;
  setCircleCenter: (center: [number, number] | null) => void;
  isDraggingCircle: boolean;
  setIsDraggingCircle: (dragging: boolean) => void;
  circleDragStart: { x: number; y: number; center: [number, number] } | null;
  setCircleDragStart: (start: { x: number; y: number; center: [number, number] } | null) => void;
  isResizingCircle: boolean;
  setIsResizingCircle: (resizing: boolean) => void;
  circleResizeStart: { x: number; y: number; radius: number; handle: string } | null;
  setCircleResizeStart: (start: { x: number; y: number; radius: number; handle: string } | null) => void;
  selectedCircleHandle: string | null;
  setSelectedCircleHandle: (handle: string | null) => void;

  // Circle 3-point tool
  circle3pPoints: [number, number][];
  setCircle3pPoints: (points: [number, number][]) => void;

  // Reset actions
  resetBboxState: () => void;
  resetPolygonState: () => void;
  resetPolylineState: () => void;
  resetCircleState: () => void;
  resetCircle3pState: () => void;
  resetAllToolState: () => void;
}

/**
 * Tool-specific state management hook
 *
 * Manages state for all annotation tools:
 * - Bbox: Drawing, resizing, handle selection
 * - Polygon: Drawing, vertex dragging, polygon dragging
 * - Polyline: Drawing vertices
 * - Circle: Center/radius drawing, dragging, resizing
 * - Circle 3-point: Drawing from 3 points
 *
 * @returns Tool state and setters
 *
 * @example
 * ```tsx
 * const {
 *   pendingBbox,
 *   setPendingBbox,
 *   polygonVertices,
 *   setPolygonVertices,
 *   resetAllToolState
 * } = useToolState();
 *
 * // Start drawing bbox
 * setPendingBbox({ x: 10, y: 10, w: 0, h: 0 });
 *
 * // Reset when changing tools
 * resetAllToolState();
 * ```
 */
export function useToolState(): UseToolStateReturn {
  // Bbox tool state
  const [pendingBbox, setPendingBbox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; bbox: number[] } | null>(null);

  // Polygon tool state
  const [polygonVertices, setPolygonVertices] = useState<[number, number][]>([]);
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);
  const [draggedVertexIndex, setDraggedVertexIndex] = useState<number | null>(null);
  const [isDraggingPolygon, setIsDraggingPolygon] = useState(false);
  const [polygonDragStart, setPolygonDragStart] = useState<{ x: number; y: number; points: [number, number][] } | null>(null);

  // Polyline tool state
  const [polylineVertices, setPolylineVertices] = useState<[number, number][]>([]);

  // Circle tool state
  const [circleCenter, setCircleCenter] = useState<[number, number] | null>(null);
  const [isDraggingCircle, setIsDraggingCircle] = useState(false);
  const [circleDragStart, setCircleDragStart] = useState<{ x: number; y: number; center: [number, number] } | null>(null);
  const [isResizingCircle, setIsResizingCircle] = useState(false);
  const [circleResizeStart, setCircleResizeStart] = useState<{ x: number; y: number; radius: number; handle: string } | null>(null);
  const [selectedCircleHandle, setSelectedCircleHandle] = useState<string | null>(null);

  // Circle 3-point tool state
  const [circle3pPoints, setCircle3pPoints] = useState<[number, number][]>([]);

  /**
   * Reset bbox tool state
   */
  const resetBboxState = useCallback(() => {
    setPendingBbox(null);
    setIsResizing(false);
    setResizeHandle(null);
    setResizeStart(null);
  }, []);

  /**
   * Reset polygon tool state
   */
  const resetPolygonState = useCallback(() => {
    setPolygonVertices([]);
    setIsDraggingVertex(false);
    setDraggedVertexIndex(null);
    setIsDraggingPolygon(false);
    setPolygonDragStart(null);
  }, []);

  /**
   * Reset polyline tool state
   */
  const resetPolylineState = useCallback(() => {
    setPolylineVertices([]);
  }, []);

  /**
   * Reset circle tool state
   */
  const resetCircleState = useCallback(() => {
    setCircleCenter(null);
    setIsDraggingCircle(false);
    setCircleDragStart(null);
    setIsResizingCircle(false);
    setCircleResizeStart(null);
    setSelectedCircleHandle(null);
  }, []);

  /**
   * Reset circle 3-point tool state
   */
  const resetCircle3pState = useCallback(() => {
    setCircle3pPoints([]);
  }, []);

  /**
   * Reset all tool state
   */
  const resetAllToolState = useCallback(() => {
    resetBboxState();
    resetPolygonState();
    resetPolylineState();
    resetCircleState();
    resetCircle3pState();
  }, [resetBboxState, resetPolygonState, resetPolylineState, resetCircleState, resetCircle3pState]);

  return {
    // Bbox tool
    pendingBbox,
    setPendingBbox,
    isResizing,
    setIsResizing,
    resizeHandle,
    setResizeHandle,
    resizeStart,
    setResizeStart,

    // Polygon tool
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

    // Polyline tool
    polylineVertices,
    setPolylineVertices,

    // Circle tool
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

    // Circle 3-point tool
    circle3pPoints,
    setCircle3pPoints,

    // Reset actions
    resetBboxState,
    resetPolygonState,
    resetPolylineState,
    resetCircleState,
    resetCircle3pState,
    resetAllToolState,
  };
}
