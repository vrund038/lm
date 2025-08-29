/**
 * Specific Response Schemas for Local LLM MCP Functions
 * Based on Functional Specification v4.0 - Exact TypeScript interfaces
 */

import { BaseResponse, Finding } from './output-validator.js';

// ====================
// 1. ANALYSIS FUNCTIONS
// ====================

export interface AnalyzeSingleFileResponse extends BaseResponse {
  data: {
    summary: string;
    structure: {
      classes: string[];
      functions: string[];
      imports: string[];
      exports: string[];
      dependencies: string[];
    };
    metrics: {
      linesOfCode: number;
      cyclomaticComplexity: number;
      cognitiveComplexity?: number;
      maintainabilityIndex?: number;
    };
    findings: Finding[];
    patterns: string[];
    suggestions: string[];
  };
}

export interface SecurityAuditResponse extends BaseResponse {
  data: {
    summary: {
      riskLevel: "critical" | "high" | "medium" | "low";
      totalVulnerabilities: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
    };
    vulnerabilities: Array<{
      type: string;
      severity: "critical" | "high" | "medium" | "low";
      description: string;
      location: {
        file?: string;
        line?: number;
        column?: number;
        code?: string;
      };
      recommendation: string;
      owaspCategory?: string;
      cwe?: string;
    }>;
    dependencies?: {
      vulnerable: Array<{
        packageName: string;
        version: string;
        vulnerability: string;
        severity: string;
      }>;
    };
    recommendations: string[];
    passedChecks: string[];
  };
}

export interface AnalyzeN8nWorkflowResponse extends BaseResponse {
  data: {
    summary: {
      nodeCount: number;
      connectionCount: number;
      complexity: "simple" | "moderate" | "complex";
      estimatedExecutionTime?: string;
      hasErrorHandling: boolean;
      hasCredentialIssues: boolean;
    };
    issues: Array<{
      nodeId: string;
      nodeName: string;
      type: "error" | "warning" | "suggestion";
      category: "performance" | "error-handling" | "security" | "structure";
      message: string;
      fix?: string;
    }>;
    optimizations: Array<{
      type: "merge-nodes" | "parallel-execution" | "caching" | "batch-processing";
      description: string;
      nodes: string[];
      estimatedImprovement?: string;
    }>;
    alternativeNodes?: Array<{
      currentNode: string;
      suggestedNode: string;
      reason: string;
    }>;
    credentials?: {
      exposed: boolean;
      issues: string[];
    };
  };
}

export interface AnalyzeProjectStructureResponse extends BaseResponse {
  data: {
    overview: {
      totalFiles: number;
      totalDirectories: number;
      languages: { [language: string]: number };
      size: string;
      lastModified: string;
    };
    architecture: {
      type: string;
      layers: string[];
      mainComponents: Array<{
        name: string;
        path: string;
        type: string;
        dependencies: string[];
      }>;
    };
    dependencies: {
      internal: Array<{
        from: string;
        to: string;
        type: string;
      }>;
      external: { [packageName: string]: string };
    };
    metrics: {
      complexity: {
        average: number;
        highest: { file: string; value: number };
      };
      maintainability: number;
      testCoverage?: number;
    };
    patterns: string[];
    issues: Array<{
      type: string;
      severity: string;
      description: string;
      location?: string;
    }>;
    recommendations: string[];
  };
}

// ====================
// 2. GENERATION FUNCTIONS
// ====================

export interface GenerateUnitTestsResponse extends BaseResponse {
  data: {
    tests: string;
    coverage: {
      functions: string[];
      branches: number;
      lines: number;
    };
    testCount: number;
    testTypes: {
      unit: number;
      integration?: number;
      performance?: number;
      edgeCases?: number;
    };
    mocks: string[];
    setupRequired: string[];
  };
}

export interface GenerateDocumentationResponse extends BaseResponse {
  data: {
    documentation: string;
    sections: {
      overview?: string;
      installation?: string;
      usage?: string;
      api?: string;
      examples?: string;
      troubleshooting?: string;
      contributing?: string;
    };
    metadata: {
      functions: number;
      classes: number;
      totalLines: number;
      docCoverage: number;
    };
  };
}

export interface SuggestRefactoringResponse extends BaseResponse {
  data: {
    suggestions: Array<{
      type: string;
      priority: "high" | "medium" | "low";
      location: { start: number; end: number };
      description: string;
      before: string;
      after: string;
      benefits: string[];
      risks?: string[];
    }>;
    metrics: {
      currentComplexity: number;
      targetComplexity: number;
      improvementScore: number;
    };
    refactoredCode?: string;
  };
}

export interface GenerateWordpressPluginResponse extends BaseResponse {
  data: {
    files: Array<{
      path: string;
      content: string;
      description: string;
    }>;
    structure: {
      mainFile: string;
      directories: string[];
      totalFiles: number;
    };
    features: {
      implemented: string[];
      hooks: string[];
      shortcodes?: string[];
      blocks?: string[];
      endpoints?: string[];
    };
    instructions: {
      installation: string;
      configuration: string;
      usage: string;
    };
  };
}

export interface GenerateResponsiveComponentResponse extends BaseResponse {
  data: {
    component: {
      html: string;
      css: string;
      javascript?: string;
      framework?: string;
    };
    features: {
      responsive: boolean;
      accessible: boolean;
      darkMode: boolean;
      animations: boolean;
      browserSupport: string[];
    };
    accessibility: {
      ariaAttributes: string[];
      keyboardSupport: string[];
      screenReaderSupport: boolean;
      wcagLevel: string;
    };
    usage: string;
  };
}

