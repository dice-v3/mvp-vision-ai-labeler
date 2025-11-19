/**
 * Tool Registry
 *
 * Manages annotation tools registration and retrieval.
 * Tools are registered by type and can be retrieved based on task type.
 */

import { IAnnotationTool } from './AnnotationTool';

class ToolRegistryClass {
  private tools: Map<string, IAnnotationTool> = new Map();
  private toolsByTask: Map<string, string[]> = new Map();

  /**
   * Register a tool
   */
  register(tool: IAnnotationTool): void {
    this.tools.set(tool.type, tool);

    // Index by supported tasks
    for (const task of tool.supportedTasks) {
      const taskTools = this.toolsByTask.get(task) || [];
      if (!taskTools.includes(tool.type)) {
        taskTools.push(tool.type);
        this.toolsByTask.set(task, taskTools);
      }
    }

    console.log(`[ToolRegistry] Registered tool: ${tool.name} (${tool.type})`);
  }

  /**
   * Get tool by type
   */
  getTool(type: string): IAnnotationTool | undefined {
    return this.tools.get(type);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): IAnnotationTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools available for a task type
   */
  getToolsForTask(taskType: string): IAnnotationTool[] {
    const toolTypes = this.toolsByTask.get(taskType) || [];
    return toolTypes
      .map(type => this.tools.get(type))
      .filter((tool): tool is IAnnotationTool => tool !== undefined);
  }

  /**
   * Get tool types available for a task
   */
  getToolTypesForTask(taskType: string): string[] {
    return this.toolsByTask.get(taskType) || [];
  }

  /**
   * Check if a tool type is available for a task
   */
  isToolAvailableForTask(toolType: string, taskType: string): boolean {
    const tool = this.tools.get(toolType);
    return tool?.supportedTasks.includes(taskType) ?? false;
  }

  /**
   * Get tool by shortcut key
   */
  getToolByShortcut(shortcut: string): IAnnotationTool | undefined {
    for (const tool of this.tools.values()) {
      if (tool.shortcut.toLowerCase() === shortcut.toLowerCase()) {
        return tool;
      }
    }
    return undefined;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.toolsByTask.clear();
  }
}

// Singleton instance
export const ToolRegistry = new ToolRegistryClass();

// Export type for use in components
export type { IAnnotationTool };
