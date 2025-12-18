/**
 * Geometry Helper Functions
 *
 * Pure functions for geometric calculations and spatial queries.
 * These functions handle collision detection, distance calculations,
 * and other geometric operations used for annotation interaction.
 *
 * @module geometryHelpers
 */

/**
 * Calculate distance between two points
 *
 * @param x1 - X coordinate of first point
 * @param y1 - Y coordinate of first point
 * @param x2 - X coordinate of second point
 * @param y2 - Y coordinate of second point
 * @returns Euclidean distance between the points
 */
export function pointDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate distance from a point to a line segment
 *
 * Returns the perpendicular distance from the point to the closest point on the line segment.
 *
 * @param px - Point X coordinate
 * @param py - Point Y coordinate
 * @param x1 - Line segment start X
 * @param y1 - Line segment start Y
 * @param x2 - Line segment end X
 * @param y2 - Line segment end Y
 * @returns Distance from point to line segment
 */
export function pointToLineDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    // Line segment is actually a point
    return pointDistance(px, py, x1, y1);
  }

  // Parameter t for closest point on line
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]

  // Closest point on line segment
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  // Distance from point to closest point
  return pointDistance(px, py, closestX, closestY);
}

/**
 * Get the closest point on a line segment to a given point
 *
 * @param px - Point X coordinate
 * @param py - Point Y coordinate
 * @param x1 - Line segment start X
 * @param y1 - Line segment start Y
 * @param x2 - Line segment end X
 * @param y2 - Line segment end Y
 * @returns Closest point on line segment as [x, y]
 */
export function closestPointOnLine(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): [number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return [x1, y1];
  }

  // Parameter t for closest point on line
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]

  return [x1 + t * dx, y1 + t * dy];
}

/**
 * Check if a point is inside a polygon (ray casting algorithm)
 *
 * @param px - Point X coordinate
 * @param py - Point Y coordinate
 * @param polygon - Array of polygon vertices [[x, y], ...]
 * @returns True if point is inside polygon
 */
export function pointInPolygon(
  px: number,
  py: number,
  polygon: [number, number][]
): boolean {
  if (polygon.length < 3) return false;

  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if a point is inside a bounding box
 *
 * @param px - Point X coordinate
 * @param py - Point Y coordinate
 * @param bboxX - Bbox X position
 * @param bboxY - Bbox Y position
 * @param bboxW - Bbox width
 * @param bboxH - Bbox height
 * @returns True if point is inside bbox
 */
export function pointInBbox(
  px: number,
  py: number,
  bboxX: number,
  bboxY: number,
  bboxW: number,
  bboxH: number
): boolean {
  return px >= bboxX && px <= bboxX + bboxW && py >= bboxY && py <= bboxY + bboxH;
}

/**
 * Check if a point is near a circle perimeter
 *
 * @param px - Point X coordinate
 * @param py - Point Y coordinate
 * @param cx - Circle center X
 * @param cy - Circle center Y
 * @param radius - Circle radius
 * @param tolerance - Distance tolerance (default: 8)
 * @returns True if point is near circle perimeter
 */
export function pointNearCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number,
  tolerance: number = 8
): boolean {
  const distance = pointDistance(px, py, cx, cy);
  return Math.abs(distance - radius) < tolerance;
}

/**
 * Check if a point is inside a circle
 *
 * @param px - Point X coordinate
 * @param py - Point Y coordinate
 * @param cx - Circle center X
 * @param cy - Circle center Y
 * @param radius - Circle radius
 * @returns True if point is inside circle
 */
export function pointInCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const distance = pointDistance(px, py, cx, cy);
  return distance <= radius;
}

/**
 * Get which bbox handle is at the given position
 *
 * Returns handle identifier (nw, ne, sw, se, n, s, w, e) or null if no handle.
 *
 * @param x - Point X coordinate
 * @param y - Point Y coordinate
 * @param bboxX - Bbox X position
 * @param bboxY - Bbox Y position
 * @param bboxW - Bbox width
 * @param bboxH - Bbox height
 * @param handleSize - Handle size (default: 8)
 * @returns Handle identifier or null
 */
export function getHandleAtPosition(
  x: number,
  y: number,
  bboxX: number,
  bboxY: number,
  bboxW: number,
  bboxH: number,
  handleSize: number = 8
): string | null {
  const threshold = handleSize / 2 + 6;

  // Corner handles
  if (Math.abs(x - bboxX) < threshold && Math.abs(y - bboxY) < threshold) return 'nw';
  if (Math.abs(x - (bboxX + bboxW)) < threshold && Math.abs(y - bboxY) < threshold) return 'ne';
  if (Math.abs(x - bboxX) < threshold && Math.abs(y - (bboxY + bboxH)) < threshold) return 'sw';
  if (Math.abs(x - (bboxX + bboxW)) < threshold && Math.abs(y - (bboxY + bboxH)) < threshold) return 'se';

  // Edge handles
  if (Math.abs(x - (bboxX + bboxW / 2)) < threshold && Math.abs(y - bboxY) < threshold) return 'n';
  if (Math.abs(x - (bboxX + bboxW / 2)) < threshold && Math.abs(y - (bboxY + bboxH)) < threshold) return 's';
  if (Math.abs(x - bboxX) < threshold && Math.abs(y - (bboxY + bboxH / 2)) < threshold) return 'w';
  if (Math.abs(x - (bboxX + bboxW)) < threshold && Math.abs(y - (bboxY + bboxH / 2)) < threshold) return 'e';

  return null;
}

