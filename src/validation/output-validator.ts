/**
 * Output Validation System for Local LLM MCP
 * Centralized validation and formatting for all function outputs
 * Based on Functional Specification v4.0
 */

// Base response interface that all functions must implement
export interface BaseResponse {
  success: boolean;
  timestamp: string;
  modelUsed: string;
  executionTimeMs: number;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Analysis function responses
export interface AnalyzeResponse extends BaseResponse {
  data: {
    summary: string;
    findings: Finding[];
    suggestions: string[];
    metadata?: Record<string, any>;
  };
}

// Generation function responses  
export interface GenerateResponse extends BaseResponse {
  data: {
    content: string;
    metadata: {
      type: string;
      language?: string;
      framework?: string;
      [key: string]: any;
    };
    statistics: {
      linesGenerated: number;
      tokensUsed?: number;
      [key: string]: any;
    };
  };
}

// Multi-file function responses
export interface MultiFileResponse extends BaseResponse {
  data: {
    filesAnalyzed: string[];
    summary: string;
    results: any[];
    insights: string[];
  };
}

// System function responses
export interface SystemResponse extends BaseResponse {
  data: {
    status: string;
    details: Record<string, any>;
  };
}

// Common types used across responses
export interface Finding {
  type: "issue" | "suggestion" | "info" | "warning" | "error";
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
    code?: string;
  };
  recommendation?: string;
}

/**
 * Central Output Validator Class
 * All functions should use this to ensure consistent output format
 */
export class OutputValidator {
  private static startTime: number = Date.now();

  /**
   * Create a successful analysis response
   */
  static createAnalyzeResponse(
    data: Omit<AnalyzeResponse['data'], never>,
    modelUsed: string,
    executionTimeMs?: number
  ): AnalyzeResponse {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: executionTimeMs || (Date.now() - this.startTime),
      data
    };
  }

  /**
   * Create a successful generation response
   */
  static createGenerateResponse(
    data: Omit<GenerateResponse['data'], never>,
    modelUsed: string,
    executionTimeMs?: number
  ): GenerateResponse {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: executionTimeMs || (Date.now() - this.startTime),
      data
    };
  }

  /**
   * Create a successful multi-file response
   */
  static createMultiFileResponse(
    data: Omit<MultiFileResponse['data'], never>,
    modelUsed: string,
    executionTimeMs?: number
  ): MultiFileResponse {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: executionTimeMs || (Date.now() - this.startTime),
      data
    };
  }

  /**
   * Create a successful system response
   */
  static createSystemResponse(
    data: Omit<SystemResponse['data'], never>,
    modelUsed: string = 'system',
    executionTimeMs?: number
  ): SystemResponse {
    return {
      success: true,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: executionTimeMs || (Date.now() - this.startTime),
      data
    };
  }

  /**
   * Create an error response (for any function type)
   */
  static createErrorResponse(
    errorCode: string,
    errorMessage: string,
    details?: any,
    modelUsed: string = 'unknown',
    executionTimeMs?: number
  ): BaseResponse {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      modelUsed,
      executionTimeMs: executionTimeMs || (Date.now() - this.startTime),
      error: {
        code: errorCode,
        message: errorMessage,
        details
      }
    };
  }

  /**
   * Validate that a response matches the expected schema
   */
  static validateResponse(response: any, expectedType: 'analyze' | 'generate' | 'multifile' | 'system'): boolean {
    // Basic structure validation
    if (!response || typeof response !== 'object') {
      return false;
    }

    // Required base fields
    const requiredFields = ['success', 'timestamp', 'modelUsed', 'executionTimeMs'];
    for (const field of requiredFields) {
      if (!(field in response)) {
        return false;
      }
    }

    // Type-specific validation
    if (response.success && !response.data) {
      return false;
    }

    if (!response.success && !response.error) {
      return false;
    }

    return true;
  }

  /**
   * Set execution start time for timing calculations
   */
  static setStartTime(): void {
    this.startTime = Date.now();
  }

  /**
   * Get execution time since start
   */
  static getExecutionTime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Standardize error codes
   */
  static ErrorCodes = {
    INVALID_INPUT: 'INVALID_INPUT',
    FILE_NOT_FOUND: 'FILE_NOT_FOUND',
    MODEL_ERROR: 'MODEL_ERROR',
    PARSING_ERROR: 'PARSING_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    TIMEOUT: 'TIMEOUT',
    SYSTEM_ERROR: 'SYSTEM_ERROR'
  } as const;
}

