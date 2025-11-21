/**
 * Dataset API
 *
 * Dataset management (Labeler DB)
 */

import { apiClient } from './client';
import type { Dataset, Project } from '../types';

export interface CreateDatasetRequest {
  name: string;
  description?: string;
  task_types?: string[];
  visibility?: 'private' | 'public';
}

export interface UpdateDatasetRequest {
  name: string;
  description?: string;
  visibility?: 'private' | 'public';
}

/**
 * Create new dataset
 */
export async function createDataset(request: CreateDatasetRequest): Promise<Dataset> {
  return apiClient.post<Dataset>('/api/v1/datasets', request);
}

/**
 * Update dataset information
 */
export async function updateDataset(datasetId: string, request: UpdateDatasetRequest): Promise<Dataset> {
  return apiClient.put<Dataset>(`/api/v1/datasets/${datasetId}`, request);
}

/**
 * Get list of datasets
 */
export async function listDatasets(params?: {
  skip?: number;
  limit?: number;
}): Promise<Dataset[]> {
  const queryParams = new URLSearchParams();
  if (params?.skip !== undefined) queryParams.set('skip', params.skip.toString());
  if (params?.limit !== undefined) queryParams.set('limit', params.limit.toString());

  const query = queryParams.toString();
  const endpoint = `/api/v1/datasets${query ? `?${query}` : ''}`;

  return apiClient.get<Dataset[]>(endpoint);
}

/**
 * Get dataset by ID
 */
export async function getDataset(datasetId: string): Promise<Dataset> {
  return apiClient.get<Dataset>(`/api/v1/datasets/${datasetId}`);
}

/**
 * Get or create annotation project for dataset (1:1 relationship)
 */
export async function getProjectForDataset(datasetId: string): Promise<Project> {
  return apiClient.get<Project>(`/api/v1/datasets/${datasetId}/project`);
}

export interface DatasetImage {
  id: number;
  file_name: string;
  width?: number;
  height?: number;
  url: string;
}

/**
 * Get list of images for a dataset
 */
export async function getDatasetImages(
  datasetId: string,
  limit: number = 12
): Promise<DatasetImage[]> {
  return apiClient.get<DatasetImage[]>(`/api/v1/datasets/${datasetId}/images?limit=${limit}`);
}

export interface DeletionImpact {
  dataset_id: string;
  dataset_name: string;
  projects: Array<{
    project_id: string;
    project_name: string;
    task_types: string[];
    annotation_count: number;
    image_count: number;
    version_count: number;
  }>;
  total_projects: number;
  total_images: number;
  total_annotations: number;
  total_versions: number;
  storage_size_mb: number;
  file_counts: {
    annotations: number;
    exports: number;
    images: number;
  };
}

/**
 * Get deletion impact preview
 */
export async function getDeletionImpact(datasetId: string): Promise<DeletionImpact> {
  return apiClient.get<DeletionImpact>(`/api/v1/datasets/${datasetId}/deletion-impact`);
}

export interface DeleteDatasetRequest {
  dataset_name_confirmation: string;
  create_backup: boolean;
}

export interface DeleteDatasetResponse {
  dataset_id: string;
  dataset_name: string;
  deleted: boolean;
  backup_created: boolean;
  backup_files: Record<string, string>;
  labeler_deletions: {
    annotations: number;
    image_statuses: number;
    annotation_versions: number;
    annotation_snapshots: number;
    projects: number;
  };
  s3_deletions: {
    dataset_files: number;
    export_files: number;
  };
  impact: DeletionImpact;
}

/**
 * Delete a dataset completely
 */
export async function deleteDataset(
  datasetId: string,
  request: DeleteDatasetRequest
): Promise<DeleteDatasetResponse> {
  return apiClient.delete<DeleteDatasetResponse>(`/api/v1/datasets/${datasetId}`, request);
}
