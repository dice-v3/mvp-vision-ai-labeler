'use client';

/**
 * Sidebar Component
 *
 * 사이드바 - 프로젝트명, 데이터셋 목록, 유저 정보
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import type { Dataset } from '@/lib/types';
import CreateDatasetModal from '@/components/datasets/CreateDatasetModal';
import { getPendingInvitationsCount } from '@/lib/api/invitations';

interface SidebarProps {
  datasets: Dataset[];
  selectedDatasetId: string | null;
  onDatasetSelect: (datasetId: string) => void;
  onDatasetRefresh: () => void;
  onLogout: () => void;
  onInvitationsClick?: () => void; // Phase 8.2
}

// Helper function to convert badge color names to hex values
const getBadgeColorHex = (colorName: string): string => {
  // If already a hex color, return as-is
  if (colorName && colorName.startsWith('#')) {
    return colorName;
  }

  // Otherwise, map color name to hex
  const colorMap: Record<string, string> = {
    'red': '#EF4444',
    'orange': '#F97316',
    'amber': '#F59E0B',
    'yellow': '#EAB308',
    'lime': '#84CC16',
    'green': '#22C55E',
    'emerald': '#10B981',
    'teal': '#14B8A6',
    'cyan': '#06B6D4',
    'sky': '#0EA5E9',
    'blue': '#3B82F6',
    'indigo': '#6366F1',
    'violet': '#8B5CF6',
    'purple': '#A855F7',
    'fuchsia': '#D946EF',
    'pink': '#EC4899',
    'rose': '#F43F5E',
  };
  return colorMap[colorName.toLowerCase()] || '#6B7280'; // Default to gray-500
};

export default function Sidebar({
  datasets,
  selectedDatasetId,
  onDatasetSelect,
  onDatasetRefresh,
  onLogout,
  onInvitationsClick,
}: SidebarProps) {
  const { user } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCreateSuccess = () => {
    onDatasetRefresh();
  };

  // Fetch pending invitations count
  const fetchPendingInvitations = async () => {
    try {
      const count = await getPendingInvitationsCount();
      setPendingInvitationsCount(count);
    } catch (err) {
      console.error('Failed to fetch pending invitations:', err);
    }
  };

  // Fetch pending invitations on mount and every 30 seconds
  useEffect(() => {
    if (!user) return;

    fetchPendingInvitations();
    const interval = setInterval(fetchPendingInvitations, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [user?.id]); // Only re-run when user.id changes, not user object reference

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  return (
    <>
    <div className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col">
      {/* Project Name */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900">Vision AI Labeler</h1>
            <p className="text-xs text-gray-500">데이터 어노테이션</p>
          </div>
        </div>
      </div>

      {/* Datasets List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              내 데이터셋
            </h2>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="p-1 rounded-md text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
              title="새 데이터셋 생성"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="space-y-1">
            {datasets.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                데이터셋이 없습니다
              </p>
            ) : (
              datasets.map((dataset) => (
                <button
                  key={dataset.id}
                  onClick={() => onDatasetSelect(dataset.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedDatasetId === dataset.id
                      ? 'bg-violet-50 text-violet-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <svg
                      className={`w-4 h-4 flex-shrink-0 ${
                        selectedDatasetId === dataset.id ? 'text-violet-600' : 'text-gray-400'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{dataset.name}</p>
                      <p className="text-xs text-gray-500">
                        {dataset.num_items || 0}개 이미지
                      </p>
                    </div>
                    {dataset.labeled && (
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Admin Menu (Phase 15) - Only show for admin users */}
      {user && user.system_role === 'admin' && (
        <div className="p-4 border-t border-gray-200">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            관리자 메뉴
          </h2>
          <div className="space-y-1">
            <a
              href="/admin/datasets"
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <span className="text-sm">데이터셋 관리</span>
            </a>
            <a
              href="/admin/audit-logs"
              className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
            >
              <svg className="w-4 h-4 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm">시스템 로그</span>
            </a>
          </div>
        </div>
      )}

      {/* User Info with Dropdown Menu */}
      {user && (
        <div className="p-4 border-t border-gray-200 relative" ref={menuRef}>
          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
              {/* Invitations */}
              {onInvitationsClick && (
                <button
                  onClick={() => {
                    onInvitationsClick();
                    setUserMenuOpen(false);
                  }}
                  className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span>초대 알림</span>
                  </div>
                  {pendingInvitationsCount > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                      {pendingInvitationsCount > 9 ? '9+' : pendingInvitationsCount}
                    </span>
                  )}
                </button>
              )}
              {/* Logout */}
              <button
                onClick={() => {
                  onLogout();
                  setUserMenuOpen(false);
                }}
                className="w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center space-x-3 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>로그아웃</span>
              </button>
            </div>
          )}

          {/* User Profile Button */}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors relative"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
              style={{ backgroundColor: getBadgeColorHex(user.badge_color) }}
            >
              {user.full_name?.substring(0, 2).toUpperCase() || 'U'}
              {/* Notification Badge */}
              {pendingInvitationsCount > 0 && (
                <span className="absolute top-1 left-8 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full border-2 border-white">
                  {pendingInvitationsCount > 9 ? '9+' : pendingInvitationsCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
              {user.system_role && (
                <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${
                  user.system_role === 'admin'
                    ? 'bg-violet-100 text-violet-700'
                    : user.system_role === 'manager'
                    ? 'bg-blue-100 text-blue-700'
                    : user.system_role === 'advanced_engineer'
                    ? 'bg-cyan-100 text-cyan-700'
                    : user.system_role === 'standard_engineer'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {user.system_role === 'admin'
                    ? '관리자'
                    : user.system_role === 'manager'
                    ? '매니저'
                    : user.system_role === 'advanced_engineer'
                    ? '엔지니어(고급)'
                    : user.system_role === 'standard_engineer'
                    ? '엔지니어(기본)'
                    : '게스트'}
                </span>
              )}
            </div>
          </button>
        </div>
      )}
    </div>

    {/* Create Dataset Modal */}
    <CreateDatasetModal
      mode="create"
      isOpen={createModalOpen}
      onClose={() => setCreateModalOpen(false)}
      onSuccess={handleCreateSuccess}
    />
    </>
  );
}
