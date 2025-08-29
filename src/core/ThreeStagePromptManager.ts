/**
 * 3-Stage Prompt Manager
 * Handles the breakdown of prompts into managed stages for optimal context usage
 */

import { PromptStages, StageMetrics, ChunkedConversation } from '../types/prompt-stages.js';

export class ThreeStagePromptManager {
  private contextLimit: number;
  private safetyMargin: number = 0.8;

  constructor(contextLimit: number, safetyMargin: number = 0.8) {
    this.contextLimit = contextLimit;
    this.safetyMargin = safetyMargin;
  }

  /**
   * Estimate token count (rough approximation: 4 chars ≈ 1 token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Calculate stage metrics to determine available space for data
   */
  calculateStageMetrics(stages: PromptStages): StageMetrics {
    const systemTokens = this.estimateTokens(stages.systemAndContext);
    const dataTokens = this.estimateTokens(stages.dataPayload);
    const outputTokens = this.estimateTokens(stages.outputInstructions);
    
    const fixedOverhead = systemTokens + outputTokens;
    const effectiveLimit = this.contextLimit * this.safetyMargin;
    const availableForData = Math.max(0, effectiveLimit - fixedOverhead);

    return {
      systemTokens,
      dataTokens,
      outputTokens,
      fixedOverhead,
      availableForData
    };
  }

  /**
   * Check if data payload needs chunking
   */
  needsChunking(stages: PromptStages): boolean {
    const metrics = this.calculateStageMetrics(stages);
    return metrics.dataTokens > metrics.availableForData;
  }

  /**
   * Split data payload into appropriately sized chunks
   */
  chunkDataPayload(dataPayload: string, availableTokens: number): string[] {
    const dataTokens = this.estimateTokens(dataPayload);
    
    if (dataTokens <= availableTokens) {
      return [dataPayload];
    }

    // Calculate number of chunks needed
    const chunksNeeded = Math.ceil(dataTokens / availableTokens);
    const charsPerChunk = Math.floor(dataPayload.length / chunksNeeded);
    
    const chunks: string[] = [];
    
    // Try to break at natural boundaries (lines, sections)
    const sections = dataPayload.split('\n' + '='.repeat(80) + '\n');
    
    if (sections.length > 1) {
      // Break by file sections if available
      let currentChunk = '';
      
      for (const section of sections) {
        const sectionWithSeparator = section + '\n' + '='.repeat(80) + '\n';
        const combinedSize = this.estimateTokens(currentChunk + sectionWithSeparator);
        
        if (combinedSize <= availableTokens && currentChunk.length > 0) {
          currentChunk += sectionWithSeparator;
        } else {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
          
          // If single section is too large, split it
          if (this.estimateTokens(section) > availableTokens) {
            const subChunks = this.splitLargeSection(section, availableTokens);
            chunks.push(...subChunks);
          } else {
            currentChunk = sectionWithSeparator;
          }
        }
      }
      
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }
    } else {
      // Simple character-based splitting as fallback
      for (let i = 0; i < dataPayload.length; i += charsPerChunk) {
        chunks.push(dataPayload.slice(i, i + charsPerChunk));
      }
    }
    
    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  /**
   * Split a large section that doesn't fit in one chunk
   */
  private splitLargeSection(section: string, availableTokens: number): string[] {
    const targetChars = availableTokens * 4; // Rough char estimate
    const chunks: string[] = [];
    
    // Try to split by lines first
    const lines = section.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 <= targetChars) {
        currentChunk += (currentChunk ? '\n' : '') + line;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          // Line itself is too long, force split
          chunks.push(line.slice(0, targetChars));
          currentChunk = line.slice(targetChars);
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }

  /**
   * Create a chunked conversation from prompt stages
   */
  createChunkedConversation(stages: PromptStages): ChunkedConversation {
    const metrics = this.calculateStageMetrics(stages);
    
    // System message (Stage 1)
    const systemMessage = {
      role: 'system' as const,
      content: stages.systemAndContext
    };

    // Data messages (Stage 2 - chunked if needed)
    let dataChunks: string[];
    
    if (this.needsChunking(stages)) {
      dataChunks = this.chunkDataPayload(stages.dataPayload, metrics.availableForData);
    } else {
      dataChunks = [stages.dataPayload];
    }

    const dataMessages = dataChunks.map((chunk, index) => ({
      role: 'user' as const,
      content: dataChunks.length > 1 
        ? `Data chunk ${index + 1}/${dataChunks.length}:\n\n${chunk}`
        : `Data to analyze:\n\n${chunk}`
    }));

    // Analysis message (Stage 3)
    const analysisMessage = {
      role: 'user' as const,
      content: dataChunks.length > 1
        ? `${stages.outputInstructions}\n\nAnalyze all ${dataChunks.length} data chunks provided above.`
        : stages.outputInstructions
    };

    return {
      systemMessage,
      dataMessages,
      analysisMessage
    };
  }

  /**
   * Get metrics for debugging/logging
   */
  getDebugInfo(stages: PromptStages): any {
    const metrics = this.calculateStageMetrics(stages);
    const needsChunking = this.needsChunking(stages);
    
    return {
      contextLimit: this.contextLimit,
      effectiveLimit: this.contextLimit * this.safetyMargin,
      metrics,
      needsChunking,
      chunksNeeded: needsChunking 
        ? Math.ceil(metrics.dataTokens / metrics.availableForData)
        : 1
    };
  }
}
