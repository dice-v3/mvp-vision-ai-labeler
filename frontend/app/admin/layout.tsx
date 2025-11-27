'use client';

/**
 * Admin Layout
 * Phase 15 - Admin Dashboard
 *
 * Provides Sidebar + content layout for all admin pages
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { listDatasets } from '@/lib/api/datasets';
import type { Dataset } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import InvitationsPanel from '@/components/invitations/InvitationsPanel';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitationsPanelOpen, setInvitationsPanelOpen] = useState(false);

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
    } catch (err) {
      console.error('Failed to fetch datasets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar
          datasets={datasets}
          selectedDatasetId={null}
          onDatasetSelect={(datasetId) => router.push(`/?dataset=${datasetId}`)}
          onDatasetRefresh={fetchDatasets}
          onLogout={handleLogout}
          onInvitationsClick={() => setInvitationsPanelOpen(true)}
        />

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>

      {/* Invitations Panel */}
      <InvitationsPanel
        isOpen={invitationsPanelOpen}
        onClose={() => setInvitationsPanelOpen(false)}
      />
    </>
  );
}
