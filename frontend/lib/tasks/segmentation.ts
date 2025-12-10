/**
 * Segmentation Task Definition
 *
 * Pixel-level segmentation task for precise object boundaries.
 */

import { TaskType, AnnotationType, TaskDefinition } from './types';

/**
 * Segmentation task definition object
 *
 * Defines metadata for the segmentation task:
 * - Polygon annotations for precise boundaries
 * - COCO segmentation, mask COCO export formats
 * - Polygon tool with vertex editing
 */
export const segmentationTask: TaskDefinition = {
  id: TaskType.SEGMENTATION,

  name: 'Segmentation',

  description: 'Draw polygons around objects to create precise segmentation masks. Supports multi-point polygons for complex shapes.',

  annotationTypes: [
    AnnotationType.POLYGON,
  ],

  tools: [
    'polygon',
  ],

  exportFormats: [
    'coco',
    'mask_coco',
    'dice',
  ],

  defaultConfig: {
    showLabels: true,
    fillOpacity: 0.3,
    minVertices: 3,
    maxVertices: 1000,
    showVertices: true,
    vertexRadius: 4,
    allowHoles: false,
    lineWidth: 2,
  },

  icon: 'polygon',

  color: '#10b981', // Green
};
