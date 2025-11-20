/**
 * Polygon Annotation Tool
 *
 * Tool for drawing and editing polygons for segmentation tasks.
 * Uses multi-click vertex placement with ray casting for point detection.
 */

import {
  BaseAnnotationTool,
  CanvasRenderContext,
  CanvasMouseEvent,
  ToolState,
  ToolOperationResult,
  HandlePosition,
  AnnotationGeometry,
  PolygonGeometry,
} from '../AnnotationTool';
import type { Annotation } from '@/lib/stores/annotationStore';

export class PolygonTool extends BaseAnnotationTool {
  readonly name = 'Polygon';
  readonly type = 'polygon';
  readonly icon = 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'; // Polygon SVG path
  readonly shortcut = 'P';
  readonly cursor = 'crosshair';
  readonly supportedTasks = ['segmentation'];

  private handleSize = 8;
  private closeThreshold = 15; // Distance to first vertex to close polygon

  /**
   * Render polygon annotation on canvas
   */
  renderAnnotation(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    isSelected: boolean,
    classColor: string,
    className?: string
  ): void {
    if (annotation.geometry.type !== 'polygon') return;

    const points = annotation.geometry.points;
    if (points.length < 3) return;

    const { r, g, b } = this.parseColor(classColor);

    // Convert all points to canvas coordinates
    const canvasPoints = points.map(([x, y]) => this.toCanvasCoords(x, y, ctx));

    // Draw filled polygon
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
    for (let i = 1; i < canvasPoints.length; i++) {
      ctx.ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
    }
    ctx.ctx.closePath();

    // Fill with semi-transparent color
    const fillAlpha = isSelected ? 0.3 : 0.2;
    ctx.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillAlpha})`;
    ctx.ctx.fill();

    // Draw stroke
    ctx.ctx.strokeStyle = classColor;
    ctx.ctx.lineWidth = isSelected ? 3 : 2;
    ctx.ctx.stroke();

    // Draw label at centroid
    if (ctx.showLabels && className) {
      const centroid = this.calculateCentroid(canvasPoints);
      ctx.ctx.fillStyle = classColor;
      const textWidth = ctx.ctx.measureText(className).width;
      ctx.ctx.fillRect(centroid.x - textWidth / 2 - 4, centroid.y - 10, textWidth + 8, 20);
      ctx.ctx.fillStyle = '#ffffff';
      ctx.ctx.font = '12px sans-serif';
      ctx.ctx.fillText(className, centroid.x - textWidth / 2, centroid.y + 4);
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
    if (annotation.geometry.type !== 'polygon') return;

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
    const { r, g, b } = this.parseColor('#ef4444'); // red-500

    // Draw polygon lines
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(vertices[0][0], vertices[0][1]);
    for (let i = 1; i < vertices.length; i++) {
      ctx.ctx.lineTo(vertices[i][0], vertices[i][1]);
    }

    // Draw line to current cursor
    ctx.ctx.lineTo(state.currentCursor.x, state.currentCursor.y);

    // If near first vertex, show closing line
    if (vertices.length >= 3) {
      const dx = state.currentCursor.x - vertices[0][0];
      const dy = state.currentCursor.y - vertices[0][1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.closeThreshold) {
        ctx.ctx.lineTo(vertices[0][0], vertices[0][1]);
      }
    }

    ctx.ctx.strokeStyle = '#ef4444';
    ctx.ctx.setLineDash([5, 5]);
    ctx.ctx.lineWidth = 2;
    ctx.ctx.stroke();
    ctx.ctx.setLineDash([]);

    // Fill preview polygon if enough vertices
    if (vertices.length >= 3) {
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(vertices[0][0], vertices[0][1]);
      for (let i = 1; i < vertices.length; i++) {
        ctx.ctx.lineTo(vertices[i][0], vertices[i][1]);
      }
      ctx.ctx.closePath();
      ctx.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
      ctx.ctx.fill();
    }

    // Draw vertices
    const hs = 6;
    for (let i = 0; i < vertices.length; i++) {
      const [vx, vy] = vertices[i];

      // First vertex is special (close point)
      if (i === 0 && vertices.length >= 3) {
        const dx = state.currentCursor.x - vx;
        const dy = state.currentCursor.y - vy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.closeThreshold) {
          // Highlight close point
          ctx.ctx.fillStyle = '#22c55e'; // green-500
          ctx.ctx.beginPath();
          ctx.ctx.arc(vx, vy, hs + 2, 0, Math.PI * 2);
          ctx.ctx.fill();
        } else {
          ctx.ctx.fillStyle = '#ef4444';
        }
      } else {
        ctx.ctx.fillStyle = '#ef4444';
      }

      ctx.ctx.beginPath();
      ctx.ctx.arc(vx, vy, hs / 2, 0, Math.PI * 2);
      ctx.ctx.fill();
    }

    // Draw vertex count tooltip
    ctx.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const text = `Vertices: ${vertices.length} (${vertices.length < 3 ? 'min 3' : 'click first to close'})`;
    const textWidth = ctx.ctx.measureText(text).width;
    ctx.ctx.fillRect(state.currentCursor.x + 10, state.currentCursor.y - 25, textWidth + 10, 20);
    ctx.ctx.fillStyle = '#ffffff';
    ctx.ctx.font = '12px sans-serif';
    ctx.ctx.fillText(text, state.currentCursor.x + 15, state.currentCursor.y - 10);
  }

  /**
   * Handle mouse down - add vertex or close polygon
   */
  onMouseDown(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult {
    // If we have vertices being drawn, check if closing
    if (state.vertices && state.vertices.length >= 3) {
      const firstVertex = state.vertices[0];
      const dx = event.canvasX - firstVertex[0];
      const dy = event.canvasY - firstVertex[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.closeThreshold) {
        // Close the polygon
        return {
          geometry: {
            type: 'polygon',
            points: state.vertices,
          },
          showClassSelector: true,
          complete: true,
        };
      }
    }

    // Check if clicking on a handle of selected annotation for editing
    if (selectedAnnotation && selectedAnnotation.geometry.type === 'polygon') {
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
    let cursor = this.cursor;

    // If drawing, check if near first vertex to show close cursor
    if (state.vertices && state.vertices.length >= 3) {
      const firstVertex = state.vertices[0];
      const dx = event.canvasX - firstVertex[0];
      const dy = event.canvasY - firstVertex[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.closeThreshold) {
        cursor = 'pointer';
      }
    }

    // Check if hovering over selected annotation's handle
    if (selectedAnnotation && selectedAnnotation.geometry.type === 'polygon') {
      const vertexIndex = this.getVertexAtPosition(
        event.imageX,
        event.imageY,
        selectedAnnotation
      );
      if (vertexIndex !== -1) {
        cursor = 'move';
      } else if (this.isPointInside(event.imageX, event.imageY, selectedAnnotation)) {
        cursor = 'move';
      }
    }

    // Check if hovering over any annotation
    if (annotations && cursor === this.cursor && !state.vertices?.length) {
      for (const ann of annotations) {
        if (ann.geometry.type === 'polygon' && this.isPointInside(event.imageX, event.imageY, ann)) {
          cursor = 'pointer';
          break;
        }
      }
    }

    return { cursor };
  }

  /**
   * Handle mouse up - typically no-op for polygon (uses click-based drawing)
   */
  onMouseUp(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult {
    return {};
  }

  /**
   * Handle key down - Enter to close, Escape to cancel
   */
  onKeyDown(
    key: string,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult {
    if (key === 'Enter' && state.vertices && state.vertices.length >= 3) {
      // Close polygon with Enter
      return {
        geometry: {
          type: 'polygon',
          points: state.vertices,
        },
        showClassSelector: true,
        complete: true,
      };
    }

    if (key === 'Escape') {
      // Cancel drawing
      return {
        cancel: true,
        complete: true,
      };
    }

    return {};
  }

  /**
   * Get handle at position (returns vertex index as HandlePosition)
   */
  getHandleAtPosition(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): HandlePosition {
    if (annotation.geometry.type !== 'polygon') return null;

    const vertexIndex = this.getVertexAtPosition(imageX, imageY, annotation);
    if (vertexIndex !== -1) {
      // Return a handle identifier - we'll use this for vertex editing
      return 'n'; // Placeholder - actual vertex editing handled separately
    }

    return null;
  }

  /**
   * Get vertex index at position
   */
  getVertexAtPosition(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): number {
    if (annotation.geometry.type !== 'polygon') return -1;

    const points = annotation.geometry.points;
    const threshold = this.handleSize / 2 + 4;

    for (let i = 0; i < points.length; i++) {
      const [px, py] = points[i];
      const dx = imageX - px;
      const dy = imageY - py;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Check if point is inside polygon using ray casting algorithm
   */
  isPointInside(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): boolean {
    if (annotation.geometry.type !== 'polygon') return false;

    const points = annotation.geometry.points;
    if (points.length < 3) return false;

    // Ray casting algorithm
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];

      if (
        yi > imageY !== yj > imageY &&
        imageX < ((xj - xi) * (imageY - yi)) / (yj - yi) + xi
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Get cursor style for position
   */
  getCursorAtPosition(
    imageX: number,
    imageY: number,
    annotation: Annotation,
    isSelected: boolean
  ): string {
    if (!isSelected) {
      return this.isPointInside(imageX, imageY, annotation) ? 'pointer' : 'default';
    }

    const vertexIndex = this.getVertexAtPosition(imageX, imageY, annotation);
    if (vertexIndex !== -1) {
      return 'move';
    }

    return this.isPointInside(imageX, imageY, annotation) ? 'move' : 'default';
  }

  /**
   * Validate polygon geometry
   */
  validateGeometry(geometry: AnnotationGeometry): boolean {
    if (geometry.type !== 'polygon') return false;
    // Must have at least 3 vertices
    return geometry.points.length >= 3;
  }

  /**
   * Get default geometry
   */
  getDefaultGeometry(): PolygonGeometry {
    return {
      type: 'polygon',
      points: [[0, 0], [100, 0], [100, 100]],
    };
  }

  /**
   * Clone geometry
   */
  cloneGeometry(geometry: AnnotationGeometry): PolygonGeometry {
    if (geometry.type !== 'polygon') {
      return this.getDefaultGeometry();
    }
    return {
      type: 'polygon',
      points: geometry.points.map(([x, y]) => [x, y] as [number, number]),
    };
  }

  /**
   * Calculate polygon area using shoelace formula
   */
  calculateArea(points: [number, number][]): number {
    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i][0] * points[j][1];
      area -= points[j][0] * points[i][1];
    }

    return Math.abs(area / 2);
  }

  /**
   * Calculate centroid of polygon
   */
  private calculateCentroid(points: { x: number; y: number }[]): { x: number; y: number } {
    let sumX = 0;
    let sumY = 0;

    for (const point of points) {
      sumX += point.x;
      sumY += point.y;
    }

    return {
      x: sumX / points.length,
      y: sumY / points.length,
    };
  }

  /**
   * Move polygon by delta
   */
  movePolygon(
    originalPoints: [number, number][],
    deltaX: number,
    deltaY: number
  ): [number, number][] {
    return originalPoints.map(([x, y]) => [x + deltaX, y + deltaY]);
  }

  /**
   * Move single vertex by delta
   */
  moveVertex(
    originalPoints: [number, number][],
    vertexIndex: number,
    deltaX: number,
    deltaY: number
  ): [number, number][] {
    return originalPoints.map(([x, y], i) => {
      if (i === vertexIndex) {
        return [x + deltaX, y + deltaY];
      }
      return [x, y];
    });
  }
}

// Export singleton instance
export const polygonTool = new PolygonTool();
