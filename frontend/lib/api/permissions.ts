/**
 * Dataset Permission API
 *
 * Permission management for datasets
 */

import { apiClient } from './client';

export interface Permission {
  id: number;
  dataset_id: string;
  user_id: number;
  role: 'owner' | 'member';
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
  role: 'owner' | 'member';
}

export interface UpdateRoleRequest {
  role: 'owner' | 'member';
}

export interface TransferOwnershipRequest {
  new_owner_user_id: number;
}

/**
 * Get list of permissions for a dataset
 */
export async function listPermissions(datasetId: string): Promise<Permission[]> {
  return apiClient.get<Permission[]>(`/api/v1/datasets/${datasetId}/permissions`);
}

/**
 * Invite a user to dataset
 */
export async function inviteUser(
  datasetId: string,
  request: InviteRequest
): Promise<Permission> {
  return apiClient.post<Permission>(`/api/v1/datasets/${datasetId}/permissions/invite`, request);
}

/**
 * Update user's role
 */
export async function updateUserRole(
  datasetId: string,
  userId: number,
  request: UpdateRoleRequest
): Promise<Permission> {
  return apiClient.put<Permission>(`/api/v1/datasets/${datasetId}/permissions/${userId}`, request);
}

/**
 * Remove user from dataset
 */
export async function removeUser(datasetId: string, userId: number): Promise<void> {
  return apiClient.delete(`/api/v1/datasets/${datasetId}/permissions/${userId}`, undefined);
}

/**
 * Transfer dataset ownership
 */
export async function transferOwnership(
  datasetId: string,
  request: TransferOwnershipRequest
): Promise<Permission> {
  return apiClient.post<Permission>(`/api/v1/datasets/${datasetId}/permissions/transfer-owner`, request);
}
