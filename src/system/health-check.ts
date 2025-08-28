/**
 * Health Check Plugin
 * Checks if LM Studio is running and responding
 */

import { BasePlugin } from '../plugins/base-plugin';
import { IPromptPlugin } from '../plugins/types';
import { LMStudioClient } from '@lmstudio/sdk';
import { config } from '../config';

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
      
      const response: any = {
        status: 'healthy',
        connection: 'established',
        lmStudioUrl: config.lmStudioUrl || 'ws://localhost:1234',
        timestamp: new Date().toISOString()
      };

      if (params.detailed) {
        response.details = {
          loadedModels: models,
          modelCount: models.length,
          hasActiveModel: models.length > 0,
          serverInfo: {
            url: config.lmStudioUrl,
            protocol: 'websocket'
          }
        };
        
        if (models.length > 0) {
          response.details.activeModel = {
            path: models[0].path,
            identifier: models[0].identifier,
            architecture: models[0].architecture
          };
        }
      }

      return response;
    } catch (error: any) {
      return {
        status: 'unhealthy',
        connection: 'failed',
        error: error.message || 'Failed to connect to LM Studio',
        suggestion: 'Please ensure LM Studio is running and a model is loaded',
        lmStudioUrl: config.lmStudioUrl || 'ws://localhost:1234',
        timestamp: new Date().toISOString()
      };
    }
  }

  getPrompt(params: any): string {
    // This is a utility function, no prompt needed
    return '';
  }
}

export default HealthCheckPlugin;
