/**
 * Circle Annotation Tool (Center-Edge)
 *
 * Tool for drawing circles by clicking center then edge.
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

export interface CircleGeometry extends AnnotationGeometry {
  type: 'circle';
  center: [number, number];
  radius: number;
  image_width?: number;
  image_height?: number;
}

export class CircleTool extends BaseAnnotationTool {
  readonly name = 'Circle';
  readonly type = 'circle';
  readonly icon = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z'; // Circle SVG path
  readonly shortcut = 'C';
  readonly cursor = 'crosshair';
  readonly supportedTasks = ['geometry'];

  private handleSize = 8;

  /**
   * Render circle annotation on canvas
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

    // Convert center to canvas coordinates
    const canvasCenter = this.toCanvasCoords(center[0], center[1], ctx);
    const canvasRadius = radius * ctx.zoom;

    // Draw filled circle
    ctx.ctx.beginPath();
    ctx.ctx.arc(canvasCenter.x, canvasCenter.y, canvasRadius, 0, Math.PI * 2);

    // Fill with semi-transparent color
    const fillAlpha = isSelected ? 0.3 : 0.2;
    ctx.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fillAlpha})`;
    ctx.ctx.fill();

    // Draw stroke
    ctx.ctx.strokeStyle = classColor;
    ctx.ctx.lineWidth = isSelected ? 3 : 2;
    ctx.ctx.stroke();

    // Draw center point
    ctx.ctx.fillStyle = classColor;
    ctx.ctx.beginPath();
    ctx.ctx.arc(canvasCenter.x, canvasCenter.y, 3, 0, Math.PI * 2);
    ctx.ctx.fill();

    // Draw label at center
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

    // Draw 4 handles at N, S, E, W positions
    const handles = [
      { x: canvasCenter.x, y: canvasCenter.y - canvasRadius }, // N
      { x: canvasCenter.x, y: canvasCenter.y + canvasRadius }, // S
      { x: canvasCenter.x + canvasRadius, y: canvasCenter.y }, // E
      { x: canvasCenter.x - canvasRadius, y: canvasCenter.y }, // W
    ];

    for (const handle of handles) {
      ctx.ctx.fillRect(handle.x - hs / 2, handle.y - hs / 2, hs, hs);
      ctx.ctx.strokeRect(handle.x - hs / 2, handle.y - hs / 2, hs, hs);
    }

    // Draw center handle
    ctx.ctx.beginPath();
    ctx.ctx.arc(canvasCenter.x, canvasCenter.y, hs / 2, 0, Math.PI * 2);
    ctx.ctx.fill();
    ctx.ctx.stroke();
  }

  /**
   * Render preview while drawing
   */
  renderPreview(
    ctx: CanvasRenderContext,
    state: ToolState
  ): void {
    // Center-edge mode: first click is center, second click is on edge
    if (!state.circleCenter) return;

    const center = state.circleCenter;

    // Calculate radius from center to cursor
    const dx = state.currentCursor.x - center[0];
    const dy = state.currentCursor.y - center[1];
    const radius = Math.sqrt(dx * dx + dy * dy);

    // Draw center point
    ctx.ctx.fillStyle = '#ef4444';
    ctx.ctx.beginPath();
    ctx.ctx.arc(center[0], center[1], 5, 0, Math.PI * 2);
    ctx.ctx.fill();

    // Draw dashed line from center to cursor
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(center[0], center[1]);
    ctx.ctx.lineTo(state.currentCursor.x, state.currentCursor.y);
    ctx.ctx.strokeStyle = '#ef4444';
    ctx.ctx.setLineDash([5, 5]);
    ctx.ctx.lineWidth = 2;
    ctx.ctx.stroke();
    ctx.ctx.setLineDash([]);

    // Draw cursor point
    ctx.ctx.fillStyle = '#ef4444';
    ctx.ctx.beginPath();
    ctx.ctx.arc(state.currentCursor.x, state.currentCursor.y, 5, 0, Math.PI * 2);
    ctx.ctx.fill();

    // Draw tooltip
    ctx.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const text = `Radius: ${Math.round(radius)}px (click to complete)`;
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
    // Check if clicking on a handle of selected annotation for editing
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
    if (annotation.geometry.type !== 'circle') return null;

    const center = annotation.geometry.center;
    const radius = annotation.geometry.radius;
    const threshold = this.handleSize;

    // Check center handle
    const dxCenter = imageX - center[0];
    const dyCenter = imageY - center[1];
    if (Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter) < threshold) {
      return { type: 'center' };
    }

    // Check radius handles (N, S, E, W)
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

  /**
   * Get bounding box of annotation
   */
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

  /**
   * Check if point is inside circle
   */
  isPointInside(imageX: number, imageY: number, annotation: Annotation): boolean {
    if (annotation.geometry.type !== 'circle') return false;

    const center = annotation.geometry.center;
    const radius = annotation.geometry.radius;

    const dx = imageX - center[0];
    const dy = imageY - center[1];
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= radius;
  }

  /**
   * Resize annotation (change radius)
   */
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
      // Calculate new radius based on handle position
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

  /**
   * Move annotation
   */
  move(
    annotation: Annotation,
    deltaX: number,
    deltaY: number
  ): AnnotationGeometry | null {
    if (annotation.geometry.type !== 'circle') return null;

    const center = annotation.geometry.center;
    const newCenter: [number, number] = [
      Math.round((center[0] + deltaX) * 100) / 100,
      Math.round((center[1] + deltaY) * 100) / 100,
    ];

    return {
      type: 'circle',
      center: newCenter,
      radius: annotation.geometry.radius,
      image_width: annotation.geometry.image_width,
      image_height: annotation.geometry.image_height,
    };
  }

  /**
   * Helper to parse color string to RGB
   */
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

// Export singleton instance
export const circleTool = new CircleTool();
