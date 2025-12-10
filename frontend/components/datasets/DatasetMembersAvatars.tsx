'use client';

/**
 * Dataset Members Avatars Component
 *
 * GitHub-style avatar group with:
 * - Member avatars (using badge_color)
 * - Owner crown overlay
 * - Add member button (owner only)
 * - Click avatar to show dropdown with role management
 */

import { useState, useRef, useEffect } from 'react';

interface Member {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  user_badge_color: string;
  role: 'owner' | 'admin' | 'reviewer' | 'annotator' | 'viewer';
}

interface DatasetMembersAvatarsProps {
  members: Member[];
  currentUserId: number;
  isOwner: boolean;
  onInvite: () => void;
  onChangeRole: (userId: number, newRole: 'admin' | 'reviewer' | 'annotator' | 'viewer') => void;
  onRemove: (userId: number) => void;
}

// Helper function to handle both hex colors and color names
const getBadgeColorHex = (colorValue: string): string => {
  // If already a hex color, return as-is
  if (colorValue && colorValue.startsWith('#')) {
    return colorValue;
  }
  // For color names, return default or the value as-is
  return colorValue || '#6B7280';
};

export default function DatasetMembersAvatars({
  members,
  currentUserId,
  isOwner,
  onInvite,
  onChangeRole,
  onRemove,
}: DatasetMembersAvatarsProps) {
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSelectedMember(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name?.substring(0, 2).toUpperCase() || 'U';
  };

  const handleAvatarClick = (userId: number) => {
    setSelectedMember(selectedMember === userId ? null : userId);
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Member Avatars */}
      {members.map((member) => (
        <div key={member.user_id} className="relative">
          <button
            onClick={() => handleAvatarClick(member.user_id)}
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm hover:ring-2 hover:ring-violet-400 transition-all"
            style={{ backgroundColor: getBadgeColorHex(member.user_badge_color) }}
            title={`${member.user_name} (${member.role})`}
          >
            {getInitials(member.user_name)}

            {/* Owner Crown */}
            {member.role === 'owner' && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
                <svg className="w-3 h-3 text-yellow-900" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            )}
          </button>

          {/* Dropdown */}
          {selectedMember === member.user_id && (
            <div
              ref={dropdownRef}
              className="absolute top-12 right-0 z-50 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2"
            >
              {/* Member Info */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: getBadgeColorHex(member.user_badge_color) }}
                  >
                    {getInitials(member.user_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{member.user_name}</p>
                    <p className="text-xs text-gray-500 truncate">{member.user_email}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    member.role === 'owner'
                      ? 'bg-yellow-100 text-yellow-800'
                      : member.role === 'admin'
                      ? 'bg-purple-100 text-purple-800'
                      : member.role === 'reviewer'
                      ? 'bg-blue-100 text-blue-800'
                      : member.role === 'annotator'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {member.role === 'owner' && (
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    )}
                    {member.role === 'owner'
                      ? '소유자'
                      : member.role === 'admin'
                      ? '관리자'
                      : member.role === 'reviewer'
                      ? '리뷰어'
                      : member.role === 'annotator'
                      ? '어노테이터'
                      : '뷰어'}
                  </span>
                </div>
              </div>

              {/* Actions (only if current user is owner/admin and not viewing self) */}
              {isOwner && member.user_id !== currentUserId && (
                <div className="py-1">
                  {member.role === 'owner' ? (
                    <div className="px-4 py-2 text-xs text-gray-500">
                      소유권은 소유권 이전 기능을 사용해주세요
                    </div>
                  ) : (
                    <>
                      {/* Role Change Dropdown */}
                      <div className="px-4 py-2">
                        <label className="block text-xs text-gray-500 mb-1">권한 변경</label>
                        <select
                          value={member.role}
                          onChange={(e) => {
                            const newRole = e.target.value as 'admin' | 'reviewer' | 'annotator' | 'viewer';
                            onChangeRole(member.user_id, newRole);
                            setSelectedMember(null);
                          }}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        >
                          <option value="admin">관리자</option>
                          <option value="reviewer">리뷰어</option>
                          <option value="annotator">어노테이터</option>
                          <option value="viewer">뷰어</option>
                        </select>
                      </div>
                      {/* Remove Button */}
                      <button
                        onClick={() => {
                          onRemove(member.user_id);
                          setSelectedMember(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>제거</span>
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Self view message */}
              {member.user_id === currentUserId && (
                <div className="px-4 py-2 text-xs text-gray-500">
                  본인의 권한은 변경할 수 없습니다
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add Member Button (owner only) */}
      {isOwner && (
        <button
          onClick={onInvite}
          className="w-10 h-10 rounded-full bg-gray-100 hover:bg-violet-100 text-gray-600 hover:text-violet-600 flex items-center justify-center transition-colors border-2 border-dashed border-gray-300 hover:border-violet-400"
          title="멤버 초대"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}