// Export specific response parsers for each function category
export class AnalysisOutputParser {
  /**
   * Parse LLM response into structured analysis data
   */
  static parseAnalysisResponse(llmResponse: string, functionName: string): AnalyzeResponse['data'] {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(llmResponse);
      return this.validateAndNormalizeAnalysis(parsed, functionName);
    } catch {
      // If not JSON, parse as structured text
      return this.parseStructuredText(llmResponse, functionName);
    }
  }

  private static validateAndNormalizeAnalysis(parsed: any, functionName: string): AnalyzeResponse['data'] {
    // Default structure
    const data: AnalyzeResponse['data'] = {
      summary: '',
      findings: [],
      suggestions: [],
      metadata: {}
    };

    // Extract summary
    if (parsed.summary || parsed.analysis) {
      data.summary = parsed.summary || parsed.analysis;
    }

    // Extract findings
    if (Array.isArray(parsed.findings)) {
      data.findings = parsed.findings.map(this.normalizeFinding);
    } else if (Array.isArray(parsed.issues)) {
      data.findings = parsed.issues.map(this.normalizeFinding);
    }

    // Extract suggestions
    if (Array.isArray(parsed.suggestions)) {
      data.suggestions = parsed.suggestions;
    } else if (Array.isArray(parsed.recommendations)) {
      data.suggestions = parsed.recommendations;
    }

    // Function-specific parsing
    if (functionName === 'analyze_single_file') {
      data.metadata = {
        structure: parsed.structure || {},
        metrics: parsed.metrics || {},
        patterns: parsed.patterns || []
      };
    }

    return data;
  }

  private static parseStructuredText(text: string, functionName: string): AnalyzeResponse['data'] {
    // Parse structured text responses (fallback)
    const sections = text.split(/\n\n+/);
    
    return {
      summary: sections[0] || text.substring(0, 200),
      findings: this.extractFindings(text),
      suggestions: this.extractSuggestions(text),
      metadata: { rawResponse: text }
    };
  }

  private static normalizeFinding(finding: any): Finding {
    return {
      type: finding.type || 'info',
      severity: finding.severity || 'medium',
      message: finding.message || finding.description || '',
      location: finding.location,
      recommendation: finding.recommendation || finding.fix
    };
  }

  private static extractFindings(text: string): Finding[] {
    const findings: Finding[] = [];
    // Simple regex-based extraction for common patterns
    const issuePatterns = [
      /(?:issue|problem|error):\s*(.+)/gi,
      /(?:warning|caution):\s*(.+)/gi,
      /(?:suggestion|improvement):\s*(.+)/gi
    ];

    for (const pattern of issuePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        findings.push({
          type: 'issue',
          severity: 'medium',
          message: match[1].trim()
        });
      }
    }

    return findings;
  }

  private static extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const suggestionPatterns = [
      /(?:recommend|suggest)(?:ation)?:\s*(.+)/gi,
      /(?:consider|try):\s*(.+)/gi
    ];

    for (const pattern of suggestionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        suggestions.push(match[1].trim());
      }
    }

    return suggestions;
  }
}

export class GenerationOutputParser {
  /**
   * Parse LLM response into structured generation data
   */
  static parseGenerationResponse(llmResponse: string, functionName: string, language?: string): GenerateResponse['data'] {
    const lines = llmResponse.split('\n').length;
    
    return {
      content: llmResponse,
      metadata: {
        type: this.getContentType(functionName),
        language: language || 'javascript',
        framework: 'auto-detected'
      },
      statistics: {
        linesGenerated: lines,
        tokensUsed: Math.floor(llmResponse.length / 4) // Rough estimate
      }
    };
  }

  private static getContentType(functionName: string): string {
    const typeMap: Record<string, string> = {
      'generate_unit_tests': 'test-code',
      'generate_documentation': 'documentation',
      'generate_wordpress_plugin': 'plugin-code',
      'generate_responsive_component': 'component-code',
      'convert_to_typescript': 'typescript-code',
      'suggest_refactoring': 'refactored-code'
    };

    return typeMap[functionName] || 'generated-content';
  }
}
