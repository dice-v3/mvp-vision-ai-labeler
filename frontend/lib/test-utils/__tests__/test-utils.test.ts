/**
 * Test Utilities Verification Tests
 *
 * Ensures test utilities are working correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createMockAnnotationStore,
  createMockProject,
  createMockImage,
  createMockAnnotation,
  createMockAnnotations,
  createMockImages,
  createMockClasses,
} from '../mock-stores';
import {
  createMockAPIError,
  createMockPaginatedResponse,
  createMockSuccessResponse,
  createMockErrorResponse,
} from '../mock-api';
import {
  createMockCanvas,
  createMockImage as createMockImageElement,
  createMouseEvent,
  createWheelEvent,
  createKeyboardEvent,
  isPointInBbox,
  doBboxesOverlap,
  distanceBetweenPoints,
} from '../component-test-utils';

describe('Mock Stores', () => {
  describe('createMockAnnotationStore', () => {
    it('should create a mock store with default values', () => {
      const store = createMockAnnotationStore();

      expect(store.project).toBeNull();
      expect(store.images).toEqual([]);
      expect(store.annotations).toEqual([]);
      expect(store.tool).toBe('select');
      expect(store.canvas.zoom).toBe(1);
      expect(store.preferences.autoSave).toBe(true);
    });

    it('should allow overriding default values', () => {
      const store = createMockAnnotationStore({
        tool: 'bbox',
        canvas: { zoom: 2, pan: { x: 10, y: 20 }, cursor: { x: 0, y: 0 } },
      });

      expect(store.tool).toBe('bbox');
      expect(store.canvas.zoom).toBe(2);
      expect(store.canvas.pan).toEqual({ x: 10, y: 20 });
    });

    it('should have mocked action functions', () => {
      const store = createMockAnnotationStore();

      expect(store.setTool).toBeDefined();
      expect(store.addAnnotation).toBeDefined();
      expect(store.selectAnnotation).toBeDefined();

      store.setTool('bbox');
      expect(store.setTool).toHaveBeenCalledWith('bbox');
    });
  });

  describe('Factory Functions', () => {
    it('should create a mock project', () => {
      const project = createMockProject();

      expect(project.id).toBe('test-project-1');
      expect(project.name).toBe('Test Project');
      expect(project.taskTypes).toContain('detection');
    });

    it('should create a mock image', () => {
      const image = createMockImage();

      expect(image.id).toBe('test-image-1');
      expect(image.file_name).toBe('test-image.jpg');
      expect(image.width).toBe(800);
      expect(image.height).toBe(600);
    });

    it('should create a mock annotation', () => {
      const annotation = createMockAnnotation();

      expect(annotation.id).toBe('test-annotation-1');
      expect(annotation.annotationType).toBe('bbox');
      expect(annotation.geometry.type).toBe('bbox');
    });

    it('should create multiple mock annotations', () => {
      const annotations = createMockAnnotations(5);

      expect(annotations).toHaveLength(5);
      expect(annotations[0].id).toBe('annotation-1');
      expect(annotations[4].id).toBe('annotation-5');
    });

    it('should create multiple mock images', () => {
      const images = createMockImages(3);

      expect(images).toHaveLength(3);
      expect(images[0].id).toBe('image-1');
      expect(images[2].id).toBe('image-3');
    });

    it('should create mock classes', () => {
      const classes = createMockClasses();

      expect(Object.keys(classes)).toHaveLength(3);
      expect(classes['class-1'].name).toBe('Person');
      expect(classes['class-2'].name).toBe('Car');
    });
  });
});

describe('Mock API', () => {
  describe('Response Builders', () => {
    it('should create a mock API error', () => {
      const error = createMockAPIError('Test error', 404);

      expect(error.message).toBe('Test error');
      expect((error as any).status).toBe(404);
    });

    it('should create a mock paginated response', () => {
      const items = [1, 2, 3, 4, 5];
      const response = createMockPaginatedResponse(items, 50, 1, 10);

      expect(response.items).toEqual(items);
      expect(response.total).toBe(50);
      expect(response.page).toBe(1);
      expect(response.page_size).toBe(10);
      expect(response.total_pages).toBe(5);
    });

    it('should create a mock success response', () => {
      const data = { id: 1, name: 'Test' };
      const response = createMockSuccessResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
    });

    it('should create a mock error response', () => {
      const response = createMockErrorResponse('Something went wrong', 'ERR_500');

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Something went wrong');
      expect(response.error.code).toBe('ERR_500');
    });
  });
});

describe('Component Test Utilities', () => {
  describe('Canvas Helpers', () => {
    it('should create a mock canvas', () => {
      const canvas = createMockCanvas(1024, 768);

      expect(canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(canvas.width).toBe(1024);
      expect(canvas.height).toBe(768);
    });

    it('should create a mock image element', () => {
      const img = createMockImageElement('http://test.com/img.jpg', 640, 480);

      expect(img).toBeInstanceOf(HTMLImageElement);
      expect(img.src).toBe('http://test.com/img.jpg');
      expect(img.width).toBe(640);
      expect(img.height).toBe(480);
    });
  });

  describe('Event Helpers', () => {
    it('should create a mouse event', () => {
      const event = createMouseEvent('click', { clientX: 100, clientY: 200 });

      expect(event.type).toBe('click');
      expect(event.clientX).toBe(100);
      expect(event.clientY).toBe(200);
      expect(event.bubbles).toBe(true);
    });

    it('should create a wheel event', () => {
      const event = createWheelEvent(-100);

      expect(event.type).toBe('wheel');
      expect(event.deltaY).toBe(-100);
    });

    it('should create a keyboard event', () => {
      const event = createKeyboardEvent('keydown', 'a', { ctrlKey: true });

      expect(event.type).toBe('keydown');
      expect(event.key).toBe('a');
      expect(event.ctrlKey).toBe(true);
    });
  });

  describe('Geometry Helpers', () => {
    it('should check if point is in bbox', () => {
      const bbox: [number, number, number, number] = [100, 100, 200, 150];

      expect(isPointInBbox({ x: 150, y: 125 }, bbox)).toBe(true);
      expect(isPointInBbox({ x: 50, y: 50 }, bbox)).toBe(false);
      expect(isPointInBbox({ x: 100, y: 100 }, bbox)).toBe(true); // Edge case
      expect(isPointInBbox({ x: 300, y: 250 }, bbox)).toBe(true); // Within bounds
    });

    it('should check if bboxes overlap', () => {
      const bbox1: [number, number, number, number] = [100, 100, 200, 150];
      const bbox2: [number, number, number, number] = [150, 125, 200, 150];
      const bbox3: [number, number, number, number] = [400, 400, 100, 100];

      expect(doBboxesOverlap(bbox1, bbox2)).toBe(true);
      expect(doBboxesOverlap(bbox1, bbox3)).toBe(false);
    });

    it('should calculate distance between points', () => {
      const p1 = { x: 0, y: 0 };
      const p2 = { x: 3, y: 4 };

      expect(distanceBetweenPoints(p1, p2)).toBe(5);
      expect(distanceBetweenPoints(p1, p1)).toBe(0);
    });
  });
});
