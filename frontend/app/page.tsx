'use client';

/**
 * Dashboard Page
 *
 * 사이드바 + 데이터셋 상세 정보 표시
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { listDatasets } from '@/lib/api/datasets';
import { getProjectForDataset, getDatasetImages, type DatasetImage } from '@/lib/api/datasets';
import { getProjectHistory, type AnnotationHistory } from '@/lib/api/annotations';
import type { Dataset, Project } from '@/lib/types';
import Sidebar from '@/components/Sidebar';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [history, setHistory] = useState<AnnotationHistory[]>([]);
  const [images, setImages] = useState<DatasetImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectLoading, setProjectLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchDatasets();
    }
  }, [user, authLoading, router]);

  const fetchDatasets = async () => {
    try {
      const data = await listDatasets();
      setDatasets(data);
      setError('');

      // Auto-select first dataset
      if (data.length > 0) {
        handleDatasetSelect(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터셋을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleDatasetSelect = async (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    const dataset = datasets.find(d => d.id === datasetId);
    setSelectedDataset(dataset || null);

    // Fetch project info
    setProjectLoading(true);
    try {
      const projectData = await getProjectForDataset(datasetId);
      setProject(projectData);

      // Fetch annotation history
      setHistoryLoading(true);
      try {
        const historyData = await getProjectHistory(projectData.id, 0, 10);
        setHistory(historyData);
      } catch (err) {
        console.error('Failed to fetch history:', err);
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }

      // Fetch dataset images
      setImagesLoading(true);
      try {
        const imagesData = await getDatasetImages(datasetId, 8);
        console.log('Fetched images:', imagesData);
        setImages(imagesData);
      } catch (err) {
        console.error('Failed to fetch images:', err);
        setImages([]);
      } finally {
        setImagesLoading(false);
      }
    } catch (err) {
      console.error('Failed to fetch project:', err);
      setProject(null);
      setHistory([]);
      setImages([]);
    } finally {
      setProjectLoading(false);
    }
  };

  const handleStartLabeling = () => {
    if (project) {
      router.push(`/annotate/${project.id}`);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-violet-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        datasets={datasets}
        selectedDatasetId={selectedDatasetId}
        onDatasetSelect={handleDatasetSelect}
        onLogout={logout}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!selectedDataset ? (
            <div className="text-center py-20">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">데이터셋을 선택해주세요</h3>
              <p className="text-sm text-gray-500">
                왼쪽 사이드바에서 작업할 데이터셋을 선택하세요
              </p>
            </div>
          ) : (
            <div>
              {/* Dataset Header */}
              <div className="mb-8">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{selectedDataset.name}</h1>
                    <p className="text-gray-600">{selectedDataset.description || '설명 없음'}</p>
                  </div>
                  {selectedDataset.labeled && (
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">
                      라벨링 완료
                    </span>
                  )}
                </div>

                {/* Dataset Info Tags & Task Types & Start Button */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-2">
                    {selectedDataset.format && (
                      <span className="px-3 py-1 text-sm rounded-lg bg-gray-100 text-gray-700">
                        {selectedDataset.format}
                      </span>
                    )}
                    {selectedDataset.source && (
                      <span className="px-3 py-1 text-sm rounded-lg bg-gray-100 text-gray-700">
                        {selectedDataset.source}
                      </span>
                    )}
                    {selectedDataset.visibility && (
                      <span className="px-3 py-1 text-sm rounded-lg bg-gray-100 text-gray-700">
                        {selectedDataset.visibility}
                      </span>
                    )}
                    {project && project.task_types.map((type) => (
                      <span
                        key={type}
                        className="px-3 py-1 rounded-lg bg-violet-50 text-violet-700 text-sm font-medium"
                      >
                        {type === 'classification' && '분류'}
                        {type === 'detection' && '객체 탐지'}
                        {type === 'bbox' && 'BBox'}
                        {type === 'polygon' && '폴리곤'}
                        {type === 'keypoint' && '키포인트'}
                        {type === 'segmentation' && '세그멘테이션'}
                        {!['classification', 'detection', 'bbox', 'polygon', 'keypoint', 'segmentation'].includes(type) && type}
                      </span>
                    ))}
                  </div>
                  {project && (
                    <button
                      onClick={handleStartLabeling}
                      className="px-6 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-violet-500/50 transition-all flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      <span>레이블링 시작</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Project Info */}
              {projectLoading ? (
                <div className="text-center py-8">
                  <svg className="animate-spin h-8 w-8 text-violet-600 mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : project ? (
                <div className="space-y-6">
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-500">전체 이미지</h3>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-gray-900">{project.total_images}</p>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-500">완료된 이미지</h3>
                        <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-violet-600">{project.annotated_images}</p>
                    </div>

                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-medium text-gray-500">진행률</h3>
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <p className="text-3xl font-bold text-green-600">
                        {project.total_images > 0
                          ? Math.round((project.annotated_images / project.total_images) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>

                  {/* Two Column Layout: Activity History & Dataset Info */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Activity History */}
                    <div className="bg-white rounded-lg border border-gray-200">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900">최근 활동</h3>
                        <p className="text-xs text-gray-500 mt-0.5">어노테이션 수정 이력</p>
                      </div>
                      <div className="p-4">
                        {historyLoading ? (
                          <div className="text-center py-8">
                            <svg className="animate-spin h-6 w-6 text-violet-600 mx-auto" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          </div>
                        ) : !history || history.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            <p className="text-sm">아직 활동 이력이 없습니다</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {history.slice(0, 5).map((item, idx) => (
                              <div key={idx} className="flex items-start space-x-3 text-sm">
                                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                                  item.action === 'create' ? 'bg-green-500' :
                                  item.action === 'update' ? 'bg-blue-500' :
                                  item.action === 'delete' ? 'bg-red-500' : 'bg-gray-500'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-gray-900">
                                    <span className="font-medium">{item.user_name || 'Unknown'}</span>
                                    {' '}
                                    <span className="text-gray-600">
                                      {item.action === 'create' && '생성'}
                                      {item.action === 'update' && '수정'}
                                      {item.action === 'delete' && '삭제'}
                                    </span>
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(item.timestamp).toLocaleString('ko-KR')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dataset Metadata */}
                    <div className="bg-white rounded-lg border border-gray-200">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900">데이터셋 정보</h3>
                      </div>
                      <div className="p-4">
                        <dl className="space-y-3 text-sm">
                          <div>
                            <dt className="text-xs text-gray-500 mb-1">프로젝트 ID</dt>
                            <dd className="text-gray-900 font-mono text-xs">{project.id}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 mb-1">데이터셋 ID</dt>
                            <dd className="text-gray-900 font-mono text-xs">{project.dataset_id}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 mb-1">설명</dt>
                            <dd className="text-gray-900">{project.description || '설명 없음'}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 mb-1">생성일</dt>
                            <dd className="text-gray-900">{new Date(project.created_at).toLocaleString('ko-KR')}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-gray-500 mb-1">상태</dt>
                            <dd>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {project.status === 'active' ? '활성' : project.status}
                              </span>
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>

                  {/* Image Thumbnails */}
                  <div className="bg-white rounded-lg border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900">이미지 미리보기</h3>
                      <p className="text-xs text-gray-500 mt-0.5">데이터셋의 샘플 이미지 (Loading: {imagesLoading ? 'true' : 'false'}, Count: {images.length})</p>
                    </div>
                    <div className="p-4">
                      {imagesLoading ? (
                        <div className="text-center py-8">
                          <svg className="animate-spin h-6 w-6 text-violet-600 mx-auto" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <p className="text-xs text-gray-500 mt-2">이미지 로딩 중...</p>
                        </div>
                      ) : !images || images.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm">이미지를 불러올 수 없습니다</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                          {images.slice(0, 8).map((image) => (
                            <div key={image.id} className="aspect-square relative rounded border border-gray-200 overflow-hidden hover:border-violet-400 transition-colors group">
                              <img
                                src={image.url}
                                alt={image.file_name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  console.error('Image failed to load:', image.file_name, image.url);
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                                onLoad={() => console.log('Image loaded:', image.file_name)}
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                                <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity truncate px-2">
                                  {image.file_name}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Classes Table */}
                  {project.classes && Object.keys(project.classes).length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <h3 className="text-sm font-semibold text-gray-900">클래스 목록</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{Object.keys(project.classes).length}개 클래스</p>
                      </div>
                      <div className="overflow-x-auto max-h-80 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">클래스명</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">색상</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">이미지</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">BBox</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {Object.entries(project.classes).map(([classId, classInfo]: [string, any]) => (
                              <tr key={classId} className="hover:bg-gray-50">
                                <td className="px-4 py-2 text-gray-900">{classInfo.name}</td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center space-x-2">
                                    <div
                                      className="w-4 h-4 rounded border border-gray-300"
                                      style={{ backgroundColor: classInfo.color }}
                                    />
                                    <span className="text-xs text-gray-500">{classInfo.color}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-right text-gray-600">{classInfo.image_count || 0}</td>
                                <td className="px-4 py-2 text-right text-gray-600">{classInfo.bbox_count || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-600">프로젝트 정보를 불러올 수 없습니다</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
