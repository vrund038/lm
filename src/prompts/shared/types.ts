/**
 * TypeScript type definitions for the modern v4.2 plugin system
 */

import { PromptStages } from '../../types/prompt-stages.js';

export interface IPromptPlugin {
  name: string;
  category: 'analyze' | 'generate' | 'multifile' | 'custom' | 'system';
  description: string;
  parameters: ParameterSchema;
  
  // MODERN v4.2: Required methods
  execute(params: any, llmClient: any): Promise<any>;
  getPromptStages(params: any): PromptStages;
  
  // Optional methods
  validateParams?(params: any): void;
  getToolDefinition(): any;
  
  // LEGACY: Backwards compatibility (will be removed in v5.0)
  getPrompt?(params: any): string;
}

export interface ParameterSchema {
  [key: string]: ParameterDefinition;
}

export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  required?: boolean;
  default?: any;
  enum?: string[];
  items?: ParameterDefinition;
  properties?: ParameterSchema;
}

export interface PluginContext {
  projectType?: 'wordpress-plugin' | 'wordpress-theme' | 'react-app' | 'react-component' | 'node-api' | 'n8n-node' | 'n8n-workflow' | 'browser-extension' | 'cli-tool' | 'html-component' | 'generic';
  framework?: string;
  frameworkVersion?: string;
  environment?: 'browser' | 'node' | 'wordpress' | 'hybrid';
  standards?: string[];
  language?: string;
  languageVersion?: string;
}

export interface AnalysisResult {
  summary: string;
  findings: Finding[];
  suggestions: Suggestion[];
  metrics?: Metrics;
  confidence?: number;
}

export interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  type: 'issue' | 'warning' | 'suggestion' | 'info';
  message: string;
  location?: string;
  line?: number;
  column?: number;
  recommendation?: string;
}

export interface Suggestion {
  priority: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  implementation?: string;
  benefits?: string[];
  risks?: string[];
}

export interface Metrics {
  linesOfCode?: number;
  cyclomaticComplexity?: number;
  cognitiveComplexity?: number;
  maintainabilityIndex?: number;
  testCoverage?: number;
  [key: string]: any;
}

/**
 * Modern LM Studio Client Interface (v4.2)
 * Uses streaming and model management
 */
export interface LLMClient {
  llm: {
    listLoaded(): Promise<LLMModel[]>;
  };
}

export interface LLMModel {
  identifier: string;
  respond(messages: ChatMessage[], options: ModelOptions): AsyncIterable<ModelResponse>;
  getContextLength?(): Promise<number>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface ModelResponse {
  content?: string;
  [key: string]: any;
}

/**
 * Security and validation types
 */
export interface SecurityResult {
  blocked: boolean;
  sanitised: any;
  warnings: string[];
}

/**
 * Plugin execution context
 */
export interface PluginExecutionContext {
  modelUsed?: string;
  executionTimeMs?: number;
  contextLength?: number;
  chunked?: boolean;
}
