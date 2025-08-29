/**
 * Execution Path Tracer Plugin
 * Traces execution flow through multiple files from an entry point
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname, dirname, basename } from 'path';

export class ExecutionTracer extends BasePlugin implements IPromptPlugin {
  name = 'trace_execution_path';
  category = 'multifile' as const;
  description = 'Trace execution path through multiple files starting from an entry point. Shows complete call flow.';
  
  parameters = {
    entryPoint: {
      type: 'string' as const,
      description: 'Entry point like ClassName::methodName or functionName',
      required: true
    },
    traceDepth: {
      type: 'number' as const,
      default: 5,
      description: 'Maximum depth to trace (1-10)',
      required: false
    },
    showParameters: {
      type: 'boolean' as const,
      default: false,
      description: 'Include parameter information in trace',
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    // Validate entry point
    if (!params.entryPoint || typeof params.entryPoint !== 'string') {
      throw new Error('Entry point is required and must be a string (e.g., "ClassName::methodName" or "functionName")');
    }
    
    // Validate and constrain trace depth
    const traceDepth = Math.min(Math.max(params.traceDepth || 5, 1), 10);
    const showParameters = params.showParameters || false;
    
    // Parse entry point to determine starting context
    const entryPointInfo = this.parseEntryPoint(params.entryPoint);
    
    // Try to find the entry point file(s)
    const projectRoot = this.findProjectRoot();
    const relevantFiles = await this.findRelevantFiles(projectRoot, entryPointInfo);
    
    if (relevantFiles.length === 0) {
      throw new Error(`Could not find files containing entry point: ${params.entryPoint}`);
    }
    
    // Read relevant files
    const fileContents: Record<string, string> = {};
    for (const filePath of relevantFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        fileContents[filePath] = content;
      } catch (error) {
        console.warn(`Could not read file: ${filePath}`, error);
      }
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
    const totalContentLength = Object.values(fileContents).join('').length;
    const estimatedTokens = Math.floor(totalContentLength / 4) + systemOverhead; // Rough token estimate
    
    if (estimatedTokens > availableTokens) {
      // Process with chunking for large content
      return await this.executeWithChunking(params, fileContents, entryPointInfo, traceDepth, showParameters, llmClient, model, availableTokens);
    }
    
    // Process normally for small operations
    return await this.executeSinglePass(params, fileContents, entryPointInfo, traceDepth, showParameters, llmClient, model);
  }
  
  /**
   * Execute for small operations that fit in single context window
   */
  private async executeSinglePass(params: any, fileContents: Record<string, string>, entryPointInfo: any, traceDepth: number, showParameters: boolean, llmClient: any, model: any): Promise<any> {
    // Generate 3-stage prompt
    const promptStages = this.getPromptStages({
      entryPoint: params.entryPoint,
      entryPointInfo,
      traceDepth,
      showParameters,
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
        'trace_execution_path',
        response,
        model.identifier || 'unknown'
      );
      
    } catch (error: any) {
      return ResponseFactory.createErrorResponse(
        'trace_execution_path',
        'MODEL_ERROR',
        `Failed to trace execution path: ${error.message}`,
        { originalError: error.message },
        'unknown'
      );
    }
  }
  
  /**
   * Execute for large operations using file-level chunking
   */
  private async executeWithChunking(params: any, fileContents: Record<string, string>, entryPointInfo: any, traceDepth: number, showParameters: boolean, llmClient: any, model: any, availableTokens: number): Promise<any> {
    // For execution tracing, we need the entry point file plus related files
    // So we'll chunk by file groups rather than splitting individual files
    const fileList = Object.keys(fileContents);
    const chunkSize = Math.max(2, Math.floor(fileList.length / 3)); // Create ~3 chunks
    const fileChunks: string[][] = [];
    
    // Always put the first file (likely contains entry point) in the first chunk
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
        
        const result = await this.executeSinglePass(params, chunkFileContents, entryPointInfo, traceDepth, showParameters, llmClient, model);
        
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
      'trace_execution_path',
      JSON.stringify({
        summary: {
          totalChunks: fileChunks.length,
          successfulChunks: successfulChunks.length,
          totalFiles: fileList.length,
          entryPoint: params.entryPoint
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
    const { entryPoint, entryPointInfo, traceDepth, showParameters, fileContents } = params;
    
    // STAGE 1: System instructions and task context
    const systemAndContext = `You are an expert code execution tracer specializing in execution flow analysis and call graph generation.

Execution Trace Context:
- Entry point: ${entryPoint}
- Entry type: ${entryPointInfo.type}
- ${entryPointInfo.className ? `Class: ${entryPointInfo.className}` : 'Global scope'}
- ${entryPointInfo.methodName ? `Method: ${entryPointInfo.methodName}` : `Function: ${entryPointInfo.functionName || entryPointInfo.name}`}
- Maximum trace depth: ${traceDepth}
- Parameter details: ${showParameters ? 'Include full signatures' : 'Method names only'}
- Files to analyze: ${Object.keys(fileContents).length}`;

    // STAGE 2: Data payload (file contents)
    let dataPayload = '';
    Object.entries(fileContents).forEach(([path, content]) => {
      const fileName = basename(path);
      dataPayload += `\n${'='.repeat(80)}\nFile: ${fileName}\nPath: ${path}\n${'='.repeat(80)}\n${content}\n`;
    });

    // STAGE 3: Output instructions and analysis tasks
    const parameterSection = showParameters 
      ? 'Include full parameter information (types, names, default values) at each step.'
      : 'Focus on method/function names without detailed parameter information.';
    
    const outputInstructions = `TRACING REQUIREMENTS:
${parameterSection}

EXECUTION TRACING TASKS:

1. **Start Point Identification**
   - Locate the exact entry point in the provided files
   - If not found, indicate the likely file where it should exist
   - Note the initial context (class, module, namespace)

2. **Execution Flow Tracing**
   - Follow method/function calls step by step
   - Track both direct calls and indirect calls (callbacks, events)
   - Note conditional branches that affect flow
   - Identify loops and recursive calls
   - Stop at depth ${traceDepth} or when reaching external libraries

3. **Cross-File Tracking**
   - When a call crosses file boundaries, clearly indicate the transition
   - Track imports/requires to understand module dependencies
   - Note when entering or leaving class contexts

4. **Call Information**
   ${showParameters ? `
   - Include full method signatures with parameter types
   - Show actual arguments passed at each call site
   - Note any parameter transformations
   - Indicate optional parameters and defaults` : `
   - Show method/function names only
   - Indicate number of parameters if relevant
   - Note if parameters are transformed`}

5. **Flow Visualization**
   Use clear indentation and symbols to show the call hierarchy

OUTPUT FORMAT:

## Entry Point Analysis
- **Location Found**: [File:Line] or "Not found - likely location: [suggestion]"
- **Context**: [Class/Module/Global scope]
- **Signature**: [Full method/function signature]

## Execution Trace

\`\`\`
${entryPoint}
├─> Step 1: [File:Line] MethodName${showParameters ? '(param1: type, param2: type)' : '()'}
│   ├─> Step 1.1: [File:Line] CalledMethod${showParameters ? '(args)' : ''}
│   │   └─> Step 1.1.1: [File:Line] DeeperCall
│   └─> Step 1.2: [File:Line] AnotherMethod
├─> Step 2: [File:Line] NextCall
│   └─> Step 2.1: [File:Line] SubCall
└─> Step 3: [File:Line] FinalCall
\`\`\`

## Execution Flow Summary
- **Total execution steps**: [number]
- **Files touched**: [count and list]
- **Maximum depth reached**: [number]
- **Recursive calls detected**: [Yes/No with details]
- **External dependencies**: [List of external libraries/modules called]

## Cross-File Transitions
List all file boundary crossings:
1. [File A] → [File B]: [Method/function call]
2. [File B] → [File C]: [Method/function call]

## Key Decision Points
Identify conditional logic that significantly affects execution path:
- **Condition**: [Description]
  **Location**: [File:Line]
  **Impact**: [How it changes execution flow]

## Potential Issues Found
- **Missing methods/functions**: [List any called but not found]
- **Circular dependencies**: [List any cycles detected]
- **Unreachable code**: [Any code that can't be reached]
- **Error handling gaps**: [Missing try/catch or error checks]

## Call Graph Insights
- **Most called methods**: [Top 3-5 methods with call counts]
- **Deepest call chains**: [Longest sequences found]
- **Bottleneck methods**: [Methods with many callers]

## Architecture Observations
- **Design patterns detected**: [Observer, Factory, etc.]
- **Coupling assessment**: [Tight/loose coupling observations]
- **Separation of concerns**: [How well separated]

## Recommendations
Suggest any improvements to the execution flow or architecture:
1. **Performance optimizations**
2. **Error handling improvements**
3. **Code organization suggestions**
4. **Potential refactoring opportunities**

Provide a clear, traceable path from the entry point through the codebase, making it easy to understand how the code executes and identifying any architectural concerns.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }
  
  private parseEntryPoint(entryPoint: string): any {
    // Parse different entry point formats
    // ClassName::methodName
    // ClassName.methodName  
    // functionName
    // module.functionName
    // namespace.class.method
    
    const doubleColonMatch = entryPoint.match(/^([^:]+)::(.+)$/);
    if (doubleColonMatch) {
      return {
        type: 'class_method',
        className: doubleColonMatch[1],
        methodName: doubleColonMatch[2]
      };
    }
    
    const dotMatch = entryPoint.match(/^([^.]+)\.(.+)$/);
    if (dotMatch) {
      // Could be Class.method or module.function
      return {
        type: 'qualified',
        namespace: dotMatch[1],
        name: dotMatch[2]
      };
    }
    
    // Simple function name
    return {
      type: 'function',
      functionName: entryPoint
    };
  }
  
  private findProjectRoot(): string {
    // Try to find project root by looking for common indicators
    let currentDir = process.cwd();
    const maxLevels = 10;
    let level = 0;
    
    while (level < maxLevels) {
      // Check for project indicators
      const indicators = ['package.json', '.git', 'composer.json', 'pom.xml', '.project'];
      
      for (const indicator of indicators) {
        if (existsSync(join(currentDir, indicator))) {
          return currentDir;
        }
      }
      
      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) {
        break; // Reached root
      }
      currentDir = parentDir;
      level++;
    }
    
    return process.cwd(); // Default to current directory
  }
  
  private async findRelevantFiles(projectRoot: string, entryPointInfo: any): Promise<string[]> {
    const relevantFiles: string[] = [];
    const maxFiles = 20; // Limit to prevent overwhelming analysis
    
    // Common source directories to search
    const sourceDirs = ['src', 'lib', 'app', 'includes', '.'];
    
    for (const dir of sourceDirs) {
      const fullDir = join(projectRoot, dir);
      if (!existsSync(fullDir)) continue;
      
      const files = this.findFilesRecursive(fullDir, maxFiles - relevantFiles.length);
      relevantFiles.push(...files);
      
      if (relevantFiles.length >= maxFiles) break;
    }
    
    return relevantFiles;
  }
  
  private findFilesRecursive(dir: string, maxFiles: number): string[] {
    const files: string[] = [];
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.hpp'];
    
    function traverse(currentDir: string) {
      if (files.length >= maxFiles) return;
      
      try {
        const entries = readdirSync(currentDir);
        
        for (const entry of entries) {
          if (files.length >= maxFiles) break;
          
          const fullPath = join(currentDir, entry);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            // Skip common non-source directories
            if (!['node_modules', '.git', 'vendor', 'dist', 'build', '.next'].includes(entry)) {
              traverse(fullPath);
            }
          } else if (stat.isFile()) {
            const ext = extname(entry).toLowerCase();
            if (codeExtensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }
    
    traverse(dir);
    return files;
  }

  /**
   * Get prompt for BasePlugin interface compatibility
   */
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
}

export default ExecutionTracer;