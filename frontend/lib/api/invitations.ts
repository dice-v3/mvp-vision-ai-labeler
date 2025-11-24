/**
 * Invitations API Client for Phase 8.2 - Invitation System
 *
 * API functions for creating, listing, accepting, and canceling invitations.
 */

import { apiClient } from './client';

export type InvitationStatus = 'pending' | 'accepted' | 'cancelled' | 'expired';
export type ProjectRole = 'owner' | 'admin' | 'reviewer' | 'annotator' | 'viewer';

export interface InvitationResponse {
  id: number;
  project_id: string;
  inviter_user_id: number;
  invitee_user_id: number;
  invitee_email: string;
  role: string;
  status: InvitationStatus;
  token: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  cancelled_at: string | null;
  inviter_name: string | null;
  invitee_name: string | null;
  project_name: string | null;
}

export interface InvitationListResponse {
  invitations: InvitationResponse[];
  total: number;
}

export interface CreateInvitationRequest {
  project_id: string;
  invitee_user_id: number;
  role: ProjectRole;
}

export interface AcceptInvitationRequest {
  token: string;
}

export interface AcceptInvitationResponse {
  message: string;
  project_id: string;
  role: string;
  permission_id: number;
}

/**
 * Create a new invitation
 */
export async function createInvitation(
  request: CreateInvitationRequest
): Promise<InvitationResponse> {
  return await apiClient.post<InvitationResponse>('/api/v1/invitations', request);
}

/**
 * List invitations (sent or received)
 */
export async function listInvitations(options?: {
  type?: 'sent' | 'received';
  status?: InvitationStatus;
  projectId?: string;
}): Promise<InvitationListResponse> {
  const params = new URLSearchParams({
    type: options?.type ?? 'received',
  });

  if (options?.status) {
    params.append('status', options.status);
  }

  if (options?.projectId) {
    params.append('project_id', options.projectId);
  }

  return await apiClient.get<InvitationListResponse>(`/api/v1/invitations?${params}`);
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  request: AcceptInvitationRequest
): Promise<AcceptInvitationResponse> {
  return await apiClient.post<AcceptInvitationResponse>('/api/v1/invitations/accept', request);
}

/**
 * Cancel an invitation
 */
export async function cancelInvitation(
  invitationId: number
): Promise<InvitationResponse> {
  return await apiClient.post<InvitationResponse>(`/api/v1/invitations/${invitationId}/cancel`);
}

/**
 * Get count of pending invitations received by current user
 */
export async function getPendingInvitationsCount(): Promise<number> {
  const response = await listInvitations({
    type: 'received',
    status: 'pending',
  });
  return response.total;
}
