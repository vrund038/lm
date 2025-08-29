/**
 * Chunking Strategies - Simple factory for determining chunking approaches
 */

import { ChunkingStrategyType } from '../types/chunking-types.js';

export class ChunkingStrategyFactory {
  /**
   * Get the appropriate chunking strategy for a plugin
   */
  static getStrategy(pluginName: string): ChunkingStrategyType {
    switch (pluginName) {
      case 'find_pattern_usage':
      case 'analyze_project_structure':
        return 'file-based';
      
      case 'compare_integration':
      case 'trace_execution_path':
        return 'semantic';
      
      default:
        return 'token-based';
    }
  }
}
