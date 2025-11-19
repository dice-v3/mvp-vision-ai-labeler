/**
 * Annotation Module Index
 *
 * Main entry point for the annotation tool system.
 */

// Export types and interfaces
export type {
  IAnnotationTool,
  CanvasMouseEvent,
  CanvasRenderContext,
  ToolState,
  ToolOperationResult,
  HandlePosition,
  AnnotationGeometry,
  BBoxGeometry,
  RotatedBBoxGeometry,
  PolygonGeometry,
  ClassificationGeometry,
  KeypointsGeometry,
  TextGeometry,
} from './AnnotationTool';

export { BaseAnnotationTool } from './AnnotationTool';

// Export registry
export { ToolRegistry } from './ToolRegistry';

// Export and register tools
export * from './tools';
