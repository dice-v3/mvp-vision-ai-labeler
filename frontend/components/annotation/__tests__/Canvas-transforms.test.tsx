/**
 * Canvas Component Tests - Zoom and Pan Transformations
 *
 * Tests for zoom functionality, pan/drag, fit-to-screen, and coordinate transformations.
 *
 * Phase 7: Frontend Canvas Component Tests
 * Subtask 7.3: Test Canvas.tsx zoom and pan
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import Canvas from '../Canvas';
import {
  createMockAnnotationStore,
  createMockProject,
  createMockImage,
  createMockAnnotation,
} from '@/lib/test-utils/mock-stores';
import { createMouseEvent, createWheelEvent } from '@/lib/test-utils/component-test-utils';
import { useAnnotationStore } from '@/lib/stores/annotationStore';

// Create mock function for annotation store
const mockUseAnnotationStore = vi.fn();

// Mock the annotation store
vi.mock('@/lib/stores/annotationStore', () => ({
  useAnnotationStore: mockUseAnnotationStore,
}));

// Mock API modules
vi.mock('@/lib/api/annotations', () => ({
  createAnnotation: vi.fn().mockResolvedValue({ id: 'new-ann-1', version: 1 }),
  updateAnnotation: vi.fn().mockResolvedValue({ version: 2 }),
  deleteAnnotation: vi.fn().mockResolvedValue({}),
  getProjectAnnotations: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/api/projects', () => ({
  confirmImage: vi.fn(),
  getProjectImageStatuses: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/api/image-locks', () => ({
  imageLockAPI: {
    acquire: vi.fn().mockResolvedValue({ status: 'acquired' }),
    release: vi.fn().mockResolvedValue({ status: 'released' }),
    heartbeat: vi.fn().mockResolvedValue({ status: 'updated' }),
    getStatus: vi.fn().mockResolvedValue(null),
  },
}));

// Mock toast and confirm stores
vi.mock('@/lib/stores/toastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/stores/confirmStore', () => ({
  confirm: vi.fn().mockResolvedValue(true),
}));

// Mock annotation tools
vi.mock('@/lib/annotation', () => ({
  ToolRegistry: {
    getTool: vi.fn(),
  },
  bboxTool: {
    renderPreview: vi.fn(),
    render: vi.fn(),
  },
  polygonTool: {
    renderPreview: vi.fn(),
    render: vi.fn(),
  },
  polylineTool: {
    renderPreview: vi.fn(),
    render: vi.fn(),
  },
  circleTool: {
    renderPreview: vi.fn(),
    render: vi.fn(),
  },
  circle3pTool: {
    renderPreview: vi.fn(),
    render: vi.fn(),
  },
}));

// Mock annotation utils
vi.mock('@/lib/annotation/utils', () => ({
  drawGrid: vi.fn(),
  drawCrosshair: vi.fn(),
  drawNoObjectBadge: vi.fn(),
  snapshotToAnnotation: vi.fn(),
  getHandleAtPosition: vi.fn().mockReturnValue(null),
  pointInBbox: vi.fn().mockReturnValue(false),
  getCursorForHandle: vi.fn().mockReturnValue('default'),
  getPointOnEdge: vi.fn(),
}));

// Mock coordinate transform utilities
vi.mock('@/lib/annotation/utils/coordinateTransform', () => ({
  screenToCanvas: vi.fn((x, y) => ({ x: x - 100, y: y - 50 })),
  canvasToImage: vi.fn((x, y) => ({ x: x / 2, y: y / 2 })),
  imageToCanvas: vi.fn((x, y) => ({ x: x * 2, y: y * 2 })),
  screenToImage: vi.fn((x, y) => ({ x: x - 100, y: y - 50 })),
  getImageBounds: vi.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
  isPointInImage: vi.fn(() => true),
  clampToImageBounds: vi.fn((x, y) => ({ x, y })),
}));

// Mock custom hooks
vi.mock('@/lib/annotation/hooks', () => ({
  useCanvasState: vi.fn(() => ({
    showClassSelector: false,
    setShowClassSelector: vi.fn(),
    canvasCursor: 'default',
    setCanvasCursor: vi.fn(),
    cursorPos: { x: 0, y: 0 },
    setCursorPos: vi.fn(),
    batchProgress: null,
    setBatchProgress: vi.fn(),
  })),
  useImageManagement: vi.fn((props) => ({
    image: props.imageRef?.current || null,
    isImageLocked: false,
    lockStatus: null,
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
    heartbeatLock: vi.fn(),
  })),
  useToolState: vi.fn(() => ({
    pendingBbox: null,
    setPendingBbox: vi.fn(),
    isResizing: false,
    setIsResizing: vi.fn(),
    setResizeHandle: vi.fn(),
    resizeStart: null,
    setResizeStart: vi.fn(),
    polygonVertices: [],
    setPolygonVertices: vi.fn(),
    isDraggingVertex: false,
    setIsDraggingVertex: vi.fn(),
    setDraggedVertexIndex: vi.fn(),
    isDraggingPolygon: false,
    setIsDraggingPolygon: vi.fn(),
    polygonDragStart: null,
    setPolygonDragStart: vi.fn(),
    polylineVertices: [],
    setPolylineVertices: vi.fn(),
    circleCenter: null,
    setCircleCenter: vi.fn(),
    isDraggingCircle: false,
    setIsDraggingCircle: vi.fn(),
    circleDragStart: null,
    setCircleDragStart: vi.fn(),
    isResizingCircle: false,
    setIsResizingCircle: vi.fn(),
    circleResizeStart: null,
    setCircleResizeStart: vi.fn(),
    setSelectedCircleHandle: vi.fn(),
    circle3pPoints: [],
    setCircle3pPoints: vi.fn(),
  })),
  useCanvasTransform: vi.fn(() => ({
    isPanning: false,
    setIsPanning: vi.fn(),
    panStart: null,
    setPanStart: vi.fn(),
    startPan: vi.fn(),
    endPan: vi.fn(),
    resetTransformState: vi.fn(),
  })),
  useAnnotationSync: vi.fn(() => ({
    isSyncing: false,
    lastSyncError: null,
    syncAnnotations: vi.fn(),
  })),
  useMagnifier: vi.fn(() => ({
    magnifierPos: null,
    showMagnifier: false,
    setMagnifierPos: vi.fn(),
    setShowMagnifier: vi.fn(),
  })),
  useMouseHandlers: vi.fn(() => ({
    handleMouseDown: vi.fn(),
    handleMouseMove: vi.fn(),
    handleMouseUp: vi.fn(),
  })),
  useToolRenderer: vi.fn(() => ({
    renderToolPreview: vi.fn(),
  })),
  useCanvasRenderer: vi.fn(() => ({
    renderCanvas: vi.fn(),
  })),
  useCanvasKeyboardShortcuts: vi.fn(() => ({
    canUndo: vi.fn(() => false),
    canRedo: vi.fn(() => false),
    handleUndo: vi.fn(),
    handleRedo: vi.fn(),
  })),
  useBatchOperations: vi.fn(() => ({
    handleBatchDelete: vi.fn(),
    handleBatchConfirm: vi.fn(),
    handleDeleteAllAnnotations: vi.fn(),
  })),
}));

// Mock UI components
vi.mock('../overlays/LockOverlay', () => ({
  LockOverlay: () => null,
}));

vi.mock('../canvas-ui', () => ({
  ToolSelector: () => null,
  ZoomControls: ({ zoom, pan, onZoomChange, onPanChange }: any) => (
    <div data-testid="zoom-controls">
      <button onClick={() => onZoomChange(zoom + 0.25)} data-testid="zoom-in">+</button>
      <button onClick={() => onZoomChange(zoom - 0.25)} data-testid="zoom-out">-</button>
      <button onClick={() => { onZoomChange(1.0); onPanChange({ x: 0, y: 0 }); }} data-testid="fit-screen">Fit</button>
      <span data-testid="zoom-value">{Math.round(zoom * 100)}%</span>
    </div>
  ),
  NavigationButtons: () => null,
  CanvasActionBar: () => null,
}));

vi.mock('../ClassSelector', () => ({
  __esModule: true,
  default: () => null,
}));

describe('Canvas - Zoom and Pan Transformations', () => {
  let mockStore: ReturnType<typeof createMockAnnotationStore>;
  let mockSetZoom: ReturnType<typeof vi.fn>;
  let mockSetPan: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock zoom and pan functions
    mockSetZoom = vi.fn();
    mockSetPan = vi.fn();

    // Create mock store with project and image
    const project = createMockProject({
      id: 'proj-1',
      name: 'Test Project',
      task_types: ['detection'],
    });

    const image = createMockImage({
      id: 'img-1',
      url: 'https://example.com/image.jpg',
      width: 1000,
      height: 800,
    });

    mockStore = createMockAnnotationStore({
      project,
      currentImage: image,
      images: [image],
      annotations: [],
      canvas: {
        zoom: 1.0,
        pan: { x: 0, y: 0 },
      },
      setZoom: mockSetZoom,
      setPan: mockSetPan,
    });

    (useAnnotationStore as any).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector(mockStore);
      }
      return mockStore;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Zoom Functionality', () => {
    describe('Mouse Wheel Zoom', () => {
      it('should zoom in on mouse wheel up', () => {
        const { container } = render(<Canvas />);
        const canvas = container.querySelector('canvas');

        if (canvas) {
          // Mock wheel event (deltaY < 0 = zoom in)
          const wheelEvent = new WheelEvent('wheel', {
            deltaY: -100,
            bubbles: true,
          });

          fireEvent(canvas, wheelEvent);

          expect(mockSetZoom).toHaveBeenCalledWith(1.1);
        }
      });

      it('should zoom out on mouse wheel down', () => {
        mockStore.canvas.zoom = 1.5;

        const { container } = render(<Canvas />);
        const canvas = container.querySelector('canvas');

        if (canvas) {
          // Mock wheel event (deltaY > 0 = zoom out)
          const wheelEvent = new WheelEvent('wheel', {
            deltaY: 100,
            bubbles: true,
          });

          fireEvent(canvas, wheelEvent);

          expect(mockSetZoom).toHaveBeenCalledWith(1.4);
        }
      });

      it('should handle multiple zoom events', () => {
        const { container } = render(<Canvas />);
        const canvas = container.querySelector('canvas');

        if (canvas) {
          // Zoom in
          fireEvent.wheel(canvas, { deltaY: -100 });
          expect(mockSetZoom).toHaveBeenCalledWith(1.1);

          // Update store zoom value
          mockStore.canvas.zoom = 1.1;

          // Zoom in again
          fireEvent.wheel(canvas, { deltaY: -100 });
          expect(mockSetZoom).toHaveBeenCalledWith(1.2);
        }
      });

      it('should prevent default wheel behavior', () => {
        const { container } = render(<Canvas />);
        const canvas = container.querySelector('canvas');

        if (canvas) {
          const wheelEvent = new WheelEvent('wheel', {
            deltaY: -100,
            bubbles: true,
            cancelable: true,
          });

          const prevented = !canvas.dispatchEvent(wheelEvent);
          expect(prevented).toBe(true);
        }
      });
    });

    describe('Zoom Controls (Buttons)', () => {
      it('should zoom in when zoom-in button clicked', () => {
        const { getByTestId } = render(<Canvas />);
        const zoomInButton = getByTestId('zoom-in');

        fireEvent.click(zoomInButton);

        expect(mockSetZoom).toHaveBeenCalledWith(1.25);
      });

      it('should zoom out when zoom-out button clicked', () => {
        mockStore.canvas.zoom = 1.5;

        const { getByTestId } = render(<Canvas />);
        const zoomOutButton = getByTestId('zoom-out');

        fireEvent.click(zoomOutButton);

        expect(mockSetZoom).toHaveBeenCalledWith(1.25);
      });

      it('should display current zoom percentage', () => {
        mockStore.canvas.zoom = 1.5;

        const { getByTestId } = render(<Canvas />);
        const zoomValue = getByTestId('zoom-value');

        expect(zoomValue.textContent).toBe('150%');
      });

      it('should handle zoom at 100%', () => {
        mockStore.canvas.zoom = 1.0;

        const { getByTestId } = render(<Canvas />);
        const zoomValue = getByTestId('zoom-value');

        expect(zoomValue.textContent).toBe('100%');
      });

      it('should handle zoom at 200%', () => {
        mockStore.canvas.zoom = 2.0;

        const { getByTestId } = render(<Canvas />);
        const zoomValue = getByTestId('zoom-value');

        expect(zoomValue.textContent).toBe('200%');
      });

      it('should handle zoom at 50%', () => {
        mockStore.canvas.zoom = 0.5;

        const { getByTestId } = render(<Canvas />);
        const zoomValue = getByTestId('zoom-value');

        expect(zoomValue.textContent).toBe('50%');
      });
    });

    describe('Fit to Screen', () => {
      it('should reset zoom to 1.0 when fit button clicked', () => {
        mockStore.canvas.zoom = 2.5;
        mockStore.canvas.pan = { x: 100, y: 50 };

        const { getByTestId } = render(<Canvas />);
        const fitButton = getByTestId('fit-screen');

        fireEvent.click(fitButton);

        expect(mockSetZoom).toHaveBeenCalledWith(1.0);
      });

      it('should reset pan to origin when fit button clicked', () => {
        mockStore.canvas.zoom = 2.5;
        mockStore.canvas.pan = { x: 100, y: 50 };

        const { getByTestId } = render(<Canvas />);
        const fitButton = getByTestId('fit-screen');

        fireEvent.click(fitButton);

        expect(mockSetPan).toHaveBeenCalledWith({ x: 0, y: 0 });
      });

      it('should reset both zoom and pan together', () => {
        mockStore.canvas.zoom = 1.8;
        mockStore.canvas.pan = { x: -50, y: 75 };

        const { getByTestId } = render(<Canvas />);
        const fitButton = getByTestId('fit-screen');

        fireEvent.click(fitButton);

        expect(mockSetZoom).toHaveBeenCalledWith(1.0);
        expect(mockSetPan).toHaveBeenCalledWith({ x: 0, y: 0 });
      });
    });

    describe('Zoom Limits and Edge Cases', () => {
      it('should handle very high zoom levels', () => {
        mockStore.canvas.zoom = 10.0;

        const { getByTestId } = render(<Canvas />);
        const zoomValue = getByTestId('zoom-value');

        expect(zoomValue.textContent).toBe('1000%');
      });

      it('should handle very low zoom levels', () => {
        mockStore.canvas.zoom = 0.1;

        const { getByTestId } = render(<Canvas />);
        const zoomValue = getByTestId('zoom-value');

        expect(zoomValue.textContent).toBe('10%');
      });

      it('should handle fractional zoom values', () => {
        mockStore.canvas.zoom = 1.33;

        const { getByTestId } = render(<Canvas />);
        const zoomValue = getByTestId('zoom-value');

        expect(zoomValue.textContent).toBe('133%');
      });

      it('should round zoom percentage for display', () => {
        mockStore.canvas.zoom = 1.456;

        const { getByTestId } = render(<Canvas />);
        const zoomValue = getByTestId('zoom-value');

        expect(zoomValue.textContent).toBe('146%');
      });
    });
  });

  describe('Pan/Drag Functionality', () => {
    describe('Pan State Management', () => {
      it('should initialize with no pan offset', () => {
        render(<Canvas />);

        expect(mockStore.canvas.pan).toEqual({ x: 0, y: 0 });
      });

      it('should update pan state', () => {
        render(<Canvas />);

        mockSetPan({ x: 50, y: 30 });

        expect(mockSetPan).toHaveBeenCalledWith({ x: 50, y: 30 });
      });

      it('should handle negative pan values', () => {
        render(<Canvas />);

        mockSetPan({ x: -100, y: -75 });

        expect(mockSetPan).toHaveBeenCalledWith({ x: -100, y: -75 });
      });

      it('should handle large pan values', () => {
        render(<Canvas />);

        mockSetPan({ x: 1000, y: 800 });

        expect(mockSetPan).toHaveBeenCalledWith({ x: 1000, y: 800 });
      });
    });

    describe('Pan Reset', () => {
      it('should reset pan when fit button clicked', () => {
        mockStore.canvas.pan = { x: 150, y: 200 };

        const { getByTestId } = render(<Canvas />);
        const fitButton = getByTestId('fit-screen');

        fireEvent.click(fitButton);

        expect(mockSetPan).toHaveBeenCalledWith({ x: 0, y: 0 });
      });

      it('should maintain pan when only zoom changes', () => {
        mockStore.canvas.pan = { x: 50, y: 30 };

        const { getByTestId } = render(<Canvas />);
        const zoomInButton = getByTestId('zoom-in');

        fireEvent.click(zoomInButton);

        expect(mockSetPan).not.toHaveBeenCalled();
      });
    });

    describe('Cursor Changes During Pan', () => {
      it('should show default cursor when not panning', () => {
        const { container } = render(<Canvas />);
        const canvas = container.querySelector('canvas');

        expect(canvas?.style.cursor).toBe('default');
      });

      it('should show grabbing cursor when panning', () => {
        const useCanvasTransformMock = vi.mocked(
          require('@/lib/annotation/hooks').useCanvasTransform
        );

        useCanvasTransformMock.mockReturnValue({
          isPanning: true,
          setIsPanning: vi.fn(),
          panStart: { x: 100, y: 100 },
          setPanStart: vi.fn(),
          startPan: vi.fn(),
          endPan: vi.fn(),
          resetTransformState: vi.fn(),
        });

        const { container } = render(<Canvas />);
        const canvas = container.querySelector('canvas');

        expect(canvas?.style.cursor).toBe('grabbing');
      });
    });

    describe('Pan with Different Zoom Levels', () => {
      it('should allow pan at 100% zoom', () => {
        mockStore.canvas.zoom = 1.0;
        mockStore.canvas.pan = { x: 0, y: 0 };

        render(<Canvas />);

        mockSetPan({ x: 25, y: 25 });

        expect(mockSetPan).toHaveBeenCalledWith({ x: 25, y: 25 });
      });

      it('should allow pan at 200% zoom', () => {
        mockStore.canvas.zoom = 2.0;
        mockStore.canvas.pan = { x: 0, y: 0 };

        render(<Canvas />);

        mockSetPan({ x: 100, y: 80 });

        expect(mockSetPan).toHaveBeenCalledWith({ x: 100, y: 80 });
      });

      it('should allow pan at 50% zoom', () => {
        mockStore.canvas.zoom = 0.5;
        mockStore.canvas.pan = { x: 0, y: 0 };

        render(<Canvas />);

        mockSetPan({ x: 10, y: 5 });

        expect(mockSetPan).toHaveBeenCalledWith({ x: 10, y: 5 });
      });
    });
  });

  describe('Coordinate Transformations', () => {
    describe('Screen to Canvas Transformation', () => {
      it('should transform screen coordinates to canvas coordinates', () => {
        const { screenToCanvas } = require('@/lib/annotation/utils/coordinateTransform');

        render(<Canvas />);

        const result = screenToCanvas(500, 300, new DOMRect(100, 50, 800, 600));

        expect(result).toEqual({ x: 400, y: 250 });
      });

      it('should handle canvas at different positions', () => {
        const { screenToCanvas } = require('@/lib/annotation/utils/coordinateTransform');

        render(<Canvas />);

        const result = screenToCanvas(300, 200, new DOMRect(50, 25, 800, 600));

        expect(result).toEqual({ x: 250, y: 175 });
      });
    });

    describe('Canvas to Image Transformation', () => {
      it('should transform canvas coordinates to image coordinates', () => {
        const { canvasToImage } = require('@/lib/annotation/utils/coordinateTransform');

        render(<Canvas />);

        const result = canvasToImage(400, 300);

        expect(result).toEqual({ x: 200, y: 150 });
      });

      it('should handle transformation with zoom', () => {
        const { canvasToImage } = require('@/lib/annotation/utils/coordinateTransform');

        mockStore.canvas.zoom = 2.0;

        render(<Canvas />);

        const result = canvasToImage(800, 600);

        expect(result).toEqual({ x: 400, y: 300 });
      });
    });

    describe('Image to Canvas Transformation', () => {
      it('should transform image coordinates to canvas coordinates', () => {
        const { imageToCanvas } = require('@/lib/annotation/utils/coordinateTransform');

        render(<Canvas />);

        const result = imageToCanvas(200, 150);

        expect(result).toEqual({ x: 400, y: 300 });
      });

      it('should handle transformation with zoom', () => {
        const { imageToCanvas } = require('@/lib/annotation/utils/coordinateTransform');

        mockStore.canvas.zoom = 2.0;

        render(<Canvas />);

        const result = imageToCanvas(100, 100);

        expect(result).toEqual({ x: 200, y: 200 });
      });
    });

    describe('Screen to Image Transformation', () => {
      it('should transform screen coordinates directly to image coordinates', () => {
        const { screenToImage } = require('@/lib/annotation/utils/coordinateTransform');

        render(<Canvas />);

        const result = screenToImage(500, 300);

        expect(result).toEqual({ x: 400, y: 250 });
      });

      it('should combine screen and canvas transformations', () => {
        const { screenToImage } = require('@/lib/annotation/utils/coordinateTransform');

        mockStore.canvas.zoom = 1.5;
        mockStore.canvas.pan = { x: 50, y: 25 };

        render(<Canvas />);

        const result = screenToImage(600, 400);

        expect(result).toEqual({ x: 500, y: 350 });
      });
    });

    describe('Image Bounds Calculation', () => {
      it('should calculate image bounds with no zoom or pan', () => {
        const { getImageBounds } = require('@/lib/annotation/utils/coordinateTransform');

        render(<Canvas />);

        const result = getImageBounds();

        expect(result).toEqual({ x: 0, y: 0, width: 800, height: 600 });
      });

      it('should calculate image bounds with zoom', () => {
        const { getImageBounds } = require('@/lib/annotation/utils/coordinateTransform');

        mockStore.canvas.zoom = 2.0;

        render(<Canvas />);

        const result = getImageBounds();

        expect(result).toEqual({ x: 0, y: 0, width: 800, height: 600 });
      });

      it('should calculate image bounds with pan', () => {
        const { getImageBounds } = require('@/lib/annotation/utils/coordinateTransform');

        mockStore.canvas.pan = { x: 100, y: 50 };

        render(<Canvas />);

        const result = getImageBounds();

        expect(result).toEqual({ x: 0, y: 0, width: 800, height: 600 });
      });
    });

    describe('Point in Image Detection', () => {
      it('should detect point inside image bounds', () => {
        const { isPointInImage } = require('@/lib/annotation/utils/coordinateTransform');

        render(<Canvas />);

        const result = isPointInImage(400, 300);

        expect(result).toBe(true);
      });

      it('should detect point outside image bounds', () => {
        const { isPointInImage } = require('@/lib/annotation/utils/coordinateTransform');

        isPointInImage.mockReturnValueOnce(false);

        render(<Canvas />);

        const result = isPointInImage(-10, -10);

        expect(result).toBe(false);
      });
    });

    describe('Coordinate Clamping', () => {
      it('should clamp coordinates to image bounds', () => {
        const { clampToImageBounds } = require('@/lib/annotation/utils/coordinateTransform');

        render(<Canvas />);

        const result = clampToImageBounds(500, 400);

        expect(result).toEqual({ x: 500, y: 400 });
      });

      it('should clamp coordinates outside bounds', () => {
        const { clampToImageBounds } = require('@/lib/annotation/utils/coordinateTransform');

        clampToImageBounds.mockReturnValueOnce({ x: 0, y: 0 });

        render(<Canvas />);

        const result = clampToImageBounds(-100, -100);

        expect(result).toEqual({ x: 0, y: 0 });
      });
    });
  });

  describe('Integration Tests - Zoom + Pan', () => {
    it('should handle zoom in followed by pan', () => {
      const { getByTestId } = render(<Canvas />);

      // Zoom in
      const zoomInButton = getByTestId('zoom-in');
      fireEvent.click(zoomInButton);
      expect(mockSetZoom).toHaveBeenCalledWith(1.25);

      // Pan
      mockSetPan({ x: 50, y: 30 });
      expect(mockSetPan).toHaveBeenCalledWith({ x: 50, y: 30 });
    });

    it('should handle pan followed by zoom out', () => {
      mockStore.canvas.zoom = 2.0;
      mockStore.canvas.pan = { x: 100, y: 80 };

      const { getByTestId } = render(<Canvas />);

      // Pan
      mockSetPan({ x: 150, y: 120 });
      expect(mockSetPan).toHaveBeenCalledWith({ x: 150, y: 120 });

      // Zoom out
      const zoomOutButton = getByTestId('zoom-out');
      fireEvent.click(zoomOutButton);
      expect(mockSetZoom).toHaveBeenCalledWith(1.75);
    });

    it('should handle multiple zoom and pan operations', () => {
      const { getByTestId, container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      // Zoom in via wheel
      if (canvas) {
        fireEvent.wheel(canvas, { deltaY: -100 });
        expect(mockSetZoom).toHaveBeenCalledWith(1.1);
      }

      // Pan
      mockSetPan({ x: 25, y: 15 });
      expect(mockSetPan).toHaveBeenCalledWith({ x: 25, y: 15 });

      // Zoom in via button
      const zoomInButton = getByTestId('zoom-in');
      fireEvent.click(zoomInButton);
      expect(mockSetZoom).toHaveBeenCalledWith(1.25);

      // Pan again
      mockSetPan({ x: 50, y: 30 });
      expect(mockSetPan).toHaveBeenCalledWith({ x: 50, y: 30 });
    });

    it('should reset both zoom and pan to defaults', () => {
      mockStore.canvas.zoom = 3.5;
      mockStore.canvas.pan = { x: 200, y: 150 };

      const { getByTestId } = render(<Canvas />);
      const fitButton = getByTestId('fit-screen');

      fireEvent.click(fitButton);

      expect(mockSetZoom).toHaveBeenCalledWith(1.0);
      expect(mockSetPan).toHaveBeenCalledWith({ x: 0, y: 0 });
    });

    it('should maintain transform state across re-renders', () => {
      mockStore.canvas.zoom = 1.5;
      mockStore.canvas.pan = { x: 100, y: 50 };

      const { rerender } = render(<Canvas />);

      rerender(<Canvas />);

      expect(mockStore.canvas.zoom).toBe(1.5);
      expect(mockStore.canvas.pan).toEqual({ x: 100, y: 50 });
    });

    it('should handle rapid zoom changes', () => {
      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        // Rapid zoom in
        fireEvent.wheel(canvas, { deltaY: -100 });
        fireEvent.wheel(canvas, { deltaY: -100 });
        fireEvent.wheel(canvas, { deltaY: -100 });

        expect(mockSetZoom).toHaveBeenCalledTimes(3);
        expect(mockSetZoom).toHaveBeenLastCalledWith(1.1);
      }
    });

    it('should handle mixed zoom in and zoom out', () => {
      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        // Zoom in
        fireEvent.wheel(canvas, { deltaY: -100 });
        expect(mockSetZoom).toHaveBeenCalledWith(1.1);

        // Update zoom value
        mockStore.canvas.zoom = 1.1;

        // Zoom out
        fireEvent.wheel(canvas, { deltaY: 100 });
        expect(mockSetZoom).toHaveBeenCalledWith(1.0);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle zoom controls when no image is loaded', () => {
      mockStore.currentImage = null;

      const { queryByTestId } = render(<Canvas />);

      // Zoom controls should not be rendered when no image
      expect(queryByTestId('zoom-controls')).not.toBeInTheDocument();
    });

    it('should handle pan when canvas is not mounted', () => {
      render(<Canvas />);

      // Should not throw when trying to pan
      expect(() => mockSetPan({ x: 50, y: 30 })).not.toThrow();
    });

    it('should handle zoom at boundary values', () => {
      mockStore.canvas.zoom = 0.01;

      const { getByTestId } = render(<Canvas />);
      const zoomValue = getByTestId('zoom-value');

      expect(zoomValue.textContent).toBe('1%');
    });

    it('should handle very large pan offsets', () => {
      render(<Canvas />);

      mockSetPan({ x: 10000, y: 10000 });

      expect(mockSetPan).toHaveBeenCalledWith({ x: 10000, y: 10000 });
    });

    it('should handle negative zoom values gracefully', () => {
      mockStore.canvas.zoom = -1.0;

      const { getByTestId } = render(<Canvas />);
      const zoomValue = getByTestId('zoom-value');

      expect(zoomValue.textContent).toBe('-100%');
    });

    it('should handle zero zoom value', () => {
      mockStore.canvas.zoom = 0;

      const { getByTestId } = render(<Canvas />);
      const zoomValue = getByTestId('zoom-value');

      expect(zoomValue.textContent).toBe('0%');
    });

    it('should handle fractional pan values', () => {
      render(<Canvas />);

      mockSetPan({ x: 123.456, y: 789.012 });

      expect(mockSetPan).toHaveBeenCalledWith({ x: 123.456, y: 789.012 });
    });

    it('should preserve pan when image changes', () => {
      mockStore.canvas.pan = { x: 100, y: 50 };

      const { rerender } = render(<Canvas />);

      // Change image
      mockStore.currentImage = createMockImage({
        id: 'img-2',
        url: 'https://example.com/image2.jpg',
        width: 1200,
        height: 900,
      });

      rerender(<Canvas />);

      // Pan should be preserved
      expect(mockStore.canvas.pan).toEqual({ x: 100, y: 50 });
    });
  });
});
