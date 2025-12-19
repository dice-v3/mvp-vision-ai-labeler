/**
 * useCanvasState Hook
 *
 * Manages local UI state for the Canvas component.
 * Consolidates simple useState declarations that don't require complex logic.
 *
 * Phase 18.3: Canvas Architecture Refactoring
 *
 * @module hooks/useCanvasState
 */

import { useState, useCallback } from 'react';

/**
 * Canvas UI state
 */
export interface CanvasUIState {
  // Class selector modal
  showClassSelector: boolean;

  // Cursor state
  canvasCursor: string;
  cursorPos: { x: number; y: number };

  // Batch operations
  batchProgress: { current: number; total: number } | null;
}

/**
 * Hook return type
 */
export interface UseCanvasStateReturn {
  // Class selector
  showClassSelector: boolean;
  setShowClassSelector: (show: boolean) => void;

  // Cursor
  canvasCursor: string;
  setCanvasCursor: (cursor: string) => void;
  cursorPos: { x: number; y: number };
  setCursorPos: (pos: { x: number; y: number }) => void;

  // Batch progress
  batchProgress: { current: number; total: number } | null;
  setBatchProgress: (progress: { current: number; total: number } | null) => void;

  // Reset all state
  resetState: () => void;
}

/**
 * Canvas UI state management hook
 *
 * Manages simple local state for Canvas UI elements:
 * - Class selector modal visibility
 * - Cursor style and position
 * - Batch operation progress
 *
 * @returns Canvas state and setters
 *
 * @example
 * ```tsx
 * const {
 *   showClassSelector,
 *   setShowClassSelector,
 *   canvasCursor,
 *   setCanvasCursor
 * } = useCanvasState();
 *
 * // Show class selector
 * setShowClassSelector(true);
 *
 * // Update cursor
 * setCanvasCursor('crosshair');
 * ```
 */
export function useCanvasState(): UseCanvasStateReturn {
  // Class selector modal
  const [showClassSelector, setShowClassSelector] = useState(false);

  // Cursor state
  const [canvasCursor, setCanvasCursor] = useState('default');
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Batch operation progress
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  /**
   * Reset all state to initial values
   */
  const resetState = useCallback(() => {
    setShowClassSelector(false);
    setCanvasCursor('default');
    setCursorPos({ x: 0, y: 0 });
    setBatchProgress(null);
  }, []);

  return {
    // Class selector
    showClassSelector,
    setShowClassSelector,

    // Cursor
    canvasCursor,
    setCanvasCursor,
    cursorPos,
    setCursorPos,

    // Batch progress
    batchProgress,
    setBatchProgress,

    // Reset
    resetState,
  };
}
