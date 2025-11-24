'use client';

/**
 * Invitations Management Panel for Phase 8.2 - Invitation System
 *
 * Features:
 * - View received invitations (pending)
 * - View sent invitations
 * - Accept invitations
 * - Cancel invitations
 * - Filter by status
 */

import { useState, useEffect } from 'react';
import {
  listInvitations,
  acceptInvitation,
  cancelInvitation,
  InvitationResponse,
  InvitationStatus,
} from '@/lib/api/invitations';
import { UserAvatar } from '@/components/datasets/UserAvatar';
import { toast } from '@/lib/stores/toastStore';

interface InvitationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InvitationsPanel({ isOpen, onClose }: InvitationsPanelProps) {
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [invitations, setInvitations] = useState<InvitationResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchInvitations();
    }
  }, [isOpen, activeTab]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const response = await listInvitations({
        type: activeTab,
        status: activeTab === 'received' ? 'pending' : undefined, // Only show pending for received
      });
      setInvitations(response.invitations);
    } catch (err) {
      console.error('Failed to fetch invitations:', err);
      toast.error('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitation: InvitationResponse) => {
    if (!invitation.token) {
      toast.error('Invalid invitation token');
      return;
    }

    try {
      setProcessingId(invitation.id);
      await acceptInvitation({ token: invitation.token });
      toast.success(`Joined project "${invitation.project_name}" successfully!`);
      fetchInvitations(); // Refresh list
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to accept invitation';
      toast.error(errorMsg);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancel = async (invitation: InvitationResponse) => {
    try {
      setProcessingId(invitation.id);
      await cancelInvitation(invitation.id);
      toast.success('Invitation cancelled');
      fetchInvitations(); // Refresh list
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to cancel invitation';
      toast.error(errorMsg);
    } finally {
      setProcessingId(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      owner: 'bg-purple-100 text-purple-700',
      admin: 'bg-blue-100 text-blue-700',
      reviewer: 'bg-green-100 text-green-700',
      annotator: 'bg-yellow-100 text-yellow-700',
      viewer: 'bg-gray-100 text-gray-700',
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Invitations</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 border-b border-gray-200">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('received')}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'received'
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Received
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'sent'
                  ? 'border-violet-600 text-violet-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Sent
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-violet-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : invitations.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-500">No invitations</p>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => {
                const expired = isExpired(invitation.expires_at);
                const processing = processingId === invitation.id;

                return (
                  <div
                    key={invitation.id}
                    className={`border rounded-lg p-4 ${
                      expired ? 'bg-gray-50 border-gray-200' : 'border-gray-300 hover:border-violet-300'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      {/* User Avatar */}
                      <UserAvatar
                        name={activeTab === 'received' ? invitation.inviter_name || invitation.invitee_email : invitation.invitee_name || invitation.invitee_email}
                        color="#6366f1"
                        size="md"
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {activeTab === 'received' ? (
                          <p className="text-sm text-gray-900">
                            <span className="font-medium">{invitation.inviter_name || 'Someone'}</span>
                            {' invited you to join '}
                            <span className="font-medium">{invitation.project_name || invitation.project_id}</span>
                          </p>
                        ) : (
                          <p className="text-sm text-gray-900">
                            Invited{' '}
                            <span className="font-medium">{invitation.invitee_name || invitation.invitee_email}</span>
                            {' to '}
                            <span className="font-medium">{invitation.project_name || invitation.project_id}</span>
                          </p>
                        )}

                        <div className="flex items-center space-x-2 mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${getRoleBadgeColor(invitation.role)}`}>
                            {invitation.role}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(invitation.created_at)}
                          </span>
                          {expired && (
                            <span className="text-xs text-red-600">
                              Expired
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        {activeTab === 'received' && !expired && (
                          <>
                            <button
                              onClick={() => handleAccept(invitation)}
                              disabled={processing}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 rounded hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {processing ? 'Accepting...' : 'Accept'}
                            </button>
                            <button
                              onClick={() => handleCancel(invitation)}
                              disabled={processing}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {activeTab === 'sent' && invitation.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(invitation)}
                            disabled={processing}
                            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {processing ? 'Cancelling...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
