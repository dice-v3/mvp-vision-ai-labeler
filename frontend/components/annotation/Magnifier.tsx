/**
 * Magnifier Component
 *
 * Phase 2.10.2: Zoom lens for pixel-perfect annotation
 * - Manual activation: Z key
 * - Auto activation: Shows in drawing tools
 * - Following mode: Follows cursor
 * - Fixed mode: Top-right corner
 */

'use client';

import { useEffect, useRef } from 'react';

interface MagnifierProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  cursorPosition: { x: number; y: number }; // Canvas coordinates
  magnification: number; // 2x, 3x, 4x, etc.
  mode: 'following' | 'fixed';
  size: number; // Diameter in pixels
}

export default function Magnifier({
  canvasRef,
  cursorPosition,
  magnification,
  mode,
  size,
}: MagnifierProps) {
  const magnifierRef = useRef<HTMLCanvasElement>(null);

  // Calculate offset for following mode with edge detection
  const getOffset = () => {
    if (mode === 'fixed') return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    if (!canvas) return { x: 50, y: 50 };

    const rect = canvas.getBoundingClientRect();
    const offset = { x: 50, y: 50 };

    // Edge detection: flip offset if near edges
    if (cursorPosition.x + offset.x + size > rect.width) {
      offset.x = -size - 20; // Flip to left
    }
    if (cursorPosition.y + offset.y + size > rect.height) {
      offset.y = -size - 20; // Flip to top
    }

    return offset;
  };

  // Render magnified view
  useEffect(() => {
    const magnifierCanvas = magnifierRef.current;
    const mainCanvas = canvasRef.current;
    if (!magnifierCanvas || !mainCanvas) return;

    const ctx = magnifierCanvas.getContext('2d');
    if (!ctx) return;

    console.log('[Magnifier] Updating view at cursor:', cursorPosition);

    // Magnifier dimensions
    const radius = size / 2;

    // Source region to magnify (on main canvas)
    const sourceSize = size / magnification;
    const sourceX = cursorPosition.x - sourceSize / 2;
    const sourceY = cursorPosition.y - sourceSize / 2;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Set circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw magnified region from main canvas
    ctx.drawImage(
      mainCanvas,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size
    );

    ctx.restore();

    // Draw border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Draw crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(radius, size);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, radius);
    ctx.lineTo(size, radius);
    ctx.stroke();
  }, [cursorPosition, magnification, mode, size, canvasRef]);

  // Calculate magnifier position
  const offset = getOffset();
  const position = mode === 'fixed'
    ? { left: 'auto', right: '16px', top: '16px', bottom: 'auto' } // Fixed top-right
    : {
        left: `${cursorPosition.x + offset.x}px`,
        top: `${cursorPosition.y + offset.y}px`,
        right: 'auto',
        bottom: 'auto',
      };

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={position}
    >
      {/* Magnifier canvas */}
      <canvas
        ref={magnifierRef}
        width={size}
        height={size}
        className="rounded-full shadow-2xl"
      />

      {/* Zoom level indicator */}
      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded pointer-events-none">
        {magnification.toFixed(1)}x
      </div>

      {/* Coordinates display */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
        X: {Math.round(cursorPosition.x)}, Y: {Math.round(cursorPosition.y)}
      </div>
    </div>
  );
}
