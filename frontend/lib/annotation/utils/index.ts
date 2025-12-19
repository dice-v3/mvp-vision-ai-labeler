/**
 * Annotation Utility Functions
 *
 * Pure utility functions extracted from Canvas.tsx for:
 * - Coordinate transformations (screen ↔ canvas ↔ image)
 * - Geometry calculations (distance, intersection, area)
 * - Canvas rendering (grid, handles, badges)
 * - Annotation data transformations
 *
 * Phase 18.2: Canvas Architecture Refactoring
 *
 * @module annotation/utils
 */

// Coordinate transformation functions
export * from './coordinateTransform';

// Geometry helper functions
export * from './geometryHelpers';

// Rendering helper functions
export * from './renderHelpers';

// Annotation helper functions
export * from './annotationHelpers';
