/**
 * Tests for geometryHelpers.ts
 *
 * Tests all geometric calculation and collision detection functions.
 * Target coverage: >90%
 *
 * Phase 18.6: Comprehensive Testing
 */

import { describe, it, expect } from 'vitest';
import {
  pointDistance,
  pointToLineDistance,
  closestPointOnLine,
  pointInPolygon,
  pointInBbox,
  pointNearCircle,
  pointInCircle,
  getHandleAtPosition,
  getCursorForHandle,
  getPointOnEdge,
  bboxIntersection,
  calculateBboxArea,
  calculatePolygonArea,
  normalizeAngle,
  calculateCircleFrom3Points,
  getPolygonCenter,
  isClockwise,
  normalizeBbox,
} from '../geometryHelpers';

describe('geometryHelpers', () => {
  describe('pointDistance', () => {
    it('should calculate distance between two points', () => {
      expect(pointDistance(0, 0, 3, 4)).toBe(5); // 3-4-5 triangle
      expect(pointDistance(0, 0, 0, 0)).toBe(0); // Same point
      expect(pointDistance(1, 1, 4, 5)).toBe(5); // Another 3-4-5 triangle
    });

    it('should handle negative coordinates', () => {
      expect(pointDistance(-3, -4, 0, 0)).toBe(5);
      expect(pointDistance(-1, -1, -4, -5)).toBe(5);
    });

    it('should handle fractional distances', () => {
      const dist = pointDistance(0, 0, 1, 1);
      expect(dist).toBeCloseTo(Math.sqrt(2), 10);
    });
  });

  describe('pointToLineDistance', () => {
    it('should calculate perpendicular distance to line segment', () => {
      // Point directly above middle of horizontal line
      expect(pointToLineDistance(5, 5, 0, 0, 10, 0)).toBe(5);

      // Point on the line
      expect(pointToLineDistance(5, 0, 0, 0, 10, 0)).toBe(0);
    });

    it('should handle point closest to line endpoints', () => {
      // Point beyond line segment end (should measure to endpoint)
      const dist1 = pointToLineDistance(15, 0, 0, 0, 10, 0);
      expect(dist1).toBe(5); // Distance from (15,0) to (10,0)

      const dist2 = pointToLineDistance(-5, 0, 0, 0, 10, 0);
      expect(dist2).toBe(5); // Distance from (-5,0) to (0,0)
    });

    it('should handle zero-length line segment (a point)', () => {
      const dist = pointToLineDistance(5, 5, 0, 0, 0, 0);
      expect(dist).toBeCloseTo(Math.sqrt(50), 10); // sqrt(5^2 + 5^2)
    });

    it('should handle vertical and diagonal lines', () => {
      // Vertical line
      expect(pointToLineDistance(5, 5, 0, 0, 0, 10)).toBe(5);

      // Diagonal line (45 degrees)
      const dist = pointToLineDistance(0, 5, 0, 0, 10, 10);
      expect(dist).toBeCloseTo(3.535, 2); // Perpendicular distance
    });
  });

  describe('closestPointOnLine', () => {
    it('should find closest point on line segment', () => {
      // Point above horizontal line
      const [x1, y1] = closestPointOnLine(5, 5, 0, 0, 10, 0);
      expect(x1).toBe(5);
      expect(y1).toBe(0);
    });

    it('should clamp to line segment endpoints', () => {
      // Point beyond right end
      const [x1, y1] = closestPointOnLine(15, 0, 0, 0, 10, 0);
      expect(x1).toBe(10);
      expect(y1).toBe(0);

      // Point beyond left end
      const [x2, y2] = closestPointOnLine(-5, 0, 0, 0, 10, 0);
      expect(x2).toBe(0);
      expect(y2).toBe(0);
    });

    it('should handle zero-length line segment', () => {
      const [x, y] = closestPointOnLine(5, 5, 3, 3, 3, 3);
      expect(x).toBe(3);
      expect(y).toBe(3);
    });

    it('should handle diagonal lines', () => {
      // 45-degree diagonal from (0,0) to (10,10)
      const [x, y] = closestPointOnLine(5, 0, 0, 0, 10, 10);
      expect(x).toBeCloseTo(2.5, 1);
      expect(y).toBeCloseTo(2.5, 1);
    });
  });

  describe('pointInPolygon', () => {
    it('should return true for point inside polygon', () => {
      const square: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];

      expect(pointInPolygon(5, 5, square)).toBe(true);
      expect(pointInPolygon(1, 1, square)).toBe(true);
      expect(pointInPolygon(9, 9, square)).toBe(true);
    });

    it('should return false for point outside polygon', () => {
      const square: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];

      expect(pointInPolygon(-1, 5, square)).toBe(false);
      expect(pointInPolygon(11, 5, square)).toBe(false);
      expect(pointInPolygon(5, -1, square)).toBe(false);
      expect(pointInPolygon(5, 11, square)).toBe(false);
    });

    it('should handle complex polygons', () => {
      const triangle: [number, number][] = [
        [0, 0],
        [10, 0],
        [5, 10],
      ];

      expect(pointInPolygon(5, 5, triangle)).toBe(true);
      expect(pointInPolygon(5, 1, triangle)).toBe(true);
      expect(pointInPolygon(1, 5, triangle)).toBe(false);
    });

    it('should return false for invalid polygons', () => {
      expect(pointInPolygon(5, 5, [])).toBe(false);
      expect(pointInPolygon(5, 5, [[0, 0]])).toBe(false);
      expect(pointInPolygon(5, 5, [[0, 0], [10, 10]])).toBe(false);
    });

    it('should handle edge cases on polygon boundary', () => {
      const square: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];

      // Points exactly on edges (behavior depends on ray casting)
      const onEdge = pointInPolygon(5, 0, square);
      expect(typeof onEdge).toBe('boolean'); // Just verify it returns a boolean
    });
  });

  describe('pointInBbox', () => {
    it('should return true for point inside bbox', () => {
      expect(pointInBbox(5, 5, 0, 0, 10, 10)).toBe(true);
      expect(pointInBbox(0, 0, 0, 0, 10, 10)).toBe(true); // Top-left corner
      expect(pointInBbox(10, 10, 0, 0, 10, 10)).toBe(true); // Bottom-right corner
    });

    it('should return false for point outside bbox', () => {
      expect(pointInBbox(-1, 5, 0, 0, 10, 10)).toBe(false);
      expect(pointInBbox(11, 5, 0, 0, 10, 10)).toBe(false);
      expect(pointInBbox(5, -1, 0, 0, 10, 10)).toBe(false);
      expect(pointInBbox(5, 11, 0, 0, 10, 10)).toBe(false);
    });

    it('should handle negative bbox coordinates', () => {
      expect(pointInBbox(0, 0, -10, -10, 20, 20)).toBe(true);
      expect(pointInBbox(-5, -5, -10, -10, 20, 20)).toBe(true);
      expect(pointInBbox(-11, 0, -10, -10, 20, 20)).toBe(false);
    });
  });

  describe('pointNearCircle', () => {
    it('should return true for point near circle perimeter', () => {
      // Point at distance 10 from center (exactly on circle with radius 10)
      expect(pointNearCircle(10, 0, 0, 0, 10, 1)).toBe(true);
      expect(pointNearCircle(0, 10, 0, 0, 10, 1)).toBe(true);
    });

    it('should return false for point far from circle perimeter', () => {
      expect(pointNearCircle(0, 0, 0, 0, 10, 1)).toBe(false); // At center
      expect(pointNearCircle(20, 0, 0, 0, 10, 1)).toBe(false); // Far outside
    });

    it('should respect tolerance parameter', () => {
      // Point at distance 15 from center, circle radius 10
      // Distance from perimeter: |15 - 10| = 5
      expect(pointNearCircle(15, 0, 0, 0, 10, 4)).toBe(false); // tolerance 4
      expect(pointNearCircle(15, 0, 0, 0, 10, 6)).toBe(true); // tolerance 6
    });

    it('should use default tolerance', () => {
      // Default tolerance is 8
      expect(pointNearCircle(17, 0, 0, 0, 10)).toBe(true); // |17-10| = 7 < 8
      expect(pointNearCircle(19, 0, 0, 0, 10)).toBe(false); // |19-10| = 9 > 8
    });
  });

  describe('pointInCircle', () => {
    it('should return true for point inside circle', () => {
      expect(pointInCircle(0, 0, 0, 0, 10)).toBe(true); // Center
      expect(pointInCircle(5, 0, 0, 0, 10)).toBe(true);
      expect(pointInCircle(0, 5, 0, 0, 10)).toBe(true);
      expect(pointInCircle(3, 4, 0, 0, 10)).toBe(true); // Distance 5 < 10
    });

    it('should return true for point exactly on circle', () => {
      expect(pointInCircle(10, 0, 0, 0, 10)).toBe(true);
      expect(pointInCircle(0, 10, 0, 0, 10)).toBe(true);
    });

    it('should return false for point outside circle', () => {
      expect(pointInCircle(11, 0, 0, 0, 10)).toBe(false);
      expect(pointInCircle(8, 8, 0, 0, 10)).toBe(false); // Distance ~11.3
    });

    it('should handle circles with negative centers', () => {
      expect(pointInCircle(0, 0, -5, -5, 10)).toBe(true); // Distance ~7.07
      expect(pointInCircle(0, 0, -10, -10, 5)).toBe(false); // Distance ~14.14
    });
  });

  describe('getHandleAtPosition', () => {
    it('should detect corner handles', () => {
      const bbox = { x: 0, y: 0, w: 100, h: 100 };

      expect(getHandleAtPosition(0, 0, bbox.x, bbox.y, bbox.w, bbox.h)).toBe('nw');
      expect(getHandleAtPosition(100, 0, bbox.x, bbox.y, bbox.w, bbox.h)).toBe('ne');
      expect(getHandleAtPosition(0, 100, bbox.x, bbox.y, bbox.w, bbox.h)).toBe('sw');
      expect(getHandleAtPosition(100, 100, bbox.x, bbox.y, bbox.w, bbox.h)).toBe('se');
    });

    it('should detect edge handles', () => {
      const bbox = { x: 0, y: 0, w: 100, h: 100 };

      expect(getHandleAtPosition(50, 0, bbox.x, bbox.y, bbox.w, bbox.h)).toBe('n');
      expect(getHandleAtPosition(50, 100, bbox.x, bbox.y, bbox.w, bbox.h)).toBe('s');
      expect(getHandleAtPosition(0, 50, bbox.x, bbox.y, bbox.w, bbox.h)).toBe('w');
      expect(getHandleAtPosition(100, 50, bbox.x, bbox.y, bbox.w, bbox.h)).toBe('e');
    });

    it('should return null for positions not near handles', () => {
      const bbox = { x: 0, y: 0, w: 100, h: 100 };

      expect(getHandleAtPosition(50, 50, bbox.x, bbox.y, bbox.w, bbox.h)).toBe(null);
      expect(getHandleAtPosition(25, 25, bbox.x, bbox.y, bbox.w, bbox.h)).toBe(null);
    });

    it('should respect handleSize parameter', () => {
      const bbox = { x: 0, y: 0, w: 100, h: 100 };

      // With larger handle size, further points should still match
      // Use point closer to center to avoid corner handle detection
      expect(getHandleAtPosition(50, 15, bbox.x, bbox.y, bbox.w, bbox.h, 20)).toBe('n');
      expect(getHandleAtPosition(50, 20, bbox.x, bbox.y, bbox.w, bbox.h, 8)).toBe(null);
    });

    it('should prioritize corner handles over edge handles', () => {
      const bbox = { x: 0, y: 0, w: 100, h: 100 };

      // Position close to both nw corner and n edge should return nw
      expect(getHandleAtPosition(5, 0, bbox.x, bbox.y, bbox.w, bbox.h)).toBe('nw');
    });
  });

  describe('getCursorForHandle', () => {
    it('should return correct cursors for corner handles', () => {
      expect(getCursorForHandle('nw')).toBe('nwse-resize');
      expect(getCursorForHandle('se')).toBe('nwse-resize');
      expect(getCursorForHandle('ne')).toBe('nesw-resize');
      expect(getCursorForHandle('sw')).toBe('nesw-resize');
    });

    it('should return correct cursors for edge handles', () => {
      expect(getCursorForHandle('n')).toBe('ns-resize');
      expect(getCursorForHandle('s')).toBe('ns-resize');
      expect(getCursorForHandle('w')).toBe('ew-resize');
      expect(getCursorForHandle('e')).toBe('ew-resize');
    });

    it('should return default cursor for null or unknown handle', () => {
      expect(getCursorForHandle(null)).toBe('default');
      expect(getCursorForHandle('unknown')).toBe('default');
      expect(getCursorForHandle('')).toBe('default');
    });
  });

  describe('getPointOnEdge', () => {
    it('should find point on edge when click is close enough', () => {
      const square: [number, number][] = [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ];

      const result = getPointOnEdge(50, 5, square, 10);
      expect(result).not.toBe(null);
      expect(result?.edgeIndex).toBe(0); // Top edge
      expect(result?.point[0]).toBeCloseTo(50, 0);
      expect(result?.point[1]).toBeCloseTo(0, 0);
    });

    it('should return null when click is too far from edges', () => {
      const square: [number, number][] = [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ];

      const result = getPointOnEdge(50, 50, square, 10);
      expect(result).toBe(null);
    });

    it('should respect threshold parameter', () => {
      const square: [number, number][] = [
        [0, 0],
        [100, 0],
        [100, 100],
        [0, 100],
      ];

      // Point 5 pixels from edge
      const result1 = getPointOnEdge(50, 5, square, 3);
      expect(result1).toBe(null); // threshold too small

      const result2 = getPointOnEdge(50, 5, square, 10);
      expect(result2).not.toBe(null); // threshold large enough
    });

    it('should round coordinates to 2 decimal places', () => {
      const line: [number, number][] = [
        [0, 0],
        [100, 100],
      ];

      const result = getPointOnEdge(25, 25.333, line, 10);
      expect(result).not.toBe(null);
      // Coordinates should be rounded
      expect(result?.point[0]).toBe(Math.round(result!.point[0] * 100) / 100);
      expect(result?.point[1]).toBe(Math.round(result!.point[1] * 100) / 100);
    });

    it('should handle closed polygon (last edge connects to first)', () => {
      const triangle: [number, number][] = [
        [0, 0],
        [100, 0],
        [50, 100],
      ];

      // Click near the closing edge (from [50,100] to [0,0])
      const result = getPointOnEdge(25, 50, triangle, 15);
      expect(result).not.toBe(null);
      expect(result?.edgeIndex).toBe(2); // Last edge
    });
  });

  describe('bboxIntersection', () => {
    it('should return true for overlapping bboxes', () => {
      const bbox1: [number, number, number, number] = [0, 0, 100, 100];
      const bbox2: [number, number, number, number] = [50, 50, 100, 100];

      expect(bboxIntersection(bbox1, bbox2)).toBe(true);
    });

    it('should return true for bboxes that touch at edges', () => {
      const bbox1: [number, number, number, number] = [0, 0, 100, 100];
      const bbox2: [number, number, number, number] = [100, 0, 100, 100];

      expect(bboxIntersection(bbox1, bbox2)).toBe(true);
    });

    it('should return false for non-overlapping bboxes', () => {
      const bbox1: [number, number, number, number] = [0, 0, 100, 100];
      const bbox2: [number, number, number, number] = [200, 200, 100, 100];

      expect(bboxIntersection(bbox1, bbox2)).toBe(false);
    });

    it('should return true when one bbox is inside another', () => {
      const bbox1: [number, number, number, number] = [0, 0, 100, 100];
      const bbox2: [number, number, number, number] = [25, 25, 50, 50];

      expect(bboxIntersection(bbox1, bbox2)).toBe(true);
      expect(bboxIntersection(bbox2, bbox1)).toBe(true); // Symmetric
    });

    it('should handle negative coordinates', () => {
      const bbox1: [number, number, number, number] = [-50, -50, 100, 100];
      const bbox2: [number, number, number, number] = [0, 0, 100, 100];

      expect(bboxIntersection(bbox1, bbox2)).toBe(true);
    });
  });

  describe('calculateBboxArea', () => {
    it('should calculate correct area', () => {
      expect(calculateBboxArea([0, 0, 10, 10])).toBe(100);
      expect(calculateBboxArea([0, 0, 5, 20])).toBe(100);
      expect(calculateBboxArea([10, 10, 15, 15])).toBe(225);
    });

    it('should handle negative width/height (return absolute value)', () => {
      expect(calculateBboxArea([0, 0, -10, 10])).toBe(100);
      expect(calculateBboxArea([0, 0, 10, -10])).toBe(100);
      expect(calculateBboxArea([0, 0, -10, -10])).toBe(100);
    });

    it('should return zero for degenerate bboxes', () => {
      expect(calculateBboxArea([0, 0, 0, 0])).toBe(0);
      expect(calculateBboxArea([0, 0, 10, 0])).toBe(0);
      expect(calculateBboxArea([0, 0, 0, 10])).toBe(0);
    });

    it('should ignore x and y position (only use width and height)', () => {
      expect(calculateBboxArea([100, 200, 10, 10])).toBe(100);
      expect(calculateBboxArea([-50, -50, 10, 10])).toBe(100);
    });
  });

  describe('calculatePolygonArea', () => {
    it('should calculate area of simple polygons', () => {
      // Square 10x10
      const square: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];
      expect(calculatePolygonArea(square)).toBe(100);

      // Triangle with base 10 and height 10
      const triangle: [number, number][] = [
        [0, 0],
        [10, 0],
        [5, 10],
      ];
      expect(calculatePolygonArea(triangle)).toBe(50);
    });

    it('should return 0 for invalid polygons', () => {
      expect(calculatePolygonArea([])).toBe(0);
      expect(calculatePolygonArea([[0, 0]])).toBe(0);
      expect(calculatePolygonArea([[0, 0], [10, 10]])).toBe(0);
    });

    it('should handle polygons with negative coordinates', () => {
      const square: [number, number][] = [
        [-5, -5],
        [5, -5],
        [5, 5],
        [-5, 5],
      ];
      expect(calculatePolygonArea(square)).toBe(100);
    });

    it('should return absolute value regardless of winding order', () => {
      // Clockwise square
      const cw: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];

      // Counter-clockwise square
      const ccw: [number, number][] = [
        [0, 0],
        [0, 10],
        [10, 10],
        [10, 0],
      ];

      expect(calculatePolygonArea(cw)).toBe(calculatePolygonArea(ccw));
    });
  });

  describe('normalizeAngle', () => {
    it('should normalize angles to [0, 2π]', () => {
      expect(normalizeAngle(0)).toBe(0);
      expect(normalizeAngle(Math.PI)).toBe(Math.PI);
      expect(normalizeAngle(Math.PI * 2)).toBeCloseTo(0, 10);
    });

    it('should handle negative angles', () => {
      expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI, 10);
      expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(Math.PI * 1.5, 10);
    });

    it('should handle angles > 2π', () => {
      expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 10);
      expect(normalizeAngle(Math.PI * 4)).toBeCloseTo(0, 10);
      expect(normalizeAngle(Math.PI * 5)).toBeCloseTo(Math.PI, 10);
    });

    it('should handle very large angles', () => {
      const angle = Math.PI * 100 + Math.PI / 4;
      const normalized = normalizeAngle(angle);
      expect(normalized).toBeGreaterThanOrEqual(0);
      expect(normalized).toBeLessThan(Math.PI * 2);
      expect(normalized).toBeCloseTo(Math.PI / 4, 10);
    });
  });

  describe('calculateCircleFrom3Points', () => {
    it('should calculate circle from three non-collinear points', () => {
      // Three points forming a right triangle with hypotenuse as diameter
      const p1: [number, number] = [0, 0];
      const p2: [number, number] = [10, 0];
      const p3: [number, number] = [5, 5];

      const result = calculateCircleFrom3Points(p1, p2, p3);
      expect(result).not.toBe(null);

      // Center should be at midpoint of base for this specific triangle
      expect(result!.center[0]).toBeCloseTo(5, 1);
      expect(result!.radius).toBeGreaterThan(0);

      // Verify all three points are on the circle
      const [cx, cy] = result!.center;
      const r = result!.radius;
      expect(pointDistance(p1[0], p1[1], cx, cy)).toBeCloseTo(r, 1);
      expect(pointDistance(p2[0], p2[1], cx, cy)).toBeCloseTo(r, 1);
      expect(pointDistance(p3[0], p3[1], cx, cy)).toBeCloseTo(r, 1);
    });

    it('should return null for collinear points', () => {
      const p1: [number, number] = [0, 0];
      const p2: [number, number] = [5, 5];
      const p3: [number, number] = [10, 10];

      const result = calculateCircleFrom3Points(p1, p2, p3);
      expect(result).toBe(null);
    });

    it('should handle points forming an equilateral triangle', () => {
      const p1: [number, number] = [0, 0];
      const p2: [number, number] = [10, 0];
      const height = 10 * Math.sqrt(3) / 2;
      const p3: [number, number] = [5, height];

      const result = calculateCircleFrom3Points(p1, p2, p3);
      expect(result).not.toBe(null);

      // All points should be equidistant from center
      const [cx, cy] = result!.center;
      const r = result!.radius;
      expect(pointDistance(p1[0], p1[1], cx, cy)).toBeCloseTo(r, 1);
      expect(pointDistance(p2[0], p2[1], cx, cy)).toBeCloseTo(r, 1);
      expect(pointDistance(p3[0], p3[1], cx, cy)).toBeCloseTo(r, 1);
    });

    it('should handle negative coordinates', () => {
      const p1: [number, number] = [-10, -10];
      const p2: [number, number] = [10, -10];
      const p3: [number, number] = [0, 10];

      const result = calculateCircleFrom3Points(p1, p2, p3);
      expect(result).not.toBe(null);
      expect(result!.radius).toBeGreaterThan(0);
    });
  });

  describe('getPolygonCenter', () => {
    it('should calculate centroid of polygon', () => {
      const square: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];

      const [cx, cy] = getPolygonCenter(square);
      expect(cx).toBe(5);
      expect(cy).toBe(5);
    });

    it('should handle triangles', () => {
      const triangle: [number, number][] = [
        [0, 0],
        [10, 0],
        [5, 10],
      ];

      const [cx, cy] = getPolygonCenter(triangle);
      expect(cx).toBe(5);
      expect(cy).toBeCloseTo(3.333, 2);
    });

    it('should return [0, 0] for empty polygon', () => {
      const [cx, cy] = getPolygonCenter([]);
      expect(cx).toBe(0);
      expect(cy).toBe(0);
    });

    it('should handle single point', () => {
      const [cx, cy] = getPolygonCenter([[5, 7]]);
      expect(cx).toBe(5);
      expect(cy).toBe(7);
    });

    it('should handle negative coordinates', () => {
      const polygon: [number, number][] = [
        [-10, -10],
        [10, -10],
        [10, 10],
        [-10, 10],
      ];

      const [cx, cy] = getPolygonCenter(polygon);
      expect(cx).toBe(0);
      expect(cy).toBe(0);
    });
  });

  describe('isClockwise', () => {
    it('should return true for clockwise polygons', () => {
      // In canvas coordinates (y increases downward), this is clockwise
      const cw: [number, number][] = [
        [0, 0],
        [0, 10],
        [10, 10],
        [10, 0],
      ];

      expect(isClockwise(cw)).toBe(true);
    });

    it('should return false for counter-clockwise polygons', () => {
      // In canvas coordinates (y increases downward), this is counter-clockwise
      const ccw: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ];

      expect(isClockwise(ccw)).toBe(false);
    });

    it('should return false for invalid polygons', () => {
      expect(isClockwise([])).toBe(false);
      expect(isClockwise([[0, 0]])).toBe(false);
      expect(isClockwise([[0, 0], [10, 10]])).toBe(false);
    });

    it('should handle triangles', () => {
      // In canvas coordinates, clockwise goes: top-left -> bottom -> top-right -> back
      const cwTriangle: [number, number][] = [
        [0, 0],
        [5, 10],
        [10, 0],
      ];

      // Counter-clockwise goes: top-left -> top-right -> bottom -> back
      const ccwTriangle: [number, number][] = [
        [0, 0],
        [10, 0],
        [5, 10],
      ];

      expect(isClockwise(cwTriangle)).toBe(true);
      expect(isClockwise(ccwTriangle)).toBe(false);
    });
  });

  describe('normalizeBbox', () => {
    it('should not modify bbox with positive dimensions', () => {
      const bbox: [number, number, number, number] = [10, 20, 30, 40];
      const normalized = normalizeBbox(bbox);

      expect(normalized).toEqual([10, 20, 30, 40]);
    });

    it('should normalize bbox with negative width', () => {
      const bbox: [number, number, number, number] = [10, 20, -30, 40];
      const normalized = normalizeBbox(bbox);

      expect(normalized).toEqual([-20, 20, 30, 40]);
    });

    it('should normalize bbox with negative height', () => {
      const bbox: [number, number, number, number] = [10, 20, 30, -40];
      const normalized = normalizeBbox(bbox);

      expect(normalized).toEqual([10, -20, 30, 40]);
    });

    it('should normalize bbox with both negative dimensions', () => {
      const bbox: [number, number, number, number] = [10, 20, -30, -40];
      const normalized = normalizeBbox(bbox);

      expect(normalized).toEqual([-20, -20, 30, 40]);
    });

    it('should handle bbox drawn from bottom-right to top-left', () => {
      // User drags from (100, 100) to (50, 50)
      const bbox: [number, number, number, number] = [100, 100, -50, -50];
      const normalized = normalizeBbox(bbox);

      expect(normalized).toEqual([50, 50, 50, 50]);
    });

    it('should preserve zero dimensions', () => {
      expect(normalizeBbox([10, 20, 0, 0])).toEqual([10, 20, 0, 0]);
    });
  });
});
