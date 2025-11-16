/**
 * Canvas Component
 *
 * Main image viewer with zoom/pan controls and annotation rendering
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';
import ClassSelectorModal from './ClassSelectorModal';
import { createAnnotation } from '@/lib/api/annotations';
import type { AnnotationCreateRequest } from '@/lib/api/annotations';
import { confirmImage } from '@/lib/api/projects';

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    currentImage,
    annotations,
    selectedAnnotationId,
    canvas: canvasState,
    tool,
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
  } = useAnnotationStore();

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [pendingBbox, setPendingBbox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingImage, setConfirmingImage] = useState(false);

  // Phase 2.7: Calculate draft annotation count
  const draftAnnotations = annotations.filter(ann => {
    const state = (ann as any).annotation_state || (ann as any).annotationState || 'draft';
    return state === 'draft';
  });
  const draftCount = draftAnnotations.length;
  const isImageConfirmed = currentImage ? (currentImage as any).is_confirmed : false;

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

  // Draw annotations
  const drawAnnotations = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (!project) return;

    annotations.forEach((ann) => {
      // Skip if annotation is hidden
      if (!isAnnotationVisible(ann.id)) return;

      if (ann.geometry.type === 'bbox') {
        const [x, y, w, h] = ann.geometry.bbox;
        const scaledX = x * zoom + offsetX;
        const scaledY = y * zoom + offsetY;
        const scaledW = w * zoom;
        const scaledH = h * zoom;

        const isSelected = ann.id === selectedAnnotationId;
        // Support both camelCase and snake_case
        const classId = (ann as any).classId || (ann as any).class_id;
        const className = (ann as any).className || (ann as any).class_name;
        const classInfo = classId ? project.classes[classId] : null;
        const color = classInfo?.color || '#9333ea';

        // Draw bbox
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(scaledX, scaledY, scaledW, scaledH);

        // Draw label
        if (preferences.showLabels && className) {
          ctx.fillStyle = color;
          ctx.fillRect(scaledX, scaledY - 20, ctx.measureText(className).width + 8, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px sans-serif';
          ctx.fillText(className, scaledX + 4, scaledY - 6);
        }

        // Draw handles if selected
        if (isSelected) {
          const handleSize = 8;
          ctx.fillStyle = color;

          // Corner handles
          ctx.fillRect(scaledX - handleSize / 2, scaledY - handleSize / 2, handleSize, handleSize);
          ctx.fillRect(scaledX + scaledW - handleSize / 2, scaledY - handleSize / 2, handleSize, handleSize);
          ctx.fillRect(scaledX - handleSize / 2, scaledY + scaledH - handleSize / 2, handleSize, handleSize);
          ctx.fillRect(scaledX + scaledW - handleSize / 2, scaledY + scaledH - handleSize / 2, handleSize, handleSize);

          // Edge handles
          ctx.fillRect(scaledX + scaledW / 2 - handleSize / 2, scaledY - handleSize / 2, handleSize, handleSize);
          ctx.fillRect(scaledX + scaledW / 2 - handleSize / 2, scaledY + scaledH - handleSize / 2, handleSize, handleSize);
          ctx.fillRect(scaledX - handleSize / 2, scaledY + scaledH / 2 - handleSize / 2, handleSize, handleSize);
          ctx.fillRect(scaledX + scaledW - handleSize / 2, scaledY + scaledH / 2 - handleSize / 2, handleSize, handleSize);
        }
      }
    });
  };

  // Draw bbox preview while drawing
  const drawBboxPreview = (ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, zoom: number) => {
    if (!drawingStart) return;

    const currentPos = canvasState.cursor;
    const x1 = Math.min(drawingStart.x, currentPos.x);
    const y1 = Math.min(drawingStart.y, currentPos.y);
    const w = Math.abs(currentPos.x - drawingStart.x);
    const h = Math.abs(currentPos.y - drawingStart.y);

    ctx.strokeStyle = '#ef4444'; // red-500
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.strokeRect(x1, y1, w, h);
    ctx.setLineDash([]);

    // Draw dimensions tooltip
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const text = `W: ${Math.round(w / zoom)} x H: ${Math.round(h / zoom)}`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillRect(currentPos.x + 10, currentPos.y - 25, textWidth + 10, 20);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    ctx.fillText(text, currentPos.x + 15, currentPos.y - 10);
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
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCursor({ x, y });

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
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
      await confirmImage(project.id, currentImage.id);

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

      // Auto-navigate to next not-started image
      const nextNotStartedIndex = images.findIndex((img, idx) => {
        if (idx <= currentIndex) return false;
        const status = (img as any).status || 'not-started';
        return status === 'not-started';
      });

      if (nextNotStartedIndex !== -1) {
        // Navigate to next not-started image
        useAnnotationStore.setState({ currentIndex: nextNotStartedIndex });
      } else {
        // No more not-started images, just go to next image
        goToNextImage();
      }

    } catch (err) {
      console.error('Failed to confirm image:', err);
      // TODO: Show error toast
    } finally {
      setConfirmingImage(false);
    }
  }, [currentImage, project, confirmingImage, annotations, images, currentIndex, goToNextImage]);

  // Phase 2.7: Keyboard shortcut for Confirm Image (Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter: Confirm Image
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleConfirmImage();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleConfirmImage]);

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
      <canvas
        ref={canvasRef}
        className={`w-full h-full ${
          tool === 'select'
            ? isPanning
              ? 'cursor-grabbing'
              : 'cursor-grab'
            : 'cursor-crosshair'
        }`}
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
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 ml-20">
          <button
            onClick={handleConfirmImage}
            disabled={confirmingImage}
            className={`px-6 py-3 rounded-lg shadow-lg font-medium text-sm transition-all flex items-center gap-2 ${
              draftCount > 0
                ? 'bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white'
                : 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white'
            } disabled:cursor-not-allowed`}
            title="Confirm Image (Ctrl+Enter)"
          >
            {confirmingImage ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Confirming...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
                <span>
                  {draftCount > 0
                    ? `Confirm & Next (${draftCount} draft)`
                    : 'Mark Complete & Next'}
                </span>
                <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-white bg-opacity-20 rounded">
                  Ctrl+Enter
                </kbd>
              </>
            )}
          </button>
        </div>
      )}

      {/* Image already confirmed */}
      {isImageConfirmed && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 ml-20">
          <div className="px-6 py-3 rounded-lg shadow-lg bg-gray-500 text-white font-medium text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
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
