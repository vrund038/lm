/**
 * TypeScript type definitions for the plugin system
 */

export interface IPromptPlugin {
  name: string;
  category: 'analyze' | 'generate' | 'multifile' | 'system';
  description: string;
  parameters: ParameterSchema;
  execute(params: any, llmClient: any): Promise<any>;
  getPrompt(params: any): string;
  validateParams?(params: any): void;
  getToolDefinition(): any;
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
  projectType?: 'wordpress-plugin' | 'react-app' | 'node-api' | 'n8n-node' | 'generic';
  framework?: string;
  frameworkVersion?: string;
  environment?: 'browser' | 'node' | 'wordpress' | 'hybrid';
  standards?: string[];
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
  type: string;
  message: string;
  location?: string;
  line?: number;
}

export interface Suggestion {
  priority: 'high' | 'medium' | 'low';
  category: string;
  description: string;
  implementation?: string;
}

export interface Metrics {
  linesOfCode?: number;
  cyclomaticComplexity?: number;
  cognitiveComplexity?: number;
  testCoverage?: number;
  [key: string]: any;
}

export interface LLMClient {
  complete(prompt: string): Promise<string>;
  completeWithSchema<T>(prompt: string, schema: any): Promise<T>;
}
