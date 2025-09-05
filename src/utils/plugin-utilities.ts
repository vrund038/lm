/**
 * Plugin Execution Utilities - Modern v4.2
 * 
 * Shared utilities to reduce code duplication across plugins
 * Common patterns for model setup, token calculation, and response processing
 */

import { ResponseFactory } from '../validation/response-factory.js';
import { PromptStages } from '../types/prompt-stages.js';
import { promises as fs } from 'fs';
import { join, extname } from 'path';

/**
 * Model setup and validation utility
 * Handles common model loading and context length detection
 */
export class ModelSetup {
  static async getReadyModel(llmClient: any): Promise<{
    model: any;
    contextLength: number;
  }> {
    const models = await llmClient.llm.listLoaded();
    if (models.length === 0) {
      throw new Error('No model loaded in LM Studio. Please load a model first.');
    }
    
    const model = models[0];
    const contextLength = await model.getContextLength() || 23832;
    
    return { model, contextLength };
  }
}

/**
 * Dynamic token calculation utility
 * Calculates optimal maxTokens based on content size and context window
 * Moved from ThreeStagePromptManager to centralize all context management
 */
export class TokenCalculator {
  /**
   * Estimate token count (moved from ThreeStagePromptManager)
   * Conservative approximation: 3 chars ≈ 1 token (safer than 4)
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 3);
  }

  /**
   * Calculate if stages need chunking based on context length
   * Uses conservative 80% context usage with no additional buffers
   */
  static needsChunking(stages: PromptStages, contextLength: number): boolean {
    const systemTokens = this.estimateTokens(stages.systemAndContext);
    const dataTokens = this.estimateTokens(stages.dataPayload);
    const outputTokens = this.estimateTokens(stages.outputInstructions);
    
    // Conservative: Use 80% of context (built-in safety margin)
    const usableContext = Math.floor(contextLength * 0.80);
    const fixedOverhead = systemTokens + outputTokens;
    const availableForData = Math.max(1000, usableContext - fixedOverhead);
    
    return dataTokens > availableForData;
  }

  /**
   * Calculate optimal chunk size for data payload
   * Uses conservative 80% context usage with no additional buffers
   */
  static calculateOptimalChunkSize(stages: PromptStages, contextLength: number): number {
    const systemTokens = this.estimateTokens(stages.systemAndContext);
    const outputTokens = this.estimateTokens(stages.outputInstructions);
    
    // Conservative: Use 80% of context (built-in safety margin)
    const usableContext = Math.floor(contextLength * 0.80);
    const fixedOverhead = systemTokens + outputTokens;
    const availableForData = Math.max(1000, usableContext - fixedOverhead);
    
    return availableForData;
  }

  /**
   * Calculate optimal maxTokens for single-stage execution
   * Uses conservative 80% context with consistent safety margin
   */
  static calculateForDirect(
    stages: PromptStages, 
    contextLength: number,
    options: {
      minTokens?: number;
    } = {}
  ): number {
    const { minTokens = 1000 } = options;
    
    // Conservative: Use 80% of context (built-in safety margin)
    const usableContext = Math.floor(contextLength * 0.80);
    
    const estimatedInputTokens = this.estimateTokens(stages.systemAndContext) + 
                                this.estimateTokens(stages.dataPayload) +
                                this.estimateTokens(stages.outputInstructions);
    
    const calculatedMaxTokens = Math.max(
      minTokens, 
      usableContext - estimatedInputTokens
    );
    
    return calculatedMaxTokens;
  }

  /**
   * Calculate optimal maxTokens for chunked execution
   * Uses conservative 80% context with consistent safety margin
   */
  static calculateForChunked(
    messages: Array<{ content: string }>, 
    contextLength: number,
    options: {
      minTokens?: number;
    } = {}
  ): number {
    const { minTokens = 1500 } = options;
    
    // Conservative: Use 80% of context (built-in safety margin)
    const usableContext = Math.floor(contextLength * 0.80);
    
    const totalContent = messages.map(m => m.content).join(' ');
    const estimatedInputTokens = this.estimateTokens(totalContent);
    
    const calculatedMaxTokens = Math.max(
      minTokens, 
      usableContext - estimatedInputTokens
    );
    
    return calculatedMaxTokens;
  }

  /**
   * Calculate optimal maxTokens for multi-file analysis
   * Uses conservative 80% context with consistent safety margin
   */
  static calculateForMultiFile(
    messages: Array<{ content: string }>, 
    contextLength: number,
    options: {
      minTokens?: number;
    } = {}
  ): number {
    const { minTokens = 2000 } = options;
    
    // Conservative: Use 80% of context (built-in safety margin)
    const usableContext = Math.floor(contextLength * 0.80);
    
    const totalContent = messages.map(m => m.content).join(' ');
    const estimatedInputTokens = this.estimateTokens(totalContent);
    
    const calculatedMaxTokens = Math.max(
      minTokens, 
      usableContext - estimatedInputTokens
    );
    
    return calculatedMaxTokens;
  }
}

/**
 * LM Studio response processing utility
 * Handles streaming response collection with consistent patterns
 */
