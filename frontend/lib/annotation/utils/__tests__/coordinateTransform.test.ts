/**
 * Tests for coordinateTransform.ts
 *
 * Tests all coordinate transformation functions for canvas/image space conversion.
 * Target coverage: >90%
 *
 * Phase 18.6: Comprehensive Testing
 */

import { describe, it, expect } from 'vitest';
import {
  canvasToImage,
  imageToCanvas,
  getImageBounds,
  isPointInImage,
  clampToImageBounds,
  screenToCanvas,
  canvasToScreen,
  screenToImage,
  getTransformMatrix,
  applyTransform,
  applyTransformBatch,
  type TransformParams,
  type Point,
  type Rect,
} from '../coordinateTransform';

describe('coordinateTransform', () => {
  // Common test parameters
  const defaultParams: TransformParams = {
    imageWidth: 1000,
    imageHeight: 800,
    canvasWidth: 800,
    canvasHeight: 600,
    zoom: 1.0,
    pan: { x: 0, y: 0 },
  };

  describe('getImageBounds', () => {
    it('should calculate correct image bounds with no zoom or pan', () => {
      const bounds = getImageBounds(defaultParams);

      expect(bounds).toEqual({
        x: -100, // (800 - 1000) / 2
        y: -100, // (600 - 800) / 2
        width: 1000,
        height: 800,
      });
    });

    it('should calculate correct image bounds with zoom', () => {
      const params: TransformParams = {
        ...defaultParams,
        zoom: 2.0,
      };
      const bounds = getImageBounds(params);

      expect(bounds).toEqual({
        x: -600, // (800 - 1000 * 2) / 2
        y: -500, // (600 - 800 * 2) / 2
        width: 2000,
        height: 1600,
      });
    });

    it('should calculate correct image bounds with pan', () => {
      const params: TransformParams = {
        ...defaultParams,
        pan: { x: 50, y: 30 },
      };
      const bounds = getImageBounds(params);

      expect(bounds).toEqual({
        x: -50, // (800 - 1000) / 2 + 50
        y: -70, // (600 - 800) / 2 + 30
        width: 1000,
        height: 800,
      });
    });

    it('should calculate correct image bounds with both zoom and pan', () => {
      const params: TransformParams = {
        ...defaultParams,
        zoom: 1.5,
        pan: { x: 100, y: 50 },
      };
      const bounds = getImageBounds(params);

      expect(bounds).toEqual({
        x: -250, // (800 - 1000 * 1.5) / 2 + 100 = -350 + 100
        y: -250, // (600 - 800 * 1.5) / 2 + 50 = -300 + 50
        width: 1500,
        height: 1200,
      });
    });
  });

  describe('canvasToImage', () => {
    it('should convert canvas coordinates to image coordinates with no zoom', () => {
      const point = canvasToImage(400, 300, defaultParams);

      expect(point).toEqual({
        x: 500, // 400 - (-100)
        y: 400, // 300 - (-100)
      });
    });

    it('should convert canvas coordinates to image coordinates with zoom', () => {
      const params: TransformParams = {
        ...defaultParams,
        zoom: 2.0,
      };
      const point = canvasToImage(400, 300, params);

      expect(point).toEqual({
        x: 500, // (400 - (-600)) / 2 = 1000 / 2
        y: 400, // (300 - (-500)) / 2 = 800 / 2
      });
    });

    it('should convert canvas coordinates to image coordinates with pan', () => {
      const params: TransformParams = {
        ...defaultParams,
        pan: { x: 50, y: 30 },
      };
      const point = canvasToImage(400, 300, params);

      expect(point).toEqual({
        x: 450, // 400 - (-50)
        y: 370, // 300 - (-70)
      });
    });

    it('should handle negative canvas coordinates', () => {
      const point = canvasToImage(-50, -30, defaultParams);

      expect(point).toEqual({
        x: 50, // -50 - (-100)
        y: 70, // -30 - (-100)
      });
    });

    it('should handle fractional zoom values', () => {
      const params: TransformParams = {
        ...defaultParams,
        zoom: 0.5,
      };
      const point = canvasToImage(400, 300, params);

      expect(point).toEqual({
        x: 500, // (400 - 150) / 0.5 = 250 / 0.5
        y: 400, // (300 - 100) / 0.5 = 200 / 0.5
      });
    });
  });

  describe('imageToCanvas', () => {
    it('should convert image coordinates to canvas coordinates with no zoom', () => {
      const point = imageToCanvas(500, 400, defaultParams);

      expect(point).toEqual({
        x: 400, // 500 + (-100)
        y: 300, // 400 + (-100)
      });
    });

    it('should convert image coordinates to canvas coordinates with zoom', () => {
      const params: TransformParams = {
        ...defaultParams,
        zoom: 2.0,
      };
      const point = imageToCanvas(500, 500, params);

      expect(point).toEqual({
        x: 400, // 500 * 2 + (-600) = 1000 - 600
        y: 500, // 500 * 2 + (-500) = 1000 - 500
      });
    });

    it('should be inverse of canvasToImage', () => {
      const canvasPoint = { x: 123.45, y: 678.90 };
      const params: TransformParams = {
        ...defaultParams,
        zoom: 1.5,
        pan: { x: 25, y: -15 },
      };

      const imagePoint = canvasToImage(canvasPoint.x, canvasPoint.y, params);
      const backToCanvas = imageToCanvas(imagePoint.x, imagePoint.y, params);

      expect(backToCanvas.x).toBeCloseTo(canvasPoint.x, 10);
      expect(backToCanvas.y).toBeCloseTo(canvasPoint.y, 10);
    });
  });

  describe('isPointInImage', () => {
    it('should return true for points inside image bounds on canvas', () => {
      // defaultParams: image 1000x800, canvas 800x600, no zoom/pan
      // image bounds: x=-100, y=-100, width=1000, height=800
      // so image covers canvas from (-100, -100) to (900, 700)
      expect(isPointInImage(400, 300, defaultParams)).toBe(true); // center of canvas, inside image
      expect(isPointInImage(0, 0, defaultParams)).toBe(true); // inside image bounds
      expect(isPointInImage(800, 600, defaultParams)).toBe(true); // inside image bounds
    });

    it('should return false for points outside image bounds on canvas', () => {
      // image bounds: x=-100, y=-100, width=1000, height=800 (covers -100 to 900, -100 to 700)
      expect(isPointInImage(-101, 0, defaultParams)).toBe(false); // left of image
      expect(isPointInImage(0, -101, defaultParams)).toBe(false); // above image
      expect(isPointInImage(901, 300, defaultParams)).toBe(false); // right of image
      expect(isPointInImage(400, 701, defaultParams)).toBe(false); // below image
    });

    it('should handle edge cases correctly', () => {
      // Exactly on boundaries (inclusive on left/top, exclusive on right/bottom based on implementation)
      expect(isPointInImage(-100, -100, defaultParams)).toBe(true); // top-left corner
      expect(isPointInImage(900, 700, defaultParams)).toBe(true); // bottom-right corner (inclusive)
    });

    it('should work with different image sizes', () => {
      const params: TransformParams = {
        ...defaultParams,
        imageWidth: 500,
        imageHeight: 300,
      };
      // image bounds: x=150, y=150, width=500, height=300 (covers 150 to 650, 150 to 450)

      expect(isPointInImage(400, 300, params)).toBe(true); // inside
      expect(isPointInImage(150, 150, params)).toBe(true); // top-left corner
      expect(isPointInImage(650, 450, params)).toBe(true); // bottom-right corner
      expect(isPointInImage(651, 300, params)).toBe(false); // right of image
      expect(isPointInImage(400, 451, params)).toBe(false); // below image
    });
  });

  describe('clampToImageBounds', () => {
    it('should not modify points already inside image bounds', () => {
      const point = clampToImageBounds(500, 400, 1000, 800);

      expect(point).toEqual({ x: 500, y: 400 });
    });

    it('should clamp points below minimum bounds', () => {
      const point = clampToImageBounds(-10, -20, 1000, 800);

      expect(point).toEqual({ x: 0, y: 0 });
    });

    it('should clamp points above maximum bounds', () => {
      const point = clampToImageBounds(1500, 1200, 1000, 800);

      expect(point).toEqual({
        x: 1000,
        y: 800,
      });
    });

    it('should clamp points on one axis only', () => {
      let point = clampToImageBounds(-10, 400, 1000, 800);
      expect(point).toEqual({ x: 0, y: 400 });

      point = clampToImageBounds(500, -20, 1000, 800);
      expect(point).toEqual({ x: 500, y: 0 });

      point = clampToImageBounds(1500, 400, 1000, 800);
      expect(point).toEqual({ x: 1000, y: 400 });

      point = clampToImageBounds(500, 1200, 1000, 800);
      expect(point).toEqual({ x: 500, y: 800 });
    });

    it('should handle edge values correctly', () => {
      expect(clampToImageBounds(0, 0, 1000, 800)).toEqual({ x: 0, y: 0 });
      expect(clampToImageBounds(1000, 800, 1000, 800)).toEqual({ x: 1000, y: 800 });
      expect(clampToImageBounds(999.9, 799.9, 1000, 800)).toEqual({ x: 999.9, y: 799.9 });
    });

    it('should work with different image sizes', () => {
      expect(clampToImageBounds(600, 400, 500, 300)).toEqual({ x: 500, y: 300 });
      expect(clampToImageBounds(250, 150, 500, 300)).toEqual({ x: 250, y: 150 });
    });
  });

  describe('screenToCanvas', () => {
    it('should convert screen coordinates to canvas coordinates', () => {
      const canvasRect = new DOMRect(100, 50, 800, 600);
      const point = screenToCanvas(500, 300, canvasRect);

      expect(point).toEqual({
        x: 400, // 500 - 100
        y: 250, // 300 - 50
      });
    });

    it('should handle canvas at origin', () => {
      const canvasRect = new DOMRect(0, 0, 800, 600);
      const point = screenToCanvas(400, 300, canvasRect);

      expect(point).toEqual({ x: 400, y: 300 });
    });

    it('should handle negative canvas positions', () => {
      const canvasRect = new DOMRect(-50, -30, 800, 600);
      const point = screenToCanvas(100, 100, canvasRect);

      expect(point).toEqual({
        x: 150, // 100 - (-50)
        y: 130, // 100 - (-30)
      });
    });
  });

  describe('canvasToScreen', () => {
    it('should convert canvas coordinates to screen coordinates', () => {
      const canvasRect = new DOMRect(100, 50, 800, 600);
      const point = canvasToScreen(400, 250, canvasRect);

      expect(point).toEqual({
        x: 500, // 400 + 100
        y: 300, // 250 + 50
      });
    });

    it('should be inverse of screenToCanvas', () => {
      const canvasRect = new DOMRect(123, 456, 800, 600);
      const screenPoint = { x: 500, y: 300 };

      const canvasPoint = screenToCanvas(screenPoint.x, screenPoint.y, canvasRect);
      const backToScreen = canvasToScreen(canvasPoint.x, canvasPoint.y, canvasRect);

      expect(backToScreen).toEqual(screenPoint);
    });

    it('should handle canvas at origin', () => {
      const canvasRect = new DOMRect(0, 0, 800, 600);
      const point = canvasToScreen(400, 300, canvasRect);

      expect(point).toEqual({ x: 400, y: 300 });
    });
  });

  describe('screenToImage', () => {
    it('should convert screen coordinates directly to image coordinates', () => {
      const canvasRect = new DOMRect(0, 0, 800, 600);
      const params: TransformParams = {
        ...defaultParams,
        zoom: 1,
        pan: { x: 0, y: 0 },
      };

      // Screen (400, 300) -> Canvas (400, 300) -> Image (500, 400)
      const point = screenToImage(400, 300, canvasRect, params);

      expect(point.x).toBe(500);
      expect(point.y).toBe(400);
    });

    it('should handle canvas offset and zoom', () => {
      const canvasRect = new DOMRect(100, 50, 800, 600);
      const params: TransformParams = {
        ...defaultParams,
        zoom: 2,
        pan: { x: 0, y: 0 },
      };

      const point = screenToImage(500, 300, canvasRect, params);

      // Screen (500, 300) -> Canvas (400, 250) -> Image ...
      const expectedCanvasPoint = screenToCanvas(500, 300, canvasRect);
      const expectedImagePoint = canvasToImage(expectedCanvasPoint.x, expectedCanvasPoint.y, params);

      expect(point).toEqual(expectedImagePoint);
    });

    it('should combine transformations correctly', () => {
      const canvasRect = new DOMRect(50, 25, 800, 600);
      const params: TransformParams = {
        ...defaultParams,
        zoom: 1.5,
        pan: { x: 10, y: 20 },
      };

      const screenX = 300;
      const screenY = 200;

      // Manual calculation
      const canvasPoint = screenToCanvas(screenX, screenY, canvasRect);
      const imagePoint = canvasToImage(canvasPoint.x, canvasPoint.y, params);

      // Function result
      const result = screenToImage(screenX, screenY, canvasRect, params);

      expect(result).toEqual(imagePoint);
    });
  });

  describe('getTransformMatrix', () => {
    it('should return correct transform matrix with no zoom or pan', () => {
      const matrix = getTransformMatrix(defaultParams);

      expect(matrix).toEqual([
        1,    // scaleX (zoom)
        0,    // skewY
        0,    // skewX
        1,    // scaleY (zoom)
        -100, // translateX (image bounds x)
        -100, // translateY (image bounds y)
      ]);
    });

    it('should return correct transform matrix with zoom', () => {
      const params: TransformParams = {
        ...defaultParams,
        zoom: 2,
      };
      const matrix = getTransformMatrix(params);

      expect(matrix[0]).toBe(2); // scaleX
      expect(matrix[3]).toBe(2); // scaleY
      expect(matrix[4]).toBe(-600); // translateX
      expect(matrix[5]).toBe(-500); // translateY
    });

    it('should return correct transform matrix with pan', () => {
      const params: TransformParams = {
        ...defaultParams,
        pan: { x: 50, y: 30 },
      };
      const matrix = getTransformMatrix(params);

      expect(matrix[4]).toBe(-50); // translateX
      expect(matrix[5]).toBe(-70); // translateY
    });

    it('should have skew values of 0', () => {
      const matrix = getTransformMatrix(defaultParams);

      expect(matrix[1]).toBe(0); // skewY
      expect(matrix[2]).toBe(0); // skewX
    });
  });

  describe('applyTransform', () => {
    it('should transform a point with identity matrix', () => {
      const point: Point = { x: 100, y: 200 };
      const matrix: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];

      const result = applyTransform(point, matrix);

      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('should apply scale transformation', () => {
      const point: Point = { x: 100, y: 200 };
      const matrix: [number, number, number, number, number, number] = [2, 0, 0, 2, 0, 0];

      const result = applyTransform(point, matrix);

      expect(result).toEqual({ x: 200, y: 400 });
    });

    it('should apply translation', () => {
      const point: Point = { x: 100, y: 200 };
      const matrix: [number, number, number, number, number, number] = [1, 0, 0, 1, 50, 30];

      const result = applyTransform(point, matrix);

      expect(result).toEqual({ x: 150, y: 230 });
    });

    it('should apply combined scale and translation', () => {
      const point: Point = { x: 100, y: 200 };
      const matrix: [number, number, number, number, number, number] = [2, 0, 0, 2, 50, 30];

      const result = applyTransform(point, matrix);

      expect(result).toEqual({
        x: 250, // 100 * 2 + 50
        y: 430, // 200 * 2 + 30
      });
    });

    it('should handle negative scale', () => {
      const point: Point = { x: 100, y: 200 };
      const matrix: [number, number, number, number, number, number] = [-1, 0, 0, -1, 0, 0];

      const result = applyTransform(point, matrix);

      expect(result).toEqual({ x: -100, y: -200 });
    });
  });

  describe('applyTransformBatch', () => {
    it('should transform multiple points', () => {
      const points: Point[] = [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];
      const matrix: [number, number, number, number, number, number] = [2, 0, 0, 2, 10, 20];

      const results = applyTransformBatch(points, matrix);

      expect(results).toEqual([
        { x: 10, y: 20 },    // 0 * 2 + 10, 0 * 2 + 20
        { x: 210, y: 220 },  // 100 * 2 + 10, 100 * 2 + 20
        { x: 410, y: 420 },  // 200 * 2 + 10, 200 * 2 + 20
      ]);
    });

    it('should handle empty array', () => {
      const points: Point[] = [];
      const matrix: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];

      const results = applyTransformBatch(points, matrix);

      expect(results).toEqual([]);
    });

    it('should handle single point', () => {
      const points: Point[] = [{ x: 50, y: 75 }];
      const matrix: [number, number, number, number, number, number] = [1.5, 0, 0, 1.5, 10, 20];

      const results = applyTransformBatch(points, matrix);

      expect(results).toEqual([
        { x: 85, y: 132.5 }, // 50 * 1.5 + 10, 75 * 1.5 + 20
      ]);
    });

    it('should apply same transformation to all points', () => {
      const points: Point[] = [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ];
      const matrix: [number, number, number, number, number, number] = [1, 0, 0, 1, 100, 200];

      const results = applyTransformBatch(points, matrix);

      // Each point should have 100 added to x and 200 to y
      expect(results[0]).toEqual({ x: 110, y: 220 });
      expect(results[1]).toEqual({ x: 130, y: 240 });
    });
  });

  describe('edge cases and error conditions', () => {
    it('should handle zero zoom gracefully', () => {
      const params: TransformParams = {
        ...defaultParams,
        zoom: 0,
      };

      // Should not throw, but results may be Infinity
      expect(() => canvasToImage(100, 100, params)).not.toThrow();
    });

    it('should handle negative zoom values', () => {
      const params: TransformParams = {
        ...defaultParams,
        zoom: -1,
      };

      // Should not throw
      expect(() => canvasToImage(100, 100, params)).not.toThrow();
    });

    it('should handle very large zoom values', () => {
      const params: TransformParams = {
        ...defaultParams,
        zoom: 1000,
      };

      const bounds = getImageBounds(params);
      expect(bounds.width).toBe(1000000);
      expect(bounds.height).toBe(800000);
    });

    it('should handle very small image dimensions', () => {
      const params: TransformParams = {
        ...defaultParams,
        imageWidth: 1,
        imageHeight: 1,
      };

      const point = canvasToImage(400, 300, params);
      expect(point.x).toBeDefined();
      expect(point.y).toBeDefined();
    });

    it('should handle very large pan values', () => {
      const params: TransformParams = {
        ...defaultParams,
        pan: { x: 10000, y: 10000 },
      };

      const bounds = getImageBounds(params);
      expect(bounds.x).toBeGreaterThan(0);
      expect(bounds.y).toBeGreaterThan(0);
    });
  });
});
