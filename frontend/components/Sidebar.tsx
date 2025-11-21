'use client';

/**
 * Sidebar Component
 *
 * 사이드바 - 프로젝트명, 데이터셋 목록, 유저 정보
 */

import { useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import type { Dataset } from '@/lib/types';
import CreateDatasetModal from '@/components/datasets/CreateDatasetModal';

interface SidebarProps {
  datasets: Dataset[];
  selectedDatasetId: string | null;
  onDatasetSelect: (datasetId: string) => void;
  onDatasetRefresh: () => void;
  onLogout: () => void;
}

export default function Sidebar({
  datasets,
  selectedDatasetId,
  onDatasetSelect,
  onDatasetRefresh,
  onLogout,
}: SidebarProps) {
  const { user } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleCreateSuccess = () => {
    onDatasetRefresh();
  };

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
              최근 데이터셋
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

      {/* User Info */}
      {user && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
              style={{ backgroundColor: user.badge_color }}
            >
              {user.full_name?.substring(0, 2).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>로그아웃</span>
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
