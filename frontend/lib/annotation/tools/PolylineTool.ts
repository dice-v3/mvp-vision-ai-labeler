/**
 * Polyline Annotation Tool
 *
 * Tool for drawing and editing polylines for geometry tasks.
 * Similar to polygon but with open path (no closing).
 */

import {
  BaseAnnotationTool,
  CanvasRenderContext,
  CanvasMouseEvent,
  ToolState,
  ToolOperationResult,
  HandlePosition,
  AnnotationGeometry,
} from '../AnnotationTool';
import type { Annotation } from '@/lib/stores/annotationStore';

export interface PolylineGeometry extends AnnotationGeometry {
  type: 'polyline';
  points: [number, number][];
  image_width?: number;
  image_height?: number;
}

export class PolylineTool extends BaseAnnotationTool {
  readonly name = 'Polyline';
  readonly type = 'polyline';
  readonly icon = 'M3 17l6-6 4 4 8-8'; // Polyline SVG path
  readonly shortcut = 'L';
  readonly cursor = 'crosshair';
  readonly supportedTasks = ['geometry'];

  private handleSize = 8;

  /**
   * Render polyline annotation on canvas
   */
  renderAnnotation(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    isSelected: boolean,
    classColor: string,
    className?: string
  ): void {
    if (annotation.geometry.type !== 'polyline') return;

    const points = annotation.geometry.points;
    if (points.length < 2) return;

    // Convert all points to canvas coordinates
    const canvasPoints = points.map(([x, y]) => this.toCanvasCoords(x, y, ctx));

    // Draw polyline (open path, no fill)
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (let i = 1; i < canvasPoints.length; i++) {
      ctx.ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
    }
    // Note: no closePath() - open path

    // Draw stroke
    ctx.ctx.strokeStyle = classColor;
    ctx.ctx.lineWidth = isSelected ? 3 : 2;
    ctx.ctx.stroke();

    // Draw start/end indicators
    const startPoint = canvasPoints[0];
    const endPoint = canvasPoints[canvasPoints.length - 1];

    // Start point (circle)
    ctx.ctx.fillStyle = classColor;
    ctx.ctx.beginPath();
    ctx.ctx.arc(startPoint.x, startPoint.y, 4, 0, Math.PI * 2);
    ctx.ctx.fill();

    // End point (arrow or larger circle)
    ctx.ctx.beginPath();
    ctx.ctx.arc(endPoint.x, endPoint.y, 5, 0, Math.PI * 2);
    ctx.ctx.fill();

    // Draw label at midpoint
    if (ctx.showLabels && className) {
      const midIndex = Math.floor(canvasPoints.length / 2);
      const midPoint = canvasPoints[midIndex];
      ctx.ctx.fillStyle = classColor;
      const textWidth = ctx.ctx.measureText(className).width;
      ctx.ctx.fillRect(midPoint.x - textWidth / 2 - 4, midPoint.y - 20, textWidth + 8, 20);
      ctx.ctx.fillStyle = '#ffffff';
      ctx.ctx.font = '12px sans-serif';
      ctx.ctx.fillText(className, midPoint.x - textWidth / 2, midPoint.y - 6);
    }
  }

  /**
   * Render handles for selected annotation
   */
  renderHandles(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    classColor: string
  ): void {
    if (annotation.geometry.type !== 'polyline') return;

    const points = annotation.geometry.points;
    const hs = this.handleSize;

    ctx.ctx.fillStyle = classColor;
    ctx.ctx.strokeStyle = '#ffffff';
    ctx.ctx.lineWidth = 1;

    // Draw vertex handles
    for (const [x, y] of points) {
      const scaled = this.toCanvasCoords(x, y, ctx);
      ctx.ctx.fillRect(scaled.x - hs / 2, scaled.y - hs / 2, hs, hs);
      ctx.ctx.strokeRect(scaled.x - hs / 2, scaled.y - hs / 2, hs, hs);
    }
  }

