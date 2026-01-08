/**
 * Mock Zustand Stores
 *
 * Provides mock implementations of Zustand stores for testing
 * Canvas, ImageList, and RightPanel components.
 */

import { vi } from 'vitest';
import type {
  Annotation,
  ImageData,
  Project,
  Tool,
  CanvasState,
  PanelState,
  Preferences,
  SaveStatus,
  Point,
  ClassInfo,
} from '@/lib/stores/annotationStore';

// ============================================================================
// Mock Annotation Store
// ============================================================================

export interface MockAnnotationStore {
  // Project & Images
  project: Project | null;
  images: ImageData[];
  totalImages: number;
  currentIndex: number;
  currentImage: ImageData | null;
  currentTask: string | null;

  // Annotations
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  selectedVertexIndex: number | null;
  selectedBboxHandle: string | null;
  clipboard: Annotation | null;

  // UI State
  tool: Tool;
  canvas: CanvasState;
  panels: PanelState;

  // Interaction State
  isDrawing: boolean;
  drawingStart: Point | null;
  isDragging: boolean;
  dragTarget: 'bbox' | 'handle' | 'canvas' | null;

  // Settings
  preferences: Preferences;

  // History
  history: {
    past: any[];
    future: any[];
  };

  // Network
  saveStatus: SaveStatus;
  lastSaved: Date | null;
  loading: boolean;
  backgroundLoading: boolean;
  error: string | null;

  // Other state
  lastSelectedClassId: string | null;
  hiddenAnnotationIds: Set<string>;
  showAllAnnotations: boolean;
  selectedImageIds: string[];
  lastClickedImageIndex: number | null;
  canvasRef: React.RefObject<HTMLCanvasElement> | null;
  imageRef: React.RefObject<HTMLImageElement> | null;
  showMinimap: boolean;
  projectLocks?: any[];
  isUndoing: boolean;
  isRedoing: boolean;
  diffMode: {
    enabled: boolean;
    versionA: any | null;
    versionB: any | null;
    viewMode: 'overlay' | 'side-by-side' | 'animation';
    diffData: any | null;
    filters: {
      showAdded: boolean;
      showRemoved: boolean;
      showModified: boolean;
      showUnchanged: boolean;
    };
  };

