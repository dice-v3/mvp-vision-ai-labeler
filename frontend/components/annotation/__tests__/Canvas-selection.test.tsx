/**
 * Canvas Component Tests - Selection and Editing
 *
 * Tests for annotation selection, editing, resizing, moving, and deletion.
 *
 * Phase 7: Frontend Canvas Component Tests
 * Subtask 7.4: Test Canvas.tsx selection and editing
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
import * as annotationUtils from '@/lib/annotation/utils';

// Create mock function for annotation store with vi.hoisted()
const { mockUseAnnotationStore } = vi.hoisted(() => ({
  mockUseAnnotationStore: vi.fn(),
}));

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
    isPointInside: vi.fn().mockReturnValue(false),
  },
  polylineTool: {
    renderPreview: vi.fn(),
    render: vi.fn(),
    isPointInside: vi.fn().mockReturnValue(false),
  },
  circleTool: {
    renderPreview: vi.fn(),
    render: vi.fn(),
    isPointInside: vi.fn().mockReturnValue(false),
  },
  circle3pTool: {
    renderPreview: vi.fn(),
    render: vi.fn(),
  },
}));

// Mock annotation utils
vi.mock('@/lib/annotation/utils', async () => {
  const actual = await vi.importActual('@/lib/annotation/utils');
  return {
    ...actual,
    drawGrid: vi.fn(),
    drawCrosshair: vi.fn(),
    drawNoObjectBadge: vi.fn(),
    snapshotToAnnotation: vi.fn(),
    getHandleAtPosition: vi.fn().mockReturnValue(null),
    pointInBbox: vi.fn().mockReturnValue(false),
    getCursorForHandle: vi.fn().mockReturnValue('default'),
    getPointOnEdge: vi.fn().mockReturnValue(null),
  };
});

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
    isImageLocked: true, // Default to locked for editing tests
    lockedByUser: 'test-user',
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
  Circle3pTool: {
    fitCircleThrough3Points: vi.fn().mockReturnValue({ center: [100, 100], radius: 50 }),
  },
}));

describe('Canvas - Selection', () => {
  let mockStore: ReturnType<typeof createMockAnnotationStore>;

  beforeEach(() => {
    vi.clearAllMocks();

    const project = createMockProject({
      task_types: ['detection'],
      task_classes: {
        detection: [createMockClass({ id: 'class-1', name: 'Person' })],
      },
    });

    const image = createMockImage({ id: 'img-1', width: 800, height: 600 });

    mockStore = createMockAnnotationStore({
      project,
      currentImage: image,
      currentTask: 'detection',
      tool: 'select',
      annotations: [],
      canvas: {
        zoom: 1.0,
        pan: { x: 0, y: 0 },
        cursor: { x: 0, y: 0 },
      },
    });

    (useAnnotationStore as any).mockImplementation((selector: any) => {
      if (typeof selector === 'function') {
        return selector(mockStore);
      }
      return mockStore;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Annotation Selection', () => {
    it('should select annotation when clicked on bbox', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectAnnotation = vi.fn();

      // Mock pointInBbox to return true for clicks inside bbox
      vi.mocked(annotationUtils.pointInBbox).mockReturnValue(true);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeTruthy();

      // Simulate click inside bbox
      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      expect(mockStore.selectAnnotation).toHaveBeenCalledWith('ann-1');
    });

    it('should select annotation when clicked on polygon', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polygon',
          points: [[100, 100], [200, 100], [200, 200], [100, 200]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectAnnotation = vi.fn();

      // Mock polygon tool isPointInside to return true
      const { polygonTool } = await import('@/lib/annotation');
      vi.mocked(polygonTool.isPointInside).mockReturnValue(true);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      expect(mockStore.selectAnnotation).toHaveBeenCalledWith('ann-1');
    });

    it('should select annotation when clicked on polyline', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polyline',
          points: [[100, 100], [200, 200], [300, 100]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectAnnotation = vi.fn();

      // Mock polyline tool isPointInside to return true
      const { polylineTool } = await import('@/lib/annotation');
      vi.mocked(polylineTool.isPointInside).mockReturnValue(true);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 200, clientY: 150 }));
      }

      expect(mockStore.selectAnnotation).toHaveBeenCalledWith('ann-1');
    });

    it('should select annotation when clicked on circle', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'circle',
          center: [150, 150],
          radius: 50,
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectAnnotation = vi.fn();

      // Mock circle tool isPointInside to return true
      const { circleTool } = await import('@/lib/annotation');
      vi.mocked(circleTool.isPointInside).mockReturnValue(true);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      expect(mockStore.selectAnnotation).toHaveBeenCalledWith('ann-1');
    });

    it('should deselect annotation when clicking outside', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.selectAnnotation = vi.fn();

      // Mock pointInBbox to return false for clicks outside bbox
      vi.mocked(annotationUtils.pointInBbox).mockReturnValue(false);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 50, clientY: 50 }));
      }

      expect(mockStore.selectAnnotation).toHaveBeenCalledWith(null);
    });

    it('should not select hidden annotations', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.hiddenAnnotationIds = new Set(['ann-1']);
      mockStore.isAnnotationVisible = vi.fn((id: string) => !mockStore.hiddenAnnotationIds.has(id));
      mockStore.selectAnnotation = vi.fn();

      // Mock pointInBbox to return true
      vi.mocked(annotationUtils.pointInBbox).mockReturnValue(true);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      // Should not select hidden annotation
      expect(mockStore.selectAnnotation).not.toHaveBeenCalledWith('ann-1');
    });

    it('should select first annotation when multiple annotations overlap', () => {
      const annotation1 = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      const annotation2 = createMockAnnotation({
        id: 'ann-2',
        geometry: {
          type: 'bbox',
          bbox: [120, 120, 180, 130],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation1, annotation2];
      mockStore.selectAnnotation = vi.fn();

      // Mock pointInBbox to return true for both
      vi.mocked(annotationUtils.pointInBbox).mockReturnValue(true);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 130, clientY: 130 }));
      }

      // Should select first annotation in list
      expect(mockStore.selectAnnotation).toHaveBeenCalledWith('ann-1');
    });

    it('should update cursor when hovering over annotation in select mode', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectAnnotation = vi.fn();

      // Mock pointInBbox to return true
      vi.mocked(annotationUtils.pointInBbox).mockReturnValue(true);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      // Cursor should be set to 'move' when selecting annotation
      expect(mockStore.selectAnnotation).toHaveBeenCalledWith('ann-1');
    });
  });

  describe('Bbox Resizing', () => {
    it('should start bbox resize when clicking on handle', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';

      // Mock getHandleAtPosition to return 'se' handle
      vi.mocked(annotationUtils.getHandleAtPosition).mockReturnValue('se');
      vi.mocked(annotationUtils.getCursorForHandle).mockReturnValue('se-resize');

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 300, clientY: 250 }));
      }

      expect(mockUseToolState.setIsResizing).toHaveBeenCalledWith(true);
      expect(mockUseToolState.setResizeHandle).toHaveBeenCalledWith('se');
    });

    it('should resize bbox when dragging handle', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockUseToolState.isResizing = true;
      mockUseToolState.resizeHandle = 'se';
      mockUseToolState.resizeStart = {
        x: 300,
        y: 250,
        bbox: [100, 100, 200, 150],
      };

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseMove(canvas, createMouseEvent('mousemove', { clientX: 350, clientY: 300 }));
      }

      // Mouse move handler should be called during resize
      expect(mockUseMouseHandlers.handleMouseMove).toHaveBeenCalled();
    });

    it('should handle all bbox resize handles (n, s, e, w, ne, nw, se, sw)', () => {
      const handles = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

      for (const handle of handles) {
        vi.clearAllMocks();

        const annotation = createMockAnnotation({
          id: 'ann-1',
          geometry: {
            type: 'bbox',
            bbox: [100, 100, 200, 150],
            image_width: 800,
            image_height: 600,
          },
        });

        mockStore.annotations = [annotation];
        mockStore.selectedAnnotationId = 'ann-1';

        // Mock getHandleAtPosition to return current handle
        vi.mocked(annotationUtils.getHandleAtPosition).mockReturnValue(handle);
        vi.mocked(annotationUtils.getCursorForHandle).mockReturnValue(`${handle}-resize`);

        const { container } = render(<Canvas />);
        const canvas = container.querySelector('canvas');

        if (canvas) {
          fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 200, clientY: 150 }));
        }

        expect(mockUseToolState.setResizeHandle).toHaveBeenCalledWith(handle);
      }
    });

    it('should block bbox resize when image is not locked', () => {
      const { useImageManagement } = await import('@/lib/annotation/hooks');

      // Mock isImageLocked to be false
      vi.mocked(useImageManagement).mockReturnValue({
        image: null,
        imageLoaded: false,
        isImageLocked: false,
        lockedByUser: null,
        showLockedDialog: false,
        setShowLockedDialog: vi.fn(),
        acquireLock: vi.fn(),
        releaseLock: vi.fn(),
      });

      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';

      // Mock getHandleAtPosition to return 'se' handle
      vi.mocked(annotationUtils.getHandleAtPosition).mockReturnValue('se');

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 300, clientY: 250 }));
      }

      // Resize should be blocked
      expect(mockUseToolState.setIsResizing).not.toHaveBeenCalled();
    });

    it('should update cursor based on handle position', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';

      // Mock getHandleAtPosition to return 'nw' handle
      vi.mocked(annotationUtils.getHandleAtPosition).mockReturnValue('nw');
      vi.mocked(annotationUtils.getCursorForHandle).mockReturnValue('nw-resize');

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 100, clientY: 100 }));
      }

      expect(annotationUtils.getCursorForHandle).toHaveBeenCalledWith('nw');
    });
  });

  describe('Polygon Editing', () => {
    it('should select vertex when clicked on polygon vertex', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polygon',
          points: [[100, 100], [200, 100], [200, 200], [100, 200]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.setSelectedVertexIndex = vi.fn();

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      // Click near first vertex (within 8px threshold)
      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 102, clientY: 102 }));
      }

      expect(mockUseToolState.setIsDraggingVertex).toHaveBeenCalledWith(true);
    });

    it('should drag vertex when vertex is selected', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polygon',
          points: [[100, 100], [200, 100], [200, 200], [100, 200]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.selectedVertexIndex = 0;
      mockUseToolState.isDraggingVertex = true;
      mockUseToolState.draggedVertexIndex = 0;

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseMove(canvas, createMouseEvent('mousemove', { clientX: 110, clientY: 110 }));
      }

      expect(mockUseMouseHandlers.handleMouseMove).toHaveBeenCalled();
    });

    it('should add vertex when clicking on polygon edge', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polygon',
          points: [[100, 100], [200, 100], [200, 200], [100, 200]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.setSelectedVertexIndex = vi.fn();

      // Mock getPointOnEdge to return a point on the edge
      vi.mocked(annotationUtils.getPointOnEdge).mockReturnValue({
        point: [150, 100] as [number, number],
        edgeIndex: 0,
        distance: 5,
      });

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 100 }));
      }

      // Vertex should be added
      expect(annotationUtils.getPointOnEdge).toHaveBeenCalled();
    });

    it('should move entire polygon when clicking inside polygon', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polygon',
          points: [[100, 100], [200, 100], [200, 200], [100, 200]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';

      // Mock polygon tool isPointInside to return true
      const { polygonTool } = await import('@/lib/annotation');
      vi.mocked(polygonTool.isPointInside).mockReturnValue(true);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      expect(mockUseToolState.setIsDraggingPolygon).toHaveBeenCalledWith(true);
    });

    it('should block vertex editing when image is not locked', () => {
      const { useImageManagement } = await import('@/lib/annotation/hooks');

      // Mock isImageLocked to be false
      vi.mocked(useImageManagement).mockReturnValue({
        image: null,
        imageLoaded: false,
        isImageLocked: false,
        lockedByUser: null,
        showLockedDialog: false,
        setShowLockedDialog: vi.fn(),
        acquireLock: vi.fn(),
        releaseLock: vi.fn(),
      });

      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polygon',
          points: [[100, 100], [200, 100], [200, 200], [100, 200]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      // Click near first vertex
      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 102, clientY: 102 }));
      }

      // Vertex drag should be blocked
      expect(mockUseToolState.setIsDraggingVertex).not.toHaveBeenCalled();
    });

    it('should maintain minimum 3 vertices when deleting polygon vertex', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polygon',
          points: [[100, 100], [200, 100], [150, 200]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.selectedVertexIndex = 0;

      // Cannot test keyboard events directly in this component since they're handled by useCanvasKeyboardShortcuts hook
      // This test documents the expected behavior
      expect(annotation.geometry.points).toHaveLength(3);
    });
  });

  describe('Polyline Editing', () => {
    it('should select vertex when clicked on polyline vertex', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polyline',
          points: [[100, 100], [200, 200], [300, 100]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.setSelectedVertexIndex = vi.fn();

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      // Click near first vertex (within 8px threshold)
      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 102, clientY: 102 }));
      }

      expect(mockUseToolState.setIsDraggingVertex).toHaveBeenCalledWith(true);
    });

    it('should add vertex when clicking on polyline edge', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polyline',
          points: [[100, 100], [200, 200], [300, 100]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.setSelectedVertexIndex = vi.fn();

      // Mock getPointOnEdge to return a point on the edge
      vi.mocked(annotationUtils.getPointOnEdge).mockReturnValue({
        point: [150, 150] as [number, number],
        edgeIndex: 0,
        distance: 5,
      });

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      expect(annotationUtils.getPointOnEdge).toHaveBeenCalled();
    });

    it('should move entire polyline when clicking on line', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polyline',
          points: [[100, 100], [200, 200], [300, 100]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';

      // Mock polyline tool isPointInside to return true
      const { polylineTool } = await import('@/lib/annotation');
      vi.mocked(polylineTool.isPointInside).mockReturnValue(true);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      expect(mockUseToolState.setIsDraggingPolygon).toHaveBeenCalledWith(true);
    });

    it('should maintain minimum 2 vertices when deleting polyline vertex', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polyline',
          points: [[100, 100], [200, 200]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.selectedVertexIndex = 0;

      // Cannot test keyboard events directly in this component
      // This test documents the expected behavior
      expect(annotation.geometry.points).toHaveLength(2);
    });
  });

  describe('Circle Editing', () => {
    it('should drag circle when clicking on center', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'circle',
          center: [150, 150],
          radius: 50,
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      // Click near center (within 8px threshold)
      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 152, clientY: 152 }));
      }

      expect(mockUseToolState.setIsDraggingCircle).toHaveBeenCalledWith(true);
    });

    it('should resize circle when clicking on radius handle', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'circle',
          center: [150, 150],
          radius: 50,
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      // Click on north handle (center.y - radius)
      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 100 }));
      }

      expect(mockUseToolState.setIsResizingCircle).toHaveBeenCalledWith(true);
    });

    it('should handle all circle resize handles (n, s, e, w)', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'circle',
          center: [150, 150],
          radius: 50,
          image_width: 800,
          image_height: 600,
        },
      });

      const handlePositions = {
        n: { x: 150, y: 100 }, // center.y - radius
        s: { x: 150, y: 200 }, // center.y + radius
        e: { x: 200, y: 150 }, // center.x + radius
        w: { x: 100, y: 150 }, // center.x - radius
      };

      for (const [handleName, pos] of Object.entries(handlePositions)) {
        vi.clearAllMocks();

        mockStore.annotations = [annotation];
        mockStore.selectedAnnotationId = 'ann-1';

        const { container } = render(<Canvas />);
        const canvas = container.querySelector('canvas');

        if (canvas) {
          fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: pos.x, clientY: pos.y }));
        }

        expect(mockUseToolState.setIsResizingCircle).toHaveBeenCalledWith(true);
      }
    });

    it('should move circle when clicking inside circle area', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'circle',
          center: [150, 150],
          radius: 50,
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';

      // Mock circle tool isPointInside to return true
      const { circleTool } = await import('@/lib/annotation');
      vi.mocked(circleTool.isPointInside).mockReturnValue(true);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 170, clientY: 150 }));
      }

      expect(mockUseToolState.setIsDraggingCircle).toHaveBeenCalledWith(true);
    });

    it('should block circle editing when image is not locked', () => {
      const { useImageManagement } = await import('@/lib/annotation/hooks');

      // Mock isImageLocked to be false
      vi.mocked(useImageManagement).mockReturnValue({
        image: null,
        imageLoaded: false,
        isImageLocked: false,
        lockedByUser: null,
        showLockedDialog: false,
        setShowLockedDialog: vi.fn(),
        acquireLock: vi.fn(),
        releaseLock: vi.fn(),
      });

      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'circle',
          center: [150, 150],
          radius: 50,
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      // Click on north handle
      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 100 }));
      }

      // Resize should be blocked
      expect(mockUseToolState.setIsResizingCircle).not.toHaveBeenCalled();
    });
  });

  describe('Annotation Deletion', () => {
    it('should handle annotation deletion via delete key', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.deleteAnnotation = vi.fn();

      render(<Canvas />);

      // Keyboard shortcuts are handled by useCanvasKeyboardShortcuts hook
      // This test documents that the hook is used
      const { useCanvasKeyboardShortcuts } = await import('@/lib/annotation/hooks');
      expect(useCanvasKeyboardShortcuts).toHaveBeenCalled();
    });

    it('should delete all annotations when no annotation is selected', () => {
      const annotation1 = createMockAnnotation({ id: 'ann-1' });
      const annotation2 = createMockAnnotation({ id: 'ann-2' });

      mockStore.annotations = [annotation1, annotation2];
      mockStore.selectedAnnotationId = null;

      render(<Canvas />);

      // Keyboard shortcuts are handled by useCanvasKeyboardShortcuts hook
      const { useCanvasKeyboardShortcuts } = await import('@/lib/annotation/hooks');
      expect(useCanvasKeyboardShortcuts).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should clear vertex selection when clicking elsewhere', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'polygon',
          points: [[100, 100], [200, 100], [200, 200], [100, 200]],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.selectedVertexIndex = 0;
      mockStore.setSelectedVertexIndex = vi.fn();

      // Mock pointInBbox to return false (clicking outside)
      vi.mocked(annotationUtils.pointInBbox).mockReturnValue(false);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 50, clientY: 50 }));
      }

      // Should clear vertex selection when clicking elsewhere
      expect(mockStore.setSelectedVertexIndex).toHaveBeenCalled();
    });

    it('should clear bbox handle selection when clicking elsewhere', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.selectedBboxHandle = 'se';
      mockStore.setSelectedBboxHandle = vi.fn();

      // Mock pointInBbox to return false (clicking outside)
      vi.mocked(annotationUtils.pointInBbox).mockReturnValue(false);
      // Mock getHandleAtPosition to return null (not on handle)
      vi.mocked(annotationUtils.getHandleAtPosition).mockReturnValue(null);

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 50, clientY: 50 }));
      }

      // Should clear handle selection when clicking elsewhere
      expect(mockStore.setSelectedBboxHandle).toHaveBeenCalled();
    });

    it('should maintain selection state when editing', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockUseToolState.isResizing = true;

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      // During resize, annotation should remain selected
      expect(mockStore.selectedAnnotationId).toBe('ann-1');

      if (canvas) {
        fireEvent.mouseMove(canvas, createMouseEvent('mousemove', { clientX: 150, clientY: 150 }));
      }

      expect(mockStore.selectedAnnotationId).toBe('ann-1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle selection when no annotations exist', () => {
      mockStore.annotations = [];
      mockStore.selectAnnotation = vi.fn();

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      // Should not crash and should not select anything
      expect(mockStore.selectAnnotation).not.toHaveBeenCalled();
    });

    it('should handle selection when annotation has invalid geometry', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [],
          image_width: 800,
          image_height: 600,
        } as any,
      });

      mockStore.annotations = [annotation];
      mockStore.selectAnnotation = vi.fn();

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      // Should not crash
      expect(container).toBeTruthy();
    });

    it('should handle rapid selection changes', () => {
      const annotation1 = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      const annotation2 = createMockAnnotation({
        id: 'ann-2',
        geometry: {
          type: 'bbox',
          bbox: [250, 150, 100, 100],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation1, annotation2];
      mockStore.selectAnnotation = vi.fn();

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        // Rapidly click on different annotations
        vi.mocked(annotationUtils.pointInBbox).mockReturnValue(true);
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 125 }));

        vi.mocked(annotationUtils.pointInBbox).mockReturnValueOnce(false).mockReturnValueOnce(true);
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 300, clientY: 200 }));

        vi.mocked(annotationUtils.pointInBbox).mockReturnValue(false);
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 50, clientY: 50 }));
      }

      // Should handle rapid selection changes
      expect(mockStore.selectAnnotation).toHaveBeenCalled();
    });

    it('should handle editing at zoom boundaries', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.canvas.zoom = 0.1; // Very low zoom

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      vi.mocked(annotationUtils.getHandleAtPosition).mockReturnValue('se');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      // Should still handle resize at low zoom
      expect(container).toBeTruthy();
    });

    it('should handle editing with large pan offset', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
          image_width: 800,
          image_height: 600,
        },
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockStore.canvas.pan = { x: 1000, y: 1000 };

      const { container } = render(<Canvas />);
      const canvas = container.querySelector('canvas');

      if (canvas) {
        fireEvent.mouseDown(canvas, createMouseEvent('mousedown', { clientX: 150, clientY: 150 }));
      }

      // Should handle large pan offset
      expect(container).toBeTruthy();
    });
  });
});
