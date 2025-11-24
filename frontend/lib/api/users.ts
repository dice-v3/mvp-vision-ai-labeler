/**
 * User API Client for Phase 8.2 - Invitation System
 *
 * API functions for user search and user information retrieval.
 */

import { apiClient } from './client';

export interface UserSearchItem {
  id: number;
  email: string;
  full_name: string | null;
  avatar_name: string | null;
  badge_color: string | null;
  system_role: string | null;
}

export interface UserSearchResponse {
  users: UserSearchItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface UserInfoResponse {
  id: number;
  email: string;
  full_name: string | null;
  avatar_name: string | null;
  badge_color: string | null;
  system_role: string | null;
  organization_id: number | null;
  is_active: boolean;
  created_at: string | null;
}

/**
 * Search users by email or name
 */
export async function searchUsers(
  query: string,
  options?: {
    limit?: number;
    offset?: number;
    projectId?: string;
  }
): Promise<UserSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    limit: String(options?.limit ?? 10),
    offset: String(options?.offset ?? 0),
  });

  if (options?.projectId) {
    params.append('project_id', options.projectId);
  }

  return await apiClient.get<UserSearchResponse>(`/api/v1/users/search?${params}`);
}

/**
 * Get user information by ID
 */
export async function getUserInfo(userId: number): Promise<UserInfoResponse> {
  return await apiClient.get<UserInfoResponse>(`/api/v1/users/${userId}`);
}
