/**
 * Annotation History Component
 *
 * Displays annotation change history and version information
 */

'use client';

import { useState } from 'react';

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

  // TODO: Replace with actual API call to fetch history
  const historyEntries: HistoryEntry[] = [
    {
      id: '1',
      timestamp: '2025-11-14 14:30',
      action: 'Created annotations',
      user: 'User',
      annotationCount: 5,
    },
    {
      id: '2',
      timestamp: '2025-11-14 14:25',
      action: 'Deleted annotation',
      user: 'User',
      annotationCount: 3,
    },
    {
      id: '3',
      timestamp: '2025-11-14 14:20',
      action: 'Confirmed image',
      user: 'User',
      annotationCount: 4,
      version: 'v1.0',
    },
  ];

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
          {historyEntries.length === 0 ? (
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
