/**
 * Annotation Store (Zustand) - REFACTORED
 *
 * Manages all annotation state including:
 * - Current image and navigation
 * - Annotations (bboxes, polygons, etc.)
 * - Canvas state (zoom, pan)
 * - UI state (panels, tools)
 * - Undo/redo history
 *
 * REFACTORING CHANGES:
 * - Removed legacy classes field (use taskClasses only)
 * - Use TaskType enum for type safety
 * - Task-specific class management throughout
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TaskType } from '@/lib/tasks/types';

// ============================================================================
// Types
// ============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface ImageData {
  id: string;
  file_name: string;
  folder_path?: string;  // Folder path for folder-structured datasets
  url: string;
  width?: number;
  height?: number;
  annotated?: boolean;
  annotation_count?: number;

  // Phase 2.7: Image status fields
  is_confirmed?: boolean;
  status?: string;  // not-started, in-progress, completed
  confirmed_at?: string;
}

export interface BboxGeometry {
  type: 'bbox';
  bbox: [number, number, number, number]; // [x, y, width, height]
  area?: number;
}

export interface PolygonGeometry {
  type: 'polygon';
  points: [number, number][];
  area?: number;
  bbox?: [number, number, number, number];
}

export interface PolylineGeometry {
  type: 'polyline';
  points: [number, number][];
  image_width?: number;
  image_height?: number;
}

export interface CircleGeometry {
  type: 'circle';
  center: [number, number];
  radius: number;
  image_width?: number;
  image_height?: number;
}

export interface ClassificationGeometry {
  type: 'classification';
  labels?: string[];
  confidence?: number;
}

export type AnnotationGeometry = BboxGeometry | PolygonGeometry | PolylineGeometry | CircleGeometry | ClassificationGeometry;

export interface Annotation {
  id: string;
  projectId: string;
  imageId: string;
  annotationType: 'bbox' | 'polygon' | 'classification' | 'keypoints' | 'line' | 'polyline' | 'circle';
  geometry: AnnotationGeometry;
  classId?: string;
  className?: string;
  attributes?: Record<string, any>;
  confidence?: number;
  isAiAssisted?: boolean;
  createdBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Project {
  id: string;
  name: string;
  datasetId: string;
  taskTypes: string[];
  // REFACTORING: Task-based classes structure (legacy classes field removed)
  taskClasses: Record<string, Record<string, ClassInfo>>;  // {task_type: {class_id: ClassInfo}}
  taskConfig: Record<string, any>;
}

export interface ClassInfo {
  name: string;
  color: string;
  order?: number;
  image_count?: number;
  bbox_count?: number;
}

export type Tool = 'select' | 'bbox' | 'polygon' | 'classification' | 'keypoints' | 'line' | 'polyline' | 'circle' | 'circle3p';

export interface CanvasState {
  zoom: number; // 0.1 to 4.0
  pan: Point;
  cursor: Point;
}

export interface PanelState {
  left: boolean;
  right: boolean;
}

export interface Preferences {
  autoSave: boolean;
  snapToEdges: boolean;
  showLabels: boolean;
  showGrid: boolean;
  darkMode: boolean;
  autoSelectClass: boolean;
  imageListView: 'grid' | 'list';
}

export interface AnnotationSnapshot {
  timestamp: Date;
  annotations: Annotation[];
  action: 'create' | 'update' | 'delete' | 'move' | 'resize' | 'undo' | 'redo';
  affectedIds: string[];
}

export type SaveStatus = 'saved' | 'saving' | 'error';

// ============================================================================
// Store Interface
// ============================================================================

interface AnnotationState {
  // Project & Images
  project: Project | null;
  images: ImageData[];
  currentIndex: number;
  currentImage: ImageData | null;

  // Phase 2.9: Current task context
  currentTask: string | null;  // 'classification', 'detection', 'segmentation', etc.

  // Annotations
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  selectedVertexIndex: number | null;  // For polygon vertex editing
  selectedBboxHandle: string | null;  // For bbox handle editing ('nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w')
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

  // History (Undo/Redo)
  history: {
    past: AnnotationSnapshot[];
    future: AnnotationSnapshot[];
  };

  // Network
  saveStatus: SaveStatus;
  lastSaved: Date | null;
  loading: boolean;
  error: string | null;

  // Last selected class (for auto-select)
  lastSelectedClassId: string | null;

  // Visibility
  hiddenAnnotationIds: Set<string>;
  showAllAnnotations: boolean;

  // Multi-image selection
  selectedImageIds: string[];
  lastClickedImageIndex: number | null;

  // ========================================================================
  // Actions
  // ========================================================================

  // Project & Images
  setProject: (project: Project) => void;
  setImages: (images: ImageData[]) => void;
  setCurrentIndex: (index: number) => void;
  goToNextImage: () => void;
  goToPrevImage: () => void;
  goToImage: (index: number) => void;

  // Phase 2.9: Task switching
  setCurrentTask: (taskType: string) => void;
  switchTask: (taskType: string) => void;
  getCurrentClasses: () => Record<string, ClassInfo>;

  // Annotations
  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  clearAnnotations: () => void;

  // Canvas
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  setPan: (pan: Point) => void;
  setCursor: (cursor: Point) => void;

  // Tools
  setTool: (tool: Tool) => void;

  // Drawing State
  startDrawing: (point: Point) => void;
  updateDrawing: (point: Point) => void;
  finishDrawing: () => void;
  cancelDrawing: () => void;

  // Panels
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setLeftPanel: (open: boolean) => void;
  setRightPanel: (open: boolean) => void;

  // Preferences
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  loadPreferences: () => void;
  savePreferences: () => void;

  // History (Undo/Redo)
  recordSnapshot: (action: AnnotationSnapshot['action'], affectedIds: string[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Network
  setSaveStatus: (status: SaveStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Class Selection
  setLastSelectedClass: (classId: string | null) => void;

  // Clipboard
  copyAnnotation: (annotation: Annotation) => void;
  pasteAnnotation: () => void;

  // Visibility
  toggleAnnotationVisibility: (id: string) => void;
  toggleAllAnnotationsVisibility: () => void;
  isAnnotationVisible: (id: string) => boolean;

  // Multi-image selection
  selectImages: (ids: string[]) => void;
  toggleImageSelection: (id: string, index: number) => void;
  selectImageRange: (toIndex: number) => void;
  clearImageSelection: () => void;
  isImageSelected: (id: string) => boolean;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const DEFAULT_PREFERENCES: Preferences = {
  autoSave: true,
  snapToEdges: true,
  showLabels: true,
  showGrid: false,
  darkMode: true,
  autoSelectClass: true,
  imageListView: 'grid',
};

const initialState = {
  project: null,
  images: [],
  currentIndex: 0,
  currentImage: null,
  currentTask: null,  // Phase 2.9: Current task context
  annotations: [],
  selectedAnnotationId: null,
  selectedVertexIndex: null,
  selectedBboxHandle: null,
  clipboard: null,
  tool: 'select' as Tool,
  canvas: {
    zoom: 1.0,
    pan: { x: 0, y: 0 },
    cursor: { x: 0, y: 0 },
  },
  panels: {
    left: true,
    right: true,
  },
  isDrawing: false,
  drawingStart: null,
  isDragging: false,
  dragTarget: null,
  preferences: DEFAULT_PREFERENCES,
  history: {
    past: [],
    future: [],
  },
  saveStatus: 'saved' as SaveStatus,
  lastSaved: null,
  loading: false,
  error: null,
  lastSelectedClassId: null,
  hiddenAnnotationIds: new Set<string>(),
  showAllAnnotations: true,
  selectedImageIds: [],
  lastClickedImageIndex: null,
};

// ============================================================================
// Store
// ============================================================================

export const useAnnotationStore = create<AnnotationState>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ======================================================================
      // Project & Images
      // ======================================================================

      setProject: (project) => {
        // Phase 2.9: Set initial task to first task type
        const initialTask = project?.taskTypes?.[0] || null;
        set({ project, currentTask: initialTask });
      },

      setImages: (images) => {
        const currentImage = images.length > 0 ? images[0] : null;
        set({ images, currentImage, currentIndex: 0 });
      },

      setCurrentIndex: (index) => {
        const { images } = get();
        if (index >= 0 && index < images.length) {
          set({
            currentIndex: index,
            currentImage: images[index],
            annotations: [], // Clear annotations for new image
            selectedAnnotationId: null,
            selectedVertexIndex: null,
            selectedBboxHandle: null,
          });
        }
      },

      goToNextImage: () => {
        const { currentIndex, images } = get();
        if (currentIndex < images.length - 1) {
          get().setCurrentIndex(currentIndex + 1);
        }
      },

      goToPrevImage: () => {
        const { currentIndex } = get();
        if (currentIndex > 0) {
          get().setCurrentIndex(currentIndex - 1);
        }
      },

      goToImage: (index) => {
        get().setCurrentIndex(index);
      },

      // ======================================================================
      // Phase 2.9: Task Switching
      // ======================================================================

      setCurrentTask: (taskType) => {
        set({ currentTask: taskType });
      },

      /**
       * Switch to a different task type.
       * This resets the entire annotation context:
       * - Clears current annotations
       * - Resets tool to select
       * - Clears selection
       * - Resets canvas zoom/pan
       * - Clears undo/redo history
       */
      switchTask: (taskType) => {
        const { project } = get();

        // Validate task exists in project
        if (!project?.taskTypes?.includes(taskType)) {
          console.error(`Task type "${taskType}" not found in project`);
          return;
        }

        // Reset annotation context for new task
        set({
          currentTask: taskType,
          annotations: [],
          selectedAnnotationId: null,
          selectedVertexIndex: null,
          selectedBboxHandle: null,
          tool: 'select',
          canvas: {
            zoom: 1.0,
            pan: { x: 0, y: 0 },
            cursor: { x: 0, y: 0 },
          },
          history: {
            past: [],
            future: [],
          },
          lastSelectedClassId: null,
          hiddenAnnotationIds: new Set(),
          showAllAnnotations: true,
        });

        console.log(`Switched to task: ${taskType}`);
      },

      /**
       * Get classes for the current task.
       * Returns empty object if no task is selected or project has no task_classes.
       *
       * REFACTORED: No legacy fallback - taskClasses only.
       */
      getCurrentClasses: () => {
        const { project, currentTask } = get();

        if (!project || !currentTask) {
          return {};
        }

        // Return current task's classes or empty object if not configured
        return project.taskClasses?.[currentTask] || {};
      },

      // ======================================================================
      // Annotations
      // ======================================================================

      setAnnotations: (annotations) => set({ annotations }),

      addAnnotation: (annotation) => {
        const { annotations, preferences, lastSelectedClassId } = get();

        // Auto-select class if enabled
        if (preferences.autoSelectClass && !annotation.classId && lastSelectedClassId) {
          annotation.classId = lastSelectedClassId;
        }

        set({ annotations: [...annotations, annotation] });

        // Record for undo
        get().recordSnapshot('create', [annotation.id]);

        // Update last selected class
        if (annotation.classId) {
          set({ lastSelectedClassId: annotation.classId });
        }
      },

      updateAnnotation: (id, updates) => {
        const { annotations } = get();
        const updatedAnnotations = annotations.map((ann) =>
          ann.id === id ? { ...ann, ...updates } : ann
        );
        set({ annotations: updatedAnnotations });
        get().recordSnapshot('update', [id]);
      },

      deleteAnnotation: (id) => {
        const { annotations } = get();
        const filtered = annotations.filter((ann) => ann.id !== id);
        set({ annotations: filtered, selectedAnnotationId: null });
        get().recordSnapshot('delete', [id]);
      },

      selectAnnotation: (id) => set({ selectedAnnotationId: id }),

      clearAnnotations: () => {
        const { annotations } = get();
        const ids = annotations.map((a) => a.id);
        set({ annotations: [], selectedAnnotationId: null });
        get().recordSnapshot('delete', ids);
      },

      // ======================================================================
      // Canvas
      // ======================================================================

      setZoom: (zoom) => {
        const clampedZoom = Math.max(0.1, Math.min(4.0, zoom));
        set((state) => ({
          canvas: { ...state.canvas, zoom: clampedZoom },
        }));
      },

      zoomIn: () => {
        const { canvas } = get();
        get().setZoom(canvas.zoom + 0.25);
      },

      zoomOut: () => {
        const { canvas } = get();
        get().setZoom(canvas.zoom - 0.25);
      },

      fitToScreen: () => {
        get().setZoom(1.0);
        set((state) => ({
          canvas: { ...state.canvas, pan: { x: 0, y: 0 } },
        }));
      },

      setPan: (pan) => {
        set((state) => ({
          canvas: { ...state.canvas, pan },
        }));
      },

      setCursor: (cursor) => {
        set((state) => ({
          canvas: { ...state.canvas, cursor },
        }));
      },

      // ======================================================================
      // Tools
      // ======================================================================

      setTool: (tool) => set({ tool }),

      // ======================================================================
      // Drawing State
      // ======================================================================

      startDrawing: (point) => {
        set({
          isDrawing: true,
          drawingStart: point,
        });
      },

      updateDrawing: (point) => {
        // Update cursor position for preview
        get().setCursor(point);
      },

      finishDrawing: () => {
        set({
          isDrawing: false,
          drawingStart: null,
        });
      },

      cancelDrawing: () => {
        set({
          isDrawing: false,
          drawingStart: null,
        });
      },

      // ======================================================================
      // Panels
      // ======================================================================

      toggleLeftPanel: () => {
        set((state) => ({
          panels: { ...state.panels, left: !state.panels.left },
        }));
      },

      toggleRightPanel: () => {
        set((state) => ({
          panels: { ...state.panels, right: !state.panels.right },
        }));
      },

      setLeftPanel: (open) => {
        set((state) => ({
          panels: { ...state.panels, left: open },
        }));
      },

      setRightPanel: (open) => {
        set((state) => ({
          panels: { ...state.panels, right: open },
        }));
      },

      // ======================================================================
      // Preferences
      // ======================================================================

      setPreference: (key, value) => {
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        }));
        get().savePreferences();
      },

      loadPreferences: () => {
        try {
          const saved = localStorage.getItem('annotation-preferences');
          if (saved) {
            const preferences = JSON.parse(saved);
            set({ preferences: { ...DEFAULT_PREFERENCES, ...preferences } });
          }
        } catch (err) {
          console.error('Failed to load preferences:', err);
        }
      },

      savePreferences: () => {
        try {
          const { preferences } = get();
          localStorage.setItem('annotation-preferences', JSON.stringify(preferences));
        } catch (err) {
          console.error('Failed to save preferences:', err);
        }
      },

      // ======================================================================
      // History (Undo/Redo)
      // ======================================================================

      recordSnapshot: (action, affectedIds) => {
        const { annotations, history } = get();
        const snapshot: AnnotationSnapshot = {
          timestamp: new Date(),
          annotations: JSON.parse(JSON.stringify(annotations)),
          action,
          affectedIds,
        };

        const newPast = [...history.past, snapshot].slice(-50); // Keep last 50
        set({
          history: {
            past: newPast,
            future: [], // Clear redo stack
          },
        });
      },

      undo: () => {
        const { history, annotations } = get();
        if (history.past.length === 0) return;

        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, -1);

        const currentSnapshot: AnnotationSnapshot = {
          timestamp: new Date(),
          annotations: JSON.parse(JSON.stringify(annotations)),
          action: 'undo',
          affectedIds: [],
        };

        set({
          annotations: previous.annotations,
          history: {
            past: newPast,
            future: [currentSnapshot, ...history.future],
          },
        });
      },

      redo: () => {
        const { history, annotations } = get();
        if (history.future.length === 0) return;

        const next = history.future[0];
        const newFuture = history.future.slice(1);

        const currentSnapshot: AnnotationSnapshot = {
          timestamp: new Date(),
          annotations: JSON.parse(JSON.stringify(annotations)),
          action: 'redo',
          affectedIds: [],
        };

        set({
          annotations: next.annotations,
          history: {
            past: [...history.past, currentSnapshot],
            future: newFuture,
          },
        });
      },

      canUndo: () => get().history.past.length > 0,
      canRedo: () => get().history.future.length > 0,

      // ======================================================================
      // Network
      // ======================================================================

      setSaveStatus: (status) => {
        set({ saveStatus: status });
        if (status === 'saved') {
          set({ lastSaved: new Date() });
        }
      },

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

      // ======================================================================
      // Class Selection
      // ======================================================================

      setLastSelectedClass: (classId) => set({ lastSelectedClassId: classId }),

      // ======================================================================
      // Clipboard
      // ======================================================================

      copyAnnotation: (annotation) => {
        set({ clipboard: JSON.parse(JSON.stringify(annotation)) });
      },

      pasteAnnotation: async () => {
        const { clipboard, currentImage, project } = get();
        if (!clipboard || !currentImage || !project) return;

        // Create new annotation with offset
        const newGeometry = JSON.parse(JSON.stringify(clipboard.geometry));
        const offset = 20;

        // Offset based on annotation type
        if (newGeometry.type === 'bbox') {
          const [x, y, w, h] = newGeometry.bbox;
          newGeometry.bbox = [x + offset, y + offset, w, h];
        } else if (newGeometry.type === 'polygon') {
          newGeometry.points = newGeometry.points.map(([px, py]: [number, number]) => [
            px + offset,
            py + offset,
          ]);
        }

        // Create annotation via API
        try {
          const { createAnnotation } = await import('@/lib/api/annotations');
          const response = await createAnnotation({
            project_id: project.id,
            image_id: currentImage.id,
            annotation_type: clipboard.annotationType,
            class_id: clipboard.classId,
            class_name: clipboard.className,
            geometry: newGeometry,
          });

          // Add to local store with the ID from backend
          const newAnnotation: Annotation = {
            id: response.id,
            imageId: currentImage.id,
            annotationType: clipboard.annotationType,
            classId: clipboard.classId,
            className: clipboard.className,
            geometry: newGeometry,
            createdAt: new Date(),
          };

          const { annotations } = get();
          set({
            annotations: [...annotations, newAnnotation],
            selectedAnnotationId: newAnnotation.id,
          });

          // Record for undo
          get().recordSnapshot('create', [newAnnotation.id]);

        } catch (error) {
          console.error('Failed to paste annotation:', error);
        }
      },

      // ======================================================================
      // Visibility
      // ======================================================================

      toggleAnnotationVisibility: (id) => {
        const { hiddenAnnotationIds } = get();
        const newHidden = new Set(hiddenAnnotationIds);
        if (newHidden.has(id)) {
          newHidden.delete(id);
        } else {
          newHidden.add(id);
        }
        set({ hiddenAnnotationIds: newHidden });
      },

      toggleAllAnnotationsVisibility: () => {
        const { showAllAnnotations } = get();
        set({ showAllAnnotations: !showAllAnnotations, hiddenAnnotationIds: new Set() });
      },

      isAnnotationVisible: (id) => {
        const { hiddenAnnotationIds, showAllAnnotations } = get();
        if (!showAllAnnotations) return false;
        return !hiddenAnnotationIds.has(id);
      },

      // ======================================================================
      // Multi-image Selection
      // ======================================================================

      selectImages: (ids) => {
        set({ selectedImageIds: ids });
      },

      toggleImageSelection: (id, index) => {
        const { selectedImageIds } = get();
        const isSelected = selectedImageIds.includes(id);

        if (isSelected) {
          set({
            selectedImageIds: selectedImageIds.filter(i => i !== id),
            lastClickedImageIndex: index,
          });
        } else {
          set({
            selectedImageIds: [...selectedImageIds, id],
            lastClickedImageIndex: index,
          });
        }
      },

      selectImageRange: (toIndex) => {
        const { images, lastClickedImageIndex, currentIndex } = get();
        // Use lastClickedImageIndex if set, otherwise use currentIndex
        const fromIndex = lastClickedImageIndex ?? currentIndex;

        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);

        const rangeIds = images
          .slice(start, end + 1)
          .map(img => img.id);

        // Replace selection with range (not merge)
        set({
          selectedImageIds: rangeIds,
          lastClickedImageIndex: toIndex,
        });
      },

      clearImageSelection: () => {
        set({ selectedImageIds: [], lastClickedImageIndex: null });
      },

      isImageSelected: (id) => {
        const { selectedImageIds } = get();
        return selectedImageIds.includes(id);
      },

      // ======================================================================
      // Reset
      // ======================================================================

      reset: () => set(initialState),
    }),
    { name: 'AnnotationStore' }
  )
);
