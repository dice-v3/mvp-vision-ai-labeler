/**
 * Admin System Statistics View Component
 * Phase 15 - Admin Dashboard
 *
 * System-wide statistics and performance metrics
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import {
  getSystemOverview,
  type SystemOverview,
} from '@/lib/api/admin';
import { toast } from '@/lib/stores/toastStore';

export default function AdminStatsView() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysFilter, setDaysFilter] = useState<number>(7);

  // Check admin access
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchOverview();
    }
  }, [user, authLoading, router]);

  // Refetch when days filter changes
  useEffect(() => {
    if (user) {
      fetchOverview();
    }
  }, [daysFilter]);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const data = await getSystemOverview(daysFilter);
      setOverview(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch statistics';
      if (message.includes('403') || message.includes('Admin')) {
        toast.error('Access denied: Admin privileges required');
        router.push('/');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading system statistics...</div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">No statistics available</div>
      </div>
    );
  }

  const { user_activity, resource_usage, performance, sessions } = overview;

  return (
    <div className="h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">System Statistics</h1>
              <p className="mt-1 text-sm text-gray-500">
                Monitor system performance and usage metrics
              </p>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={daysFilter}
                onChange={(e) => setDaysFilter(Number(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
              <button
                onClick={() => fetchOverview()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-8 space-y-8">
        {/* User Activity Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">👥 User Activity</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{user_activity.total_users}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Active (7d)</p>
              <p className="text-2xl font-bold text-green-600">{user_activity.active_users_7d}</p>
              <p className="text-xs text-gray-500 mt-1">
                {user_activity.total_users > 0
                  ? `${((user_activity.active_users_7d / user_activity.total_users) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Active (30d)</p>
              <p className="text-2xl font-bold text-green-600">{user_activity.active_users_30d}</p>
              <p className="text-xs text-gray-500 mt-1">
                {user_activity.total_users > 0
                  ? `${((user_activity.active_users_30d / user_activity.total_users) * 100).toFixed(1)}%`
                  : '0%'}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">New Users (7d)</p>
              <p className="text-2xl font-bold text-blue-600">{user_activity.new_users_7d}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Logins (7d)</p>
              <p className="text-2xl font-bold text-purple-600">{user_activity.login_activity.logins_7d}</p>
            </div>
          </div>

          {/* Registration Trend Chart */}
          {user_activity.registration_trend.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Registration Trend</h3>
              <div className="flex items-end space-x-1 h-32">
                {user_activity.registration_trend.map((item, idx) => {
                  const maxCount = Math.max(...user_activity.registration_trend.map(d => d.count));
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                        style={{ height: `${height}%` }}
                        title={`${item.date}: ${item.count} users`}
                      />
                      <span className="text-xs text-gray-500 mt-2 rotate-45 origin-left">
                        {item.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Resource Usage Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Resource Usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Datasets</p>
              <p className="text-2xl font-bold text-gray-900">{resource_usage.datasets.total}</p>
              <div className="mt-2 space-y-1">
                {Object.entries(resource_usage.datasets.by_status).map(([status, count]) => (
                  <p key={status} className="text-xs text-gray-500">
                    {status}: {count}
                  </p>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Images</p>
              <p className="text-2xl font-bold text-gray-900">{resource_usage.images.total.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Annotations</p>
              <p className="text-2xl font-bold text-gray-900">{resource_usage.annotations.total.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">
                +{resource_usage.annotations.recent_7d} (7d)
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Storage</p>
              <p className="text-2xl font-bold text-gray-900">{Number(resource_usage.storage.total_gb).toFixed(1)} GB</p>
              <p className="text-xs text-gray-500 mt-1">
                {formatBytes(resource_usage.storage.total_bytes)}
              </p>
            </div>
          </div>

          {/* Annotations by Task Type */}
          {Object.keys(resource_usage.annotations.by_task_type).length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Annotations by Task Type</h3>
              <div className="space-y-3">
                {Object.entries(resource_usage.annotations.by_task_type).map(([task, count]) => {
                  const percentage = (count / resource_usage.annotations.total) * 100;
                  return (
                    <div key={task}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium">{task}</span>
                        <span className="text-gray-500">{count.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Performance Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⚡ Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Avg Annotations/Day</p>
              <p className="text-2xl font-bold text-gray-900">{performance.annotation_rate.average_per_day.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Total: {performance.annotation_rate.total_period.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Active Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{sessions.active_sessions}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm text-gray-500">Avg Session Duration</p>
              <p className="text-2xl font-bold text-gray-900">{formatDuration(sessions.avg_duration_seconds)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {sessions.avg_duration_minutes.toFixed(1)} minutes
              </p>
            </div>
          </div>

          {/* Annotation Rate Chart */}
          {performance.annotation_rate.daily.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Daily Annotation Rate</h3>
              <div className="flex items-end space-x-1 h-32">
                {performance.annotation_rate.daily.map((item, idx) => {
                  const maxCount = Math.max(...performance.annotation_rate.daily.map(d => d.count));
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-green-500 rounded-t transition-all hover:bg-green-600"
                        style={{ height: `${height}%` }}
                        title={`${item.date}: ${item.count} annotations`}
                      />
                      <span className="text-xs text-gray-500 mt-2 rotate-45 origin-left">
                        {item.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sessions by Day Chart */}
          {sessions.sessions_by_day.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Daily Sessions</h3>
              <div className="flex items-end space-x-1 h-32">
                {sessions.sessions_by_day.map((item, idx) => {
                  const maxCount = Math.max(...sessions.sessions_by_day.map(d => d.count));
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-purple-500 rounded-t transition-all hover:bg-purple-600"
                        style={{ height: `${height}%` }}
                        title={`${item.date}: ${item.count} sessions`}
                      />
                      <span className="text-xs text-gray-500 mt-2 rotate-45 origin-left">
                        {item.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="text-center text-sm text-gray-500">
          Last updated: {new Date(overview.generated_at).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
