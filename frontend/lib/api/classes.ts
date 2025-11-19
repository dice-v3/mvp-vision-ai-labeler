/**
 * Class management API client functions
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
 * Add a new class to a project
 */
export async function addClass(
  projectId: string,
  classData: ClassCreateRequest,
  taskType?: string
): Promise<ClassResponse> {
  const url = taskType
    ? `/api/v1/projects/${projectId}/classes?task_type=${taskType}`
    : `/api/v1/projects/${projectId}/classes`;
  return apiClient.post<ClassResponse>(url, classData);
}

/**
 * Update an existing class
 */
export async function updateClass(
  projectId: string,
  classId: string,
  classData: ClassUpdateRequest
): Promise<ClassResponse> {
  return apiClient.patch<ClassResponse>(`/api/v1/projects/${projectId}/classes/${classId}`, classData);
}

/**
 * Delete a class
 */
export async function deleteClass(
  projectId: string,
  classId: string
): Promise<void> {
  return apiClient.delete<void>(`/api/v1/projects/${projectId}/classes/${classId}`);
}

/**
 * Reorder classes
 */
export async function reorderClasses(
  projectId: string,
  classIds: string[],
  taskType?: string
): Promise<ClassResponse[]> {
  const url = taskType
    ? `/api/v1/projects/${projectId}/classes/reorder?task_type=${taskType}`
    : `/api/v1/projects/${projectId}/classes/reorder`;
  return apiClient.put<ClassResponse[]>(url, {
    class_ids: classIds
  });
}
