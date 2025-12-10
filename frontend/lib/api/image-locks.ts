/**
 * Phase 8.5.2: Image Lock API Client
 *
 * Manages image locks for concurrent editing protection.
 */

import { apiClient } from './client';

// ============================================================================
// Types
// ============================================================================

export interface LockInfo {
  image_id: string;
  user_id: number;
  locked_at: string;
  expires_at: string;
  heartbeat_at: string;
  user_name?: string;
  user_email?: string;
}

export interface LockAcquireResponse {
  status: 'acquired' | 'already_locked' | 'refreshed';
  lock?: LockInfo;
  locked_by?: LockInfo;
}

export interface LockReleaseResponse {
  status: 'released' | 'not_locked' | 'not_owner';
}

export interface HeartbeatResponse {
  status: 'updated' | 'not_locked' | 'not_owner';
  lock?: LockInfo;
}

export interface ProjectLocksResponse {
  locks: LockInfo[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Acquire lock on an image
 */
export async function acquireLock(
  projectId: string,
  imageId: string
): Promise<LockAcquireResponse> {
  return apiClient.post<LockAcquireResponse>(
    `/api/v1/image-locks/${encodeURIComponent(projectId)}/${encodeURIComponent(imageId)}/acquire`,
    {}
  );
}

/**
 * Release lock on an image
 */
export async function releaseLock(
  projectId: string,
  imageId: string
): Promise<LockReleaseResponse> {
  return apiClient.delete<LockReleaseResponse>(
    `/api/v1/image-locks/${encodeURIComponent(projectId)}/${encodeURIComponent(imageId)}`
  );
}

/**
 * Send heartbeat to keep lock alive
 *
 * Should be called every 2 minutes to prevent lock expiration (5-minute timeout).
 */
export async function sendHeartbeat(
  projectId: string,
  imageId: string
): Promise<HeartbeatResponse> {
  return apiClient.post<HeartbeatResponse>(
    `/api/v1/image-locks/${encodeURIComponent(projectId)}/${encodeURIComponent(imageId)}/heartbeat`,
    {}
  );
}

/**
 * Get all active locks for a project
 *
 * Useful for showing lock indicators in ImageList.
 */
export async function getProjectLocks(
  projectId: string
): Promise<LockInfo[]> {
  const response = await apiClient.get<ProjectLocksResponse>(
    `/api/v1/image-locks/${projectId}`
  );
  return response.locks;
}

/**
 * Get lock status for a specific image
 */
export async function getLockStatus(
  projectId: string,
  imageId: string
): Promise<LockInfo | null> {
  return apiClient.get<LockInfo | null>(
    `/api/v1/image-locks/${encodeURIComponent(projectId)}/${encodeURIComponent(imageId)}/status`
  );
}

/**
 * Force release a lock (owner only)
 */
export async function forceReleaseLock(
  projectId: string,
  imageId: string
): Promise<LockReleaseResponse> {
  return apiClient.delete<LockReleaseResponse>(
    `/api/v1/image-locks/${encodeURIComponent(projectId)}/${encodeURIComponent(imageId)}/force`
  );
}

// ============================================================================
// Convenience API Object
// ============================================================================

export const imageLockAPI = {
  acquireLock,
  releaseLock,
  sendHeartbeat,
  getProjectLocks,
  getLockStatus,
  forceReleaseLock,
};
