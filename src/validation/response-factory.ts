/**
 * Response Factory for Houtini LM MCP Functions
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
    details?: HealthCheckResponse['data']['details'],
    contextLength?: number
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
        contextLength,
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
   * Universal response parser for all MCP functions
   * Works with the universal template architecture - no function-specific switch statements needed!
   */
  static parseAndCreateResponse<T extends FunctionName>(
    functionName: T,
    llmResponse: string,
    modelUsed: string,
    additionalData: any = {}
  ): FunctionResponse<T> {
    this.setStartTime();

    try {
      // Handle special case for health_check which needs additionalData
      if (functionName === 'health_check') {
        return this.parseHealthCheck(llmResponse, modelUsed, additionalData) as FunctionResponse<T>;
      }

      // Universal JSON parsing with markdown code block handling
      let parsed: any;
      try {
        // Strip markdown JSON code blocks if present
        let cleanedResponse = llmResponse.trim();
        if (cleanedResponse.startsWith('```json') && cleanedResponse.endsWith('```')) {
          cleanedResponse = cleanedResponse.slice(7, -3).trim();
        } else if (cleanedResponse.startsWith('```') && cleanedResponse.endsWith('```')) {
          // Handle generic code blocks that might contain JSON
          cleanedResponse = cleanedResponse.slice(3, -3).trim();
        }
        
        parsed = JSON.parse(cleanedResponse);
        
        // If it's valid JSON, return it properly structured
        return {
          success: true,
          timestamp: new Date().toISOString(),
          modelUsed,
          executionTimeMs: this.getExecutionTime(),
          data: parsed
        } as FunctionResponse<T>;
        
      } catch {
        // If not JSON, fall back to content wrapping
        return {
          success: true,
          timestamp: new Date().toISOString(),
          modelUsed,
          executionTimeMs: this.getExecutionTime(),
          data: {
            content: llmResponse,
            metadata: {
              functionName,
              parsedAt: new Date().toISOString(),
              responseLength: llmResponse.length
            }
          }
        } as FunctionResponse<T>;
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
  // HEALTH CHECK SPECIAL CASE  
  // ====================
  // HEALTH CHECK SPECIAL CASE  
  // ====================

  private static parseHealthCheck(llmResponse: string, modelUsed: string, additionalData: any): HealthCheckResponse {
    // health_check is a special case - it doesn't return JSON from LLM, 
    // but instead gets structured data from additionalData
    return this.createHealthCheckResponse(
      additionalData.status || 'healthy',
      additionalData.connection || 'established',
      additionalData.lmStudioUrl || 'ws://localhost:1234',
      additionalData.error,
      additionalData.suggestion,
      additionalData.details
    );
  }
}
