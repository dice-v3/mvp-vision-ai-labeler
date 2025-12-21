/**
 * useCanvasKeyboardShortcuts Hook
 *
 * Manages all keyboard shortcuts for the Canvas component
 * Phase 18.8.1: Extracted from Canvas.tsx (568 lines)
 *
 * Keyboard shortcuts handled:
 * - Escape: Exit diff mode / Cancel drawing operations
 * - Z: Toggle magnifier
 * - M: Toggle minimap
 * - Ctrl/Cmd+Z: Undo
 * - Ctrl/Cmd+Y / Ctrl/Cmd+Shift+Z: Redo
 * - Enter: Complete polygon/polyline drawing
 * - Arrow Keys: Move selected bbox/circle/vertex or navigate images
 * - Delete/Backspace: Delete selected vertex or all annotations
 * - Space: Confirm image
 * - 0: Mark image as "No Object"
 *
 * @module lib/annotation/hooks/useCanvasKeyboardShortcuts
 */

import { useEffect } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import { toast } from '@/lib/stores/toastStore';
import { updateAnnotation } from '@/lib/api/annotations';
import type { AnnotationUpdateRequest } from '@/lib/api/annotations';
import type { Annotation, CanvasState, DiffModeState, PreferencesState } from '@/lib/stores/annotationStore';

/**
 * Helper: Check if a tool is a drawing tool
 */
function isDrawingToolFn(toolName: string | null): boolean {
  if (!toolName) return false;
  return ['detection', 'bbox', 'polygon', 'polyline', 'circle', 'circle3p'].includes(toolName);
}

/**
 * Parameters for keyboard shortcuts hook
 */
export interface UseCanvasKeyboardShortcutsParams {
  // Canvas ref
  canvasRef: React.RefObject<HTMLCanvasElement>;

  // Image data
  image: HTMLImageElement | null;
  currentImage: any;

  // Canvas state
  canvasState: CanvasState;
  tool: string;

  // Annotations
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  selectedVertexIndex: number | null;
  selectedBboxHandle: string | null;
  selectedCircleHandle: string | null;
  updateAnnotationStore: (id: string, updates: Partial<Annotation>) => void;

  // Tool state
  polygonVertices: [number, number][];
  setPolygonVertices: (vertices: [number, number][]) => void;
  polylineVertices: [number, number][];
  setPolylineVertices: (vertices: [number, number][]) => void;
  circleCenter: [number, number] | null;
  setCircleCenter: (center: [number, number] | null) => void;
  circle3pPoints: [number, number][];
  setCircle3pPoints: (points: [number, number][]) => void;

  // Pending annotation state
  pendingBbox: [number, number, number, number] | null;
  setPendingBbox: (bbox: [number, number, number, number] | null) => void;
  showClassSelector: boolean;
  setShowClassSelector: (show: boolean) => void;
  setSelectedVertexIndex: (index: number | null) => void;

  // Magnifier state
  manualMagnifierActive: boolean;
  setManualMagnifierActive: (active: boolean) => void;
  magnifierForceOff: boolean;
  setMagnifierForceOff: (forceOff: boolean) => void;

  // Preferences
  preferences: PreferencesState;

  // Diff mode
  diffMode: DiffModeState;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Batch operations
  selectedImageIds: string[];

  // Handlers from parent component
  handleConfirmImage: () => void;
  handleNoObject: () => void;
  handleDeleteAllAnnotations: () => void;

  // Image confirmation state
  isImageConfirmed: boolean;
}

/**
 * Custom hook for Canvas keyboard shortcuts
 *
 * Handles all keyboard events for canvas interactions including:
 * - Drawing tool shortcuts (Enter/Escape for polygon/polyline/circle)
 * - Magnifier and minimap toggles (Z, M)
 * - Undo/Redo (Ctrl+Z, Ctrl+Y)
 * - Arrow key navigation for selected annotations
 * - Vertex deletion (Delete/Backspace)
 * - Image confirmation and "No Object" marking (Space, 0)
 * - Diff mode exit (Escape)
 */
