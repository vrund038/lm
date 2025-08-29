/**
 * Security Integration Helpers
 * 
 * Provides easy-to-use wrapper functions and decorators for integrating
 * security into existing plugins with minimal code changes.
 */

import { SecurityService, securityService, type PluginInterface, type SecurityResult } from './security-service.js';

/**
 * Simple wrapper function that can be added to any plugin's execute method
 * 
 * Usage in any plugin:
 *   import { withSecurity } from '../security/integration-helpers.js';
 *   
 *   async execute(params: any, llmClient: any) {
 *     return await withSecurity(this, params, llmClient, async (secureParams) => {
 *       // Your existing plugin logic here
 *       return await this.originalLogic(secureParams, llmClient);
 *     });
 *   }
 */
export async function withSecurity<T>(
  plugin: PluginInterface,
  params: any,
  llmClient: any,
  originalLogic: (secureParams: any) => Promise<T>
): Promise<T> {
  // Use the singleton security service
  const securityResult = await securityService.secureParameters(params, plugin.name);
  
  if (securityResult.blocked) {
    throw new Error(`Security violation: ${securityResult.warnings.join(', ')}`);
  }
  
  // Execute original logic with secured parameters
  const result = await originalLogic(securityResult.sanitised);
  
  // Secure the output
  return await securityService.secureOutput(result, plugin.category) as T;
}

/**
 * Quick parameter validation helper
 * 
 * Usage:
 *   const safePath = await secureParam(params.filePath, 'file-path');
 *   const safeCode = await secureParam(params.code, 'code');
 */
export async function secureParam(
  value: any,
  context: 'file-path' | 'code' | 'prompt' | 'general' = 'general'
): Promise<any> {
  if (typeof value !== 'string') {
    return value; // Non-string values pass through
  }
  
  const result = await securityService.quickCheck(value, 'parameter');
  
  if (result.blocked) {
    throw new Error(`Parameter blocked: ${result.warnings.join(', ')}`);
  }
  
  if (result.warnings.length > 0) {
    console.warn('Parameter security warnings:', result.warnings);
  }
  
  return result.sanitised;
}

/**
 * File path validation helper
 * 
 * Usage:
 *   const safePath = await validatePath(params.filePath);
 *   const content = await readFileContent(safePath);
 */
export async function validatePath(filePath: string): Promise<string> {
  const result = await securityService.validateFilePath(filePath);
  
  if (result.blocked) {
    throw new Error(`File path blocked: ${result.warnings.join(', ')}`);
  }
  
  return result.sanitised as string;
}

/**
 * Output encoding helper
 * 
 * Usage:
 *   const safeHtml = encodeForContext(userContent, 'html');
 *   const safeJson = encodeForContext(responseData, 'json');
 */
export function encodeForContext(
  content: any,
  context: 'html' | 'json' | 'markdown' | 'plain-text' | 'code' | 'xml'
): any {
  const result = securityService.encodeOutput(content, context);
  
  if (result.warnings.length > 0) {
    console.warn('Output encoding warnings:', result.warnings);
  }
  
  return result.encoded;
}

/**
 * Plugin wrapper class for complete security integration
 * 
 * Usage:
 *   class MyPlugin extends SecurePlugin {
 *     // Your plugin implementation
 *   }
 */
export abstract class SecurePlugin implements PluginInterface {
  abstract name: string;
  abstract category: 'analyze' | 'generate' | 'multifile' | 'custom' | 'system';
  
  // Plugin developers implement this instead of execute
  abstract executeSecurely(params: any, llmClient: any): Promise<any>;
  
  // This is called by the MCP system
  async execute(params: any, llmClient: any): Promise<any> {
    return await securityService.executeSecurely(this, params, llmClient);
  }
  
  // Redirect to executeSecurely for the security service
  async executeOriginal(params: any, llmClient: any): Promise<any> {
    return await this.executeSecurely(params, llmClient);
  }
}

/**
 * Utility function to wrap existing plugin execute methods
 * 
 * Usage in plugin files:
 *   const originalExecute = plugin.execute.bind(plugin);
 *   plugin.execute = wrapPluginExecution(plugin, originalExecute);
 */
export function wrapPluginExecution(
  plugin: PluginInterface,
  originalExecute: (params: any, llmClient: any) => Promise<any>
): (params: any, llmClient: any) => Promise<any> {
  return async (params: any, llmClient: any) => {
    // Create a temporary plugin interface for the security service
    const wrappedPlugin: PluginInterface = {
      name: plugin.name,
      category: plugin.category,
      execute: originalExecute
    };
    
    return await securityService.executeSecurely(wrappedPlugin, params, llmClient);
  };
}

/**
 * Batch security processing for multiple parameters
 * 
 * Usage:
 *   const secureParams = await secureMultipleParams({
 *     filePath: params.filePath,
 *     code: params.code,
 *     userInput: params.userInput
 *   }, {
 *     filePath: 'file-path',
 *     code: 'code', 
 *     userInput: 'general'
 *   });
 */
export async function secureMultipleParams(
  params: Record<string, any>,
  contexts: Record<string, 'file-path' | 'code' | 'prompt' | 'general'>
): Promise<Record<string, any>> {
  const secured: Record<string, any> = {};
  const warnings: string[] = [];
  
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && contexts[key]) {
      try {
        secured[key] = await secureParam(value, contexts[key]);
      } catch (error) {
        throw new Error(`Security violation in parameter '${key}': ${(error as Error).message}`);
      }
    } else {
      secured[key] = value;
    }
  }
  
  if (warnings.length > 0) {
    console.warn('Batch security warnings:', warnings);
  }
  
  return secured;
}

/**
 * Security configuration helper
 */
export const SecurityConfig = {
  /**
   * Enable/disable security features globally
   */
  setGlobal(config: {
    sanitisation?: boolean;
    injectionDetection?: boolean; 
    outputEncoding?: boolean;
    logEvents?: boolean;
  }): void {
    securityService.updateConfig({
      enableSanitisation: config.sanitisation,
      enableInjectionDetection: config.injectionDetection,
      enableOutputEncoding: config.outputEncoding,
      logSecurityEvents: config.logEvents
    });
  },
  
  /**
   * Get current security status
   */
  getStatus(): {
    enabled: boolean;
    features: Record<string, boolean>;
    diagnostics: any;
  } {
    const config = securityService.getConfig();
    const diagnostics = securityService.runDiagnostics();
    
    return {
      enabled: config.enableSanitisation || config.enableInjectionDetection || config.enableOutputEncoding,
      features: {
        sanitisation: config.enableSanitisation || false,
        injectionDetection: config.enableInjectionDetection || false,
        outputEncoding: config.enableOutputEncoding || false,
        logging: config.logSecurityEvents || false
      },
      diagnostics
    };
  },
  
  /**
   * Run security diagnostics
   */
  runTests() {
    return securityService.runDiagnostics();
  }
};