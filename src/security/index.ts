/**
 * Security Module - Unified Entry Point
 * 
 * Provides comprehensive I/O sanitisation for the Houtini LM MCP
 */

export { 
  SanitisationHelper,
  type SanitisationResult,
  type FileSanitisationResult 
} from './sanitisation.js';

export {
  PromptInjectionGuard,
  type InjectionDetectionResult,
  type InjectionContext
} from './prompt-injection-guard.js';

export {
  OutputEncoder,
  type OutputContext,
  type EncodingOptions,
  type EncodingResult
} from './output-encoder.js';

export {
  SecurityService,
  securityService,
  type SecurityConfig,
  type SecurityResult,
  type PluginInterface
} from './security-service.js';

export {
  withSecurity,
  secureParam,
  validatePath,
  encodeForContext,
  SecurePlugin,
  wrapPluginExecution,
  secureMultipleParams,
  SecurityConfig as SecurityConfigHelper
} from './integration-helpers.js';

// Import classes for convenience functions
import { SanitisationHelper } from './sanitisation.js';
import { PromptInjectionGuard } from './prompt-injection-guard.js';
import { OutputEncoder } from './output-encoder.js';

// Convenience functions for common use cases
export const sanitiseInput = SanitisationHelper.sanitiseInput;
export const sanitiseFilePath = SanitisationHelper.sanitiseFilePath;
export const sanitiseFileContent = SanitisationHelper.sanitiseFileContent;
export const sanitiseOutput = SanitisationHelper.sanitiseOutput;
export const detectInjection = PromptInjectionGuard.analyseInjection;
export const encodeOutput = OutputEncoder.encode;

// Combined security check function
export function securityCheck(
  input: string,
  context: { source: 'user-input' | 'file-content' | 'llm-response' | 'parameter' }
): {
  safe: boolean;
  sanitised: string;
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
} {
  // Step 1: Detect injection
  const injectionResult = PromptInjectionGuard.analyseInjection(input, context);
  
  // Step 2: Sanitise input
  const sanitisationResult = SanitisationHelper.sanitiseInput(input, 'general');
  
  // Step 3: Determine overall safety
  const safe = !injectionResult.detected && !sanitisationResult.blocked;
  const riskLevel = injectionResult.detected ? injectionResult.riskLevel : 'low';
  
  return {
    safe,
    sanitised: sanitisationResult.cleaned,
    warnings: [...sanitisationResult.warnings, ...(injectionResult.detected ? [injectionResult.mitigation] : [])],
    riskLevel
  };
}

// Security test runner
export function runSecurityTests(): {
  sanitisation: boolean;
  injection: { passed: number; failed: number };
  encoding: { passed: boolean; errors: string[] };
} {
  return {
    sanitisation: SanitisationHelper.validateSanitisation(),
    injection: PromptInjectionGuard.runSecurityTests(),
    encoding: OutputEncoder.validateEncoding()
  };
}