/**
 * Get cursor style for a bbox handle
 *
 * @param handle - Handle identifier (nw, ne, sw, se, n, s, w, e)
 * @returns CSS cursor style
 */
export function getCursorForHandle(handle: string | null): string {
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
 * Find the closest point on a polygon edge to a given point
 *
 * Used for adding vertices by clicking on polygon edges.
 *
 * @param x - Point X coordinate
 * @param y - Point Y coordinate
 * @param points - Polygon/polyline vertices
 * @param threshold - Distance threshold (default: 8)
 * @returns Object with edge index and closest point, or null if no edge is close enough
 */
export function getPointOnEdge(
  x: number,
  y: number,
  points: [number, number][],
  threshold: number = 8
): { edgeIndex: number; point: [number, number] } | null {
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];

    const distance = pointToLineDistance(x, y, x1, y1, x2, y2);

    if (distance < threshold) {
      const closestPoint = closestPointOnLine(x, y, x1, y1, x2, y2);

      // Round to 2 decimal places
      const roundedX = Math.round(closestPoint[0] * 100) / 100;
      const roundedY = Math.round(closestPoint[1] * 100) / 100;

      return { edgeIndex: i, point: [roundedX, roundedY] };
    }
  }

  return null;
}

/**
 * Check if two bounding boxes intersect
 *
 * @param bbox1 - First bbox [x, y, width, height]
 * @param bbox2 - Second bbox [x, y, width, height]
 * @returns True if bboxes intersect
 */
export function bboxIntersection(
  bbox1: [number, number, number, number],
  bbox2: [number, number, number, number]
): boolean {
  const [x1, y1, w1, h1] = bbox1;
  const [x2, y2, w2, h2] = bbox2;

  return !(
    x1 + w1 < x2 || // bbox1 is left of bbox2
    x1 > x2 + w2 || // bbox1 is right of bbox2
    y1 + h1 < y2 || // bbox1 is above bbox2
    y1 > y2 + h2    // bbox1 is below bbox2
  );
}

/**
 * Calculate area of a bounding box
 *
 * @param bbox - Bbox [x, y, width, height]
 * @returns Area in pixels
 */
export function calculateBboxArea(bbox: [number, number, number, number]): number {
  const [, , width, height] = bbox;
  return Math.abs(width * height);
}

/**
 * Calculate area of a polygon using shoelace formula
 *
 * @param polygon - Array of polygon vertices [[x, y], ...]
 * @returns Area in pixels (absolute value)
 */
export function calculatePolygonArea(polygon: [number, number][]): number {
  if (polygon.length < 3) return 0;

  let area = 0;

  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];

    area += x1 * y2 - x2 * y1;
  }

  return Math.abs(area / 2);
}

/**
 * Normalize an angle to the range [0, 2π]
 *
 * @param angle - Angle in radians
 * @returns Normalized angle in range [0, 2π]
 */
export function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  let normalized = angle % twoPi;

  if (normalized < 0) {
    normalized += twoPi;
  }

  return normalized;
}

/**
 * Calculate circle from three points
 *
 * Uses the circumcircle formula to find the unique circle passing through three points.
 *
 * @param p1 - First point [x, y]
 * @param p2 - Second point [x, y]
 * @param p3 - Third point [x, y]
 * @returns Circle {center: [x, y], radius} or null if points are collinear
 */
export function calculateCircleFrom3Points(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number]
): { center: [number, number]; radius: number } | null {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const [x3, y3] = p3;

  // Calculate denominator (2 * det)
  const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

  // Points are collinear if d is close to zero
  if (Math.abs(d) < 1e-6) {
    return null;
  }

  // Calculate center coordinates
  const ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / d;
  const uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / d;

  // Calculate radius
  const radius = pointDistance(ux, uy, x1, y1);

  return {
    center: [ux, uy],
    radius,
  };
}

/**
 * Get polygon centroid (center of mass)
 *
 * @param polygon - Array of polygon vertices [[x, y], ...]
 * @returns Centroid as [x, y]
 */
export function getPolygonCenter(polygon: [number, number][]): [number, number] {
  if (polygon.length === 0) return [0, 0];

  let sumX = 0;
  let sumY = 0;

  for (const [x, y] of polygon) {
    sumX += x;
    sumY += y;
  }

  return [sumX / polygon.length, sumY / polygon.length];
}

/**
 * Check if polygon vertices are in clockwise order
 *
 * @param polygon - Array of polygon vertices [[x, y], ...]
 * @returns True if clockwise
 */
export function isClockwise(polygon: [number, number][]): boolean {
  if (polygon.length < 3) return false;

  let sum = 0;

  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];

    sum += (x2 - x1) * (y2 + y1);
  }

  return sum > 0;
}

/**
 * Normalize bbox to ensure positive width and height
 *
 * Handles cases where user drags from bottom-right to top-left.
 *
 * @param bbox - Bbox [x, y, width, height]
 * @returns Normalized bbox with positive width and height
 */
export function normalizeBbox(
  bbox: [number, number, number, number]
): [number, number, number, number] {
  let [x, y, w, h] = bbox;

  if (w < 0) {
    x += w;
    w = -w;
  }

  if (h < 0) {
    y += h;
    h = -h;
  }

  return [x, y, w, h];
}
