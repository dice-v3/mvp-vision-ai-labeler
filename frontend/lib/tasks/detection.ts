/**
 * Detection Task Definition
 *
 * Object detection task for identifying and localizing objects with bounding boxes.
 */

import { TaskType, AnnotationType, TaskDefinition } from './types';

/**
 * Detection task definition object
 *
 * Defines metadata for the object detection task:
 * - Bounding box annotations
 * - COCO, YOLO, VOC export formats
 * - Bbox and rotated bbox tools
 */
export const detectionTask: TaskDefinition = {
  id: TaskType.DETECTION,

  name: 'Object Detection',

  description: 'Draw bounding boxes around objects to detect and localize them. Supports axis-aligned and rotated bounding boxes.',

  annotationTypes: [
    AnnotationType.BBOX,
    AnnotationType.ROTATED_BBOX,
  ],

  tools: [
    'bbox',
    'rotated_bbox',
  ],

  exportFormats: [
    'coco',
    'yolo',
    'voc',
    'dice',
  ],

  defaultConfig: {
    showLabels: true,
    showConfidence: false,
    minBboxSize: 5,
    allowOverlap: true,
    bboxColorMode: 'by_class',
    lineWidth: 2,
  },

  icon: 'bounding-box',

  color: '#3b82f6', // Blue
};
