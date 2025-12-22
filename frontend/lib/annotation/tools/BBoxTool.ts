/**
 * Bounding Box Annotation Tool
 *
 * Tool for drawing and editing rectangular bounding boxes.
 */

import {
  BaseAnnotationTool,
  CanvasRenderContext,
  CanvasMouseEvent,
  ToolState,
  ToolOperationResult,
  HandlePosition,
  AnnotationGeometry,
  BBoxGeometry,
} from '../AnnotationTool';
import type { Annotation } from '@/lib/stores/annotationStore';

export class BBoxTool extends BaseAnnotationTool {
  readonly name = 'Bounding Box';
  readonly type = 'bbox';
  readonly icon = 'M4 4h16v16H4V4z'; // Rectangle SVG path
  readonly shortcut = 'B';
  readonly cursor = 'crosshair';
  readonly supportedTasks = ['detection', 'segmentation'];

  private handleSize = 8;

  /**
   * Render bbox annotation on canvas
   */
  renderAnnotation(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    isSelected: boolean,
    classColor: string,
    className?: string
  ): void {
    if (annotation.geometry.type !== 'bbox') return;

    const [x, y, w, h] = annotation.geometry.bbox;
    const scaled = this.toCanvasCoords(x, y, ctx);
    const scaledW = w * ctx.zoom;
    const scaledH = h * ctx.zoom;

    // Fill selected bbox with semi-transparent color
    if (isSelected) {
      const { r, g, b } = this.parseColor(classColor);
      ctx.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
      ctx.ctx.fillRect(scaled.x, scaled.y, scaledW, scaledH);
    }

    // Draw bbox stroke
    ctx.ctx.strokeStyle = classColor;
    ctx.ctx.lineWidth = isSelected ? 3 : 2;
    ctx.ctx.strokeRect(scaled.x, scaled.y, scaledW, scaledH);

    // Draw label
    if (ctx.showLabels && className) {
      // Set font first before measuring
      ctx.ctx.font = '12px sans-serif';
      const textWidth = ctx.ctx.measureText(className).width;

      // Draw background
      ctx.ctx.fillStyle = classColor;
      ctx.ctx.fillRect(scaled.x, scaled.y - 20, textWidth + 16, 20);

      // Draw text
      ctx.ctx.fillStyle = '#ffffff';
      ctx.ctx.fillText(className, scaled.x + 8, scaled.y - 6);
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
    if (annotation.geometry.type !== 'bbox') return;

    const [x, y, w, h] = annotation.geometry.bbox;
    const scaled = this.toCanvasCoords(x, y, ctx);
    const scaledW = w * ctx.zoom;
    const scaledH = h * ctx.zoom;

    ctx.ctx.fillStyle = classColor;
    const hs = this.handleSize;

    // Corner handles
    ctx.ctx.fillRect(scaled.x - hs / 2, scaled.y - hs / 2, hs, hs);
    ctx.ctx.fillRect(scaled.x + scaledW - hs / 2, scaled.y - hs / 2, hs, hs);
    ctx.ctx.fillRect(scaled.x - hs / 2, scaled.y + scaledH - hs / 2, hs, hs);
    ctx.ctx.fillRect(scaled.x + scaledW - hs / 2, scaled.y + scaledH - hs / 2, hs, hs);

    // Edge handles
    ctx.ctx.fillRect(scaled.x + scaledW / 2 - hs / 2, scaled.y - hs / 2, hs, hs);
    ctx.ctx.fillRect(scaled.x + scaledW / 2 - hs / 2, scaled.y + scaledH - hs / 2, hs, hs);
    ctx.ctx.fillRect(scaled.x - hs / 2, scaled.y + scaledH / 2 - hs / 2, hs, hs);
    ctx.ctx.fillRect(scaled.x + scaledW - hs / 2, scaled.y + scaledH / 2 - hs / 2, hs, hs);
  }

  /**
   * Render preview while drawing
   */
  renderPreview(
    ctx: CanvasRenderContext,
    state: ToolState
  ): void {
    if (!state.isDrawing || !state.drawingStart) return;

    const x1 = Math.min(state.drawingStart.x, state.currentCursor.x);
    const y1 = Math.min(state.drawingStart.y, state.currentCursor.y);
    const w = Math.abs(state.currentCursor.x - state.drawingStart.x);
    const h = Math.abs(state.currentCursor.y - state.drawingStart.y);

    // Draw dashed rectangle
    ctx.ctx.strokeStyle = '#ef4444'; // red-500
    ctx.ctx.setLineDash([5, 5]);
    ctx.ctx.lineWidth = 2;
    ctx.ctx.strokeRect(x1, y1, w, h);
    ctx.ctx.setLineDash([]);

    // Draw dimensions tooltip
    ctx.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const text = `W: ${Math.round(w / ctx.zoom)} x H: ${Math.round(h / ctx.zoom)}`;
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
    // Check if clicking on a handle of selected annotation
    if (selectedAnnotation && selectedAnnotation.geometry.type === 'bbox') {
      const handle = this.getHandleAtPosition(
        event.imageX,
        event.imageY,
        selectedAnnotation
      );
      if (handle) {
        return {
          cursor: this.getCursorForHandle(handle),
          // Signal to start resizing (Canvas will handle state)
        };
      }
    }

    // Start drawing new bbox
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

    // Check if hovering over selected annotation's handle
    if (selectedAnnotation && selectedAnnotation.geometry.type === 'bbox') {
      const handle = this.getHandleAtPosition(
        event.imageX,
        event.imageY,
        selectedAnnotation
      );
      if (handle) {
        cursor = this.getCursorForHandle(handle);
      } else if (this.isPointInside(event.imageX, event.imageY, selectedAnnotation)) {
        cursor = 'move';
      }
    }

    // Check if hovering over any annotation
    if (annotations && cursor === this.cursor) {
      for (const ann of annotations) {
        if (ann.geometry.type === 'bbox' && this.isPointInside(event.imageX, event.imageY, ann)) {
          cursor = 'pointer';
          break;
        }
      }
    }

    return { cursor };
  }

  /**
   * Handle mouse up
   */
  onMouseUp(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult {
    if (!state.isDrawing || !state.drawingStart) {
      return { complete: true };
    }

    // Calculate bbox in canvas coordinates
    const x1 = Math.min(state.drawingStart.x, state.currentCursor.x);
    const y1 = Math.min(state.drawingStart.y, state.currentCursor.y);
    const w = Math.abs(state.currentCursor.x - state.drawingStart.x);
    const h = Math.abs(state.currentCursor.y - state.drawingStart.y);

    // Check minimum size
    if (w < 5 || h < 5) {
      return { cancel: true, complete: true };
    }

    // Return geometry (coordinates are in canvas space, will be converted by Canvas)
    return {
      geometry: {
        type: 'bbox',
        bbox: [x1, y1, w, h],
      },
      showClassSelector: true,
      complete: true,
    };
  }

  /**
   * Get handle at position
   */
  getHandleAtPosition(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): HandlePosition {
    if (annotation.geometry.type !== 'bbox') return null;

    const [bboxX, bboxY, bboxW, bboxH] = annotation.geometry.bbox;
    const threshold = this.handleSize / 2 + 2;

    // Corner handles
    if (Math.abs(imageX - bboxX) < threshold && Math.abs(imageY - bboxY) < threshold) return 'nw';
    if (Math.abs(imageX - (bboxX + bboxW)) < threshold && Math.abs(imageY - bboxY) < threshold) return 'ne';
    if (Math.abs(imageX - bboxX) < threshold && Math.abs(imageY - (bboxY + bboxH)) < threshold) return 'sw';
    if (Math.abs(imageX - (bboxX + bboxW)) < threshold && Math.abs(imageY - (bboxY + bboxH)) < threshold) return 'se';

    // Edge handles
    if (Math.abs(imageX - (bboxX + bboxW / 2)) < threshold && Math.abs(imageY - bboxY) < threshold) return 'n';
    if (Math.abs(imageX - (bboxX + bboxW / 2)) < threshold && Math.abs(imageY - (bboxY + bboxH)) < threshold) return 's';
    if (Math.abs(imageX - bboxX) < threshold && Math.abs(imageY - (bboxY + bboxH / 2)) < threshold) return 'w';
    if (Math.abs(imageX - (bboxX + bboxW)) < threshold && Math.abs(imageY - (bboxY + bboxH / 2)) < threshold) return 'e';

    return null;
  }

  /**
   * Check if point is inside bbox
   */
  isPointInside(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): boolean {
    if (annotation.geometry.type !== 'bbox') return false;

    const [bboxX, bboxY, bboxW, bboxH] = annotation.geometry.bbox;
    return (
      imageX >= bboxX &&
      imageX <= bboxX + bboxW &&
      imageY >= bboxY &&
      imageY <= bboxY + bboxH
    );
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

    const handle = this.getHandleAtPosition(imageX, imageY, annotation);
    if (handle) {
      return this.getCursorForHandle(handle);
    }

    return this.isPointInside(imageX, imageY, annotation) ? 'move' : 'default';
  }

  /**
   * Get cursor for handle type
   */
  private getCursorForHandle(handle: HandlePosition): string {
    if (!handle) return 'default';
    switch (handle) {
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'w':
      case 'e':
        return 'ew-resize';
      default:
        return 'default';
    }
  }

  /**
   * Validate bbox geometry
   */
  validateGeometry(geometry: AnnotationGeometry): boolean {
    if (geometry.type !== 'bbox') return false;
    const [x, y, w, h] = geometry.bbox;
    return w > 0 && h > 0 && x >= 0 && y >= 0;
  }

  /**
   * Get default geometry
   */
  getDefaultGeometry(): BBoxGeometry {
    return {
      type: 'bbox',
      bbox: [0, 0, 100, 100],
    };
  }

  /**
   * Clone geometry
   */
  cloneGeometry(geometry: AnnotationGeometry): BBoxGeometry {
    if (geometry.type !== 'bbox') {
      return this.getDefaultGeometry();
    }
    return {
      type: 'bbox',
      bbox: [...geometry.bbox] as [number, number, number, number],
    };
  }

  /**
   * Resize bbox based on handle drag
   */
  resizeBbox(
    originalBbox: [number, number, number, number],
    handle: HandlePosition,
    deltaX: number,
    deltaY: number
  ): [number, number, number, number] {
    let [x, y, w, h] = originalBbox;

    switch (handle) {
      case 'nw':
        x += deltaX;
        y += deltaY;
        w -= deltaX;
        h -= deltaY;
        break;
      case 'ne':
        y += deltaY;
        w += deltaX;
        h -= deltaY;
        break;
      case 'sw':
        x += deltaX;
        w -= deltaX;
        h += deltaY;
        break;
      case 'se':
        w += deltaX;
        h += deltaY;
        break;
      case 'n':
        y += deltaY;
        h -= deltaY;
        break;
      case 's':
        h += deltaY;
        break;
      case 'w':
        x += deltaX;
        w -= deltaX;
        break;
      case 'e':
        w += deltaX;
        break;
    }

    // Ensure minimum size
    if (w < 10) w = 10;
    if (h < 10) h = 10;

    return [x, y, w, h];
  }
}

// Export singleton instance
export const bboxTool = new BBoxTool();
