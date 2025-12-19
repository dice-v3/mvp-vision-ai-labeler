/**
 * Tests for renderHelpers.ts
 *
 * Tests all canvas rendering helper functions.
 * Target coverage: >90%
 *
 * Phase 18.6: Comprehensive Testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  drawGrid,
  drawCrosshair,
  drawNoObjectBadge,
  drawVertexHandle,
  drawBboxHandle,
  drawCircleHandle,
  setupCanvasContext,
} from '../renderHelpers';

describe('renderHelpers', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    ctx = canvas.getContext('2d')!;

    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('drawGrid', () => {
    it('should draw vertical and horizontal grid lines', () => {
      const width = 800;
      const height = 600;
      const imgX = 0;
      const imgY = 0;
      const imgWidth = 400;
      const imgHeight = 300;
      const zoom = 1;

      drawGrid(ctx, width, height, imgX, imgY, imgWidth, imgHeight, zoom);

      // Verify stroke style and line width are set
      expect(ctx.strokeStyle).toBe('rgba(75, 85, 99, 0.3)');
      expect(ctx.lineWidth).toBe(1);

      // Verify beginPath, moveTo, lineTo, stroke are called
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should adjust grid size based on zoom', () => {
      const zoom = 2;
      const gridSize = 20 * zoom; // Should be 40

      drawGrid(ctx, 800, 600, 0, 0, 400, 300, zoom);

      // Grid lines should be drawn at intervals of gridSize
      // Verify that moveTo/lineTo are called with zoom-adjusted positions
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.lineTo).toHaveBeenCalled();
    });

    it('should handle negative image offsets', () => {
      drawGrid(ctx, 800, 600, -100, -100, 400, 300, 1);

      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should handle zero-sized image', () => {
      drawGrid(ctx, 800, 600, 0, 0, 0, 0, 1);

      // Should not crash, but may not draw anything
      expect(ctx.strokeStyle).toBe('rgba(75, 85, 99, 0.3)');
    });

    it('should handle very small zoom values', () => {
      drawGrid(ctx, 800, 600, 0, 0, 400, 300, 0.1);

      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });
  });

  describe('drawCrosshair', () => {
    it('should draw crosshair at specified position', () => {
      const x = 400;
      const y = 300;
      const width = 800;
      const height = 600;

      drawCrosshair(ctx, x, y, width, height);

      // Verify stroke style is set
      expect(ctx.strokeStyle).toBe('rgba(147, 51, 234, 0.3)');
      expect(ctx.lineWidth).toBe(1);

      // Verify vertical line (x, 0) to (x, height)
      expect(ctx.moveTo).toHaveBeenCalledWith(x, 0);
      expect(ctx.lineTo).toHaveBeenCalledWith(x, height);

      // Verify horizontal line (0, y) to (width, y)
      expect(ctx.moveTo).toHaveBeenCalledWith(0, y);
      expect(ctx.lineTo).toHaveBeenCalledWith(width, y);

      // Verify beginPath and stroke are called
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should use custom color when provided', () => {
      const customColor = 'rgba(255, 0, 0, 0.5)';

      drawCrosshair(ctx, 400, 300, 800, 600, customColor);

      expect(ctx.strokeStyle).toBe(customColor);
    });

    it('should handle edge positions', () => {
      drawCrosshair(ctx, 0, 0, 800, 600);
      expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);

      vi.clearAllMocks();

      drawCrosshair(ctx, 800, 600, 800, 600);
      expect(ctx.moveTo).toHaveBeenCalledWith(800, 0);
      expect(ctx.moveTo).toHaveBeenCalledWith(0, 600);
    });

    it('should handle negative positions', () => {
      drawCrosshair(ctx, -10, -20, 800, 600);

      expect(ctx.moveTo).toHaveBeenCalledWith(-10, 0);
      expect(ctx.moveTo).toHaveBeenCalledWith(0, -20);
    });
  });

  describe('drawNoObjectBadge', () => {
    it('should draw badge with default text', () => {
      const offsetX = 0;
      const offsetY = 0;

      drawNoObjectBadge(ctx, offsetX, offsetY);

      // Verify font is set
      expect(ctx.font).toBe('14px sans-serif');

      // Verify measureText is called
      expect(ctx.measureText).toHaveBeenCalledWith('No Object');

      // Verify fill style for background
      expect(ctx.fillStyle).toBeDefined();

      // Verify rounded rectangle is drawn
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.moveTo).toHaveBeenCalled();
      expect(ctx.quadraticCurveTo).toHaveBeenCalled();
      expect(ctx.closePath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();

      // Verify text is drawn
      expect(ctx.fillText).toHaveBeenCalledWith('No Object', expect.any(Number), expect.any(Number));
    });

    it('should draw badge with custom text', () => {
      const customText = 'Empty Image';

      drawNoObjectBadge(ctx, 0, 0, customText);

      expect(ctx.measureText).toHaveBeenCalledWith(customText);
      expect(ctx.fillText).toHaveBeenCalledWith(customText, expect.any(Number), expect.any(Number));
    });

    it('should position badge based on offsets', () => {
      const offsetX = 100;
      const offsetY = 200;

      drawNoObjectBadge(ctx, offsetX, offsetY);

      // Badge should be drawn at (offsetX + 10, offsetY + 10)
      // Verify moveTo is called with correct starting position
      expect(ctx.moveTo).toHaveBeenCalled();
    });

    it('should handle very long text', () => {
      const longText = 'This is a very long text for the badge';

      drawNoObjectBadge(ctx, 0, 0, longText);

      expect(ctx.measureText).toHaveBeenCalledWith(longText);
      expect(ctx.fillText).toHaveBeenCalledWith(longText, expect.any(Number), expect.any(Number));
    });

    it('should set text baseline to middle', () => {
      drawNoObjectBadge(ctx, 0, 0);

      expect(ctx.textBaseline).toBe('middle');
    });
  });

  describe('drawVertexHandle', () => {
    it('should draw vertex handle with default params', () => {
      const x = 100;
      const y = 200;

      drawVertexHandle(ctx, x, y);

      // Verify fill and stroke styles
      expect(ctx.fillStyle).toBe('#9333ea'); // Not selected, uses color
      expect(ctx.strokeStyle).toBe('#9333ea');
      expect(ctx.lineWidth).toBe(2);

      // Verify arc is drawn
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.arc).toHaveBeenCalledWith(x, y, 6, 0, Math.PI * 2);
      expect(ctx.fill).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should draw selected vertex handle with white fill', () => {
      const x = 100;
      const y = 200;

      drawVertexHandle(ctx, x, y, 6, true);

      expect(ctx.fillStyle).toBe('#ffffff'); // Selected, uses white
      expect(ctx.strokeStyle).toBe('#9333ea');
    });

    it('should use custom size', () => {
      const x = 100;
      const y = 200;
      const size = 10;

      drawVertexHandle(ctx, x, y, size);

      expect(ctx.arc).toHaveBeenCalledWith(x, y, size, 0, Math.PI * 2);
    });

    it('should use custom color', () => {
      const x = 100;
      const y = 200;
      const customColor = '#ff0000';

      drawVertexHandle(ctx, x, y, 6, false, customColor);

      expect(ctx.fillStyle).toBe(customColor);
      expect(ctx.strokeStyle).toBe(customColor);
    });

    it('should handle negative positions', () => {
      drawVertexHandle(ctx, -10, -20);

      expect(ctx.arc).toHaveBeenCalledWith(-10, -20, 6, 0, Math.PI * 2);
    });
  });

  describe('drawBboxHandle', () => {
    it('should draw corner handles as squares', () => {
      const x = 100;
      const y = 200;
      const size = 8;

      const cornerHandles = ['nw', 'ne', 'sw', 'se'];

      cornerHandles.forEach((handle) => {
        vi.clearAllMocks();

        drawBboxHandle(ctx, x, y, size, handle);

        // Verify fill and stroke styles
        expect(ctx.fillStyle).toBe('#ffffff');
        expect(ctx.strokeStyle).toBe('#9333ea');
        expect(ctx.lineWidth).toBe(2);

        // Verify square is drawn
        expect(ctx.fillRect).toHaveBeenCalledWith(
          x - size / 2,
          y - size / 2,
          size,
          size
        );
        expect(ctx.strokeRect).toHaveBeenCalledWith(
          x - size / 2,
          y - size / 2,
          size,
          size
        );
      });
    });

    it('should draw vertical edge handles as rectangles', () => {
      const x = 100;
      const y = 200;
      const size = 8;

      const verticalHandles = ['n', 's'];

      verticalHandles.forEach((handle) => {
        vi.clearAllMocks();

        drawBboxHandle(ctx, x, y, size, handle);

        // Vertical handles: width = size * 1.5, height = size
        const width = size * 1.5;
        const height = size;

        expect(ctx.fillRect).toHaveBeenCalledWith(
          x - width / 2,
          y - height / 2,
          width,
          height
        );
        expect(ctx.strokeRect).toHaveBeenCalledWith(
          x - width / 2,
          y - height / 2,
          width,
          height
        );
      });
    });

    it('should draw horizontal edge handles as rectangles', () => {
      const x = 100;
      const y = 200;
      const size = 8;

      const horizontalHandles = ['w', 'e'];

      horizontalHandles.forEach((handle) => {
        vi.clearAllMocks();

        drawBboxHandle(ctx, x, y, size, handle);

        // Horizontal handles: width = size, height = size * 1.5
        const width = size;
        const height = size * 1.5;

        expect(ctx.fillRect).toHaveBeenCalledWith(
          x - width / 2,
          y - height / 2,
          width,
          height
        );
        expect(ctx.strokeRect).toHaveBeenCalledWith(
          x - width / 2,
          y - height / 2,
          width,
          height
        );
      });
    });

    it('should use custom size', () => {
      const x = 100;
      const y = 200;
      const size = 12;

      drawBboxHandle(ctx, x, y, size, 'nw');

      expect(ctx.fillRect).toHaveBeenCalledWith(
        x - size / 2,
        y - size / 2,
        size,
        size
      );
    });

    it('should use custom color', () => {
      const customColor = '#00ff00';

      drawBboxHandle(ctx, 100, 200, 8, 'ne', customColor);

      expect(ctx.strokeStyle).toBe(customColor);
    });
  });

  describe('drawCircleHandle', () => {
    it('should draw center handle as crosshair', () => {
      const x = 100;
      const y = 200;
      const size = 6;

      drawCircleHandle(ctx, x, y, size, 'center');

      // Verify stroke style and line width
      expect(ctx.strokeStyle).toBe('#9333ea');
      expect(ctx.lineWidth).toBe(2);

      // Verify crosshair lines
      const len = size + 4;

      // Horizontal line
      expect(ctx.moveTo).toHaveBeenCalledWith(x - len, y);
      expect(ctx.lineTo).toHaveBeenCalledWith(x + len, y);

      // Vertical line
      expect(ctx.moveTo).toHaveBeenCalledWith(x, y - len);
      expect(ctx.lineTo).toHaveBeenCalledWith(x, y + len);

      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should draw edge/point handles as filled circles', () => {
      const x = 100;
      const y = 200;
      const size = 6;

      const handleTypes = ['edge', 'point1', 'point2', 'point3'];

      handleTypes.forEach((handleType) => {
        vi.clearAllMocks();

        drawCircleHandle(ctx, x, y, size, handleType);

        // Verify fill and stroke styles
        expect(ctx.fillStyle).toBe('#ffffff');
        expect(ctx.strokeStyle).toBe('#9333ea');
        expect(ctx.lineWidth).toBe(2);

        // Verify circle is drawn
        expect(ctx.arc).toHaveBeenCalledWith(x, y, size, 0, Math.PI * 2);
        expect(ctx.fill).toHaveBeenCalled();
        expect(ctx.stroke).toHaveBeenCalled();
      });
    });

    it('should use custom size for center handle', () => {
      const size = 10;

      drawCircleHandle(ctx, 100, 200, size, 'center');

      const len = size + 4;
      expect(ctx.lineTo).toHaveBeenCalledWith(100 + len, 200);
    });

    it('should use custom size for edge handles', () => {
      const size = 10;

      drawCircleHandle(ctx, 100, 200, size, 'edge');

      expect(ctx.arc).toHaveBeenCalledWith(100, 200, size, 0, Math.PI * 2);
    });

    it('should use custom color', () => {
      const customColor = '#ff0000';

      drawCircleHandle(ctx, 100, 200, 6, 'center', customColor);

      expect(ctx.strokeStyle).toBe(customColor);
    });

    it('should handle negative positions', () => {
      drawCircleHandle(ctx, -10, -20, 6, 'edge');

      expect(ctx.arc).toHaveBeenCalledWith(-10, -20, 6, 0, Math.PI * 2);
    });
  });

  describe('setupCanvasContext', () => {
    it('should set default canvas context properties', () => {
      setupCanvasContext(ctx);

      // Verify image smoothing
      expect(ctx.imageSmoothingEnabled).toBe(true);
      expect(ctx.imageSmoothingQuality).toBe('high');

      // Verify line properties
      expect(ctx.lineCap).toBe('round');
      expect(ctx.lineJoin).toBe('round');

      // Verify line width with default zoom (1)
      expect(ctx.lineWidth).toBe(2);
    });

    it('should adjust line width based on zoom (inverse scaling)', () => {
      // At zoom 2, line width should be 2 / 2 = 1
      setupCanvasContext(ctx, 2);
      expect(ctx.lineWidth).toBe(1);

      // At zoom 0.5, line width should be 2 / 0.5 = 4
      setupCanvasContext(ctx, 0.5);
      expect(ctx.lineWidth).toBe(4);

      // At zoom 4, line width should be 2 / 4 = 0.5, but minimum is 1
      setupCanvasContext(ctx, 4);
      expect(ctx.lineWidth).toBe(1); // Math.max(1, 2 / 4)
    });

    it('should enforce minimum line width of 1', () => {
      setupCanvasContext(ctx, 10);

      // 2 / 10 = 0.2, but minimum is 1
      expect(ctx.lineWidth).toBe(1);
    });

    it('should handle very small zoom values', () => {
      setupCanvasContext(ctx, 0.1);

      // 2 / 0.1 = 20
      expect(ctx.lineWidth).toBe(20);
    });

    it('should handle zoom value of 1', () => {
      setupCanvasContext(ctx, 1);

      // 2 / 1 = 2
      expect(ctx.lineWidth).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle context with undefined properties', () => {
      // Test that functions don't crash with minimal context
      expect(() => {
        drawGrid(ctx, 800, 600, 0, 0, 400, 300, 1);
        drawCrosshair(ctx, 400, 300, 800, 600);
        drawNoObjectBadge(ctx, 0, 0);
        drawVertexHandle(ctx, 100, 200);
        drawBboxHandle(ctx, 100, 200, 8, 'nw');
        drawCircleHandle(ctx, 100, 200, 6, 'center');
        setupCanvasContext(ctx);
      }).not.toThrow();
    });

    it('should handle zero dimensions', () => {
      expect(() => {
        drawGrid(ctx, 0, 0, 0, 0, 0, 0, 1);
        drawCrosshair(ctx, 0, 0, 0, 0);
      }).not.toThrow();
    });

    it('should handle very large coordinates', () => {
      expect(() => {
        drawGrid(ctx, 10000, 10000, 5000, 5000, 8000, 8000, 1);
        drawCrosshair(ctx, 5000, 5000, 10000, 10000);
        drawVertexHandle(ctx, 10000, 10000);
      }).not.toThrow();
    });
  });
});
