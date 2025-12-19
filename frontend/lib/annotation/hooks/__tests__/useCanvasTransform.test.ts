/**
 * useCanvasTransform Hook Tests
 *
 * Tests for pan/zoom gesture state management
 * Phase 18: Canvas Architecture Refactoring
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasTransform } from '../useCanvasTransform';

describe('useCanvasTransform', () => {
  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useCanvasTransform());

      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toBeNull();
    });
  });

  describe('Pan State', () => {
    it('should update isPanning state', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.setIsPanning(true);
      });

      expect(result.current.isPanning).toBe(true);
    });

    it('should toggle isPanning', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.setIsPanning(true);
      });
      expect(result.current.isPanning).toBe(true);

      act(() => {
        result.current.setIsPanning(false);
      });
      expect(result.current.isPanning).toBe(false);
    });

    it('should update panStart position', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.setPanStart({ x: 100, y: 200 });
      });

      expect(result.current.panStart).toEqual({ x: 100, y: 200 });
    });

    it('should clear panStart', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.setPanStart({ x: 100, y: 200 });
      });
      expect(result.current.panStart).not.toBeNull();

      act(() => {
        result.current.setPanStart(null);
      });
      expect(result.current.panStart).toBeNull();
    });
  });

  describe('startPan Action', () => {
    it('should start pan gesture', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(150, 250);
      });

      expect(result.current.isPanning).toBe(true);
      expect(result.current.panStart).toEqual({ x: 150, y: 250 });
    });

    it('should handle zero coordinates', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(0, 0);
      });

      expect(result.current.isPanning).toBe(true);
      expect(result.current.panStart).toEqual({ x: 0, y: 0 });
    });

    it('should handle negative coordinates', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(-50, -100);
      });

      expect(result.current.isPanning).toBe(true);
      expect(result.current.panStart).toEqual({ x: -50, y: -100 });
    });

    it('should handle fractional coordinates', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(123.456, 789.012);
      });

      expect(result.current.isPanning).toBe(true);
      expect(result.current.panStart).toEqual({ x: 123.456, y: 789.012 });
    });

    it('should overwrite previous pan start', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(100, 200);
      });
      expect(result.current.panStart).toEqual({ x: 100, y: 200 });

      act(() => {
        result.current.startPan(300, 400);
      });
      expect(result.current.panStart).toEqual({ x: 300, y: 400 });
    });
  });

  describe('endPan Action', () => {
    it('should end pan gesture', () => {
      const { result } = renderHook(() => useCanvasTransform());

      // Start panning
      act(() => {
        result.current.startPan(100, 200);
      });
      expect(result.current.isPanning).toBe(true);
      expect(result.current.panStart).not.toBeNull();

      // End panning
      act(() => {
        result.current.endPan();
      });
      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toBeNull();
    });

    it('should be idempotent when not panning', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.endPan();
        result.current.endPan();
      });

      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toBeNull();
    });

    it('should handle multiple end calls', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(100, 200);
      });

      act(() => {
        result.current.endPan();
        result.current.endPan();
        result.current.endPan();
      });

      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toBeNull();
    });
  });

  describe('resetTransformState Action', () => {
    it('should reset all transform state', () => {
      const { result } = renderHook(() => useCanvasTransform());

      // Set state
      act(() => {
        result.current.setIsPanning(true);
        result.current.setPanStart({ x: 100, y: 200 });
      });

      expect(result.current.isPanning).toBe(true);
      expect(result.current.panStart).not.toBeNull();

      // Reset
      act(() => {
        result.current.resetTransformState();
      });

      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toBeNull();
    });

    it('should be idempotent', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.resetTransformState();
        result.current.resetTransformState();
        result.current.resetTransformState();
      });

      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toBeNull();
    });

    it('should reset state started by startPan', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(150, 250);
      });

      act(() => {
        result.current.resetTransformState();
      });

      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toBeNull();
    });
  });

  describe('Pan Gesture Workflow', () => {
    it('should handle complete pan gesture cycle', () => {
      const { result } = renderHook(() => useCanvasTransform());

      // Initial state
      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toBeNull();

      // Start pan
      act(() => {
        result.current.startPan(100, 100);
      });
      expect(result.current.isPanning).toBe(true);
      expect(result.current.panStart).toEqual({ x: 100, y: 100 });

      // End pan
      act(() => {
        result.current.endPan();
      });
      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toBeNull();
    });

    it('should handle multiple pan gestures in sequence', () => {
      const { result } = renderHook(() => useCanvasTransform());

      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.startPan(i * 10, i * 20);
        });
        expect(result.current.isPanning).toBe(true);
        expect(result.current.panStart).toEqual({ x: i * 10, y: i * 20 });

        act(() => {
          result.current.endPan();
        });
        expect(result.current.isPanning).toBe(false);
        expect(result.current.panStart).toBeNull();
      }
    });

    it('should handle interrupted pan (reset instead of end)', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(50, 75);
      });
      expect(result.current.isPanning).toBe(true);

      // Reset instead of end
      act(() => {
        result.current.resetTransformState();
      });
      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toBeNull();
    });

    it('should allow restarting pan without ending first', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(100, 100);
      });

      // Start a new pan without ending the previous one
      act(() => {
        result.current.startPan(200, 200);
      });

      expect(result.current.isPanning).toBe(true);
      expect(result.current.panStart).toEqual({ x: 200, y: 200 });
    });
  });

  describe('Manual State Updates', () => {
    it('should allow manual isPanning control', () => {
      const { result } = renderHook(() => useCanvasTransform());

      // Manually set isPanning without using startPan
      act(() => {
        result.current.setIsPanning(true);
      });
      expect(result.current.isPanning).toBe(true);
      expect(result.current.panStart).toBeNull(); // Should remain null

      act(() => {
        result.current.setIsPanning(false);
      });
      expect(result.current.isPanning).toBe(false);
    });

    it('should allow manual panStart control', () => {
      const { result } = renderHook(() => useCanvasTransform());

      // Manually set panStart without using startPan
      act(() => {
        result.current.setPanStart({ x: 50, y: 100 });
      });
      expect(result.current.panStart).toEqual({ x: 50, y: 100 });
      expect(result.current.isPanning).toBe(false); // Should remain false
    });

    it('should allow independent state control', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.setIsPanning(true);
        result.current.setPanStart({ x: 100, y: 200 });
      });

      expect(result.current.isPanning).toBe(true);
      expect(result.current.panStart).toEqual({ x: 100, y: 200 });

      // Change only isPanning
      act(() => {
        result.current.setIsPanning(false);
      });
      expect(result.current.isPanning).toBe(false);
      expect(result.current.panStart).toEqual({ x: 100, y: 200 }); // Should not change
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large coordinates', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(999999, 999999);
      });

      expect(result.current.panStart).toEqual({ x: 999999, y: 999999 });
    });

    it('should handle very small coordinates', () => {
      const { result } = renderHook(() => useCanvasTransform());

      act(() => {
        result.current.startPan(0.0001, 0.0002);
      });

      expect(result.current.panStart).toEqual({ x: 0.0001, y: 0.0002 });
    });
  });

  describe('Callback Stability', () => {
    it('should have stable function references', () => {
      const { result, rerender } = renderHook(() => useCanvasTransform());

      const firstStartPan = result.current.startPan;
      const firstEndPan = result.current.endPan;
      const firstReset = result.current.resetTransformState;

      rerender();

      expect(result.current.startPan).toBe(firstStartPan);
      expect(result.current.endPan).toBe(firstEndPan);
      expect(result.current.resetTransformState).toBe(firstReset);
    });
  });
});
