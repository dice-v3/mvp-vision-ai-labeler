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
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.7;

      if (annotation.geometry.type === 'bbox') {
        const [x, y, w, h] = annotation.geometry.bbox;
        ctx.strokeRect(
          offsetX + x * scaleX,
          offsetY + y * scaleY,
          w * scaleX,
          h * scaleY
        );
      } else if (annotation.geometry.type === 'polygon') {
        const points = annotation.geometry.points;
        if (points && points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(offsetX + points[0][0] * scaleX, offsetY + points[0][1] * scaleY);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(offsetX + points[i][0] * scaleX, offsetY + points[i][1] * scaleY);
          }
          ctx.closePath();
          ctx.stroke();
        }
      } else if (annotation.geometry.type === 'polyline') {
        const points = annotation.geometry.points;
        if (points && points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(offsetX + points[0][0] * scaleX, offsetY + points[0][1] * scaleY);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(offsetX + points[i][0] * scaleX, offsetY + points[i][1] * scaleY);
          }
          ctx.stroke();
        }
      } else if (annotation.geometry.type === 'circle') {
        const [cx, cy] = annotation.geometry.center;
        const radius = annotation.geometry.radius;
        ctx.beginPath();
        ctx.arc(
          offsetX + cx * scaleX,
          offsetY + cy * scaleY,
          radius * Math.min(scaleX, scaleY),
          0,
          Math.PI * 2
        );
        ctx.stroke();
      }
    });

    ctx.globalAlpha = 1.0;

    // Draw viewport rectangle
    // Canvas renders image centered, so viewport calculation must account for this
    const canvasRect = mainCanvas.getBoundingClientRect();

    // Viewport size in image coordinates
    const viewportWidth = canvasRect.width / viewport.scale;
    const viewportHeight = canvasRect.height / viewport.scale;

    // Viewport center in image coordinates (Canvas centers the image and applies pan)
    const imageViewportCenterX = image.width / 2 - viewport.x / viewport.scale;
    const imageViewportCenterY = image.height / 2 - viewport.y / viewport.scale;

    // Viewport top-left in image coordinates
    const imageViewportLeft = imageViewportCenterX - viewportWidth / 2;
    const imageViewportTop = imageViewportCenterY - viewportHeight / 2;

    // Convert to minimap coordinates
    const viewportX = offsetX + imageViewportLeft * scaleX;
    const viewportY = offsetY + imageViewportTop * scaleY;
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

    // Calculate pan to center clicked position in viewport
    // Canvas centers the image, so: viewportCenter = image.width/2 - pan.x/zoom
    // To make imageX the center: image.width/2 - pan.x/zoom = imageX
    // Therefore: pan.x = (image.width/2 - imageX) * zoom
    const newX = (image.width / 2 - imageX) * viewport.scale;
    const newY = (image.height / 2 - imageY) * viewport.scale;

    onViewportChange(newX, newY);
  };

  return (
    <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-300 dark:border-gray-700">
      <canvas
        ref={minimapRef}
        width={width}
        height={height}
        className="cursor-pointer w-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
        Minimap
      </div>
    </div>
  );
}
