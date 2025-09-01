/**
 * Simplified Custom Prompt Executor - Debug Version
 * 
 * Minimal implementation to isolate the issue causing custom_prompt failures
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';

export class CustomPromptSimple extends BasePlugin implements IPromptPlugin {
  name = 'custom_prompt_debug';
  category = 'custom' as const;
  description = 'Simplified custom prompt executor for debugging';
  
  parameters = {
    prompt: {
      type: 'string' as const,
      description: 'The custom prompt/task to send to local LLM',
      required: true
    },
    working_directory: {
      type: 'string' as const,
      description: 'Working directory context',
      required: false
    }
  };

  constructor() {
    super();
  }

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // Simple validation
        if (!secureParams.prompt || typeof secureParams.prompt !== 'string') {
          throw new Error('Prompt is required and must be a string');
        }

        // Get model
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio');
        }
        
        const model = models[0];
        const contextLength = await model.getContextLength() || 28247;
        
        // Create simple prompt stages
        const promptStages = this.getPromptStages(secureParams);
        
        // Direct execution without chunking for debugging
        const promptManager = new ThreeStagePromptManager(contextLength);
        const maxTokens = Math.min(2000, Math.floor(contextLength * 0.3));
        
        const fullPrompt = `${promptStages.systemAndContext}

${promptStages.dataPayload}

${promptStages.outputInstructions}`;

        // Direct LLM call
        const response = await model.complete(fullPrompt, { maxTokens, temperature: 0.7 });
        
        return {
          success: true,
          timestamp: new Date().toISOString(),
          modelUsed: model.identifier || 'unknown',
          executionTimeMs: 0,
          data: response?.content || response?.text || response || 'No response content'
        };
        
      } catch (error: any) {
        return {
          success: false,
          timestamp: new Date().toISOString(),
          error: error.message || 'Unknown error',
          details: error.stack || 'No stack trace available'
        };
      }
    });
  }

  getPromptStages(params: any): PromptStages {
    const { prompt, working_directory } = params;
    
    const systemAndContext = `You are a helpful AI assistant. Execute the following task with precision and clarity.

Working Directory: ${working_directory || 'Not specified'}
Current Time: ${new Date().toISOString()}

Your task is to provide a helpful, accurate response to the user's request.`;

    const dataPayload = `Ready to execute custom task.`;

    const outputInstructions = `USER REQUEST:

${prompt}

Please provide a clear, helpful response to this request. Be specific, actionable, and thorough in your response.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }
}

export default CustomPromptSimple;
