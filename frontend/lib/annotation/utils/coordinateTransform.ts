/**
 * Coordinate Transformation Functions
 *
 * Pure functions for converting between different coordinate spaces:
 * - Screen space: Browser viewport coordinates (clientX, clientY)
 * - Canvas space: Canvas element coordinates (0,0 at top-left of canvas)
 * - Image space: Original image coordinates (0,0 at top-left of image)
 *
 * @module coordinateTransform
 */

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Rectangle (bounding box)
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Transform parameters for canvas rendering
 */
export interface TransformParams {
  zoom: number;
  pan: Point;
  imageWidth: number;
  imageHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Calculate image position and size on canvas (centered, scaled, with pan offset)
 *
 * @param params - Transform parameters
 * @returns Image bounds in canvas space {x, y, width, height}
 */
export function getImageBounds(params: TransformParams): Rect {
  const { zoom, pan, imageWidth, imageHeight, canvasWidth, canvasHeight } = params;

  const scaledWidth = imageWidth * zoom;
  const scaledHeight = imageHeight * zoom;

  const x = (canvasWidth - scaledWidth) / 2 + pan.x;
  const y = (canvasHeight - scaledHeight) / 2 + pan.y;

  return {
    x,
    y,
    width: scaledWidth,
    height: scaledHeight,
  };
}

/**
 * Convert screen coordinates to canvas coordinates
 *
 * @param screenX - X position in browser viewport
 * @param screenY - Y position in browser viewport
 * @param canvasRect - Canvas element bounding rect (from getBoundingClientRect())
 * @returns Point in canvas space
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  canvasRect: DOMRect
): Point {
  return {
    x: screenX - canvasRect.left,
    y: screenY - canvasRect.top,
  };
}

/**
 * Convert canvas coordinates to image coordinates
 *
 * Takes into account zoom and pan offset.
 *
 * @param canvasX - X position in canvas space
 * @param canvasY - Y position in canvas space
 * @param params - Transform parameters
 * @returns Point in image space (original image coordinates)
 */
export function canvasToImage(
  canvasX: number,
  canvasY: number,
  params: TransformParams
): Point {
  const imageBounds = getImageBounds(params);

  return {
    x: (canvasX - imageBounds.x) / params.zoom,
    y: (canvasY - imageBounds.y) / params.zoom,
  };
}

/**
 * Convert image coordinates to canvas coordinates
 *
 * Takes into account zoom and pan offset.
 *
 * @param imageX - X position in image space
 * @param imageY - Y position in image space
 * @param params - Transform parameters
 * @returns Point in canvas space
 */
export function imageToCanvas(
  imageX: number,
  imageY: number,
  params: TransformParams
): Point {
  const imageBounds = getImageBounds(params);

  return {
    x: imageBounds.x + imageX * params.zoom,
    y: imageBounds.y + imageY * params.zoom,
  };
}

/**
 * Convert canvas coordinates to screen coordinates
 *
 * @param canvasX - X position in canvas space
 * @param canvasY - Y position in canvas space
 * @param canvasRect - Canvas element bounding rect
 * @returns Point in screen space (browser viewport)
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  canvasRect: DOMRect
): Point {
  return {
    x: canvasX + canvasRect.left,
    y: canvasY + canvasRect.top,
  };
}

/**
 * Convert screen coordinates directly to image coordinates
 *
 * Convenience function that combines screenToCanvas and canvasToImage.
 *
 * @param screenX - X position in browser viewport
 * @param screenY - Y position in browser viewport
 * @param canvasRect - Canvas element bounding rect
 * @param params - Transform parameters
 * @returns Point in image space
 */
export function screenToImage(
  screenX: number,
  screenY: number,
  canvasRect: DOMRect,
  params: TransformParams
): Point {
  const canvasPoint = screenToCanvas(screenX, screenY, canvasRect);
  return canvasToImage(canvasPoint.x, canvasPoint.y, params);
}

/**
 * Get transformation matrix for the current zoom and pan
 *
 * Returns a matrix that can be used with ctx.setTransform() or ctx.transform().
 * Matrix format: [a, b, c, d, e, f] where:
 * - a, d: horizontal and vertical scaling
 * - b, c: horizontal and vertical skewing
 * - e, f: horizontal and vertical translation
 *
 * @param params - Transform parameters
 * @returns Transformation matrix [scaleX, skewY, skewX, scaleY, translateX, translateY]
 */
export function getTransformMatrix(params: TransformParams): [number, number, number, number, number, number] {
  const imageBounds = getImageBounds(params);

  return [
    params.zoom,       // scaleX
    0,                 // skewY
    0,                 // skewX
    params.zoom,       // scaleY
    imageBounds.x,     // translateX
    imageBounds.y,     // translateY
  ];
}

/**
 * Apply transformation to a single point
 *
 * Useful for batch transforming many points with the same transform matrix.
 *
 * @param point - Point to transform
 * @param matrix - Transformation matrix
 * @returns Transformed point
 */
export function applyTransform(
  point: Point,
  matrix: [number, number, number, number, number, number]
): Point {
  const [a, b, c, d, e, f] = matrix;

  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f,
  };
}

/**
 * Apply transformation to multiple points
 *
 * @param points - Array of points to transform
 * @param matrix - Transformation matrix
 * @returns Array of transformed points
 */
export function applyTransformBatch(
  points: Point[],
  matrix: [number, number, number, number, number, number]
): Point[] {
  return points.map(point => applyTransform(point, matrix));
}

/**
 * Check if a point (in canvas space) is inside the image bounds
 *
 * @param canvasX - X position in canvas space
 * @param canvasY - Y position in canvas space
 * @param params - Transform parameters
 * @returns True if point is inside image bounds
 */
export function isPointInImage(
  canvasX: number,
  canvasY: number,
  params: TransformParams
): boolean {
  const imageBounds = getImageBounds(params);

  return (
    canvasX >= imageBounds.x &&
    canvasX <= imageBounds.x + imageBounds.width &&
    canvasY >= imageBounds.y &&
    canvasY <= imageBounds.y + imageBounds.height
  );
}

/**
 * Clamp image coordinates to image bounds
 *
 * Ensures coordinates are within [0, imageWidth] x [0, imageHeight]
 *
 * @param imageX - X position in image space
 * @param imageY - Y position in image space
 * @param imageWidth - Image width
 * @param imageHeight - Image height
 * @returns Clamped point in image space
 */
export function clampToImageBounds(
  imageX: number,
  imageY: number,
  imageWidth: number,
  imageHeight: number
): Point {
  return {
    x: Math.max(0, Math.min(imageWidth, imageX)),
    y: Math.max(0, Math.min(imageHeight, imageY)),
  };
}
