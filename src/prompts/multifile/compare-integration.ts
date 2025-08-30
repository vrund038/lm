/**
 * Multi-file Integration Comparison Plugin
 * Compares integration between multiple files to identify issues
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { readFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { validateAndNormalizePath } from '../shared/helpers.js';

export class IntegrationComparator extends BasePlugin implements IPromptPlugin {
  name = 'compare_integration';
  category = 'multifile' as const;
  description = 'Compare integration between multiple files to identify mismatches, missing imports, and compatibility issues. Returns actionable fixes with line numbers.';
  
  parameters = {
    files: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Array of absolute file paths to analyze',
      required: true
    },
    analysisType: {
      type: 'string' as const,
      enum: ['integration', 'compatibility', 'dependencies'],
      default: 'integration',
      description: 'Type of integration analysis',
      required: false
    },
    focus: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Specific areas to focus on: method_compatibility, namespace_dependencies, data_flow, missing_connections',
      default: [],
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // Validate required parameters
        this.validateSecureParams(secureParams);
        
        // Read all files with security checks (paths already secured by withSecurity)
        const fileContents: Record<string, { content: string; error?: string }> = {};
        
        for (const filePath of secureParams.files) {
          try {
            if (!existsSync(filePath)) {
              fileContents[filePath] = { 
                content: '', 
                error: `File not found: ${filePath}` 
              };
              continue;
            }
            
            const content = readFileSync(filePath, 'utf-8');
            fileContents[filePath] = { content };
          } catch (error: any) {
            fileContents[filePath] = { 
              content: '', 
              error: `Failed to read file: ${error.message}` 
            };
          }
        }
        
        // Check if we have at least 2 valid files
        const validFiles = Object.entries(fileContents).filter(([_, data]) => !data.error && data.content);
        if (validFiles.length < 2) {
          const errors = Object.entries(fileContents)
            .filter(([_, data]) => data.error)
            .map(([path, data]) => `${path}: ${data.error}`)
            .join('\n');
          throw new Error(`Could not read enough files for comparison. Errors:\n${errors}`);
        }
        
        // Get model for context limit detection
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        const model = models[0];
        const contextLength = await model.getContextLength() || 23832;
        
        // Generate 3-stage prompt
        const promptStages = this.getPromptStages({
          ...secureParams,
          fileContents
        });
        
        // Determine if chunking is needed
        const promptManager = new ThreeStagePromptManager(contextLength);
        const needsChunking = promptManager.needsChunking(promptStages);
        
        if (needsChunking) {
          return await this.executeWithChunking(promptStages, llmClient, model, promptManager);
        } else {
          return await this.executeDirect(promptStages, llmClient, model);
        }
        
      } catch (error: any) {
        return ResponseFactory.createErrorResponse(
          'compare_integration',
          'EXECUTION_ERROR',
          `Failed to compare integration: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  // MODERN PATTERN: Direct execution for manageable operations
  private async executeDirect(stages: PromptStages, llmClient: any, model: any) {
    const messages = [
      {
        role: 'system',
        content: stages.systemAndContext
      },
      {
        role: 'user',
        content: stages.dataPayload
      },
      {
        role: 'user',
        content: stages.outputInstructions
      }
    ];

    const prediction = model.respond(messages, {
      temperature: 0.2,
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'compare_integration',
      response,
      model.identifier || 'unknown'
    );
  }

  // MODERN PATTERN: Chunked execution for large operations
  private async executeWithChunking(stages: PromptStages, llmClient: any, model: any, promptManager: ThreeStagePromptManager) {
    const conversation = promptManager.createChunkedConversation(stages);
    
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];

    const prediction = model.respond(messages, {
      temperature: 0.2,
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'compare_integration',
      response,
      model.identifier || 'unknown'
    );
  }

  // MODERN PATTERN: Secure parameter validation
  private validateSecureParams(params: any): void {
    if (!params.files || !Array.isArray(params.files) || params.files.length < 2) {
      throw new Error('At least 2 files are required for integration comparison');
    }
  }

  getPromptStages(params: any): PromptStages {
    const { analysisType, focus, fileContents } = params;
    
    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert software architect and integration specialist analyzing multi-file compatibility.

Integration Analysis Context:
- Analysis Type: ${analysisType}
- Focus Areas: ${focus && focus.length > 0 ? focus.join(', ') : 'General integration'}
- Files to Analyze: ${Object.keys(fileContents).length}

Your task is to identify integration issues, compatibility problems, and missing connections between the files.`;

    // STAGE 2: File contents for analysis
    let dataPayload = '=== FILES FOR INTEGRATION ANALYSIS ===\n\n';
    
    for (const [filePath, fileData] of Object.entries(fileContents)) {
      const data = fileData as { content: string; error?: string };
      if (data.error) {
        dataPayload += `File: ${filePath}\nStatus: ERROR - ${data.error}\n\n`;
        continue;
      }
      
      const fileName = basename(filePath);
      dataPayload += `File: ${fileName}\nPath: ${filePath}\nContent:\n`;
      dataPayload += '```\n' + data.content + '\n```\n\n';
      dataPayload += '-'.repeat(80) + '\n\n';
    }

    // STAGE 3: Analysis instructions
    const outputInstructions = `COMPREHENSIVE INTEGRATION ANALYSIS

Analyze the provided files and identify all integration issues, compatibility problems, and missing connections.

## Required Analysis Sections:

### 1. Integration Overview
- **Files Analyzed**: List all files with their roles/purposes
- **Overall Integration Health**: Rate as Excellent/Good/Fair/Poor
- **Critical Issues Count**: Number of issues by severity

### 2. Compatibility Analysis
For each file pair combination, check:
- **Method Signatures**: Parameter mismatches, return type conflicts
- **Data Type Compatibility**: Inconsistent data structures
- **API Contracts**: Interface violations or missing implementations
- **Dependencies**: Missing imports or circular dependencies

### 3. Integration Issues Found
For each issue identified:
- **Type**: Specific integration problem (Method Mismatch, Missing Import, etc.)
- **Severity**: Critical/High/Medium/Low
- **Files Affected**: Which files are involved
- **Location**: Specific line numbers where possible
- **Description**: Clear explanation of the problem
- **Impact**: What could break or malfunction
- **Fix**: Specific code changes needed

### 4. Missing Connections
- **Unused Exports**: Functions/classes exported but not imported elsewhere  
- **Missing Imports**: Required dependencies not imported
- **Interface Gaps**: Missing method implementations
- **Data Flow Breaks**: Inconsistent data passing between files

### 5. Architecture Assessment
- **Design Patterns**: Good practices already in use
- **Anti-patterns**: Problematic integration approaches
- **Coupling Analysis**: Too tight/loose coupling between modules
- **Abstraction Issues**: Missing interfaces or over-abstraction

### 6. Actionable Recommendations
#### Immediate Fixes (Critical/High)
- Step-by-step fixes with specific line numbers
- Code examples for corrections
- Priority order for implementation

#### Architectural Improvements
- Better integration patterns to adopt
- Refactoring suggestions for cleaner interfaces
- Long-term structural improvements

### 7. Integration Testing Suggestions
- Unit tests for individual file interfaces
- Integration tests for file interactions
- Mock strategies for testing file dependencies
- Error handling test scenarios

## Output Requirements:
- Use markdown formatting for readability
- Include specific line numbers for all issues
- Provide code snippets showing problems and fixes
- Rate severity consistently (Critical/High/Medium/Low)
- Focus on actionable, specific recommendations`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }
}

export default IntegrationComparator;
