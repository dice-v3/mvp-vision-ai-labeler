/**
 * Classification Annotation Tool
 *
 * Tool for image-level classification labels.
 * Unlike other tools, classification has no geometry - it's just class assignment.
 */

import {
  BaseAnnotationTool,
  CanvasRenderContext,
  CanvasMouseEvent,
  ToolState,
  ToolOperationResult,
  HandlePosition,
  AnnotationGeometry,
  ClassificationGeometry,
} from '../AnnotationTool';
import type { Annotation } from '@/lib/stores/annotationStore';

export class ClassificationTool extends BaseAnnotationTool {
  readonly name = 'Classification';
  readonly type = 'classification';
  readonly icon = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'; // Clipboard check SVG path
  readonly shortcut = 'C';
  readonly cursor = 'default';
  readonly supportedTasks = ['classification'];

  /**
   * Render classification annotation on canvas
   * Shows a badge/label indicating the image classification
   */
  renderAnnotation(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    isSelected: boolean,
    classColor: string,
    className?: string
  ): void {
    if (annotation.geometry.type !== 'classification') return;

    // Draw classification badge in top-left corner of the image (not canvas)
    const badgeX = ctx.offsetX + 10;
    const badgeY = ctx.offsetY + 10;
    const padding = 8;
    const fontSize = 14;

    // Get label text
    const labelText = className || 'Unclassified';

    // Measure text
    ctx.ctx.font = `${fontSize}px sans-serif`;
    const textWidth = ctx.ctx.measureText(labelText).width;

    // Draw badge background
    const { r, g, b } = this.parseColor(classColor);
    ctx.ctx.fillStyle = isSelected
      ? `rgba(${r}, ${g}, ${b}, 0.9)`
      : `rgba(${r}, ${g}, ${b}, 0.7)`;

    const badgeWidth = textWidth + padding * 2;
    const badgeHeight = fontSize + padding * 2;

    // Rounded rectangle
    const radius = 4;
    ctx.ctx.beginPath();
    ctx.ctx.moveTo(badgeX + radius, badgeY);
    ctx.ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
    ctx.ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + radius);
    ctx.ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - radius);
    ctx.ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - radius, badgeY + badgeHeight);
    ctx.ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
    ctx.ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - radius);
    ctx.ctx.lineTo(badgeX, badgeY + radius);
    ctx.ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
    ctx.ctx.closePath();
    ctx.ctx.fill();

    // Draw border if selected
    if (isSelected) {
      ctx.ctx.strokeStyle = '#ffffff';
      ctx.ctx.lineWidth = 2;
      ctx.ctx.stroke();
    }

    // Draw text
    ctx.ctx.fillStyle = '#ffffff';
    ctx.ctx.textBaseline = 'middle';
    ctx.ctx.fillText(labelText, badgeX + padding, badgeY + badgeHeight / 2);
  }

  /**
   * Render handles - not applicable for classification
   */
  renderHandles(
    ctx: CanvasRenderContext,
    annotation: Annotation,
    classColor: string
  ): void {
    // Classification has no handles - nothing to render
  }

  /**
   * Render preview - not applicable for classification
   */
  renderPreview(
    ctx: CanvasRenderContext,
    state: ToolState
  ): void {
    // Classification has no drawing preview
  }

  /**
   * Handle mouse down - classification is selected via panel, not canvas
   */
  onMouseDown(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult {
    // Classification doesn't use canvas drawing
    // Return signal to show class selector panel
    return {
      showClassSelector: true,
      cursor: 'default',
    };
  }

  /**
   * Handle mouse move - no special behavior for classification
   */
  onMouseMove(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation,
    annotations?: Annotation[]
  ): ToolOperationResult {
    return { cursor: 'default' };
  }

  /**
   * Handle mouse up - no special behavior for classification
   */
  onMouseUp(
    event: CanvasMouseEvent,
    state: ToolState,
    selectedAnnotation?: Annotation
  ): ToolOperationResult {
    return { complete: true };
  }

  /**
   * Get handle at position - not applicable for classification
   */
  getHandleAtPosition(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): HandlePosition {
    return null;
  }

  /**
   * Check if point is inside - classification covers entire image
   */
  isPointInside(
    imageX: number,
    imageY: number,
    annotation: Annotation
  ): boolean {
    // Classification annotation covers the whole image
    // Return true if this is a classification annotation
    return annotation.geometry.type === 'classification';
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
    return 'default';
  }

  /**
   * Validate classification geometry
   */
  validateGeometry(geometry: AnnotationGeometry): boolean {
    return geometry.type === 'classification';
  }

  /**
   * Get default geometry for classification
   */
  getDefaultGeometry(): ClassificationGeometry {
    return {
      type: 'classification',
    };
  }

  /**
   * Clone geometry
   */
  cloneGeometry(geometry: AnnotationGeometry): ClassificationGeometry {
    return {
      type: 'classification',
    };
  }
}

// Export singleton instance
export const classificationTool = new ClassificationTool();
