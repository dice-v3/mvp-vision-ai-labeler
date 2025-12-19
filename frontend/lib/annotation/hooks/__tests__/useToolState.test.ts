/**
 * useToolState Hook Tests
 *
 * Tests for tool-specific drawing state management
 * Phase 18: Canvas Architecture Refactoring
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolState } from '../useToolState';

describe('useToolState', () => {
  describe('Initial State', () => {
    it('should initialize all tool state to defaults', () => {
      const { result } = renderHook(() => useToolState());

      // Bbox
      expect(result.current.pendingBbox).toBeNull();
      expect(result.current.isResizing).toBe(false);
      expect(result.current.resizeHandle).toBeNull();
      expect(result.current.resizeStart).toBeNull();

      // Polygon
      expect(result.current.polygonVertices).toEqual([]);
      expect(result.current.isDraggingVertex).toBe(false);
      expect(result.current.draggedVertexIndex).toBeNull();
      expect(result.current.isDraggingPolygon).toBe(false);
      expect(result.current.polygonDragStart).toBeNull();

      // Polyline
      expect(result.current.polylineVertices).toEqual([]);

      // Circle
      expect(result.current.circleCenter).toBeNull();
      expect(result.current.isDraggingCircle).toBe(false);
      expect(result.current.circleDragStart).toBeNull();
      expect(result.current.isResizingCircle).toBe(false);
      expect(result.current.circleResizeStart).toBeNull();
      expect(result.current.selectedCircleHandle).toBeNull();

      // Circle 3p
      expect(result.current.circle3pPoints).toEqual([]);
    });
  });

  describe('Bbox Tool State', () => {
    it('should update pendingBbox', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setPendingBbox({ x: 10, y: 20, w: 30, h: 40 });
      });

      expect(result.current.pendingBbox).toEqual({ x: 10, y: 20, w: 30, h: 40 });
    });

    it('should update isResizing', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setIsResizing(true);
      });

      expect(result.current.isResizing).toBe(true);
    });

    it('should update resizeHandle', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setResizeHandle('bottom-right');
      });

      expect(result.current.resizeHandle).toBe('bottom-right');
    });

    it('should update resizeStart', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setResizeStart({ x: 100, y: 200, bbox: [10, 20, 30, 40] });
      });

      expect(result.current.resizeStart).toEqual({ x: 100, y: 200, bbox: [10, 20, 30, 40] });
    });

    it('should reset bbox state', () => {
      const { result } = renderHook(() => useToolState());

      // Set state
      act(() => {
        result.current.setPendingBbox({ x: 10, y: 20, w: 30, h: 40 });
        result.current.setIsResizing(true);
        result.current.setResizeHandle('top-left');
        result.current.setResizeStart({ x: 100, y: 200, bbox: [10, 20, 30, 40] });
      });

      // Reset
      act(() => {
        result.current.resetBboxState();
      });

      expect(result.current.pendingBbox).toBeNull();
      expect(result.current.isResizing).toBe(false);
      expect(result.current.resizeHandle).toBeNull();
      expect(result.current.resizeStart).toBeNull();
    });
  });

  describe('Polygon Tool State', () => {
    it('should update polygonVertices', () => {
      const { result } = renderHook(() => useToolState());

      const vertices: [number, number][] = [
        [10, 20],
        [30, 40],
        [50, 60],
      ];

      act(() => {
        result.current.setPolygonVertices(vertices);
      });

      expect(result.current.polygonVertices).toEqual(vertices);
    });

    it('should update isDraggingVertex', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setIsDraggingVertex(true);
      });

      expect(result.current.isDraggingVertex).toBe(true);
    });

    it('should update draggedVertexIndex', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setDraggedVertexIndex(2);
      });

      expect(result.current.draggedVertexIndex).toBe(2);
    });

    it('should update isDraggingPolygon', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setIsDraggingPolygon(true);
      });

      expect(result.current.isDraggingPolygon).toBe(true);
    });

    it('should update polygonDragStart', () => {
      const { result } = renderHook(() => useToolState());

      const dragStart = {
        x: 100,
        y: 200,
        points: [
          [10, 20],
          [30, 40],
        ] as [number, number][],
      };

      act(() => {
        result.current.setPolygonDragStart(dragStart);
      });

      expect(result.current.polygonDragStart).toEqual(dragStart);
    });

    it('should reset polygon state', () => {
      const { result } = renderHook(() => useToolState());

      // Set state
      act(() => {
        result.current.setPolygonVertices([
          [10, 20],
          [30, 40],
        ]);
        result.current.setIsDraggingVertex(true);
        result.current.setDraggedVertexIndex(1);
        result.current.setIsDraggingPolygon(true);
        result.current.setPolygonDragStart({ x: 100, y: 200, points: [[10, 20]] });
      });

      // Reset
      act(() => {
        result.current.resetPolygonState();
      });

      expect(result.current.polygonVertices).toEqual([]);
      expect(result.current.isDraggingVertex).toBe(false);
      expect(result.current.draggedVertexIndex).toBeNull();
      expect(result.current.isDraggingPolygon).toBe(false);
      expect(result.current.polygonDragStart).toBeNull();
    });
  });

  describe('Polyline Tool State', () => {
    it('should update polylineVertices', () => {
      const { result } = renderHook(() => useToolState());

      const vertices: [number, number][] = [
        [10, 20],
        [30, 40],
        [50, 60],
        [70, 80],
      ];

      act(() => {
        result.current.setPolylineVertices(vertices);
      });

      expect(result.current.polylineVertices).toEqual(vertices);
    });

    it('should reset polyline state', () => {
      const { result } = renderHook(() => useToolState());

      // Set state
      act(() => {
        result.current.setPolylineVertices([
          [10, 20],
          [30, 40],
        ]);
      });

      // Reset
      act(() => {
        result.current.resetPolylineState();
      });

      expect(result.current.polylineVertices).toEqual([]);
    });
  });

  describe('Circle Tool State', () => {
    it('should update circleCenter', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setCircleCenter([100, 200]);
      });

      expect(result.current.circleCenter).toEqual([100, 200]);
    });

    it('should update isDraggingCircle', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setIsDraggingCircle(true);
      });

      expect(result.current.isDraggingCircle).toBe(true);
    });

    it('should update circleDragStart', () => {
      const { result } = renderHook(() => useToolState());

      const dragStart = { x: 50, y: 75, center: [100, 200] as [number, number] };

      act(() => {
        result.current.setCircleDragStart(dragStart);
      });

      expect(result.current.circleDragStart).toEqual(dragStart);
    });

    it('should update isResizingCircle', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setIsResizingCircle(true);
      });

      expect(result.current.isResizingCircle).toBe(true);
    });

    it('should update circleResizeStart', () => {
      const { result } = renderHook(() => useToolState());

      const resizeStart = { x: 150, y: 250, radius: 50, handle: 'edge' };

      act(() => {
        result.current.setCircleResizeStart(resizeStart);
      });

      expect(result.current.circleResizeStart).toEqual(resizeStart);
    });

    it('should update selectedCircleHandle', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setSelectedCircleHandle('center');
      });

      expect(result.current.selectedCircleHandle).toBe('center');
    });

    it('should reset circle state', () => {
      const { result } = renderHook(() => useToolState());

      // Set state
      act(() => {
        result.current.setCircleCenter([100, 200]);
        result.current.setIsDraggingCircle(true);
        result.current.setCircleDragStart({ x: 50, y: 75, center: [100, 200] });
        result.current.setIsResizingCircle(true);
        result.current.setCircleResizeStart({ x: 150, y: 250, radius: 50, handle: 'edge' });
        result.current.setSelectedCircleHandle('center');
      });

      // Reset
      act(() => {
        result.current.resetCircleState();
      });

      expect(result.current.circleCenter).toBeNull();
      expect(result.current.isDraggingCircle).toBe(false);
      expect(result.current.circleDragStart).toBeNull();
      expect(result.current.isResizingCircle).toBe(false);
      expect(result.current.circleResizeStart).toBeNull();
      expect(result.current.selectedCircleHandle).toBeNull();
    });
  });

  describe('Circle 3-Point Tool State', () => {
    it('should update circle3pPoints', () => {
      const { result } = renderHook(() => useToolState());

      const points: [number, number][] = [
        [10, 20],
        [30, 40],
        [50, 60],
      ];

      act(() => {
        result.current.setCircle3pPoints(points);
      });

      expect(result.current.circle3pPoints).toEqual(points);
    });

    it('should reset circle 3p state', () => {
      const { result } = renderHook(() => useToolState());

      // Set state
      act(() => {
        result.current.setCircle3pPoints([
          [10, 20],
          [30, 40],
        ]);
      });

      // Reset
      act(() => {
        result.current.resetCircle3pState();
      });

      expect(result.current.circle3pPoints).toEqual([]);
    });
  });

  describe('Reset All Tool State', () => {
    it('should reset all tools at once', () => {
      const { result } = renderHook(() => useToolState());

      // Set state for all tools
      act(() => {
        // Bbox
        result.current.setPendingBbox({ x: 10, y: 20, w: 30, h: 40 });
        result.current.setIsResizing(true);

        // Polygon
        result.current.setPolygonVertices([[10, 20]]);
        result.current.setIsDraggingVertex(true);

        // Polyline
        result.current.setPolylineVertices([[30, 40]]);

        // Circle
        result.current.setCircleCenter([100, 200]);
        result.current.setIsDraggingCircle(true);

        // Circle 3p
        result.current.setCircle3pPoints([[50, 60]]);
      });

      // Reset all
      act(() => {
        result.current.resetAllToolState();
      });

      // Verify all reset
      expect(result.current.pendingBbox).toBeNull();
      expect(result.current.isResizing).toBe(false);
      expect(result.current.polygonVertices).toEqual([]);
      expect(result.current.isDraggingVertex).toBe(false);
      expect(result.current.polylineVertices).toEqual([]);
      expect(result.current.circleCenter).toBeNull();
      expect(result.current.isDraggingCircle).toBe(false);
      expect(result.current.circle3pPoints).toEqual([]);
    });
  });

  describe('Independent State Management', () => {
    it('should not affect other tools when updating bbox', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setPolygonVertices([[10, 20]]);
        result.current.setPendingBbox({ x: 10, y: 20, w: 30, h: 40 });
      });

      expect(result.current.polygonVertices).toEqual([[10, 20]]);
    });

    it('should not affect other tools when resetting bbox', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setPendingBbox({ x: 10, y: 20, w: 30, h: 40 });
        result.current.setPolygonVertices([[10, 20]]);
      });

      act(() => {
        result.current.resetBboxState();
      });

      expect(result.current.pendingBbox).toBeNull();
      expect(result.current.polygonVertices).toEqual([[10, 20]]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty vertex arrays', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setPolygonVertices([]);
        result.current.setPolylineVertices([]);
        result.current.setCircle3pPoints([]);
      });

      expect(result.current.polygonVertices).toEqual([]);
      expect(result.current.polylineVertices).toEqual([]);
      expect(result.current.circle3pPoints).toEqual([]);
    });

    it('should handle large vertex arrays', () => {
      const { result } = renderHook(() => useToolState());

      const largeArray: [number, number][] = Array.from({ length: 1000 }, (_, i) => [
        i,
        i * 2,
      ]);

      act(() => {
        result.current.setPolygonVertices(largeArray);
      });

      expect(result.current.polygonVertices).toHaveLength(1000);
    });

    it('should handle zero coordinates', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setPendingBbox({ x: 0, y: 0, w: 0, h: 0 });
        result.current.setCircleCenter([0, 0]);
      });

      expect(result.current.pendingBbox).toEqual({ x: 0, y: 0, w: 0, h: 0 });
      expect(result.current.circleCenter).toEqual([0, 0]);
    });

    it('should handle negative coordinates', () => {
      const { result } = renderHook(() => useToolState());

      act(() => {
        result.current.setPendingBbox({ x: -10, y: -20, w: -30, h: -40 });
        result.current.setCircleCenter([-100, -200]);
      });

      expect(result.current.pendingBbox).toEqual({ x: -10, y: -20, w: -30, h: -40 });
      expect(result.current.circleCenter).toEqual([-100, -200]);
    });
  });

  describe('Callback Stability', () => {
    it('should have stable reset function references', () => {
      const { result, rerender } = renderHook(() => useToolState());

      const firstResetBbox = result.current.resetBboxState;
      const firstResetPolygon = result.current.resetPolygonState;
      const firstResetAll = result.current.resetAllToolState;

      rerender();

      expect(result.current.resetBboxState).toBe(firstResetBbox);
      expect(result.current.resetPolygonState).toBe(firstResetPolygon);
      expect(result.current.resetAllToolState).toBe(firstResetAll);
    });
  });
});