  // Actions
  setProject: ReturnType<typeof vi.fn>;
  setImages: ReturnType<typeof vi.fn>;
  setCurrentIndex: ReturnType<typeof vi.fn>;
  setCurrentImage: ReturnType<typeof vi.fn>;
  setCurrentTask: ReturnType<typeof vi.fn>;
  addAnnotation: ReturnType<typeof vi.fn>;
  updateAnnotation: ReturnType<typeof vi.fn>;
  deleteAnnotation: ReturnType<typeof vi.fn>;
  selectAnnotation: ReturnType<typeof vi.fn>;
  clearSelection: ReturnType<typeof vi.fn>;
  setTool: ReturnType<typeof vi.fn>;
  setZoom: ReturnType<typeof vi.fn>;
  setPan: ReturnType<typeof vi.fn>;
  setCursor: ReturnType<typeof vi.fn>;
  startDrawing: ReturnType<typeof vi.fn>;
  updateDrawing: ReturnType<typeof vi.fn>;
  finishDrawing: ReturnType<typeof vi.fn>;
  cancelDrawing: ReturnType<typeof vi.fn>;
  toggleLeftPanel: ReturnType<typeof vi.fn>;
  toggleRightPanel: ReturnType<typeof vi.fn>;
  setPreference: ReturnType<typeof vi.fn>;
  undo: ReturnType<typeof vi.fn>;
  redo: ReturnType<typeof vi.fn>;
  canUndo: ReturnType<typeof vi.fn>;
  canRedo: ReturnType<typeof vi.fn>;
  goToNextImage: ReturnType<typeof vi.fn>;
  goToPrevImage: ReturnType<typeof vi.fn>;
  toggleAnnotationVisibility: ReturnType<typeof vi.fn>;
  toggleAllAnnotationsVisibility: ReturnType<typeof vi.fn>;
  isAnnotationVisible: ReturnType<typeof vi.fn>;
  getCurrentClasses: ReturnType<typeof vi.fn>;
  toggleImageSelection: ReturnType<typeof vi.fn>;
  selectImageRange: ReturnType<typeof vi.fn>;
  clearImageSelection: ReturnType<typeof vi.fn>;
  isImageSelected: ReturnType<typeof vi.fn>;
  loadMoreImages: ReturnType<typeof vi.fn>;
  setShowMinimap: ReturnType<typeof vi.fn>;
  setCanvasRef: ReturnType<typeof vi.fn>;
  setImageRef: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock annotation store with default values
 */
export function createMockAnnotationStore(
  overrides: Partial<MockAnnotationStore> = {}
): MockAnnotationStore {
  const defaultStore: MockAnnotationStore = {
    // Project & Images
    project: null,
    images: [],
    totalImages: 0,
    currentIndex: 0,
    currentImage: null,
    currentTask: null,

    // Annotations
    annotations: [],
    selectedAnnotationId: null,
    selectedVertexIndex: null,
    selectedBboxHandle: null,
    clipboard: null,

    // UI State
    tool: 'select',
    canvas: {
      zoom: 1,
      pan: { x: 0, y: 0 },
      cursor: { x: 0, y: 0 },
    },
    panels: {
      left: true,
      right: true,
    },

    // Interaction State
    isDrawing: false,
    drawingStart: null,
    isDragging: false,
    dragTarget: null,

    // Settings
    preferences: {
      autoSave: true,
      snapToEdges: false,
      showLabels: true,
      showGrid: false,
      darkMode: false,
      autoSelectClass: true,
      imageListView: 'grid',
      autoMagnifier: false,
      magnifierMode: 'following',
      magnifierSize: 200,
      magnificationLevel: 3,
    },

    // History
    history: {
      past: [],
      future: [],
    },

    // Network
    saveStatus: 'saved',
    lastSaved: null,
    loading: false,
    backgroundLoading: false,
    error: null,

    // Other state
    lastSelectedClassId: null,
    hiddenAnnotationIds: new Set(),
    showAllAnnotations: true,
    selectedImageIds: [],
    lastClickedImageIndex: null,
    canvasRef: null,
    imageRef: null,
    showMinimap: false,
    projectLocks: [],
    isUndoing: false,
    isRedoing: false,
    diffMode: {
      enabled: false,
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
    },

    // Actions - all mocked
    setProject: vi.fn(),
    setImages: vi.fn(),
    setCurrentIndex: vi.fn(),
    setCurrentImage: vi.fn(),
    setCurrentTask: vi.fn(),
    addAnnotation: vi.fn(),
    updateAnnotation: vi.fn(),
    deleteAnnotation: vi.fn(),
    selectAnnotation: vi.fn(),
    clearSelection: vi.fn(),
    setTool: vi.fn(),
    setZoom: vi.fn(),
    setPan: vi.fn(),
    setCursor: vi.fn(),
    startDrawing: vi.fn(),
    updateDrawing: vi.fn(),
    finishDrawing: vi.fn(),
    cancelDrawing: vi.fn(),
    toggleLeftPanel: vi.fn(),
    toggleRightPanel: vi.fn(),
    setPreference: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: vi.fn(() => false),
    canRedo: vi.fn(() => false),
    goToNextImage: vi.fn(),
    goToPrevImage: vi.fn(),
    toggleAnnotationVisibility: vi.fn(),
    toggleAllAnnotationsVisibility: vi.fn(),
    isAnnotationVisible: vi.fn((id: string) => !defaultStore.hiddenAnnotationIds.has(id)),
    getCurrentClasses: vi.fn(() => ({})),
    toggleImageSelection: vi.fn(),
    selectImageRange: vi.fn(),
    clearImageSelection: vi.fn(),
    isImageSelected: vi.fn((id: string) => defaultStore.selectedImageIds.includes(id)),
    loadMoreImages: vi.fn(),
    setShowMinimap: vi.fn(),
    setCanvasRef: vi.fn(),
    setImageRef: vi.fn(),
  };

  return { ...defaultStore, ...overrides };
}

/**
 * Creates a mock implementation for useAnnotationStore hook.
 * NOTE: Do NOT use vi.mock inside functions - it has hoisting issues.
 * Instead, use this function in your test file with vi.hoisted():
 *
 * @example
 * const { mockStore } = vi.hoisted(() => ({
 *   mockStore: createMockAnnotationStore(),
 * }));
 *
 * vi.mock('@/lib/stores/annotationStore', () => ({
 *   useAnnotationStore: (selector?: (state: any) => any) => {
 *     return selector ? selector(mockStore) : mockStore;
 *   },
 * }));
 */
export function mockUseAnnotationStore(store: Partial<MockAnnotationStore> = {}) {
  return createMockAnnotationStore(store);
}

// ============================================================================
// Mock Toast Store
// ============================================================================

export interface MockToastStore {
  toast: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warning: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock toast store
 */
export function createMockToastStore(): MockToastStore {
  return {
    toast: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };
}

/**
 * Creates a mock toast store.
 * NOTE: Do NOT use vi.mock inside functions - it has hoisting issues.
 * Use createMockToastStore() directly and set up vi.mock in your test file.
 *
 * @example
 * vi.mock('@/lib/stores/toastStore', () => ({
 *   toast: {
 *     success: vi.fn(),
 *     error: vi.fn(),
 *     info: vi.fn(),
 *     warning: vi.fn(),
 *   },
 * }));
 */
export function mockToastStore() {
  return createMockToastStore();
}

// ============================================================================
// Mock Confirm Store
// ============================================================================

export interface MockConfirmStore {
  confirm: ReturnType<typeof vi.fn>;
}

/**
 * Creates a mock confirm store
 */
export function createMockConfirmStore(): MockConfirmStore {
  return {
    confirm: vi.fn().mockResolvedValue(true),
  };
}

/**
 * Creates a mock confirm store.
 * NOTE: Do NOT use vi.mock inside functions - it has hoisting issues.
 * Use createMockConfirmStore() directly and set up vi.mock in your test file.
 *
 * @example
 * vi.mock('@/lib/stores/confirmStore', () => ({
 *   confirm: vi.fn().mockResolvedValue(true),
 * }));
 */
export function mockConfirmStore() {
  return createMockConfirmStore();
}

// ============================================================================
// Test Data Factories
// ============================================================================

/**
 * Creates a mock project
 */
export function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'test-project-1',
    name: 'Test Project',
    datasetId: 'test-dataset-1',
    taskTypes: ['detection'],
    taskClasses: {
      detection: {
        'class-1': { name: 'Person', color: '#ff0000', order: 0 },
        'class-2': { name: 'Car', color: '#00ff00', order: 1 },
      },
    },
    taskConfig: {},
    ...overrides,
  };
}

