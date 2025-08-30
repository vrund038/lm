/**
 * Method Signature Differ Plugin
 * Compares method signatures between caller and callee to identify mismatches
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname, dirname, basename } from 'path';
import { validateAndNormalizePath } from '../shared/helpers.js';

export class SignatureDiffer extends BasePlugin implements IPromptPlugin {
  name = 'diff_method_signatures';
  category = 'multifile' as const;
  description = 'Compare method signatures between caller and callee to identify parameter mismatches.';
  
  parameters = {
    callingFile: {
      type: 'string' as const,
      description: 'Absolute path to file containing the method call',
      required: true
    },
    calledClass: {
      type: 'string' as const,
      description: 'Class name containing the called method',
      required: true
    },
    methodName: {
      type: 'string' as const,
      description: 'Name of the method to check',
      required: true
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // Validate parameters
        this.validateSecureParams(secureParams);
        
        // Read calling file
        const callingFile = secureParams.callingFile;
        if (!existsSync(callingFile)) {
          throw new Error(`Calling file not found: ${callingFile}`);
        }
        
        const callingFileContent = readFileSync(callingFile, 'utf-8');
        
        // Find files that might contain the called class
        const classFiles = await this.findClassFiles(secureParams.calledClass, dirname(callingFile));
        
        if (classFiles.length === 0) {
          throw new Error(`Could not find any files containing class: ${secureParams.calledClass}`);
        }
        
        // Read class file contents
        const classFileContents: Record<string, string> = {};
        for (const file of classFiles) {
          try {
            classFileContents[file] = readFileSync(file, 'utf-8');
          } catch (error) {
            // Skip files we can't read
          }
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
          callingFileContent,
          classFileContents
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
          'diff_method_signatures',
          'EXECUTION_ERROR',
          `Failed to compare method signatures: ${error.message}`,
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
      'diff_method_signatures',
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
      'diff_method_signatures',
      response,
      model.identifier || 'unknown'
    );
  }

  // MODERN PATTERN: Secure parameter validation
  private validateSecureParams(params: any): void {
    if (!params.callingFile || typeof params.callingFile !== 'string') {
      throw new Error('callingFile is required and must be a string');
    }
    
    if (!params.calledClass || typeof params.calledClass !== 'string') {
      throw new Error('calledClass is required and must be a string');
    }
    
    if (!params.methodName || typeof params.methodName !== 'string') {
      throw new Error('methodName is required and must be a string');
    }
  }

  getPromptStages(params: any): PromptStages {
    const { callingFile, calledClass, methodName, callingFileContent, classFileContents } = params;
    
    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert code analyzer specializing in method signature comparison and compatibility analysis.

Method Signature Analysis Context:
- Calling File: ${basename(callingFile)}
- Called Class: ${calledClass}
- Method Name: ${methodName}
- Analysis Focus: Parameter compatibility, type mismatches, signature differences

Your task is to:
1. Identify the method signature in the calling file
2. Find the corresponding method in the class definition
3. Compare signatures for compatibility issues
4. Provide specific recommendations for fixes`;

    // STAGE 2: Code analysis data
    let dataPayload = '=== CALLING FILE CONTENT ===\n';
    dataPayload += `File: ${callingFile}\n`;
    dataPayload += callingFileContent + '\n\n';
    
    dataPayload += '=== CLASS DEFINITION FILES ===\n';
    Object.entries(classFileContents).forEach(([file, content]) => {
      dataPayload += `File: ${file}\n`;
      dataPayload += content + '\n';
      dataPayload += '-'.repeat(80) + '\n';
    });

    // STAGE 3: Analysis instructions
    const outputInstructions = `Analyze the method signature compatibility between the caller and callee.

## Required Analysis:

### 1. Method Call Analysis
- Locate the call to ${calledClass}::${methodName} in the calling file
- Extract the parameters being passed
- Note the calling context and variable types

### 2. Method Definition Analysis  
- Find the ${methodName} method definition in class ${calledClass}
- Document the expected parameter signature
- Note parameter types, order, and optional parameters

### 3. Compatibility Assessment
- Compare the call signature with the method definition
- Identify any mismatches in:
  - Parameter count
  - Parameter types
  - Parameter order
  - Required vs optional parameters
  - Default values

### 4. Issues Found
For each issue:
- **Type**: Parameter mismatch type
- **Location**: Line numbers in both files
- **Expected**: What the method expects
- **Actual**: What is being passed
- **Severity**: Critical/High/Medium/Low
- **Impact**: Potential runtime effects

### 5. Recommendations
- Specific code changes needed
- Type casting suggestions
- Parameter reordering if needed
- Alternative approaches if applicable

## Output Format:
- Use clear headings and bullet points
- Include code snippets showing issues
- Provide line numbers for all findings
- Give actionable fix recommendations`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }

  /**
   * Find files that might contain the specified class
   */
  private async findClassFiles(className: string, searchDir: string): Promise<string[]> {
    const classFiles: string[] = [];
    const maxFiles = 50; // Limit search scope
    
    const searchDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
      if (depth > 3 || classFiles.length >= maxFiles) return; // Limit depth and files
      
      try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (classFiles.length >= maxFiles) break;
          
          const fullPath = join(dirPath, entry.name);
          
          // Skip common ignore patterns
          if (this.shouldIgnore(entry.name)) continue;
          
          if (entry.isDirectory()) {
            await searchDirectory(fullPath, depth + 1);
          } else if (entry.isFile() && this.isCodeFile(entry.name)) {
            // Check if file might contain the class
            if (await this.fileContainsClass(fullPath, className)) {
              classFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    await searchDirectory(searchDir);
    return classFiles;
  }

  /**
   * Check if we should ignore this file/directory
   */
  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules', '.git', 'dist', 'build', 'coverage',
      '__pycache__', 'vendor', '.idea', '.vscode'
    ];
    
    return ignorePatterns.some(pattern => name.includes(pattern));
  }

  /**
   * Check if this is a code file we should search
   */
  private isCodeFile(filename: string): boolean {
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.c'];
    return codeExtensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Check if a file contains a class definition
   */
  private async fileContainsClass(filePath: string, className: string): Promise<boolean> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      
      // Simple heuristic - look for class definition patterns
      const classPatterns = [
        new RegExp(`class\\s+${className}\\s*{`, 'i'),
        new RegExp(`class\\s+${className}\\s+extends`, 'i'),
        new RegExp(`class\\s+${className}\\s+implements`, 'i'),
        new RegExp(`export\\s+class\\s+${className}`, 'i'),
        new RegExp(`function\\s+${className}\\s*\\(`, 'i'), // Constructor function
      ];
      
      return classPatterns.some(pattern => pattern.test(content));
    } catch (error) {
      return false;
    }
  }

}

export default SignatureDiffer;
