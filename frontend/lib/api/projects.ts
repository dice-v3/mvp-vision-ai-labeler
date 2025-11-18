/**
 * Project API
 *
 * 어노테이션 프로젝트 CRUD 작업
 */

import { apiClient } from './client';
import type { Project, ProjectCreate, ProjectUpdate } from '../types';

/**
 * Create new annotation project
 */
export async function createProject(data: ProjectCreate): Promise<Project> {
  return apiClient.post<Project>('/api/v1/projects', data);
}

/**
 * Get list of projects
 */
export async function listProjects(params?: {
  skip?: number;
  limit?: number;
}): Promise<Project[]> {
  const queryParams = new URLSearchParams();
  if (params?.skip !== undefined) queryParams.set('skip', params.skip.toString());
  if (params?.limit !== undefined) queryParams.set('limit', params.limit.toString());

  const query = queryParams.toString();
  const endpoint = `/api/v1/projects${query ? `?${query}` : ''}`;

  return apiClient.get<Project[]>(endpoint);
}

/**
 * Get project by ID
 */
export async function getProject(projectId: string): Promise<Project> {
  return apiClient.get<Project>(`/api/v1/projects/${projectId}`);
}

/**
 * Update project
 */
export async function updateProject(
  projectId: string,
  data: ProjectUpdate
): Promise<Project> {
  return apiClient.patch<Project>(`/api/v1/projects/${projectId}`, data);
}

/**
 * Delete project
 */
export async function deleteProject(projectId: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/projects/${projectId}`);
}

/**
 * Get project by ID (alias for getProject)
 */
export async function getProjectById(projectId: string): Promise<Project> {
  return getProject(projectId);
}

/**
 * Get images for a project
 */
export interface ImageListResponse {
  images: Array<{
    id: string;
    file_name: string;
    url: string;
    width?: number;
    height?: number;
  }>;
  total: number;
  dataset_id: string;
  project_id: string;
}

export async function getProjectImages(projectId: string, limit: number = 1000): Promise<ImageListResponse> {
  return apiClient.get<ImageListResponse>(`/api/v1/projects/${projectId}/images?limit=${limit}`);
}

// ============================================================================
// Phase 2.7: Image Status Management API
// ============================================================================

export interface ImageStatus {
  id: number;
  project_id: string;
  image_id: string;
  task_type?: string;  // Phase 2.9: Task type for task-specific status
  status: string;  // not-started, in-progress, completed
  first_modified_at?: string;
  last_modified_at?: string;
  confirmed_at?: string;
  total_annotations: number;
  confirmed_annotations: number;
  draft_annotations: number;
  is_image_confirmed: boolean;
}

export interface ImageStatusListResponse {
  statuses: ImageStatus[];
  total: number;
  project_id: string;
}

export interface ImageConfirmResponse {
  image_id: string;
  is_confirmed: boolean;
  confirmed_at?: string;
  status: string;
  total_annotations: number;
  confirmed_annotations: number;
}

/**
 * Get image annotation statuses for a project
 *
 * Phase 2.9: Supports task_type parameter for filtering
 */
export async function getProjectImageStatuses(
  projectId: string,
  taskType?: string
): Promise<ImageStatusListResponse> {
  const params = taskType ? `?task_type=${encodeURIComponent(taskType)}` : '';
  return apiClient.get<ImageStatusListResponse>(`/api/v1/projects/${projectId}/images/status${params}`);
}

/**
 * Confirm an image (marks all annotations as confirmed)
 *
 * Phase 2.9: Supports task_type parameter for task-specific confirmation
 */
export async function confirmImage(
  projectId: string,
  imageId: string,
  taskType?: string
): Promise<ImageConfirmResponse> {
  const params = taskType ? `?task_type=${encodeURIComponent(taskType)}` : '';
  return apiClient.post<ImageConfirmResponse>(`/api/v1/projects/${projectId}/images/${imageId}/confirm${params}`, {});
}

/**
 * Unconfirm an image (reverts annotations to draft)
 *
 * Phase 2.9: Supports task_type parameter for task-specific unconfirmation
 */
export async function unconfirmImage(
  projectId: string,
  imageId: string,
  taskType?: string
): Promise<ImageConfirmResponse> {
  const params = taskType ? `?task_type=${encodeURIComponent(taskType)}` : '';
  return apiClient.post<ImageConfirmResponse>(`/api/v1/projects/${projectId}/images/${imageId}/unconfirm${params}`, {});
}

// ============================================================================
// Task Type Management API
// ============================================================================

/**
 * Add a new task type to a project
 */
export async function addTaskType(projectId: string, taskType: string): Promise<Project> {
  return apiClient.post<Project>(`/api/v1/projects/${projectId}/task-types`, {
    task_type: taskType
  });
}
