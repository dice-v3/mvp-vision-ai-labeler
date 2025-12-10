/**
 * Admin API
 *
 * Phase 15 - Admin Dashboard
 * Admin-only API calls for dataset management, audit logs, and system statistics.
 */

import { apiClient } from './client';

// =============================================================================
// Types
// =============================================================================

export interface DatasetOverview {
  total_datasets: number;
  total_images: number;
  total_size_bytes: number;
  total_annotations: number;
  datasets_by_status: Record<string, number>;
}

export interface RecentDatasetUpdate {
  dataset_id: string;
  name: string;
  last_updated: string | null;
  updated_by: string | null;
  status: string;
  num_images: number;
}

export interface DatasetDetail {
  dataset: {
    id: string;
    name: string;
    description: string | null;
    owner_email: string | null;
    owner_id: number;
    status: string;
    created_at: string | null;
    updated_at: string | null;
  };
  projects: Array<{
    project_id: string;
    name: string;
    task_types: string[];
    annotation_count: number;
    created_at: string | null;
  }>;
  storage_info: {
    image_count: number;
    total_size_bytes: number;
    avg_size_bytes: number;
  };
}

export interface LabelingProgress {
  images_by_status: Record<string, number>;
  annotations_by_task: Record<string, number>;
  completion_rate: number;
  total_images: number;
  completed_images: number;
  user_contributions: Array<{
    user_id: number;
    user_email: string;
    annotation_count: number;
  }>;
}

export interface ActivityEvent {
  type: string;
  timestamp: string | null;
  user_email: string;
  details: {
    annotation_id?: string;
    task_type?: string;
    image_id?: string;
  };
}

export interface AuditLog {
  id: number;
  timestamp: string | null;
  user_id: number | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  status: string;
  error_message: string | null;
  created_at?: string | null;
}

export interface AuditLogList {
  total: number;
  limit: number;
  offset: number;
  items: AuditLog[];
}

export interface AuditLogStats {
  total_logs: number;
  by_action: Record<string, number>;
  by_status: Record<string, number>;
  by_resource_type: Record<string, number>;
  unique_users: number;
  time_range: {
    start: string;
    end: string;
    days: number;
  };
}

// =============================================================================
// Dataset Management APIs
// =============================================================================

/**
 * Get dataset overview statistics
 */
export async function getDatasetOverview(): Promise<DatasetOverview> {
  return apiClient.get<DatasetOverview>('/api/v1/admin/datasets/overview');
}

/**
 * Get recently updated datasets
 */
export async function getRecentDatasets(limit: number = 10): Promise<RecentDatasetUpdate[]> {
  return apiClient.get<RecentDatasetUpdate[]>(`/api/v1/admin/datasets/recent?limit=${limit}`);
}

/**
 * Get dataset detail statistics
 */
export async function getDatasetDetails(datasetId: string): Promise<DatasetDetail> {
  return apiClient.get<DatasetDetail>(`/api/v1/admin/datasets/${datasetId}/details`);
}

/**
 * Get labeling progress for a dataset
 */
export async function getLabelingProgress(
  datasetId: string,
  projectId?: string
): Promise<LabelingProgress> {
  const params = projectId ? `?project_id=${projectId}` : '';
  return apiClient.get<LabelingProgress>(`/api/v1/admin/datasets/${datasetId}/progress${params}`);
}

/**
 * Get recent activity for a dataset
 */
export async function getDatasetActivity(
  datasetId: string,
  days: number = 7,
  limit: number = 50
): Promise<ActivityEvent[]> {
  return apiClient.get<ActivityEvent[]>(
    `/api/v1/admin/datasets/${datasetId}/activity?days=${days}&limit=${limit}`
  );
}

// =============================================================================
// Audit Log APIs
// =============================================================================

/**
 * List audit logs with filters
 */
