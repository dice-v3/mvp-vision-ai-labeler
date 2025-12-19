/**
 * Annotation Helper Functions
 *
 * Utility functions for transforming and manipulating annotation data.
 * These functions handle conversion between different annotation formats.
 *
 * @module annotationHelpers
 */

/**
 * Annotation interface (simplified)
 */
export interface Annotation {
  id: string;
  image_id: number;
  geometry: {
    type: string;
    bbox?: number[];
    points?: [number, number][];
    center?: [number, number];
    radius?: number;
    [key: string]: any;
  };
  class_id?: number;
  class_name?: string;
  annotationType?: string;
  version?: number;
  [key: string]: any;
}

/**
 * Convert annotation snapshot (backend format) to frontend annotation format
 *
 * Phase 11: Handles conversion from R2 published format or DB working format.
 *
 * Backend formats:
 * - DB/Working: {x, y, width, height}
 * - R2/Published: {bbox: [x, y, w, h], type, image_width, image_height}
 *
 * Frontend format: {type, bbox: [x, y, w, h]} or {type, points: [[x, y], ...]}
 *
 * @param snapshot - Backend annotation snapshot
 * @param tempId - Temporary ID to assign (for diff rendering)
 * @returns Annotation in frontend format
 */
export function snapshotToAnnotation(snapshot: any, tempId: string): Annotation {
  // Convert backend geometry format to frontend format
  let geometry: any;

  if (snapshot.annotation_type === 'bbox' && snapshot.geometry) {
    // Handle both formats:
    // - DB/Working: {x, y, width, height}
    // - R2/Published: {bbox: [x, y, w, h], type, image_width, image_height}
    if (snapshot.geometry.bbox && Array.isArray(snapshot.geometry.bbox)) {
      // R2 format: already has bbox array
      geometry = {
        type: 'bbox',
        bbox: snapshot.geometry.bbox
      };
    } else {
      // DB format: convert {x, y, width, height} to bbox array
      geometry = {
        type: 'bbox',
        bbox: [
          snapshot.geometry.x || 0,
          snapshot.geometry.y || 0,
          snapshot.geometry.width || 0,
          snapshot.geometry.height || 0
        ]
      };
    }
  } else if (snapshot.annotation_type === 'polygon' && snapshot.geometry) {
    // Polygon: {points: [[x,y], ...]} → same format
    geometry = {
      type: 'polygon',
      points: snapshot.geometry.points || []
    };
  } else if (snapshot.annotation_type === 'polyline' && snapshot.geometry) {
    geometry = {
      type: 'polyline',
      points: snapshot.geometry.points || []
    };
  } else if (snapshot.annotation_type === 'circle' && snapshot.geometry) {
    geometry = {
      type: 'circle',
      center: snapshot.geometry.center || [0, 0],
      radius: snapshot.geometry.radius || 0
    };
  } else {
    // Fallback: spread as-is
    geometry = {
      type: snapshot.annotation_type,
      ...snapshot.geometry,
    };
  }

  return {
    id: tempId,
    image_id: snapshot.image_id,
    geometry,
    class_id: snapshot.class_id,
    class_name: snapshot.class_name,
    annotationType: snapshot.annotation_type,
  };
}

/**
 * Convert frontend annotation to backend snapshot format
 *
 * @param annotation - Frontend annotation
 * @returns Backend snapshot format
 */
export function annotationToSnapshot(annotation: Annotation): any {
  const snapshot: any = {
    image_id: annotation.image_id,
    annotation_type: annotation.geometry.type || annotation.annotationType,
    class_id: annotation.class_id,
    class_name: annotation.class_name,
    geometry: {},
  };

  if (annotation.geometry.type === 'bbox' && annotation.geometry.bbox) {
    // Convert bbox array to object format for backend
    const [x, y, width, height] = annotation.geometry.bbox;
    snapshot.geometry = { x, y, width, height };
  } else if (annotation.geometry.type === 'polygon' && annotation.geometry.points) {
    snapshot.geometry = { points: annotation.geometry.points };
  } else if (annotation.geometry.type === 'polyline' && annotation.geometry.points) {
    snapshot.geometry = { points: annotation.geometry.points };
  } else if (annotation.geometry.type === 'circle') {
    snapshot.geometry = {
      center: annotation.geometry.center,
      radius: annotation.geometry.radius
    };
  } else {
    // Fallback: copy as-is
    snapshot.geometry = { ...annotation.geometry };
  }

  return snapshot;
}

/**
 * Check if an annotation should be displayed based on filters
 *
 * @param annotation - Annotation to check
 * @param filters - Visibility filters
 * @returns True if annotation should be displayed
 */
export function isAnnotationVisible(
  annotation: Annotation,
  filters: {
    hiddenClasses?: Set<number>;
    showDraftsOnly?: boolean;
    annotationState?: string;
  } = {}
): boolean {
  const { hiddenClasses, showDraftsOnly, annotationState } = filters;

  // Check class visibility
  if (hiddenClasses && annotation.class_id && hiddenClasses.has(annotation.class_id)) {
    return false;
  }

  // Check draft filter
  if (showDraftsOnly) {
    const state = (annotation as any).annotation_state || (annotation as any).annotationState || 'draft';
    return state === 'draft';
  }

  // Check annotation state filter
  if (annotationState) {
    const state = (annotation as any).annotation_state || (annotation as any).annotationState || 'draft';
    return state === annotationState;
  }

  return true;
}

/**
 * Sort annotations by z-index for rendering order
 *
 * Annotations are sorted by:
 * 1. Selected annotation (always on top)
 * 2. Annotation type (certain types render first)
 * 3. Creation order (ID)
 *
 * @param annotations - Annotations to sort
 * @param selectedId - ID of selected annotation (rendered last/on top)
 * @returns Sorted annotations
 */
export function sortAnnotationsByZIndex(
  annotations: Annotation[],
  selectedId?: string | null
): Annotation[] {
  // Type priority (lower = render first/bottom)
  const typePriority: { [key: string]: number } = {
    'polygon': 1,
    'bbox': 2,
    'polyline': 3,
    'circle': 4,
    'no_object': 5,
  };

  return [...annotations].sort((a, b) => {
    // Selected annotation always on top
    if (a.id === selectedId) return 1;
    if (b.id === selectedId) return -1;

    // Sort by type priority
    const aPriority = typePriority[a.geometry.type] || 0;
    const bPriority = typePriority[b.geometry.type] || 0;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Sort by ID (creation order)
    return a.id.localeCompare(b.id);
  });
}

/**
 * Calculate bounding box for any annotation type
 *
 * Returns the rectangular bounds that fully contain the annotation.
 *
 * @param annotation - Annotation to calculate bounds for
 * @returns Bounding box as [x, y, width, height]
 */
export function calculateAnnotationBounds(annotation: Annotation): [number, number, number, number] {
  const { geometry } = annotation;

  if (geometry.type === 'bbox' && geometry.bbox) {
    return geometry.bbox as [number, number, number, number];
  }

  if ((geometry.type === 'polygon' || geometry.type === 'polyline') && geometry.points) {
    const xs = geometry.points.map(p => p[0]);
    const ys = geometry.points.map(p => p[1]);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return [minX, minY, maxX - minX, maxY - minY];
  }

  if (geometry.type === 'circle' && geometry.center && geometry.radius) {
    const [cx, cy] = geometry.center;
    const r = geometry.radius;

    return [cx - r, cy - r, r * 2, r * 2];
  }

  // Fallback: return zero bounds
  return [0, 0, 0, 0];
}
