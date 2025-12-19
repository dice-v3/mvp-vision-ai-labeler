/**
 * useMagnifier Hook
 *
 * Manages magnifier state and visibility logic.
 * Handles manual activation (Z key), auto mode, and force-off state.
 *
 * Phase 18.3: Canvas Architecture Refactoring
 * Phase 2.10.2: Magnifier Feature (extracted from Canvas.tsx lines 125-186)
 *
 * @module hooks/useMagnifier
 */

import { useState, useEffect, useMemo } from 'react';

/**
 * Magnifier preferences
 */
export interface MagnifierPreferences {
  autoMagnifier: boolean;
  magnificationLevel: number;
}

/**
 * Hook parameters
 */
export interface UseMagnifierParams {
  preferences: MagnifierPreferences;
  currentTool: string | null;
}

/**
 * Hook return type
 */
export interface UseMagnifierReturn {
  // State
  manualMagnifierActive: boolean;
  setManualMagnifierActive: (active: boolean) => void;
  magnifierForceOff: boolean;
  setMagnifierForceOff: (forceOff: boolean) => void;
  magnification: number;
  setMagnification: (level: number) => void;

  // Computed
  shouldShowMagnifier: boolean;
  isDrawingTool: boolean;
}

/**
 * Check if a tool is a drawing tool
 *
 * @param toolName - Tool name
 * @returns True if tool is a drawing tool
 */
function isDrawingToolFn(toolName: string | null): boolean {
  if (!toolName) return false;
  return ['detection', 'bbox', 'polygon', 'polyline', 'circle', 'circle3p'].includes(toolName);
}

/**
 * Magnifier state management hook
 *
 * Manages magnifier visibility and state:
 * - Manual activation via Z key
 * - Auto mode for drawing tools (based on preferences)
 * - Force-off state (X key to temporarily disable)
 * - Magnification level
 *
 * The magnifier is shown when:
 * - User manually activates it (Z key), OR
 * - Auto mode is enabled AND current tool is a drawing tool
 * AND it's not force-disabled (X key)
 *
 * @param params - Hook parameters
 * @returns Magnifier state and computed values
 *
 * @example
 * ```tsx
 * const {
 *   manualMagnifierActive,
 *   setManualMagnifierActive,
 *   shouldShowMagnifier,
 *   magnification
 * } = useMagnifier({
 *   preferences: { autoMagnifier: true, magnificationLevel: 2 },
 *   currentTool: 'polygon'
 * });
 *
 * // Show magnifier if should be visible
 * {shouldShowMagnifier && (
 *   <Magnifier magnification={magnification} />
 * )}
 *
 * // Toggle manual activation on Z key
 * const handleKeyPress = (e: KeyboardEvent) => {
 *   if (e.key === 'z') {
 *     setManualMagnifierActive(prev => !prev);
 *   }
 * };
 * ```
 */
export function useMagnifier(params: UseMagnifierParams): UseMagnifierReturn {
  const { preferences, currentTool } = params;

  // Magnifier state
  const [manualMagnifierActive, setManualMagnifierActive] = useState(false);
  const [magnifierForceOff, setMagnifierForceOff] = useState(false);
  const [magnification, setMagnification] = useState(preferences.magnificationLevel);

  // Reset magnifier force-off and manual activation when tool changes
  useEffect(() => {
    setMagnifierForceOff(false);
    setManualMagnifierActive(false);
  }, [currentTool]);

  // Update magnification level when preferences change
  useEffect(() => {
    setMagnification(preferences.magnificationLevel);
  }, [preferences.magnificationLevel]);

  // Check if current tool is a drawing tool
  const isDrawingTool = useMemo(
    () => isDrawingToolFn(currentTool),
    [currentTool]
  );

  // Determine if magnifier should be shown
  const shouldShowMagnifier = useMemo(
    () =>
      !magnifierForceOff && ( // Not force disabled by user
        manualMagnifierActive || // Z key pressed
        (isDrawingTool && preferences.autoMagnifier) // Auto mode
      ),
    [magnifierForceOff, manualMagnifierActive, isDrawingTool, preferences.autoMagnifier]
  );

  return {
    // State
    manualMagnifierActive,
    setManualMagnifierActive,
    magnifierForceOff,
    setMagnifierForceOff,
    magnification,
    setMagnification,

    // Computed
    shouldShowMagnifier,
    isDrawingTool,
  };
}
