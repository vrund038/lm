/**
 * Multi-file Integration Comparison Plugin
 * Compares integration between multiple files to identify issues
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
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
    // Validate required parameters
    if (!params.files || !Array.isArray(params.files) || params.files.length < 2) {
      throw new Error('At least 2 files are required for integration comparison');
    }
    
    // Read all files with security checks
    const fileContents: Record<string, { content: string; error?: string }> = {};
    
    for (const filePath of params.files) {
      try {
        // Validate and resolve path using secure path validation
        const resolvedPath = await validateAndNormalizePath(filePath);
        
        if (!existsSync(resolvedPath)) {
          fileContents[filePath] = {
            content: '',
            error: 'File not found'
          };
          continue;
        }
        
        // Read file content securely
        const { readFileContent } = await import('../shared/helpers.js');
        const content = await readFileContent(resolvedPath);
        fileContents[filePath] = { content };
      } catch (error) {
        fileContents[filePath] = {
          content: '',
          error: error instanceof Error ? error.message : 'Unknown error reading file'
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
    const systemOverhead = 2000; // System instructions overhead
    const availableTokens = Math.floor(contextLength * 0.8) - systemOverhead; // 80% with system overhead
    
    // Early chunking decision: Estimate content size
    const contentData = Object.fromEntries(
      Object.entries(fileContents).map(([path, data]) => [path, data.content])
    );
    const totalContentLength = Object.values(contentData).join('').length;
    const estimatedTokens = Math.floor(totalContentLength / 4) + systemOverhead; // Rough token estimate
    
    if (estimatedTokens > availableTokens) {
      // Process with chunking for large content
      return await this.executeWithChunking(params, contentData, llmClient, model, availableTokens);
    }
    
    // Process normally for small operations
    return await this.executeSinglePass(params, contentData, llmClient, model);
  }
  
  /**
   * Execute for small operations that fit in single context window
   */
  private async executeSinglePass(params: any, fileContents: Record<string, string>, llmClient: any, model: any): Promise<any> {
    // Generate 3-stage prompt
    const promptStages = this.getPromptStages({
      ...params,
      fileContents
    });
    
    try {
      // Get context limit for 3-stage manager
      const contextLength = await model.getContextLength();
      const promptManager = new ThreeStagePromptManager(contextLength || 23832);
      
      // Create chunked conversation
      const conversation = promptManager.createChunkedConversation(promptStages);
      
      // Build messages array for LM Studio
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      // Call the model with 3-stage conversation
      const prediction = model.respond(messages, {
        temperature: 0.1,
        maxTokens: 4000
      });
      
      // Stream the response
      let response = '';
      for await (const chunk of prediction) {
        if (chunk.content) {
          response += chunk.content;
        }
      }
      
      // Use ResponseFactory for consistent, spec-compliant output
      ResponseFactory.setStartTime();
      return ResponseFactory.parseAndCreateResponse(
        'compare_integration',
        response,
        model.identifier || 'unknown'
      );
      
    } catch (error: any) {
      return ResponseFactory.createErrorResponse(
        'compare_integration',
        'MODEL_ERROR',
        `Failed to compare integration: ${error.message}`,
        { originalError: error.message },
        'unknown'
      );
    }
  }
  
  /**
   * Execute for large operations using file-level chunking
   */
  private async executeWithChunking(params: any, fileContents: Record<string, string>, llmClient: any, model: any, availableTokens: number): Promise<any> {
    // For integration comparison, we need to process all files together
    // So we'll break down the content instead of splitting files
    const fileList = Object.keys(fileContents);
    const chunkSize = Math.max(2, Math.floor(fileList.length / 2)); // Create ~2 chunks, minimum 2 files each
    const fileChunks: string[][] = [];
    
    for (let i = 0; i < fileList.length; i += chunkSize) {
      fileChunks.push(fileList.slice(i, i + chunkSize));
    }
    
    const chunkResults: any[] = [];
    
    for (let chunkIndex = 0; chunkIndex < fileChunks.length; chunkIndex++) {
      try {
        const chunkFiles = fileChunks[chunkIndex];
        const chunkFileContents: Record<string, string> = {};
        chunkFiles.forEach(file => {
          chunkFileContents[file] = fileContents[file];
        });
        
        const result = await this.executeSinglePass(params, chunkFileContents, llmClient, model);
        
        chunkResults.push({
          chunkIndex,
          result,
          success: true
        });
      } catch (error) {
        chunkResults.push({
          chunkIndex,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }
    
    // Combine results
    const successfulChunks = chunkResults.filter(r => r.success);
    
    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'compare_integration',
      JSON.stringify({
        summary: {
          totalChunks: fileChunks.length,
          successfulChunks: successfulChunks.length,
          totalFiles: fileList.length
        },
        results: successfulChunks.map(r => r.result)
      }, null, 2),
      model.identifier || 'unknown'
    );
  }



  /**
   * 3-Stage prompt architecture method
   */
  getPromptStages(params: any): PromptStages {
    const { fileContents, analysisType = 'integration', focus = [] } = params;
    
    // STAGE 1: System instructions and task context
    const systemAndContext = `You are an expert software integration analyst specializing in ${analysisType} analysis across multiple files.

Project Analysis Context:
- Files to analyze: ${Object.keys(fileContents).length}
- Analysis type: ${analysisType}
- Focus areas: ${focus.length > 0 ? focus.join(', ') : 'All aspects'}
- Task: Identify compatibility issues, missing imports, method signature mismatches, and integration problems`;

    // STAGE 2: Data payload (file contents)
    let dataPayload = '';
    Object.entries(fileContents).forEach(([path, content]) => {
      const fileName = basename(path);
      dataPayload += `\n${'='.repeat(80)}\nFile: ${fileName}\nPath: ${path}\n${'='.repeat(80)}\n${content}\n`;
    });

    // STAGE 3: Output instructions and analysis tasks
    const focusSection = focus.length > 0 
      ? this.buildFocusSection(focus)
      : this.getDefaultFocusSection(analysisType);
    
    const outputInstructions = `ANALYSIS REQUIREMENTS:
${focusSection}

ANALYSIS TASKS:

1. **Method Compatibility**
   - Verify all called methods exist with correct signatures
   - Check parameter types and counts match
   - Identify any parameter ordering issues
   - Flag deprecated method usage

2. **Namespace and Import Analysis**
   - Identify missing import statements
   - Find incorrect namespace references
   - Detect circular dependencies
   - Check for unused imports

3. **Data Flow Analysis**
   - Trace how data moves between files
   - Identify type mismatches in data passed between components
   - Find potential null/undefined issues
   - Check for data transformation problems

4. **Integration Issues**
   - Find undefined references and broken dependencies
   - Identify incompatible interfaces
   - Check for version mismatches
   - Detect missing required properties or methods

5. **Architecture Consistency**
   - Verify consistent patterns across files
   - Check for proper separation of concerns
   - Identify tight coupling issues

OUTPUT FORMAT:

## Summary
Brief overview of the integration status and key findings

## Critical Issues (Must Fix)
- **Issue**: [Description]
  **Location**: [File:Line]
  **Impact**: [What breaks]
  **Fix**: [Specific code change]

## High Priority Issues
- **Issue**: [Description]
  **Location**: [File:Line]
  **Problem**: [Why it's problematic]
  **Fix**: [Specific code change]

## Medium Priority Issues
- **Issue**: [Description]
  **Location**: [File:Line]
  **Suggestion**: [Recommended change]

## Low Priority Issues
- **Issue**: [Description]
  **Location**: [File:Line]
  **Note**: [Optional improvement]

## Integration Health Score
Overall integration quality: [Score/10] with justification

## Recommended Refactoring
If applicable, suggest architectural improvements:
1. **Immediate Actions** - Critical fixes needed now
2. **Short-term Improvements** - Performance and maintainability
3. **Long-term Architecture** - Scalability and design patterns

## Verification Steps
Steps to verify the fixes work correctly:
1. [Specific testing approach]
2. [What to validate]
3. [Success criteria]

Provide specific, actionable fixes with exact code snippets that can be directly applied.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }
  
  private buildFocusSection(focus: string[]): string {
    const focusMap: Record<string, string> = {
      'method_compatibility': 'Pay special attention to method signatures and parameter matching',
      'namespace_dependencies': 'Focus on import statements and namespace resolution',
      'data_flow': 'Trace data movement and transformations between components',
      'missing_connections': 'Identify undefined references and broken links'
    };
    
    const focusDescriptions = focus
      .map(f => focusMap[f] || f)
      .map((desc, i) => `${i + 1}. ${desc}`)
      .join('\n');
    
    return `Focus Areas (Priority):\n${focusDescriptions}`;
  }
  
  private getDefaultFocusSection(analysisType: string): string {
    const defaults: Record<string, string> = {
      'integration': 'Analyze all aspects of file integration with equal priority',
      'compatibility': 'Focus on API compatibility and version alignment',
      'dependencies': 'Emphasize dependency analysis and import resolution'
    };
    
    return defaults[analysisType] || defaults['integration'];
  }

  /**
   * Get prompt for BasePlugin interface compatibility
   */
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
  
  private isPathSafe(path: string): boolean {
    // Basic security check - ensure path doesn't contain suspicious patterns
    const suspicious = ['../', '..\\', '/etc/', '\\etc\\', '/root/', '\\root\\'];
    const normalizedPath = path.toLowerCase();
    
    return !suspicious.some(pattern => normalizedPath.includes(pattern));
  }
}

export default IntegrationComparator;