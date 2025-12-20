'use client';

import { useEffect, useState } from 'react';
import { useTextLabelStore } from '@/lib/stores/textLabelStore';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { X } from 'lucide-react';

/**
 * ImageLevelTextLabelDialog Component
 *
 * Modal dialog for adding/editing image-level text labels (Phase 19)
 *
 * Features:
 * - Three label types: Caption, Description, VQA
 * - Type selection with tabs
 * - Character limit and counter
 * - Language selection
 * - Keyboard shortcuts (Esc, Ctrl+Enter)
 */

type LabelType = 'caption' | 'description' | 'qa';

export function ImageLevelTextLabelDialog() {
  const {
    imageLevelDialogOpen,
    selectedImageLabelType,
    imageLevelLabels,
    createImageLabel,
    updateImageLabel,
    deleteImageLabel,
    closeImageLevelDialog,
  } = useTextLabelStore();

  const { currentImage, projectId } = useAnnotationStore();

  // Form state
  const [labelType, setLabelType] = useState<LabelType>('caption');
  const [textContent, setTextContent] = useState('');
  const [question, setQuestion] = useState('');
  const [language, setLanguage] = useState('en');
  const [saving, setSaving] = useState(false);

  const MAX_CHARS = 500;
  const MAX_QUESTION_CHARS = 200;

  // Initialize label type from store
  useEffect(() => {
    if (selectedImageLabelType) {
      setLabelType(selectedImageLabelType);
    }
  }, [selectedImageLabelType]);

  // Find existing label of current type for current image
  const existingLabel = imageLevelLabels.find(
    (label) => label.label_type === labelType && label.image_id === currentImage?.id
  );

  // Load existing label data when dialog opens or type changes
  useEffect(() => {
    if (imageLevelDialogOpen && existingLabel) {
      setTextContent(existingLabel.text_content);
      setQuestion(existingLabel.question || '');
      setLanguage(existingLabel.language || 'en');
    } else if (imageLevelDialogOpen && !existingLabel) {
      // Reset form for new label
      setTextContent('');
      setQuestion('');
      setLanguage('en');
    }
  }, [imageLevelDialogOpen, existingLabel, labelType]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!imageLevelDialogOpen) return;

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
  }, [imageLevelDialogOpen, textContent, question, language, labelType]);

  const handleSave = async () => {
    if (!textContent.trim() || !projectId || !currentImage) {
      return;
    }

    // VQA requires question
    if (labelType === 'qa' && !question.trim()) {
      return;
    }

    setSaving(true);

    try {
      if (existingLabel) {
        // Update existing label
        await updateImageLabel(existingLabel.id, {
          text_content: textContent.trim(),
          question: labelType === 'qa' ? question.trim() : undefined,
          language,
          version: existingLabel.version,
        });
      } else {
        // Create new label
        await createImageLabel({
          project_id: projectId,
          image_id: currentImage.id,
          annotation_id: null,
          label_type: labelType,
          text_content: textContent.trim(),
          question: labelType === 'qa' ? question.trim() : undefined,
          language,
        });
      }

      closeImageLevelDialog();
    } catch (error) {
      console.error('[ImageLevelTextLabelDialog] Failed to save:', error);
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
      await deleteImageLabel(existingLabel.id);
      closeImageLevelDialog();
    } catch (error) {
      console.error('[ImageLevelTextLabelDialog] Failed to delete:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    closeImageLevelDialog();
  };

  if (!imageLevelDialogOpen || !currentImage) return null;

  const charCount = textContent.length;
  const questionCharCount = question.length;
  const isValid =
    charCount > 0 &&
    charCount <= MAX_CHARS &&
    (labelType !== 'qa' || (questionCharCount > 0 && questionCharCount <= MAX_QUESTION_CHARS));

  const getLabelTypeTitle = () => {
    switch (labelType) {
      case 'caption': return 'Caption';
      case 'description': return 'Description';
      case 'qa': return 'Visual Q&A';
      default: return 'Text Label';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleCancel} />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Image {getLabelTypeTitle()}
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
          {/* Type Selection Tabs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Label Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setLabelType('caption')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  labelType === 'caption'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Caption
              </button>
              <button
                onClick={() => setLabelType('description')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  labelType === 'description'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Description
              </button>
              <button
                onClick={() => setLabelType('qa')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  labelType === 'qa'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                VQA
              </button>
            </div>
          </div>

          {/* Question field (VQA only) */}
          {labelType === 'qa' && (
            <div>
              <label
                htmlFor="question"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Question
              </label>
              <input
                id="question"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_CHARS))}
                placeholder="What is in this image?"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                         focus:ring-2 focus:ring-violet-500 focus:border-transparent
                         placeholder-gray-400 dark:placeholder-gray-500
                         transition-colors"
              />
              <div className="flex justify-between items-center mt-1">
                <span
                  className={`text-xs ${
                    questionCharCount > MAX_QUESTION_CHARS
                      ? 'text-red-500'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {questionCharCount} / {MAX_QUESTION_CHARS} characters
                </span>
              </div>
            </div>
          )}

          {/* Text Content */}
          <div>
            <label
              htmlFor="text-content"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {labelType === 'qa' ? 'Answer' : 'Text'}
            </label>
            <textarea
              id="text-content"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value.slice(0, MAX_CHARS))}
              placeholder={
                labelType === 'caption'
                  ? 'A brief description of this image...'
                  : labelType === 'description'
                  ? 'A detailed description of this image...'
                  : 'The answer to the question...'
              }
              rows={labelType === 'qa' ? 3 : 4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-violet-500 focus:border-transparent
                       placeholder-gray-400 dark:placeholder-gray-500
                       resize-none transition-colors"
              autoFocus={labelType !== 'qa'}
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

          {/* Language Selection */}
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
