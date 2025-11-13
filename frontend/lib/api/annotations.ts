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

/**
 * Annotation interface
 */
export interface Annotation {
  id: string;
  project_id: string;
  image_id: string;
  annotation_type: string;
  geometry: any;
  class_id?: string;
  class_name?: string;
  attributes?: Record<string, any>;
  confidence?: number;
  is_verified?: boolean;
  notes?: string;
  created_by?: number;
  created_by_name?: string;
  updated_by?: number;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Get annotations for a project (optionally filtered by image)
 */
export async function getProjectAnnotations(
  projectId: string,
  imageId?: string,
  skip: number = 0,
  limit: number = 1000
): Promise<Annotation[]> {
  const params = new URLSearchParams({
    skip: skip.toString(),
    limit: limit.toString(),
  });
  if (imageId) {
    params.set('image_id', imageId);
  }

  const response = await apiClient.get(
    `/api/v1/annotations/project/${projectId}?${params.toString()}`
  );
  return response.data;
}
