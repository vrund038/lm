/**
 * Core Types for Houtini LM MCP Server v1.0
 * Modern plugin architecture - no legacy prompt handling
 */

export interface Config {
  lmStudioUrl: string;
  modelName: string;
  temperature: number;
  // maxTokens removed - now calculated dynamically by TokenCalculator
  topP: number;
  timeout: number;
  maxFileSize: number;
  supportedFileTypes: string[];
  security?: {
    enableSanitisation: boolean;
    enableInjectionDetection: boolean;
    enableOutputEncoding: boolean;
    injectionThreshold: number;
    allowedDirectories: string[];
    maxInputSize: Record<string, number>;
  };
}

/**
 * LM Studio Client Configuration
 */
export interface LMStudioConfig {
  baseUrl: string;
  timeout?: number;
}

/**
 * Plugin execution context
 */
export interface PluginContext {
  modelUsed?: string;
  executionTimeMs?: number;
  contextLength?: number;
}

/**
 * Security validation result
 */
export interface SecurityResult {
  blocked: boolean;
  sanitised: any;
  warnings: string[];
}
