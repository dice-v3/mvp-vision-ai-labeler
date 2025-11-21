/**
 * Class management API client functions - REFACTORED
 *
 * REFACTORING CHANGES:
 * - All class operations now require task_type parameter
 * - Classes are task-specific (no more project-wide classes)
 * - Matches backend refactoring (task_classes only)
 */

import { apiClient } from './client';

export interface ClassInfo {
  name: string;
  color: string;
  description?: string;
  order?: number;
  image_count?: number;
  bbox_count?: number;
}

export interface ClassCreateRequest {
  class_id?: string; // Optional - auto-generated if not provided
  name: string;
  color: string;
  description?: string;
}

export interface ClassUpdateRequest {
  name?: string;
  color?: string;
  description?: string;
  order?: number;
}

export interface ClassReorderRequest {
  class_ids: string[];
}

export interface ClassResponse {
  class_id: string;
  name: string;
  color: string;
  description?: string;
  order: number;
  image_count: number;
  bbox_count: number;
}

/**
 * Add a new class to a project's task
 *
 * REFACTORED: task_type is now required (classes are task-specific)
 */
export async function addClass(
  projectId: string,
  classData: ClassCreateRequest,
  taskType: string
): Promise<ClassResponse> {
  const url = `/api/v1/projects/${projectId}/classes?task_type=${encodeURIComponent(taskType)}`;
  return apiClient.post<ClassResponse>(url, classData);
}

/**
 * Update an existing class in a task
 *
 * REFACTORED: task_type is now required (classes are task-specific)
 */
export async function updateClass(
  projectId: string,
  classId: string,
  classData: ClassUpdateRequest,
  taskType: string
): Promise<ClassResponse> {
  const url = `/api/v1/projects/${projectId}/classes/${classId}?task_type=${encodeURIComponent(taskType)}`;
  return apiClient.patch<ClassResponse>(url, classData);
}

/**
 * Delete a class from a task
 *
 * REFACTORED: task_type is now required (classes are task-specific)
 */
export async function deleteClass(
  projectId: string,
  classId: string,
  taskType: string
): Promise<void> {
  const url = `/api/v1/projects/${projectId}/classes/${classId}?task_type=${encodeURIComponent(taskType)}`;
  return apiClient.delete<void>(url);
}

/**
 * Reorder classes in a task
 *
 * REFACTORED: task_type is now required (classes are task-specific)
 */
export async function reorderClasses(
  projectId: string,
  classIds: string[],
  taskType: string
): Promise<ClassResponse[]> {
  const url = `/api/v1/projects/${projectId}/classes/reorder?task_type=${encodeURIComponent(taskType)}`;
  return apiClient.put<ClassResponse[]>(url, {
    class_ids: classIds
  });
}
