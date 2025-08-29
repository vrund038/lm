/**
 * Health Check Plugin
 * Checks if LM Studio is running and responding
 */

import { BasePlugin } from '../plugins/base-plugin.js';
import { IPromptPlugin } from '../prompts/shared/types.js';
import { ResponseFactory } from '../validation/response-factory.js';
import { LMStudioClient } from '@lmstudio/sdk';
import { config } from '../config.js';

export class HealthCheckPlugin extends BasePlugin implements IPromptPlugin {
  name = 'health_check';
  category = 'system' as const;
  description = 'Check if LM Studio is running and responding';
  
  parameters = {
    detailed: {
      type: 'boolean' as const,
      description: 'Include detailed information about the loaded model and server status',
      default: false,
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    try {
      const client = new LMStudioClient({
        baseUrl: config.lmStudioUrl || 'ws://localhost:1234',
      });

      // Try to connect and get basic info
      const models = await client.llm.listLoaded();
      
      // Use ResponseFactory for consistent, spec-compliant output
      ResponseFactory.setStartTime();
      return ResponseFactory.createHealthCheckResponse(
        'healthy',
        'established',
        config.lmStudioUrl || 'ws://localhost:1234',
        undefined,
        undefined,
        params.detailed ? {
          loadedModels: models.map(model => ({
            path: model.path,
            identifier: model.identifier,
            architecture: (model as any).architecture || 'unknown'
          })),
          modelCount: models.length,
          hasActiveModel: models.length > 0,
          serverInfo: {
            url: config.lmStudioUrl,
            protocol: 'websocket'
          },
          activeModel: models.length > 0 ? {
            path: models[0].path,
            identifier: models[0].identifier,
            architecture: (models[0] as any).architecture || 'unknown'
          } : undefined
        } : undefined
      );
    } catch (error: any) {
      return ResponseFactory.createHealthCheckResponse(
        'unhealthy',
        'failed',
        config.lmStudioUrl || 'ws://localhost:1234',
        error.message || 'Failed to connect to LM Studio',
        'Please ensure LM Studio is running and a model is loaded'
      );
    }
  }

  getPrompt(params: any): string {
    // This is a utility function, no prompt needed
    return '';
  }
}

export default HealthCheckPlugin;
