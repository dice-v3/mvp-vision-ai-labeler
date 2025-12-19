/**
 * Tests for annotationHelpers.ts
 *
 * Tests all annotation data transformation and manipulation functions.
 * Target coverage: >90%
 *
 * Phase 18.6: Comprehensive Testing
 */

import { describe, it, expect } from 'vitest';
import {
  snapshotToAnnotation,
  annotationToSnapshot,
  isAnnotationVisible,
  sortAnnotationsByZIndex,
  calculateAnnotationBounds,
  type Annotation,
} from '../annotationHelpers';

describe('annotationHelpers', () => {
  describe('snapshotToAnnotation', () => {
    it('should convert bbox snapshot from R2 format', () => {
      const snapshot = {
        image_id: 123,
        annotation_type: 'bbox',
        class_id: 1,
        class_name: 'person',
        geometry: {
          bbox: [10, 20, 100, 150],
          type: 'bbox',
        },
      };

      const result = snapshotToAnnotation(snapshot, 'temp-1');

      expect(result).toEqual({
        id: 'temp-1',
        image_id: 123,
        geometry: {
          type: 'bbox',
          bbox: [10, 20, 100, 150],
        },
        class_id: 1,
        class_name: 'person',
        annotationType: 'bbox',
      });
    });

    it('should convert bbox snapshot from DB format', () => {
      const snapshot = {
        image_id: 456,
        annotation_type: 'bbox',
        class_id: 2,
        class_name: 'car',
        geometry: {
          x: 50,
          y: 75,
          width: 200,
          height: 300,
        },
      };

      const result = snapshotToAnnotation(snapshot, 'temp-2');

      expect(result).toEqual({
        id: 'temp-2',
        image_id: 456,
        geometry: {
          type: 'bbox',
          bbox: [50, 75, 200, 300],
        },
        class_id: 2,
        class_name: 'car',
        annotationType: 'bbox',
      });
    });

    it('should handle bbox with missing values', () => {
      const snapshot = {
        image_id: 789,
        annotation_type: 'bbox',
        geometry: {
          // Missing x, y, width, height
        },
      };

      const result = snapshotToAnnotation(snapshot, 'temp-3');

      expect(result.geometry.bbox).toEqual([0, 0, 0, 0]);
    });

    it('should convert polygon snapshot', () => {
      const snapshot = {
        image_id: 100,
        annotation_type: 'polygon',
        class_id: 3,
        class_name: 'shape',
        geometry: {
          points: [[10, 20], [30, 40], [50, 60]],
        },
      };

      const result = snapshotToAnnotation(snapshot, 'temp-4');

      expect(result).toEqual({
        id: 'temp-4',
        image_id: 100,
        geometry: {
          type: 'polygon',
          points: [[10, 20], [30, 40], [50, 60]],
        },
        class_id: 3,
        class_name: 'shape',
        annotationType: 'polygon',
      });
    });

    it('should handle polygon with missing points', () => {
      const snapshot = {
        image_id: 101,
        annotation_type: 'polygon',
        geometry: {},
      };

      const result = snapshotToAnnotation(snapshot, 'temp-5');

      expect(result.geometry.points).toEqual([]);
    });

    it('should convert polyline snapshot', () => {
      const snapshot = {
        image_id: 200,
        annotation_type: 'polyline',
        geometry: {
          points: [[5, 10], [15, 20]],
        },
      };

      const result = snapshotToAnnotation(snapshot, 'temp-6');

      expect(result.geometry).toEqual({
        type: 'polyline',
        points: [[5, 10], [15, 20]],
      });
    });

    it('should convert circle snapshot', () => {
      const snapshot = {
        image_id: 300,
        annotation_type: 'circle',
        geometry: {
          center: [100, 150],
          radius: 50,
        },
      };

      const result = snapshotToAnnotation(snapshot, 'temp-7');

      expect(result.geometry).toEqual({
        type: 'circle',
        center: [100, 150],
        radius: 50,
      });
    });

    it('should handle circle with missing values', () => {
      const snapshot = {
        image_id: 301,
        annotation_type: 'circle',
        geometry: {},
      };

      const result = snapshotToAnnotation(snapshot, 'temp-8');

      expect(result.geometry.center).toEqual([0, 0]);
      expect(result.geometry.radius).toBe(0);
    });

    it('should handle unknown annotation types', () => {
      const snapshot = {
        image_id: 999,
        annotation_type: 'custom',
        geometry: {
          customProp: 'value',
        },
      };

      const result = snapshotToAnnotation(snapshot, 'temp-9');

      expect(result.geometry.type).toBe('custom');
      expect(result.geometry.customProp).toBe('value');
    });
  });

  describe('annotationToSnapshot', () => {
    it('should convert bbox annotation to backend format', () => {
      const annotation: Annotation = {
        id: 'ann-1',
        image_id: 123,
        geometry: {
          type: 'bbox',
          bbox: [10, 20, 100, 150],
        },
        class_id: 1,
        class_name: 'person',
      };

      const result = annotationToSnapshot(annotation);

      expect(result).toEqual({
        image_id: 123,
        annotation_type: 'bbox',
        class_id: 1,
        class_name: 'person',
        geometry: {
          x: 10,
          y: 20,
          width: 100,
          height: 150,
        },
      });
    });

    it('should convert polygon annotation to backend format', () => {
      const annotation: Annotation = {
        id: 'ann-2',
        image_id: 456,
        geometry: {
          type: 'polygon',
          points: [[10, 20], [30, 40], [50, 60]],
        },
        class_id: 2,
        class_name: 'shape',
      };

      const result = annotationToSnapshot(annotation);

      expect(result).toEqual({
        image_id: 456,
        annotation_type: 'polygon',
        class_id: 2,
        class_name: 'shape',
        geometry: {
          points: [[10, 20], [30, 40], [50, 60]],
        },
      });
    });

    it('should convert polyline annotation to backend format', () => {
      const annotation: Annotation = {
        id: 'ann-3',
        image_id: 789,
        geometry: {
          type: 'polyline',
          points: [[5, 10], [15, 20]],
        },
      };

      const result = annotationToSnapshot(annotation);

      expect(result.annotation_type).toBe('polyline');
      expect(result.geometry.points).toEqual([[5, 10], [15, 20]]);
    });

    it('should convert circle annotation to backend format', () => {
      const annotation: Annotation = {
        id: 'ann-4',
        image_id: 100,
        geometry: {
          type: 'circle',
          center: [100, 150],
          radius: 50,
        },
      };

      const result = annotationToSnapshot(annotation);

      expect(result).toEqual({
        image_id: 100,
        annotation_type: 'circle',
        class_id: undefined,
        class_name: undefined,
        geometry: {
          center: [100, 150],
          radius: 50,
        },
      });
    });

    it('should handle annotation with annotationType field', () => {
      const annotation: Annotation = {
        id: 'ann-5',
        image_id: 200,
        geometry: {
          type: 'bbox',
          bbox: [1, 2, 3, 4],
        },
        annotationType: 'bbox',
      };

      const result = annotationToSnapshot(annotation);

      expect(result.annotation_type).toBe('bbox');
    });

    it('should handle unknown geometry types', () => {
      const annotation: Annotation = {
        id: 'ann-6',
        image_id: 300,
        geometry: {
          type: 'custom',
          customProp: 'value',
        },
      };

      const result = annotationToSnapshot(annotation);

      expect(result.annotation_type).toBe('custom');
      expect(result.geometry.customProp).toBe('value');
    });
  });

  describe('isAnnotationVisible', () => {
    const annotation: Annotation = {
      id: 'test-1',
      image_id: 1,
      geometry: { type: 'bbox', bbox: [0, 0, 10, 10] },
      class_id: 5,
    };

    it('should return true with no filters', () => {
      expect(isAnnotationVisible(annotation)).toBe(true);
      expect(isAnnotationVisible(annotation, {})).toBe(true);
    });

    it('should respect hiddenClasses filter', () => {
      const hiddenClasses = new Set([5, 7, 9]);

      expect(isAnnotationVisible(annotation, { hiddenClasses })).toBe(false);
    });

    it('should show annotation when class is not hidden', () => {
      const hiddenClasses = new Set([1, 2, 3]);

      expect(isAnnotationVisible(annotation, { hiddenClasses })).toBe(true);
    });

    it('should handle annotation without class_id', () => {
      const noClassAnnotation: Annotation = {
        id: 'test-2',
        image_id: 1,
        geometry: { type: 'bbox', bbox: [0, 0, 10, 10] },
      };

      const hiddenClasses = new Set([5]);

      expect(isAnnotationVisible(noClassAnnotation, { hiddenClasses })).toBe(true);
    });

    it('should filter by draft status', () => {
      const draftAnnotation: Annotation = {
        id: 'test-3',
        image_id: 1,
        geometry: { type: 'bbox', bbox: [0, 0, 10, 10] },
        annotation_state: 'draft',
      };

      const publishedAnnotation: Annotation = {
        id: 'test-4',
        image_id: 1,
        geometry: { type: 'bbox', bbox: [0, 0, 10, 10] },
        annotation_state: 'published',
      };

      expect(isAnnotationVisible(draftAnnotation, { showDraftsOnly: true })).toBe(true);
      expect(isAnnotationVisible(publishedAnnotation, { showDraftsOnly: true })).toBe(false);
    });

    it('should treat missing annotation_state as draft', () => {
      const noStateAnnotation: Annotation = {
        id: 'test-5',
        image_id: 1,
        geometry: { type: 'bbox', bbox: [0, 0, 10, 10] },
      };

      expect(isAnnotationVisible(noStateAnnotation, { showDraftsOnly: true })).toBe(true);
    });

    it('should filter by annotation state', () => {
      const publishedAnnotation: Annotation = {
        id: 'test-6',
        image_id: 1,
        geometry: { type: 'bbox', bbox: [0, 0, 10, 10] },
        annotationState: 'published',
      };

      expect(isAnnotationVisible(publishedAnnotation, { annotationState: 'published' })).toBe(true);
      expect(isAnnotationVisible(publishedAnnotation, { annotationState: 'draft' })).toBe(false);
    });

    it('should combine multiple filters', () => {
      const draftAnnotation: Annotation = {
        id: 'test-7',
        image_id: 1,
        geometry: { type: 'bbox', bbox: [0, 0, 10, 10] },
        class_id: 5,
        annotation_state: 'draft',
      };

      const hiddenClasses = new Set([5]);

      // Hidden class takes precedence
      expect(isAnnotationVisible(draftAnnotation, { hiddenClasses, showDraftsOnly: true })).toBe(false);
    });
  });

  describe('sortAnnotationsByZIndex', () => {
    const annotations: Annotation[] = [
      {
        id: 'bbox-1',
        image_id: 1,
        geometry: { type: 'bbox', bbox: [0, 0, 10, 10] },
      },
      {
        id: 'polygon-1',
        image_id: 1,
        geometry: { type: 'polygon', points: [[0, 0], [10, 10], [0, 10]] },
      },
      {
        id: 'circle-1',
        image_id: 1,
        geometry: { type: 'circle', center: [5, 5], radius: 10 },
      },
      {
        id: 'polyline-1',
        image_id: 1,
        geometry: { type: 'polyline', points: [[0, 0], [10, 10]] },
      },
    ];

    it('should sort by type priority (polygon < bbox < polyline < circle)', () => {
      const sorted = sortAnnotationsByZIndex(annotations);

      expect(sorted[0].geometry.type).toBe('polygon');
      expect(sorted[1].geometry.type).toBe('bbox');
      expect(sorted[2].geometry.type).toBe('polyline');
      expect(sorted[3].geometry.type).toBe('circle');
    });

    it('should put selected annotation on top', () => {
      const sorted = sortAnnotationsByZIndex(annotations, 'polygon-1');

      // Selected polygon should be last (on top)
      expect(sorted[sorted.length - 1].id).toBe('polygon-1');
    });

    it('should sort by ID when same type', () => {
      const sameTypeAnnotations: Annotation[] = [
        { id: 'bbox-3', image_id: 1, geometry: { type: 'bbox', bbox: [0, 0, 10, 10] } },
        { id: 'bbox-1', image_id: 1, geometry: { type: 'bbox', bbox: [0, 0, 10, 10] } },
        { id: 'bbox-2', image_id: 1, geometry: { type: 'bbox', bbox: [0, 0, 10, 10] } },
      ];

      const sorted = sortAnnotationsByZIndex(sameTypeAnnotations);

      expect(sorted[0].id).toBe('bbox-1');
      expect(sorted[1].id).toBe('bbox-2');
      expect(sorted[2].id).toBe('bbox-3');
    });

    it('should not mutate original array', () => {
      const original = [...annotations];
      sortAnnotationsByZIndex(annotations);

      expect(annotations).toEqual(original);
    });

    it('should handle empty array', () => {
      const sorted = sortAnnotationsByZIndex([]);

      expect(sorted).toEqual([]);
    });

    it('should handle single annotation', () => {
      const sorted = sortAnnotationsByZIndex([annotations[0]]);

      expect(sorted).toEqual([annotations[0]]);
    });

    it('should handle unknown types with default priority', () => {
      const customAnnotations: Annotation[] = [
        { id: 'custom-1', image_id: 1, geometry: { type: 'custom' as any } },
        { id: 'bbox-1', image_id: 1, geometry: { type: 'bbox', bbox: [0, 0, 10, 10] } },
      ];

      const sorted = sortAnnotationsByZIndex(customAnnotations);

      // Unknown types get priority 0, so they should come first
      expect(sorted[0].geometry.type).toBe('custom');
    });

    it('should handle null selected ID', () => {
      const sorted = sortAnnotationsByZIndex(annotations, null);

      // Should sort normally without selection
      expect(sorted[0].geometry.type).toBe('polygon');
    });
  });

  describe('calculateAnnotationBounds', () => {
    it('should return bbox for bbox annotation', () => {
      const annotation: Annotation = {
        id: 'test-1',
        image_id: 1,
        geometry: {
          type: 'bbox',
          bbox: [10, 20, 100, 150],
        },
      };

      const bounds = calculateAnnotationBounds(annotation);

      expect(bounds).toEqual([10, 20, 100, 150]);
    });

    it('should calculate bounds for polygon', () => {
      const annotation: Annotation = {
        id: 'test-2',
        image_id: 1,
        geometry: {
          type: 'polygon',
          points: [[10, 20], [100, 50], [50, 150]],
        },
      };

      const bounds = calculateAnnotationBounds(annotation);

      // minX=10, maxX=100, minY=20, maxY=150
      expect(bounds).toEqual([10, 20, 90, 130]); // [10, 20, 100-10, 150-20]
    });

    it('should calculate bounds for polyline', () => {
      const annotation: Annotation = {
        id: 'test-3',
        image_id: 1,
        geometry: {
          type: 'polyline',
          points: [[5, 10], [15, 30], [25, 20]],
        },
      };

      const bounds = calculateAnnotationBounds(annotation);

      // minX=5, maxX=25, minY=10, maxY=30
      expect(bounds).toEqual([5, 10, 20, 20]); // [5, 10, 25-5, 30-10]
    });

    it('should calculate bounds for circle', () => {
      const annotation: Annotation = {
        id: 'test-4',
        image_id: 1,
        geometry: {
          type: 'circle',
          center: [100, 150],
          radius: 50,
        },
      };

      const bounds = calculateAnnotationBounds(annotation);

      // [cx - r, cy - r, r * 2, r * 2]
      expect(bounds).toEqual([50, 100, 100, 100]);
    });

    it('should handle polygon with single point', () => {
      const annotation: Annotation = {
        id: 'test-5',
        image_id: 1,
        geometry: {
          type: 'polygon',
          points: [[10, 20]],
        },
      };

      const bounds = calculateAnnotationBounds(annotation);

      // Single point has zero width/height
      expect(bounds).toEqual([10, 20, 0, 0]);
    });

    it('should handle negative coordinates', () => {
      const annotation: Annotation = {
        id: 'test-6',
        image_id: 1,
        geometry: {
          type: 'polygon',
          points: [[-10, -20], [10, 20]],
        },
      };

      const bounds = calculateAnnotationBounds(annotation);

      // [-10, -20, 20, 40]
      expect(bounds).toEqual([-10, -20, 20, 40]);
    });

    it('should return zero bounds for unknown types', () => {
      const annotation: Annotation = {
        id: 'test-7',
        image_id: 1,
        geometry: {
          type: 'unknown' as any,
        },
      };

      const bounds = calculateAnnotationBounds(annotation);

      expect(bounds).toEqual([0, 0, 0, 0]);
    });

    it('should handle bbox without bbox property', () => {
      const annotation: Annotation = {
        id: 'test-8',
        image_id: 1,
        geometry: {
          type: 'bbox',
        },
      };

      const bounds = calculateAnnotationBounds(annotation);

      expect(bounds).toEqual([0, 0, 0, 0]);
    });

    it('should handle polygon without points', () => {
      const annotation: Annotation = {
        id: 'test-9',
        image_id: 1,
        geometry: {
          type: 'polygon',
        },
      };

      const bounds = calculateAnnotationBounds(annotation);

      expect(bounds).toEqual([0, 0, 0, 0]);
    });

    it('should handle circle without center or radius', () => {
      const annotation: Annotation = {
        id: 'test-10',
        image_id: 1,
        geometry: {
          type: 'circle',
        },
      };

      const bounds = calculateAnnotationBounds(annotation);

      expect(bounds).toEqual([0, 0, 0, 0]);
    });
  });
});
