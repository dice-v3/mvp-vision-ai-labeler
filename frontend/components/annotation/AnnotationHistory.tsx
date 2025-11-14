/**
 * Annotation History Component
 *
 * Displays annotation change history and version information
 */

'use client';

import { useState, useEffect } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { getProjectHistory, type AnnotationHistory as APIHistoryEntry } from '@/lib/api/annotations';

interface HistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  annotationCount: number;
  version?: string;
}

export default function AnnotationHistory() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { project, currentImage } = useAnnotationStore();

  // Phase 2.7: Load history from API
  useEffect(() => {
    if (!project?.id) return;

    const loadHistory = async () => {
      try {
        setLoading(true);
        const history = await getProjectHistory(project.id, 0, 20);

        // Convert API history to UI format
        const converted: HistoryEntry[] = history.map((entry: APIHistoryEntry) => ({
          id: String(entry.id),
          timestamp: new Date(entry.timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          action: formatAction(entry.action),
          user: entry.changed_by_name || 'Unknown',
          annotationCount: 0, // Could calculate from state if needed
        }));

        setHistoryEntries(converted);
      } catch (error) {
        console.error('Failed to load history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [project?.id]);

  const formatAction = (action: string): string => {
    const actions: Record<string, string> = {
      create: 'Created annotation',
      update: 'Updated annotation',
      delete: 'Deleted annotation',
      confirm: 'Confirmed annotation',
      unconfirm: 'Unconfirmed annotation',
    };
    return actions[action] || action;
  };

  return (
    <div className="border-b border-gray-300 dark:border-gray-700">
      {/* Header */}
      <div
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-400">
            Annotation History
          </h4>
          <span className="text-[10px] text-gray-500 dark:text-gray-600">
            ({historyEntries.length})
          </span>
        </div>
        <svg
          className={`w-3.5 h-3.5 text-gray-600 dark:text-gray-400 transition-transform ${
            isCollapsed ? '' : 'rotate-180'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* History Table */}
      {!isCollapsed && (
        <div className="max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-500">
              Loading history...
            </div>
          ) : historyEntries.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500 dark:text-gray-500">
              No history available
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-[10px] text-gray-600 dark:text-gray-500 border-b border-gray-300 dark:border-gray-700 sticky top-0 bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="text-left py-1.5 px-2 font-medium">Time</th>
                  <th className="text-left py-1.5 px-2 font-medium">Action</th>
                  <th className="text-center py-1.5 px-2 font-medium w-12">Ann</th>
                </tr>
              </thead>
              <tbody>
                {historyEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-gray-300 dark:border-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                    title={`${entry.action} by ${entry.user}`}
                  >
                    <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {entry.timestamp.split(' ')[1]}
                    </td>
                    <td className="py-1.5 px-2 text-gray-900 dark:text-gray-300 truncate">
                      <div className="flex items-center gap-1">
                        <span className="truncate">{entry.action}</span>
                        {entry.version && (
                          <span className="text-[9px] bg-violet-500/20 text-violet-600 dark:text-violet-400 px-1 py-0.5 rounded flex-shrink-0">
                            {entry.version}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-center text-gray-600 dark:text-gray-500">
                      {entry.annotationCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
