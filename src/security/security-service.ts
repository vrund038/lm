/**
 * Security Service Wrapper
 * 
 * Provides a unified interface for all security operations.
 * Acts as a facade over individual security modules.
 * 
 * Usage:
 *   const security = new SecurityService();
 *   const result = await security.executeSecurely(plugin, params, llmClient);
 */

import { SanitisationHelper, type SanitisationResult } from './sanitisation.js';
import { PromptInjectionGuard, type InjectionDetectionResult } from './prompt-injection-guard.js';
import { OutputEncoder, type EncodingResult, type OutputContext } from './output-encoder.js';

export interface SecurityConfig {
  enableSanitisation?: boolean;
  enableInjectionDetection?: boolean;
  enableOutputEncoding?: boolean;
  injectionThreshold?: number;
  logSecurityEvents?: boolean;
}

export interface SecurityResult {
  safe: boolean;
  blocked: boolean;
  sanitised: any;
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  processingTime: number;
}

export interface PluginInterface {
  name: string;
  category: 'analyze' | 'generate' | 'multifile' | 'custom' | 'system';
  execute(params: any, llmClient: any): Promise<any>;
  getPrompt?(params: any): string;
}

export class SecurityService {
  private config: SecurityConfig;
  private startTime: number;
  
  constructor(config?: SecurityConfig) {
    this.config = {
      enableSanitisation: true,
      enableInjectionDetection: true,
      enableOutputEncoding: true,
      injectionThreshold: 0.5,
      logSecurityEvents: true,
      ...config
    };
    this.startTime = Date.now();
  }
  
  /**
   * Main wrapper method - executes a plugin with full security protection
   */
  async executeSecurely(
    plugin: PluginInterface, 
    params: any, 
    llmClient: any
  ): Promise<any> {
    const startTime = Date.now();
    const warnings: string[] = [];
    
    try {
      // Step 1: Sanitise and validate input parameters
      const secureParams = await this.secureParameters(params, plugin.name);
      
      // Check if any parameters were blocked
      if (secureParams.blocked) {
        throw new Error(`Security violation: ${secureParams.warnings.join(', ')}`);
      }
      
      warnings.push(...secureParams.warnings);
      
      // Step 2: Execute the plugin with secured parameters
      const result = await plugin.execute(secureParams.sanitised, llmClient);
      
      // Step 3: Secure the output
      const secureResult = await this.secureOutput(result, plugin.category);
      
      // Step 4: Add security metadata
      const processingTime = Date.now() - startTime;
      
      if (warnings.length > 0 && this.config.logSecurityEvents) {
        console.warn(`Security warnings for ${plugin.name}:`, warnings);
      }
      
      return {
        ...secureResult,
        __security: {
          safe: true,
          warnings,
          processingTime,
          timestamp: new Date().toISOString()
        }
      };
      
    } catch (error) {
      // Sanitise error messages
      const sanitisedError = this.sanitiseError(error as Error, plugin.name);
      throw sanitisedError;
    }
  }
  
  /**
   * Secure input parameters
   */
  async secureParameters(params: any, pluginName?: string): Promise<SecurityResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    let blocked = false;
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (!this.config.enableSanitisation && !this.config.enableInjectionDetection) {
      return {
        safe: true,
        blocked: false,
        sanitised: params,
        warnings: [],
        riskLevel: 'low',
        processingTime: Date.now() - startTime
      };
    }
    
    const sanitised: any = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Determine context for this parameter
        const context = this.getParameterContext(key);
        
        // Step 1: Check for injection if enabled
        if (this.config.enableInjectionDetection) {
          const injectionResult = PromptInjectionGuard.analyseInjection(
            value, 
            { source: 'parameter', pluginName }
          );
          
          if (injectionResult.detected) {
            if (injectionResult.confidence >= (this.config.injectionThreshold || 0.5)) {
              if (injectionResult.riskLevel === 'critical') {
                blocked = true;
                warnings.push(`Critical injection attempt in parameter '${key}': ${injectionResult.mitigation}`);
                riskLevel = 'critical';
                continue;
              } else {
                warnings.push(`Injection detected in parameter '${key}': ${injectionResult.mitigation}`);
                riskLevel = this.getHigherRiskLevel(riskLevel, injectionResult.riskLevel);
              }
            }
          }
        }
        
