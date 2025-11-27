/**
 * Admin Dataset Manager View Component
 * Phase 15 - Admin Dashboard
 *
 * Dataset overview, management, and monitoring for administrators
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import {
  getDatasetOverview,
  getRecentDatasets,
  getDatasetDetails,
  getLabelingProgress,
  type DatasetOverview,
  type RecentDatasetUpdate,
  type DatasetDetail,
  type LabelingProgress,
} from '@/lib/api/admin';
import { toast } from '@/lib/stores/toastStore';

// Icons (using Heroicons via CDN or local implementation)
const icons = {
  database: '🗄️',
  image: '🖼️',
  storage: '💾',
  annotation: '📝',
  arrow: '→',
  refresh: '🔄',
  check: '✓',
  warning: '⚠️',
};

export default function AdminDatasetsView() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [overview, setOverview] = useState<DatasetOverview | null>(null);
  const [recentDatasets, setRecentDatasets] = useState<RecentDatasetUpdate[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [datasetDetail, setDatasetDetail] = useState<DatasetDetail | null>(null);
  const [labelingProgress, setLabelingProgress] = useState<LabelingProgress | null>(null);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    // TODO: Check if user.is_admin once we have the user type updated
    // For now, attempt to fetch admin data and handle 403

    if (user) {
      fetchOverview();
      fetchRecentDatasets();
    }
  }, [user, authLoading, router]);

  const fetchOverview = async () => {
    try {
      const data = await getDatasetOverview();
      setOverview(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch overview';
      if (message.includes('403') || message.includes('Admin')) {
        toast.error('Access denied: Admin privileges required');
        router.push('/');
      } else {
        toast.error(message);
      }
    }
  };

  const fetchRecentDatasets = async () => {
    try {
      setLoading(true);
      const data = await getRecentDatasets(20);
      setRecentDatasets(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch recent datasets');
    } finally {
      setLoading(false);
    }
  };

  const fetchDatasetDetail = async (datasetId: string) => {
    try {
      setDetailLoading(true);
      const [detail, progress] = await Promise.all([
        getDatasetDetails(datasetId),
        getLabelingProgress(datasetId),
      ]);
      setDatasetDetail(detail);
      setLabelingProgress(progress);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch dataset details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDatasetClick = (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    fetchDatasetDetail(datasetId);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dataset Manager</h1>
              <p className="mt-1 text-sm text-gray-500">
                Monitor and manage all datasets across the system
              </p>
            </div>
            <button
              onClick={() => {
                fetchOverview();
                fetchRecentDatasets();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {icons.refresh} Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-8">
        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <span className="text-3xl mr-3">{icons.database}</span>
                <div>
                  <p className="text-sm text-gray-500">Total Datasets</p>
                  <p className="text-2xl font-bold text-gray-900">{overview.total_datasets}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <span className="text-3xl mr-3">{icons.image}</span>
                <div>
                  <p className="text-sm text-gray-500">Total Images</p>
                  <p className="text-2xl font-bold text-gray-900">{overview.total_images.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <span className="text-3xl mr-3">{icons.storage}</span>
                <div>
                  <p className="text-sm text-gray-500">Total Storage</p>
                  <p className="text-2xl font-bold text-gray-900">{formatBytes(overview.total_size_bytes)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <span className="text-3xl mr-3">{icons.annotation}</span>
                <div>
                  <p className="text-sm text-gray-500">Total Annotations</p>
                  <p className="text-2xl font-bold text-gray-900">{overview.total_annotations.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Datasets Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recent Updates</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dataset
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Images
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentDatasets.map((dataset) => (
                    <tr
                      key={dataset.dataset_id}
                      onClick={() => handleDatasetClick(dataset.dataset_id)}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedDatasetId === dataset.dataset_id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{dataset.name}</div>
                        <div className="text-xs text-gray-500">{dataset.dataset_id.substring(0, 8)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {dataset.num_images.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          dataset.status === 'active' ? 'bg-green-100 text-green-800' :
                          dataset.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {dataset.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {dataset.last_updated ? new Date(dataset.last_updated).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dataset Detail Panel */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Dataset Details</h2>
            </div>
            <div className="p-6">
              {!selectedDatasetId && (
                <div className="text-center text-gray-500 py-12">
                  Select a dataset to view details
                </div>
              )}

              {detailLoading && (
                <div className="text-center text-gray-500 py-12">
                  Loading dataset details...
                </div>
              )}

              {selectedDatasetId && !detailLoading && datasetDetail && labelingProgress && (
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Basic Information</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Name:</span> {datasetDetail.dataset.name}</div>
                      <div><span className="font-medium">Owner:</span> {datasetDetail.dataset.owner_email || 'N/A'}</div>
                      <div><span className="font-medium">Status:</span> {datasetDetail.dataset.status}</div>
                      <div><span className="font-medium">Created:</span> {formatDate(datasetDetail.dataset.created_at)}</div>
                    </div>
                  </div>

                  {/* Storage Info */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Storage</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Images:</span> {datasetDetail.storage_info.image_count.toLocaleString()}</div>
                      <div><span className="font-medium">Total Size:</span> {formatBytes(datasetDetail.storage_info.total_size_bytes)}</div>
                      <div><span className="font-medium">Avg Size:</span> {formatBytes(datasetDetail.storage_info.avg_size_bytes)}</div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Labeling Progress</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Completion:</span> {(labelingProgress.completion_rate * 100).toFixed(1)}%
                      </div>
                      <div>
                        <span className="font-medium">Completed:</span> {labelingProgress.completed_images} / {labelingProgress.total_images}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${labelingProgress.completion_rate * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Projects */}
                  {datasetDetail.projects.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-500 mb-2">Projects ({datasetDetail.projects.length})</h3>
                      <div className="space-y-2">
                        {datasetDetail.projects.map((project) => (
                          <div key={project.project_id} className="text-sm border-l-2 border-blue-500 pl-2">
                            <div className="font-medium">{project.name}</div>
                            <div className="text-gray-500">
                              {project.annotation_count} annotations • {project.task_types.join(', ')}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
