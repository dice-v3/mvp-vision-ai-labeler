/**
 * Task Type System - Frontend
 *
 * This module implements a plugin-based architecture for task types in the frontend.
 *
 * Architecture:
 * - TaskType and AnnotationType enums for type safety
 * - TaskDefinition interface for task metadata
 * - TaskRegistry class for centralized management
 * - Task-specific definitions (detection, segmentation, etc.)
 *
 * Usage:
 *   import { TaskType, taskRegistry } from '@/lib/tasks';
 *
 *   // Get task definition
 *   const task = taskRegistry.get(TaskType.DETECTION);
 *
 *   // Get tools for task
 *   const tools = taskRegistry.getToolsForTask(TaskType.DETECTION);
 *
 *   // Initialize tasks (call once at app startup)
 *   initializeTasks();
 */

// This file will be populated during Phase 1 implementation
// TODO: Export TaskType, AnnotationType, TaskRegistry, initializeTasks, etc.

/**
 * Initialize all task definitions
 * Call this function once during app initialization
 */
export function initializeTasks(): void {
  // TODO: Register all tasks during Phase 1
  console.log('[Tasks] Task registry not yet implemented - Phase 1 pending');
}
