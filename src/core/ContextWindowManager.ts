/**
 * Context Window Manager - Core chunking functionality for large operations
 * 
 * This class provides intelligent context window management and chunking
 * for operations that exceed the model's context window limits.
 */

import { 
  HealthCheckResult, 
  ChunkingStrategyType,
  Chunk,
  ContextWindowConfig,
  PluginExecutionContext,
  ChunkingError
} from '../types/chunking-types.js';

import { TokenEstimator } from './TokenEstimator.js';
import { ChunkingStrategyFactory } from './ChunkingStrategies.js';

export class ContextWindowManager {
  private contextLimit: number = 23000; // Default from observed testing
  private safetyMargin: number = 0.8; // Use 80% of available context
  private tokenEstimator: TokenEstimator;
  
  constructor(config: ContextWindowConfig) {
    this.contextLimit = config.contextLimit;
    this.safetyMargin = config.safetyMargin;
    this.tokenEstimator = new TokenEstimator({
      contextLimit: this.contextLimit,
      estimationFactor: 1.2
    });
  }

  /**
   * Estimate token count for given parameters
   */
  estimateTokens(params: any, pluginName: string): number {
    return this.tokenEstimator.estimateTokens(params, pluginName);
  }

  /**
   * Check if chunking is needed based on estimated tokens
   */
  shouldChunk(estimatedTokens: number, pluginName: string): boolean {
    const effectiveLimit = this.contextLimit * this.safetyMargin;
    return estimatedTokens > effectiveLimit;
  }

  /**
   * Execute a plugin with chunking if needed
   */
  async executeWithChunking(plugin: any, params: any, llmClient: any): Promise<any> {
    const startTime = Date.now();
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Estimate tokens for the operation
      const estimatedTokens = this.estimateTokens(params, plugin.name);
      
      // Determine if chunking is actually needed
      if (!this.shouldChunk(estimatedTokens, plugin.name)) {
        // Execute normally without chunking
        return await plugin.execute(params, llmClient);
      }

      // Execute with chunking
      return await this.executeChunkedOperation(plugin, params, llmClient);
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute operation using chunking strategy
   */
  private async executeChunkedOperation(
    plugin: any, 
    params: any, 
    llmClient: any
  ): Promise<any> {
    // Get appropriate chunking strategy for this plugin
    const strategy = ChunkingStrategyFactory.getStrategy(plugin.name);
    
    // Create chunks using the determined strategy
    const chunks = await this.createChunks(params, plugin.name);
    
    // Process each chunk
    const chunkResults: any[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Execute plugin with chunk parameters
        const chunkParams = this.prepareChunkParams(params, chunk, i, chunks.length);
        const chunkResult = await plugin.execute(chunkParams, llmClient);
        
        chunkResults.push({
          chunkIndex: i,
          success: true,
          result: chunkResult
        });
        
      } catch (error) {
        chunkResults.push({
          chunkIndex: i,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Combine results from all chunks
    return this.combineChunkResults(chunkResults, params, plugin.name);
  }

  /**
   * Create chunks based on the chunking strategy
   */
  private async createChunks(params: any, pluginName: string): Promise<Chunk[]> {
    const strategy = ChunkingStrategyFactory.getStrategy(pluginName);
    
    // For most plugins, we'll use a simple approach
    // This can be enhanced with more sophisticated strategies later
    if (pluginName === 'find_pattern_usage' && params.projectPath) {
      // File-based chunking for find_pattern_usage
      const fs = await import('fs');
      const path = await import('path');
      
      const files = this.getAllCodeFiles(params.projectPath);
      const chunkSize = Math.max(1, Math.floor(files.length / 4)); // 4 chunks
      const chunks: Chunk[] = [];
      
      for (let i = 0; i < files.length; i += chunkSize) {
        chunks.push({
          id: `chunk-${i / chunkSize}`,
          data: files.slice(i, i + chunkSize),
          metadata: {
            startIndex: i,
            endIndex: Math.min(i + chunkSize, files.length),
            totalFiles: files.length
          }
        });
      }
      
      return chunks;
    }
    
    // Default chunking strategy - simple split
    return [{
      id: 'chunk-0',
      data: params,
      metadata: { isDefault: true }
    }];
  }

  /**
   * Get all code files from a directory
   */
  private getAllCodeFiles(projectPath: string): string[] {
    const fs = require('fs');
    const path = require('path');
    
    const files: string[] = [];
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.php', '.java', '.cs', '.cpp', '.c', '.go', '.rs'];
    
    const traverse = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir);
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            // Skip common non-source directories
            const skipDirs = ['node_modules', '.git', 'vendor', 'dist', 'build', '.next'];
            if (!skipDirs.includes(entry)) {
              traverse(fullPath);
            }
          } else if (stat.isFile()) {
            const ext = path.extname(entry).toLowerCase();
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };
    
    traverse(projectPath);
    return files;
  }

  /**
   * Prepare parameters for a specific chunk
   */
  private prepareChunkParams(originalParams: any, chunk: Chunk, chunkIndex: number, totalChunks: number): any {
    return {
      ...originalParams,
      _chunk: {
        index: chunkIndex,
        total: totalChunks,
        data: chunk.data,
        metadata: chunk.metadata
      }
    };
  }

  /**
   * Combine results from multiple chunks
   */
  private combineChunkResults(chunkResults: any[], originalParams: any, pluginName: string): any {
    const successful = chunkResults.filter(r => r.success);
    const failed = chunkResults.filter(r => !r.success);
    
    if (successful.length === 0) {
      throw new Error(`All ${chunkResults.length} chunks failed to process`);
    }
    
    // Plugin-specific result combination
    if (pluginName === 'find_pattern_usage') {
      return {
        summary: {
          totalChunks: chunkResults.length,
          successfulChunks: successful.length,
          failedChunks: failed.length
        },
        results: successful.map(r => r.result),
        errors: failed.map(r => ({
          chunkIndex: r.chunkIndex,
          error: r.error
        }))
      };
    }
    
    // Default combination - just return all successful results
    return {
      chunkResults: successful.map(r => r.result),
      summary: {
        totalChunks: chunkResults.length,
        successful: successful.length,
        failed: failed.length
      },
      errors: failed.length > 0 ? failed.map(r => r.error) : undefined
    };
  }

  /**
   * Get current context limit
   */
  async getContextLimit(): Promise<number> {
    return this.contextLimit;
  }
}
