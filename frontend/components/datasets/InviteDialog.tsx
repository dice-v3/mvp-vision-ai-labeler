'use client';

/**
 * Enhanced Invite Dialog for Phase 8.2 - Invitation System
 *
 * Features:
 * - User search with debouncing
 * - 5-role selection (owner/admin/reviewer/annotator/viewer)
 * - User avatars and badges
 * - Real-time search results
 */

import { useState, useEffect, useCallback } from 'react';
import { searchUsers, UserSearchItem } from '@/lib/api/users';
import { createInvitation, ProjectRole } from '@/lib/api/invitations';
import { UserAvatar } from './UserAvatar';

interface InviteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onInviteSuccess: () => void;
}

const ROLE_OPTIONS: { value: ProjectRole; label: string; description: string }[] = [
  {
    value: 'owner',
    label: 'Owner',
    description: 'Full control including member management and project deletion',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Manage members, export, and all labeling features',
  },
  {
    value: 'reviewer',
    label: 'Reviewer',
    description: 'Review annotations, publish versions, and label',
  },
  {
    value: 'annotator',
    label: 'Annotator',
    description: 'Create and edit annotations',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'View-only access to annotations',
  },
];

export default function InviteDialog({
  isOpen,
  onClose,
  projectId,
  onInviteSuccess,
}: InviteDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('annotator');
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setError('');
        const response = await searchUsers(searchQuery, {
          limit: 10,
          projectId, // Exclude users already in project
        });
        setSearchResults(response.users);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search users');
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, projectId]);

  const handleSelectUser = (user: UserSearchItem) => {
    setSelectedUser(user);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleInvite = async () => {
    if (!selectedUser) {
      setError('Please select a user');
      return;
    }

    setInviting(true);
    setError('');

    try {
      await createInvitation({
        project_id: projectId,
        invitee_user_id: selectedUser.id,
        role: selectedRole,
      });

      // Success - reset and notify parent
      setSearchQuery('');
      setSelectedUser(null);
      setSelectedRole('annotator');
      onInviteSuccess();
      onClose();
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to send invitation';
      setError(errorMsg);
    } finally {
      setInviting(false);
    }
  };

  const handleClose = () => {
    if (!inviting) {
      setSearchQuery('');
      setSelectedUser(null);
      setSelectedRole('annotator');
      setSearchResults([]);
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Invite Member</h2>
          <button
            onClick={handleClose}
            disabled={inviting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* User Search */}
          {!selectedUser && (
            <div>
              <label htmlFor="user-search" className="block text-sm font-medium text-gray-700 mb-1">
                Search User <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="user-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                  }}
                  disabled={inviting}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Search by email or name..."
                  autoFocus
                />
              {searching && (
                <div className="absolute right-3 top-2.5">
                  <svg className="animate-spin h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && !selectedUser && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full px-3 py-2 flex items-center space-x-3 hover:bg-gray-50 text-left"
                    >
                      <UserAvatar
                        name={user.avatar_name || user.email}
                        color={user.badge_color || '#6366f1'}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {user.full_name || user.email}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      {user.system_role === 'admin' && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* No Results */}
              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                  <p className="text-sm text-gray-500 text-center">No users found</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Selected User Display */}
          {selectedUser && (
            <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex items-center space-x-3">
              <UserAvatar
                name={selectedUser.avatar_name || selectedUser.email}
                color={selectedUser.badge_color || '#6366f1'}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {selectedUser.full_name || selectedUser.email}
                </p>
                <p className="text-xs text-gray-600">{selectedUser.email}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  setSearchQuery('');
                }}
                className="text-violet-600 hover:text-violet-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role <span className="text-red-500">*</span>
            </label>
            <select
              id="role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as ProjectRole)}
              disabled={inviting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </option>
              ))}
            </select>
          </div>

          {/* Role Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium">Invitation Process</p>
                <p className="text-blue-700 mt-1 text-xs">
                  The user will receive an invitation notification. They must accept it to join the project.
                </p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={inviting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInvite}
            disabled={inviting || !selectedUser}
            className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {inviting && (
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            <span>{inviting ? 'Sending...' : 'Send Invitation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
