/**
 * 3-Stage Prompt Manager
 * Handles the breakdown of prompts into managed stages for optimal context usage
 */

import { PromptStages, ChunkedConversation } from '../types/prompt-stages.js';

export class ThreeStagePromptManager {
  constructor() {
    // No context-related state needed - moved to TokenCalculator
  }

  /**
   * Split data payload into chunks of specified size
   * Now receives chunk size from TokenCalculator
   */
  chunkDataPayload(dataPayload: string, maxChunkSize: number): string[] {
    // Convert tokens to chars for character-based chunking
    const maxCharsPerChunk = maxChunkSize * 4;
    
    if (dataPayload.length <= maxCharsPerChunk) {
      return [dataPayload];
    }

    const chunks: string[] = [];
    
    // Try to break at natural boundaries (sections)
    const sections = dataPayload.split('\n' + '='.repeat(80) + '\n');
    if (sections.length > 1) {
      // Break by file sections if available
      let currentChunk = '';
      
      for (const section of sections) {
        const sectionWithSeparator = section + '\n' + '='.repeat(80) + '\n';
        const combinedLength = currentChunk.length + sectionWithSeparator.length;
        
        if (combinedLength <= maxCharsPerChunk && currentChunk.length > 0) {
          currentChunk += sectionWithSeparator;
        } else {
          if (currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
          }
          
          // If single section is too large, split it
          if (section.length > maxCharsPerChunk) {
            const subChunks = this.splitLargeSection(section, maxCharsPerChunk);
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
      for (let i = 0; i < dataPayload.length; i += maxCharsPerChunk) {
        chunks.push(dataPayload.slice(i, i + maxCharsPerChunk));
      }
    }
    
    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  /**
   * Split a large section that doesn't fit in one chunk
   */
  private splitLargeSection(section: string, maxChars: number): string[] {
    const chunks: string[] = [];
    
    // Try to split by lines first
    const lines = section.split('\n');
    let currentChunk = '';
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 <= maxChars) {
        currentChunk += (currentChunk ? '\n' : '') + line;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = line;
        } else {
          // Line itself is too long, force split
          chunks.push(line.slice(0, maxChars));
          currentChunk = line.slice(maxChars);
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
   * Now receives pre-calculated chunks from TokenCalculator
   */
  createChunkedConversation(stages: PromptStages, dataChunks: string[]): ChunkedConversation {
    // System message (Stage 1)
    const systemMessage = {
      role: 'system' as const,
      content: stages.systemAndContext
    };

    // Data messages (Stage 2 - pre-chunked)
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

}
