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
import type { Annotation as StoreAnnotation } from '@/lib/stores/annotationStore';
import { getProjectById, getProjectImageStatuses } from '@/lib/api/projects';
import { getDatasetImages } from '@/lib/api/datasets';
import { getProjectAnnotations, importAnnotationsFromJson, type Annotation as APIAnnotation } from '@/lib/api/annotations';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';
import TopBar from '@/components/annotation/TopBar';
import LeftPanel from '@/components/annotation/LeftPanel';
import Canvas from '@/components/annotation/Canvas';
import RightPanel from '@/components/annotation/RightPanel';
import BottomBar from '@/components/annotation/BottomBar';

// Phase 2.9: Map annotation_type to task type
function getTaskTypeForAnnotation(annotationType: string): string {
  const mapping: Record<string, string> = {
    'bbox': 'detection',
    'rotated_bbox': 'detection',
    'polygon': 'segmentation',
    'classification': 'classification',
    'keypoint': 'keypoint',
    'line': 'line',
    'polyline': 'geometry',
    'circle': 'geometry',
  };
  return mapping[annotationType] || annotationType;
}

// Helper function to convert API annotation to store annotation
function convertAPIAnnotationToStore(apiAnn: APIAnnotation): StoreAnnotation {
  return {
    id: apiAnn.id,
    projectId: apiAnn.project_id,
    imageId: apiAnn.image_id,
    annotationType: apiAnn.annotation_type as any,
    geometry: apiAnn.geometry,
    classId: apiAnn.class_id,
    className: apiAnn.class_name,
    attributes: apiAnn.attributes,
    confidence: apiAnn.confidence,
  };
}

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
    images,
    setImages,
    setAnnotations,
    loadPreferences,
    currentImage,
    currentTask,
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

      // Phase 2.9: Determine best initial task based on progress
      let initialTask = projectData.task_types?.[0] || null;

      if (projectData.task_types && projectData.task_types.length > 1) {
        // Load image statuses for all tasks to determine progress
        const taskProgress: Record<string, number> = {};

        for (const taskType of projectData.task_types) {
          try {
            const statusResponse = await getProjectImageStatuses(projectId, taskType);
            const completedCount = statusResponse.statuses.filter(
              s => s.status === 'completed' || s.is_image_confirmed
            ).length;
            taskProgress[taskType] = completedCount;
          } catch {
            taskProgress[taskType] = 0;
          }
        }

        // Find task with most progress
        let maxProgress = -1;
        for (const [taskType, progress] of Object.entries(taskProgress)) {
          if (progress > maxProgress) {
            maxProgress = progress;
            initialTask = taskType;
          }
        }

        console.log('[initializeAnnotation] Task progress:', taskProgress, '-> Initial task:', initialTask);
      }

      // Convert API response (snake_case) to store format (camelCase)
      setProject({
        id: projectData.id,
        name: projectData.name,
        datasetId: projectData.dataset_id,
        taskTypes: projectData.task_types,
        classes: projectData.classes,
        taskClasses: projectData.task_classes || {},  // Phase 2.9: Task-based classes
        taskConfig: projectData.task_config,
      });

      // Phase 2.9: Set the best initial task
      if (initialTask && initialTask !== projectData.task_types?.[0]) {
        useAnnotationStore.setState({ currentTask: initialTask });
      }

      // Phase 2.12: Performance Optimization - Load only first 50 images
      if (projectData.dataset_id) {
        const imagesData = await getDatasetImages(projectData.dataset_id, 50, 0);

        // Phase 2.12: Load image statuses for annotation counts
        // (No longer loading all annotations upfront - lazy loading instead)
        const imageStatusesResponse = await getProjectImageStatuses(projectId, initialTask || undefined);
        const imageStatusMap = new Map(
          imageStatusesResponse.statuses.map(s => [s.image_id, s])
        );

        // Convert DatasetImage[] to ImageData[] with status info
        const convertedImages = imagesData.map(img => {
          const imgId = String(img.id);
          const status = imageStatusMap.get(imgId);
          return {
            ...img,
            id: imgId,
            // Phase 2.12: Use annotation count from status (more efficient)
            annotation_count: status?.total_annotations || 0,
            // Phase 2.7: Add status info
            is_confirmed: status?.is_image_confirmed || false,
            status: status?.status || 'not-started',
            confirmed_at: status?.confirmed_at,
            // Track no_object status from backend (task-specific)
            has_no_object: status?.has_no_object || false,
          };
        });

        setImages(convertedImages || []);

        // Phase 2.12: Load annotations only for first image (lazy loading)
        if (convertedImages && convertedImages.length > 0) {
          const firstImageId = convertedImages[0].id;

          // Fetch annotations for first image only
          const imageAnnotations = await getProjectAnnotations(projectId, firstImageId);

          // Filter by task type
          const filteredAnnotations = imageAnnotations
            .filter((ann: any) => {
              // no_object is filtered by its task_type attribute
              if (ann.annotation_type === 'no_object') {
                return ann.attributes?.task_type === initialTask;
              }
              const annTaskType = getTaskTypeForAnnotation(ann.annotation_type);
              return !initialTask || annTaskType === initialTask;
            })
            .map(convertAPIAnnotationToStore);

          setAnnotations(filteredAnnotations || []);
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

        // Phase 2.9: Filter annotations by current task type
        const filteredAnnotations = annotationsData.filter((ann: APIAnnotation) => {
          // no_object is filtered by its task_type attribute
          if (ann.annotation_type === 'no_object') {
            return ann.attributes?.task_type === currentTask;
          }
          const annTaskType = getTaskTypeForAnnotation(ann.annotation_type);
          return !currentTask || annTaskType === currentTask;
        });

        const convertedAnnotations = (filteredAnnotations || []).map(convertAPIAnnotationToStore);
        setAnnotations(convertedAnnotations);

        // Update annotation count for current image in the images array
        // Use setState directly to avoid resetting currentImage
        // Phase 2.9: Use filtered count, not total count
        useAnnotationStore.setState((state) => ({
          images: state.images.map(img =>
            img.id === currentImage.id
              ? { ...img, annotation_count: filteredAnnotations.length }
              : img
          )
        }));
      } catch (err) {
        console.error('Failed to load annotations:', err);
      }
    };

    loadAnnotations();
  }, [currentImage?.id, projectId, currentTask, setAnnotations]); // Phase 2.9: Reload on task change

  // Phase 2.9: Reload image statuses when current task changes
  useEffect(() => {
    if (!projectId) return;

    const reloadImageStatuses = async () => {
      try {
        const imageStatusesResponse = await getProjectImageStatuses(projectId, currentTask || undefined);
        const imageStatusMap = new Map(
          imageStatusesResponse.statuses.map(s => [s.image_id, s])
        );

        // Update image statuses in the store (including annotation count for current task)
        useAnnotationStore.setState((state) => ({
          images: state.images.map(img => {
            const status = imageStatusMap.get(img.id);
            if (status) {
              return {
                ...img,
                annotation_count: status.total_annotations, // Phase 2.9: Task-filtered count
                is_confirmed: status.is_image_confirmed,
                status: status.status,
                confirmed_at: status.confirmed_at,
                has_no_object: status.has_no_object || false, // Task-specific no_object
              };
            }
            // If no status for this task, set default
            return {
              ...img,
              annotation_count: 0, // Phase 2.9: No annotations for this task
              is_confirmed: false,
              status: 'not-started',
              confirmed_at: undefined,
              has_no_object: false, // Reset for new task
            };
          })
        }));
      } catch (err) {
        console.error('Failed to reload image statuses:', err);
      }
    };

    reloadImageStatuses();
  }, [projectId, currentTask]); // Reload when task changes

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
