/**
 * Annotation Hooks
 *
 * Custom React hooks for Canvas component state management.
 * Extracted from Canvas.tsx during Phase 18.3 refactoring.
 *
 * Phase 18.3: Canvas Architecture Refactoring
 *
 * @module annotation/hooks
 */

// Canvas UI state
export * from './useCanvasState';

// Image management and locking
export * from './useImageManagement';

// Tool-specific state
export * from './useToolState';

// Pan/zoom transformation
export * from './useCanvasTransform';

// Annotation sync and conflicts
export * from './useAnnotationSync';

// Magnifier state
export * from './useMagnifier';

// Mouse event handlers
export * from './useMouseHandlers';
