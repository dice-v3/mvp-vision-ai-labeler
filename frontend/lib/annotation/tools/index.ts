/**
 * Annotation Tools Index
 *
 * Export all annotation tools and register them with the ToolRegistry.
 */

import { ToolRegistry } from '../ToolRegistry';
import { bboxTool } from './BBoxTool';
import { polygonTool } from './PolygonTool';
import { classificationTool } from './ClassificationTool';

// Export individual tools
export { bboxTool } from './BBoxTool';
export { polygonTool } from './PolygonTool';
export { classificationTool } from './ClassificationTool';

// Register all tools
export function registerTools(): void {
  ToolRegistry.register(bboxTool);
  ToolRegistry.register(polygonTool);
  ToolRegistry.register(classificationTool);

  // Future tools will be registered here:
  // ToolRegistry.register(keypointsTool);
  // ToolRegistry.register(rotatedBboxTool);
  // ToolRegistry.register(textTool);

  console.log('[Tools] All annotation tools registered');
}

// Auto-register tools on import
registerTools();
