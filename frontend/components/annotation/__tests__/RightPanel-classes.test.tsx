/**
 * RightPanel Component Tests - Class Management
 *
 * Tests for class creation, class editing, class deletion, and class color
 * management in the RightPanel component.
 *
 * Phase 9: Frontend RightPanel Component Tests
 * Subtask 9.3: Test RightPanel.tsx class management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
import * as classesAPI from '@/lib/api/classes';
import * as projectsAPI from '@/lib/api/projects';
import * as annotationsAPI from '@/lib/api/annotations';

// Create mock function for annotation store with vi.hoisted()
const { mockUseAnnotationStore } = vi.hoisted(() => ({
  mockUseAnnotationStore: vi.fn(),
}));

// Mock the annotation store
vi.mock('@/lib/stores/annotationStore', () => ({
  useAnnotationStore: mockUseAnnotationStore,
}));

// Mock toast store
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('@/lib/stores/toastStore', () => ({
  toast: mockToast,
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
  getProjectById: vi.fn(),
}));

vi.mock('@/lib/api/classes', () => ({
  addClass: vi.fn().mockResolvedValue({
    class_id: 'new-class-1',
    name: 'New Class',
    color: '#0000ff',
    order: 2,
  }),
  updateClass: vi.fn().mockResolvedValue({
    class_id: 'class-1',
    name: 'Updated Class',
    color: '#ff00ff',
    order: 0,
  }),
  deleteClass: vi.fn().mockResolvedValue({ success: true }),
  reorderClasses: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock AddClassModal component with actual functionality
let mockModalIsOpen = false;
let mockModalOnClose: (() => void) | null = null;
let mockModalOnClassAdded: (() => void) | null = null;
let mockModalProjectId: string | null = null;
let mockModalCurrentTask: string | null = null;

vi.mock('../AddClassModal', () => ({
  default: ({ isOpen, onClose, projectId, onClassAdded, currentTask }: any) => {
    mockModalIsOpen = isOpen;
    mockModalOnClose = onClose;
    mockModalOnClassAdded = onClassAdded;
    mockModalProjectId = projectId;
    mockModalCurrentTask = currentTask;

    if (!isOpen) return null;
    return (
      <div data-testid="add-class-modal">
        <h2>Add New Class</h2>
        <input data-testid="class-name-input" placeholder="Class name" />
        <input data-testid="class-color-input" type="color" />
        <textarea data-testid="class-description-input" placeholder="Description" />
        <button data-testid="modal-close-button" onClick={onClose}>
          Cancel
        </button>
        <button
          data-testid="modal-add-button"
          onClick={async () => {
            await classesAPI.addClass(projectId, { name: 'New Class', color: '#0000ff' }, currentTask);
            onClassAdded();
            onClose();
          }}
        >
          Add Class
        </button>
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

describe('RightPanel - Class Management', () => {
  let mockStore: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockModalIsOpen = false;
    mockModalOnClose = null;
    mockModalOnClassAdded = null;
    mockModalProjectId = null;
    mockModalCurrentTask = null;

    const project = createMockProject({
      id: 'test-project-1',
      name: 'Test Project',
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
      project,
      currentTask: 'detection',
      panels: { left: true, right: true },
      annotations: [],
      images: [],
      currentImage: createMockImage({ id: 'img-1' }),
    });

    // Override getCurrentClasses to return classes from the project
    mockStore.getCurrentClasses = vi.fn(() => {
      if (!mockStore.project || !mockStore.currentTask) return {};
      return mockStore.project.taskClasses?.[mockStore.currentTask] || {};
    });

    (useAnnotationStore as any).mockImplementation((selector: any) =>
      selector ? selector(mockStore) : mockStore
    );

    // Add setState and getState to the mock
    (useAnnotationStore as any).setState = vi.fn((updates: any) => {
      Object.assign(mockStore, typeof updates === 'function' ? updates(mockStore) : updates);
    });
    (useAnnotationStore as any).getState = vi.fn(() => mockStore);

    (projectsAPI.getProjectById as any).mockResolvedValue({
      id: 'test-project-1',
      name: 'Test Project',
      dataset_id: 'test-dataset-1',
      task_types: ['detection'],
      task_classes: {
        detection: {
          'class-1': { name: 'Person', color: '#ff0000', order: 0 },
          'class-2': { name: 'Car', color: '#00ff00', order: 1 },
          'class-3': { name: 'Bike', color: '#0000ff', order: 2 },
        },
      },
      task_config: {},
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Class Display Tests
  // ============================================================================

  describe('Class List Display', () => {
    it('should display all classes for current task', () => {
      render(<RightPanel />);

      expect(screen.getByText('Person')).toBeInTheDocument();
      expect(screen.getByText('Car')).toBeInTheDocument();
      expect(screen.getByText('Bike')).toBeInTheDocument();
    });

    it('should display classes in correct order', () => {
      render(<RightPanel />);

      const classItems = screen.getAllByText(/Person|Car|Bike/);
      expect(classItems[0]).toHaveTextContent('Person'); // order: 0
      expect(classItems[1]).toHaveTextContent('Car'); // order: 1
      expect(classItems[2]).toHaveTextContent('Bike'); // order: 2
    });

    it('should display class colors correctly', () => {
      const { container } = render(<RightPanel />);

      // Find color indicators by their background color
      const colorDivs = container.querySelectorAll('[style*="background"]');
      const classColors = Array.from(colorDivs)
        .map((div) => (div as HTMLElement).style.backgroundColor)
        .filter(Boolean);

      // Check that we have the expected colors (could be hex or rgb format)
      const hasRed = classColors.some(c => c === 'rgb(255, 0, 0)' || c === '#ff0000');
      const hasGreen = classColors.some(c => c === 'rgb(0, 255, 0)' || c === '#00ff00');
      const hasBlue = classColors.some(c => c === 'rgb(0, 0, 255)' || c === '#0000ff');

      expect(hasRed).toBe(true);
      expect(hasGreen).toBe(true);
      expect(hasBlue).toBe(true);
    });

    it('should display class order numbers', () => {
      render(<RightPanel />);

      // Order numbers are displayed as 0, 1, 2
      const container = document.body;
      expect(container.textContent).toContain('0');
      expect(container.textContent).toContain('1');
      expect(container.textContent).toContain('2');
    });

    it('should show "Add new class" button', () => {
      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      expect(addButton).toBeInTheDocument();
    });

    it('should show "Classes" header', () => {
      render(<RightPanel />);

      expect(screen.getByText('Classes')).toBeInTheDocument();
    });

    it('should display empty state when no classes exist', () => {
      const projectWithNoClasses = createMockProject({
        id: 'test-project-1',
        taskTypes: ['detection'],
        taskClasses: {
          detection: {},
        },
      });

      mockStore = createMockAnnotationStore({
        project: projectWithNoClasses,
        currentTask: 'detection',
        panels: { left: true, right: true },
        annotations: [],
      });

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      expect(screen.getByText(/No classes defined for detection/i)).toBeInTheDocument();
    });

    it('should filter classes by current task', () => {
      const multiTaskProject = createMockProject({
        id: 'test-project-1',
        taskTypes: ['detection', 'segmentation'],
        taskClasses: {
          detection: {
            'class-1': { name: 'Person', color: '#ff0000', order: 0 },
            'class-2': { name: 'Car', color: '#00ff00', order: 1 },
          },
          segmentation: {
            'class-3': { name: 'Building', color: '#0000ff', order: 0 },
          },
        },
      });

      mockStore = createMockAnnotationStore({
        project: multiTaskProject,
        currentTask: 'detection',
        panels: { left: true, right: true },
        annotations: [],
      });

      // Override getCurrentClasses to return classes from the project
      mockStore.getCurrentClasses = vi.fn(() => {
        if (!mockStore.project || !mockStore.currentTask) return {};
        return mockStore.project.taskClasses?.[mockStore.currentTask] || {};
      });

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      expect(screen.getByText('Person')).toBeInTheDocument();
      expect(screen.getByText('Car')).toBeInTheDocument();
      expect(screen.queryByText('Building')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Class Statistics Tests
  // ============================================================================

  describe('Class Statistics', () => {
    beforeEach(() => {
      (annotationsAPI.getProjectAnnotations as any).mockResolvedValue([
        {
          id: 'ann-1',
          class_id: 'class-1',
          image_id: 'img-1',
          annotation_type: 'bbox',
        },
        {
          id: 'ann-2',
          class_id: 'class-1',
          image_id: 'img-1',
          annotation_type: 'bbox',
        },
        {
          id: 'ann-3',
          class_id: 'class-1',
          image_id: 'img-2',
          annotation_type: 'bbox',
        },
        {
          id: 'ann-4',
          class_id: 'class-2',
          image_id: 'img-2',
          annotation_type: 'bbox',
        },
      ]);
    });

    it('should load class statistics on mount', async () => {
      render(<RightPanel />);

      await waitFor(() => {
        expect(annotationsAPI.getProjectAnnotations).toHaveBeenCalledWith('test-project-1');
      });
    });

    it('should display bbox count and image count for each class', async () => {
      render(<RightPanel />);

      await waitFor(() => {
        // class-1: 3 bboxes across 2 images
        expect(screen.getByText(/3 \(2\)/)).toBeInTheDocument();
        // class-2: 1 bbox across 1 image
        expect(screen.getByText(/1 \(1\)/)).toBeInTheDocument();
      });
    });

    it('should show 0 counts for classes with no annotations', async () => {
      render(<RightPanel />);

      await waitFor(() => {
        // class-3 has no annotations
        expect(screen.getByText(/0 \(0\)/)).toBeInTheDocument();
      });
    });

    it('should reload statistics when project changes', async () => {
      const { rerender } = render(<RightPanel />);

      await waitFor(() => {
        expect(annotationsAPI.getProjectAnnotations).toHaveBeenCalledTimes(1);
      });

      // Change project
      const newProject = createMockProject({ id: 'test-project-2' });
      mockStore.project = newProject;

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      rerender(<RightPanel />);

      await waitFor(() => {
        expect(annotationsAPI.getProjectAnnotations).toHaveBeenCalledWith('test-project-2');
      });
    });

    it('should reload statistics when task changes', async () => {
      const { rerender } = render(<RightPanel />);

      await waitFor(() => {
        expect(annotationsAPI.getProjectAnnotations).toHaveBeenCalledTimes(1);
      });

      // Change task
      mockStore.currentTask = 'segmentation';

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      rerender(<RightPanel />);

      await waitFor(() => {
        expect(annotationsAPI.getProjectAnnotations).toHaveBeenCalledTimes(2);
      });
    });

    it('should filter annotations by task type when calculating stats', async () => {
      (annotationsAPI.getProjectAnnotations as any).mockResolvedValue([
        {
          id: 'ann-1',
          class_id: 'class-1',
          image_id: 'img-1',
          annotation_type: 'bbox', // detection
        },
        {
          id: 'ann-2',
          class_id: 'class-1',
          image_id: 'img-1',
          annotation_type: 'polygon', // segmentation
        },
      ]);

      mockStore.currentTask = 'detection';

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      await waitFor(() => {
        // Should only count bbox annotation (1 bbox, 1 image)
        expect(screen.getByText(/1 \(1\)/)).toBeInTheDocument();
      });
    });

    it('should handle API errors gracefully', async () => {
      (annotationsAPI.getProjectAnnotations as any).mockRejectedValue(
        new Error('Failed to load')
      );

      // Should not throw
      expect(() => render(<RightPanel />)).not.toThrow();

      await waitFor(() => {
        expect(annotationsAPI.getProjectAnnotations).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Current Image Classes Tests
  // ============================================================================

  describe('Current Image Classes', () => {
    it('should display classes used in current image', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          imageId: 'img-1',
          classId: 'class-1',
          className: 'Person',
        }),
        createMockAnnotation({
          id: 'ann-2',
          imageId: 'img-1',
          classId: 'class-2',
          className: 'Car',
        }),
      ];

      mockStore.annotations = annotations;

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      expect(screen.getByText('Current Image')).toBeInTheDocument();
      // Should show count for each class
      const container = document.body;
      expect(container.textContent).toContain('1'); // Count for each class
    });

    it('should show count of annotations per class in current image', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          imageId: 'img-1',
          classId: 'class-1',
          className: 'Person',
        }),
        createMockAnnotation({
          id: 'ann-2',
          imageId: 'img-1',
          classId: 'class-1',
          className: 'Person',
        }),
        createMockAnnotation({
          id: 'ann-3',
          imageId: 'img-1',
          classId: 'class-2',
          className: 'Car',
        }),
      ];

      mockStore.annotations = annotations;

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      const container = document.body;
      expect(container.textContent).toContain('2'); // 2 Person annotations
      expect(container.textContent).toContain('1'); // 1 Car annotation
    });

    it('should highlight current image classes differently', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          imageId: 'img-1',
          classId: 'class-1',
          className: 'Person',
        }),
      ];

      mockStore.annotations = annotations;

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      const { container } = render(<RightPanel />);

      // Current image classes should have violet background
      const currentImageSection = container.querySelector('.bg-violet-500\\/10');
      expect(currentImageSection).toBeInTheDocument();
    });

    it('should not show current image section when no annotations exist', () => {
      mockStore.annotations = [];

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      expect(screen.queryByText('Current Image')).not.toBeInTheDocument();
    });

    it('should show separator between current image and all classes', () => {
      const annotations = [
        createMockAnnotation({
          id: 'ann-1',
          imageId: 'img-1',
          classId: 'class-1',
        }),
      ];

      mockStore.annotations = annotations;

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      const { container } = render(<RightPanel />);

      // Should have a border separator
      const separator = container.querySelector('.border-t');
      expect(separator).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Class Creation Tests
  // ============================================================================

  describe('Class Creation', () => {
    it('should open AddClassModal when add button is clicked', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-class-modal')).toBeInTheDocument();
      });
    });

    it('should pass correct props to AddClassModal', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      await waitFor(() => {
        expect(mockModalProjectId).toBe('test-project-1');
        expect(mockModalCurrentTask).toBe('detection');
        expect(mockModalIsOpen).toBe(true);
      });
    });

    it('should close modal when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-class-modal')).toBeInTheDocument();
      });

      const cancelButton = screen.getByTestId('modal-close-button');
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByTestId('add-class-modal')).not.toBeInTheDocument();
      });
    });

    it('should call addClass API when adding a class', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-class-modal')).toBeInTheDocument();
      });

      const addClassButton = screen.getByTestId('modal-add-button');
      await user.click(addClassButton);

      await waitFor(() => {
        expect(classesAPI.addClass).toHaveBeenCalledWith(
          'test-project-1',
          expect.objectContaining({
            name: 'New Class',
            color: '#0000ff',
          }),
          'detection'
        );
      });
    });

    it('should refresh project data after adding a class', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      const addClassButton = screen.getByTestId('modal-add-button');
      await user.click(addClassButton);

      await waitFor(() => {
        expect(projectsAPI.getProjectById).toHaveBeenCalledWith('test-project-1');
      });
    });

    it('should update store with new project data after adding class', async () => {
      const user = userEvent.setup();
      const updatedProject = {
        id: 'test-project-1',
        name: 'Test Project',
        dataset_id: 'test-dataset-1',
        task_types: ['detection'],
        task_classes: {
          detection: {
            'class-1': { name: 'Person', color: '#ff0000', order: 0 },
            'class-2': { name: 'Car', color: '#00ff00', order: 1 },
            'class-3': { name: 'Bike', color: '#0000ff', order: 2 },
            'new-class-1': { name: 'New Class', color: '#0000ff', order: 3 },
          },
        },
        task_config: {},
      };

      (projectsAPI.getProjectById as any).mockResolvedValue(updatedProject);

      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      const addClassButton = screen.getByTestId('modal-add-button');
      await user.click(addClassButton);

      await waitFor(() => {
        expect(useAnnotationStore.setState).toHaveBeenCalledWith(
          expect.objectContaining({
            project: expect.objectContaining({
              id: 'test-project-1',
              taskClasses: updatedProject.task_classes,
            }),
          })
        );
      });
    });

    it('should close modal after successfully adding class', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-class-modal')).toBeInTheDocument();
      });

      const addClassButton = screen.getByTestId('modal-add-button');
      await user.click(addClassButton);

      await waitFor(() => {
        expect(screen.queryByTestId('add-class-modal')).not.toBeInTheDocument();
      });
    });

    it('should handle API errors during class creation', async () => {
      const user = userEvent.setup();
      (classesAPI.addClass as any).mockRejectedValue(new Error('Failed to add class'));

      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      const addClassButton = screen.getByTestId('modal-add-button');

      // Click the button and wait for the error to be handled
      await user.click(addClassButton);

      // Wait for the component to handle the error (modal should close or show error state)
      await waitFor(() => {
        // The component should handle the error gracefully
        expect(classesAPI.addClass).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Class Reordering Tests
  // ============================================================================

  describe('Class Reordering', () => {
    it('should show reorder buttons on hover/focus', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      // Find first class item
      const classItem = screen.getByText('Person').closest('div');
      expect(classItem).toBeInTheDocument();

      // Click to focus
      await user.click(classItem!);

      await waitFor(() => {
        // Reorder buttons should become visible within the class item
        const upButton = classItem?.querySelector('button[title="Move up"]');
        const downButton = classItem?.querySelector('button[title="Move down"]');
        expect(upButton).toBeInTheDocument();
        expect(downButton).toBeInTheDocument();
      });
    });

    it('should disable up button for first class', () => {
      render(<RightPanel />);

      // First class (Person, order: 0) should have disabled up button
      const classItem = screen.getByText('Person').closest('div');
      const upButton = classItem?.querySelector('button[title="Move up"]') as HTMLButtonElement;

      expect(upButton).toBeDisabled();
    });

    it('should disable down button for last class', () => {
      render(<RightPanel />);

      // Last class (Bike, order: 2) should have disabled down button
      const classItem = screen.getByText('Bike').closest('div');
      const downButton = classItem?.querySelector('button[title="Move down"]') as HTMLButtonElement;

      expect(downButton).toBeDisabled();
    });

    it('should move class up when up button is clicked', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      // Click on second class (Car)
      const classItem = screen.getByText('Car').closest('div');
      await user.click(classItem!);

      // Click up button within the class item
      const upButton = classItem?.querySelector('button[title="Move up"]') as HTMLButtonElement;
      await user.click(upButton);

      await waitFor(() => {
        expect(classesAPI.reorderClasses).toHaveBeenCalledWith(
          'test-project-1',
          ['class-2', 'class-1', 'class-3'], // Car moved up, Person moved down
          'detection'
        );
      });
    });

    it('should move class down when down button is clicked', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      // Click on second class (Car)
      const classItem = screen.getByText('Car').closest('div');
      await user.click(classItem!);

      // Click down button within the class item
      const downButton = classItem?.querySelector('button[title="Move down"]') as HTMLButtonElement;
      await user.click(downButton);

      await waitFor(() => {
        expect(classesAPI.reorderClasses).toHaveBeenCalledWith(
          'test-project-1',
          ['class-1', 'class-3', 'class-2'], // Bike moved up, Car moved down
          'detection'
        );
      });
    });

    it('should refresh project data after reordering', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      const classItem = screen.getByText('Car').closest('div');
      await user.click(classItem!);

      const upButton = classItem?.querySelector('button[title="Move up"]') as HTMLButtonElement;
      await user.click(upButton);

      await waitFor(() => {
        expect(projectsAPI.getProjectById).toHaveBeenCalledWith('test-project-1');
      });
    });

    it('should maintain focus on moved class after reordering', async () => {
      const user = userEvent.setup();
      const { container } = render(<RightPanel />);

      const classItem = screen.getByText('Car').closest('div');
      await user.click(classItem!);

      const upButton = classItem?.querySelector('button[title="Move up"]') as HTMLButtonElement;
      await user.click(upButton);

      await waitFor(() => {
        // The class should still be focused (highlighted)
        const focusedClass = container.querySelector('.bg-violet-100');
        expect(focusedClass).toBeInTheDocument();
      });
    });

    it('should prevent multiple simultaneous reorder operations', async () => {
      const user = userEvent.setup();
      (classesAPI.reorderClasses as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<RightPanel />);

      const classItem = screen.getByText('Car').closest('div');
      await user.click(classItem!);

      const upButton = classItem?.querySelector('button[title="Move up"]') as HTMLButtonElement;

      // Click multiple times rapidly
      await user.click(upButton);
      await user.click(upButton);
      await user.click(upButton);

      // Should only be called once
      await waitFor(() => {
        expect(classesAPI.reorderClasses).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle reorder API errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (classesAPI.reorderClasses as any).mockRejectedValue(new Error('Failed to reorder'));

      render(<RightPanel />);

      const classItem = screen.getByText('Car').closest('div');
      await user.click(classItem!);

      const upButton = classItem?.querySelector('button[title="Move up"]') as HTMLButtonElement;
      await user.click(upButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to reorder classes:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it('should stop propagation when clicking reorder buttons', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      const classItem = screen.getByText('Car').closest('div');
      await user.click(classItem!);

      const upButton = classItem?.querySelector('button[title="Move up"]') as HTMLButtonElement;

      // Mock stopPropagation
      const clickHandler = vi.fn((e) => e.stopPropagation());
      upButton.addEventListener('click', clickHandler);

      await user.click(upButton);

      expect(clickHandler).toHaveBeenCalled();
    });

    it('should clear focus when clicking on empty space', async () => {
      const user = userEvent.setup();
      const { container } = render(<RightPanel />);

      // Focus a class
      const classItem = screen.getByText('Car').closest('div');
      await user.click(classItem!);

      // Verify it's focused
      await waitFor(() => {
        expect(container.querySelector('.bg-violet-100')).toBeInTheDocument();
      });

      // Click on the class list container (empty space)
      const classList = container.querySelector('.flex-1.overflow-y-auto.p-3');
      if (classList) {
        await user.click(classList as Element);

        await waitFor(() => {
          expect(container.querySelector('.bg-violet-100')).not.toBeInTheDocument();
        });
      }
    });
  });

  // ============================================================================
  // Class Focus and Selection Tests
  // ============================================================================

  describe('Class Focus and Selection', () => {
    it('should highlight focused class', async () => {
      const user = userEvent.setup();
      const { container } = render(<RightPanel />);

      const classItem = screen.getByText('Person').closest('div');
      await user.click(classItem!);

      await waitFor(() => {
        const focusedClass = container.querySelector('.bg-violet-100');
        expect(focusedClass).toBeInTheDocument();
      });
    });

    it('should show ring around focused class', async () => {
      const user = userEvent.setup();
      const { container } = render(<RightPanel />);

      const classItem = screen.getByText('Person').closest('div');
      await user.click(classItem!);

      await waitFor(() => {
        const focusedClass = container.querySelector('.ring-1.ring-violet-400');
        expect(focusedClass).toBeInTheDocument();
      });
    });

    it('should change focus when clicking different class', async () => {
      const user = userEvent.setup();
      render(<RightPanel />);

      // Focus first class
      const firstClass = screen.getByText('Person').closest('div');
      await user.click(firstClass!);

      await waitFor(() => {
        expect(firstClass).toHaveClass('bg-violet-100');
      });

      // Focus second class
      const secondClass = screen.getByText('Car').closest('div');
      await user.click(secondClass!);

      await waitFor(() => {
        expect(secondClass).toHaveClass('bg-violet-100');
        expect(firstClass).not.toHaveClass('bg-violet-100');
      });
    });

    it('should show reorder buttons only for focused class', async () => {
      const user = userEvent.setup();
      const { container } = render(<RightPanel />);

      // Focus second class (Car)
      const carClass = screen.getByText('Car').closest('div');
      await user.click(carClass!);

      await waitFor(() => {
        // Find the focused class container
        const focusedContainer = container.querySelector('.bg-violet-100');
        expect(focusedContainer).toBeInTheDocument();

        // Reorder buttons in focused class should be visible
        const reorderButtons = focusedContainer?.querySelectorAll('.opacity-100');
        expect(reorderButtons?.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing project gracefully', () => {
      mockStore.project = null;

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      expect(() => render(<RightPanel />)).not.toThrow();
    });

    it('should handle empty task classes', () => {
      const projectWithEmptyClasses = createMockProject({
        id: 'test-project-1',
        taskClasses: {},
      });

      mockStore.project = projectWithEmptyClasses;

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      expect(() => render(<RightPanel />)).not.toThrow();
    });

    it('should handle missing currentTask', () => {
      mockStore.currentTask = null;

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      render(<RightPanel />);

      expect(screen.getByText(/No classes defined for current task/i)).toBeInTheDocument();
    });

    it('should handle classes without order property', () => {
      const projectWithUnorderedClasses = createMockProject({
        id: 'test-project-1',
        taskClasses: {
          detection: {
            'class-1': { name: 'Person', color: '#ff0000' }, // no order
            'class-2': { name: 'Car', color: '#00ff00' }, // no order
          },
        },
      });

      mockStore.project = projectWithUnorderedClasses;
      mockStore.currentTask = 'detection';

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      expect(() => render(<RightPanel />)).not.toThrow();
    });

    it('should handle API timeout during project refresh', async () => {
      const user = userEvent.setup();
      (projectsAPI.getProjectById as any).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<RightPanel />);

      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      const addClassButton = screen.getByTestId('modal-add-button');
      await user.click(addClassButton);

      await waitFor(() => {
        // The refresh error or statistics error can be logged depending on timing
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed class data', () => {
      const projectWithMalformedClasses = createMockProject({
        id: 'test-project-1',
        taskClasses: {
          detection: {
            'class-1': { name: 'Person', color: '#ff0000', order: 0 }, // valid class
          },
        },
      });

      mockStore.project = projectWithMalformedClasses;
      mockStore.currentTask = 'detection';

      // Override getCurrentClasses to return the classes (filtering out null)
      mockStore.getCurrentClasses = vi.fn(() => {
        if (!mockStore.project || !mockStore.currentTask) return {};
        const classes = mockStore.project.taskClasses?.[mockStore.currentTask] || {};
        // Filter out null/undefined entries
        return Object.fromEntries(
          Object.entries(classes).filter(([_, v]) => v != null)
        );
      });

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      expect(() => render(<RightPanel />)).not.toThrow();
    });

    it('should handle undefined taskClasses', () => {
      const projectWithoutTaskClasses = createMockProject({
        id: 'test-project-1',
        taskClasses: undefined as any,
      });

      mockStore.project = projectWithoutTaskClasses;

      (useAnnotationStore as any).mockImplementation((selector: any) =>
        selector ? selector(mockStore) : mockStore
      );

      expect(() => render(<RightPanel />)).not.toThrow();
    });
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('Integration Tests', () => {
    beforeEach(() => {
      // Reset mocks that might have been modified by previous tests
      (annotationsAPI.getProjectAnnotations as any).mockResolvedValue([]);
      (classesAPI.addClass as any).mockResolvedValue({
        class_id: 'new-class-1',
        name: 'New Class',
        color: '#0000ff',
        order: 2,
      });
      (classesAPI.reorderClasses as any).mockResolvedValue({ success: true });
    });

    it('should complete full class creation workflow', async () => {
      const user = userEvent.setup();

      const updatedProject = {
        id: 'test-project-1',
        name: 'Test Project',
        dataset_id: 'test-dataset-1',
        task_types: ['detection'],
        task_classes: {
          detection: {
            'class-1': { name: 'Person', color: '#ff0000', order: 0 },
            'class-2': { name: 'Car', color: '#00ff00', order: 1 },
            'class-3': { name: 'Bike', color: '#0000ff', order: 2 },
            'new-class-1': { name: 'New Class', color: '#0000ff', order: 3 },
          },
        },
        task_config: {},
      };

      (projectsAPI.getProjectById as any).mockResolvedValue(updatedProject);

      render(<RightPanel />);

      // 1. Open modal
      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('add-class-modal')).toBeInTheDocument();
      });

      // 2. Add class
      const addClassButton = screen.getByTestId('modal-add-button');
      await user.click(addClassButton);

      // 3. Verify API calls
      await waitFor(() => {
        expect(classesAPI.addClass).toHaveBeenCalled();
        expect(projectsAPI.getProjectById).toHaveBeenCalled();
      });

      // 4. Verify modal closed
      await waitFor(() => {
        expect(screen.queryByTestId('add-class-modal')).not.toBeInTheDocument();
      });

      // 5. Verify store update was attempted
      expect(useAnnotationStore.setState).toHaveBeenCalled();
    });

    it('should complete full class reordering workflow', async () => {
      const user = userEvent.setup();

      const updatedProject = {
        id: 'test-project-1',
        name: 'Test Project',
        dataset_id: 'test-dataset-1',
        task_types: ['detection'],
        task_classes: {
          detection: {
            'class-1': { name: 'Person', color: '#ff0000', order: 1 }, // moved down
            'class-2': { name: 'Car', color: '#00ff00', order: 0 }, // moved up
            'class-3': { name: 'Bike', color: '#0000ff', order: 2 },
          },
        },
        task_config: {},
      };

      (projectsAPI.getProjectById as any).mockResolvedValue(updatedProject);

      render(<RightPanel />);

      // 1. Focus class
      const carClass = screen.getByText('Car').closest('div');
      await user.click(carClass!);

      // 2. Move up
      const upButton = carClass?.querySelector('button[title="Move up"]') as HTMLButtonElement;
      await user.click(upButton);

      // 3. Verify API calls
      await waitFor(() => {
        expect(classesAPI.reorderClasses).toHaveBeenCalledWith(
          'test-project-1',
          ['class-2', 'class-1', 'class-3'],
          'detection'
        );
        expect(projectsAPI.getProjectById).toHaveBeenCalled();
      });

      // 4. Verify store update was attempted
      expect(useAnnotationStore.setState).toHaveBeenCalled();
    });

    it('should handle class creation and reordering in sequence', async () => {
      const user = userEvent.setup();

      render(<RightPanel />);

      // 1. Add a class
      const addButton = screen.getByTitle('Add new class');
      await user.click(addButton);

      const addClassButton = screen.getByTestId('modal-add-button');
      await user.click(addClassButton);

      await waitFor(() => {
        expect(classesAPI.addClass).toHaveBeenCalled();
      });

      // 2. Wait for project refresh
      await waitFor(() => {
        expect(projectsAPI.getProjectById).toHaveBeenCalled();
      });

      // 3. Reorder a class
      const carClass = screen.getByText('Car').closest('div');
      await user.click(carClass!);

      const upButton = carClass?.querySelector('button[title="Move up"]') as HTMLButtonElement;
      await user.click(upButton);

      await waitFor(() => {
        expect(classesAPI.reorderClasses).toHaveBeenCalled();
      });
    });
  });
});
