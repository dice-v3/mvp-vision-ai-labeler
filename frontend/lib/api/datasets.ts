/**
 * Dataset API
 *
 * Platform DB에서 데이터셋 조회
 */

import { apiClient } from './client';
import type { Dataset, Project } from '../types';

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