export async function listAuditLogs(params: {
  limit?: number;
  offset?: number;
  user_id?: number;
  action?: string;
  resource_type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}): Promise<AuditLogList> {
  const queryParams = new URLSearchParams();

  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.offset) queryParams.append('offset', params.offset.toString());
  if (params.user_id) queryParams.append('user_id', params.user_id.toString());
  if (params.action) queryParams.append('action', params.action);
  if (params.resource_type) queryParams.append('resource_type', params.resource_type);
  if (params.status) queryParams.append('status', params.status);
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);

  const query = queryParams.toString();
  return apiClient.get<AuditLogList>(`/api/v1/admin/audit-logs${query ? `?${query}` : ''}`);
}

/**
 * Get audit log detail
 */
export async function getAuditLogDetail(logId: number): Promise<AuditLog> {
  return apiClient.get<AuditLog>(`/api/v1/admin/audit-logs/${logId}`);
}

/**
 * Get audit log statistics
 */
export async function getAuditLogStats(days: number = 7): Promise<AuditLogStats> {
  return apiClient.get<AuditLogStats>(`/api/v1/admin/audit-logs/stats/summary?days=${days}`);
}

/**
 * Get available action types
 */
export async function getAuditActions(): Promise<string[]> {
  return apiClient.get<string[]>('/api/v1/admin/audit-logs/meta/actions');
}

/**
 * Get available resource types
 */
export async function getAuditResourceTypes(): Promise<string[]> {
  return apiClient.get<string[]>('/api/v1/admin/audit-logs/meta/resource-types');
}

// =============================================================================
// System Statistics APIs
// =============================================================================

export interface SystemOverview {
  user_activity: UserActivityStats;
  resource_usage: ResourceUsageStats;
  performance: PerformanceMetrics;
  sessions: SessionStats;
  generated_at: string;
  time_period_days: number;
}

export interface UserActivityStats {
  total_users: number;
  active_users_7d: number;
  active_users_30d: number;
  new_users_7d: number;
  new_users_30d: number;
  registration_trend: Array<{ date: string; count: number }>;
  login_activity: {
    logins_7d: number;
    logins_30d: number;
  };
}

export interface ResourceUsageStats {
  datasets: {
    total: number;
    by_status: Record<string, number>;
  };
  images: {
    total: number;
  };
  annotations: {
    total: number;
    by_task_type: Record<string, number>;
    recent_7d: number;
  };
  storage: {
    total_bytes: number;
    total_gb: number;
  };
}

export interface PerformanceMetrics {
  annotation_rate: {
    daily: Array<{ date: string; count: number }>;
    average_per_day: number;
    total_period: number;
  };
  task_distribution: Record<string, number>;
  top_annotators: Array<{
    user_id: number;
    annotation_count: number;
  }>;
}

export interface SessionStats {
  total_sessions: number;
  active_sessions: number;
  avg_duration_seconds: number;
  avg_duration_minutes: number;
  sessions_by_day: Array<{ date: string; count: number }>;
}

/**
 * Get comprehensive system overview
 */
export async function getSystemOverview(days: number = 7): Promise<SystemOverview> {
  return apiClient.get<SystemOverview>(`/api/v1/admin/stats/overview?days=${days}`);
}

/**
 * Get user activity statistics
 */
export async function getUserActivityStats(days: number = 30): Promise<UserActivityStats> {
  return apiClient.get<UserActivityStats>(`/api/v1/admin/stats/users?days=${days}`);
}

/**
 * Get resource usage statistics
 */
export async function getResourceUsageStats(): Promise<ResourceUsageStats> {
  return apiClient.get<ResourceUsageStats>('/api/v1/admin/stats/resources');
}

/**
 * Get performance metrics
 */
export async function getPerformanceMetrics(days: number = 7): Promise<PerformanceMetrics> {
  return apiClient.get<PerformanceMetrics>(`/api/v1/admin/stats/performance?days=${days}`);
}

/**
 * Get session statistics
 */
export async function getSessionStats(days: number = 7): Promise<SessionStats> {
  return apiClient.get<SessionStats>(`/api/v1/admin/stats/sessions?days=${days}`);
}
