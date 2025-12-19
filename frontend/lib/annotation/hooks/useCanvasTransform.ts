/**
 * useCanvasTransform Hook
 *
 * Manages pan and zoom gesture state for canvas interaction.
 * Handles local interaction state for pan/zoom operations.
 *
 * Phase 18.3: Canvas Architecture Refactoring
 *
 * @module hooks/useCanvasTransform
 */

import { useState, useCallback } from 'react';

/**
 * Pan gesture state
 */
export interface PanState {
  isPanning: boolean;
  panStart: { x: number; y: number } | null;
}

/**
 * Hook return type
 */
export interface UseCanvasTransformReturn {
  // Pan state
  isPanning: boolean;
  setIsPanning: (panning: boolean) => void;
  panStart: { x: number; y: number } | null;
  setPanStart: (start: { x: number; y: number } | null) => void;

  // Pan actions
  startPan: (x: number, y: number) => void;
  endPan: () => void;
  resetTransformState: () => void;
}

/**
 * Canvas transform state management hook
 *
 * Manages local state for pan/zoom gestures:
 * - Pan gesture tracking (start position, active state)
 * - Zoom gesture tracking (future: pinch-zoom)
 *
 * Note: Actual zoom/pan values are stored in annotationStore.canvas.
 * This hook only manages the interaction state during gestures.
 *
 * @returns Transform state and actions
 *
 * @example
 * ```tsx
 * const {
 *   isPanning,
 *   panStart,
 *   startPan,
 *   endPan
 * } = useCanvasTransform();
 *
 * // Start pan gesture
 * const handleMouseDown = (e: MouseEvent) => {
 *   if (e.button === 1) { // Middle click
 *     startPan(e.clientX, e.clientY);
 *   }
 * };
 *
 * // End pan gesture
 * const handleMouseUp = () => {
 *   if (isPanning) {
 *     endPan();
 *   }
 * };
 * ```
 */
export function useCanvasTransform(): UseCanvasTransformReturn {
  // Pan gesture state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

  /**
   * Start pan gesture
   *
   * @param x - Starting X coordinate (screen)
   * @param y - Starting Y coordinate (screen)
   */
  const startPan = useCallback((x: number, y: number) => {
    setIsPanning(true);
    setPanStart({ x, y });
  }, []);

  /**
   * End pan gesture
   */
  const endPan = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  /**
   * Reset all transform state
   */
  const resetTransformState = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  return {
    // Pan state
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,

    // Pan actions
    startPan,
    endPan,
    resetTransformState,
  };
}
