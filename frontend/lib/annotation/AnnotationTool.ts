/**
 * Abstract Annotation Tool Interface
 *
 * Base interface for all annotation tools (BBox, Polygon, Classification, etc.)
 * Each tool implements this interface to provide consistent behavior.
 */

import type { Annotation } from '@/lib/stores/annotationStore';

// Geometry types for different annotation tools
export interface BBoxGeometry {
  type: 'bbox';
  bbox: [number, number, number, number]; // [x, y, width, height]
}

export interface RotatedBBoxGeometry {
  type: 'rotated_bbox';
  bbox: [number, number, number, number, number]; // [x, y, width, height, angle]
}

export interface PolygonGeometry {
  type: 'polygon';
  points: [number, number][]; // [[x1, y1], [x2, y2], ...]
}

export interface ClassificationGeometry {
  type: 'classification';
  // No geometry for image-level classification
}

export interface KeypointsGeometry {
  type: 'keypoints';
  keypoints: [number, number, number][]; // [[x, y, visibility], ...]
  skeleton?: [number, number][]; // [[start_idx, end_idx], ...]
}

export interface TextGeometry {
  type: 'text';
  // Text can be image-level (no geometry) or attached to another annotation
  text_fields: Record<string, string>;
}

export type AnnotationGeometry =
  | BBoxGeometry
  | RotatedBBoxGeometry
  | PolygonGeometry
  | ClassificationGeometry
  | KeypointsGeometry
  | TextGeometry;

// Mouse event with canvas context
export interface CanvasMouseEvent {
  // Canvas coordinates
  canvasX: number;
  canvasY: number;
  // Image coordinates (accounting for zoom/pan)
  imageX: number;
  imageY: number;
  // Original event
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

// Canvas rendering context
export interface CanvasRenderContext {
  ctx: CanvasRenderingContext2D;
  // Image offset in canvas
  offsetX: number;
  offsetY: number;
  // Current zoom level
  zoom: number;
  // Canvas dimensions
  canvasWidth: number;
  canvasHeight: number;
  // Preferences
  showLabels: boolean;
  darkMode: boolean;
}

// Tool state for drawing operations
export interface ToolState {
  isDrawing: boolean;
  drawingStart: { x: number; y: number } | null;
  currentCursor: { x: number; y: number };
  // For polygon, track vertices being drawn
  vertices?: [number, number][];
  // For keypoints, track current keypoint index
  currentKeypoint?: number;
}

// Result of tool operations
export interface ToolOperationResult {
  // Geometry created/updated
  geometry?: AnnotationGeometry;
  // Whether to show class selector
  showClassSelector?: boolean;
  // Cursor style to set
  cursor?: string;
  // Whether operation is complete
  complete?: boolean;
  // Whether to cancel operation
  cancel?: boolean;
}

// Handle position for resizing
export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

/**
 * Abstract Annotation Tool Interface
 */
export interface IAnnotationTool {
  // Tool metadata
  readonly name: string;
  readonly type: string; // 'bbox', 'polygon', 'classification', etc.
  readonly icon: string; // SVG path or icon name
  readonly shortcut: string; // Keyboard shortcut
  readonly cursor: string; // Default cursor style

  // Supported task types
  readonly supportedTasks: string[];

  /**
   * Render annotation on canvas
   */
  renderAnnotation(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    isSelected: boolean,
    classColor: string,
    className?: string
  ): void;

  /**
   * Render preview while drawing
   */
  renderPreview(
    ctx: CanvasRenderContext,
    state: ToolState
  ): void;

  /**
   * Render resize/edit handles for selected annotation
   */
  renderHandles(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    classColor: string
  ): void;

  /**
   * Handle mouse down event
   */
  onMouseDown(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult;

  /**
   * Handle mouse move event
   */
  onMouseMove(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation,
    annotations?: Annotation[]
  ): ToolOperationResult;

  /**
   * Handle mouse up event
   */
  onMouseUp(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult;

  /**
   * Handle key down event
   */
  onKeyDown?(
    key: string,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult;

  /**
   * Get handle at position (for resizing)
   */
  getHandleAtPosition?(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): HandlePosition;

  /**
   * Check if point is inside annotation
   */
  isPointInside(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): boolean;

  /**
   * Get cursor style for position
   */
  getCursorAtPosition(
    imageX: number,
    imageY: number,
    annotation: Annotation,
    isSelected: boolean
  ): string;

  /**
   * Validate geometry
   */
  validateGeometry(geometry: AnnotationGeometry): boolean;

  /**
   * Get default geometry for new annotation
   */
  getDefaultGeometry(): AnnotationGeometry;

  /**
   * Clone geometry
   */
  cloneGeometry(geometry: AnnotationGeometry): AnnotationGeometry;
}

/**
 * Base class with common functionality
 */
export abstract class BaseAnnotationTool implements IAnnotationTool {
  abstract readonly name: string;
  abstract readonly type: string;
  abstract readonly icon: string;
  abstract readonly shortcut: string;
  abstract readonly cursor: string;
  abstract readonly supportedTasks: string[];

  abstract renderAnnotation(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    isSelected: boolean,
    classColor: string,
    className?: string
  ): void;

  abstract renderPreview(
    ctx: CanvasRenderContext,
    state: ToolState
  ): void;

  abstract renderHandles(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    classColor: string
  ): void;

  abstract onMouseDown(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult;

  abstract onMouseMove(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation,
    annotations?: Annotation[]
  ): ToolOperationResult;

  abstract onMouseUp(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult;

  abstract isPointInside(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): boolean;

  abstract getCursorAtPosition(
    imageX: number,
    imageY: number,
    annotation: Annotation,
    isSelected: boolean
  ): string;

  abstract validateGeometry(geometry: AnnotationGeometry): boolean;

  abstract getDefaultGeometry(): AnnotationGeometry;

  abstract cloneGeometry(geometry: AnnotationGeometry): AnnotationGeometry;

  // Helper: Parse hex color to RGB
  protected parseColor(hex: string): { r: number; g: number; b: number } {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  // Helper: Convert image coordinates to canvas coordinates
  protected toCanvasCoords(
    imageX: number,
    imageY: number,
    ctx: CanvasRenderContext
  ): { x: number; y: number } {
    return {
      x: imageX * ctx.zoom + ctx.offsetX,
      y: imageY * ctx.zoom + ctx.offsetY,
    };
  }

  // Helper: Convert canvas coordinates to image coordinates
  protected toImageCoords(
    canvasX: number,
    canvasY: number,
    ctx: CanvasRenderContext
  ): { x: number; y: number } {
    return {
      x: (canvasX - ctx.offsetX) / ctx.zoom,
      y: (canvasY - ctx.offsetY) / ctx.zoom,
    };
  }
}