export interface ConvertToTypescriptResponse extends BaseResponse {
  data: {
    typescript: string;
    types: {
      interfaces: string[];
      types: string[];
      enums: string[];
      typeGuards: string[];
    };
    statistics: {
      linesConverted: number;
      typesInferred: number;
      typesExplicit: number;
      anyCount: number;
      unknownCount: number;
    };
    issues: Array<{
      type: string;
      line: number;
      message: string;
      suggestion?: string;
    }>;
    config: {
      compilerOptions: object;
    };
  };
}

// ====================
// 3. MULTI-FILE FUNCTIONS
// ====================

export interface CompareIntegrationResponse extends BaseResponse {
  data: {
    summary: {
      filesAnalyzed: number;
      issuesFound: number;
      compatibilityScore: number;
    };
    integrationIssues: Array<{
      type: string;
      severity: "critical" | "high" | "medium" | "low";
      files: Array<{
        path: string;
        line: number;
        code?: string;
      }>;
      description: string;
      fix: {
        description: string;
        code?: string;
        automated: boolean;
      };
    }>;
    dependencies: {
      graph: { [file: string]: string[] };
      circular: Array<string[]>;
      missing: Array<{
        file: string;
        importName: string;
      }>;
    };
    suggestions: string[];
  };
}

export interface TraceExecutionPathResponse extends BaseResponse {
  data: {
    trace: Array<{
      level: number;
      file: string;
      function: string;
      line: number;
      parameters?: string[];
      calls: Array<{
        function: string;
        file: string;
        line: number;
      }>;
    }>;
    summary: {
      totalCalls: number;
      uniqueFunctions: number;
      filesInvolved: string[];
      maxDepthReached: boolean;
    };
    visualization: string;
  };
}

export interface FindPatternUsageResponse extends BaseResponse {
  data: {
    matches: Array<{
      pattern: string;
      file: string;
      line: number;
      column: number;
      match: string;
      context: {
        before: string[];
        after: string[];
      };
    }>;
    statistics: {
      totalMatches: number;
      matchesByPattern: { [pattern: string]: number };
      matchesByFile: { [file: string]: number };
      filesScanned: number;
    };
  };
}

export interface DiffMethodSignaturesResponse extends BaseResponse {
  data: {
    comparison: {
      caller: {
        file: string;
        line: number;
        signature: string;
        parameters: Array<{
          name: string;
          type?: string;
          default?: string;
        }>;
      };
      callee: {
        file: string;
        line: number;
        signature: string;
        parameters: Array<{
          name: string;
          type?: string;
          required: boolean;
          default?: string;
        }>;
      };
    };
    mismatches: Array<{
      type: "missing" | "extra" | "type-mismatch" | "order";
      parameter: string;
      description: string;
    }>;
    compatible: boolean;
    suggestions: string[];
  };
}

// ====================
// 4. SYSTEM FUNCTIONS
// ====================

export interface HealthCheckResponse extends BaseResponse {
  data: {
    status: "healthy" | "unhealthy";
    connection: "established" | "failed";
    lmStudioUrl: string;
    timestamp: string;
    error?: string;
    suggestion?: string;
    contextLength?: number;       // Context length of the loaded model
    details?: {
      loadedModels: Array<{
        path: string;
        identifier: string;
        architecture: string;
        contextLength?: number;   // Context length for each model
      }>;
      modelCount: number;
      hasActiveModel: boolean;
      contextLength?: number;     // Context length of active model
      serverInfo: {
        url: string;
        protocol: string;
      };
      activeModel?: {
        path: string;
        identifier: string;
        architecture: string;
        contextLength?: number;   // Context length of active model
      };
    };
  };
}

export interface ClearAnalysisCacheResponse extends BaseResponse {
  data: {
    success: boolean;
    message: string;
    filesCleared: number;
    memoryFreed: string;
  };
}

export interface GetCacheStatisticsResponse extends BaseResponse {
  data: {
    totalEntries: number;
    memoryUsage: string;
    files: string[];
    oldestEntry: string;
    newestEntry: string;
    hitRate: number;
    statistics: {
      byType: { [type: string]: number };
      bySize: { [range: string]: number };
    };
  };
}

// ====================
// FUNCTION TYPE MAPPING
// ====================

export type FunctionResponseMap = {
  // Analysis functions
  'analyze_single_file': AnalyzeSingleFileResponse;
  'security_audit': SecurityAuditResponse;
  'analyze_n8n_workflow': AnalyzeN8nWorkflowResponse;
  'analyze_project_structure': AnalyzeProjectStructureResponse;
  
  // Generation functions
  'generate_unit_tests': GenerateUnitTestsResponse;
  'generate_documentation': GenerateDocumentationResponse;
  'suggest_refactoring': SuggestRefactoringResponse;
  'generate_wordpress_plugin': GenerateWordpressPluginResponse;
  'generate_responsive_component': GenerateResponsiveComponentResponse;
  'convert_to_typescript': ConvertToTypescriptResponse;
  
  // Multi-file functions
  'compare_integration': CompareIntegrationResponse;
  'trace_execution_path': TraceExecutionPathResponse;
  'find_pattern_usage': FindPatternUsageResponse;
  'diff_method_signatures': DiffMethodSignaturesResponse;
  
  // System functions
  'health_check': HealthCheckResponse;
  'clear_analysis_cache': ClearAnalysisCacheResponse;
  'get_cache_statistics': GetCacheStatisticsResponse;
};

export type FunctionName = keyof FunctionResponseMap;
export type FunctionResponse<T extends FunctionName> = FunctionResponseMap[T];
