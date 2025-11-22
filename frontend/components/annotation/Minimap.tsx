/**
 * Minimap Component
 *
 * Phase 2.10.3: Navigation minimap for canvas
 * - Shows entire image scaled (200x150px)
 * - Renders all annotations (simplified)
 * - Red viewport rectangle indicator
 * - Click to navigate
 * - Drag viewport for panning
 * - Toggle visibility: M key
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { Annotation } from '@/lib/stores/annotationStore';

interface MinimapProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  imageRef: React.RefObject<HTMLImageElement>;
  annotations: Annotation[];
  viewport: {
    x: number;
    y: number;
    scale: number;
  };
  onViewportChange: (x: number, y: number) => void;
  width?: number;
  height?: number;
}

export default function Minimap({
  canvasRef,
  imageRef,
  annotations,
  viewport,
  onViewportChange,
  width = 200,
  height = 150,
}: MinimapProps) {
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Render minimap
  useEffect(() => {
    const minimapCanvas = minimapRef.current;
    const mainCanvas = canvasRef.current;
    const image = imageRef.current;
    if (!minimapCanvas || !mainCanvas || !image) return;

    const ctx = minimapCanvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate scale to fit image in minimap
    const imageAspect = image.width / image.height;
    const minimapAspect = width / height;

    let drawWidth = width;
    let drawHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    if (imageAspect > minimapAspect) {
      // Image is wider - fit to width
      drawHeight = width / imageAspect;
      offsetY = (height - drawHeight) / 2;
    } else {
      // Image is taller - fit to height
      drawWidth = height * imageAspect;
      offsetX = (width - drawWidth) / 2;
    }

    // Draw image
    ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);

    // Draw annotations (simplified)
    const scaleX = drawWidth / image.width;
    const scaleY = drawHeight / image.height;

    annotations.forEach((annotation) => {
      ctx.strokeStyle = annotation.color || '#8b5cf6';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;

      if (annotation.task_type === 'detection' && annotation.bbox) {
        const [x, y, w, h] = annotation.bbox;
        ctx.strokeRect(
          offsetX + x * scaleX,
          offsetY + y * scaleY,
          w * scaleX,
          h * scaleY
        );
      } else if (annotation.task_type === 'polygon' && annotation.segmentation) {
        const points = annotation.segmentation;
        if (points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(offsetX + points[0] * scaleX, offsetY + points[1] * scaleY);
          for (let i = 2; i < points.length; i += 2) {
            ctx.lineTo(offsetX + points[i] * scaleX, offsetY + points[i + 1] * scaleY);
          }
          ctx.closePath();
          ctx.stroke();
        }
      } else if (annotation.task_type === 'polyline' && annotation.points) {
        const points = annotation.points;
        if (points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(offsetX + points[0] * scaleX, offsetY + points[1] * scaleY);
          for (let i = 2; i < points.length; i += 2) {
            ctx.lineTo(offsetX + points[i] * scaleX, offsetY + points[i + 1] * scaleY);
          }
          ctx.stroke();
        }
      } else if (annotation.task_type === 'circle' && annotation.circle) {
        const { center, radius } = annotation.circle;
        ctx.beginPath();
        ctx.arc(
          offsetX + center.x * scaleX,
          offsetY + center.y * scaleY,
          radius * Math.min(scaleX, scaleY),
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
    });

    ctx.globalAlpha = 1.0;

    // Draw viewport rectangle
    const canvasRect = mainCanvas.getBoundingClientRect();
    const viewportWidth = canvasRect.width / viewport.scale;
    const viewportHeight = canvasRect.height / viewport.scale;

    const viewportX = offsetX + (-viewport.x / viewport.scale) * scaleX;
    const viewportY = offsetY + (-viewport.y / viewport.scale) * scaleY;
    const viewportW = viewportWidth * scaleX;
    const viewportH = viewportHeight * scaleY;

    ctx.strokeStyle = '#ef4444'; // Red
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportX, viewportY, viewportW, viewportH);

    // Semi-transparent overlay outside viewport
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(offsetX, offsetY, drawWidth, viewportY - offsetY); // Top
    ctx.fillRect(offsetX, viewportY, viewportX - offsetX, viewportH); // Left
    ctx.fillRect(viewportX + viewportW, viewportY, offsetX + drawWidth - (viewportX + viewportW), viewportH); // Right
    ctx.fillRect(offsetX, viewportY + viewportH, drawWidth, offsetY + drawHeight - (viewportY + viewportH)); // Bottom
  }, [canvasRef, imageRef, annotations, viewport, width, height]);

  // Handle mouse click/drag
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    updateViewport(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    updateViewport(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateViewport = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const minimapCanvas = minimapRef.current;
    const mainCanvas = canvasRef.current;
    const image = imageRef.current;
    if (!minimapCanvas || !mainCanvas || !image) return;

    const rect = minimapCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Calculate image position in minimap
    const imageAspect = image.width / image.height;
    const minimapAspect = width / height;

    let drawWidth = width;
    let drawHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    if (imageAspect > minimapAspect) {
      drawHeight = width / imageAspect;
      offsetY = (height - drawHeight) / 2;
    } else {
      drawWidth = height * imageAspect;
      offsetX = (width - drawWidth) / 2;
    }

    const scaleX = drawWidth / image.width;
    const scaleY = drawHeight / image.height;

    // Convert click position to image coordinates
    const imageX = (clickX - offsetX) / scaleX;
    const imageY = (clickY - offsetY) / scaleY;

    // Calculate viewport position to center on click
    const canvasRect = mainCanvas.getBoundingClientRect();
    const viewportWidth = canvasRect.width / viewport.scale;
    const viewportHeight = canvasRect.height / viewport.scale;

    const newX = -(imageX - viewportWidth / 2) * viewport.scale;
    const newY = -(imageY - viewportHeight / 2) * viewport.scale;

    onViewportChange(newX, newY);
  };

  return (
    <div className="absolute bottom-4 right-4 z-40 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-2 border-2 border-gray-300 dark:border-gray-700">
      <canvas
        ref={minimapRef}
        width={width}
        height={height}
        className="cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
        Minimap
      </div>
    </div>
  );
}
