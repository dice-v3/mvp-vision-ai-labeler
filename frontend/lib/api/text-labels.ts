/**
 * Text Label API client functions (Phase 19 - VLM Text Labeling)
 */

import { apiClient } from './client';

/**
 * Text Label interface matching backend TextLabelResponse schema
 */
export interface TextLabel {
  id: number;
  project_id: string;
  image_id: string;
  annotation_id: number | null;  // NULL = image-level, set = region-level
  label_type: 'caption' | 'description' | 'qa' | 'region';
  text_content: string;
  question?: string | null;  // For VQA type
  language: string;  // ISO 639-1 code (en, ko, etc.)
  confidence?: number | null;  // 0-100
  metadata: Record<string, any>;
  version: number;
  created_by: number;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

/**
 * Text Label Create request
 */
export interface TextLabelCreate {
  project_id: string;
  image_id: string;
  annotation_id?: number | null;
  label_type?: 'caption' | 'description' | 'qa' | 'region';
  text_content: string;
  question?: string | null;
  language?: string;
  confidence?: number | null;
  metadata?: Record<string, any>;
}

/**
 * Text Label Update request
 */
export interface TextLabelUpdate {
  text_content?: string;
  question?: string | null;
  language?: string;
  confidence?: number | null;
  metadata?: Record<string, any>;
  version?: number;  // For optimistic locking
}

/**
 * List text labels response
 */
export interface TextLabelListResponse {
  text_labels: TextLabel[];
  total: number;
}

/**
 * Text label statistics response
 */
export interface TextLabelStatsResponse {
  project_id: string;
  total_labels: number;
  by_type: Record<string, number>;  // {'caption': 10, 'description': 5}
  by_language: Record<string, number>;  // {'en': 15, 'ko': 3}
  images_with_labels: number;
  annotations_with_labels: number;
}

/**
 * Get text labels for a project with optional filters
 */
export async function getTextLabels(
  projectId: string,
  options?: {
    imageId?: string;
    annotationId?: number;
    labelType?: string;
    language?: string;
    skip?: number;
    limit?: number;
  }
): Promise<TextLabelListResponse> {
  const params = new URLSearchParams();
  if (options?.imageId) params.append('image_id', options.imageId);
  if (options?.annotationId !== undefined) params.append('annotation_id', options.annotationId.toString());
  if (options?.labelType) params.append('label_type', options.labelType);
  if (options?.language) params.append('language', options.language);
  if (options?.skip !== undefined) params.append('skip', options.skip.toString());
  if (options?.limit !== undefined) params.append('limit', options.limit.toString());

  const queryString = params.toString();
  return apiClient.get<TextLabelListResponse>(
    `/api/v1/text-labels/project/${projectId}${queryString ? `?${queryString}` : ''}`
  );
}

/**
 * Get a single text label by ID
 */
export async function getTextLabel(labelId: number): Promise<TextLabel> {
  return apiClient.get<TextLabel>(`/api/v1/text-labels/${labelId}`);
}

/**
 * Get all text labels for a specific annotation (region-level labels)
 */
export async function getTextLabelsForAnnotation(annotationId: number): Promise<TextLabelListResponse> {
  return apiClient.get<TextLabelListResponse>(`/api/v1/text-labels/annotation/${annotationId}`);
}

/**
 * Create a new text label
 */
export async function createTextLabel(data: TextLabelCreate): Promise<TextLabel> {
  return apiClient.post<TextLabel>('/api/v1/text-labels', data);
}

/**
 * Update an existing text label
 */
export async function updateTextLabel(labelId: number, data: TextLabelUpdate): Promise<TextLabel> {
  return apiClient.put<TextLabel>(`/api/v1/text-labels/${labelId}`, data);
}

/**
 * Delete a text label
 */
export async function deleteTextLabel(labelId: number): Promise<void> {
  return apiClient.delete(`/api/v1/text-labels/${labelId}`);
}

/**
 * Bulk create text labels
 */
export async function bulkCreateTextLabels(textLabels: TextLabelCreate[]): Promise<{
  created: number;
  failed: number;
  text_label_ids: number[];
  errors: string[];
}> {
  return apiClient.post('/api/v1/text-labels/bulk', { text_labels: textLabels });
}

/**
 * Get text label statistics for a project
 */
export async function getTextLabelStats(projectId: string): Promise<TextLabelStatsResponse> {
  return apiClient.get<TextLabelStatsResponse>(`/api/v1/text-labels/project/${projectId}/stats`);
}
