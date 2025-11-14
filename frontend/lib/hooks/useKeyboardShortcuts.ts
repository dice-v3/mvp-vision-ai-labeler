/**
 * Keyboard Shortcuts Hook
 *
 * Handles global keyboard shortcuts for annotation interface
 */

import { useEffect } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { deleteAnnotation as deleteAnnotationAPI } from '@/lib/api/annotations';

export function useKeyboardShortcuts() {
  const {
    tool,
    setTool,
    goToNextImage,
    goToPrevImage,
    selectedAnnotationId,
    deleteAnnotation,
    selectAnnotation,
    zoomIn,
    zoomOut,
    fitToScreen,
    undo,
    redo,
    history,
    canvas,
    setPan,
    toggleLeftPanel,
    toggleRightPanel,
  } = useAnnotationStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ctrl/Cmd modifier shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              // Redo
              if (history.future.length > 0) {
                redo();
              }
            } else {
              // Undo
              if (history.past.length > 0) {
                undo();
              }
            }
            break;
          case 'y':
            // Redo (alternative to Ctrl+Shift+Z)
            e.preventDefault();
            if (history.future.length > 0) {
              redo();
            }
            break;
          case '=':
          case '+':
            // Zoom in
            e.preventDefault();
            zoomIn();
            break;
          case '-':
            // Zoom out
            e.preventDefault();
            zoomOut();
            break;
          case '0':
            // Fit to screen
            e.preventDefault();
            fitToScreen();
            break;
        }
        return;
      }

      // Regular shortcuts (no modifiers)
      switch (e.key.toLowerCase()) {
        case 'arrowup':
          // Pan up (only if no annotation selected)
          if (!selectedAnnotationId) {
            e.preventDefault();
            setPan({ x: canvas.pan.x, y: canvas.pan.y + 50 });
          }
          break;
        case 'arrowdown':
          // Pan down (only if no annotation selected)
          if (!selectedAnnotationId) {
            e.preventDefault();
            setPan({ x: canvas.pan.x, y: canvas.pan.y - 50 });
          }
          break;
        case 'arrowleft':
          // Pan left (only if no annotation selected)
          if (!selectedAnnotationId) {
            e.preventDefault();
            setPan({ x: canvas.pan.x + 50, y: canvas.pan.y });
          }
          break;
        case 'arrowright':
          // Pan right (only if no annotation selected)
          if (!selectedAnnotationId) {
            e.preventDefault();
            setPan({ x: canvas.pan.x - 50, y: canvas.pan.y });
          }
          break;
        case 'a':
          // Previous image
          e.preventDefault();
          goToPrevImage();
          break;
        case 'd':
          // Next image
          e.preventDefault();
          goToNextImage();
          break;
        case 'r':
          // Select tool
          e.preventDefault();
          setTool('select');
          break;
        case 'v':
          // Bbox tool
          e.preventDefault();
          setTool('bbox');
          break;
        case 'delete':
        case 'backspace':
          // Delete selected annotation
          if (selectedAnnotationId) {
            e.preventDefault();
            if (confirm('Delete selected annotation?')) {
              // Delete from backend first, then from store
              deleteAnnotationAPI(selectedAnnotationId)
                .then(() => {
                  deleteAnnotation(selectedAnnotationId);
                })
                .catch((err) => {
                  console.error('Failed to delete annotation:', err);
                  // TODO: Show error toast
                });
            }
          }
          break;
        case 'escape':
          // Deselect annotation
          e.preventDefault();
          selectAnnotation(null);
          break;
        case '[':
          // Toggle left panel
          e.preventDefault();
          toggleLeftPanel();
          break;
        case ']':
          // Toggle right panel
          e.preventDefault();
          toggleRightPanel();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    tool,
    setTool,
    goToNextImage,
    goToPrevImage,
    selectedAnnotationId,
    deleteAnnotation,
    selectAnnotation,
    zoomIn,
    zoomOut,
    fitToScreen,
    undo,
    redo,
    history,
    canvas,
    setPan,
    toggleLeftPanel,
    toggleRightPanel,
  ]);
}
