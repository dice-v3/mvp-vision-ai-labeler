/**
 * Classification Task Definition
 *
 * Image-level classification task for assigning class labels to entire images.
 */

import { TaskType, AnnotationType, TaskDefinition } from './types';

/**
 * Classification task definition object
 *
 * Defines metadata for the classification task:
 * - Image-level class labels
 * - No object markers for negative examples
 * - DICE, CSV, JSON export formats
 */
export const classificationTask: TaskDefinition = {
  id: TaskType.CLASSIFICATION,

  name: 'Classification',

  description: 'Assign class labels to entire images. Supports single-label and multi-label classification.',

  annotationTypes: [
    AnnotationType.CLASSIFICATION,
    AnnotationType.NO_OBJECT,
  ],

  tools: [
    'classification',
  ],

  exportFormats: [
    'dice',
    'csv',
    'json',
  ],

  defaultConfig: {
    multiLabel: false,
    allowNoObject: true,
    requireConfirmation: true,
    showImagePreview: true,
  },

  icon: 'tag',

  color: '#f59e0b', // Amber
};
