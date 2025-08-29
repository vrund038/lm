/**
 * Custom Prompt Executor Plugin
 * Allows Claude to communicate any task directly to local LLM
 * Provides unlimited capability beyond predefined functions
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { readFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';

export class CustomPromptExecutor extends BasePlugin implements IPromptPlugin {
  name = 'custom_prompt';
  category = 'multifile' as const;
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
    try {
      // Validate required parameters
      if (!params.prompt || typeof params.prompt !== 'string') {
        throw new Error('Prompt is required and must be a string');
      }

      // Read files if provided
      const fileContents: Record<string, string> = {};
      if (params.files && Array.isArray(params.files)) {
        for (const filePath of params.files) {
          try {
            const resolvedPath = resolve(filePath);
            if (!this.isPathSafe(resolvedPath)) {
              console.warn(`Skipping unsafe path: ${filePath}`);
              continue;
            }
            if (existsSync(resolvedPath)) {
              fileContents[filePath] = readFileSync(resolvedPath, 'utf-8');
            }
          } catch (error: any) {
            console.warn(`Could not read file ${filePath}: ${error.message}`);
          }
        }
      }

      // Get model info
      const models = await llmClient.llm.listLoaded();
      if (models.length === 0) {
        throw new Error('No model loaded in LM Studio. Please load a model first.');
      }
      
      const model = models[0];
      
      // Build comprehensive prompt with context
      const fullPrompt = this.buildFullPrompt(params, fileContents);
      
      // Execute with 3-stage architecture for large content
      const contextLength = await model.getContextLength() || 23832;
      const estimatedTokens = Math.floor(fullPrompt.length / 4);
      
      if (estimatedTokens > contextLength * 0.8) {
        return await this.executeWithChunking(params, fileContents, llmClient, model);
      } else {
        return await this.executeDirect(fullPrompt, llmClient, model, params);
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
  }

  private buildFullPrompt(params: any, fileContents: Record<string, string>): string {
    const { prompt, working_directory, context } = params;
    
    let fullPrompt = '';
    
    // Add working directory context if provided
    if (working_directory) {
      fullPrompt += `Working Directory: ${working_directory}\n\n`;
    }
    
    // Add structured context if provided
    if (context) {
      fullPrompt += 'Context:\n';
      if (context.task_type) fullPrompt += `- Task Type: ${context.task_type}\n`;
      if (context.requirements) fullPrompt += `- Requirements: ${context.requirements.join(', ')}\n`;
      if (context.constraints) fullPrompt += `- Constraints: ${context.constraints.join(', ')}\n`;
      if (context.output_format) fullPrompt += `- Output Format: ${context.output_format}\n`;
      fullPrompt += '\n';
    }
    
    // Add the main prompt
    fullPrompt += `Task:\n${prompt}\n\n`;
    
    // Add file contents if provided
    if (Object.keys(fileContents).length > 0) {
      fullPrompt += 'Files for context:\n';
      for (const [filePath, content] of Object.entries(fileContents)) {
        const fileName = basename(filePath);
        fullPrompt += `\n${'='.repeat(60)}\nFile: ${fileName}\nPath: ${filePath}\n${'='.repeat(60)}\n${content}\n`;
      }
    }
    
    return fullPrompt;
  }

  private async executeDirect(prompt: string, llmClient: any, model: any, params: any) {
    const prediction = model.respond([
      {
        role: 'system',
        content: 'You are a helpful AI assistant. Execute the requested task precisely and provide clear, actionable results.'
      },
      {
        role: 'user',
        content: prompt
      }
    ], {
      temperature: 0.1,
      maxTokens: params.max_tokens || 4000
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

  /**
   * Legacy getPrompt method for BasePlugin compatibility
   */
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params, {});
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }

  private async executeWithChunking(params: any, fileContents: Record<string, string>, llmClient: any, model: any) {
    // For large content, use 3-stage prompt manager
    const promptStages = this.getPromptStages(params, fileContents);
    
    const contextLength = await model.getContextLength();
    const promptManager = new ThreeStagePromptManager(contextLength || 23832);
    
    const conversation = promptManager.createChunkedConversation(promptStages);
    
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];
    
    const prediction = model.respond(messages, {
      temperature: 0.1,
      maxTokens: params.max_tokens || 4000
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

  getPromptStages(params: any, fileContents: Record<string, string>): PromptStages {
    const { prompt, working_directory, context } = params;
    
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

  private isPathSafe(path: string): boolean {
    const suspicious = ['../', '..\\', '/etc/', '\\etc\\', '/root/', '\\root\\'];
    const normalizedPath = path.toLowerCase();
    return !suspicious.some(pattern => normalizedPath.includes(pattern));
  }
}

export default CustomPromptExecutor;