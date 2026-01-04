/**
 * Canvas Component Tests - Core Rendering
 *
 * Tests for Canvas component initialization, canvas element creation,
 * image loading, and basic rendering logic.
 *
 * Phase 7: Frontend Canvas Component Tests
 * Subtask 7.1: Test Canvas.tsx core rendering
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Canvas from '../Canvas';
import {
  createMockAnnotationStore,
  createMockProject,
  createMockImage,
  createMockAnnotation,
} from '@/lib/test-utils/mock-stores';
import { useAnnotationStore } from '@/lib/stores/annotationStore';

// Mock the annotation store
vi.mock('@/lib/stores/annotationStore', () => ({
  useAnnotationStore: vi.fn(),
}));

// Mock API modules
vi.mock('@/lib/api/annotations', () => ({
  createAnnotation: vi.fn(),
  updateAnnotation: vi.fn(),
  deleteAnnotation: vi.fn(),
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
  bboxTool: {},
  polygonTool: {},
  polylineTool: {},
  circleTool: {},
  circle3pTool: {},
}));

// Mock annotation utils
vi.mock('@/lib/annotation/utils', () => ({
  drawGrid: vi.fn(),
  drawCrosshair: vi.fn(),
  drawNoObjectBadge: vi.fn(),
  snapshotToAnnotation: vi.fn(),
  getHandleAtPosition: vi.fn(),
  pointInBbox: vi.fn(),
  getCursorForHandle: vi.fn(),
  getPointOnEdge: vi.fn(),
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
    imageLoaded: false,
    isImageLocked: false,
    lockedByUser: null,
    showLockedDialog: false,
    setShowLockedDialog: vi.fn(),
    acquireLock: vi.fn(),
    releaseLock: vi.fn(),
  })),
  useToolState: vi.fn(() => ({
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
  })),
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
  useToolRenderer: vi.fn(() => ({
    drawBboxPreview: vi.fn(),
    drawPolygonPreview: vi.fn(),
    drawPolylinePreview: vi.fn(),
    drawCirclePreview: vi.fn(),
    drawCircle3pPreview: vi.fn(),
  })),
  useCanvasRenderer: vi.fn(),
  useCanvasKeyboardShortcuts: vi.fn(),
  useBatchOperations: vi.fn(),
  useMouseHandlers: vi.fn(() => ({
    handleMouseDown: vi.fn(),
    handleMouseMove: vi.fn(),
    handleMouseUp: vi.fn(),
  })),
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

// Mock Circle3pTool
vi.mock('@/lib/annotation/tools/Circle3pTool', () => ({
  Circle3pTool: {},
}));

describe('Canvas Component - Core Rendering', () => {
  let mockStore: ReturnType<typeof createMockAnnotationStore>;

  beforeEach(() => {
    // Create default mock store
    mockStore = createMockAnnotationStore();

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

  describe('Component Initialization', () => {
    it('should render without crashing', () => {
      mockStore.currentImage = createMockImage();
      mockStore.project = createMockProject();

      const { container } = render(<Canvas />);

      expect(container).toBeInTheDocument();
    });

    it('should render "No image selected" when currentImage is null', () => {
      mockStore.currentImage = null;

      render(<Canvas />);

      expect(screen.getByText('No image selected')).toBeInTheDocument();
    });

    it('should render "No image selected" in correct container', () => {
      mockStore.currentImage = null;

      render(<Canvas />);

      const container = screen.getByText('No image selected').parentElement;
      expect(container).toHaveClass('flex-1', 'bg-gray-900', 'flex', 'items-center', 'justify-center');
    });

    it('should render empty state with proper styling', () => {
      mockStore.currentImage = null;

      render(<Canvas />);

      const message = screen.getByText('No image selected');
      expect(message).toHaveClass('text-gray-500');
    });

    it('should not render canvas when no image selected', () => {
      mockStore.currentImage = null;

      const { container } = render(<Canvas />);

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeInTheDocument();
    });
  });

  describe('Canvas Element Creation', () => {
    it('should create canvas element when image is selected', () => {
      mockStore.currentImage = createMockImage();
      mockStore.project = createMockProject();

      const { container } = render(<Canvas />);

      const canvas = container.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should apply correct CSS classes to canvas element', () => {
      mockStore.currentImage = createMockImage();
      mockStore.project = createMockProject();

      const { container } = render(<Canvas />);

      const canvas = container.querySelector('canvas');
      expect(canvas).toHaveClass('w-full', 'h-full');
    });

    it('should set canvas cursor style', () => {
      mockStore.currentImage = createMockImage();
      mockStore.project = createMockProject();

      const { container } = render(<Canvas />);

      const canvas = container.querySelector('canvas');
      expect(canvas).toHaveStyle({ cursor: 'default' });
    });

    it('should create container ref element', () => {
      mockStore.currentImage = createMockImage();
      mockStore.project = createMockProject();

      const { container } = render(<Canvas />);

      const containerDiv = container.querySelector('.flex-1.bg-white.dark\\:bg-gray-900');
      expect(containerDiv).toBeInTheDocument();
    });

    it('should apply correct classes to container', () => {
      mockStore.currentImage = createMockImage();
      mockStore.project = createMockProject();

      const { container } = render(<Canvas />);

      const containerDiv = container.querySelector('.flex-1');
      expect(containerDiv).toHaveClass('relative', 'overflow-hidden');
    });

    it('should set canvasRef in store on mount', async () => {
      mockStore.currentImage = createMockImage();
      mockStore.project = createMockProject();

      render(<Canvas />);

      await waitFor(() => {
        expect((useAnnotationStore as any).setState).toHaveBeenCalled();
      });
    });
  });

  describe('Image Loading', () => {
    it('should render with valid image data', () => {
      const mockImage = createMockImage({
        id: 'test-image-1',
        file_name: 'test.jpg',
        url: 'http://example.com/test.jpg',
        width: 1024,
        height: 768,
      });

      mockStore.currentImage = mockImage;
      mockStore.project = createMockProject();

      render(<Canvas />);

      const canvas = screen.getByRole('img', { hidden: true }) || document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should handle image with different dimensions', () => {
      const mockImage = createMockImage({
        width: 1920,
        height: 1080,
      });

      mockStore.currentImage = mockImage;
      mockStore.project = createMockProject();

      const { container } = render(<Canvas />);

      expect(container).toBeInTheDocument();
    });

    it('should handle image with minimal data', () => {
      const mockImage = createMockImage({
        id: 'minimal-image',
        file_name: 'minimal.jpg',
        url: 'http://example.com/minimal.jpg',
      });

      mockStore.currentImage = mockImage;
      mockStore.project = createMockProject();

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should update when currentImage changes', () => {
      const firstImage = createMockImage({ id: 'image-1' });
      mockStore.currentImage = firstImage;
      mockStore.project = createMockProject();

      const { rerender } = render(<Canvas />);

      const secondImage = createMockImage({ id: 'image-2' });
      mockStore.currentImage = secondImage;

      rerender(<Canvas />);

      expect(document.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle transition from no image to image', () => {
      mockStore.currentImage = null;

      const { rerender } = render(<Canvas />);

      expect(screen.getByText('No image selected')).toBeInTheDocument();

      mockStore.currentImage = createMockImage();
      mockStore.project = createMockProject();

      rerender(<Canvas />);

      expect(screen.queryByText('No image selected')).not.toBeInTheDocument();
      expect(document.querySelector('canvas')).toBeInTheDocument();
    });

    it('should handle transition from image to no image', () => {
      mockStore.currentImage = createMockImage();
      mockStore.project = createMockProject();

      const { rerender } = render(<Canvas />);

      expect(document.querySelector('canvas')).toBeInTheDocument();

      mockStore.currentImage = null;

      rerender(<Canvas />);

      expect(screen.getByText('No image selected')).toBeInTheDocument();
      expect(document.querySelector('canvas')).not.toBeInTheDocument();
    });
  });

  describe('Basic Rendering Logic', () => {
    it('should render canvas when project and image are present', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render with annotations', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.annotations = [
        createMockAnnotation({ id: 'ann-1' }),
        createMockAnnotation({ id: 'ann-2' }),
      ];

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render without annotations', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.annotations = [];

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render with selected annotation', () => {
      const annotation = createMockAnnotation({ id: 'selected-ann' });
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'selected-ann';

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render with different tools', () => {
      const tools = ['select', 'bbox', 'polygon', 'polyline', 'circle', 'circle3p', 'classification'];

      tools.forEach((tool) => {
        mockStore.project = createMockProject();
        mockStore.currentImage = createMockImage();
        mockStore.tool = tool as any;

        const { unmount } = render(<Canvas />);

        const canvas = document.querySelector('canvas');
        expect(canvas).toBeInTheDocument();

        unmount();
      });
    });

    it('should render with different zoom levels', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.canvas.zoom = 2.5;

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render with pan offset', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.canvas.pan = { x: 100, y: 50 };

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render with drawing state active', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.isDrawing = true;
      mockStore.drawingStart = { x: 100, y: 100 };

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render in diff mode', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.diffMode = {
        enabled: true,
        versionA: null,
        versionB: null,
        viewMode: 'overlay',
        diffData: null,
        filters: {
          showAdded: true,
          showRemoved: true,
          showModified: true,
          showUnchanged: true,
        },
      };

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('Store Integration', () => {
    it('should read currentImage from store', () => {
      const mockImage = createMockImage();
      mockStore.currentImage = mockImage;
      mockStore.project = createMockProject();

      render(<Canvas />);

      expect(useAnnotationStore).toHaveBeenCalled();
    });

    it('should read project from store', () => {
      const mockProject = createMockProject();
      mockStore.project = mockProject;
      mockStore.currentImage = createMockImage();

      render(<Canvas />);

      expect(useAnnotationStore).toHaveBeenCalled();
    });

    it('should read annotations from store', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.annotations = [
        createMockAnnotation({ id: 'ann-1' }),
        createMockAnnotation({ id: 'ann-2' }),
      ];

      render(<Canvas />);

      expect(useAnnotationStore).toHaveBeenCalled();
    });

    it('should read canvas state from store', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.canvas = {
        zoom: 1.5,
        pan: { x: 50, y: 100 },
        cursor: { x: 200, y: 300 },
      };

      render(<Canvas />);

      expect(useAnnotationStore).toHaveBeenCalled();
    });

    it('should read tool from store', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.tool = 'bbox';

      render(<Canvas />);

      expect(useAnnotationStore).toHaveBeenCalled();
    });

    it('should read preferences from store', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.preferences = {
        autoSave: true,
        snapToEdges: true,
        showLabels: true,
        showGrid: true,
        darkMode: false,
        autoSelectClass: true,
        imageListView: 'grid',
        autoMagnifier: true,
        magnifierMode: 'following',
        magnifierSize: 200,
        magnificationLevel: 3,
      };

      render(<Canvas />);

      expect(useAnnotationStore).toHaveBeenCalled();
    });

    it('should read images list from store', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage({ id: 'image-1' });
      mockStore.images = [
        createMockImage({ id: 'image-1' }),
        createMockImage({ id: 'image-2' }),
        createMockImage({ id: 'image-3' }),
      ];
      mockStore.currentIndex = 0;

      render(<Canvas />);

      expect(useAnnotationStore).toHaveBeenCalled();
    });

    it('should handle empty images array', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.images = [];
      mockStore.currentIndex = -1;

      render(<Canvas />);

      expect(document.querySelector('canvas')).toBeInTheDocument();
    });
  });

  describe('Ref Management', () => {
    it('should create canvasRef', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should create containerRef', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();

      const { container } = render(<Canvas />);

      const containerDiv = container.querySelector('.relative.overflow-hidden');
      expect(containerDiv).toBeInTheDocument();
    });

    it('should update store with refs on mount', async () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();

      render(<Canvas />);

      await waitFor(() => {
        expect((useAnnotationStore as any).setState).toHaveBeenCalled();
      });
    });
  });

  describe('Responsive Rendering', () => {
    it('should render with small image dimensions', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage({
        width: 320,
        height: 240,
      });

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render with large image dimensions', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage({
        width: 4096,
        height: 3072,
      });

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render with portrait image', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage({
        width: 600,
        height: 800,
      });

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render with landscape image', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage({
        width: 1920,
        height: 1080,
      });

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should render with square image', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage({
        width: 1024,
        height: 1024,
      });

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle project without task types', () => {
      mockStore.project = createMockProject({
        taskTypes: [],
      });
      mockStore.currentImage = createMockImage();

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should handle project without task classes', () => {
      mockStore.project = createMockProject({
        taskClasses: {},
      });
      mockStore.currentImage = createMockImage();

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should handle image with zero dimensions', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage({
        width: 0,
        height: 0,
      });

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should handle annotation with no geometry', () => {
      mockStore.project = createMockProject();
      mockStore.currentImage = createMockImage();
      mockStore.annotations = [
        createMockAnnotation({
          geometry: {} as any,
        }),
      ];

      render(<Canvas />);

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    it('should handle rapid image switching', () => {
      mockStore.project = createMockProject();

      const { rerender } = render(<Canvas />);

      for (let i = 0; i < 5; i++) {
        mockStore.currentImage = createMockImage({ id: `image-${i}` });
        rerender(<Canvas />);
      }

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });
});