export function useCanvasKeyboardShortcuts(params: UseCanvasKeyboardShortcutsParams): void {
  const {
    canvasRef,
    image,
    currentImage,
    canvasState,
    tool,
    annotations,
    selectedAnnotationId,
    selectedVertexIndex,
    selectedBboxHandle,
    selectedCircleHandle,
    updateAnnotationStore,
    polygonVertices,
    setPolygonVertices,
    polylineVertices,
    setPolylineVertices,
    circleCenter,
    setCircleCenter,
    circle3pPoints,
    setCircle3pPoints,
    pendingBbox,
    setPendingBbox,
    showClassSelector,
    setShowClassSelector,
    setSelectedVertexIndex,
    manualMagnifierActive,
    setManualMagnifierActive,
    magnifierForceOff,
    setMagnifierForceOff,
    isDrawingTool,
    preferences,
    diffMode,
    undo,
    redo,
    canUndo,
    canRedo,
    selectedImageIds,
    handleConfirmImage,
    handleNoObject,
    handleDeleteAllAnnotations,
    isImageConfirmed,
  } = params;

  // Phase 2.7: Keyboard shortcuts for Canvas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields or when modals are open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        showClassSelector // Don't interfere with ClassSelectorModal keyboard events
      ) {
        return;
      }

      // Phase 11: Escape key to exit diff mode (without confirmation)
      if (e.key === 'Escape' && diffMode.enabled) {
        e.preventDefault();
        console.log('[Canvas] Escape pressed in diff mode, exiting...');
        const { exitDiffMode } = useAnnotationStore.getState();
        exitDiffMode().then(() => {
          console.log('[Canvas] Successfully exited diff mode');
          toast.success('Exited diff mode');
        }).catch((error) => {
          console.error('[Canvas] Failed to exit diff mode:', error);
          toast.error('Failed to exit diff mode');
        });
        return;
      }

      // Phase 2.10.2: Magnifier manual activation (Z key without Ctrl/Cmd) - Toggle mode
      if (e.key === 'z' && !e.ctrlKey && !e.metaKey) {
        // Calculate current magnifier state
        const currentlyShown = !magnifierForceOff && (
          manualMagnifierActive ||
          (isDrawingToolFn(tool) && preferences.autoMagnifier)
        );

        if (currentlyShown) {
          // Magnifier is currently shown, force it off
          setMagnifierForceOff(true);
          setManualMagnifierActive(false);
        } else {
          // Magnifier is hidden, turn on manual magnifier
          setMagnifierForceOff(false);
          setManualMagnifierActive(true);
        }
        return;
      }

      // Phase 2.10.3: Minimap toggle (M key)
      if (e.key === 'm' && !e.ctrlKey && !e.metaKey) {
        const currentShowMinimap = useAnnotationStore.getState().showMinimap;
        const newShowMinimap = !currentShowMinimap;
        useAnnotationStore.setState({ showMinimap: newShowMinimap });
        toast.success(`Minimap ${newShowMinimap ? 'shown' : 'hidden'}`);
        return;
      }

      // Phase 2.10: Undo/Redo shortcuts
      // Ctrl+Z / Cmd+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
          toast.success('Undone');
        }
        return;
      }

      // Ctrl+Y / Cmd+Y or Ctrl+Shift+Z / Cmd+Shift+Z: Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo()) {
          redo();
          toast.success('Redone');
        }
        return;
      }

      // Enter: Close polygon (if drawing)
      if (e.key === 'Enter' && tool === 'polygon' && polygonVertices.length >= 3 && image) {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const { zoom, pan } = canvasState;
        const scaledWidth = image.width * zoom;
        const scaledHeight = image.height * zoom;
        const imgX = (rect.width - scaledWidth) / 2 + pan.x;
        const imgY = (rect.height - scaledHeight) / 2 + pan.y;

        // Convert canvas coords to image coords
        const imagePoints = polygonVertices.map(([vx, vy]): [number, number] => [
          (vx - imgX) / zoom,
          (vy - imgY) / zoom,
        ]);

        // Store pending polygon and show class selector
        setPendingBbox(null);
        (window as any).__pendingPolygon = imagePoints;
        setShowClassSelector(true);
        setPolygonVertices([]);
        return;
      }

      // Escape: Cancel polygon drawing
      if (e.key === 'Escape' && tool === 'polygon' && polygonVertices.length > 0) {
        e.preventDefault();
        setPolygonVertices([]);
        return;
      }

      // Enter: Complete polyline (if drawing)
      if (e.key === 'Enter' && tool === 'polyline' && polylineVertices.length >= 2 && image) {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const { zoom, pan } = canvasState;
        const scaledWidth = image.width * zoom;
        const scaledHeight = image.height * zoom;
        const imgX = (rect.width - scaledWidth) / 2 + pan.x;
        const imgY = (rect.height - scaledHeight) / 2 + pan.y;

        // Convert canvas coords to image coords
        const imagePoints = polylineVertices.map(([vx, vy]): [number, number] => [
          Math.round(((vx - imgX) / zoom) * 100) / 100,
          Math.round(((vy - imgY) / zoom) * 100) / 100,
        ]);

        // Store pending polyline and show class selector
        (window as any).__pendingPolyline = imagePoints;
        console.log('[Polyline] Set pending polyline:', imagePoints);
        setShowClassSelector(true);
        setPolylineVertices([]);
        return;
      }

      // Escape: Cancel polyline drawing
      if (e.key === 'Escape' && tool === 'polyline' && polylineVertices.length > 0) {
        e.preventDefault();
        setPolylineVertices([]);
        return;
      }

      // Escape: Cancel circle drawing
      if (e.key === 'Escape' && tool === 'circle' && circleCenter) {
        e.preventDefault();
        setCircleCenter(null);
        return;
      }

      // Escape: Cancel circle3p drawing
      if (e.key === 'Escape' && tool === 'circle3p' && circle3pPoints.length > 0) {
        e.preventDefault();
        setCircle3pPoints([]);
        return;
      }

      // Arrow keys: Move selected bbox handle or entire bbox
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedVertexIndex === null && selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
        if (selectedAnn && selectedAnn.geometry.type === 'bbox' && image) {
          e.preventDefault();
          e.stopPropagation();

          let [newX, newY, newW, newH] = selectedAnn.geometry.bbox;

          // Move amount (hold Shift for larger steps)
          const step = e.shiftKey ? 10 : 1;

          if (selectedBboxHandle) {
            // Move only the selected handle
            const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
            const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;

            switch (selectedBboxHandle) {
              case 'nw': // Top-left corner
                newX += dx;
                newY += dy;
                newW -= dx;
                newH -= dy;
                break;
              case 'ne': // Top-right corner
                newY += dy;
                newW += dx;
                newH -= dy;
                break;
              case 'sw': // Bottom-left corner
                newX += dx;
                newW -= dx;
                newH += dy;
                break;
              case 'se': // Bottom-right corner
                newW += dx;
                newH += dy;
                break;
              case 'n': // Top edge
                newY += dy;
                newH -= dy;
                break;
              case 's': // Bottom edge
                newH += dy;
                break;
              case 'w': // Left edge
                newX += dx;
                newW -= dx;
                break;
              case 'e': // Right edge
                newW += dx;
                break;
            }

            // Ensure minimum size
            if (newW < 10) newW = 10;
            if (newH < 10) newH = 10;
          } else {
            // Move entire bbox
            switch (e.key) {
              case 'ArrowUp':
                newY = Math.max(0, newY - step);
                break;
              case 'ArrowDown':
                newY = Math.min(image.height - newH, newY + step);
                break;
              case 'ArrowLeft':
                newX = Math.max(0, newX - step);
                break;
              case 'ArrowRight':
                newX = Math.min(image.width - newW, newX + step);
                break;
            }
          }

          // Clip to image bounds and round to 2 decimal places
          newX = Math.round(Math.max(0, Math.min(image.width - newW, newX)) * 100) / 100;
          newY = Math.round(Math.max(0, Math.min(image.height - newH, newY)) * 100) / 100;
          newW = Math.round(newW * 100) / 100;
          newH = Math.round(newH * 100) / 100;

          // Update annotation in store (with history recording)
          const updatedGeometry = {
            type: 'bbox' as const,
            bbox: [newX, newY, newW, newH] as [number, number, number, number],
          };
          updateAnnotationStore(selectedAnnotationId, {
            geometry: updatedGeometry,
          });

          // Save to backend
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              type: 'bbox',
              bbox: [newX, newY, newW, newH],
              image_width: image.width,
              image_height: image.height,
            },
          };
          updateAnnotation(selectedAnnotationId, updateData)
            .then(() => {
              // Update image status to in-progress
              if (currentImage) {
                const updatedCurrentImage = {
                  ...currentImage,
                  is_confirmed: false,
                  status: 'in-progress',
                };

                useAnnotationStore.setState((state) => ({
                  currentImage: state.currentImage?.id === currentImage.id
                    ? updatedCurrentImage
                    : state.currentImage,
                  images: state.images.map(img =>
                    img.id === currentImage.id
                      ? updatedCurrentImage
                      : img
                  ),
                }));
              }
            })
            .catch((error) => {
              console.error('Failed to move bbox:', error);
            });

          return;
        }
      }

      // Arrow keys: Resize selected circle handle or move entire circle
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedVertexIndex === null && selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
        if (selectedAnn && selectedAnn.geometry.type === 'circle' && image) {
          e.preventDefault();
          e.stopPropagation();

          let center = [...selectedAnn.geometry.center] as [number, number];
          let radius = selectedAnn.geometry.radius;

          // Move amount (hold Shift for larger steps)
          const step = e.shiftKey ? 10 : 1;

          if (selectedCircleHandle) {
            // Resize radius based on handle direction
            let radiusDelta = 0;

            switch (selectedCircleHandle) {
              case 'n': // Top handle
                radiusDelta = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
                break;
              case 's': // Bottom handle
                radiusDelta = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
                break;
              case 'e': // Right handle
                radiusDelta = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
                break;
              case 'w': // Left handle
                radiusDelta = e.key === 'ArrowLeft' ? step : e.key === 'ArrowRight' ? -step : 0;
                break;
            }

            radius = Math.max(5, radius + radiusDelta);
          } else {
            // Move entire circle
            switch (e.key) {
              case 'ArrowUp':
                center[1] = Math.max(radius, center[1] - step);
                break;
              case 'ArrowDown':
                center[1] = Math.min(image.height - radius, center[1] + step);
                break;
              case 'ArrowLeft':
                center[0] = Math.max(radius, center[0] - step);
                break;
              case 'ArrowRight':
                center[0] = Math.min(image.width - radius, center[0] + step);
                break;
            }
          }

          // Round to 2 decimal places
          center[0] = Math.round(center[0] * 100) / 100;
          center[1] = Math.round(center[1] * 100) / 100;
          radius = Math.round(radius * 100) / 100;

          // Update annotation in store (with history recording)
          const updatedCircleGeometry = {
            type: 'circle' as const,
            center: center as [number, number],
            radius,
          };
          updateAnnotationStore(selectedAnnotationId, {
            geometry: updatedCircleGeometry,
          });

          // Save to backend
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              type: 'circle',
              center,
              radius,
              image_width: image.width,
              image_height: image.height,
            },
          };
          updateAnnotation(selectedAnnotationId, updateData)
            .then(() => {
              // Update image status to in-progress
              if (currentImage) {
                const updatedCurrentImage = {
                  ...currentImage,
                  is_confirmed: false,
                  status: 'in-progress',
                };

                useAnnotationStore.setState((state) => ({
                  currentImage: state.currentImage?.id === currentImage.id
                    ? updatedCurrentImage
                    : state.currentImage,
                  images: state.images.map(img =>
                    img.id === currentImage.id
                      ? updatedCurrentImage
                      : img
                  ),
                }));
              }
            })
            .catch((error) => {
              console.error('Failed to move/resize circle:', error);
            });

          return;
        }
      }

      // Arrow keys: Move selected vertex (polygon or polyline - override image navigation)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedVertexIndex !== null && selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
        if (selectedAnn && (selectedAnn.geometry.type === 'polygon' || selectedAnn.geometry.type === 'polyline') && image) {
          e.preventDefault();
          e.stopPropagation();

          const points = selectedAnn.geometry.points;
          const [px, py] = points[selectedVertexIndex];

          // Move amount (hold Shift for larger steps)
          const step = e.shiftKey ? 10 : 1;

          let newX = px;
          let newY = py;

          switch (e.key) {
            case 'ArrowUp':
              newY = Math.round(Math.max(0, py - step) * 100) / 100;
              break;
            case 'ArrowDown':
              newY = Math.round(Math.min(image.height, py + step) * 100) / 100;
              break;
            case 'ArrowLeft':
              newX = Math.round(Math.max(0, px - step) * 100) / 100;
              break;
            case 'ArrowRight':
              newX = Math.round(Math.min(image.width, px + step) * 100) / 100;
              break;
          }

          // Update annotation in store (with history recording)
          const newPoints = [...points];
          newPoints[selectedVertexIndex] = [newX, newY];

          const updatedPolygonGeometry = {
            type: 'polygon' as const,
            points: newPoints,
          };
          updateAnnotationStore(selectedAnnotationId, {
            geometry: updatedPolygonGeometry,
          });

          // Save to backend (debounced would be better, but for now immediate)
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              type: 'polygon',
              points: newPoints,
              image_width: image.width,
              image_height: image.height,
            },
          };
          updateAnnotation(selectedAnnotationId, updateData)
            .then(() => {
              // Update image status to in-progress
              if (currentImage) {
                const updatedCurrentImage = {
                  ...currentImage,
                  is_confirmed: false,
                  status: 'in-progress',
                };

                useAnnotationStore.setState((state) => ({
                  currentImage: state.currentImage?.id === currentImage.id
                    ? updatedCurrentImage
                    : state.currentImage,
                  images: state.images.map(img =>
                    img.id === currentImage.id
                      ? updatedCurrentImage
                      : img
                  ),
                }));
              }
            })
            .catch((error) => {
              console.error('Failed to move vertex:', error);
            });

          return;
        }
      }

      // Delete/Backspace: Delete selected vertex (minimum 3 for polygon, 2 for polyline)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedVertexIndex !== null && selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
        if (selectedAnn && (selectedAnn.geometry.type === 'polygon' || selectedAnn.geometry.type === 'polyline')) {
          const points = selectedAnn.geometry.points;
          const geometryType = selectedAnn.geometry.type;
          const minVertices = geometryType === 'polygon' ? 3 : 2;

          // Must keep minimum vertices
          if (points.length <= minVertices) {
            const typeName = geometryType === 'polygon' ? 'Polygon' : 'Polyline';
            toast.warning(`${typeName}은 최소 ${minVertices}개의 vertex가 필요합니다.`, 3000);
            return;
          }

          e.preventDefault();

          // Remove the selected vertex
          const newPoints = points.filter((_, i) => i !== selectedVertexIndex);

          // Update annotation in store (with history recording)
          const updatedPolyGeometry = {
            type: geometryType as 'polygon' | 'polyline',
            points: newPoints,
          };
          updateAnnotationStore(selectedAnnotationId, {
            geometry: updatedPolyGeometry,
          });

          // Save to backend
          const updateData: AnnotationUpdateRequest = {
            geometry: {
              type: geometryType,
              points: newPoints,
              image_width: image.width,
              image_height: image.height,
            },
          };
          updateAnnotation(selectedAnnotationId, updateData)
            .then(() => {
              // Update image status to in-progress
              if (currentImage) {
                const updatedCurrentImage = {
                  ...currentImage,
                  is_confirmed: false,
                  status: 'in-progress',
                };

                useAnnotationStore.setState((state) => ({
                  currentImage: state.currentImage?.id === currentImage.id
                    ? updatedCurrentImage
                    : state.currentImage,
                  images: state.images.map(img =>
                    img.id === currentImage.id
                      ? updatedCurrentImage
                      : img
                  ),
                }));
              }
            })
            .catch((error) => {
              console.error('Failed to delete vertex:', error);
              toast.error('Vertex 삭제에 실패했습니다.');
            });

          // Clear vertex selection
          setSelectedVertexIndex(null);
          return;
        }
      }

      // Space: Confirm Image (supports batch)
      // Must have annotations or no_object to confirm (same condition as button)
      const canConfirm = (annotations.length > 0 || (currentImage as any)?.has_no_object) && !isImageConfirmed;
      if (e.key === ' ' && canConfirm) {
        e.preventDefault();
        handleConfirmImage();
      }

      // 0: No Object
      if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleNoObject();
      }

      // Delete: Delete all annotations (supports batch)
      // Only if no annotation is selected (individual annotation delete is handled by useKeyboardShortcuts)
      if (e.key === 'Delete' && !selectedAnnotationId && (selectedImageIds.length > 0 || annotations.length > 0)) {
        e.preventDefault();
        handleDeleteAllAnnotations();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleConfirmImage,
    isImageConfirmed,
    annotations,
    handleNoObject,
    selectedImageIds,
    handleDeleteAllAnnotations,
    currentImage,
    selectedAnnotationId,
    tool,
    polygonVertices,
    image,
    canvasState,
    selectedVertexIndex,
    selectedBboxHandle,
    selectedCircleHandle,
    polylineVertices,
    circleCenter,
    circle3pPoints,
    undo,
    redo,
    canUndo,
    canRedo,
    diffMode,
    showClassSelector,
    manualMagnifierActive,
    magnifierForceOff,
    preferences.autoMagnifier,
    isDrawingTool,
    canvasRef,
    updateAnnotationStore,
    setPolygonVertices,
    setPolylineVertices,
    setCircleCenter,
    setCircle3pPoints,
    setPendingBbox,
    setShowClassSelector,
    setSelectedVertexIndex,
    setManualMagnifierActive,
    setMagnifierForceOff,
  ]);
}