  /**
   * Render preview while drawing
   */
  renderPreview(
    ctx: CanvasRenderContext,
    state: ToolState
  ): void {
    if (!state.vertices || state.vertices.length === 0) return;

    const vertices = state.vertices;

    // Draw polyline
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(vertices[0][0], vertices[0][1]);
    for (let i = 1; i < vertices.length; i++) {
      ctx.ctx.lineTo(vertices[i][0], vertices[i][1]);
    }

    // Draw line to current cursor
    ctx.ctx.lineTo(state.currentCursor.x, state.currentCursor.y);

    ctx.ctx.strokeStyle = '#ef4444';
    ctx.ctx.setLineDash([5, 5]);
    ctx.ctx.lineWidth = 2;
    ctx.ctx.stroke();
    ctx.ctx.setLineDash([]);

    // Draw vertices
    const hs = 6;
    for (let i = 0; i < vertices.length; i++) {
      const [vx, vy] = vertices[i];
      ctx.ctx.fillStyle = '#ef4444';
      ctx.ctx.beginPath();
      ctx.ctx.arc(vx, vy, hs / 2, 0, Math.PI * 2);
      ctx.ctx.fill();
    }

    // Draw vertex count tooltip
    ctx.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const text = `Vertices: ${vertices.length} (${vertices.length < 2 ? 'min 2' : 'Enter to complete'})`;
    const textWidth = ctx.ctx.measureText(text).width;
    ctx.ctx.fillRect(state.currentCursor.x + 10, state.currentCursor.y - 25, textWidth + 10, 20);
    ctx.ctx.fillStyle = '#ffffff';
    ctx.ctx.font = '12px sans-serif';
    ctx.ctx.fillText(text, state.currentCursor.x + 15, state.currentCursor.y - 10);
  }

  /**
   * Handle mouse down - add vertex
   */
  onMouseDown(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult {
    // Check if clicking on a handle of selected annotation for editing
    if (selectedAnnotation && selectedAnnotation.geometry.type === 'polyline') {
      const handle = this.getHandleAtPosition(
        event.imageX,
        event.imageY,
        selectedAnnotation
      );
      if (handle) {
        return {
          cursor: 'move',
        };
      }
    }

    return {
      cursor: 'crosshair',
    };
  }

  /**
   * Handle mouse move
   */
  onMouseMove(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation,
    annotations?: Annotation[]
  ): ToolOperationResult {
    return {
      cursor: 'crosshair',
    };
  }

  /**
   * Handle mouse up
   */
  onMouseUp(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult {
    return {};
  }

  /**
   * Get handle at position
   */
  getHandleAtPosition(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): HandlePosition | null {
    if (annotation.geometry.type !== 'polyline') return null;

    const points = annotation.geometry.points;
    const threshold = this.handleSize;

    for (let i = 0; i < points.length; i++) {
      const [px, py] = points[i];
      const dx = imageX - px;
      const dy = imageY - py;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        return { type: 'vertex', index: i };
      }
    }

    return null;
  }

  /**
   * Get bounding box of annotation
   */
  getBoundingBox(annotation: Annotation): { x: number; y: number; width: number; height: number } | null {
    if (annotation.geometry.type !== 'polyline') return null;

    const points = annotation.geometry.points;
    if (points.length < 2) return null;

    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);

    return {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    };
  }

  /**
   * Check if point is on polyline
   */
  isPointInside(imageX: number, imageY: number, annotation: Annotation): boolean {
    if (annotation.geometry.type !== 'polyline') return false;

    const points = annotation.geometry.points;
    if (points.length < 2) return false;

    // For polyline, check if point is near any edge
    const threshold = 8;

    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];

      // Calculate distance from point to line segment
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lengthSq = dx * dx + dy * dy;

      if (lengthSq === 0) continue;

      let t = ((imageX - x1) * dx + (imageY - y1) * dy) / lengthSq;
      t = Math.max(0, Math.min(1, t));

      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;

      const distX = imageX - closestX;
      const distY = imageY - closestY;
      const distance = Math.sqrt(distX * distX + distY * distY);

      if (distance < threshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resize annotation (not applicable for polyline - use vertex editing)
   */
  resize(
    annotation: Annotation,
    handle: HandlePosition,
    deltaX: number,
    deltaY: number
  ): AnnotationGeometry | null {
    return null;
  }

  /**
   * Move annotation
   */
  move(
    annotation: Annotation,
    deltaX: number,
    deltaY: number
  ): AnnotationGeometry | null {
    if (annotation.geometry.type !== 'polyline') return null;

    const points = annotation.geometry.points;
    const newPoints = points.map(([x, y]): [number, number] => [x + deltaX, y + deltaY]);

    return {
      type: 'polyline',
      points: newPoints,
      image_width: annotation.geometry.image_width,
      image_height: annotation.geometry.image_height,
    };
  }

  /**
   * Helper to parse color string to RGB
   */
  private parseColor(color: string): { r: number; g: number; b: number } {
    // Simple hex parser
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return { r: 0, g: 0, b: 0 };
  }
}

// Export singleton instance
export const polylineTool = new PolylineTool();
