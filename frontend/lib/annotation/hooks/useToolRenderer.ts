/**
 * useToolRenderer Hook
 *
 * Provides tool preview rendering functions for the Canvas component.
 * Handles preview rendering for all annotation tools during creation.
 *
 * Phase 18.4: Canvas Architecture Refactoring
 * Extracted from Canvas.tsx lines 646-797 (~152 lines)
 *
 * @module hooks/useToolRenderer
 */

import { useCallback } from 'react';
import type { CanvasRenderContext } from '@/lib/annotation';
import { bboxTool, polygonTool, polylineTool, circleTool, circle3pTool } from '@/lib/annotation';

/**
 * Hook parameters
 */
export interface UseToolRendererParams {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  canvasState: any;
  preferences: any;
  drawingStart: { x: number; y: number } | null;
  polygonVertices: [number, number][];
  polylineVertices: [number, number][];
  circleCenter: [number, number] | null;
  circle3pPoints: [number, number][];
}

/**
 * Hook return type
 */
export interface UseToolRendererReturn {
  drawBboxPreview: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => void;
  drawPolygonPreview: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => void;
  drawPolylinePreview: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => void;
  drawCirclePreview: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => void;
  drawCircle3pPreview: (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => void;
}

/**
 * Tool preview rendering hook
 *
 * Provides rendering functions for tool previews during annotation creation.
 * Each function creates the appropriate render context and delegates to the tool's
 * renderPreview method.
 *
 * @param params - Hook parameters
 * @returns Tool preview rendering functions
 *
 * @example
 * ```tsx
 * const {
 *   drawBboxPreview,
 *   drawPolygonPreview,
 *   drawCirclePreview
 * } = useToolRenderer({
 *   canvasRef,
 *   canvasState,
 *   preferences,
 *   drawingStart,
 *   polygonVertices,
 *   polylineVertices,
 *   circleCenter,
 *   circle3pPoints
 * });
 *
 * // In rendering useEffect:
 * if (isDrawing && drawingStart && tool === 'bbox') {
 *   drawBboxPreview(ctx, x, y, zoom);
 * }
 * ```
 */
export function useToolRenderer(params: UseToolRendererParams): UseToolRendererReturn {
  const {
    canvasRef,
    canvasState,
    preferences,
    drawingStart,
    polygonVertices,
    polylineVertices,
    circleCenter,
    circle3pPoints,
  } = params;

  /**
   * Draw bbox preview while drawing
   */
  const drawBboxPreview = useCallback((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
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
  }, [canvasRef, canvasState, preferences, drawingStart]);

  /**
   * Draw polygon preview while drawing
   */
  const drawPolygonPreview = useCallback((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
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
  }, [canvasRef, canvasState, preferences, polygonVertices]);

  /**
   * Draw polyline preview while drawing
   */
  const drawPolylinePreview = useCallback((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
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
  }, [canvasRef, canvasState, preferences, polylineVertices]);

  /**
   * Draw circle preview (center-edge mode)
   */
  const drawCirclePreview = useCallback((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
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
  }, [canvasRef, canvasState, preferences, circleCenter]);

  /**
   * Draw circle 3-point preview
   */
  const drawCircle3pPreview = useCallback((ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
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
  }, [canvasRef, canvasState, preferences, circle3pPoints]);

  return {
    drawBboxPreview,
    drawPolygonPreview,
    drawPolylinePreview,
    drawCirclePreview,
    drawCircle3pPreview,
  };
}
