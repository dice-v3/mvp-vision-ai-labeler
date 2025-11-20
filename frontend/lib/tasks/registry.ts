/**
 * Task Registry - Centralized Task Management
 *
 * This module implements a registry for all task types in the frontend.
 *
 * Features:
 * - Centralized task definition storage
 * - Lookup by task type or annotation type
 * - Reverse mapping (annotation type -> task type)
 * - Type-safe APIs
 *
 * Usage:
 *   import { taskRegistry, TaskType } from '@/lib/tasks';
 *
 *   // Get task definition
 *   const task = taskRegistry.get(TaskType.DETECTION);
 *
 *   // Get tools for task
 *   const tools = taskRegistry.getToolsForTask(TaskType.DETECTION);
 *
 *   // Get annotation types for task
 *   const types = taskRegistry.getAnnotationTypesForTask(TaskType.DETECTION);
 */

import { TaskType, AnnotationType, TaskDefinition } from './types';

/**
 * TaskRegistry Class
 *
 * Manages all task definitions and provides lookup methods.
 *
 * This class uses a singleton-like pattern where a single instance
 * is exported and used throughout the application.
 */
export class TaskRegistry {
  /**
   * Internal storage for task definitions
   * Maps TaskType enum to TaskDefinition object
   */
  private tasks: Map<TaskType, TaskDefinition> = new Map();

  /**
   * Register a task definition
   *
   * @param task - TaskDefinition to register
   * @throws Error if task type is already registered
   *
   * @example
   *   taskRegistry.register(detectionTask);
   */
  register(task: TaskDefinition): void {
    if (this.tasks.has(task.id)) {
      throw new Error(
        `Task type ${task.id} is already registered`
      );
    }

    this.tasks.set(task.id, task);
    console.log(`[TaskRegistry] Registered: ${task.id} -> ${task.name}`);
  }

  /**
   * Get task definition by type
   *
   * @param taskType - TaskType enum value
   * @returns TaskDefinition or undefined if not found
   *
   * @example
   *   const task = taskRegistry.get(TaskType.DETECTION);
   *   if (task) {
   *     console.log(task.name); // "Object Detection"
   *   }
   */
  get(taskType: TaskType): TaskDefinition | undefined {
    return this.tasks.get(taskType);
  }

  /**
   * Get all registered task definitions
   *
   * @returns Array of all TaskDefinition objects
   *
   * @example
   *   const allTasks = taskRegistry.getAll();
   *   allTasks.forEach(task => console.log(task.name));
   */
  getAll(): TaskDefinition[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get all registered task types
   *
   * @returns Array of TaskType enum values
   *
   * @example
   *   const types = taskRegistry.getAllTaskTypes();
   *   // [TaskType.CLASSIFICATION, TaskType.DETECTION, ...]
   */
  getAllTaskTypes(): TaskType[] {
    return Array.from(this.tasks.keys());
  }

  /**
   * Get annotation types supported by a task
   *
   * @param taskType - TaskType to query
   * @returns Array of AnnotationType enums, or empty array if task not found
   *
   * @example
   *   const types = taskRegistry.getAnnotationTypesForTask(TaskType.DETECTION);
   *   // [AnnotationType.BBOX, AnnotationType.ROTATED_BBOX]
   */
  getAnnotationTypesForTask(taskType: TaskType): AnnotationType[] {
    const task = this.get(taskType);
    return task ? task.annotationTypes : [];
  }

  /**
   * Get tool IDs available for a task
   *
   * @param taskType - TaskType to query
   * @returns Array of tool type IDs, or empty array if task not found
   *
   * @example
   *   const tools = taskRegistry.getToolsForTask(TaskType.DETECTION);
   *   // ['bbox', 'rotated_bbox']
   */
  getToolsForTask(taskType: TaskType): string[] {
    const task = this.get(taskType);
    return task ? task.tools : [];
  }

  /**
   * Get export formats supported by a task
   *
   * @param taskType - TaskType to query
   * @returns Array of export format identifiers
   *
   * @example
   *   const formats = taskRegistry.getExportFormatsForTask(TaskType.DETECTION);
   *   // ['coco', 'yolo', 'voc', 'dice']
   */
  getExportFormatsForTask(taskType: TaskType): string[] {
    const task = this.get(taskType);
    return task ? task.exportFormats : [];
  }

  /**
   * Reverse lookup: Find task type for an annotation type
   *
   * This is critical for inferring task type from annotation data.
   *
   * @param annotationType - AnnotationType to look up
   * @returns TaskType that supports this annotation type, or null
   *
   * @note If multiple tasks support the same annotation type,
   *       returns the first match. In practice, annotation types
   *       are unique to tasks (except no_object).
   *
   * @example
   *   const taskType = taskRegistry.getTaskForAnnotationType(
   *     AnnotationType.BBOX
   *   );
   *   // Returns: TaskType.DETECTION
   */
  getTaskForAnnotationType(
    annotationType: AnnotationType
  ): TaskType | null {
    for (const task of this.tasks.values()) {
      if (task.annotationTypes.includes(annotationType)) {
        return task.id;
      }
    }
    return null;
  }

  /**
   * Check if a task type is registered
   *
   * @param taskType - TaskType to check
   * @returns True if registered, false otherwise
   *
   * @example
   *   if (taskRegistry.isValidTaskType(TaskType.DETECTION)) {
   *     console.log('Detection task is available');
   *   }
   */
  isValidTaskType(taskType: TaskType): boolean {
    return this.tasks.has(taskType);
  }

  /**
   * Check if an annotation type is valid for a task
   *
   * @param taskType - TaskType to check
   * @param annotationType - AnnotationType to validate
   * @returns True if annotation type is supported by task
   *
   * @example
   *   const isValid = taskRegistry.isValidAnnotationTypeForTask(
   *     TaskType.DETECTION,
   *     AnnotationType.BBOX
   *   );
   *   // Returns: true
   */
  isValidAnnotationTypeForTask(
    taskType: TaskType,
    annotationType: AnnotationType
  ): boolean {
    const annotationTypes = this.getAnnotationTypesForTask(taskType);
    return annotationTypes.includes(annotationType);
  }

  /**
   * Get default config for a task
   *
   * @param taskType - TaskType to query
   * @returns Task config object or empty object if task not found
   *
   * @example
   *   const config = taskRegistry.getDefaultConfig(TaskType.DETECTION);
   *   // { showLabels: true, minBboxSize: 5, ... }
   */
  getDefaultConfig(taskType: TaskType): Record<string, any> {
    const task = this.get(taskType);
    return task ? task.defaultConfig : {};
  }

  /**
   * Get number of registered tasks
   *
   * @returns Count of registered tasks
   */
  get size(): number {
    return this.tasks.size;
  }

  /**
   * Clear all registered tasks (for testing)
   *
   * @internal
   */
  clear(): void {
    this.tasks.clear();
    console.log('[TaskRegistry] Cleared all tasks');
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `TaskRegistry(${this.size} tasks: ${this.getAllTaskTypes().join(', ')})`;
  }
}

/**
 * Global singleton instance
 *
 * All modules should import this instance instead of creating their own.
 *
 * @example
 *   import { taskRegistry } from '@/lib/tasks';
 *   const task = taskRegistry.get(TaskType.DETECTION);
 */
export const taskRegistry = new TaskRegistry();
