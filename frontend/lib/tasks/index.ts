/**
 * Task Type System - Frontend
 *
 * This module implements a plugin-based architecture for task types in the frontend.
 *
 * Architecture:
 * - TaskType and AnnotationType enums for type safety
 * - TaskDefinition interface for task metadata
 * - TaskRegistry class for centralized management
 * - Task-specific definitions (detection, segmentation, classification, geometry)
 *
 * Usage:
 *   import { TaskType, AnnotationType, taskRegistry, initializeTasks } from '@/lib/tasks';
 *
 *   // Initialize tasks (call once at app startup)
 *   initializeTasks();
 *
 *   // Get task definition
 *   const task = taskRegistry.get(TaskType.DETECTION);
 *
 *   // Get tools for task
 *   const tools = taskRegistry.getToolsForTask(TaskType.DETECTION);
 *
 *   // Get annotation types for task
 *   const types = taskRegistry.getAnnotationTypesForTask(TaskType.DETECTION);
 *
 *   // Reverse lookup: find task for annotation type
 *   const taskType = taskRegistry.getTaskForAnnotationType(AnnotationType.BBOX);
 */

// Export types and enums
export {
  TaskType,
  AnnotationType,
  type TaskDefinition,
  type TaskConfig,
  isTaskType,
  isAnnotationType,
  getTaskType,
  getAnnotationType,
} from './types';

// Export registry
export { TaskRegistry, taskRegistry } from './registry';

// Export task definitions
export { detectionTask } from './detection';
export { segmentationTask } from './segmentation';
export { classificationTask } from './classification';
export { geometryTask } from './geometry';

// Import for initialization
import { taskRegistry } from './registry';
import { detectionTask } from './detection';
import { segmentationTask } from './segmentation';
import { classificationTask } from './classification';
import { geometryTask } from './geometry';

/**
 * Initialize all task definitions
 *
 * This function registers all task types with the registry.
 * Call this once during app initialization (e.g., in layout.tsx or _app.tsx).
 *
 * @throws Error if any task fails to register
 *
 * @example
 *   // In app/layout.tsx or _app.tsx
 *   import { initializeTasks } from '@/lib/tasks';
 *
 *   useEffect(() => {
 *     initializeTasks();
 *   }, []);
 */
export function initializeTasks(): void {
  try {
    // Register all tasks
    taskRegistry.register(classificationTask);
    taskRegistry.register(detectionTask);
    taskRegistry.register(segmentationTask);
    taskRegistry.register(geometryTask);

    console.log(
      `[Tasks] Successfully registered ${taskRegistry.size} task types:`,
      taskRegistry.getAllTaskTypes()
    );
  } catch (error) {
    console.error('[Tasks] ERROR: Failed to initialize tasks:', error);
    throw error;
  }
}

/**
 * Auto-initialize tasks on module import (optional)
 *
 * This ensures tasks are available immediately when the module is imported.
 * If you prefer manual initialization, comment this out and call
 * initializeTasks() explicitly in your app setup.
 */
try {
  initializeTasks();
} catch (error) {
  console.error('[Tasks] Failed to auto-initialize tasks:', error);
}
