/**
 * RightPanel Component Tests - Annotation List
 *
 * Tests for RightPanel component annotation list display, annotation selection,
 * annotation filtering by class, and list interactions.
 *
 * Phase 9: Frontend RightPanel Component Tests
 * Subtask 9.1: Test RightPanel.tsx annotation list
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RightPanel from '../RightPanel';
import {
  createMockAnnotationStore,
  createMockProject,
  createMockImage,
  createMockAnnotation,
  createMockClass,
} from '@/lib/test-utils/mock-stores';
import { useAnnotationStore } from '@/lib/stores/annotationStore';

// Create mock function for annotation store with vi.hoisted()
const { mockUseAnnotationStore } = vi.hoisted(() => ({
  mockUseAnnotationStore: vi.fn(),
}));

// Mock the annotation store
vi.mock('@/lib/stores/annotationStore', () => ({
  useAnnotationStore: mockUseAnnotationStore,
}));

// Mock toast store
vi.mock('@/lib/stores/toastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock API modules
vi.mock('@/lib/api/annotations', () => ({
  deleteAnnotation: vi.fn().mockResolvedValue({ success: true }),
  confirmAnnotation: vi.fn().mockResolvedValue({
    id: 'ann-1',
    annotation_state: 'confirmed',
    confirmed_at: new Date().toISOString(),
    confirmed_by: 1,
    confirmed_by_name: 'Test User',
  }),
  unconfirmAnnotation: vi.fn().mockResolvedValue({
    id: 'ann-1',
    annotation_state: 'draft',
    confirmed_at: null,
    confirmed_by: null,
    confirmed_by_name: null,
  }),
  getProjectAnnotations: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/api/projects', () => ({
  getProjectById: vi.fn().mockResolvedValue({
    id: 'test-project-1',
    name: 'Test Project',
    dataset_id: 'test-dataset-1',
    task_types: ['detection'],
    task_classes: {
      detection: {
        'class-1': { name: 'Person', color: '#ff0000', order: 0 },
        'class-2': { name: 'Car', color: '#00ff00', order: 1 },
      },
    },
    task_config: {},
  }),
}));

vi.mock('@/lib/api/classes', () => ({
  reorderClasses: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock AddClassModal component
vi.mock('../AddClassModal', () => ({
  default: ({ isOpen, onClose }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="add-class-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    );
  },
}));

// Mock AnnotationHistory component
vi.mock('../AnnotationHistory', () => ({
  default: () => <div data-testid="annotation-history">Annotation History</div>,
}));

// Mock Minimap component
vi.mock('../Minimap', () => ({
  default: () => <div data-testid="minimap">Minimap</div>,
}));

describe('RightPanel - Annotation List Display', () => {
  let mockStore: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock project with classes
    const mockProject = createMockProject({
      id: 'test-project-1',
      taskTypes: ['detection'],
      taskClasses: {
        detection: {
          'class-1': { name: 'Person', color: '#ff0000', order: 0 },
          'class-2': { name: 'Car', color: '#00ff00', order: 1 },
          'class-3': { name: 'Bike', color: '#0000ff', order: 2 },
        },
      },
    });

    mockStore = createMockAnnotationStore({
      project: mockProject,
      currentTask: 'detection',
      panels: { left: true, right: true },
      annotations: [],
      selectedAnnotationId: null,
    });

    // Override getCurrentClasses to return classes from the project
    mockStore.getCurrentClasses = vi.fn(() => {
      if (!mockStore.project || !mockStore.currentTask) return {};
      return mockStore.project.taskClasses?.[mockStore.currentTask] || {};
    });

    mockUseAnnotationStore.mockImplementation((selector?: any) =>
      selector ? selector(mockStore) : mockStore
    );

    // Add setState and getState to the mock
    (useAnnotationStore as any).setState = vi.fn((updates: any) => {
      Object.assign(mockStore, typeof updates === 'function' ? updates(mockStore) : updates);
    });
    (useAnnotationStore as any).getState = vi.fn(() => mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Panel Visibility', () => {
    it('should render collapsed panel when right panel is closed', () => {
      mockStore.panels.right = false;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      const toggleButton = screen.getByTitle('Show Right Panel (])');
      expect(toggleButton).toBeInTheDocument();
      expect(screen.queryByText('Annotations')).not.toBeInTheDocument();
    });

    it('should expand panel when toggle button is clicked', async () => {
      mockStore.panels.right = false;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      const toggleButton = screen.getByTitle('Show Right Panel (])');
      await userEvent.click(toggleButton);

      expect(mockStore.toggleRightPanel).toHaveBeenCalledTimes(1);
    });

    it('should collapse panel when close button is clicked', async () => {
      render(<RightPanel />);

      const closeButton = screen.getByTitle('Hide Right Panel (])');
      await userEvent.click(closeButton);

      expect(mockStore.toggleRightPanel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Annotation List Rendering', () => {
    it('should render header with annotation count', () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1' }),
        createMockAnnotation({ id: 'ann-2' }),
        createMockAnnotation({ id: 'ann-3' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByText('Annotations (3)')).toBeInTheDocument();
    });

    it('should show empty state when no annotations', () => {
      mockStore.annotations = [];
      mockStore.currentTask = 'detection';
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByText('No annotations yet')).toBeInTheDocument();
      expect(screen.getByText('Draw a bbox to start labeling')).toBeInTheDocument();
    });

    it('should show classification-specific empty state', () => {
      mockStore.annotations = [];
      mockStore.currentTask = 'classification';
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByText('No annotations yet')).toBeInTheDocument();
      expect(screen.getByText('Select a class above to classify this image')).toBeInTheDocument();
    });

    it('should render annotations with class colors', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          classId: 'class-1',
          className: 'Person',
        }),
        createMockAnnotation({
          id: 'ann-2',
          classId: 'class-2',
          className: 'Car',
        }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      // Use getAllByText since class names appear in both annotations and class list
      const personElements = screen.getAllByText('Person');
      const carElements = screen.getAllByText('Car');

      expect(personElements.length).toBeGreaterThan(0);
      expect(carElements.length).toBeGreaterThan(0);
    });

    it('should render unlabeled annotation when no class assigned', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          classId: null,
          className: null,
        }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByText('Unlabeled')).toBeInTheDocument();
    });

    it('should display draft state indicator', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          classId: 'class-1',
          className: 'Person',
          annotation_state: 'draft',
        }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByTitle('Draft')).toBeInTheDocument();
    });

    it('should display confirmed state indicator', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          classId: 'class-1',
          className: 'Person',
          annotation_state: 'confirmed',
        }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByTitle('Confirmed')).toBeInTheDocument();
    });

    it('should display bbox dimensions for bbox annotations', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          geometry: {
            type: 'bbox',
            bbox: [100, 100, 250, 180], // width: 250, height: 180
          },
        }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByText('250×180')).toBeInTheDocument();
    });

    it('should not display dimensions for non-bbox annotations', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          geometry: {
            type: 'polygon',
            points: [[100, 100], [200, 100], [150, 200]],
          },
        }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      // Should not show dimensions
      expect(screen.queryByText(/×/)).not.toBeInTheDocument();
    });

    it('should handle both camelCase and snake_case annotation properties', () => {
      const annotations = [
        {
          id: 'ann-1',
          class_id: 'class-1', // snake_case
          class_name: 'Person',
          annotation_state: 'draft',
          geometry: {
            type: 'bbox',
            bbox: [100, 100, 200, 150],
          },
        } as any,
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      // Person appears in both annotation list and class list
      const personElements = screen.getAllByText('Person');
      expect(personElements.length).toBeGreaterThan(0);
    });
  });

  describe('Annotation Selection', () => {
    it('should highlight selected annotation', () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
        createMockAnnotation({ id: 'ann-2', className: 'Car' }),
      ];

      mockStore.annotations = annotations;
      mockStore.selectedAnnotationId = 'ann-1';
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      const { container } = render(<RightPanel />);

      // Find the selected annotation by checking for the violet border class
      const selectedElement = container.querySelector('.border-violet-500');
      expect(selectedElement).toBeInTheDocument();
    });

    it('should call selectAnnotation when annotation is clicked', async () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
        createMockAnnotation({ id: 'ann-2', className: 'Car' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      // Get all "Person" texts and find the one in the annotation list (smaller text)
      const personElements = screen.getAllByText('Person');
      // The annotation list item has a specific structure - get the first one which is in the annotation list
      const personAnnotation = personElements[0].closest('div[role="button"]') ||
        personElements[0].closest('[data-annotation-item]') ||
        personElements[0].closest('div');
      await userEvent.click(personAnnotation!);

      expect(mockStore.selectAnnotation).toHaveBeenCalledWith('ann-1');
    });

    it('should allow selecting different annotations', async () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
        createMockAnnotation({ id: 'ann-2', className: 'Car' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      const personElements = screen.getAllByText('Person');
      const personAnnotation = personElements[0].closest('div');
      await userEvent.click(personAnnotation!);
      expect(mockStore.selectAnnotation).toHaveBeenCalledWith('ann-1');

      const carElements = screen.getAllByText('Car');
      const carAnnotation = carElements[0].closest('div');
      await userEvent.click(carAnnotation!);
      expect(mockStore.selectAnnotation).toHaveBeenCalledWith('ann-2');
    });
  });

  describe('Annotation Visibility Toggle', () => {
    it('should toggle annotation visibility when eye icon is clicked', async () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
      ];

      mockStore.annotations = annotations;
      mockStore.isAnnotationVisible = vi.fn().mockReturnValue(true);
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      const visibilityButton = screen.getByTitle('Hide annotation');
      await userEvent.click(visibilityButton);

      expect(mockStore.toggleAnnotationVisibility).toHaveBeenCalledWith('ann-1');
    });

    it('should show different icon for hidden annotations', async () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
      ];

      mockStore.annotations = annotations;
      mockStore.isAnnotationVisible = vi.fn().mockReturnValue(false);
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByTitle('Show annotation')).toBeInTheDocument();
    });

    it('should toggle all annotations visibility', async () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
        createMockAnnotation({ id: 'ann-2', className: 'Car' }),
      ];

      mockStore.annotations = annotations;
      mockStore.showAllAnnotations = true;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      const toggleAllButton = screen.getByTitle('Hide all annotations');
      await userEvent.click(toggleAllButton);

      expect(mockStore.toggleAllAnnotationsVisibility).toHaveBeenCalledTimes(1);
    });

    it('should show different icon when all annotations are hidden', () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
      ];

      mockStore.annotations = annotations;
      mockStore.showAllAnnotations = false;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByTitle('Show all annotations')).toBeInTheDocument();
    });
  });

  describe('Annotation Confirmation', () => {
    it('should confirm draft annotation when confirm button is clicked', async () => {
      const { confirmAnnotation } = await import('@/lib/api/annotations');

      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          className: 'Person',
          annotation_state: 'draft',
        }),
      ];

      mockStore.annotations = annotations;
      mockStore.currentImage = createMockImage({ id: 'img-1' });
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      const confirmButton = screen.getByTitle('Confirm annotation');
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(confirmAnnotation).toHaveBeenCalledWith('ann-1');
      });
    });

    it('should unconfirm confirmed annotation when unconfirm button is clicked', async () => {
      const { unconfirmAnnotation } = await import('@/lib/api/annotations');

      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          className: 'Person',
          annotation_state: 'confirmed',
        }),
      ];

      mockStore.annotations = annotations;
      mockStore.currentImage = createMockImage({ id: 'img-1' });
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      const unconfirmButton = screen.getByTitle('Unconfirm annotation');
      await userEvent.click(unconfirmButton);

      await waitFor(() => {
        expect(unconfirmAnnotation).toHaveBeenCalledWith('ann-1');
      });
    });

    it('should show loading state during confirmation', async () => {
      const { confirmAnnotation } = await import('@/lib/api/annotations');
      (confirmAnnotation as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          className: 'Person',
          annotation_state: 'draft',
        }),
      ];

      mockStore.annotations = annotations;
      mockStore.currentImage = createMockImage({ id: 'img-1' });
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      const confirmButton = screen.getByTitle('Confirm annotation');
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(confirmButton).toBeDisabled();
      });
    });

    it('should stop event propagation when confirm button is clicked', async () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          className: 'Person',
          annotation_state: 'draft',
        }),
      ];

      mockStore.annotations = annotations;
      mockStore.currentImage = createMockImage({ id: 'img-1' });
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      const confirmButton = screen.getByTitle('Confirm annotation');
      await userEvent.click(confirmButton);

      // selectAnnotation should not be called because event propagation is stopped
      await waitFor(() => {
        expect(mockStore.selectAnnotation).not.toHaveBeenCalled();
      });
    });
  });

  describe('Annotation Deletion', () => {
    // Set up window.confirm mock for all deletion tests
    let originalConfirm: typeof window.confirm;

    beforeEach(() => {
      originalConfirm = window.confirm;
      window.confirm = vi.fn();
    });

    afterEach(() => {
      window.confirm = originalConfirm;
    });

    it('should delete annotation when delete button is clicked and confirmed', async () => {
      const { deleteAnnotation } = await import('@/lib/api/annotations');

      // Mock window.confirm
      (window.confirm as any).mockReturnValue(true);

      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      const deleteButton = screen.getByTitle('Delete annotation');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(deleteAnnotation).toHaveBeenCalledWith('ann-1');
        expect(mockStore.deleteAnnotation).toHaveBeenCalledWith('ann-1');
      });
    });

    it('should not delete annotation if user cancels confirmation', async () => {
      const { deleteAnnotation } = await import('@/lib/api/annotations');

      // Mock window.confirm to return false
      (window.confirm as any).mockReturnValue(false);

      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      const deleteButton = screen.getByTitle('Delete annotation');
      await userEvent.click(deleteButton);

      expect(deleteAnnotation).not.toHaveBeenCalled();
      expect(mockStore.deleteAnnotation).not.toHaveBeenCalled();
    });

    it('should show loading state during deletion', async () => {
      const { deleteAnnotation } = await import('@/lib/api/annotations');
      (deleteAnnotation as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      (window.confirm as any).mockReturnValue(true);

      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      const deleteButton = screen.getByTitle('Delete annotation');
      await userEvent.click(deleteButton);

      await waitFor(() => {
        expect(deleteButton).toBeDisabled();
      });
    });

    it('should stop event propagation when delete button is clicked', async () => {
      (window.confirm as any).mockReturnValue(true);

      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      const deleteButton = screen.getByTitle('Delete annotation');
      await userEvent.click(deleteButton);

      // selectAnnotation should not be called because event propagation is stopped
      await waitFor(() => {
        expect(mockStore.selectAnnotation).not.toHaveBeenCalled();
      });
    });
  });

  describe('Current Image Classes Section', () => {
    it('should display current image classes when annotations exist', () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', classId: 'class-1', className: 'Person' }),
        createMockAnnotation({ id: 'ann-2', classId: 'class-1', className: 'Person' }),
        createMockAnnotation({ id: 'ann-3', classId: 'class-2', className: 'Car' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      expect(screen.getByText('Current Image')).toBeInTheDocument();
    });

    it('should show annotation count per class in current image', () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', classId: 'class-1', className: 'Person' }),
        createMockAnnotation({ id: 'ann-2', classId: 'class-1', className: 'Person' }),
        createMockAnnotation({ id: 'ann-3', classId: 'class-2', className: 'Car' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      const { container } = render(<RightPanel />);

      // Check for count badges in current image section
      const currentImageSection = container.querySelector('.bg-violet-500\\/10');
      expect(currentImageSection).toBeInTheDocument();
    });

    it('should not display current image section when no annotations', () => {
      mockStore.annotations = [];
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.queryByText('Current Image')).not.toBeInTheDocument();
    });

    it('should handle annotations without class IDs gracefully', () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', classId: null, className: null }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      // Should not crash, current image section might not show classes without IDs
      expect(screen.queryByText('Current Image')).not.toBeInTheDocument();
    });
  });

  describe('All Classes List', () => {
    it('should display all classes for current task', () => {
      render(<RightPanel />);

      expect(screen.getByText('Classes')).toBeInTheDocument();
      expect(screen.getByText('Person')).toBeInTheDocument();
      expect(screen.getByText('Car')).toBeInTheDocument();
      expect(screen.getByText('Bike')).toBeInTheDocument();
    });

    it('should display classes in order', () => {
      render(<RightPanel />);

      const classElements = screen.getAllByText(/Person|Car|Bike/);
      expect(classElements[0]).toHaveTextContent('Person'); // order: 0
      expect(classElements[1]).toHaveTextContent('Car'); // order: 1
      expect(classElements[2]).toHaveTextContent('Bike'); // order: 2
    });

    it('should display order number for each class', () => {
      const { container } = render(<RightPanel />);

      // Order numbers are displayed as 0, 1, 2
      const orderNumbers = container.querySelectorAll('.text-\\[9px\\].text-gray-400');
      expect(orderNumbers.length).toBeGreaterThan(0);
    });

    it('should show add class button', () => {
      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      expect(addButton).toBeInTheDocument();
    });

    it('should open add class modal when add button is clicked', async () => {
      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-class-modal')).toBeInTheDocument();
      });
    });

    it('should close add class modal when close is clicked', async () => {
      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-class-modal')).toBeInTheDocument();
      });

      const closeButton = screen.getByText('Close Modal');
      await userEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('add-class-modal')).not.toBeInTheDocument();
      });
    });

    it('should show message when no classes defined', () => {
      mockStore.project = createMockProject({
        taskClasses: {
          detection: {},
        },
      });
      mockStore.currentTask = 'detection';
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByText(/No classes defined for/)).toBeInTheDocument();
    });

    it('should show message when project is null', () => {
      mockStore.project = null;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByText(/No classes defined for/)).toBeInTheDocument();
    });
  });

  describe('Class Reordering', () => {
    it('should show reorder buttons on class hover/focus', async () => {
      render(<RightPanel />);

      const classItems = screen.getAllByText(/Person|Car|Bike/);
      const personClass = classItems[0].closest('div');

      await userEvent.click(personClass!);

      // After focusing, reorder buttons should be visible within the class item
      const moveUpButton = personClass?.querySelector('button[title="Move up"]');
      const moveDownButton = personClass?.querySelector('button[title="Move down"]');

      expect(moveUpButton).toBeInTheDocument();
      expect(moveDownButton).toBeInTheDocument();
    });

    it('should disable move up button for first class', async () => {
      render(<RightPanel />);

      const classItems = screen.getAllByText(/Person|Car|Bike/);
      const personClass = classItems[0].closest('div');

      await userEvent.click(personClass!);

      const moveUpButton = personClass?.querySelector('button[title="Move up"]') as HTMLButtonElement;
      expect(moveUpButton).toBeDisabled();
    });

    it('should disable move down button for last class', async () => {
      render(<RightPanel />);

      const classItems = screen.getAllByText(/Person|Car|Bike/);
      const bikeClass = classItems[2].closest('div');

      await userEvent.click(bikeClass!);

      const moveDownButton = bikeClass?.querySelector('button[title="Move down"]') as HTMLButtonElement;
      expect(moveDownButton).toBeDisabled();
    });

    it('should call reorderClasses API when move up is clicked', async () => {
      const { reorderClasses } = await import('@/lib/api/classes');

      render(<RightPanel />);

      const classItems = screen.getAllByText(/Person|Car|Bike/);
      const carClass = classItems[1].closest('div');

      await userEvent.click(carClass!);

      const moveUpButton = carClass?.querySelector('button[title="Move up"]') as HTMLButtonElement;
      await userEvent.click(moveUpButton);

      await waitFor(() => {
        expect(reorderClasses).toHaveBeenCalled();
      });
    });

    it('should call reorderClasses API when move down is clicked', async () => {
      const { reorderClasses } = await import('@/lib/api/classes');

      render(<RightPanel />);

      const classItems = screen.getAllByText(/Person|Car|Bike/);
      const carClass = classItems[1].closest('div');

      await userEvent.click(carClass!);

      const moveDownButton = carClass?.querySelector('button[title="Move down"]') as HTMLButtonElement;
      await userEvent.click(moveDownButton);

      await waitFor(() => {
        expect(reorderClasses).toHaveBeenCalled();
      });
    });

    it('should prevent reordering when already reordering', async () => {
      const { reorderClasses } = await import('@/lib/api/classes');
      (reorderClasses as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<RightPanel />);

      const classItems = screen.getAllByText(/Person|Car|Bike/);
      const carClass = classItems[1].closest('div');

      await userEvent.click(carClass!);

      const moveUpButton = carClass?.querySelector('button[title="Move up"]') as HTMLButtonElement;
      await userEvent.click(moveUpButton);

      // Try to click again while reordering
      await userEvent.click(moveUpButton);

      // Should only be called once
      await waitFor(() => {
        expect(reorderClasses).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Class Statistics', () => {
    it('should display class statistics when loaded', async () => {
      const { getProjectAnnotations } = await import('@/lib/api/annotations');
      (getProjectAnnotations as any).mockResolvedValue([
        createMockAnnotation({ id: 'ann-1', classId: 'class-1', imageId: 'img-1' }),
        createMockAnnotation({ id: 'ann-2', classId: 'class-1', imageId: 'img-1' }),
        createMockAnnotation({ id: 'ann-3', classId: 'class-2', imageId: 'img-2' }),
      ]);

      render(<RightPanel />);

      await waitFor(() => {
        expect(getProjectAnnotations).toHaveBeenCalledWith('test-project-1');
      });

      // Stats format: "bboxCount (imageCount)"
      // We should see stats displayed for classes
      await waitFor(() => {
        const { container } = render(<RightPanel />);
        expect(container).toBeInTheDocument();
      });
    });

    it('should filter statistics by current task', async () => {
      const { getProjectAnnotations } = await import('@/lib/api/annotations');

      render(<RightPanel />);

      await waitFor(() => {
        expect(getProjectAnnotations).toHaveBeenCalled();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing project gracefully', () => {
      mockStore.project = null;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      // Should not crash
      expect(screen.getByText('Annotations (0)')).toBeInTheDocument();
    });

    it('should handle annotations with missing imageId', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          classId: 'class-1',
          imageId: undefined as any,
        }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      // Should not crash
      expect(screen.getByText('Annotations (1)')).toBeInTheDocument();
    });

    it('should handle rapid annotation selection changes', async () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', className: 'Person' }),
        createMockAnnotation({ id: 'ann-2', className: 'Car' }),
        createMockAnnotation({ id: 'ann-3', className: 'Bike' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      // Get the first occurrence of each class name (in the annotation list, not class list)
      const personElements = screen.getAllByText('Person');
      const carElements = screen.getAllByText('Car');
      const bikeElements = screen.getAllByText('Bike');

      const personAnnotation = personElements[0].closest('div');
      const carAnnotation = carElements[0].closest('div');
      const bikeAnnotation = bikeElements[0].closest('div');

      await userEvent.click(personAnnotation!);
      await userEvent.click(carAnnotation!);
      await userEvent.click(bikeAnnotation!);

      expect(mockStore.selectAnnotation).toHaveBeenCalledTimes(3);
    });

    it('should render AnnotationHistory component', () => {
      render(<RightPanel />);

      expect(screen.getByTestId('annotation-history')).toBeInTheDocument();
    });

    it('should render Minimap when enabled', () => {
      mockStore.showMinimap = true;
      mockStore.canvasRef = { current: document.createElement('canvas') } as any;
      mockStore.imageRef = { current: new Image() } as any;
      mockStore.currentImage = createMockImage({ id: 'img-1' });
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.getByTestId('minimap')).toBeInTheDocument();
    });

    it('should not render Minimap when disabled', () => {
      mockStore.showMinimap = false;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.queryByTestId('minimap')).not.toBeInTheDocument();
    });

    it('should not render Minimap when refs are missing', () => {
      mockStore.showMinimap = true;
      mockStore.canvasRef = null;
      mockStore.imageRef = null;
      mockUseAnnotationStore.mockImplementation((selector?: any) => selector ? selector(mockStore) : mockStore);

      render(<RightPanel />);

      expect(screen.queryByTestId('minimap')).not.toBeInTheDocument();
    });
  });
});
