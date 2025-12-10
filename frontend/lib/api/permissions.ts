/**
 * Project Permission API (Phase 8.1)
 *
 * Permission management for projects (formerly datasets)
 * Note: datasetId parameter is actually used as projectId
 */

import { apiClient } from './client';

export interface Permission {
  id: number;
  project_id: string;
  user_id: number;
  role: 'owner' | 'admin' | 'reviewer' | 'annotator' | 'viewer';
  granted_by: number;
  granted_at: string;
  user_name: string;
  user_email: string;
  user_badge_color: string;
  granted_by_name?: string;
  granted_by_email?: string;
}

export interface InviteRequest {
  user_email: string;
  role: 'admin' | 'reviewer' | 'annotator' | 'viewer';
}

export interface UpdateRoleRequest {
  role: 'admin' | 'reviewer' | 'annotator' | 'viewer';
}

export interface TransferOwnershipRequest {
  new_owner_user_id: number;
}

/**
 * Get list of permissions for a project
 * @param datasetId - Actually the project_id (same as dataset_id in current system)
 */
export async function listPermissions(datasetId: string): Promise<Permission[]> {
  return apiClient.get<Permission[]>(`/api/v1/projects/${datasetId}/permissions`);
}

/**
 * Invite a user to project
 */
export async function inviteUser(
  datasetId: string,
  request: InviteRequest
): Promise<Permission> {
  return apiClient.post<Permission>(`/api/v1/projects/${datasetId}/permissions`, request);
}

/**
 * Update user's role
 */
export async function updateUserRole(
  datasetId: string,
  userId: number,
  request: UpdateRoleRequest
): Promise<Permission> {
  return apiClient.patch<Permission>(`/api/v1/projects/${datasetId}/permissions/${userId}`, request);
}

/**
 * Remove user from project
 */
export async function removeUser(datasetId: string, userId: number): Promise<void> {
  return apiClient.delete(`/api/v1/projects/${datasetId}/permissions/${userId}`, undefined);
}

/**
 * Transfer project ownership
 */
export async function transferOwnership(
  datasetId: string,
  request: TransferOwnershipRequest
): Promise<void> {
  return apiClient.post<void>(`/api/v1/projects/${datasetId}/transfer-ownership`, request);
}
