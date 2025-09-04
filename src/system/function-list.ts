/**
 * Function Registry Plugin - Discover and list all available Houtini LM functions
 * Helps users explore capabilities and understand function usage patterns
 */

import { BasePlugin } from '../plugins/base-plugin.js';
import { IPromptPlugin } from '../prompts/shared/types.js';
import { withSecurity } from '../security/integration-helpers.js';
import { discoverAvailableFunctions, getFunctionCategories } from './function-registry.js';

export class FunctionRegistryPlugin extends BasePlugin implements IPromptPlugin {
  name = 'list_functions';
  category = 'system' as const;
  description = 'List all available Houtini LM functions with usage information';
  
  parameters = {
    category: {
      type: 'string' as const,
      description: 'Filter by category (analyze, generate, system, custom, fun)',
      required: false
    },
    detailed: {
      type: 'boolean' as const,
      description: 'Include detailed information about each function',
      default: true,
      required: false
    },
    includeExamples: {
      type: 'boolean' as const,
      description: 'Include usage examples for each function',
      default: true,
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        const allFunctions = await discoverAvailableFunctions();
        const categories = await getFunctionCategories();
        
        // Filter by category if specified
        const filteredFunctions = secureParams.category 
          ? allFunctions.filter(func => func.category === secureParams.category)
          : allFunctions;

        const result: any = {
          summary: {
            totalFunctions: allFunctions.length,
            filteredCount: filteredFunctions.length,
            categories: categories,
            timestamp: new Date().toISOString()
          },
          functions: secureParams.detailed === false 
            ? filteredFunctions.map(func => ({ name: func.name, category: func.category }))
            : filteredFunctions.map(func => ({
                name: func.name,
                category: func.category,
                description: func.description,
                supportedModes: func.supportedModes,
                primaryMode: func.primaryMode,
                examples: secureParams.includeExamples !== false ? func.exampleUsage : undefined
              }))
        };

        // Add helpful tips for users
        if (secureParams.detailed !== false) {
          result.tips = {
            singleFile: "Use 'filePath' parameter for individual file analysis",
            multiFile: "Use 'projectPath' parameter for directory/project analysis",
            pathResolution: "Use 'houtini-lm:resolve_path' to check if a path is file or directory",
            modeInfo: "Functions support 'single-file', 'multi-file', or both modes"
          };
        }

        return {
          success: true,
          timestamp: new Date().toISOString(),
          modelUsed: 'system-utility',
          executionTimeMs: 0,
          data: {
            content: result,
            metadata: {
              functionName: 'list_functions',
              parsedAt: new Date().toISOString(),
              responseLength: JSON.stringify(result).length
            }
          }
        };
        
      } catch (error: any) {
        return {
          success: false,
          timestamp: new Date().toISOString(),
          modelUsed: 'system-utility',
          executionTimeMs: 0,
          error: {
            code: 'FUNCTION_DISCOVERY_ERROR',
            message: error.message || 'Failed to discover functions',
            details: { originalError: error.message }
          }
        };
      }
    });
  }

  // Not used for system functions, but required by interface
  getPromptStages(params: any): any {
    return {
      systemAndContext: 'Function discovery system function',
      dataPayload: `Category filter: ${params.category || 'all'}`,
      outputInstructions: 'Return function registry information'
    };
  }
}

// Export as default for plugin loader
export default FunctionRegistryPlugin;