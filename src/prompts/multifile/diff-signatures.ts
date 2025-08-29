/**
 * Method Signature Differ Plugin
 * Compares method signatures between caller and callee to identify mismatches
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname, dirname, basename } from 'path';
import { validateAndNormalizePath } from '../shared/helpers.js';
import { withSecurity } from '../../security/integration-helpers.js';

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
      // Validate required parameters
      if (!secureParams.callingFile || typeof secureParams.callingFile !== 'string') {
        throw new Error('callingFile is required and must be a string path');
      }
      
      if (!secureParams.calledClass || typeof secureParams.calledClass !== 'string') {
        throw new Error('calledClass is required and must be a string');
      }
      
      if (!secureParams.methodName || typeof secureParams.methodName !== 'string') {
        throw new Error('methodName is required and must be a string');
      }
      
      // Validate and resolve calling file using secure path validation
      const callingFile = await validateAndNormalizePath(secureParams.callingFile);
      
      if (!existsSync(callingFile)) {
        throw new Error(`Calling file does not exist: ${callingFile}`);
      }
      
      // Read calling file securely
      let callingFileContent: string;
      try {
        const { readFileContent } = await import('../shared/helpers.js');
        callingFileContent = await readFileContent(callingFile);
      } catch (error) {
        throw new Error(`Failed to read calling file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Try to find the class definition file
      const classFiles = await this.findClassDefinition(secureParams.calledClass, dirname(callingFile));
      
      if (classFiles.length === 0) {
        throw new Error(`Could not find definition for class: ${secureParams.calledClass}`);
      }
      
      // Read class definition files
      const classFileContents: Record<string, string> = {};
      const { readFileContent } = await import('../shared/helpers.js');
    for (const classFile of classFiles) {
      try {
        classFileContents[classFile] = await readFileContent(classFile);
      } catch (error) {
        console.warn(`Could not read class file: ${classFile}`, error);
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
    const totalContentLength = callingFileContent.length + Object.values(classFileContents).join('').length;
    const estimatedTokens = Math.floor(totalContentLength / 4) + systemOverhead; // Rough token estimate
    
    if (estimatedTokens > availableTokens) {
      // Process with chunking for large content
      return await this.executeWithChunking(params, callingFile, callingFileContent, classFileContents, llmClient, model, availableTokens);
    }
    
    // Process normally for small operations
    return await this.executeSinglePass(params, callingFile, callingFileContent, classFileContents, llmClient, model);
  }
  
  /**
   * Execute for small operations that fit in single context window
   */
  private async executeSinglePass(params: any, callingFile: string, callingFileContent: string, classFileContents: Record<string, string>, llmClient: any, model: any): Promise<any> {
    // Generate 3-stage prompt
    const promptStages = this.getPromptStages({
      callingFile,
      callingFileContent,
      calledClass: params.calledClass,
      methodName: params.methodName,
      classFileContents
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
        maxTokens: 3000
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
        'diff_method_signatures',
        response,
        model.identifier || 'unknown'
      );
      
    } catch (error: any) {
      return ResponseFactory.createErrorResponse(
        'diff_method_signatures',
        'MODEL_ERROR',
        `Failed to diff method signatures: ${error.message}`,
        { originalError: error.message },
        'unknown'
      );
    }
  }
  
  /**
   * Execute for large operations using content chunking
   */
  private async executeWithChunking(params: any, callingFile: string, callingFileContent: string, classFileContents: Record<string, string>, llmClient: any, model: any, availableTokens: number): Promise<any> {
    // For signature diffing, we need both caller and callee files
    // We'll process in chunks but maintain the relationship
    const allContent = [
      { type: 'calling', path: callingFile, content: callingFileContent },
      ...Object.entries(classFileContents).map(([path, content]) => ({ type: 'class', path, content }))
    ];
    
    const chunkResults: any[] = [];
    
    // Process calling file with each class file separately
    for (let i = 1; i < allContent.length; i++) {
      try {
        const chunkClassContents: Record<string, string> = {};
        chunkClassContents[allContent[i].path] = allContent[i].content;
        
        const result = await this.executeSinglePass(params, callingFile, callingFileContent, chunkClassContents, llmClient, model);
        
        chunkResults.push({
          chunkIndex: i - 1,
          classFile: allContent[i].path,
          result,
          success: true
        });
      } catch (error) {
        chunkResults.push({
          chunkIndex: i - 1,
          classFile: allContent[i].path,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }
    
    // Combine results
    const successfulChunks = chunkResults.filter(r => r.success);
    
    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'diff_method_signatures',
      JSON.stringify({
        summary: {
          totalChunks: chunkResults.length,
          successfulChunks: successfulChunks.length,
          callingFile,
          methodName: params.methodName,
          calledClass: params.calledClass
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
    const { callingFile, callingFileContent, calledClass, methodName, classFileContents } = params;
    
    // STAGE 1: System instructions and task context
    const systemAndContext = `You are an expert method signature analyst specializing in parameter matching and compatibility analysis.

Signature Comparison Context:
- Target method: ${calledClass}.${methodName} or ${calledClass}::${methodName}
- Calling file: ${basename(callingFile)}
- Class definition files: ${Object.keys(classFileContents).length}
- Task: Compare method signatures between caller and callee to identify parameter mismatches`;

    // STAGE 2: Data payload (calling file + class files)
    let dataPayload = '';
    
    // Add calling file first
    dataPayload += `\n${'='.repeat(80)}\nCALLING FILE\n${'='.repeat(80)}\nFile: ${basename(callingFile)}\nPath: ${callingFile}\n${'='.repeat(80)}\n${callingFileContent}\n`;
    
    // Add class definition files
    Object.entries(classFileContents).forEach(([path, content]) => {
      const fileName = basename(path);
      dataPayload += `\n${'='.repeat(80)}\nCLASS DEFINITION FILE\n${'='.repeat(80)}\nFile: ${fileName}\nPath: ${path}\n${'='.repeat(80)}\n${content}\n`;
    });

    // STAGE 3: Output instructions and analysis tasks
    const outputInstructions = `SIGNATURE ANALYSIS REQUIREMENTS:

ANALYSIS TASKS:

1. **Locate Method Call**
   - Find where ${methodName} is called on ${calledClass} in the calling file
   - Identify all call sites if there are multiple
   - Extract the exact parameters being passed
   - Note any parameter transformations or preparations

2. **Locate Method Definition**
   - Find the ${methodName} definition in ${calledClass}
   - Extract the complete method signature
   - Note parameter types, names, and default values
   - Check for method overloads if applicable

3. **Signature Comparison**
   - Compare number of parameters (required vs provided)
   - Check parameter types (if typed language)
   - Verify parameter order
   - Check for named parameter usage
   - Identify optional parameters and defaults

4. **Compatibility Analysis**
   - Determine if the call is compatible with the definition
   - Identify any type mismatches
   - Check for missing required parameters
   - Note extra parameters being passed
   - Verify return type expectations

5. **Context Analysis**
   - Check if the method is static or instance
   - Verify class instantiation if instance method
   - Check inheritance chain if method is inherited
   - Note any interface implementations

OUTPUT FORMAT:

## Summary
Brief overview of the signature comparison results and compatibility status

## Method Call Analysis
### Call Sites Found
For each call site discovered:
- **Location**: [File:Line]
- **Call Syntax**: \`exact code from file\`
- **Parameters Passed**: 
  1. [param1]: [value/expression] - [type if determinable]
  2. [param2]: [value/expression] - [type if determinable]
  ...
- **Call Context**: [static/instance, object context]

## Method Definition Analysis
### Method Signature
- **Location**: [File:Line]
- **Full Signature**: \`exact signature from code\`
- **Parameters Expected**:
  1. [name]: [type] {default value if any} - [required/optional]
  2. [name]: [type] {required/optional}
  ...
- **Return Type**: [type]
- **Modifiers**: [static/public/private/protected/abstract/etc.]
- **Class Context**: [inheritance info if relevant]

## Compatibility Results

### ✅ Compatible Aspects
List everything that matches correctly:
- [Parameter count matches]
- [Types are compatible]
- [Call context is correct]

### ❌ Critical Incompatibilities
Issues that will cause runtime errors:
- **Issue**: [Specific problem description]
  **Severity**: Critical
  **Current**: \`current calling code\`
  **Expected**: \`expected signature\`
  **Fix**: \`corrected calling code\`

### ⚠️ Potential Issues
Issues that might cause problems:
- **Issue**: [Description]
  **Severity**: [High/Medium]
  **Risk**: [What could go wrong]
  **Recommendation**: [How to address]

## Detailed Mismatch Analysis
For each specific mismatch found:

### Parameter Mismatch [N]
- **Parameter**: [name/position]
- **Issue Type**: [missing/extra/type-mismatch/order-wrong]
- **Current**: \`what's being passed\`
- **Expected**: \`what signature requires\`
- **Fix**: \`exact code correction\`
- **Impact**: [What happens if not fixed]

## Type Compatibility Assessment
- **Language**: [JavaScript/TypeScript/PHP/etc.]
- **Type System**: [Dynamic/Static/Gradual]
- **Type Checking**: [Runtime/Compile-time/None]
- **Compatibility Score**: [X/10] with explanation

## Recommendations

### 1. Immediate Fixes (Critical)
Must be fixed to prevent runtime errors:
- [Specific actionable fix with code]
- [Another fix if needed]

### 2. Improvements (Non-breaking)
Suggestions for better code quality:
- [Type annotations if applicable]
- [Parameter validation improvements]
- [Error handling suggestions]

### 3. Best Practices
Long-term code quality suggestions:
- [Interface definitions]
- [Documentation improvements]
- [Testing recommendations]

## Code Examples

### Before (Current Code)
\`\`\`[language]
[current calling code]
\`\`\`

### After (Fixed Code)
\`\`\`[language]
[corrected calling code with proper parameters]
\`\`\`

## Verification Steps
Steps to verify the fixes work correctly:
1. **Syntax Check**: [How to verify syntax is correct]
2. **Type Check**: [How to verify types match]
3. **Runtime Test**: [Suggested test cases]
4. **Integration Test**: [How to test in context]

## Additional Notes
Any other observations about code quality, architecture, or potential improvements.

Provide specific, actionable fixes for any signature mismatches found, with exact code that can be copied and applied directly.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }
  
  private async findClassDefinition(className: string, searchDir: string): Promise<string[]> {
    const foundFiles: string[] = [];
    const maxFiles = 10; // Limit search
    
    // First try to find in the same directory
    const localFiles = await this.searchForClass(searchDir, className, maxFiles);
    foundFiles.push(...localFiles);
    
    // If not found locally, try parent directories (up to project root)
    if (foundFiles.length === 0) {
      let currentDir = searchDir;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts && foundFiles.length === 0) {
        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) break; // Reached root
        
        currentDir = parentDir;
        const parentFiles = await this.searchForClass(currentDir, className, maxFiles);
        foundFiles.push(...parentFiles);
        attempts++;
      }
    }
    
    // If still not found, try common source directories
    if (foundFiles.length === 0) {
      const projectRoot = this.findProjectRoot(searchDir);
      const commonDirs = ['src', 'lib', 'app', 'includes', 'classes'];
      
      for (const dir of commonDirs) {
        const fullDir = join(projectRoot, dir);
        if (existsSync(fullDir)) {
          const dirFiles = await this.searchForClass(fullDir, className, maxFiles - foundFiles.length);
          foundFiles.push(...dirFiles);
          if (foundFiles.length >= maxFiles) break;
        }
      }
    }
    
    return foundFiles;
  }
  
  private async searchForClass(dir: string, className: string, maxFiles: number): Promise<string[]> {
    const foundFiles: string[] = [];
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.php', '.java', '.cs', '.cpp', '.hpp', '.py', '.rb'];
    
    // Common patterns for class file naming
    const possibleFileNames = [
      className, // ExactMatch.js
      className.charAt(0).toLowerCase() + className.slice(1), // camelCase.js
      className.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1), // kebab-case.js
      className.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1), // snake_case.js
    ];
    
    async function traverse(currentDir: string, depth: number = 0): Promise<void> {
      if (foundFiles.length >= maxFiles || depth > 3) return;
      
      try {
        const entries = readdirSync(currentDir);
        
        for (const entry of entries) {
          if (foundFiles.length >= maxFiles) break;
          
          const fullPath = join(currentDir, entry);
          
          try {
            const stat = statSync(fullPath);
            
            if (stat.isDirectory()) {
              // Skip common non-source directories
              if (!['node_modules', '.git', 'vendor', 'dist', 'build'].includes(entry)) {
                await traverse(fullPath, depth + 1);
              }
            } else if (stat.isFile()) {
              const ext = extname(entry).toLowerCase();
              const nameWithoutExt = basename(entry, ext);
              
              if (codeExtensions.includes(ext)) {
                // Check if filename might contain the class
                if (possibleFileNames.some(name => nameWithoutExt.includes(name))) {
                  foundFiles.push(fullPath);
                } else {
                  // Quick content check for class definition
                  try {
                    const { readFileContent } = await import('../shared/helpers.js');
                    const content = await readFileContent(fullPath);
                    if (content.includes(`class ${className}`) || 
                        content.includes(`interface ${className}`) ||
                        content.includes(`export class ${className}`) ||
                        content.includes(`export default class ${className}`)) {
                      foundFiles.push(fullPath);
                    }
                  } catch {
                    // Skip files we can't read
                  }
                }
              }
            }
          } catch {
            // Skip entries we can't stat
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }
    
    await traverse(dir);
    return foundFiles;
  }
  
  private findProjectRoot(startDir: string): string {
    let currentDir = startDir;
    const maxLevels = 10;
    let level = 0;
    
    while (level < maxLevels) {
      // Check for project indicators
      const indicators = ['package.json', '.git', 'composer.json', 'pom.xml'];
      
      for (const indicator of indicators) {
        if (existsSync(join(currentDir, indicator))) {
          return currentDir;
        }
      }
      
      const parentDir = dirname(currentDir);
      if (parentDir === currentDir) break; // Reached root
      
      currentDir = parentDir;
      level++;
    }
    
    return startDir; // Default to start directory
  }
  
  /**
   * Get prompt for BasePlugin interface compatibility
   */
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }

  private isPathSafe(path: string): boolean {
    const suspicious = ['../', '..\\', '/etc/', '\\etc\\', '/root/', '\\root\\'];
    const normalizedPath = path.toLowerCase();
    
    return !suspicious.some(pattern => normalizedPath.includes(pattern));
  }
}

export default SignatureDiffer;