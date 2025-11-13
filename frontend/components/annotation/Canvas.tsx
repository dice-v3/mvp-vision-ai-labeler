/**
 * Canvas Component
 *
 * Main image viewer with zoom/pan controls and annotation rendering
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useAnnotationStore } from '@/lib/stores/annotationStore';

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
    project,
  } = useAnnotationStore();

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

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

    // Clear canvas
    ctx.fillStyle = '#1f2937'; // gray-800
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
      if (ann.geometry.type === 'bbox') {
        const [x, y, w, h] = ann.geometry.bbox;
        const scaledX = x * zoom + offsetX;
        const scaledY = y * zoom + offsetY;
        const scaledW = w * zoom;
        const scaledH = h * zoom;

        const isSelected = ann.id === selectedAnnotationId;
        const classInfo = ann.classId ? project.classes[ann.classId] : null;
        const color = classInfo?.color || '#9333ea';

        // Draw bbox
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(scaledX, scaledY, scaledW, scaledH);

        // Draw label
        if (preferences.showLabels && ann.className) {
          ctx.fillStyle = color;
          ctx.fillRect(scaledX, scaledY - 20, ctx.measureText(ann.className).width + 8, 20);
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px sans-serif';
          ctx.fillText(ann.className, scaledX + 4, scaledY - 6);
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

    // If space key is held, start panning
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
    if (isDrawing) {
      finishDrawing();
      // TODO: Show class selector modal
    }
  };

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
    <div ref={containerRef} className="flex-1 bg-gray-900 relative overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-4 left-4 bg-gray-800 rounded-lg p-2 flex items-center gap-2">
        <button
          onClick={() => setZoom(canvasState.zoom - 0.25)}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded transition-colors"
          title="Zoom Out (Ctrl+-)"
        >
          −
        </button>
        <span className="text-xs text-gray-400 w-12 text-center">
          {Math.round(canvasState.zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(canvasState.zoom + 0.25)}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-700 rounded transition-colors"
          title="Zoom In (Ctrl++)"
        >
          +
        </button>
        <div className="w-px h-6 bg-gray-700 mx-1"></div>
        <button
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, y: 0 });
          }}
          className="px-3 h-8 flex items-center justify-center hover:bg-gray-700 rounded transition-colors text-xs"
          title="Fit to Screen (Ctrl+0)"
        >
          Fit
        </button>
      </div>

      {/* Image info */}
      {image && (
        <div className="absolute bottom-4 right-4 bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-400">
          {image.width} x {image.height} px
        </div>
      )}

      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <svg className="animate-spin h-8 w-8 text-violet-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
    </div>
  );
}
