/**
 * Base Plugin Class - Modern v4.2 Architecture
 * All plugins extend from this base class with modern patterns
 */

import { IPromptPlugin, ParameterDefinition } from '../prompts/shared/types.js';
import { PromptStages } from '../types/prompt-stages.js';

export abstract class BasePlugin implements IPromptPlugin {
  abstract name: string;
  abstract category: 'analyze' | 'generate' | 'multifile' | 'custom' | 'system';
  abstract description: string;
  abstract parameters: { [key: string]: any };
  
  /**
   * Execute the plugin with given parameters
   * MODERN v4.2: Must use withSecurity wrapper
   */
  abstract execute(params: any, llmClient: any): Promise<any>;
  
  /**
   * Get the 3-stage prompt structure for context management
   * MODERN v4.2: Required method for all plugins
   */
  abstract getPromptStages(params: any): PromptStages;
  

  
  /**
   * Validate parameters before execution
   * Override this method for custom validation
   */
  validateParams(params: any): void {
    // Check required parameters
    for (const [key, definition] of Object.entries(this.parameters)) {
      if (definition.required && !(key in params)) {
        throw new Error(`Missing required parameter: ${key}`);
      }
      
      // Type validation
      if (key in params && definition.type) {
        const actualType = typeof params[key];
        const expectedType = definition.type;
        
        if (expectedType === 'array' && !Array.isArray(params[key])) {
          throw new Error(`Parameter ${key} must be an array`);
        } else if (expectedType !== 'array' && actualType !== expectedType) {
          throw new Error(`Parameter ${key} must be of type ${expectedType}`);
        }
      }
      
      // Enum validation
      if (key in params && definition.enum) {
        if (!definition.enum.includes(params[key])) {
          throw new Error(`Parameter ${key} must be one of: ${definition.enum.join(', ')}`);
        }
      }
    }
  }
  
  /**
   * Apply default values to parameters
   */
  applyDefaults(params: any): any {
    const result = { ...params };
    
    for (const [key, definition] of Object.entries(this.parameters)) {
      if (!(key in result) && 'default' in definition) {
        result[key] = definition.default;
      }
    }
    
    return result;
  }
  
  /**
   * Get tool definition for MCP registration
   */
  getToolDefinition(): any {
    return {
      name: this.name,
      description: this.description,
      inputSchema: {
        type: 'object',
        properties: this.convertParametersToSchema(),
        required: this.getRequiredParameters()
      }
    };
  }
  
  /**
   * Convert parameter definitions to JSON schema
   */
  private convertParametersToSchema(): any {
    const schema: any = {};
    
    for (const [key, definition] of Object.entries(this.parameters)) {
      schema[key] = {
        type: definition.type,
        description: definition.description
      };
      
      if (definition.enum) {
        schema[key].enum = definition.enum;
      }
      
      if (definition.default !== undefined) {
        schema[key].default = definition.default;
      }
    }
    
    return schema;
  }
  
  /**
   * Get list of required parameter names
   */
  private getRequiredParameters(): string[] {
    return Object.entries(this.parameters)
      .filter(([_, def]) => def.required)
      .map(([key, _]) => key);
  }
}

export default BasePlugin;
