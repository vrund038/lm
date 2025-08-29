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
  private contextLimit: number = 4096; // Conservative default, will be updated dynamically
  private safetyMargin: number = 0.8; // Use 80% of available context
  private tokenEstimator: TokenEstimator;
  private isContextLimitDetected: boolean = false;
  
  constructor(config: ContextWindowConfig) {
    // Use provided config limit if available, otherwise use conservative default
    this.contextLimit = config.contextLimit || 4096;
    this.safetyMargin = config.safetyMargin;
    this.tokenEstimator = new TokenEstimator({
      contextLimit: this.contextLimit,
      estimationFactor: 1.2
    });
  }

  /**
   * Dynamically detect and update context limit from LM Studio
   */
  async detectContextLimit(): Promise<number> {
    try {
      const { LMStudioClient } = await import('@lmstudio/sdk');
      const { config } = await import('../config.js');
      
      const client = new LMStudioClient({
        baseUrl: config.lmStudioUrl || 'ws://localhost:1234',
      });

      const models = await client.llm.listLoaded();
      
      if (models.length > 0) {
        const activeModel = models[0];
        try {
          const contextLength = await activeModel.getContextLength();
          if (contextLength && contextLength > 0) {
            this.contextLimit = contextLength;
            this.isContextLimitDetected = true;
            
            // Update token estimator with new context limit
            this.tokenEstimator = new TokenEstimator({
              contextLimit: this.contextLimit,
              estimationFactor: 1.2
            });
            
            return this.contextLimit;
          }
        } catch (error) {
          console.warn('Could not retrieve context length from model, using default:', error);
        }
      }
      
      // If detection fails, keep existing limit
      return this.contextLimit;
    } catch (error) {
      console.warn('Failed to detect context limit from LM Studio:', error);
      return this.contextLimit;
    }
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
      // Detect actual context limit from LM Studio if not already done
      if (!this.isContextLimitDetected) {
        await this.detectContextLimit();
      }
      
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
    
    // Calculate target chunk size based on detected context limit
    const effectiveLimit = this.contextLimit * this.safetyMargin;
    const targetChunkSize = Math.floor(effectiveLimit * 0.7); // Leave room for prompt overhead
    
    // For most plugins, we'll use a simple approach
    // This can be enhanced with more sophisticated strategies later
    if (pluginName === 'find_pattern_usage' && params.projectPath) {
      // File-based chunking for find_pattern_usage
      const fs = await import('fs');
      const path = await import('path');
      
      const files = await this.getAllCodeFiles(params.projectPath);
      
      // Estimate tokens per file to determine appropriate chunk size
      let totalEstimatedTokens = 0;
      for (const file of files) {
        try {
          // Use secure file reading helper
          const { readFileContent } = await import('../prompts/shared/helpers.js');
          const content = await readFileContent(file);
          totalEstimatedTokens += this.tokenEstimator.estimateTokens(content);
        } catch (error) {
          // Skip files that can't be read, use average estimation
          totalEstimatedTokens += 500; // Average file size estimation
        }
      }
      
      // Calculate number of chunks needed based on target chunk size
      const chunksNeeded = Math.max(1, Math.ceil(totalEstimatedTokens / targetChunkSize));
      const filesPerChunk = Math.max(1, Math.ceil(files.length / chunksNeeded));
      
      const chunks: Chunk[] = [];
      
      for (let i = 0; i < files.length; i += filesPerChunk) {
        chunks.push({
          id: `chunk-${Math.floor(i / filesPerChunk)}`,
          data: files.slice(i, i + filesPerChunk),
          metadata: {
            startIndex: i,
            endIndex: Math.min(i + filesPerChunk, files.length),
            totalFiles: files.length,
            estimatedTokens: targetChunkSize // Rough estimate
          }
        });
      }
      
      return chunks;
    }
    
    // Default chunking strategy - simple split
    return [{
      id: 'chunk-0',
      data: params,
      metadata: { isDefault: true, estimatedTokens: targetChunkSize }
    }];
  }

  /**
   * Get all code files from a directory
   */
  private async getAllCodeFiles(projectPath: string): Promise<string[]> {
    const fs = await import('fs');
    const path = await import('path');
    
    // SECURITY: Validate project path before proceeding
    const { validateAndNormalizePath } = await import('../prompts/shared/helpers.js');
    const validatedProjectPath = await validateAndNormalizePath(projectPath);
    
    const files: string[] = [];
    const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.php', '.java', '.cs', '.cpp', '.c', '.go', '.rs'];
    
    const traverse = async (dir: string) => {
      try {
        // Validate each directory before reading
        const validatedDir = await validateAndNormalizePath(dir);
        const entries = fs.readdirSync(validatedDir);
        
        for (const entry of entries) {
          const fullPath = path.join(validatedDir, entry);
          
          // Validate the full path before stat
          try {
            const validatedFullPath = await validateAndNormalizePath(fullPath);
            const stat = fs.statSync(validatedFullPath);
            
            if (stat.isDirectory()) {
              // Skip common non-source directories
              const skipDirs = ['node_modules', '.git', 'vendor', 'dist', 'build', '.next'];
              if (!skipDirs.includes(entry)) {
                await traverse(validatedFullPath);
              }
            } else if (stat.isFile()) {
              const ext = path.extname(entry).toLowerCase();
              if (extensions.includes(ext)) {
                files.push(validatedFullPath);
              }
            }
          } catch (pathError) {
            // Skip paths that fail validation
            continue;
          }
        }
      } catch (error) {
        // Skip directories that can't be read or validated
      }
    };
    
    await traverse(validatedProjectPath);
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
    // Ensure we have the latest context limit
    if (!this.isContextLimitDetected) {
      await this.detectContextLimit();
    }
    return this.contextLimit;
  }

  /**
   * Get context limit detection status
   */
  isContextLimitDynamic(): boolean {
    return this.isContextLimitDetected;
  }

  /**
   * Get effective context limit (with safety margin applied)
   */
  getEffectiveContextLimit(): number {
    return Math.floor(this.contextLimit * this.safetyMargin);
  }
}
