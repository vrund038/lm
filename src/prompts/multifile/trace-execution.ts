/**
 * Execution Path Tracer Plugin
 * Traces execution flow through multiple files from an entry point
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
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
    
    // Generate prompt for tracing
    const prompt = this.getPrompt({
      entryPoint: params.entryPoint,
      entryPointInfo,
      traceDepth,
      showParameters,
      fileContents
    });
    
    // Execute and return
    const response = await llmClient.complete(prompt);
    try {
      // Get the loaded model from LM Studio
      const models = await llmClient.llm.listLoaded();
      if (models.length === 0) {
        throw new Error('No model loaded in LM Studio. Please load a model first.');
      }
      
      // Use the first loaded model
      const model = models[0];
      
      // Call the model with proper LM Studio SDK pattern
      const prediction = model.respond([
        {
          role: 'system',
          content: 'You are an expert code execution tracer. Analyze code execution paths, function call sequences, and data flow through multiple files. Provide detailed execution traces with clear call chains.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
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
      
      return {
        trace: response,
        metadata: {
          entryPoint: params.entryPoint,
          traceDepth,
          filesAnalyzed: Object.keys(fileContents).length,
          showParameters,
          modelUsed: model.identifier || 'unknown'
        }
      };
      
    } catch (error: any) {
      throw new Error(`Failed to trace execution path: ${error.message}`);
    }
  }

  getPrompt(params: any): string {
    const { entryPoint, entryPointInfo, traceDepth, showParameters, fileContents } = params;
    
    // Build file sections
    let filesSection = '';
    Object.entries(fileContents).forEach(([path, content]) => {
      const fileName = basename(path);
      filesSection += `\n${'='.repeat(80)}\nFile: ${fileName}\nPath: ${path}\n${'='.repeat(80)}\n${content}\n`;
    });
    
    const parameterSection = showParameters 
      ? 'Include full parameter information (types, names, default values) at each step.'
      : 'Focus on method/function names without detailed parameter information.';
    
    return `You are an expert code analyst specializing in execution flow analysis and call graph generation.

Trace the execution path starting from: ${entryPoint}
Maximum trace depth: ${traceDepth}
${parameterSection}

Entry point details:
- Type: ${entryPointInfo.type}
- ${entryPointInfo.className ? `Class: ${entryPointInfo.className}` : 'Global function/method'}
- ${entryPointInfo.methodName ? `Method: ${entryPointInfo.methodName}` : `Function: ${entryPointInfo.functionName}`}

Files to analyze:
${filesSection}

TRACING REQUIREMENTS:

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

## Call Flow Summary
- Total execution steps: X
- Files touched: Y
- Maximum depth reached: Z
- Recursive calls detected: Yes/No
- External dependencies: [List]

## Key Decision Points
List any conditional logic that significantly affects the execution path

## Potential Issues
- Missing methods/functions
- Circular dependencies
- Unreachable code
- Error handling gaps

## Recommendations
Suggest any improvements to the execution flow or architecture

Provide a clear, traceable path from the entry point through the codebase, making it easy to understand how the code executes.`;
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
}

export default ExecutionTracer;