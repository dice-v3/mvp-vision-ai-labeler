'use client';

import { useEffect, useState, useRef } from 'react';
import { useTextLabelStore } from '@/lib/stores/textLabelStore';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { X } from 'lucide-react';

/**
 * TextLabelDialog Component
 *
 * Modal dialog for adding/editing text labels on annotations (Phase 19)
 *
 * Features:
 * - Create/edit text labels for region-level annotations
 * - Character limit and counter
 * - Language selection (optional)
 * - Keyboard shortcuts (Esc, Ctrl+Enter)
 * - Delete existing labels
 */
export function TextLabelDialog() {
  const {
    dialogOpen,
    selectedAnnotationId,
    selectedLabelId,
    textLabels,
    createLabel,
    updateLabel,
    deleteLabel,
    closeDialog,
    getTextLabelForAnnotation,
  } = useTextLabelStore();

  const { annotations, currentImage, project } = useAnnotationStore();
  const projectId = project?.id;

  // Form state
  const [textContent, setTextContent] = useState('');
  const [language, setLanguage] = useState('en');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const MAX_CHARS = 500;

  // Find the selected annotation (comparing as numbers)
  const selectedAnnotation = annotations.find(
    (ann) => ann.id === selectedAnnotationId
  );

  // Get existing label if editing
  const existingLabel = selectedLabelId
    ? textLabels.find((label) => label.id === selectedLabelId)
    : selectedAnnotationId
    ? getTextLabelForAnnotation(selectedAnnotationId)
    : undefined;

  // Load existing label data when dialog opens
  useEffect(() => {
    if (dialogOpen && existingLabel) {
      setTextContent(existingLabel.text_content);
      setLanguage(existingLabel.language || 'en');
    } else if (dialogOpen && !existingLabel) {
      // Reset form for new label
      setTextContent('');
      setLanguage('en');
    }

    // Auto-focus on text input when dialog opens
    if (dialogOpen) {
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [dialogOpen, existingLabel]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!dialogOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc: Close dialog
      if (e.key === 'Escape') {
        handleCancel();
      }

      // Ctrl+Enter: Save and close
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogOpen, textContent, language]);

  const handleSave = async () => {
    if (!textContent.trim() || !projectId || !currentImage || !selectedAnnotationId) {
      return;
    }

    setSaving(true);

    try {
      if (existingLabel) {
        // Update existing label
        await updateLabel(existingLabel.id, {
          text_content: textContent.trim(),
          language,
          version: existingLabel.version,
        });
      } else {
        // Create new label
        await createLabel({
          project_id: projectId,
          image_id: currentImage.id,
          annotation_id: selectedAnnotationId,
          label_type: 'region',
          text_content: textContent.trim(),
          language,
        });
      }

      closeDialog();
    } catch (error) {
      console.error('[TextLabelDialog] Failed to save:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingLabel) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this text label?'
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      await deleteLabel(existingLabel.id);
      closeDialog();
    } catch (error) {
      console.error('[TextLabelDialog] Failed to delete:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    closeDialog();
  };

  if (!dialogOpen || !selectedAnnotation) return null;

  const charCount = textContent.length;
  const isValid = charCount > 0 && charCount <= MAX_CHARS;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleCancel} />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Text Label for "{selectedAnnotation.className || 'Unknown'}"
          </h3>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Text Content */}
          <div>
            <label
              htmlFor="text-content"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Text Description
            </label>
            <textarea
              ref={textareaRef}
              id="text-content"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value.slice(0, MAX_CHARS))}
              placeholder="Describe this region..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-violet-500 focus:border-transparent
                       placeholder-gray-400 dark:placeholder-gray-500
                       resize-none transition-colors"
            />
            <div className="flex justify-between items-center mt-1">
              <span
                className={`text-xs ${
                  charCount > MAX_CHARS
                    ? 'text-red-500'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {charCount} / {MAX_CHARS} characters
              </span>
              {charCount > MAX_CHARS && (
                <span className="text-xs text-red-500">
                  Exceeds maximum length
                </span>
              )}
            </div>
          </div>

          {/* Language Selection (Optional) */}
          <div>
            <label
              htmlFor="language"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Language <span className="text-gray-400">(optional)</span>
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-violet-500 focus:border-transparent
                       transition-colors"
            >
              <option value="en">English</option>
              <option value="ko">한국어 (Korean)</option>
              <option value="ja">日本語 (Japanese)</option>
              <option value="zh">中文 (Chinese)</option>
              <option value="es">Español (Spanish)</option>
              <option value="fr">Français (French)</option>
              <option value="de">Deutsch (German)</option>
            </select>
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="font-medium">Shortcuts:</span> Esc to cancel, Ctrl+Enter to save
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-gray-200 dark:border-gray-700">
          {/* Delete button (only show if editing existing label) */}
          <div>
            {existingLabel && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 text-sm text-red-600 dark:text-red-400
                         hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
              >
                Delete
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300
                       bg-gray-100 dark:bg-gray-700
                       hover:bg-gray-200 dark:hover:bg-gray-600
                       rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isValid || saving}
              className="px-4 py-2 text-sm text-white
                       bg-violet-600 hover:bg-violet-700
                       disabled:bg-gray-400 disabled:cursor-not-allowed
                       rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : existingLabel ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