        // Step 2: Sanitise the parameter if enabled
        if (this.config.enableSanitisation) {
          const sanitisationResult = SanitisationHelper.sanitiseInput(value, context);
          
          if (sanitisationResult.blocked) {
            blocked = true;
            warnings.push(`Parameter '${key}' blocked: ${sanitisationResult.reason}`);
            continue;
          }
          
          sanitised[key] = sanitisationResult.cleaned;
          warnings.push(...sanitisationResult.warnings.map(w => `${key}: ${w}`));
        } else {
          sanitised[key] = value;
        }
      } else {
        // Non-string values pass through (could add object sanitisation here)
        sanitised[key] = value;
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    return {
      safe: !blocked && riskLevel !== 'critical',
      blocked,
      sanitised,
      warnings,
      riskLevel,
      processingTime
    };
  }
  
  /**
   * Secure output data
   */
  async secureOutput(output: any, pluginCategory?: string): Promise<any> {
    if (!this.config.enableOutputEncoding) {
      return output;
    }
    
    const outputContext = this.getOutputContext(pluginCategory);
    
    try {
      const safeResponse = OutputEncoder.createSafeResponse(output, outputContext);
      
      if (safeResponse.metadata.warnings.length > 0 && this.config.logSecurityEvents) {
        console.warn('Output encoding warnings:', safeResponse.metadata.warnings);
      }
      
      return safeResponse.data;
    } catch (error) {
      console.error('Error securing output:', error);
      return output; // Fallback to original output if encoding fails
    }
  }
  
  /**
   * Sanitise error messages to prevent information disclosure
   */
  sanitiseError(error: Error, pluginName?: string): Error {
    if (!this.config.enableSanitisation) {
      return error;
    }
    
    let message = error.message || 'An error occurred';
    
    // Remove sensitive information from error messages
    message = message
      .replace(/\/[a-zA-Z]:[\\\/][^\\\/\s]*[\\\/][^\\\/\s]*/g, '[PATH_REMOVED]') // Windows/Unix paths
      .replace(/Error: ENOENT: no such file or directory, open '([^']*)'/, 'Error: File not found')
      .replace(/at Object\.readFileSync[^)]*\)/g, 'at file read operation')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REMOVED]') // IP addresses
      .replace(/\bfile:\/\/[^\s]*/g, '[FILE_URL_REMOVED]') // File URLs
      .replace(/API[_\s]?KEY[_\s]?[=:]\s*[^\s]+/gi, 'API_KEY=[REDACTED]'); // API keys
    
    const sanitisedError = new Error(message);
    sanitisedError.name = error.name || 'SecurityError';
    
    if (this.config.logSecurityEvents) {
      console.warn(`Sanitised error for ${pluginName}: ${error.message} → ${message}`);
    }
    
    return sanitisedError;
  }
  
  /**
   * Quick security check for individual values
   */
  async quickCheck(
    value: string, 
    context: 'user-input' | 'file-content' | 'llm-response' | 'parameter' = 'parameter'
  ): Promise<SecurityResult> {
    const startTime = Date.now();
    
    // Injection detection
    const injectionResult = PromptInjectionGuard.analyseInjection(value, { source: context });
    
    // Input sanitisation
    const sanitisationResult = SanitisationHelper.sanitiseInput(value, 'general');
    
    const blocked = sanitisationResult.blocked || 
      (injectionResult.detected && injectionResult.riskLevel === 'critical');
    
    return {
      safe: !injectionResult.detected && !sanitisationResult.blocked,
      blocked,
      sanitised: sanitisationResult.cleaned,
      warnings: [
        ...sanitisationResult.warnings,
        ...(injectionResult.detected ? [injectionResult.mitigation] : [])
      ],
      riskLevel: injectionResult.detected ? injectionResult.riskLevel : 'low',
      processingTime: Date.now() - startTime
    };
  }
  
  /**
   * Validate and sanitise file paths
   */
  async validateFilePath(filePath: string): Promise<SecurityResult> {
    const startTime = Date.now();
    const result = SanitisationHelper.sanitiseFilePath(filePath);
    
    return {
      safe: !result.blocked,
      blocked: result.blocked,
      sanitised: result.cleaned,
      warnings: result.warnings,
      riskLevel: result.blocked ? 'high' : 'low',
      processingTime: Date.now() - startTime
    };
  }
  
  /**
   * Encode output for specific contexts
   */
  encodeOutput(content: any, context: OutputContext): EncodingResult {
    return OutputEncoder.encode(content, { context });
  }
  
  /**
   * Run comprehensive security tests
   */
  runDiagnostics(): {
    sanitisation: boolean;
    injection: { passed: number; failed: number };
    encoding: { passed: boolean; errors: string[] };
    serviceHealth: boolean;
  } {
    try {
      const sanitisation = SanitisationHelper.validateSanitisation();
      const injection = PromptInjectionGuard.runSecurityTests();
      const encoding = OutputEncoder.validateEncoding();
      
      return {
        sanitisation,
        injection,
        encoding,
        serviceHealth: true
      };
    } catch (error) {
      console.error('Security diagnostics failed:', error);
      return {
        sanitisation: false,
        injection: { passed: 0, failed: 1 },
        encoding: { passed: false, errors: ['Diagnostics failed'] },
        serviceHealth: false
      };
    }
  }
  
  /**
   * Get parameter context for security checks
   */
  private getParameterContext(paramKey: string): 'file-path' | 'code' | 'prompt' | 'general' {
    const key = paramKey.toLowerCase();
    
    if (key.includes('path') || key.includes('file') || key.includes('dir')) {
      return 'file-path';
    }
    if (key === 'code' || key === 'content' || key.includes('source')) {
      return 'code';
    }
    if (key === 'prompt' || key === 'instructions' || key.includes('instruction')) {
      return 'prompt';
    }
    return 'general';
  }
  
  /**
   * Get output context based on plugin category
   */
  private getOutputContext(pluginCategory?: string): OutputContext {
    switch (pluginCategory) {
      case 'generate':
        return 'code';
      case 'custom':
        return 'code';  // Custom prompts often generate code/HTML/CSS
      case 'analyze':
      case 'multifile':
      case 'system':
        return 'json';
      default:
        return 'json';
    }
  }
  
  /**
   * Compare risk levels and return the higher one
   */
  private getHigherRiskLevel(
    current: 'low' | 'medium' | 'high' | 'critical',
    new_: 'low' | 'medium' | 'high' | 'critical'
  ): 'low' | 'medium' | 'high' | 'critical' {
    const levels = { low: 0, medium: 1, high: 2, critical: 3 };
    return levels[new_] > levels[current] ? new_ : current;
  }
  
  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Get current security configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

// Singleton instance for global use
export const securityService = new SecurityService();

// Export types for plugin developers
export type { 
  PluginInterface as SecurityPluginInterface, 
  SecurityResult as SecurityServiceResult, 
  SecurityConfig as SecurityServiceConfig 
};