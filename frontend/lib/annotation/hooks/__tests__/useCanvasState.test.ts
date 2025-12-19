/**
 * useCanvasState Hook Tests
 *
 * Tests for Canvas UI state management
 * Phase 18: Canvas Architecture Refactoring
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasState } from '../useCanvasState';

describe('useCanvasState', () => {
  describe('Initial State', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useCanvasState());

      expect(result.current.showClassSelector).toBe(false);
      expect(result.current.canvasCursor).toBe('default');
      expect(result.current.cursorPos).toEqual({ x: 0, y: 0 });
      expect(result.current.batchProgress).toBeNull();
    });
  });

  describe('Class Selector', () => {
    it('should update showClassSelector', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setShowClassSelector(true);
      });

      expect(result.current.showClassSelector).toBe(true);
    });

    it('should toggle showClassSelector', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setShowClassSelector(true);
      });
      expect(result.current.showClassSelector).toBe(true);

      act(() => {
        result.current.setShowClassSelector(false);
      });
      expect(result.current.showClassSelector).toBe(false);
    });
  });

  describe('Canvas Cursor', () => {
    it('should update cursor style', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setCanvasCursor('crosshair');
      });

      expect(result.current.canvasCursor).toBe('crosshair');
    });

    it('should handle different cursor values', () => {
      const { result } = renderHook(() => useCanvasState());

      const cursors = ['default', 'crosshair', 'pointer', 'move', 'grab', 'grabbing'];

      cursors.forEach((cursor) => {
        act(() => {
          result.current.setCanvasCursor(cursor);
        });
        expect(result.current.canvasCursor).toBe(cursor);
      });
    });
  });

  describe('Cursor Position', () => {
    it('should update cursor position', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setCursorPos({ x: 100, y: 200 });
      });

      expect(result.current.cursorPos).toEqual({ x: 100, y: 200 });
    });

    it('should handle multiple position updates', () => {
      const { result } = renderHook(() => useCanvasState());

      const positions = [
        { x: 0, y: 0 },
        { x: 50, y: 100 },
        { x: 200, y: 300 },
        { x: -10, y: -20 },
      ];

      positions.forEach((pos) => {
        act(() => {
          result.current.setCursorPos(pos);
        });
        expect(result.current.cursorPos).toEqual(pos);
      });
    });

    it('should handle negative coordinates', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setCursorPos({ x: -50, y: -100 });
      });

      expect(result.current.cursorPos).toEqual({ x: -50, y: -100 });
    });

    it('should handle fractional coordinates', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setCursorPos({ x: 123.456, y: 789.012 });
      });

      expect(result.current.cursorPos).toEqual({ x: 123.456, y: 789.012 });
    });
  });

  describe('Batch Progress', () => {
    it('should update batch progress', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setBatchProgress({ current: 5, total: 10 });
      });

      expect(result.current.batchProgress).toEqual({ current: 5, total: 10 });
    });

    it('should clear batch progress', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setBatchProgress({ current: 5, total: 10 });
      });
      expect(result.current.batchProgress).not.toBeNull();

      act(() => {
        result.current.setBatchProgress(null);
      });
      expect(result.current.batchProgress).toBeNull();
    });

    it('should handle progress updates', () => {
      const { result } = renderHook(() => useCanvasState());

      for (let i = 0; i <= 10; i++) {
        act(() => {
          result.current.setBatchProgress({ current: i, total: 10 });
        });
        expect(result.current.batchProgress).toEqual({ current: i, total: 10 });
      }
    });

    it('should handle zero progress', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setBatchProgress({ current: 0, total: 0 });
      });

      expect(result.current.batchProgress).toEqual({ current: 0, total: 0 });
    });

    it('should handle large progress values', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setBatchProgress({ current: 500, total: 1000 });
      });

      expect(result.current.batchProgress).toEqual({ current: 500, total: 1000 });
    });
  });

  describe('Reset State', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useCanvasState());

      // Modify all state
      act(() => {
        result.current.setShowClassSelector(true);
        result.current.setCanvasCursor('crosshair');
        result.current.setCursorPos({ x: 100, y: 200 });
        result.current.setBatchProgress({ current: 5, total: 10 });
      });

      // Verify state was modified
      expect(result.current.showClassSelector).toBe(true);
      expect(result.current.canvasCursor).toBe('crosshair');
      expect(result.current.cursorPos).toEqual({ x: 100, y: 200 });
      expect(result.current.batchProgress).toEqual({ current: 5, total: 10 });

      // Reset
      act(() => {
        result.current.resetState();
      });

      // Verify reset
      expect(result.current.showClassSelector).toBe(false);
      expect(result.current.canvasCursor).toBe('default');
      expect(result.current.cursorPos).toEqual({ x: 0, y: 0 });
      expect(result.current.batchProgress).toBeNull();
    });

    it('should reset partially modified state', () => {
      const { result } = renderHook(() => useCanvasState());

      // Modify only some state
      act(() => {
        result.current.setShowClassSelector(true);
        result.current.setCursorPos({ x: 50, y: 75 });
      });

      act(() => {
        result.current.resetState();
      });

      // All state should be reset
      expect(result.current.showClassSelector).toBe(false);
      expect(result.current.canvasCursor).toBe('default');
      expect(result.current.cursorPos).toEqual({ x: 0, y: 0 });
      expect(result.current.batchProgress).toBeNull();
    });

    it('should be idempotent', () => {
      const { result } = renderHook(() => useCanvasState());

      // Reset multiple times
      act(() => {
        result.current.resetState();
        result.current.resetState();
        result.current.resetState();
      });

      // State should still be at initial values
      expect(result.current.showClassSelector).toBe(false);
      expect(result.current.canvasCursor).toBe('default');
      expect(result.current.cursorPos).toEqual({ x: 0, y: 0 });
      expect(result.current.batchProgress).toBeNull();
    });
  });

  describe('Combined Operations', () => {
    it('should handle multiple state changes in sequence', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        result.current.setShowClassSelector(true);
      });
      expect(result.current.showClassSelector).toBe(true);

      act(() => {
        result.current.setCanvasCursor('pointer');
      });
      expect(result.current.canvasCursor).toBe('pointer');

      act(() => {
        result.current.setCursorPos({ x: 150, y: 250 });
      });
      expect(result.current.cursorPos).toEqual({ x: 150, y: 250 });

      act(() => {
        result.current.setBatchProgress({ current: 3, total: 7 });
      });
      expect(result.current.batchProgress).toEqual({ current: 3, total: 7 });

      // All previous state should be preserved
      expect(result.current.showClassSelector).toBe(true);
      expect(result.current.canvasCursor).toBe('pointer');
    });

    it('should handle rapid updates', () => {
      const { result } = renderHook(() => useCanvasState());

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.setCursorPos({ x: i, y: i * 2 });
        }
      });

      expect(result.current.cursorPos).toEqual({ x: 99, y: 198 });
    });
  });

  describe('Callback Stability', () => {
    it('should have stable resetState function reference', () => {
      const { result, rerender } = renderHook(() => useCanvasState());

      const firstResetFn = result.current.resetState;
      rerender();
      const secondResetFn = result.current.resetState;

      expect(firstResetFn).toBe(secondResetFn);
    });
  });
});
