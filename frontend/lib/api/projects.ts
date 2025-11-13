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
