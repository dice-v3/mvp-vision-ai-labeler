/**
 * Classification Panel Component
 *
 * Panel for image-level classification labels.
 * Displays all available classes with radio buttons (single-label) or checkboxes (multi-label).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { createAnnotation, updateAnnotation, deleteAnnotation } from '@/lib/api/annotations';
import type { AnnotationCreateRequest, AnnotationUpdateRequest } from '@/lib/api/annotations';

interface ClassificationPanelProps {
  multiLabel?: boolean; // Allow multiple classes per image
}

export default function ClassificationPanel({ multiLabel = false }: ClassificationPanelProps) {
  const {
    currentImage,
    project,
    annotations,
    addAnnotation,
    updateAnnotation: updateAnnotationInStore,
    deleteAnnotation: deleteAnnotationFromStore,
    currentTask,
  } = useAnnotationStore();

  const [saving, setSaving] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(new Set());

  // Get classes for current task (sorted by order)
  const classes = project?.taskClasses?.[currentTask || ''] || project?.classes || {};
  const classEntries = Object.entries(classes).sort(
    (a, b) => ((a[1] as any).order || 0) - ((b[1] as any).order || 0)
  );

  // Get current classification annotations for this image
  const classificationAnnotations = annotations.filter(
    ann => ann.geometry.type === 'classification'
  );

  // Update selected classes when annotations change
  useEffect(() => {
    const selected = new Set<string>();
    classificationAnnotations.forEach(ann => {
      const classId = (ann as any).classId || (ann as any).class_id;
      if (classId) {
        selected.add(classId);
      }
    });
    setSelectedClasses(selected);
  }, [annotations]);

  // Handle class selection
  const handleClassSelect = useCallback(async (classId: string, className: string) => {
    if (!currentImage || !project || saving) return;

    setSaving(true);

    try {
      if (multiLabel) {
        // Multi-label mode: toggle the class
        const existingAnn = classificationAnnotations.find(
          ann => (ann as any).classId === classId || (ann as any).class_id === classId
        );

        if (existingAnn) {
          // Remove classification
          await deleteAnnotation(existingAnn.id);
          deleteAnnotationFromStore(existingAnn.id);
        } else {
          // Add classification
          const annotationData: AnnotationCreateRequest = {
            project_id: project.id,
            image_id: currentImage.id,
            annotation_type: 'classification',
            geometry: {
              type: 'classification',
            },
            class_id: classId,
            class_name: className,
          };

          const savedAnnotation = await createAnnotation(annotationData);

          addAnnotation({
            id: savedAnnotation.id.toString(),
            projectId: project.id,
            imageId: currentImage.id,
            annotationType: 'classification',
            classId: classId,
            className: className,
            geometry: {
              type: 'classification',
            },
            confidence: savedAnnotation.confidence,
            attributes: savedAnnotation.attributes,
            createdAt: savedAnnotation.created_at ? new Date(savedAnnotation.created_at) : undefined,
            updatedAt: savedAnnotation.updated_at ? new Date(savedAnnotation.updated_at) : undefined,
          });
        }
      } else {
        // Single-label mode: replace existing classification
        const existingAnn = classificationAnnotations[0];

        if (existingAnn) {
          // Check if same class - toggle off
          const existingClassId = (existingAnn as any).classId || (existingAnn as any).class_id;
          if (existingClassId === classId) {
            // Remove classification
            await deleteAnnotation(existingAnn.id);
            deleteAnnotationFromStore(existingAnn.id);
          } else {
            // Update to new class
            const updateData: AnnotationUpdateRequest = {
              class_id: classId,
              class_name: className,
            };

            await updateAnnotation(existingAnn.id, updateData);

            updateAnnotationInStore(existingAnn.id, {
              classId: classId,
              className: className,
            });
          }
        } else {
          // Create new classification
          const annotationData: AnnotationCreateRequest = {
            project_id: project.id,
            image_id: currentImage.id,
            annotation_type: 'classification',
            geometry: {
              type: 'classification',
            },
            class_id: classId,
            class_name: className,
          };

          const savedAnnotation = await createAnnotation(annotationData);

          addAnnotation({
            id: savedAnnotation.id.toString(),
            projectId: project.id,
            imageId: currentImage.id,
            annotationType: 'classification',
            classId: classId,
            className: className,
            geometry: {
              type: 'classification',
            },
            confidence: savedAnnotation.confidence,
            attributes: savedAnnotation.attributes,
            createdAt: savedAnnotation.created_at ? new Date(savedAnnotation.created_at) : undefined,
            updatedAt: savedAnnotation.updated_at ? new Date(savedAnnotation.updated_at) : undefined,
          });
        }
      }

      // Update image status
      useAnnotationStore.setState((state) => ({
        currentImage: state.currentImage?.id === currentImage.id
          ? {
              ...state.currentImage,
              is_confirmed: false,
              status: 'in-progress',
            }
          : state.currentImage,
        images: state.images.map(img =>
          img.id === currentImage.id
            ? {
                ...img,
                is_confirmed: false,
                status: 'in-progress',
              }
            : img
        )
      }));

    } catch (err) {
      console.error('Failed to save classification:', err);
    } finally {
      setSaving(false);
    }
  }, [currentImage, project, saving, multiLabel, classificationAnnotations, addAnnotation, updateAnnotationInStore, deleteAnnotationFromStore]);

  // Keyboard shortcuts (1-9 for quick selection)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Only handle if classification task is active
      if (currentTask !== 'classification') return;

      // Number keys 1-9 for quick class selection
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        const classIndex = num - 1;
        if (classIndex < classEntries.length) {
          e.preventDefault();
          const [classId, classInfo] = classEntries[classIndex];
          handleClassSelect(classId, classInfo.name);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTask, classEntries, handleClassSelect]);

  if (!project || currentTask !== 'classification') {
    return null;
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Classification
        </h3>
        {saving && (
          <svg className="animate-spin h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {multiLabel ? 'Select one or more classes' : 'Select one class'}
      </div>

      <div className="space-y-2">
        {classEntries.map(([classId, classInfo], index) => {
          const isSelected = selectedClasses.has(classId);
          const shortcut = index < 9 ? index + 1 : null;

          return (
            <button
              key={classId}
              onClick={() => handleClassSelect(classId, classInfo.name)}
              disabled={saving}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
                isSelected
                  ? 'bg-violet-100 dark:bg-violet-900/30 ring-2 ring-violet-500'
                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {/* Selection indicator */}
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isSelected
                    ? 'border-violet-500 bg-violet-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                )}
              </div>

              {/* Color indicator */}
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: classInfo.color }}
              />

              {/* Class name */}
              <span className={`flex-1 text-sm ${
                isSelected
                  ? 'font-medium text-violet-700 dark:text-violet-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {classInfo.name}
              </span>

              {/* Keyboard shortcut */}
              {shortcut && (
                <kbd className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                  {shortcut}
                </kbd>
              )}
            </button>
          );
        })}
      </div>

      {classEntries.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
          No classes defined for classification task
        </div>
      )}

      {/* Selected summary */}
      {selectedClasses.size > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Selected: {selectedClasses.size} {selectedClasses.size === 1 ? 'class' : 'classes'}
          </div>
          <div className="flex flex-wrap gap-1">
            {Array.from(selectedClasses).map(classId => {
              const classInfo = classes[classId];
              return (
                <span
                  key={classId}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs"
                  style={{
                    backgroundColor: `${classInfo?.color}20`,
                    color: classInfo?.color,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: classInfo?.color }}
                  />
                  {classInfo?.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
