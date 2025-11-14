'use client';

/**
 * Annotation Page
 *
 * Main annotation interface for labeling images
 * Route: /annotate/[projectId]
 */

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { getProjectById } from '@/lib/api/projects';
import { getDatasetImages } from '@/lib/api/datasets';
import { getProjectAnnotations, importAnnotationsFromJson } from '@/lib/api/annotations';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import TopBar from '@/components/annotation/TopBar';
import LeftPanel from '@/components/annotation/LeftPanel';
import Canvas from '@/components/annotation/Canvas';
import RightPanel from '@/components/annotation/RightPanel';
import BottomBar from '@/components/annotation/BottomBar';

export default function AnnotationPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const projectId = params.projectId as string;

  const {
    loading,
    error,
    setLoading,
    setError,
    setProject,
    setImages,
    setAnnotations,
    loadPreferences,
    currentImage,
  } = useAnnotationStore();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user && projectId) {
      initializeAnnotation();
    }
  }, [user, authLoading, projectId, router]);

  const initializeAnnotation = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load preferences from localStorage
      loadPreferences();

      // Load project
      const projectData = await getProjectById(projectId);
      setProject(projectData);

      // Load images using dataset_id from project
      if (projectData.dataset_id) {
        const imagesData = await getDatasetImages(projectData.dataset_id, 1000);

        // Convert DatasetImage[] to ImageData[] (number id -> string id)
        const convertedImages = imagesData.map(img => ({
          ...img,
          id: String(img.id),
        }));

        setImages(convertedImages || []);

        // Load annotations for first image if available
        if (convertedImages && convertedImages.length > 0) {
          const firstImageId = convertedImages[0].id;

          // Load annotations for current image
          const annotationsData = await getProjectAnnotations(projectId, firstImageId);
          setAnnotations(annotationsData || []);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Failed to initialize annotation:', err);
      setError(err instanceof Error ? err.message : 'Failed to load annotation data');
      setLoading(false);
    }
  };

  // Load annotations when currentImage changes
  useEffect(() => {
    if (!currentImage || !projectId) return;

    const loadAnnotations = async () => {
      try {
        const annotationsData = await getProjectAnnotations(projectId, currentImage.id);
        setAnnotations(annotationsData || []);
      } catch (err) {
        console.error('Failed to load annotations:', err);
      }
    };

    loadAnnotations();
  }, [currentImage, projectId]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-white">
          <svg className="animate-spin h-8 w-8 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-sm text-gray-400">Loading annotation interface...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">⚠ Error</div>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />
        <Canvas />
        <RightPanel />
      </div>

      <BottomBar />
    </div>
  );
}
