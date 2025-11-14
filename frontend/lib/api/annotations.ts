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

  return apiClient.get<Annotation[]>(
    `/api/v1/annotations/project/${projectId}?${params.toString()}`
  );
}

/**
 * Import annotations from annotations.json to database
 */
export async function importAnnotationsFromJson(
  projectId: string,
  force: boolean = false
): Promise<{
  status: string;
  project_id: string;
  imported: number;
  skipped: number;
  total: number;
}> {
  return apiClient.post(`/api/v1/annotations/import/project/${projectId}?force=${force}`, {});
}

/**
 * Create annotation request schema
 */
export interface AnnotationCreateRequest {
  project_id: string;
  image_id: string;
  annotation_type: string;
  geometry: {
    type: string;
    bbox?: number[];
    polygon?: number[][];
    points?: number[][];
    line?: number[][];
  };
  class_id?: string;
  class_name?: string;
  attributes?: Record<string, any>;
  confidence?: number;
  notes?: string;
}

/**
 * Create new annotation
 */
export async function createAnnotation(
  data: AnnotationCreateRequest
): Promise<Annotation> {
  const response = await apiClient.post('/api/v1/annotations', data);
  return response.data;
}

/**
 * Update annotation request schema
 */
export interface AnnotationUpdateRequest {
  geometry?: {
    type: string;
    bbox?: number[];
    polygon?: number[][];
    points?: number[][];
    line?: number[][];
  };
  class_id?: string;
  class_name?: string;
  attributes?: Record<string, any>;
  confidence?: number;
  is_verified?: boolean;
  notes?: string;
}

/**
 * Update annotation
 */
export async function updateAnnotation(
  annotationId: string,
  data: AnnotationUpdateRequest
): Promise<Annotation> {
  const response = await apiClient.put(`/api/v1/annotations/${annotationId}`, data);
  return response.data;
}

/**
 * Delete annotation
 */
export async function deleteAnnotation(annotationId: string): Promise<void> {
  await apiClient.delete(`/api/v1/annotations/${annotationId}`);
}
