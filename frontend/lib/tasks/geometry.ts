/**
 * Geometry Task Definition
 *
 * Geometric shape annotation task for lines, polylines, and circles.
 */

import { TaskType, AnnotationType, TaskDefinition } from './types';

/**
 * Geometry task definition object
 *
 * Defines metadata for the geometry task:
 * - Polyline annotations (multi-point lines)
 * - Circle annotations (center + radius, or 3-point)
 * - DICE, JSON export formats
 */
export const geometryTask: TaskDefinition = {
  id: TaskType.GEOMETRY,

  name: 'Geometry',

  description: 'Annotate geometric shapes like polylines and circles. Useful for measurements, paths, and circular objects.',

  annotationTypes: [
    AnnotationType.POLYLINE,
    AnnotationType.CIRCLE,
  ],

  tools: [
    'polyline',
    'circle',      // Circle (2-Point): center + edge
    'circle_3p',   // Circle (3-Point): 3 circumference points
  ],

  exportFormats: [
    'dice',
    'json',
  ],

  defaultConfig: {
    showLabels: true,
    showMeasurements: false,
    minPolylinePoints: 2,
    maxPolylinePoints: 100,
    minCircleRadius: 5,
    showVertices: true,
    vertexRadius: 4,
    lineWidth: 2,
  },

  icon: 'shapes',

  color: '#8b5cf6', // Purple
};
