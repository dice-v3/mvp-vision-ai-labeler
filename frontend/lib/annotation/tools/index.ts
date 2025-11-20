/**
 * Annotation Tools Index
 *
 * Export all annotation tools and register them with the ToolRegistry.
 */

import { ToolRegistry } from '../ToolRegistry';
import { bboxTool } from './BBoxTool';
import { polygonTool } from './PolygonTool';
import { classificationTool } from './ClassificationTool';
import { polylineTool } from './PolylineTool';
import { circleTool } from './CircleTool';
import { circle3pTool } from './Circle3pTool';

// Export individual tools
export { bboxTool } from './BBoxTool';
export { polygonTool } from './PolygonTool';
export { classificationTool } from './ClassificationTool';
export { polylineTool } from './PolylineTool';
export { circleTool } from './CircleTool';
export { circle3pTool } from './Circle3pTool';

// Register all tools
export function registerTools(): void {
  ToolRegistry.register(bboxTool);
  ToolRegistry.register(polygonTool);
  ToolRegistry.register(classificationTool);
  ToolRegistry.register(polylineTool);
  ToolRegistry.register(circleTool);
  ToolRegistry.register(circle3pTool);

  // Future tools will be registered here:
  // ToolRegistry.register(keypointsTool);
  // ToolRegistry.register(rotatedBboxTool);

  console.log('[Tools] All annotation tools registered');
}

// Auto-register tools on import
registerTools();
