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
  thumbnail_url?: string;
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

export interface UploadDatasetRequest {
  dataset_name: string;
  dataset_description?: string;
  task_types?: string[];
  visibility?: 'private' | 'public';
  files: File[];
  annotation_file?: File;
}

export interface UploadSummary {
  images_uploaded: number;
  annotations_imported: number;
  storage_bytes_used: number;
  folder_structure: Record<string, number>;
}

export interface UploadDatasetResponse {
  dataset_id: string;
  dataset_name: string;
  project_id: string;
  upload_summary: UploadSummary;
}

/**
 * Upload new dataset with images and optional annotations
 */
export async function uploadDataset(
  request: UploadDatasetRequest,
  onProgress?: (progress: number) => void
): Promise<UploadDatasetResponse> {
  const formData = new FormData();
  formData.append('dataset_name', request.dataset_name);

  if (request.dataset_description) {
    formData.append('dataset_description', request.dataset_description);
  }

  if (request.task_types && request.task_types.length > 0) {
    formData.append('task_types', JSON.stringify(request.task_types));
  }

  if (request.visibility) {
    formData.append('visibility', request.visibility);
  }

  // Add image files with path information
  request.files.forEach((file) => {
    // @ts-ignore - webkitRelativePath exists on File
    const filename = file.webkitRelativePath || file.name;
    formData.append('files', file, filename);
  });

  // Add annotation file if provided
  if (request.annotation_file) {
    formData.append('annotation_file', request.annotation_file);
  }

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        resolve(response);
      } else {
        const error = JSON.parse(xhr.responseText);
        reject(new Error(error.detail || 'Upload failed'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    // Get token from localStorage
    const token = localStorage.getItem('access_token');

    xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/v1/datasets/upload`);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.send(formData);
  });
}

export interface FolderInfo {
  path: string;
  name: string;
  file_count: number;
  total_size_bytes: number;
  depth: number;
}

export interface StorageStructure {
  dataset_id: string;
  total_files: number;
  total_size_bytes: number;
  folders: FolderInfo[];
}

/**
 * Get storage folder structure for a dataset
 */
export async function getStorageStructure(datasetId: string): Promise<StorageStructure> {
  return apiClient.get<StorageStructure>(`/api/v1/datasets/${datasetId}/storage/structure`);
}

export interface FileMapping {
  filename: string;
  relative_path: string;
  size: number;
}

export interface UploadPreviewRequest {
  file_mappings: FileMapping[];
  target_folder: string;
}

export interface PreviewFileInfo {
  filename: string;
  path: string;
  size: number;
  status: 'new' | 'duplicate';
}

export interface UploadPreview {
  dataset_id: string;
  target_folder: string;
  current_structure: StorageStructure;
  new_files: PreviewFileInfo[];
  duplicate_files: PreviewFileInfo[];
  summary: {
    total_new: number;
    total_duplicates: number;
    total_files: number;
  };
}

/**
 * Preview upload structure before actual upload
 */
export async function previewUpload(
  datasetId: string,
  request: UploadPreviewRequest
): Promise<UploadPreview> {
  return apiClient.post<UploadPreview>(`/api/v1/datasets/${datasetId}/storage/preview`, request);
}

/**
 * Add images to existing dataset
 */
export async function addImagesToDataset(
  datasetId: string,
  files: File[],
  annotationFile?: File,
  onProgress?: (progress: number) => void
): Promise<UploadSummary> {
  const formData = new FormData();

  // Add image files with path information
  files.forEach((file) => {
    // @ts-ignore - webkitRelativePath exists on File
    const filename = file.webkitRelativePath || file.name;
    formData.append('files', file, filename);
  });

  // Add annotation file if provided
  if (annotationFile) {
    formData.append('annotation_file', annotationFile);
  }

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        resolve(response);
      } else {
        const error = JSON.parse(xhr.responseText);
        reject(new Error(error.detail || 'Upload failed'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    // Get token from localStorage
    const token = localStorage.getItem('access_token');

    xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001'}/api/v1/datasets/${datasetId}/images`);

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.send(formData);
  });
}
