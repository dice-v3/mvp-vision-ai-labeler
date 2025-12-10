/**
 * Circle 3-Point Annotation Tool
 *
 * Tool for drawing circles by clicking 3 points on the circumference.
 * For geometry detection tasks.
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

export class Circle3pTool extends BaseAnnotationTool {
  readonly name = 'Circle (3-Point)';
  readonly type = 'circle3p';
  readonly icon = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M8 8h.01 M16 8h.01 M8 16h.01'; // Circle with 3 dots
  readonly shortcut = 'Shift+C';
  readonly cursor = 'crosshair';
  readonly supportedTasks = ['geometry'];

  private handleSize = 8;

  /**
   * Calculate circle from 3 points on circumference
   * Returns center and radius
   */
  static calculateCircleFrom3Points(
    p1: [number, number],
    p2: [number, number],
    p3: [number, number]
  ): { center: [number, number]; radius: number } | null {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const [x3, y3] = p3;

    // Calculate the perpendicular bisector of the first two points
    const midAB = [(x1 + x2) / 2, (y1 + y2) / 2];
    const slopeAB = (y2 - y1) / (x2 - x1);

    // Calculate the perpendicular bisector of the second two points
    const midBC = [(x2 + x3) / 2, (y2 + y3) / 2];
    const slopeBC = (y3 - y2) / (x3 - x2);

    // Handle vertical lines
    let centerX: number, centerY: number;

    if (Math.abs(slopeAB) === Infinity || isNaN(slopeAB)) {
      // AB is vertical
      centerX = midAB[0];
      const perpSlopeBC = -1 / slopeBC;
      centerY = midBC[1] + perpSlopeBC * (centerX - midBC[0]);
    } else if (Math.abs(slopeBC) === Infinity || isNaN(slopeBC)) {
      // BC is vertical
      centerX = midBC[0];
      const perpSlopeAB = -1 / slopeAB;
      centerY = midAB[1] + perpSlopeAB * (centerX - midAB[0]);
    } else if (Math.abs(slopeAB - slopeBC) < 0.0001) {
      // Points are collinear
      return null;
    } else {
      // General case
      const perpSlopeAB = -1 / slopeAB;
      const perpSlopeBC = -1 / slopeBC;

      // y - midAB[1] = perpSlopeAB * (x - midAB[0])
      // y - midBC[1] = perpSlopeBC * (x - midBC[0])
      // Solve for intersection

      centerX = (midBC[1] - midAB[1] + perpSlopeAB * midAB[0] - perpSlopeBC * midBC[0]) /
                (perpSlopeAB - perpSlopeBC);
      centerY = midAB[1] + perpSlopeAB * (centerX - midAB[0]);
    }

    // Calculate radius
    const radius = Math.sqrt(
      (centerX - x1) * (centerX - x1) + (centerY - y1) * (centerY - y1)
    );

    if (isNaN(centerX) || isNaN(centerY) || isNaN(radius) || radius <= 0) {
      return null;
    }

    return {
      center: [Math.round(centerX * 100) / 100, Math.round(centerY * 100) / 100],
      radius: Math.round(radius * 100) / 100,
    };
  }

  /**
   * Render circle annotation on canvas
   * (Same as CircleTool - both produce circle geometry)
   */
  renderAnnotation(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    isSelected: boolean,
    classColor: string,
    className?: string
  ): void {
    if (annotation.geometry.type !== 'circle') return;

    const center = annotation.geometry.center;
    const radius = annotation.geometry.radius;
    if (radius <= 0) return;

    const { r, g, b } = this.parseColor(classColor);

    const canvasCenter = this.toCanvasCoords(center[0], center[1], ctx);
    const canvasRadius = radius * ctx.zoom;

    ctx.ctx.beginPath();
    ctx.ctx.arc(canvasCenter.x, canvasCenter.y, canvasRadius, 0, Math.PI * 2);

    const fillAlpha = isSelected ? 0.3 : 0.2;
    ctx.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillAlpha})`;
    ctx.ctx.fill();

    ctx.ctx.strokeStyle = classColor;
    ctx.ctx.lineWidth = isSelected ? 3 : 2;
    ctx.ctx.stroke();

    ctx.ctx.fillStyle = classColor;
    ctx.ctx.beginPath();
    ctx.ctx.arc(canvasCenter.x, canvasCenter.y, 3, 0, Math.PI * 2);
    ctx.ctx.fill();

    if (ctx.showLabels && className) {
      ctx.ctx.fillStyle = classColor;
      const textWidth = ctx.ctx.measureText(className).width;
      ctx.ctx.fillRect(canvasCenter.x - textWidth / 2 - 4, canvasCenter.y - 30, textWidth + 8, 20);
      ctx.ctx.fillStyle = '#ffffff';
      ctx.ctx.font = '12px sans-serif';
      ctx.ctx.fillText(className, canvasCenter.x - textWidth / 2, canvasCenter.y - 16);
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
    if (annotation.geometry.type !== 'circle') return;

    const center = annotation.geometry.center;
    const radius = annotation.geometry.radius;
    const hs = this.handleSize;

    const canvasCenter = this.toCanvasCoords(center[0], center[1], ctx);
    const canvasRadius = radius * ctx.zoom;

    ctx.ctx.fillStyle = classColor;
    ctx.ctx.strokeStyle = '#ffffff';
    ctx.ctx.lineWidth = 1;

    const handles = [
      { x: canvasCenter.x, y: canvasCenter.y - canvasRadius },
      { x: canvasCenter.x, y: canvasCenter.y + canvasRadius },
      { x: canvasCenter.x + canvasRadius, y: canvasCenter.y },
      { x: canvasCenter.x - canvasRadius, y: canvasCenter.y },
    ];

    for (const handle of handles) {
      ctx.ctx.fillRect(handle.x - hs / 2, handle.y - hs / 2, hs, hs);
      ctx.ctx.strokeRect(handle.x - hs / 2, handle.y - hs / 2, hs, hs);
    }

    ctx.ctx.beginPath();
    ctx.ctx.arc(canvasCenter.x, canvasCenter.y, hs / 2, 0, Math.PI * 2);
    ctx.ctx.fill();
    ctx.ctx.stroke();
  }

  /**
   * Render preview while drawing (3 points)
   */
  renderPreview(
    ctx: CanvasRenderContext,
    state: ToolState
  ): void {
    if (!state.circlePoints || state.circlePoints.length === 0) return;

    const points = state.circlePoints;

    // Draw points already placed
    for (const [px, py] of points) {
      ctx.ctx.fillStyle = '#ef4444';
      ctx.ctx.beginPath();
      ctx.ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.ctx.fill();
    }

    // Draw lines between points
    if (points.length === 1) {
      // Draw dashed line from first point to cursor
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(points[0][0], points[0][1]);
      ctx.ctx.lineTo(state.currentCursor.x, state.currentCursor.y);
      ctx.ctx.strokeStyle = '#ef4444';
      ctx.ctx.setLineDash([5, 5]);
      ctx.ctx.lineWidth = 2;
      ctx.ctx.stroke();
      ctx.ctx.setLineDash([]);
    } else if (points.length === 2) {
      // Draw solid line from p1 to p2
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(points[0][0], points[0][1]);
      ctx.ctx.lineTo(points[1][0], points[1][1]);
      ctx.ctx.strokeStyle = '#ef4444';
      ctx.ctx.lineWidth = 2;
      ctx.ctx.stroke();

      // Draw dashed line from p2 to cursor
      ctx.ctx.beginPath();
      ctx.ctx.moveTo(points[1][0], points[1][1]);
      ctx.ctx.lineTo(state.currentCursor.x, state.currentCursor.y);
      ctx.ctx.strokeStyle = '#ef4444';
      ctx.ctx.setLineDash([5, 5]);
      ctx.ctx.lineWidth = 2;
      ctx.ctx.stroke();
      ctx.ctx.setLineDash([]);
    }

    // Draw cursor point
    ctx.ctx.fillStyle = '#ef4444';
    ctx.ctx.beginPath();
    ctx.ctx.arc(state.currentCursor.x, state.currentCursor.y, 5, 0, Math.PI * 2);
    ctx.ctx.fill();

    // Draw tooltip
    ctx.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const remaining = 3 - points.length;
    const text = `Points: ${points.length}/3 (${remaining} more to complete)`;
    const textWidth = ctx.ctx.measureText(text).width;
    ctx.ctx.fillRect(state.currentCursor.x + 10, state.currentCursor.y - 25, textWidth + 10, 20);
    ctx.ctx.fillStyle = '#ffffff';
    ctx.ctx.font = '12px sans-serif';
    ctx.ctx.fillText(text, state.currentCursor.x + 15, state.currentCursor.y - 10);
  }

  /**
   * Handle mouse down
   */
  onMouseDown(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult {
    if (selectedAnnotation && selectedAnnotation.geometry.type === 'circle') {
      const handle = this.getHandleAtPosition(
        event.imageX,
        event.imageY,
        selectedAnnotation
      );
      if (handle) {
        return {
          cursor: handle.type === 'center' ? 'move' : 'pointer',
        };
      }
    }

    return {
      cursor: 'crosshair',
    };
  }

  onMouseMove(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation,
    annotations?: Annotation[]
  ): ToolOperationResult {
    return { cursor: 'crosshair' };
  }

  onMouseUp(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult {
    return {};
  }

  getHandleAtPosition(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): HandlePosition | null {
    if (annotation.geometry.type !== 'circle') return null;

    const center = annotation.geometry.center;
    const radius = annotation.geometry.radius;
    const threshold = this.handleSize;

    const dxCenter = imageX - center[0];
    const dyCenter = imageY - center[1];
    if (Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter) < threshold) {
      return { type: 'center' };
    }

    const handles = [
      { x: center[0], y: center[1] - radius, name: 'n' },
      { x: center[0], y: center[1] + radius, name: 's' },
      { x: center[0] + radius, y: center[1], name: 'e' },
      { x: center[0] - radius, y: center[1], name: 'w' },
    ];

    for (const handle of handles) {
      const dx = imageX - handle.x;
      const dy = imageY - handle.y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        return { type: 'radius', position: handle.name };
      }
    }

    return null;
  }

  getBoundingBox(annotation: Annotation): { x: number; y: number; width: number; height: number } | null {
    if (annotation.geometry.type !== 'circle') return null;

    const center = annotation.geometry.center;
    const radius = annotation.geometry.radius;

    return {
      x: center[0] - radius,
      y: center[1] - radius,
      width: radius * 2,
      height: radius * 2,
    };
  }

  isPointInside(imageX: number, imageY: number, annotation: Annotation): boolean {
    if (annotation.geometry.type !== 'circle') return false;

    const center = annotation.geometry.center;
    const radius = annotation.geometry.radius;

    const dx = imageX - center[0];
    const dy = imageY - center[1];
    return Math.sqrt(dx * dx + dy * dy) <= radius;
  }

  resize(
    annotation: Annotation,
    handle: HandlePosition,
    deltaX: number,
    deltaY: number
  ): AnnotationGeometry | null {
    if (annotation.geometry.type !== 'circle') return null;

    const center = annotation.geometry.center;
    let radius = annotation.geometry.radius;

    if (handle.type === 'radius') {
      const position = handle.position;
      if (position === 'n') {
        radius = Math.max(5, radius - deltaY);
      } else if (position === 's') {
        radius = Math.max(5, radius + deltaY);
      } else if (position === 'e') {
        radius = Math.max(5, radius + deltaX);
      } else if (position === 'w') {
        radius = Math.max(5, radius - deltaX);
      }
    }

    return {
      type: 'circle',
      center: center,
      radius: Math.round(radius * 100) / 100,
      image_width: annotation.geometry.image_width,
      image_height: annotation.geometry.image_height,
    };
  }

  move(
    annotation: Annotation,
    deltaX: number,
    deltaY: number
  ): AnnotationGeometry | null {
    if (annotation.geometry.type !== 'circle') return null;

    const center = annotation.geometry.center;
    return {
      type: 'circle',
      center: [
        Math.round((center[0] + deltaX) * 100) / 100,
        Math.round((center[1] + deltaY) * 100) / 100,
      ],
      radius: annotation.geometry.radius,
      image_width: annotation.geometry.image_width,
      image_height: annotation.geometry.image_height,
    };
  }

  private parseColor(color: string): { r: number; g: number; b: number } {
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

export const circle3pTool = new Circle3pTool();
