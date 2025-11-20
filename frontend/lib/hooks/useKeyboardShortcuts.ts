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
    selectedVertexIndex,
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
    currentTask,
    annotations,
    copyAnnotation,
    pasteAnnotation,
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
          case 'c':
            // Copy selected annotation
            if (selectedAnnotationId) {
              e.preventDefault();
              const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
              if (selectedAnn) {
                copyAnnotation(selectedAnn);
              }
            }
            break;
          case 'v':
            // Paste annotation
            e.preventDefault();
            pasteAnnotation();
            break;
        }
        return;
      }

      // Regular shortcuts (no modifiers)
      switch (e.key.toLowerCase()) {
        case 'arrowup':
          // Previous image (skip if annotation/vertex is selected - handled by Canvas)
          if (selectedVertexIndex !== null || selectedAnnotationId !== null) return;
          e.preventDefault();
          goToPrevImage();
          break;
        case 'arrowdown':
          // Next image (skip if annotation/vertex is selected - handled by Canvas)
          if (selectedVertexIndex !== null || selectedAnnotationId !== null) return;
          e.preventDefault();
          goToNextImage();
          break;
        case 'arrowleft':
          // Previous image (skip if annotation/vertex is selected - handled by Canvas)
          if (selectedVertexIndex !== null || selectedAnnotationId !== null) return;
          e.preventDefault();
          goToPrevImage();
          break;
        case 'arrowright':
          // Next image (skip if annotation/vertex is selected - handled by Canvas)
          if (selectedVertexIndex !== null || selectedAnnotationId !== null) return;
          e.preventDefault();
          goToNextImage();
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
        case 'q':
          // Tool slot 1: Select tool
          e.preventDefault();
          setTool('select');
          break;
        case 'w':
          // Tool slot 2: Task-specific tool
          e.preventDefault();
          if (currentTask === 'classification') {
            setTool('classification');
          } else if (currentTask === 'segmentation') {
            setTool('polygon');
          } else {
            setTool('bbox');
          }
          break;
        case 'b':
          // BBox tool (detection shortcut)
          e.preventDefault();
          setTool('bbox');
          break;
        case 'p':
          // Polygon tool (segmentation shortcut)
          e.preventDefault();
          setTool('polygon');
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
    selectedVertexIndex,
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
    currentTask,
    annotations,
    copyAnnotation,
    pasteAnnotation,
  ]);
}
