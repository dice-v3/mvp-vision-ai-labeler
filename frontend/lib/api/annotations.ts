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
  return apiClient.get<AnnotationHistory[]>(
    `/api/v1/annotations/history/project/${projectId}?skip=${skip}&limit=${limit}`
  );
}

/**
 * Get annotation history for a specific annotation
 */
export async function getAnnotationHistory(
  annotationId: number
): Promise<AnnotationHistory[]> {
  return apiClient.get<AnnotationHistory[]>(
    `/api/v1/annotations/history/annotation/${annotationId}`
  );
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

  // Phase 2.7: Confirmation fields
  annotation_state?: string;  // draft, confirmed, verified
  confirmed_at?: string;
  confirmed_by?: number;
  confirmed_by_name?: string;

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
  return apiClient.post<Annotation>('/api/v1/annotations', data);
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
  return apiClient.put<Annotation>(`/api/v1/annotations/${annotationId}`, data);
}

/**
 * Delete annotation
 */
export async function deleteAnnotation(annotationId: string): Promise<void> {
  await apiClient.delete(`/api/v1/annotations/${annotationId}`);
}

// ============================================================================
// Phase 2.7: Annotation Confirmation API
// ============================================================================

export interface ConfirmResponse {
  annotation_id: number;
  annotation_state: string;
  confirmed_at?: string;
  confirmed_by?: number;
  confirmed_by_name?: string;
}

export interface BulkConfirmRequest {
  annotation_ids: number[];
}

export interface BulkConfirmResponse {
  confirmed: number;
  failed: number;
  results: ConfirmResponse[];
  errors: string[];
}

/**
 * Confirm an annotation (draft -> confirmed)
 */
export async function confirmAnnotation(annotationId: string): Promise<ConfirmResponse> {
  return apiClient.post<ConfirmResponse>(`/api/v1/annotations/${annotationId}/confirm`, {});
}

/**
 * Unconfirm an annotation (confirmed -> draft)
 */
export async function unconfirmAnnotation(annotationId: string): Promise<ConfirmResponse> {
  return apiClient.post<ConfirmResponse>(`/api/v1/annotations/${annotationId}/unconfirm`, {});
}

/**
 * Bulk confirm multiple annotations
 */
export async function bulkConfirmAnnotations(annotationIds: number[]): Promise<BulkConfirmResponse> {
  return apiClient.post<BulkConfirmResponse>('/api/v1/annotations/bulk-confirm', {
    annotation_ids: annotationIds
  });
}
