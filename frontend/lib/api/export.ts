/**
 * Export and Version API
 *
 * Annotation export and version management
 */

import { apiClient } from './client';

// ===== Types =====

export interface ExportRequest {
  project_id: string;
  export_format: 'dice' | 'coco' | 'yolo';
  include_draft?: boolean;
  image_ids?: string[];
}

export interface ExportResponse {
  export_path: string;
  download_url: string;
  download_url_expires_at: string;
  export_format: string;
  annotation_count: number;
  image_count: number;
  file_size_bytes?: number;
}

export interface VersionPublishRequest {
  task_type: string; // Phase 2.9: Task-specific versioning
  version_number?: string;
  description?: string;
  export_format: 'dice' | 'coco' | 'yolo';
  include_draft?: boolean;
}

export interface Version {
  id: number;
  project_id: string;
  task_type: string; // Phase 2.9: Task-specific versioning
  version_number: string;
  version_type: 'working' | 'published';
  created_at: string;
  created_by?: number;
  description?: string;
  annotation_count?: number;
  image_count?: number;
  export_format?: string;
  export_path?: string;
  download_url?: string;
  download_url_expires_at?: string;
  created_by_name?: string;
  created_by_email?: string;
}

export interface VersionListResponse {
  versions: Version[];
  total: number;
  project_id: string;
}

// ===== Export Functions =====

/**
 * Export annotations in specified format
 */
export async function exportAnnotations(
  projectId: string,
  request: Omit<ExportRequest, 'project_id'>
): Promise<ExportResponse> {
  return apiClient.post<ExportResponse>(
    `/api/v1/projects/${projectId}/export`,
    {
      project_id: projectId,
      ...request,
    }
  );
}

/**
 * Publish new version
 */
export async function publishVersion(
  projectId: string,
  request: VersionPublishRequest
): Promise<Version> {
  return apiClient.post<Version>(
    `/api/v1/projects/${projectId}/versions/publish`,
    request
  );
}

/**
 * Get list of published versions
 */
export async function listVersions(projectId: string): Promise<VersionListResponse> {
  return apiClient.get<VersionListResponse>(
    `/api/v1/projects/${projectId}/versions`
  );
}

/**
 * Download export file
 *
 * This is a helper function that triggers the browser download
 */
export function downloadExport(downloadUrl: string, filename: string) {
  // Create temporary anchor element
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.style.display = 'none';

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
}
