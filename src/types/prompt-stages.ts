/**
 * 3-Stage Prompt Architecture Types
 * Enables clean separation of system context, data payload, and output instructions
 */

export interface PromptStages {
  /** Stage 1: System instructions and task context */
  systemAndContext: string;
  
  /** Stage 2: Data payload (gets chunked when needed) */
  dataPayload: string;
  
  /** Stage 3: Output format instructions and analysis tasks */
  outputInstructions: string;
}

export interface ChunkedConversation {
  /** System message with context */
  systemMessage: {
    role: 'system';
    content: string;
  };
  
  /** Data messages (one per chunk) */
  dataMessages: Array<{
    role: 'user';
    content: string;
  }>;
  
  /** Final analysis request */
  analysisMessage: {
    role: 'user';
    content: string;
  };
}