export class ResponseProcessor {
  /**
   * Stream and collect response from LM Studio model
   */
  static async collectStreamingResponse(prediction: AsyncIterable<any>): Promise<string> {
    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }
    return response;
  }

  /**
   * Execute direct model call with standard settings
   * Uses consistent 80% context calculation
   */
  static async executeDirect(
    stages: PromptStages,
    model: any,
    contextLength: number,
    functionName: string,
    options: {
      temperature?: number;
    } = {}
  ) {
    const { temperature = 0.1 } = options;
    
    const messages = [
      { role: 'system', content: stages.systemAndContext },
      { role: 'user', content: stages.dataPayload },
      { role: 'user', content: stages.outputInstructions }
    ];

    const maxTokens = TokenCalculator.calculateForDirect(stages, contextLength);

    const prediction = model.respond(messages, {
      temperature,
      maxTokens
    });

    const response = await this.collectStreamingResponse(prediction);

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      functionName as any,
      response,
      model.identifier || 'unknown'
    );
  }

  /**
   * Execute chunked model call with standard settings
   * Uses consistent 80% context calculation
   */
  static async executeChunked(
    messages: Array<{ role: string; content: string }>,
    model: any,
    contextLength: number,
    functionName: string,
    analysisType: 'single' | 'multifile' = 'single',
    options: {
      temperature?: number;
    } = {}
  ) {
    const { temperature = 0.1 } = options;
    
    const maxTokens = analysisType === 'multifile' 
      ? TokenCalculator.calculateForMultiFile(messages, contextLength)
      : TokenCalculator.calculateForChunked(messages, contextLength);

    const prediction = model.respond(messages, {
      temperature,
      maxTokens
    });

    const response = await this.collectStreamingResponse(prediction);

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      functionName as any,
      response,
      model.identifier || 'unknown'
    );
  }
}

/**
 * Common parameter validation utility
 * Standard validation patterns used across plugins
 */
export class ParameterValidator {
  /**
   * Validate code/filePath parameter pattern
   */
  static validateCodeOrFile(params: any, parameterName: string = 'code/filePath'): void {
    if (!params.code && !params.filePath) {
      throw new Error(`Either code or filePath must be provided for ${parameterName}`);
    }
  }

  /**
   * Validate project path for multi-file operations
   */
  static validateProjectPath(params: any): void {
    if (!params.projectPath && !params.files) {
      throw new Error('Either projectPath or files array must be provided');
    }
  }

  /**
   * Validate depth parameter range
   */
  static validateDepth(params: any, min: number = 1, max: number = 5): void {
    if (params.maxDepth && (params.maxDepth < min || params.maxDepth > max)) {
      throw new Error(`maxDepth must be between ${min} and ${max}`);
    }
  }

  /**
   * Validate enum parameter
   */
  static validateEnum(params: any, paramName: string, allowedValues: string[]): void {
    if (params[paramName] && !allowedValues.includes(params[paramName])) {
      throw new Error(`${paramName} must be one of: ${allowedValues.join(', ')}`);
    }
  }
}

/**
 * Error response utility
 * Consistent error handling patterns
 */
export class ErrorHandler {
  /**
   * Create standardized error response
   */
  static createExecutionError(
    functionName: string, 
    error: any, 
    operation: string = 'execute'
  ) {
    return ResponseFactory.createErrorResponse(
      functionName as any,
      'EXECUTION_ERROR',
      `Failed to ${operation}: ${error.message}`,
      { originalError: error.message },
      'unknown'
    );
  }

  /**
   * Create parameter validation error response
   */
  static createValidationError(
    functionName: string, 
    error: any
  ) {
    return ResponseFactory.createErrorResponse(
      functionName as any,
      'VALIDATION_ERROR',
      `Parameter validation failed: ${error.message}`,
      { originalError: error.message },
      'unknown'
    );
  }

  /**
   * Create model error response
   */
  static createModelError(
    functionName: string, 
    error: any
  ) {
    return ResponseFactory.createErrorResponse(
      functionName as any,
      'MODEL_ERROR',
      `Model execution failed: ${error.message}`,
      { originalError: error.message },
      'unknown'
    );
  }
}

/**
 * Multi-file analysis utility
 * Handles file discovery, batching, and processing for cross-file analysis
 */
export class MultiFileAnalysis {
  /**
   * Discover files in a project directory with filtering
   */
  async discoverFiles(
    projectPath: string, 
    extensions: string[], 
    maxDepth: number = 3
  ): Promise<string[]> {
    const files: string[] = [];
    
    async function scanDirectory(dir: string, currentDepth: number) {
      if (currentDepth > maxDepth) return;
      
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDirectory(fullPath, currentDepth + 1);
          } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    }
    
    await scanDirectory(projectPath, 0);
    return files;
  }

  /**
   * Process files in batches with a callback function
   */
  async analyzeBatch<T>(
    files: string[],
    analyzeFunction: (file: string) => Promise<T>,
    contextLength: number,
    batchSize: number = 10
  ): Promise<T[]> {
    const results: T[] = [];
    
    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(file => analyzeFunction(file))
      );
      results.push(...batchResults);
    }
    
    return results;
  }
}