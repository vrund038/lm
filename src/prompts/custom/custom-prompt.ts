/**
 * Custom Prompt Executor Plugin - Modern v4.2
 * Allows Claude to communicate any task directly to local LLM
 * Provides unlimited capability beyond predefined functions
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { readFileContent } from '../shared/helpers.js';
import { basename } from 'path';

export class CustomPromptExecutor extends BasePlugin implements IPromptPlugin {
  name = 'custom_prompt';
  category = 'custom' as const;
  description = 'Execute any custom prompt with optional file context. Allows Claude to communicate any task directly to local LLM for processing.';
  
  parameters = {
    prompt: {
      type: 'string' as const,
      description: 'The custom prompt/task to send to local LLM',
      required: true
    },
    files: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Optional array of file paths to include as context',
      required: false
    },
    working_directory: {
      type: 'string' as const,
      description: 'Working directory context (defaults to current working directory)',
      required: false
    },
    context: {
      type: 'object' as const,
      description: 'Optional structured context object for the task',
      required: false,
      properties: {
        task_type: { type: 'string' as const },
        requirements: { type: 'array' as const },
        constraints: { type: 'array' as const },
        output_format: { type: 'string' as const }
      }
    },
    max_tokens: {
      type: 'number' as const,
      description: 'Maximum tokens for LLM response (default: 4000)',
      default: 4000,
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // Validate required parameters
        if (!secureParams.prompt || typeof secureParams.prompt !== 'string') {
          throw new Error('Prompt is required and must be a string');
        }

        // Read files if provided - using secure file reading
        const fileContents: Record<string, string> = {};
        if (secureParams.files && Array.isArray(secureParams.files)) {
          for (const filePath of secureParams.files) {
            try {
              // Use secure file reading which includes path validation
              const content = await readFileContent(filePath);
              fileContents[filePath] = content;
            } catch (error: any) {
              // Silently skip files that can't be read - security errors will be thrown by readFileContent
            }
          }
        }

        // Store file contents in params for getPromptStages
        secureParams._fileContents = fileContents;

        // Get model info
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        const model = models[0];
        const contextLength = await model.getContextLength() || 23832;
        
        // Generate 3-stage prompt
        const promptStages = this.getPromptStages(secureParams);
        
        // Determine if chunking is needed
        const promptManager = new ThreeStagePromptManager(contextLength);
        const needsChunking = promptManager.needsChunking(promptStages);
        
        if (needsChunking) {
          return await this.executeWithChunking(promptStages, llmClient, model, promptManager);
        } else {
          return await this.executeDirect(promptStages, llmClient, model);
        }
        
      } catch (error: any) {
        return ResponseFactory.createErrorResponse(
          'custom_prompt',
          'EXECUTION_ERROR',
          `Failed to execute custom prompt: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  // MODERN: 3-stage prompt architecture
  getPromptStages(params: any): PromptStages {
    const { prompt, working_directory, context, _fileContents } = params;
    const fileContents: Record<string, string> = _fileContents || {};
    
    // STAGE 1: System and Context
    let systemAndContext = 'You are a helpful AI assistant executing a custom task.';
    
    if (working_directory) {
      systemAndContext += `\n\nWorking Directory: ${working_directory}`;
    }
    
    if (context) {
      systemAndContext += '\n\nContext:';
      if (context.task_type) systemAndContext += `\n- Task Type: ${context.task_type}`;
      if (context.requirements) systemAndContext += `\n- Requirements: ${context.requirements.join(', ')}`;
      if (context.constraints) systemAndContext += `\n- Constraints: ${context.constraints.join(', ')}`;
      if (context.output_format) systemAndContext += `\n- Output Format: ${context.output_format}`;
    }
    
    // STAGE 2: Data Payload (files)
    let dataPayload = '';
    if (Object.keys(fileContents).length > 0) {
      dataPayload = 'Files for context:\n';
      for (const [filePath, content] of Object.entries(fileContents)) {
        const fileName = basename(filePath);
        dataPayload += `\n${'='.repeat(60)}\nFile: ${fileName}\nPath: ${filePath}\n${'='.repeat(60)}\n${content}\n`;
      }
    } else {
      dataPayload = 'No files provided for context.';
    }
    
    // STAGE 3: Task Instructions
    const outputInstructions = `Task to execute:\n${prompt}\n\nProvide clear, actionable results that directly address the task requirements.`;
    
    return {
      systemAndContext,
      dataPayload, 
      outputInstructions
    };
  }

  // MODERN: Direct execution for small operations
  private async executeDirect(stages: PromptStages, llmClient: any, model: any) {
    const messages = [
      {
        role: 'system',
        content: stages.systemAndContext
      },
      {
        role: 'user',
        content: stages.dataPayload
      },
      {
        role: 'user',
        content: stages.outputInstructions
      }
    ];

    const prediction = model.respond(messages, {
      temperature: 0.1,
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    // MODERN: ResponseFactory integration
    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'custom_prompt',
      response,
      model.identifier || 'unknown'
    );
  }

  // MODERN: Chunked execution for large operations
  private async executeWithChunking(stages: PromptStages, llmClient: any, model: any, promptManager: ThreeStagePromptManager) {
    const conversation = promptManager.createChunkedConversation(stages);
    
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];

    const prediction = model.respond(messages, {
      temperature: 0.1,
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'custom_prompt',
      response,
      model.identifier || 'unknown'
    );
  }
}

export default CustomPromptExecutor;
