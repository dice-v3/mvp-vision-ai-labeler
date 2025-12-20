/**
 * Text Label Store (Zustand) - Phase 19 VLM Text Labeling
 *
 * Manages text label state including:
 * - Text labels for current image
 * - Dialog state (open/close, selected annotation)
 * - CRUD operations via API
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  TextLabel,
  TextLabelCreate,
  TextLabelUpdate,
  getTextLabels,
  getTextLabelsForAnnotation,
  createTextLabel,
  updateTextLabel,
  deleteTextLabel,
} from '@/lib/api/text-labels';

// ============================================================================
// Types
// ============================================================================

export interface TextLabelState {
  // Data state
  textLabels: TextLabel[];
  loading: boolean;
  error: string | null;

  // Dialog state
  dialogOpen: boolean;
  selectedAnnotationId: number | null;
  selectedLabelId: number | null;  // For editing existing label

  // Actions - Data
  loadTextLabelsForImage: (projectId: string, imageId: string) => Promise<void>;
  loadTextLabelsForAnnotation: (annotationId: number) => Promise<void>;
  createLabel: (data: TextLabelCreate) => Promise<TextLabel | null>;
  updateLabel: (labelId: number, data: TextLabelUpdate) => Promise<TextLabel | null>;
  deleteLabel: (labelId: number) => Promise<boolean>;
  clearTextLabels: () => void;

  // Actions - Dialog
  openDialogForAnnotation: (annotationId: number) => void;
  openDialogForEdit: (labelId: number) => void;
  closeDialog: () => void;

  // Utility
  getTextLabelForAnnotation: (annotationId: number) => TextLabel | undefined;
  hasTextLabel: (annotationId: number) => boolean;
}

// ============================================================================
// Store
// ============================================================================

export const useTextLabelStore = create<TextLabelState>()(
  devtools(
    (set, get) => ({
      // Initial state
      textLabels: [],
      loading: false,
      error: null,
      dialogOpen: false,
      selectedAnnotationId: null,
      selectedLabelId: null,

      // Load all text labels for an image
      loadTextLabelsForImage: async (projectId: string, imageId: string) => {
        set({ loading: true, error: null });
        try {
          const response = await getTextLabels(projectId, { imageId });
          set({ textLabels: response.text_labels, loading: false });
        } catch (error: any) {
          console.error('[TextLabelStore] Failed to load text labels:', error);
          set({ error: error.message || 'Failed to load text labels', loading: false });
        }
      },

      // Load text labels for a specific annotation
      loadTextLabelsForAnnotation: async (annotationId: number) => {
        set({ loading: true, error: null });
        try {
          const response = await getTextLabelsForAnnotation(annotationId);
          // Merge with existing labels (update only for this annotation)
          const currentLabels = get().textLabels;
          const otherLabels = currentLabels.filter(label => label.annotation_id !== annotationId);
          set({ textLabels: [...otherLabels, ...response.text_labels], loading: false });
        } catch (error: any) {
          console.error('[TextLabelStore] Failed to load annotation labels:', error);
          set({ error: error.message || 'Failed to load annotation labels', loading: false });
        }
      },

      // Create a new text label
      createLabel: async (data: TextLabelCreate) => {
        set({ loading: true, error: null });
        try {
          const newLabel = await createTextLabel(data);
          set((state) => ({
            textLabels: [...state.textLabels, newLabel],
            loading: false,
          }));
          return newLabel;
        } catch (error: any) {
          console.error('[TextLabelStore] Failed to create text label:', error);
          set({ error: error.message || 'Failed to create text label', loading: false });
          return null;
        }
      },

      // Update an existing text label
      updateLabel: async (labelId: number, data: TextLabelUpdate) => {
        set({ loading: true, error: null });
        try {
          const updatedLabel = await updateTextLabel(labelId, data);
          set((state) => ({
            textLabels: state.textLabels.map(label =>
              label.id === labelId ? updatedLabel : label
            ),
            loading: false,
          }));
          return updatedLabel;
        } catch (error: any) {
          console.error('[TextLabelStore] Failed to update text label:', error);
          set({ error: error.message || 'Failed to update text label', loading: false });
          return null;
        }
      },

      // Delete a text label
      deleteLabel: async (labelId: number) => {
        set({ loading: true, error: null });
        try {
          await deleteTextLabel(labelId);
          set((state) => ({
            textLabels: state.textLabels.filter(label => label.id !== labelId),
            loading: false,
          }));
          return true;
        } catch (error: any) {
          console.error('[TextLabelStore] Failed to delete text label:', error);
          set({ error: error.message || 'Failed to delete text label', loading: false });
          return false;
        }
      },

      // Clear all text labels (when changing image)
      clearTextLabels: () => {
        set({ textLabels: [], error: null });
      },

      // Open dialog for creating label on annotation
      openDialogForAnnotation: (annotationId: number) => {
        set({
          dialogOpen: true,
          selectedAnnotationId: annotationId,
          selectedLabelId: null,
        });
      },

      // Open dialog for editing existing label
      openDialogForEdit: (labelId: number) => {
        const label = get().textLabels.find(l => l.id === labelId);
        set({
          dialogOpen: true,
          selectedAnnotationId: label?.annotation_id || null,
          selectedLabelId: labelId,
        });
      },

      // Close dialog
      closeDialog: () => {
        set({
          dialogOpen: false,
          selectedAnnotationId: null,
          selectedLabelId: null,
        });
      },

      // Get text label for a specific annotation
      getTextLabelForAnnotation: (annotationId: number) => {
        return get().textLabels.find(label => label.annotation_id === annotationId);
      },

      // Check if annotation has text label
      hasTextLabel: (annotationId: number) => {
        return get().textLabels.some(label => label.annotation_id === annotationId);
      },
    }),
    { name: 'TextLabelStore' }
  )
);
