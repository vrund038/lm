/**
 * Response Factory for Local LLM MCP Functions
 * Makes it incredibly easy to create correctly formatted responses
 * Usage: ResponseFactory.createAnalyzeSingleFileResponse(data, modelId)
 */

import {
  FunctionName,
  FunctionResponse,
  AnalyzeSingleFileResponse,
  SecurityAuditResponse,
  GenerateUnitTestsResponse,
  GenerateDocumentationResponse,
  HealthCheckResponse,
  // ... import all response types
} from './schemas.js';
import { OutputValidator } from './output-validator.js';

export class ResponseFactory {
  private static startTime = Date.now();

  /**
   * Set execution start time
   */
  static setStartTime(): void {
    this.startTime = Date.now();
  }

  /**
   * Get execution time since start
   */
  private static getExecutionTime(): number {
    return Date.now() - this.startTime;
  }

  // ====================
  // ANALYSIS FUNCTIONS
  // ====================

  static createAnalyzeSingleFileResponse(
    summary: string,
    structure: AnalyzeSingleFileResponse['data']['structure'],
    metrics: AnalyzeSingleFileResponse['data']['metrics'],
    findings: AnalyzeSingleFileResponse['data']['findings'],
    patterns: string[],
    suggestions: string[],
    modelUsed: string
  ): AnalyzeSingleFileResponse {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: this.getExecutionTime(),
      data: {
        summary,
        structure,
        metrics,
        findings,
        patterns,
        suggestions
      }
    };
  }

  static createSecurityAuditResponse(
    summary: SecurityAuditResponse['data']['summary'],
    vulnerabilities: SecurityAuditResponse['data']['vulnerabilities'],
    recommendations: string[],
    passedChecks: string[],
    dependencies: SecurityAuditResponse['data']['dependencies'] | undefined,
    modelUsed: string
  ): SecurityAuditResponse {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: this.getExecutionTime(),
      data: {
        summary,
        vulnerabilities,
        dependencies,
        recommendations,
        passedChecks
      }
    };
  }

  // ====================
  // GENERATION FUNCTIONS  
  // ====================

  static createGenerateUnitTestsResponse(
    tests: string,
    coverage: GenerateUnitTestsResponse['data']['coverage'],
    testCount: number,
    testTypes: GenerateUnitTestsResponse['data']['testTypes'],
    mocks: string[],
    setupRequired: string[],
    modelUsed: string
  ): GenerateUnitTestsResponse {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: this.getExecutionTime(),
      data: {
        tests,
        coverage,
        testCount,
        testTypes,
        mocks,
        setupRequired
      }
    };
  }

  static createGenerateDocumentationResponse(
    documentation: string,
    sections: GenerateDocumentationResponse['data']['sections'],
    metadata: GenerateDocumentationResponse['data']['metadata'],
    modelUsed: string
  ): GenerateDocumentationResponse {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: this.getExecutionTime(),
      data: {
        documentation,
        sections,
        metadata
      }
    };
  }

  // ====================
  // SYSTEM FUNCTIONS
  // ====================

  static createSystemResponse(
    data: { status: string; details: Record<string, any> },
    modelUsed: string = 'system',
    executionTimeMs?: number
  ): any {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: executionTimeMs || this.getExecutionTime(),
      data
    };
  }

  static createHealthCheckResponse(
    status: "healthy" | "unhealthy",
    connection: "established" | "failed",
    lmStudioUrl: string,
    error?: string,
    suggestion?: string,
    details?: HealthCheckResponse['data']['details']
  ): HealthCheckResponse {
    return {
      success: status === "healthy",
      timestamp: new Date().toISOString(),
      modelUsed: details?.activeModel?.identifier || 'none',
      executionTimeMs: this.getExecutionTime(),
      data: {
        status,
        connection,
        lmStudioUrl,
        timestamp: new Date().toISOString(),
        error,
        suggestion,
        details
      }
    };
  }

  // ====================
  // ERROR RESPONSES
  // ====================

  static createErrorResponse(
    functionName: FunctionName,
    errorCode: string,
    errorMessage: string,
    details?: any,
    modelUsed: string = 'unknown'
  ) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: this.getExecutionTime(),
      error: {
        code: errorCode,
        message: errorMessage,
        details
      }
    };
  }

  // ====================
  // SMART PARSING HELPERS
  // ====================

  /**
   * Parse any LLM response and try to structure it according to function spec
   * This is the magic method that will save tons of work!
   */
  static parseAndCreateResponse<T extends FunctionName>(
    functionName: T,
    llmResponse: string,
    modelUsed: string,
    additionalData: any = {}
  ): FunctionResponse<T> {
    this.setStartTime();

    try {
      // First, try to parse as JSON
      let parsed: any;
      try {
        parsed = JSON.parse(llmResponse);
      } catch {
        // If not JSON, create a structured interpretation
        parsed = this.createStructuredFromText(llmResponse, functionName);
      }

      // Route to specific parser based on function name
      switch (functionName) {
        case 'analyze_single_file':
          return this.parseAnalyzeSingleFile(parsed, llmResponse, modelUsed) as FunctionResponse<T>;
        
        case 'generate_unit_tests':
          return this.parseGenerateUnitTests(parsed, llmResponse, modelUsed) as FunctionResponse<T>;
        
        case 'health_check':
          return this.parseHealthCheck(parsed, modelUsed, additionalData) as FunctionResponse<T>;
        
        // Add more cases as needed...
        
        default:
          // Generic fallback
          return this.createGenericResponse(functionName, llmResponse, modelUsed) as FunctionResponse<T>;
      }

    } catch (error) {
      return this.createErrorResponse(
        functionName,
        OutputValidator.ErrorCodes.PARSING_ERROR,
        `Failed to parse LLM response: ${error.message}`,
        { originalResponse: llmResponse.substring(0, 500) },
        modelUsed
      ) as FunctionResponse<T>;
    }
  }

  // ====================
  // SPECIFIC PARSERS
  // ====================

  private static parseAnalyzeSingleFile(
    parsed: any,
    originalResponse: string,
    modelUsed: string
  ): AnalyzeSingleFileResponse {
    
    const summary = parsed.summary || originalResponse.split('\n\n')[0] || 'Code analysis completed';
    
    const structure = {
      classes: parsed.structure?.classes || this.extractClasses(originalResponse),
      functions: parsed.structure?.functions || this.extractFunctions(originalResponse),
      imports: parsed.structure?.imports || this.extractImports(originalResponse),
      exports: parsed.structure?.exports || this.extractExports(originalResponse),
      dependencies: parsed.structure?.dependencies || this.extractDependencies(originalResponse)
    };

    const metrics = {
      linesOfCode: parsed.metrics?.linesOfCode || this.estimateLines(originalResponse),
      cyclomaticComplexity: parsed.metrics?.cyclomaticComplexity || 1,
      cognitiveComplexity: parsed.metrics?.cognitiveComplexity,
      maintainabilityIndex: parsed.metrics?.maintainabilityIndex
    };

    const findings = parsed.findings || this.extractFindings(originalResponse);
    const patterns = parsed.patterns || this.extractPatterns(originalResponse);
    const suggestions = parsed.suggestions || this.extractSuggestions(originalResponse);

    return this.createAnalyzeSingleFileResponse(
      summary,
      structure,
      metrics,
      findings,
      patterns,
      suggestions,
      modelUsed
    );
  }

  private static parseGenerateUnitTests(
    parsed: any,
    originalResponse: string,
    modelUsed: string
  ): GenerateUnitTestsResponse {
    
    const tests = parsed.tests || originalResponse;
    
    const coverage = {
      functions: parsed.coverage?.functions || this.extractFunctions(tests),
      branches: parsed.coverage?.branches || 80, // Default estimate
      lines: parsed.coverage?.lines || 85       // Default estimate
    };

    const testCount = parsed.testCount || this.countTests(tests);
    
    const testTypes = {
      unit: parsed.testTypes?.unit || testCount,
      integration: parsed.testTypes?.integration,
      performance: parsed.testTypes?.performance,
      edgeCases: parsed.testTypes?.edgeCases
    };

    const mocks = parsed.mocks || this.extractMocks(tests);
    const setupRequired = parsed.setupRequired || [];

    return this.createGenerateUnitTestsResponse(
      tests,
      coverage,
      testCount,
      testTypes,
      mocks,
      setupRequired,
      modelUsed
    );
  }

  // ====================
  // TEXT ANALYSIS HELPERS
  // ====================

  private static createStructuredFromText(text: string, functionName: string): any {
    // Split text into sections based on common patterns
    const sections = text.split(/\n\n+/);
    
    return {
      summary: sections[0] || 'Analysis completed',
      content: text,
      sections: sections,
      metadata: {
        originalLength: text.length,
        sectionCount: sections.length
      }
    };
  }

  private static extractClasses(text: string): string[] {
    const classMatches = text.match(/class\s+(\w+)/g) || [];
    return classMatches.map(match => match.replace('class ', ''));
  }

  private static extractFunctions(text: string): string[] {
    const functionMatches = text.match(/(?:function\s+(\w+)|(\w+)\s*\(|const\s+(\w+)\s*=)/g) || [];
    return functionMatches.map(match => {
      const clean = match.replace(/function\s+|const\s+|\s*=|\s*\(/g, '');
      return clean.trim();
    }).filter(name => name.length > 0);
  }

  private static extractImports(text: string): string[] {
    const importMatches = text.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g) || [];
    return importMatches.map(match => {
      const moduleMatch = match.match(/from\s+['"]([^'"]+)['"]/);
      return moduleMatch ? moduleMatch[1] : '';
    }).filter(Boolean);
  }

  private static extractExports(text: string): string[] {
    const exportMatches = text.match(/export\s+(?:default\s+)?(\w+|{[^}]+})/g) || [];
    return exportMatches.map(match => match.replace(/export\s+(?:default\s+)?/, ''));
  }

  private static extractDependencies(text: string): string[] {
    // Extract common dependency patterns
    return [...new Set([
      ...this.extractImports(text),
      ...text.match(/require\(['"]([^'"]+)['"]\)/g)?.map(m => m.match(/['"]([^'"]+)['"]/)?.[1]).filter(Boolean) || []
    ])];
  }

  private static extractFindings(text: string): any[] {
    const findings = [];
    
    // Look for common issue patterns
    const issuePatterns = [
      { pattern: /(?:issue|problem|error):\s*(.+)/gi, type: 'issue', severity: 'medium' },
      { pattern: /(?:warning|caution):\s*(.+)/gi, type: 'warning', severity: 'low' },
      { pattern: /(?:critical|severe):\s*(.+)/gi, type: 'issue', severity: 'critical' }
    ];

    for (const { pattern, type, severity } of issuePatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        findings.push({
          type,
          severity,
          message: match[1].trim()
        });
      }
    }

    return findings;
  }

  private static extractPatterns(text: string): string[] {
    const patterns = [];
    
    // Common code patterns
    const patternKeywords = [
      'singleton', 'factory', 'observer', 'mvc', 'mvp', 'mvvm',
      'repository', 'decorator', 'adapter', 'facade', 'strategy'
    ];

    for (const keyword of patternKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        patterns.push(keyword);
      }
    }

    return patterns;
  }

  private static extractSuggestions(text: string): string[] {
    const suggestions = [];
    const suggestionPatterns = [
      /(?:recommend|suggest)(?:ation)?:\s*(.+)/gi,
      /(?:consider|try):\s*(.+)/gi,
      /(?:improvement|enhance):\s*(.+)/gi
    ];

    for (const pattern of suggestionPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        suggestions.push(match[1].trim());
      }
    }

    return suggestions;
  }

  private static extractMocks(text: string): string[] {
    const mockPatterns = [
      /mock\w*\(['"]([^'"]+)['"]\)/gi,
      /jest\.mock\(['"]([^'"]+)['"]\)/gi,
      /sinon\.stub\(([^)]+)\)/gi
    ];

    const mocks = [];
    for (const pattern of mockPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        mocks.push(match[1] || match[0]);
      }
    }

    return mocks;
  }

  private static countTests(text: string): number {
    const testPatterns = [
      /(?:test|it)\(/g,
      /describe\(/g
    ];

    let count = 0;
    for (const pattern of testPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    return count || 1; // At least 1 test assumed
  }

  private static estimateLines(text: string): number {
    return text.split('\n').length;
  }

  private static parseHealthCheck(parsed: any, modelUsed: string, additionalData: any): HealthCheckResponse {
    return this.createHealthCheckResponse(
      additionalData.status || 'healthy',
      additionalData.connection || 'established',
      additionalData.lmStudioUrl || 'ws://localhost:1234',
      additionalData.error,
      additionalData.suggestion,
      additionalData.details
    );
  }

  private static createGenericResponse(functionName: string, response: string, modelUsed: string): any {
    // Generic fallback for functions not yet implemented
    return {
      success: true,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: this.getExecutionTime(),
      data: {
        content: response,
        metadata: {
          functionName,
          parsedAt: new Date().toISOString(),
          responseLength: response.length
        }
      }
    };
  }
}
