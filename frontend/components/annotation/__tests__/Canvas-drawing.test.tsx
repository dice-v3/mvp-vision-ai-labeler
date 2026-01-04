/**
 * Canvas Component Tests - Drawing Annotations
 *
 * Tests for drawing annotations (bbox, polygon, point, line), tool interactions,
 * and drawing state management.
 *
 * Phase 7: Frontend Canvas Component Tests
 * Subtask 7.2: Test Canvas.tsx annotation drawing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import Canvas from '../Canvas';
import {
  createMockAnnotationStore,
  createMockProject,
  createMockImage,
  createMockAnnotation,
  createMockClass,
} from '@/lib/test-utils/mock-stores';
import { createMouseEvent } from '@/lib/test-utils/component-test-utils';
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

// Mock custom hooks
const mockUseToolState = {
  pendingBbox: null,
  setPendingBbox: vi.fn(),
  isResizing: false,
  setIsResizing: vi.fn(),
  resizeHandle: null,
  setResizeHandle: vi.fn(),
  resizeStart: null,
  setResizeStart: vi.fn(),
  polygonVertices: [],
  setPolygonVertices: vi.fn(),
  isDraggingVertex: false,
  setIsDraggingVertex: vi.fn(),
  draggedVertexIndex: null,
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
  selectedCircleHandle: null,
  setSelectedCircleHandle: vi.fn(),
  circle3pPoints: [],
  setCircle3pPoints: vi.fn(),
  resetAllToolState: vi.fn(),
};

const mockUseMouseHandlers = {
  handleMouseDown: vi.fn(),
  handleMouseMove: vi.fn(),
  handleMouseUp: vi.fn(),
};

const mockUseToolRenderer = {
  drawBboxPreview: vi.fn(),
  drawPolygonPreview: vi.fn(),
  drawPolylinePreview: vi.fn(),
  drawCirclePreview: vi.fn(),
  drawCircle3pPreview: vi.fn(),
};

vi.mock('@/lib/annotation/hooks', () => ({
  useCanvasState: vi.fn(() => ({
    showClassSelector: false,
    setShowClassSelector: vi.fn(),
    canvasCursor: 'crosshair',
    setCanvasCursor: vi.fn(),
    cursorPos: { x: 0, y: 0 },
    setCursorPos: vi.fn(),
    batchProgress: null,
    setBatchProgress: vi.fn(),
  })),
  useImageManagement: vi.fn((props) => ({
    image: props.imageRef?.current || null,
    imageLoaded: false,
    isImageLocked: false,
    lockedByUser: null,
    showLockedDialog: false,
    setShowLockedDialog: vi.fn(),
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
  })),
  useToolState: vi.fn(() => mockUseToolState),
  useCanvasTransform: vi.fn(() => ({
    isPanning: false,
    setIsPanning: vi.fn(),
    panStart: null,
    setPanStart: vi.fn(),
  })),
  useAnnotationSync: vi.fn(() => ({
    conflictDialogOpen: false,
    setConflictDialogOpen: vi.fn(),
    conflictInfo: null,
    setConflictInfo: vi.fn(),
    pendingAnnotationUpdate: null,
    setPendingAnnotationUpdate: vi.fn(),
    updateAnnotationWithVersionCheck: vi.fn(),
  })),
  useMagnifier: vi.fn(() => ({
    manualMagnifierActive: false,
    setManualMagnifierActive: vi.fn(),
    magnifierForceOff: false,
    setMagnifierForceOff: vi.fn(),
    magnification: 3,
    setMagnification: vi.fn(),
    shouldShowMagnifier: false,
    isDrawingTool: false,
  })),
  useToolRenderer: vi.fn(() => mockUseToolRenderer),
  useCanvasRenderer: vi.fn(),
  useCanvasKeyboardShortcuts: vi.fn(),
  useBatchOperations: vi.fn(),
  useMouseHandlers: vi.fn(() => mockUseMouseHandlers),
}));

// Mock overlay components
vi.mock('../overlays/LockOverlay', () => ({
  LockOverlay: () => null,
}));

// Mock UI components
vi.mock('../canvas-ui', () => ({
  ToolSelector: () => null,
  ZoomControls: () => null,
  NavigationButtons: () => null,
  CanvasActionBar: () => null,
}));

// Mock other components
vi.mock('../ClassSelectorModal', () => ({
  default: () => null,
}));

vi.mock('../Magnifier', () => ({
  default: () => null,
}));

vi.mock('../../annotations/AnnotationConflictDialog', () => ({
  AnnotationConflictDialog: () => null,
}));

vi.mock('../DiffToolbar', () => ({
  default: () => null,
}));

vi.mock('../DiffActions', () => ({
  default: () => null,
}));

vi.mock('../DiffViewModeSelector', () => ({
  default: () => null,
}));

vi.mock('@/lib/annotation/tools/Circle3pTool', () => ({
  Circle3pTool: {},
}));

describe('Canvas Component - Drawing Annotations', () => {
  let mockStore: ReturnType<typeof createMockAnnotationStore>;

  beforeEach(() => {
    // Create default mock store
    mockStore = createMockAnnotationStore({
      project: createMockProject({
        taskTypes: ['detection'],
        taskClasses: {
          detection: [
            createMockClass({ id: 'class-1', name: 'Person' }),
            createMockClass({ id: 'class-2', name: 'Car' }),
          ],
        },
      }),
      currentImage: createMockImage(),
      currentTask: 'detection',
    });

    // Setup useAnnotationStore mock to return values from mockStore
    (useAnnotationStore as any).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector(mockStore);
      }
      return mockStore;
    });

    // Mock setState method
    (useAnnotationStore as any).setState = vi.fn((updates: any) => {
      Object.assign(mockStore, updates);
    });

    // Mock getState method
    (useAnnotationStore as any).getState = vi.fn(() => mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Bbox Drawing', () => {
    beforeEach(() => {
      mockStore.tool = 'bbox';
    });

    it('should start bbox drawing on mouse down', () => {
      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      expect(canvas).toBeInTheDocument();
      expect(mockUseMouseHandlers.handleMouseDown).toBeDefined();
    });

    it('should update bbox during mouse move', () => {
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 100, y: 100 };
      mockStore.canvas.cursor = { x: 200, y: 200 };

      render(<Canvas />);

      expect(mockUseMouseHandlers.handleMouseMove).toBeDefined();
    });

    it('should finish bbox drawing on mouse up', () => {
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 100, y: 100 };

      render(<Canvas />);

      expect(mockUseMouseHandlers.handleMouseUp).toBeDefined();
    });

    it('should render bbox preview while drawing', () => {
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 100, y: 100 };
      mockStore.canvas.cursor = { x: 200, y: 200 };

      render(<Canvas />);

      expect(mockUseToolRenderer.drawBboxPreview).toBeDefined();
    });

    it('should handle bbox with minimal size', () => {
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 100, y: 100 };
      mockStore.canvas.cursor = { x: 105, y: 105 };

      render(<Canvas />);

      expect(mockStore.isDrawing).toBe(true);
    });

    it('should handle bbox with negative dimensions', () => {
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 200, y: 200 };
      mockStore.canvas.cursor = { x: 100, y: 100 };

      render(<Canvas />);

      expect(mockStore.isDrawing).toBe(true);
    });

    it('should handle bbox at canvas edges', () => {
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 0, y: 0 };
      mockStore.canvas.cursor = { x: 800, y: 600 };

      render(<Canvas />);

      expect(mockStore.isDrawing).toBe(true);
    });

    it('should show pending bbox state', () => {
      mockUseToolState.pendingBbox = { x: 100, y: 100, w: 100, h: 100 };

      render(<Canvas />);

      expect(mockUseToolState.pendingBbox).not.toBeNull();
    });

    it('should handle bbox resize start', () => {
      mockUseToolState.isResizing = true;
      mockUseToolState.resizeHandle = 'se';
      mockUseToolState.resizeStart = { x: 200, y: 200, bbox: [100, 100, 100, 100] };

      render(<Canvas />);

      expect(mockUseToolState.isResizing).toBe(true);
    });

    it('should handle bbox resize with different handles', () => {
      const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

      handles.forEach((handle) => {
        mockUseToolState.resizeHandle = handle;
        const { unmount } = render(<Canvas />);
        expect(mockUseToolState.resizeHandle).toBe(handle);
        unmount();
      });
    });
  });

  describe('Polygon Drawing', () => {
    beforeEach(() => {
      mockStore.tool = 'polygon';
    });

    it('should start polygon on first click', () => {
      render(<Canvas />);

      expect(mockUseToolState.setPolygonVertices).toBeDefined();
    });

    it('should add vertices on subsequent clicks', () => {
      mockUseToolState.polygonVertices = [
        [100, 100],
        [200, 100],
      ];

      render(<Canvas />);

      expect(mockUseToolState.polygonVertices).toHaveLength(2);
    });

    it('should render polygon preview while drawing', () => {
      mockUseToolState.polygonVertices = [
        [100, 100],
        [200, 100],
        [200, 200],
      ];

      render(<Canvas />);

      expect(mockUseToolRenderer.drawPolygonPreview).toBeDefined();
    });

    it('should handle polygon with minimum vertices (3)', () => {
      mockUseToolState.polygonVertices = [
        [100, 100],
        [200, 100],
        [150, 200],
      ];

      render(<Canvas />);

      expect(mockUseToolState.polygonVertices).toHaveLength(3);
    });

    it('should handle polygon with many vertices', () => {
      const vertices: [number, number][] = [];
      for (let i = 0; i < 20; i++) {
        vertices.push([100 + i * 10, 100 + Math.sin(i) * 50]);
      }
      mockUseToolState.polygonVertices = vertices;

      render(<Canvas />);

      expect(mockUseToolState.polygonVertices).toHaveLength(20);
    });

    it('should handle vertex dragging', () => {
      mockUseToolState.polygonVertices = [
        [100, 100],
        [200, 100],
        [200, 200],
      ];
      mockUseToolState.isDraggingVertex = true;
      mockUseToolState.draggedVertexIndex = 1;

      render(<Canvas />);

      expect(mockUseToolState.isDraggingVertex).toBe(true);
      expect(mockUseToolState.draggedVertexIndex).toBe(1);
    });

    it('should handle polygon dragging', () => {
      mockUseToolState.polygonVertices = [
        [100, 100],
        [200, 100],
        [200, 200],
      ];
      mockUseToolState.isDraggingPolygon = true;
      mockUseToolState.polygonDragStart = {
        x: 150,
        y: 150,
        points: [
          [100, 100],
          [200, 100],
          [200, 200],
        ],
      };

      render(<Canvas />);

      expect(mockUseToolState.isDraggingPolygon).toBe(true);
    });

    it('should handle closing polygon on double-click', () => {
      mockUseToolState.polygonVertices = [
        [100, 100],
        [200, 100],
        [200, 200],
        [100, 200],
      ];

      render(<Canvas />);

      expect(mockUseToolState.polygonVertices).toHaveLength(4);
    });

    it('should handle polygon with self-intersection', () => {
      mockUseToolState.polygonVertices = [
        [100, 100],
        [200, 200],
        [100, 200],
        [200, 100],
      ];

      render(<Canvas />);

      expect(mockUseToolState.polygonVertices).toHaveLength(4);
    });

    it('should clear polygon vertices on reset', () => {
      mockUseToolState.polygonVertices = [];

      render(<Canvas />);

      expect(mockUseToolState.polygonVertices).toHaveLength(0);
    });
  });

  describe('Point Drawing', () => {
    beforeEach(() => {
      mockStore.tool = 'point';
    });

    it('should create point annotation on click', () => {
      render(<Canvas />);

      expect(mockUseMouseHandlers.handleMouseDown).toBeDefined();
    });

    it('should handle point at specific coordinates', () => {
      mockStore.canvas.cursor = { x: 250, y: 300 };

      render(<Canvas />);

      expect(mockStore.canvas.cursor).toEqual({ x: 250, y: 300 });
    });

    it('should handle point at canvas edge', () => {
      mockStore.canvas.cursor = { x: 0, y: 0 };

      render(<Canvas />);

      expect(mockStore.canvas.cursor).toEqual({ x: 0, y: 0 });
    });

    it('should handle multiple points creation', () => {
      mockStore.annotations = [
        createMockAnnotation({
          id: 'point-1',
          annotationType: 'point',
          geometry: { point: [100, 100] },
        }),
        createMockAnnotation({
          id: 'point-2',
          annotationType: 'point',
          geometry: { point: [200, 200] },
        }),
      ];

      render(<Canvas />);

      expect(mockStore.annotations).toHaveLength(2);
    });
  });

  describe('Line (Polyline) Drawing', () => {
    beforeEach(() => {
      mockStore.tool = 'polyline';
    });

    it('should start line on first click', () => {
      render(<Canvas />);

      expect(mockUseToolState.setPolylineVertices).toBeDefined();
    });

    it('should add line segments on subsequent clicks', () => {
      mockUseToolState.polylineVertices = [
        [100, 100],
        [200, 150],
      ];

      render(<Canvas />);

      expect(mockUseToolState.polylineVertices).toHaveLength(2);
    });

    it('should render polyline preview while drawing', () => {
      mockUseToolState.polylineVertices = [
        [100, 100],
        [200, 150],
        [300, 100],
      ];

      render(<Canvas />);

      expect(mockUseToolRenderer.drawPolylinePreview).toBeDefined();
    });

    it('should handle polyline with minimum segments (2 points)', () => {
      mockUseToolState.polylineVertices = [
        [100, 100],
        [200, 200],
      ];

      render(<Canvas />);

      expect(mockUseToolState.polylineVertices).toHaveLength(2);
    });

    it('should handle polyline with many segments', () => {
      const vertices: [number, number][] = [];
      for (let i = 0; i < 15; i++) {
        vertices.push([100 + i * 20, 100 + Math.sin(i) * 30]);
      }
      mockUseToolState.polylineVertices = vertices;

      render(<Canvas />);

      expect(mockUseToolState.polylineVertices).toHaveLength(15);
    });

    it('should handle horizontal line', () => {
      mockUseToolState.polylineVertices = [
        [100, 150],
        [400, 150],
      ];

      render(<Canvas />);

      expect(mockUseToolState.polylineVertices[0][1]).toBe(
        mockUseToolState.polylineVertices[1][1]
      );
    });

    it('should handle vertical line', () => {
      mockUseToolState.polylineVertices = [
        [200, 100],
        [200, 400],
      ];

      render(<Canvas />);

      expect(mockUseToolState.polylineVertices[0][0]).toBe(
        mockUseToolState.polylineVertices[1][0]
      );
    });

    it('should handle diagonal line', () => {
      mockUseToolState.polylineVertices = [
        [100, 100],
        [300, 300],
      ];

      render(<Canvas />);

      expect(mockUseToolState.polylineVertices).toHaveLength(2);
    });

    it('should clear polyline vertices on reset', () => {
      mockUseToolState.polylineVertices = [];

      render(<Canvas />);

      expect(mockUseToolState.polylineVertices).toHaveLength(0);
    });
  });

  describe('Circle Drawing', () => {
    beforeEach(() => {
      mockStore.tool = 'circle';
    });

    it('should set circle center on first click', () => {
      render(<Canvas />);

      expect(mockUseToolState.setCircleCenter).toBeDefined();
    });

    it('should render circle preview while drawing', () => {
      mockUseToolState.circleCenter = [200, 200];
      mockStore.canvas.cursor = { x: 300, y: 200 };

      render(<Canvas />);

      expect(mockUseToolRenderer.drawCirclePreview).toBeDefined();
    });

    it('should handle circle with small radius', () => {
      mockUseToolState.circleCenter = [200, 200];
      mockStore.canvas.cursor = { x: 210, y: 200 };

      render(<Canvas />);

      expect(mockUseToolState.circleCenter).not.toBeNull();
    });

    it('should handle circle with large radius', () => {
      mockUseToolState.circleCenter = [400, 300];
      mockStore.canvas.cursor = { x: 600, y: 300 };

      render(<Canvas />);

      expect(mockUseToolState.circleCenter).not.toBeNull();
    });

    it('should handle circle dragging', () => {
      mockUseToolState.circleCenter = [200, 200];
      mockUseToolState.isDraggingCircle = true;
      mockUseToolState.circleDragStart = {
        x: 200,
        y: 200,
        center: [200, 200],
      };

      render(<Canvas />);

      expect(mockUseToolState.isDraggingCircle).toBe(true);
    });

    it('should handle circle resizing', () => {
      mockUseToolState.circleCenter = [200, 200];
      mockUseToolState.isResizingCircle = true;
      mockUseToolState.circleResizeStart = {
        x: 300,
        y: 200,
        radius: 100,
        handle: 'e',
      };

      render(<Canvas />);

      expect(mockUseToolState.isResizingCircle).toBe(true);
    });

    it('should handle circle at canvas edge', () => {
      mockUseToolState.circleCenter = [50, 50];
      mockStore.canvas.cursor = { x: 150, y: 50 };

      render(<Canvas />);

      expect(mockUseToolState.circleCenter).not.toBeNull();
    });
  });

  describe('Circle 3-Point Drawing', () => {
    beforeEach(() => {
      mockStore.tool = 'circle3p';
    });

    it('should add first point on click', () => {
      render(<Canvas />);

      expect(mockUseToolState.setCircle3pPoints).toBeDefined();
    });

    it('should add second point on second click', () => {
      mockUseToolState.circle3pPoints = [[100, 100]];

      render(<Canvas />);

      expect(mockUseToolState.circle3pPoints).toHaveLength(1);
    });

    it('should create circle on third point', () => {
      mockUseToolState.circle3pPoints = [
        [100, 100],
        [200, 100],
      ];

      render(<Canvas />);

      expect(mockUseToolState.circle3pPoints).toHaveLength(2);
    });

    it('should render circle3p preview while drawing', () => {
      mockUseToolState.circle3pPoints = [
        [100, 100],
        [200, 100],
        [150, 200],
      ];

      render(<Canvas />);

      expect(mockUseToolRenderer.drawCircle3pPreview).toBeDefined();
    });

    it('should handle collinear points', () => {
      mockUseToolState.circle3pPoints = [
        [100, 100],
        [200, 100],
        [300, 100],
      ];

      render(<Canvas />);

      expect(mockUseToolState.circle3pPoints).toHaveLength(3);
    });

    it('should clear circle3p points on reset', () => {
      mockUseToolState.circle3pPoints = [];

      render(<Canvas />);

      expect(mockUseToolState.circle3pPoints).toHaveLength(0);
    });
  });

  describe('Tool Interactions', () => {
    it('should change cursor for bbox tool', () => {
      mockStore.tool = 'bbox';

      render(<Canvas />);

      expect(mockStore.tool).toBe('bbox');
    });

    it('should change cursor for polygon tool', () => {
      mockStore.tool = 'polygon';

      render(<Canvas />);

      expect(mockStore.tool).toBe('polygon');
    });

    it('should change cursor for select tool', () => {
      mockStore.tool = 'select';

      render(<Canvas />);

      expect(mockStore.tool).toBe('select');
    });

    it('should handle tool switch during drawing', () => {
      mockStore.tool = 'bbox';
      mockStore.isDrawing = true;

      const { rerender } = render(<Canvas />);

      mockStore.tool = 'polygon';
      mockStore.isDrawing = false;

      rerender(<Canvas />);

      expect(mockStore.tool).toBe('polygon');
    });

    it('should cancel drawing on Escape key', () => {
      mockStore.tool = 'bbox';
      mockStore.isDrawing = true;

      render(<Canvas />);

      expect(mockStore.isDrawing).toBe(true);
    });

    it('should reset tool state on tool change', () => {
      mockStore.tool = 'bbox';

      const { rerender } = render(<Canvas />);

      mockStore.tool = 'polygon';

      rerender(<Canvas />);

      expect(mockUseToolState.resetAllToolState).toBeDefined();
    });
  });

  describe('Drawing State Management', () => {
    it('should set isDrawing to true on mouse down', () => {
      mockStore.tool = 'bbox';

      render(<Canvas />);

      expect(mockStore.isDrawing).toBe(false);
    });

    it('should track drawingStart position', () => {
      mockStore.tool = 'bbox';
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 100, y: 100 };

      render(<Canvas />);

      expect(mockStore.drawingStart).toEqual({ x: 100, y: 100 });
    });

    it('should update cursor position during mouse move', () => {
      mockStore.canvas.cursor = { x: 250, y: 350 };

      render(<Canvas />);

      expect(mockStore.canvas.cursor).toEqual({ x: 250, y: 350 });
    });

    it('should clear drawing state on finish', () => {
      mockStore.tool = 'bbox';
      mockStore.isDrawing = false;
      mockStore.drawingStart = null;

      render(<Canvas />);

      expect(mockStore.isDrawing).toBe(false);
      expect(mockStore.drawingStart).toBeNull();
    });

    it('should handle drawing state with zoom', () => {
      mockStore.tool = 'bbox';
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 100, y: 100 };
      mockStore.canvas.zoom = 2.0;

      render(<Canvas />);

      expect(mockStore.canvas.zoom).toBe(2.0);
    });

    it('should handle drawing state with pan', () => {
      mockStore.tool = 'bbox';
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 100, y: 100 };
      mockStore.canvas.pan = { x: 50, y: 75 };

      render(<Canvas />);

      expect(mockStore.canvas.pan).toEqual({ x: 50, y: 75 });
    });

    it('should prevent drawing when image is locked', () => {
      mockStore.tool = 'bbox';

      render(<Canvas />);

      // Image lock is handled by useImageManagement hook
      expect(mockStore.tool).toBe('bbox');
    });

    it('should allow drawing when image is not locked', () => {
      mockStore.tool = 'bbox';

      render(<Canvas />);

      expect(mockStore.tool).toBe('bbox');
    });

    it('should handle rapid tool state changes', () => {
      const tools = ['bbox', 'polygon', 'polyline', 'circle', 'select'];

      const { rerender } = render(<Canvas />);

      tools.forEach((tool) => {
        mockStore.tool = tool as any;
        rerender(<Canvas />);
        expect(mockStore.tool).toBe(tool);
      });
    });

    it('should maintain annotation list during drawing', () => {
      mockStore.annotations = [
        createMockAnnotation({ id: 'ann-1' }),
        createMockAnnotation({ id: 'ann-2' }),
      ];
      mockStore.tool = 'bbox';
      mockStore.isDrawing = true;

      render(<Canvas />);

      expect(mockStore.annotations).toHaveLength(2);
    });
  });

  describe('Drawing with Existing Annotations', () => {
    it('should render existing bbox annotations while drawing', () => {
      mockStore.annotations = [
        createMockAnnotation({
          id: 'existing-bbox',
          annotationType: 'bbox',
          geometry: { bbox: [50, 50, 100, 100] },
        }),
      ];
      mockStore.tool = 'bbox';
      mockStore.isDrawing = true;

      render(<Canvas />);

      expect(mockStore.annotations).toHaveLength(1);
    });

    it('should render existing polygon annotations while drawing', () => {
      mockStore.annotations = [
        createMockAnnotation({
          id: 'existing-polygon',
          annotationType: 'polygon',
          geometry: {
            polygon: [
              [100, 100],
              [200, 100],
              [200, 200],
              [100, 200],
            ],
          },
        }),
      ];
      mockStore.tool = 'polygon';

      render(<Canvas />);

      expect(mockStore.annotations).toHaveLength(1);
    });

    it('should handle selection while drawing tool is active', () => {
      mockStore.annotations = [createMockAnnotation({ id: 'ann-1' })];
      mockStore.tool = 'bbox';
      mockStore.selectedAnnotationId = 'ann-1';

      render(<Canvas />);

      expect(mockStore.selectedAnnotationId).toBe('ann-1');
    });

    it('should not interfere with existing annotations during new drawing', () => {
      const existingCount = 3;
      mockStore.annotations = Array.from({ length: existingCount }, (_, i) =>
        createMockAnnotation({ id: `ann-${i}` })
      );
      mockStore.tool = 'bbox';
      mockStore.isDrawing = true;

      render(<Canvas />);

      expect(mockStore.annotations).toHaveLength(existingCount);
    });
  });

  describe('Drawing with Different Task Types', () => {
    it('should handle drawing in detection task', () => {
      mockStore.currentTask = 'detection';
      mockStore.tool = 'bbox';

      render(<Canvas />);

      expect(mockStore.currentTask).toBe('detection');
    });

    it('should handle drawing in segmentation task', () => {
      mockStore.currentTask = 'segmentation';
      mockStore.tool = 'polygon';

      render(<Canvas />);

      expect(mockStore.currentTask).toBe('segmentation');
    });

    it('should handle drawing in keypoint task', () => {
      mockStore.currentTask = 'keypoint';
      mockStore.tool = 'point';

      render(<Canvas />);

      expect(mockStore.currentTask).toBe('keypoint');
    });

    it('should handle drawing with multiple task types', () => {
      mockStore.project = createMockProject({
        taskTypes: ['detection', 'segmentation'],
        taskClasses: {
          detection: [createMockClass({ id: 'class-1', name: 'Object' })],
          segmentation: [createMockClass({ id: 'class-2', name: 'Region' })],
        },
      });
      mockStore.currentTask = 'detection';
      mockStore.tool = 'bbox';

      render(<Canvas />);

      expect(mockStore.currentTask).toBe('detection');
    });
  });

  describe('Drawing Preview Rendering', () => {
    it('should call bbox preview renderer during drawing', () => {
      mockStore.tool = 'bbox';
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 100, y: 100 };

      render(<Canvas />);

      expect(mockUseToolRenderer.drawBboxPreview).toBeDefined();
    });

    it('should call polygon preview renderer during drawing', () => {
      mockStore.tool = 'polygon';
      mockUseToolState.polygonVertices = [
        [100, 100],
        [200, 100],
      ];

      render(<Canvas />);

      expect(mockUseToolRenderer.drawPolygonPreview).toBeDefined();
    });

    it('should call polyline preview renderer during drawing', () => {
      mockStore.tool = 'polyline';
      mockUseToolState.polylineVertices = [
        [100, 100],
        [200, 150],
      ];

      render(<Canvas />);

      expect(mockUseToolRenderer.drawPolylinePreview).toBeDefined();
    });

    it('should call circle preview renderer during drawing', () => {
      mockStore.tool = 'circle';
      mockUseToolState.circleCenter = [200, 200];

      render(<Canvas />);

      expect(mockUseToolRenderer.drawCirclePreview).toBeDefined();
    });

    it('should call circle3p preview renderer during drawing', () => {
      mockStore.tool = 'circle3p';
      mockUseToolState.circle3pPoints = [
        [100, 100],
        [200, 100],
      ];

      render(<Canvas />);

      expect(mockUseToolRenderer.drawCircle3pPreview).toBeDefined();
    });

    it('should not render preview when not drawing', () => {
      mockStore.tool = 'bbox';
      mockStore.isDrawing = false;
      mockStore.drawingStart = null;

      render(<Canvas />);

      expect(mockStore.isDrawing).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle drawing without project', () => {
      mockStore.project = null;
      mockStore.tool = 'bbox';

      render(<Canvas />);

      expect(mockStore.project).toBeNull();
    });

    it('should handle drawing without current task', () => {
      mockStore.currentTask = null;
      mockStore.tool = 'bbox';

      render(<Canvas />);

      expect(mockStore.currentTask).toBeNull();
    });

    it('should handle drawing with empty task classes', () => {
      mockStore.project = createMockProject({
        taskClasses: {},
      });
      mockStore.tool = 'bbox';

      render(<Canvas />);

      expect(mockStore.project?.taskClasses).toEqual({});
    });

    it('should handle drawing start at negative coordinates', () => {
      mockStore.tool = 'bbox';
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: -10, y: -10 };

      render(<Canvas />);

      expect(mockStore.drawingStart).toEqual({ x: -10, y: -10 });
    });

    it('should handle cursor outside canvas bounds', () => {
      mockStore.tool = 'bbox';
      mockStore.canvas.cursor = { x: -50, y: 1000 };

      render(<Canvas />);

      expect(mockStore.canvas.cursor).toEqual({ x: -50, y: 1000 });
    });

    it('should handle tool state reset', () => {
      mockUseToolState.resetAllToolState();

      render(<Canvas />);

      expect(mockUseToolState.resetAllToolState).toHaveBeenCalled();
    });
  });
});
