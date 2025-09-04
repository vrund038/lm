/**
 * Path Resolution Plugin - Smart path analysis for MCP usage
 * Helps users understand file vs directory paths and suggests correct parameters
 */

import { BasePlugin } from '../plugins/base-plugin.js';
import { IPromptPlugin } from '../prompts/shared/types.js';
import { withSecurity } from '../security/integration-helpers.js';
import { analyzePathForMCP } from '../utils/path-resolver.js';

export class PathResolverPlugin extends BasePlugin implements IPromptPlugin {
  name = 'resolve_path';
  category = 'system' as const;
  description = 'Analyze a file system path and suggest correct MCP parameters';
  
  parameters = {
    path: {
      type: 'string' as const,
      description: 'File system path to analyze (file or directory)',
      required: true
    },
    suggestions: {
      type: 'boolean' as const,
      description: 'Include parameter suggestions and usage examples',
      default: true,
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        const pathAnalysis = await analyzePathForMCP(secureParams.path);
        
        const result: any = {
          path: secureParams.path,
          analysis: pathAnalysis,
          timestamp: new Date().toISOString()
        };

        // Add usage suggestions if requested
        if (secureParams.suggestions !== false) {
          result.suggestions = {
            recommendedParameter: pathAnalysis.suggestedParameter,
            exampleUsage: pathAnalysis.type === 'directory' 
              ? `houtini-lm:count_files projectPath="${secureParams.path}"`
              : `houtini-lm:analyze_single_file filePath="${secureParams.path}"`,
            alternativeUsage: pathAnalysis.type === 'directory'
              ? `houtini-lm:security_audit projectPath="${secureParams.path}"`
              : `houtini-lm:generate_unit_tests filePath="${secureParams.path}"`
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
              functionName: 'resolve_path',
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
            code: 'PATH_RESOLUTION_ERROR',
            message: error.message || 'Failed to analyze path',
            details: { originalError: error.message }
          }
        };
      }
    });
  }

  // Not used for system functions, but required by interface
  getPromptStages(params: any): any {
    return {
      systemAndContext: 'Path resolution system function',
      dataPayload: `Path: ${params.path}`,
      outputInstructions: 'Return path analysis and suggestions'
    };
  }
}

// Export as default for plugin loader
export default PathResolverPlugin;