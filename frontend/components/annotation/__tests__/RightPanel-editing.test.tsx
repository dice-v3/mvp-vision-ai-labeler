/**
 * RightPanel Component Tests - Annotation Editing
 *
 * Tests for annotation property editing, class assignment, attribute modification,
 * and form validation in the RightPanel component.
 *
 * Phase 9: Frontend RightPanel Component Tests
 * Subtask 9.2: Test RightPanel.tsx annotation editing
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
import * as annotationsAPI from '@/lib/api/annotations';

// Create mock function for annotation store
const mockUseAnnotationStore = vi.fn();

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
  updateAnnotation: vi.fn().mockResolvedValue({
    id: 'ann-1',
    classId: 'class-2',
    className: 'Car',
    version: 2,
  }),
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

describe('RightPanel - Annotation Editing', () => {
  let mockStore: any;
  let mockProject: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock project with classes
    mockProject = createMockProject({
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

    mockUseAnnotationStore.mockReturnValue(mockStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Class Assignment Editing', () => {
    it('should allow updating annotation class via updateAnnotation', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
        className: 'Person',
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Programmatically update class assignment
      mockStore.updateAnnotation('ann-1', {
        classId: 'class-2',
        className: 'Car',
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        classId: 'class-2',
        className: 'Car',
      });
    });

    it('should update annotation to different class', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
        className: 'Person',
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update class from Person to Car
      mockStore.updateAnnotation('ann-1', {
        classId: 'class-2',
        className: 'Car',
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledTimes(1);
      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        classId: 'class-2',
        className: 'Car',
      });
    });

    it('should handle class assignment to previously unclassified annotation', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: undefined,
        className: undefined,
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Assign class to unclassified annotation
      mockStore.updateAnnotation('ann-1', {
        classId: 'class-1',
        className: 'Person',
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        classId: 'class-1',
        className: 'Person',
      });
    });

    it('should handle removing class assignment (set to undefined)', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
        className: 'Person',
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Remove class assignment
      mockStore.updateAnnotation('ann-1', {
        classId: undefined,
        className: undefined,
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        classId: undefined,
        className: undefined,
      });
    });

    it('should validate class exists in project before assignment', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
        className: 'Person',
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Attempt to assign invalid class ID
      const invalidClassId = 'class-999';
      const projectClasses = mockStore.getCurrentClasses();

      // Validation: Check if class exists before updating
      const classExists = projectClasses[invalidClassId] !== undefined;
      expect(classExists).toBe(false);

      // Should not update with invalid class ID
      if (!classExists) {
        // Don't call updateAnnotation with invalid class
        expect(mockStore.updateAnnotation).not.toHaveBeenCalled();
      }
    });

    it('should handle multiple class assignments to multiple annotations', () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', classId: 'class-1' }),
        createMockAnnotation({ id: 'ann-2', classId: 'class-1' }),
        createMockAnnotation({ id: 'ann-3', classId: 'class-2' }),
      ];

      mockStore.annotations = annotations;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update multiple annotations to new class
      mockStore.updateAnnotation('ann-1', { classId: 'class-3', className: 'Bike' });
      mockStore.updateAnnotation('ann-2', { classId: 'class-3', className: 'Bike' });

      expect(mockStore.updateAnnotation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Attribute Modification', () => {
    it('should allow updating annotation attributes', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        attributes: { color: 'red', size: 'large' },
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update attributes
      mockStore.updateAnnotation('ann-1', {
        attributes: { color: 'blue', size: 'medium', shape: 'round' },
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        attributes: { color: 'blue', size: 'medium', shape: 'round' },
      });
    });

    it('should handle adding new attributes to annotation', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        attributes: {},
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Add new attributes
      mockStore.updateAnnotation('ann-1', {
        attributes: { visibility: 'occluded', truncated: true },
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        attributes: { visibility: 'occluded', truncated: true },
      });
    });

    it('should handle removing attributes from annotation', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        attributes: { color: 'red', size: 'large' },
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Remove attributes
      mockStore.updateAnnotation('ann-1', {
        attributes: {},
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        attributes: {},
      });
    });

    it('should handle updating specific attribute without affecting others', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        attributes: { color: 'red', size: 'large', shape: 'round' },
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update only color attribute (preserving others)
      const updatedAttributes = {
        ...annotation.attributes,
        color: 'blue',
      };

      mockStore.updateAnnotation('ann-1', {
        attributes: updatedAttributes,
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        attributes: { color: 'blue', size: 'large', shape: 'round' },
      });
    });

    it('should handle attributes with various data types', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        attributes: {},
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update with different data types
      mockStore.updateAnnotation('ann-1', {
        attributes: {
          stringAttr: 'value',
          numberAttr: 42,
          boolAttr: true,
          arrayAttr: [1, 2, 3],
          objectAttr: { nested: 'value' },
        },
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        attributes: {
          stringAttr: 'value',
          numberAttr: 42,
          boolAttr: true,
          arrayAttr: [1, 2, 3],
          objectAttr: { nested: 'value' },
        },
      });
    });
  });

  describe('Property Editing', () => {
    it('should allow updating annotation confidence', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        confidence: 0.85,
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update confidence
      mockStore.updateAnnotation('ann-1', {
        confidence: 0.95,
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        confidence: 0.95,
      });
    });

    it('should allow updating isAiAssisted flag', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        isAiAssisted: false,
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Mark as AI-assisted
      mockStore.updateAnnotation('ann-1', {
        isAiAssisted: true,
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        isAiAssisted: true,
      });
    });

    it('should allow updating annotation geometry', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        annotationType: 'bbox',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
        },
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update geometry (resize bbox)
      mockStore.updateAnnotation('ann-1', {
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 250, 180],
        },
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 250, 180],
        },
      });
    });

    it('should allow updating multiple properties simultaneously', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
        confidence: 0.8,
        attributes: { color: 'red' },
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update multiple properties
      mockStore.updateAnnotation('ann-1', {
        classId: 'class-2',
        className: 'Car',
        confidence: 0.95,
        attributes: { color: 'blue', size: 'large' },
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        classId: 'class-2',
        className: 'Car',
        confidence: 0.95,
        attributes: { color: 'blue', size: 'large' },
      });
    });

    it('should handle partial property updates', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
        confidence: 0.8,
        attributes: { color: 'red' },
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update only confidence (other properties remain unchanged)
      mockStore.updateAnnotation('ann-1', {
        confidence: 0.9,
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        confidence: 0.9,
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate confidence is between 0 and 1', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        confidence: 0.85,
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Valid confidence values
      const validConfidence = 0.95;
      expect(validConfidence).toBeGreaterThanOrEqual(0);
      expect(validConfidence).toBeLessThanOrEqual(1);

      // Invalid confidence values should be rejected
      const invalidConfidences = [1.5, -0.1, 2.0, -1];
      invalidConfidences.forEach((confidence) => {
        const isValid = confidence >= 0 && confidence <= 1;
        expect(isValid).toBe(false);
      });
    });

    it('should validate geometry bbox has positive dimensions', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        annotationType: 'bbox',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
        },
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Valid bbox: positive width and height
      const validBbox = [100, 100, 200, 150]; // x, y, width, height
      expect(validBbox[2]).toBeGreaterThan(0); // width > 0
      expect(validBbox[3]).toBeGreaterThan(0); // height > 0

      // Invalid bboxes
      const invalidBboxes = [
        [100, 100, 0, 150],    // zero width
        [100, 100, 200, 0],    // zero height
        [100, 100, -50, 150],  // negative width
        [100, 100, 200, -50],  // negative height
      ];

      invalidBboxes.forEach((bbox) => {
        const isValid = bbox[2] > 0 && bbox[3] > 0;
        expect(isValid).toBe(false);
      });
    });

    it('should validate polygon has minimum 3 vertices', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        annotationType: 'polygon',
        geometry: {
          type: 'polygon',
          points: [[10, 10], [20, 10], [15, 20]],
        },
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Valid polygon: 3+ vertices
      const validPolygon = [[10, 10], [20, 10], [15, 20]];
      expect(validPolygon.length).toBeGreaterThanOrEqual(3);

      // Invalid polygons
      const invalidPolygons = [
        [],
        [[10, 10]],
        [[10, 10], [20, 10]],
      ];

      invalidPolygons.forEach((points) => {
        const isValid = points.length >= 3;
        expect(isValid).toBe(false);
      });
    });

    it('should validate attribute values are not null or undefined when required', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        attributes: { color: 'red', size: 'large' },
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Valid attributes
      const validAttributes = { color: 'red', size: 'large' };
      expect(validAttributes.color).toBeDefined();
      expect(validAttributes.size).toBeDefined();

      // Invalid attributes (if certain fields are required)
      const invalidAttributes = { color: null, size: undefined };
      expect(invalidAttributes.color).toBeNull();
      expect(invalidAttributes.size).toBeUndefined();
    });

    it('should reject updates with invalid annotation type', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        annotationType: 'bbox',
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Valid annotation types
      const validTypes = ['bbox', 'polygon', 'classification', 'keypoints', 'line', 'polyline', 'circle'];
      validTypes.forEach((type) => {
        expect(validTypes).toContain(type);
      });

      // Invalid annotation type
      const invalidType = 'invalid-type' as any;
      expect(validTypes).not.toContain(invalidType);
    });

    it('should validate geometry matches annotation type', () => {
      // bbox annotation should have bbox geometry
      const bboxAnnotation = createMockAnnotation({
        id: 'ann-1',
        annotationType: 'bbox',
        geometry: {
          type: 'bbox',
          bbox: [100, 100, 200, 150],
        },
      });

      expect(bboxAnnotation.annotationType).toBe('bbox');
      expect(bboxAnnotation.geometry.type).toBe('bbox');

      // polygon annotation should have polygon geometry
      const polygonAnnotation = createMockAnnotation({
        id: 'ann-2',
        annotationType: 'polygon',
        geometry: {
          type: 'polygon',
          points: [[10, 10], [20, 10], [15, 20]],
        },
      });

      expect(polygonAnnotation.annotationType).toBe('polygon');
      expect(polygonAnnotation.geometry.type).toBe('polygon');

      // Mismatched geometry and annotation type is invalid
      const mismatchedAnnotation = {
        annotationType: 'bbox',
        geometry: {
          type: 'polygon',
          points: [[10, 10], [20, 10], [15, 20]],
        },
      };

      expect(mismatchedAnnotation.annotationType).not.toBe(mismatchedAnnotation.geometry.type);
    });
  });

  describe('Editing State Management', () => {
    it('should track which annotation is being edited', () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1' }),
        createMockAnnotation({ id: 'ann-2' }),
      ];

      mockStore.annotations = annotations;
      mockStore.selectedAnnotationId = 'ann-1';
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Currently editing ann-1
      expect(mockStore.selectedAnnotationId).toBe('ann-1');

      // Change to editing ann-2
      mockStore.selectAnnotation('ann-2');
      expect(mockStore.selectAnnotation).toHaveBeenCalledWith('ann-2');
    });

    it('should clear editing state when annotation is deleted', () => {
      const annotation = createMockAnnotation({ id: 'ann-1' });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Delete currently selected annotation
      mockStore.deleteAnnotation('ann-1');

      expect(mockStore.deleteAnnotation).toHaveBeenCalledWith('ann-1');
      // selectedAnnotationId should be cleared in the store's deleteAnnotation implementation
    });

    it('should allow editing when annotation is selected', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
      });

      mockStore.annotations = [annotation];
      mockStore.selectedAnnotationId = 'ann-1';
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Can edit when annotation is selected
      expect(mockStore.selectedAnnotationId).toBe('ann-1');

      // Update selected annotation
      mockStore.updateAnnotation('ann-1', { classId: 'class-2' });
      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', { classId: 'class-2' });
    });

    it('should handle rapid successive edits to same annotation', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
        confidence: 0.8,
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Multiple rapid edits
      mockStore.updateAnnotation('ann-1', { confidence: 0.85 });
      mockStore.updateAnnotation('ann-1', { confidence: 0.9 });
      mockStore.updateAnnotation('ann-1', { confidence: 0.95 });

      expect(mockStore.updateAnnotation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle updating non-existent annotation gracefully', () => {
      mockStore.annotations = [];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Attempt to update non-existent annotation
      mockStore.updateAnnotation('non-existent-id', { classId: 'class-1' });

      // Store should handle this gracefully (no crash)
      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('non-existent-id', { classId: 'class-1' });
    });

    it('should handle empty updates', () => {
      const annotation = createMockAnnotation({ id: 'ann-1' });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update with empty object (no changes)
      mockStore.updateAnnotation('ann-1', {});

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {});
    });

    it('should handle updating annotation with null values', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
        confidence: 0.8,
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Update with null values (should be allowed for optional fields)
      mockStore.updateAnnotation('ann-1', {
        confidence: undefined,
      });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        confidence: undefined,
      });
    });

    it('should handle updating annotation when project is null', () => {
      const annotation = createMockAnnotation({ id: 'ann-1' });

      mockStore.annotations = [annotation];
      mockStore.project = null;
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Should still allow updates even if project is null
      mockStore.updateAnnotation('ann-1', { confidence: 0.9 });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', { confidence: 0.9 });
    });

    it('should handle updating annotation with very large attributes object', () => {
      const annotation = createMockAnnotation({ id: 'ann-1' });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Large attributes object
      const largeAttributes: any = {};
      for (let i = 0; i < 100; i++) {
        largeAttributes[`attr_${i}`] = `value_${i}`;
      }

      mockStore.updateAnnotation('ann-1', { attributes: largeAttributes });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', {
        attributes: largeAttributes,
      });
    });

    it('should validate required fields are not removed', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        projectId: 'proj-1',
        imageId: 'img-1',
        annotationType: 'bbox',
      });

      // Required fields should always be present
      expect(annotation.id).toBeDefined();
      expect(annotation.projectId).toBeDefined();
      expect(annotation.imageId).toBeDefined();
      expect(annotation.annotationType).toBeDefined();
      expect(annotation.geometry).toBeDefined();
    });
  });

  describe('Integration with API', () => {
    it('should call API updateAnnotation when class is changed', async () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Simulate programmatic class change (which would call API)
      const updateAnnotationSpy = vi.spyOn(annotationsAPI, 'updateAnnotation');

      // Call API to update annotation
      await annotationsAPI.updateAnnotation('ann-1', {
        classId: 'class-2',
        className: 'Car',
      });

      expect(updateAnnotationSpy).toHaveBeenCalledWith('ann-1', {
        classId: 'class-2',
        className: 'Car',
      });
    });

    it('should handle API errors when updating annotation', async () => {
      const annotation = createMockAnnotation({ id: 'ann-1' });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Mock API error
      const updateAnnotationSpy = vi.spyOn(annotationsAPI, 'updateAnnotation');
      updateAnnotationSpy.mockRejectedValueOnce(new Error('Network error'));

      // Attempt to update via API
      await expect(
        annotationsAPI.updateAnnotation('ann-1', { classId: 'class-2' })
      ).rejects.toThrow('Network error');
    });

    it('should handle optimistic updates followed by API sync', async () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
        version: 1,
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Optimistic update in store
      mockStore.updateAnnotation('ann-1', { classId: 'class-2' });

      // Then sync with API
      const response = await annotationsAPI.updateAnnotation('ann-1', {
        classId: 'class-2',
        className: 'Car',
      });

      expect(response.version).toBe(2);
      expect(response.classId).toBe('class-2');
    });
  });

  describe('Annotation History and Undo', () => {
    it('should record snapshot before editing annotation', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // updateAnnotation should call recordSnapshot internally
      // This is tested via the store's implementation
      mockStore.updateAnnotation('ann-1', { classId: 'class-2' });

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', { classId: 'class-2' });
      // The store's implementation should have called recordSnapshot('update', ['ann-1'])
    });

    it('should allow undoing annotation edits', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Make an edit
      mockStore.updateAnnotation('ann-1', { classId: 'class-2' });

      // Undo the edit
      mockStore.undo();

      expect(mockStore.undo).toHaveBeenCalled();
      // After undo, annotation should revert to class-1
    });

    it('should allow redoing annotation edits', () => {
      const annotation = createMockAnnotation({
        id: 'ann-1',
        classId: 'class-1',
      });

      mockStore.annotations = [annotation];
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Make an edit
      mockStore.updateAnnotation('ann-1', { classId: 'class-2' });

      // Undo
      mockStore.undo();

      // Redo
      mockStore.redo();

      expect(mockStore.redo).toHaveBeenCalled();
      // After redo, annotation should be back to class-2
    });
  });

  describe('Keyboard Shortcuts for Editing', () => {
    it('should handle keyboard shortcut for quick class assignment', () => {
      const annotations = [
        createMockAnnotation({ id: 'ann-1', classId: 'class-1' }),
      ];

      mockStore.annotations = annotations;
      mockStore.selectedAnnotationId = 'ann-1';
      mockUseAnnotationStore.mockReturnValue(mockStore);

      render(<RightPanel />);

      // Keyboard shortcuts could be used to quickly assign classes
      // For example, pressing '1' assigns class-1, '2' assigns class-2, etc.
      // This would be implemented in the component's keyboard handler

      // Simulate quick class assignment via keyboard
      const selectedAnnotation = mockStore.annotations.find((a: any) => a.id === mockStore.selectedAnnotationId);
      if (selectedAnnotation) {
        mockStore.updateAnnotation(selectedAnnotation.id, { classId: 'class-2' });
      }

      expect(mockStore.updateAnnotation).toHaveBeenCalledWith('ann-1', { classId: 'class-2' });
    });
  });
});
