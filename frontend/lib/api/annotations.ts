/**
 * Annotation API client functions
 */

import { apiClient } from './client';

export interface AnnotationHistory {
  id: number;
  annotation_id: number;
  project_id: string;
  action: string;
  previous_state: any;
  new_state: any;
  changed_by: number;
  timestamp: string;
  changed_by_name?: string;
  changed_by_email?: string;
}

/**
 * Get annotation history for a project
 */
export async function getProjectHistory(
  projectId: string,
  skip: number = 0,
  limit: number = 20
): Promise<AnnotationHistory[]> {
  const response = await apiClient.get(
    `/api/v1/annotations/history/project/${projectId}`,
    {
      params: { skip, limit }
    }
  );
  return response.data;
}

/**
 * Get annotation history for a specific annotation
 */
export async function getAnnotationHistory(
  annotationId: number
): Promise<AnnotationHistory[]> {
  const response = await apiClient.get(
    `/api/v1/annotations/history/annotation/${annotationId}`
  );
  return response.data;
}
