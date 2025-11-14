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
import { getProjectById, getProjectImageStatuses } from '@/lib/api/projects';
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
    preferences,
  } = useAnnotationStore();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Apply dark mode
  useEffect(() => {
    if (preferences.darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [preferences.darkMode]);

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

        // Load all annotations for the project to count per image
        const allAnnotations = await getProjectAnnotations(projectId);

        // Count annotations per image
        const annotationCountMap = new Map<string, number>();
        allAnnotations.forEach((ann: any) => {
          const imageId = ann.image_id || ann.imageId;
          annotationCountMap.set(imageId, (annotationCountMap.get(imageId) || 0) + 1);
        });

        // Phase 2.7: Load image statuses
        const imageStatusesResponse = await getProjectImageStatuses(projectId);
        const imageStatusMap = new Map(
          imageStatusesResponse.statuses.map(s => [s.image_id, s])
        );

        // Convert DatasetImage[] to ImageData[] (number id -> string id) and add annotation counts + status
        const convertedImages = imagesData.map(img => {
          const imgId = String(img.id);
          const status = imageStatusMap.get(imgId);
          return {
            ...img,
            id: imgId,
            annotation_count: annotationCountMap.get(imgId) || 0,
            // Phase 2.7: Add status info
            is_confirmed: status?.is_image_confirmed || false,
            status: status?.status || 'not-started',
            confirmed_at: status?.confirmed_at,
          };
        });

        setImages(convertedImages || []);

        // Load annotations for first image if available
        if (convertedImages && convertedImages.length > 0) {
          const firstImageId = convertedImages[0].id;
          const firstImageAnnotations = allAnnotations.filter(
            (ann: any) => (ann.image_id || ann.imageId) === firstImageId
          );
          setAnnotations(firstImageAnnotations || []);
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

        // Update annotation count for current image
        const updatedImages = images.map(img =>
          img.id === currentImage.id
            ? { ...img, annotation_count: annotationsData.length }
            : img
        );
        setImages(updatedImages);
      } catch (err) {
        console.error('Failed to load annotations:', err);
      }
    };

    loadAnnotations();
  }, [currentImage?.id, projectId]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="text-gray-900 dark:text-white">
          <svg className="animate-spin h-8 w-8 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading annotation interface...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">Error</div>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />
        <Canvas />
        <RightPanel />
      </div>

      {/* BottomBar hidden - navigation moved to Canvas */}
      {/* <BottomBar /> */}
    </div>
  );
}
