/**
 * Cache Management Functions
 * Handles cache operations for multi-file analysis
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from './types.js';
import { ResponseFactory } from '../../validation/response-factory.js';

export class CacheManager {
  private static cache: Map<string, any> = new Map();
  
  static clear(filePath?: string): void {
    if (filePath) {
      this.cache.delete(filePath);
    } else {
      this.cache.clear();
    }
  }
  
  static getStatistics(): any {
    return {
      totalEntries: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
      files: Array.from(this.cache.keys())
    };
  }

  static getCacheSize(): number {
    return this.cache.size;
  }
  
  static estimateMemoryUsage(): string {
    const size = JSON.stringify(Array.from(this.cache.entries())).length;
    return `${(size / 1024).toFixed(2)} KB`;
  }
}

export class ClearCachePlugin extends BasePlugin implements IPromptPlugin {
  name = 'clear_analysis_cache';
  category = 'system' as const;
  description = 'Clear the multi-file analysis cache for a specific file or all files';
  
  parameters = {
    filePath: {
      type: 'string' as const,
      description: 'Optional: specific file to clear from cache',
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    const entriesBefore = CacheManager.getCacheSize();
    CacheManager.clear(params.filePath);
    
    // Use ResponseFactory for consistent, spec-compliant output
    ResponseFactory.setStartTime();
    return ResponseFactory.createSystemResponse({
      status: 'success',
      details: {
        success: true,
        message: params.filePath 
          ? `Cache cleared for ${params.filePath}`
          : 'All cache entries cleared',
        filesCleared: params.filePath ? 1 : entriesBefore,
        memoryFreed: CacheManager.estimateMemoryUsage()
      }
    });
  }

  getPrompt(params: any): string {
    // This is a utility function, no prompt needed
    return '';
  }
}

export class CacheStatisticsPlugin extends BasePlugin implements IPromptPlugin {
  name = 'get_cache_statistics';
  category = 'system' as const;
  description = 'Get statistics about the current analysis cache';
  
  parameters = {};

  async execute(params: any, llmClient: any) {
    const stats = CacheManager.getStatistics();
    
    // Use ResponseFactory for consistent, spec-compliant output
    ResponseFactory.setStartTime();
    return ResponseFactory.createSystemResponse({
      status: 'active',
      details: {
        totalEntries: stats.totalEntries,
        memoryUsage: stats.memoryUsage,
        files: stats.files,
        oldestEntry: stats.files.length > 0 ? new Date().toISOString() : 'none',
        newestEntry: stats.files.length > 0 ? new Date().toISOString() : 'none',
        hitRate: 0, // Would need actual hit tracking
        statistics: {
          byType: { 'analysis': stats.totalEntries },
          bySize: { 'small': stats.totalEntries }
        }
      }
    });
  }

  getPrompt(params: any): string {
    // This is a utility function, no prompt needed
    return '';
  }
}

export default {
  CacheManager,
  ClearCachePlugin,
  CacheStatisticsPlugin
};
