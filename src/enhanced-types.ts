// Enhanced types with context awareness for Local LLM MCP
// This file provides improved type definitions for context-aware prompting

export enum TaskType {
  ANALYZE_SINGLE_FILE = 'analyze_single_file',
  GENERATE_TESTS = 'generate_unit_tests',
  DOCUMENT_FUNCTION = 'generate_documentation',
  SUGGEST_REFACTOR = 'suggest_refactoring',
  CHECK_PATTERNS = 'detect_patterns',
  EXPLAIN_CODE = 'explain_code',
  FIND_BUGS = 'validate_syntax',
  OPTIMISE_PERFORMANCE = 'optimise_performance',
  GENERATE_TYPES = 'generate_types',
  CREATE_EXAMPLES = 'create_examples',
  VARIABLE_NAMES = 'suggest_variable_names',
  ANALYZE_FILE = 'analyze_file',
  ANALYZE_CSV_DATA = 'analyze_csv_data',
  // New tools
  GENERATE_WORDPRESS_PLUGIN = 'generate_wordpress_plugin',
  ANALYZE_N8N_WORKFLOW = 'analyze_n8n_workflow',
  GENERATE_RESPONSIVE_COMPONENT = 'generate_responsive_component',
  CONVERT_TO_TYPESCRIPT = 'convert_to_typescript',
  SECURITY_AUDIT = 'security_audit'
}

// Project types we commonly work with
export type ProjectType = 
  | 'wordpress-plugin' 
  | 'wordpress-theme'
  | 'n8n-node' 
  | 'n8n-workflow'
  | 'react-app' 
  | 'react-component'
  | 'node-api'
  | 'html-component'
  | 'browser-extension'
  | 'cli-tool'
  | 'generic';

// Framework context
export interface ProjectContext {
  projectType: ProjectType;
  framework?: string;
  frameworkVersion?: string;
  standards?: string[];
  targetAudience?: 'developer' | 'end-user' | 'admin';
  performanceTarget?: 'high-performance' | 'balanced' | 'feature-rich';
  securityLevel?: 'standard' | 'enhanced' | 'paranoid';
  teamConventions?: TeamConventions;
  dependencies?: string[];
  environment?: 'browser' | 'node' | 'hybrid' | 'wordpress';
}

export interface TeamConventions {
  naming?: 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase';
  components?: 'functional' | 'class-based' | 'mixed';
  testing?: 'unit-first' | 'integration-first' | 'e2e-first';
  documentation?: 'jsdoc' | 'tsdoc' | 'markdown';
  gitFlow?: 'github-flow' | 'git-flow' | 'gitlab-flow';
}

// Code analysis context
export interface CodeContext extends ProjectContext {
  language: string;
  languageVersion?: string;
  lintingRules?: string[];
  ignorePatterns?: string[];
}

// Test generation context
export interface TestContext extends ProjectContext {
  testFramework: string;
  coverageTarget?: number;
  mockStrategy?: 'minimal' | 'comprehensive' | 'integration-preferred';
  testStyle?: 'bdd' | 'tdd' | 'aaa' | 'given-when-then';
  includeEdgeCases?: boolean;
  includePerformanceTests?: boolean;
}

// Documentation context
export interface DocContext extends ProjectContext {
  docStyle: 'jsdoc' | 'tsdoc' | 'markdown' | 'docstring' | 'javadoc' | 'phpdoc';
  detailLevel: 'minimal' | 'standard' | 'comprehensive';
  includeExamples: boolean;
  audience: 'developer' | 'end-user' | 'technical' | 'non-technical';
  includeApiReference?: boolean;
  includeTroubleshooting?: boolean;
}

// Refactoring context
export interface RefactorContext extends ProjectContext {
  focusAreas: RefactorFocus[];
  preserveApi?: boolean;
  modernizationLevel?: 'conservative' | 'moderate' | 'aggressive';
  targetComplexity?: number; // cyclomatic complexity target
}

export type RefactorFocus = 
  | 'readability' 
  | 'performance' 
  | 'maintainability' 
  | 'testability' 
  | 'security'
  | 'type-safety'
  | 'error-handling'
  | 'logging'
  | 'documentation';

// WordPress plugin requirements
export interface PluginRequirements {
  name: string;
  description: string;
  features: string[];
  wpVersion?: string;
  phpVersion?: string;
  prefix: string;
  includeAdmin?: boolean;
  includeDatabase?: boolean;
  includeAjax?: boolean;
  includeRest?: boolean;
  includeGutenberg?: boolean;
  textDomain?: string;
}

// n8n workflow context
export interface N8nWorkflowContext {
  workflow: object;
  optimizationFocus?: 'performance' | 'error-handling' | 'maintainability';
  includeCredentialCheck?: boolean;
  suggestAlternativeNodes?: boolean;
}

// Component specifications
export interface ComponentSpecs {
  name: string;
  type: 'button' | 'form' | 'card' | 'modal' | 'navigation' | 'layout' | 'custom';
  framework?: 'vanilla' | 'react' | 'vue' | 'angular' | 'svelte';
  designSystem?: string;
  responsive?: boolean;
  accessible?: boolean;
  animations?: boolean;
  darkMode?: boolean;
}

// TypeScript conversion context
export interface TSContext {
  strict?: boolean;
  target?: string;
  module?: string;
  preserveComments?: boolean;
  addTypeGuards?: boolean;
  useInterfaces?: boolean;
  useEnums?: boolean;
}

// Security audit context
export interface SecurityContext extends ProjectContext {
  auditDepth: 'basic' | 'standard' | 'comprehensive';
  includeOwasp?: boolean;
  includeDependencies?: boolean;
  customChecks?: string[];
}

// Enhanced task interface with context
export interface EnhancedOffloadTask {
  task: TaskType;
  content?: string;
  filePath?: string;
  context?: ProjectContext | CodeContext | TestContext | DocContext | RefactorContext;
  // Task-specific parameters
  pluginRequirements?: PluginRequirements;
  workflowContext?: N8nWorkflowContext;
  componentSpecs?: ComponentSpecs;
  tsContext?: TSContext;
  securityContext?: SecurityContext;
}

// Enhanced task prompt with context awareness
export interface EnhancedTaskPrompt {
  systemPrompt: (context?: ProjectContext) => string;
  prompt: (content: string, context?: any) => string;
  validateContext?: (context: any) => boolean;
  preprocessContent?: (content: string, context: any) => string;
  postprocessResponse?: (response: string, context: any) => string;
}

// Configuration with enhanced prompts
export interface EnhancedConfig {
  lmStudioUrl: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  timeout: number;
  maxFileSize: number;
  supportedFileTypes: string[];
  taskPrompts: Record<TaskType, EnhancedTaskPrompt>;
  projectDefaults?: Partial<ProjectContext>;
  securityConfig?: {
    allowedPaths: string[];
    blockedPatterns: string[];
    maxRequestsPerMinute: number;
  };
}

// Response metadata for better error handling
export interface TaskResponse {
  success: boolean;
  result?: string;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    executionTime?: number;
    modelUsed?: string;
    contextApplied?: boolean;
  };
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
}
