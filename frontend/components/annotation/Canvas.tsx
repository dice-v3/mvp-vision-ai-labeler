/**
 * Canvas Component
 *
 * Main image viewer with zoom/pan controls and annotation rendering
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import ClassSelectorModal from './ClassSelectorModal';
import { createAnnotation, updateAnnotation } from '@/lib/api/annotations';
import type { AnnotationCreateRequest, AnnotationUpdateRequest } from '@/lib/api/annotations';
import { confirmImage, getProjectImageStatuses } from '@/lib/api/projects';
import { ToolRegistry, bboxTool } from '@/lib/annotation';
import type { CanvasRenderContext } from '@/lib/annotation';

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    currentImage,
    annotations,
    selectedAnnotationId,
    selectAnnotation,
    canvas: canvasState,
    tool,
    setTool,
    isDrawing,
    drawingStart,
    preferences,
    setZoom,
    setPan,
    setCursor,
    startDrawing,
    updateDrawing,
    finishDrawing,
    addAnnotation,
    project,
    isAnnotationVisible,
    currentIndex,
    images,
    goToNextImage,
    goToPrevImage,
    setCurrentIndex,
    currentTask, // Phase 2.9
  } = useAnnotationStore();

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [pendingBbox, setPendingBbox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingImage, setConfirmingImage] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; bbox: number[] } | null>(null);

  // Phase 2.7: Calculate draft annotation count
  const draftAnnotations = annotations.filter(ann => {
    const state = (ann as any).annotation_state || (ann as any).annotationState || 'draft';
    return state === 'draft';
  });
  const draftCount = draftAnnotations.length;
  const isImageConfirmed = currentImage ? (currentImage as any).is_confirmed : false;

  // Helper function to check if mouse is over a handle
  const getHandleAtPosition = (
    x: number,
    y: number,
    bboxX: number,
    bboxY: number,
    bboxW: number,
    bboxH: number,
    handleSize: number = 8
  ): string | null => {
    const threshold = handleSize / 2 + 2;

    // Corner handles
    if (Math.abs(x - bboxX) < threshold && Math.abs(y - bboxY) < threshold) return 'nw';
    if (Math.abs(x - (bboxX + bboxW)) < threshold && Math.abs(y - bboxY) < threshold) return 'ne';
    if (Math.abs(x - bboxX) < threshold && Math.abs(y - (bboxY + bboxH)) < threshold) return 'sw';
    if (Math.abs(x - (bboxX + bboxW)) < threshold && Math.abs(y - (bboxY + bboxH)) < threshold) return 'se';

    // Edge handles
    if (Math.abs(x - (bboxX + bboxW / 2)) < threshold && Math.abs(y - bboxY) < threshold) return 'n';
    if (Math.abs(x - (bboxX + bboxW / 2)) < threshold && Math.abs(y - (bboxY + bboxH)) < threshold) return 's';
    if (Math.abs(x - bboxX) < threshold && Math.abs(y - (bboxY + bboxH / 2)) < threshold) return 'w';
    if (Math.abs(x - (bboxX + bboxW)) < threshold && Math.abs(y - (bboxY + bboxH / 2)) < threshold) return 'e';

    return null;
  };

  // Helper function to check if point is inside bbox
  const isPointInBbox = (
    x: number,
    y: number,
    bboxX: number,
    bboxY: number,
    bboxW: number,
    bboxH: number
  ): boolean => {
    return x >= bboxX && x <= bboxX + bboxW && y >= bboxY && y <= bboxY + bboxH;
  };

  // Get cursor style based on handle position
  const getCursorForHandle = (handle: string | null): string => {
    if (!handle) return 'default';
    switch (handle) {
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'w':
      case 'e':
        return 'ew-resize';
      default:
        return 'default';
    }
  };

  // Load image when currentImage changes
  useEffect(() => {
    if (!currentImage?.url) {
      setImage(null);
      setImageLoaded(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error('Failed to load image:', currentImage.url);
      setImageLoaded(false);
    };
    img.src = currentImage.url;
  }, [currentImage]);

  // Render canvas
  useEffect(() => {
    if (!canvasRef.current || !image || !imageLoaded || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to container size
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas with dark/light mode aware color
    ctx.fillStyle = preferences.darkMode ? '#1f2937' : '#f3f4f6'; // gray-800 : gray-100
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate image position (centered and scaled)
    const { zoom, pan } = canvasState;
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;

    const x = (canvas.width - scaledWidth) / 2 + pan.x;
    const y = (canvas.height - scaledHeight) / 2 + pan.y;

    // Draw grid if enabled and zoomed in
    if (preferences.showGrid && zoom > 1.0) {
      drawGrid(ctx, canvas.width, canvas.height, x, y, scaledWidth, scaledHeight, zoom);
    }

    // Draw image
    ctx.drawImage(image, x, y, scaledWidth, scaledHeight);

    // Draw annotations
    drawAnnotations(ctx, x, y, zoom);

    // Draw drawing preview
    if (isDrawing && drawingStart && tool === 'bbox') {
      drawBboxPreview(ctx, x, y, zoom);
    }

    // Draw crosshair if drawing tool is active
    if (tool === 'bbox' && !isDrawing && preferences.showLabels) {
      drawCrosshair(ctx, canvas.width, canvas.height);
    }
  }, [image, imageLoaded, canvasState, annotations, selectedAnnotationId, isDrawing, drawingStart, tool, preferences, project]);

  // Draw grid
  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    imgX: number,
    imgY: number,
    imgWidth: number,
    imgHeight: number,
    zoom: number
  ) => {
    ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)'; // gray-600
    ctx.lineWidth = 1;

    const gridSize = 20 * zoom;

    // Vertical lines
    for (let x = imgX; x < imgX + imgWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, imgY);
      ctx.lineTo(x, imgY + imgHeight);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = imgY; y < imgY + imgHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(imgX, y);
      ctx.lineTo(imgX + imgWidth, y);
      ctx.stroke();
    }
  };

  // Draw annotations using Tool system
  const drawAnnotations = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (!project || !canvasRef.current) return;

    const canvas = canvasRef.current;

    // Create render context for tools
    const renderCtx: CanvasRenderContext = {
      ctx,
      offsetX,
      offsetY,
      zoom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      showLabels: preferences.showLabels,
      darkMode: preferences.darkMode,
    };

    annotations.forEach((ann) => {
      // Skip if annotation is hidden
      if (!isAnnotationVisible(ann.id)) return;

      const isSelected = ann.id === selectedAnnotationId;
      // Support both camelCase and snake_case
      const classId = (ann as any).classId || (ann as any).class_id;
      const className = (ann as any).className || (ann as any).class_name;
      const classInfo = classId ? project.classes[classId] : null;
      const color = classInfo?.color || '#9333ea';

      // Get the appropriate tool for this annotation type
      const tool = ToolRegistry.getTool(ann.geometry.type);

      if (tool) {
        // Use tool to render annotation
        tool.renderAnnotation(renderCtx, ann, isSelected, color, className);

        // Render handles if selected
        if (isSelected) {
          tool.renderHandles(renderCtx, ann, color);
        }
      } else {
        // Fallback for unknown types - use bbox tool for bbox type
        if (ann.geometry.type === 'bbox') {
          bboxTool.renderAnnotation(renderCtx, ann, isSelected, color, className);
          if (isSelected) {
            bboxTool.renderHandles(renderCtx, ann, color);
          }
        }
      }
    });
  };

  // Draw bbox preview while drawing using Tool system
  const drawBboxPreview = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (!drawingStart || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const currentPos = canvasState.cursor;

    // Create render context for tools
    const renderCtx: CanvasRenderContext = {
      ctx,
      offsetX,
      offsetY,
      zoom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      showLabels: preferences.showLabels,
      darkMode: preferences.darkMode,
    };

    // Create tool state
    const toolState = {
      isDrawing: true,
      drawingStart,
      currentCursor: currentPos,
    };

    // Use bbox tool to render preview
    bboxTool.renderPreview(renderCtx, toolState);
  };

  // Draw crosshair
  const drawCrosshair = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const { cursor } = canvasState;

    ctx.strokeStyle = 'rgba(147, 51, 234, 0.3)'; // violet-600
    ctx.lineWidth = 1;

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(cursor.x, 0);
    ctx.lineTo(cursor.x, height);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, cursor.y);
    ctx.lineTo(width, cursor.y);
    ctx.stroke();
  };

  // Mouse down handler
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !image) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { zoom, pan } = canvasState;
    const scaledWidth = image.width * zoom;
    const scaledHeight = image.height * zoom;
    const imgX = (rect.width - scaledWidth) / 2 + pan.x;
    const imgY = (rect.height - scaledHeight) / 2 + pan.y;

    // Check if clicking on a handle of the selected annotation
    if (selectedAnnotationId) {
      const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (selectedAnn && selectedAnn.geometry.type === 'bbox') {
        const [bboxX, bboxY, bboxW, bboxH] = selectedAnn.geometry.bbox;

        const scaledX = bboxX * zoom + imgX;
        const scaledY = bboxY * zoom + imgY;
        const scaledW = bboxW * zoom;
        const scaledH = bboxH * zoom;

        const handle = getHandleAtPosition(x, y, scaledX, scaledY, scaledW, scaledH);
        if (handle) {
          // Start resizing
          setIsResizing(true);
          setResizeHandle(handle);
          setResizeStart({ x, y, bbox: [bboxX, bboxY, bboxW, bboxH] });
          return;
        }
      }
    }

    // Check if clicking on any bbox to select it
    let clickedAnnotation: typeof annotations[0] | null = null;
    for (const ann of annotations) {
      if (!isAnnotationVisible(ann.id)) continue;
      if (ann.geometry.type === 'bbox') {
        const [bboxX, bboxY, bboxW, bboxH] = ann.geometry.bbox;
        const scaledX = bboxX * zoom + imgX;
        const scaledY = bboxY * zoom + imgY;
        const scaledW = bboxW * zoom;
        const scaledH = bboxH * zoom;

        if (isPointInBbox(x, y, scaledX, scaledY, scaledW, scaledH)) {
          clickedAnnotation = ann;
          break; // Take the first one (topmost)
        }
      }
    }

    if (clickedAnnotation) {
      // Select the clicked annotation
      selectAnnotation(clickedAnnotation.id);
      return;
    }

    // If nothing clicked, deselect
    if (selectedAnnotationId && tool === 'select') {
      selectAnnotation(null);
    }

    // If select tool is active, start panning
    if (tool === 'select') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // If middle button or shift+click, start panning
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // If bbox tool is active, start drawing
    if (tool === 'bbox') {
      startDrawing({ x, y });
    }
  };

  // Mouse move handler
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || !image) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCursor({ x, y });

    // Update cursor style based on position
    if (!isResizing && !isDrawing && !isPanning) {
      const { zoom, pan } = canvasState;
      const scaledWidth = image.width * zoom;
      const scaledHeight = image.height * zoom;
      const imgX = (rect.width - scaledWidth) / 2 + pan.x;
      const imgY = (rect.height - scaledHeight) / 2 + pan.y;

      // Check if mouse is within image bounds
      const isInImage = x >= imgX && x <= imgX + scaledWidth && y >= imgY && y <= imgY + scaledHeight;

      // Default cursor based on tool and image position
      let newCursor = 'default';
      if (isInImage) {
        newCursor = tool === 'bbox' ? 'crosshair' : 'default';
      }

      // Check if hovering over selected annotation's handle
      if (selectedAnnotationId) {
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
        if (selectedAnn && selectedAnn.geometry.type === 'bbox') {
          const [bboxX, bboxY, bboxW, bboxH] = selectedAnn.geometry.bbox;
          const scaledX = bboxX * zoom + imgX;
          const scaledY = bboxY * zoom + imgY;
          const scaledW = bboxW * zoom;
          const scaledH = bboxH * zoom;

          const handle = getHandleAtPosition(x, y, scaledX, scaledY, scaledW, scaledH);
          if (handle) {
            newCursor = getCursorForHandle(handle);
          } else if (isPointInBbox(x, y, scaledX, scaledY, scaledW, scaledH)) {
            newCursor = 'move';
          }
        }
      }

      // Check if hovering over any bbox (for click to select)
      if (isInImage && (newCursor === 'default' || newCursor === 'crosshair' || (tool === 'select' && newCursor === 'default'))) {
        for (const ann of annotations) {
          if (!isAnnotationVisible(ann.id)) continue;
          if (ann.geometry.type === 'bbox') {
            const [bboxX, bboxY, bboxW, bboxH] = ann.geometry.bbox;
            const scaledX = bboxX * zoom + imgX;
            const scaledY = bboxY * zoom + imgY;
            const scaledW = bboxW * zoom;
            const scaledH = bboxH * zoom;

            if (isPointInBbox(x, y, scaledX, scaledY, scaledW, scaledH)) {
              newCursor = 'pointer';
              break;
            }
          }
        }
      }

      if (canvasRef.current) {
        canvasRef.current.style.cursor = newCursor;
      }
    }

    // Handle resizing
    if (isResizing && resizeStart && resizeHandle && selectedAnnotationId) {
      const { zoom, pan } = canvasState;
      const scaledWidth = image.width * zoom;
      const scaledHeight = image.height * zoom;
      const imgX = (rect.width - scaledWidth) / 2 + pan.x;
      const imgY = (rect.height - scaledHeight) / 2 + pan.y;

      // Calculate delta in image coordinates
      const deltaX = (x - resizeStart.x) / zoom;
      const deltaY = (y - resizeStart.y) / zoom;

      let [newX, newY, newW, newH] = resizeStart.bbox;

      // Apply delta based on handle type
      switch (resizeHandle) {
        case 'nw':
          newX += deltaX;
          newY += deltaY;
          newW -= deltaX;
          newH -= deltaY;
          break;
        case 'ne':
          newY += deltaY;
          newW += deltaX;
          newH -= deltaY;
          break;
        case 'sw':
          newX += deltaX;
          newW -= deltaX;
          newH += deltaY;
          break;
        case 'se':
          newW += deltaX;
          newH += deltaY;
          break;
        case 'n':
          newY += deltaY;
          newH -= deltaY;
          break;
        case 's':
          newH += deltaY;
          break;
        case 'w':
          newX += deltaX;
          newW -= deltaX;
          break;
        case 'e':
          newW += deltaX;
          break;
      }

      // Ensure minimum size
      if (newW < 10) newW = 10;
      if (newH < 10) newH = 10;

      // Update annotation geometry
      const updatedAnnotation = annotations.find(ann => ann.id === selectedAnnotationId);
      if (updatedAnnotation) {
        useAnnotationStore.setState({
          annotations: annotations.map(ann =>
            ann.id === selectedAnnotationId
              ? {
                  ...ann,
                  geometry: {
                    ...ann.geometry,
                    bbox: [newX, newY, newW, newH],
                  },
                }
              : ann
          ),
        });
      }
      return;
    }

    // Handle panning
    if (isPanning && panStart) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setPan({
        x: canvasState.pan.x + deltaX,
        y: canvasState.pan.y + deltaY,
      });
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    // Handle drawing
    if (isDrawing) {
      updateDrawing({ x, y });
    }
  };

  // Mouse up handler
  const handleMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Stop resizing and save to backend
    if (isResizing && selectedAnnotationId) {
      setIsResizing(false);
      setResizeHandle(null);
      setResizeStart(null);

      // Save updated bbox to backend
      const updatedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
      if (updatedAnn && updatedAnn.geometry.type === 'bbox' && project && currentImage) {
        try {
          const updateData: AnnotationUpdateRequest = {
            geometry: updatedAnn.geometry,
          };
          await updateAnnotation(selectedAnnotationId, updateData);

          // Update image status to in_progress and unconfirm
          useAnnotationStore.setState((state) => ({
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
          console.error('Failed to update annotation:', err);
          // TODO: Show error toast
        }
      }
      return;
    }

    // Stop panning
    if (isPanning) {
      setIsPanning(false);
      setPanStart(null);
      return;
    }

    // Finish drawing
    if (isDrawing && drawingStart && image) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const currentPos = canvasState.cursor;

      // Calculate bbox in canvas coordinates
      const x1 = Math.min(drawingStart.x, currentPos.x);
      const y1 = Math.min(drawingStart.y, currentPos.y);
      const w = Math.abs(currentPos.x - drawingStart.x);
      const h = Math.abs(currentPos.y - drawingStart.y);

      // Only create annotation if bbox has minimum size
      if (w > 5 && h > 5) {
        // Convert canvas coordinates to image coordinates
        const { zoom, pan } = canvasState;
        const scaledWidth = image.width * zoom;
        const scaledHeight = image.height * zoom;
        const imgX = (rect.width - scaledWidth) / 2 + pan.x;
        const imgY = (rect.height - scaledHeight) / 2 + pan.y;

        // Calculate bbox in image coordinates
        const bboxX = (x1 - imgX) / zoom;
        const bboxY = (y1 - imgY) / zoom;
        const bboxW = w / zoom;
        const bboxH = h / zoom;

        // Store pending bbox and show class selector
        setPendingBbox({ x: bboxX, y: bboxY, w: bboxW, h: bboxH });
        setShowClassSelector(true);
      }

      finishDrawing();
    }
  };

  // Handle class selection
  const handleClassSelect = async (classId: string, className: string) => {
    if (!pendingBbox || !currentImage || !project) return;

    setShowClassSelector(false);
    setIsSaving(true);

    try {
      // Create annotation request
      const annotationData: AnnotationCreateRequest = {
        project_id: project.id,
        image_id: currentImage.id,
        annotation_type: 'bbox',
        geometry: {
          type: 'bbox',
          bbox: [pendingBbox.x, pendingBbox.y, pendingBbox.w, pendingBbox.h],
        },
        class_id: classId,
        class_name: className,
      };

      // Save to backend
      const savedAnnotation = await createAnnotation(annotationData);

      // Add to store
      addAnnotation({
        id: savedAnnotation.id.toString(),
        projectId: project.id,
        imageId: currentImage.id,
        annotationType: 'bbox',
        classId: classId,
        className: className,
        geometry: {
          type: 'bbox',
          bbox: [pendingBbox.x, pendingBbox.y, pendingBbox.w, pendingBbox.h],
        },
        confidence: savedAnnotation.confidence,
        attributes: savedAnnotation.attributes,
        createdAt: savedAnnotation.created_at ? new Date(savedAnnotation.created_at) : undefined,
        updatedAt: savedAnnotation.updated_at ? new Date(savedAnnotation.updated_at) : undefined,
      });

      // Update current image status only (not all images)
      // This prevents resetting other images' status
      useAnnotationStore.setState((state) => ({
        images: state.images.map(img =>
          img.id === currentImage.id
            ? {
                ...img,
                annotation_count: (img.annotation_count || 0) + 1,
                is_confirmed: false,
                status: 'in-progress',
              }
            : img
        )
      }));

      setPendingBbox(null);
    } catch (err) {
      console.error('Failed to save annotation:', err);
      // TODO: Show error toast
    } finally {
      setIsSaving(false);
    }
  };

  // Handle class selector close
  const handleClassSelectorClose = () => {
    setShowClassSelector(false);
    setPendingBbox(null);
  };

  // Phase 2.7: Confirm Image handler
  const handleConfirmImage = useCallback(async () => {
    if (!currentImage || !project) return;
    if (confirmingImage) return;

    setConfirmingImage(true);
    try {
      // Call API to confirm image (will also confirm all draft annotations)
      // Phase 2.9: Pass currentTask for task-specific confirmation
      await confirmImage(project.id, currentImage.id, currentTask || undefined);

      // Update local state - mark all annotations as confirmed
      const updatedAnnotations = annotations.map(ann => ({
        ...ann,
        annotation_state: 'confirmed',
        confirmed_at: new Date().toISOString(),
      }));

      useAnnotationStore.setState({ annotations: updatedAnnotations });

      // Update current image status
      const updatedImages = images.map(img =>
        img.id === currentImage.id
          ? {
              ...img,
              is_confirmed: true,
              status: 'completed',
              confirmed_at: new Date().toISOString(),
            }
          : img
      );

      useAnnotationStore.setState({ images: updatedImages });

      // Auto-navigate to next incomplete image (in-progress or not-started)
      const nextIncompleteIndex = updatedImages.findIndex((img, idx) => {
        if (idx <= currentIndex) return false;
        const status = (img as any).status || 'not-started';
        return status === 'in-progress' || status === 'not-started';
      });

      if (nextIncompleteIndex !== -1) {
        // Navigate to next incomplete image
        setCurrentIndex(nextIncompleteIndex);
      } else {
        // No more incomplete images, just go to next image
        goToNextImage();
      }

    } catch (err) {
      console.error('Failed to confirm image:', err);
      // TODO: Show error toast
    } finally {
      setConfirmingImage(false);
    }
  }, [currentImage, project, confirmingImage, annotations, images, currentIndex, goToNextImage, setCurrentIndex]);

  // Phase 2.7: Keyboard shortcut for Confirm Image (Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Space: Confirm Image
      if (e.key === ' ' && !isImageConfirmed && annotations.length > 0) {
        e.preventDefault();
        handleConfirmImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleConfirmImage, isImageConfirmed, annotations]);

  // Mouse wheel handler (zoom)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(canvasState.zoom + delta);
  };

  if (!currentImage) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500">No image selected</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 bg-white dark:bg-gray-900 relative overflow-hidden">
      {/* Tool selector - top center */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center gap-2 shadow-lg z-10">
        <button
          onClick={() => setTool('select')}
          className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
            tool === 'select'
              ? 'bg-violet-500 text-white'
              : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title="Select Tool (V)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
          <span>Select</span>
        </button>

        {/* Phase 2.9: Show BBox tool only for detection and segmentation tasks */}
        {currentTask !== 'classification' && (
          <button
            onClick={() => setTool('bbox')}
            className={`px-4 py-2 rounded transition-all text-sm font-medium flex items-center gap-2 ${
              tool === 'bbox'
                ? 'bg-violet-500 text-white'
                : 'text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
            title="Bounding Box (R)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2" />
            </svg>
            <span>BBox</span>
          </button>
        )}
      </div>

      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center gap-2 shadow-lg">
        <button
          onClick={() => setZoom(canvasState.zoom - 0.25)}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-900 dark:text-white"
          title="Zoom Out (Ctrl+-)"
        >
          −
        </button>
        <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-center">
          {Math.round(canvasState.zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(canvasState.zoom + 0.25)}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-900 dark:text-white"
          title="Zoom In (Ctrl++)"
        >
          +
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, y: 0 });
          }}
          className="px-3 h-8 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-xs text-gray-900 dark:text-white"
          title="Fit to Screen (Ctrl+0)"
        >
          Fit
        </button>
      </div>

      {/* Navigation controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-3 shadow-lg">
        <button
          onClick={goToPrevImage}
          disabled={currentIndex === 0}
          className="text-gray-900 dark:text-white disabled:text-gray-400 dark:disabled:text-gray-600 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:cursor-not-allowed"
          title="Previous Image (←)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm text-gray-900 dark:text-white font-medium min-w-[60px] text-center">
          {currentIndex + 1} / {images.length}
        </span>
        <button
          onClick={goToNextImage}
          disabled={currentIndex >= images.length - 1}
          className="text-gray-900 dark:text-white disabled:text-gray-400 dark:disabled:text-gray-600 hover:text-violet-600 dark:hover:text-violet-400 transition-colors disabled:cursor-not-allowed"
          title="Next Image (→)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Image info */}
      {image && (
        <div className="absolute bottom-4 right-20 bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-400 shadow-lg">
          {image.width} x {image.height} px
        </div>
      )}

      {/* Phase 2.7: Confirm Image button */}
      {annotations.length > 0 && !isImageConfirmed && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <button
            onClick={handleConfirmImage}
            disabled={confirmingImage}
            className={`px-4 py-2 rounded-lg shadow-lg font-medium text-xs transition-all flex items-center gap-2 whitespace-nowrap ${
              draftCount > 0
                ? 'bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white'
                : 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white'
            } disabled:cursor-not-allowed`}
            title="Confirm Image (Space)"
          >
            {confirmingImage ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Confirming...</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                <span>
                  {draftCount > 0
                    ? `Confirm & Next (${draftCount} draft)`
                    : 'Mark Complete & Next'}
                </span>
                <kbd className="ml-1 px-1 py-0.5 text-[10px] bg-white bg-opacity-20 rounded">
                  Space
                </kbd>
              </>
            )}
          </button>
        </div>
      )}

      {/* Image already confirmed */}
      {isImageConfirmed && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <div className="px-4 py-2 rounded-lg shadow-lg bg-gray-500 text-white font-medium text-xs flex items-center gap-2 whitespace-nowrap">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
            <span>Image Confirmed</span>
          </div>
        </div>
      )}

      {/* AI Assistant button */}
      <div className="absolute bottom-4 right-4">
        <button
          className="w-12 h-12 bg-violet-600 hover:bg-violet-700 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-105"
          title="AI Assistant"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </button>
      </div>

      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 bg-opacity-50">
          <svg className="animate-spin h-8 w-8 text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm text-gray-900 dark:text-gray-300">Saving annotation...</span>
        </div>
      )}

      {/* Class Selector Modal */}
      <ClassSelectorModal
        isOpen={showClassSelector}
        onClose={handleClassSelectorClose}
        onSelect={handleClassSelect}
      />
    </div>
  );
}