/**
 * Creates a mock image
 */
export function createMockImage(overrides: Partial<ImageData> = {}): ImageData {
  return {
    id: 'test-image-1',
    file_name: 'test-image.jpg',
    url: 'http://example.com/test-image.jpg',
    thumbnail_url: 'http://example.com/test-image-thumb.jpg',
    width: 800,
    height: 600,
    annotated: false,
    annotation_count: 0,
    is_confirmed: false,
    status: 'not-started',
    ...overrides,
  };
}

/**
 * Creates a mock annotation
 */
export function createMockAnnotation(
  overrides: Partial<Annotation> = {}
): Annotation {
  return {
    id: 'test-annotation-1',
    projectId: 'test-project-1',
    imageId: 'test-image-1',
    annotationType: 'bbox',
    geometry: {
      type: 'bbox',
      bbox: [100, 100, 200, 150],
    },
    classId: 'class-1',
    className: 'Person',
    attributes: {},
    confidence: 1.0,
    isAiAssisted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates multiple mock annotations
 */
export function createMockAnnotations(count: number): Annotation[] {
  return Array.from({ length: count }, (_, i) =>
    createMockAnnotation({
      id: `annotation-${i + 1}`,
      geometry: {
        type: 'bbox',
        bbox: [100 + i * 50, 100, 200, 150],
      },
    })
  );
}

/**
 * Creates multiple mock images
 */
export function createMockImages(count: number): ImageData[] {
  return Array.from({ length: count }, (_, i) =>
    createMockImage({
      id: `image-${i + 1}`,
      file_name: `image-${i + 1}.jpg`,
      url: `http://example.com/image-${i + 1}.jpg`,
    })
  );
}

/**
 * Creates mock task classes
 */
export function createMockClasses(): Record<string, ClassInfo> {
  return {
    'class-1': { name: 'Person', color: '#ff0000', order: 0 },
    'class-2': { name: 'Car', color: '#00ff00', order: 1 },
    'class-3': { name: 'Bicycle', color: '#0000ff', order: 2 },
  };
}

/**
 * Creates a single mock class
 */
export function createMockClass(overrides: Partial<ClassInfo & { id: string }> = {}): ClassInfo & { id: string } {
  return {
    id: 'class-1',
    name: 'Person',
    color: '#ff0000',
    order: 0,
    ...overrides,
  };
}
