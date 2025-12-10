/**
 * Task Type System - Type Definitions
 *
 * This module defines TypeScript enums and interfaces for the task type system.
 *
 * Features:
 * - Type-safe task and annotation type enums
 * - TaskDefinition interface for task metadata
 * - IDE autocomplete support
 * - Compile-time type checking
 */

/**
 * Task Type Enumeration
 *
 * Defines all supported task types in the system.
 * Must match backend TaskType enum values.
 *
 * Benefits:
 * - Type safety (no string typos)
 * - IDE autocomplete
 * - Compile-time validation
 * - Single source of truth
 */
export enum TaskType {
  CLASSIFICATION = 'classification',
  DETECTION = 'detection',
  SEGMENTATION = 'segmentation',
  GEOMETRY = 'geometry',
  KEYPOINT = 'keypoint',
  LINE = 'line',
}

/**
 * Annotation Type Enumeration
 *
 * Defines all supported annotation types.
 * Must match backend AnnotationType enum values.
 *
 * Each annotation type belongs to one or more task types.
 */
export enum AnnotationType {
  CLASSIFICATION = 'classification',
  BBOX = 'bbox',
  ROTATED_BBOX = 'rotated_bbox',
  POLYGON = 'polygon',
  POLYLINE = 'polyline',
  CIRCLE = 'circle',
  KEYPOINT = 'keypoint',
  LINE = 'line',
  NO_OBJECT = 'no_object',
}

/**
 * Task Definition Interface
 *
 * Defines the structure for task metadata.
 * Each task type has a corresponding definition object.
 *
 * Example:
 *   const detectionTask: TaskDefinition = {
 *     id: TaskType.DETECTION,
 *     name: 'Object Detection',
 *     description: 'Draw bounding boxes around objects',
 *     annotationTypes: [AnnotationType.BBOX, AnnotationType.ROTATED_BBOX],
 *     tools: ['bbox', 'rotated_bbox'],
 *     exportFormats: ['coco', 'yolo', 'voc'],
 *     defaultConfig: { ... }
 *   };
 */
export interface TaskDefinition {
  /**
   * Unique task identifier (TaskType enum value)
   */
  id: TaskType;

  /**
   * Human-readable task name
   * @example "Object Detection"
   */
  name: string;

  /**
   * Task description for UI/documentation
   * @example "Draw bounding boxes around objects to detect and localize them"
   */
  description: string;

  /**
   * List of annotation types this task supports
   * @example [AnnotationType.BBOX, AnnotationType.ROTATED_BBOX]
   */
  annotationTypes: AnnotationType[];

  /**
   * List of tool type IDs available for this task
   * @example ['bbox', 'rotated_bbox']
   */
  tools: string[];

  /**
   * List of export formats this task supports
   * @example ['coco', 'yolo', 'voc', 'dice']
   */
  exportFormats: string[];

  /**
   * Default configuration for this task
   * @example { showLabels: true, minBboxSize: 5 }
   */
  defaultConfig: TaskConfig;

  /**
   * Optional icon identifier for UI
   * @example 'bounding-box' or 'polygon'
   */
  icon?: string;

  /**
   * Optional color for UI theming
   * @example '#3b82f6' (blue)
   */
  color?: string;
}

/**
 * Task Configuration
 *
 * Generic configuration object for task-specific settings.
 * Each task type can define its own config structure.
 */
export interface TaskConfig {
  /**
   * Show class labels on annotations
   */
  showLabels?: boolean;

  /**
   * Show confidence scores (for predictions)
   */
  showConfidence?: boolean;

  /**
   * Allow overlapping annotations
   */
  allowOverlap?: boolean;

  /**
   * Fill opacity for shapes (0.0 - 1.0)
   */
  fillOpacity?: number;

  /**
   * Line width for drawing
   */
  lineWidth?: number;

  /**
   * Additional task-specific settings
   */
  [key: string]: any;
}

/**
 * Type guard: Check if a string is a valid TaskType
 *
 * @param value - String to check
 * @returns True if value is a valid TaskType enum value
 *
 * @example
 *   if (isTaskType('detection')) {
 *     // TypeScript knows value is TaskType
 *   }
 */
export function isTaskType(value: string): value is TaskType {
  return Object.values(TaskType).includes(value as TaskType);
}

/**
 * Type guard: Check if a string is a valid AnnotationType
 *
 * @param value - String to check
 * @returns True if value is a valid AnnotationType enum value
 */
export function isAnnotationType(value: string): value is AnnotationType {
  return Object.values(AnnotationType).includes(value as AnnotationType);
}

/**
 * Helper: Get task type from string with validation
 *
 * @param value - String value to convert
 * @returns TaskType enum value or null if invalid
 *
 * @example
 *   const taskType = getTaskType('detection');
 *   // Returns: TaskType.DETECTION
 */
export function getTaskType(value: string): TaskType | null {
  return isTaskType(value) ? (value as TaskType) : null;
}

/**
 * Helper: Get annotation type from string with validation
 *
 * @param value - String value to convert
 * @returns AnnotationType enum value or null if invalid
 */
export function getAnnotationType(value: string): AnnotationType | null {
  return isAnnotationType(value) ? (value as AnnotationType) : null;
}
