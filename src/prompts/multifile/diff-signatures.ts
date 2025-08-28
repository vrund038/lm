/**
 * Method Signature Differ Plugin
 * Compares method signatures between caller and callee to identify mismatches
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname, dirname, basename } from 'path';

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
    // Validate required parameters
    if (!params.callingFile || typeof params.callingFile !== 'string') {
      throw new Error('callingFile is required and must be a string path');
    }
    
    if (!params.calledClass || typeof params.calledClass !== 'string') {
      throw new Error('calledClass is required and must be a string');
    }
    
    if (!params.methodName || typeof params.methodName !== 'string') {
      throw new Error('methodName is required and must be a string');
    }
    
    // Resolve and validate calling file
    const callingFile = resolve(params.callingFile);
    
    if (!this.isPathSafe(callingFile)) {
      throw new Error(`Access denied to path: ${callingFile}`);
    }
    
    if (!existsSync(callingFile)) {
      throw new Error(`Calling file does not exist: ${callingFile}`);
    }
    
    // Read calling file
    let callingFileContent: string;
    try {
      callingFileContent = readFileSync(callingFile, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read calling file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Try to find the class definition file
    const classFiles = await this.findClassDefinition(params.calledClass, dirname(callingFile));
    
    if (classFiles.length === 0) {
      throw new Error(`Could not find definition for class: ${params.calledClass}`);
    }
    
    // Read class definition files
    const classFileContents: Record<string, string> = {};
    for (const classFile of classFiles) {
      try {
        classFileContents[classFile] = readFileSync(classFile, 'utf-8');
      } catch (error) {
        console.warn(`Could not read class file: ${classFile}`, error);
      }
    }
    
    // Generate analysis prompt
    const prompt = this.getPrompt({
      callingFile,
      callingFileContent,
      calledClass: params.calledClass,
      methodName: params.methodName,
      classFileContents
    });
    
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
          content: 'You are an expert method signature analyst. Compare method signatures between callers and callees, identify parameter mismatches, type incompatibilities, and provide specific fixes.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
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
      
      return {
        comparison: response,
        metadata: {
          callingFile: basename(callingFile),
          calledClass: params.calledClass,
          methodName: params.methodName,
          classFilesFound: classFiles.length,
          classFilesAnalyzed: Object.keys(classFileContents).length,
          modelUsed: model.identifier || 'unknown'
        }
      };
      
    } catch (error: any) {
      throw new Error(`Failed to diff method signatures: ${error.message}`);
    }
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
          content: 'You are an expert method signature analyst. Compare method signatures between callers and callees, identify parameter mismatches, type incompatibilities, and provide specific fixes.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
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
      
      return {
        comparison: response,
        metadata: {
          callingFile: basename(callingFile),
          calledClass: params.calledClass,
          methodName: params.methodName,
          classFilesFound: classFiles.length,
          classFilesAnalyzed: Object.keys(classFileContents).length,
          modelUsed: model.identifier || 'unknown'
        }
      };
      
    } catch (error: any) {
      throw new Error(`Failed to diff method signatures: ${error.message}`);
    }
  }

  getPrompt(params: any): string {
    const { callingFile, callingFileContent, calledClass, methodName, classFileContents } = params;
    
    // Format class files section
    let classFilesSection = '';
    Object.entries(classFileContents).forEach(([path, content]) => {
      const fileName = basename(path);
      classFilesSection += `\n${'='.repeat(80)}\nClass Definition File: ${fileName}\nPath: ${path}\n${'='.repeat(80)}\n${content}\n`;
    });
    
    return `You are an expert code analyst specializing in method signature analysis and parameter matching.

Analyze the method signature compatibility between a method call and its definition.

Target Method: ${calledClass}.${methodName} or ${calledClass}::${methodName}

CALLING FILE:
${'='.repeat(80)}
File: ${basename(callingFile)}
Path: ${callingFile}
${'='.repeat(80)}
${callingFileContent}

CLASS DEFINITION FILES:
${classFilesSection}

ANALYSIS REQUIREMENTS:

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
Brief overview of the signature comparison results

## Method Call Analysis
### Call Sites Found
For each call site:
- **Location**: [File:Line]
- **Call Syntax**: \`exact code\`
- **Parameters Passed**: 
  1. [param1]: [value/expression]
  2. [param2]: [value/expression]
  ...

## Method Definition Analysis
### Method Signature
- **Location**: [File:Line]
- **Full Signature**: \`exact signature\`
- **Parameters Expected**:
  1. [name]: [type] ${'{default value if any}'}
  2. [name]: [type] ${'{required/optional}'}
  ...
- **Return Type**: [type]
- **Modifiers**: [static/public/private/protected]

## Compatibility Results

### ✅ Compatible Aspects
- [List what matches correctly]

### ❌ Incompatible Aspects
- [List mismatches with severity]

### ⚠️ Warnings
- [List potential issues]

## Detailed Mismatch Analysis
For each mismatch:
- **Issue**: [Description]
- **Severity**: [Critical/High/Medium/Low]
- **Current**: \`current code\`
- **Expected**: \`expected code\`
- **Fix**: \`corrected code\`

## Recommendations
1. **Immediate Fixes** (Critical)
   - [Required changes to fix breaks]

2. **Improvements** (Non-breaking)
   - [Suggested enhancements]

3. **Best Practices**
   - [Code quality suggestions]

## Verification Steps
Steps to verify the fixes work:
1. [Step 1]
2. [Step 2]
...

Provide specific, actionable fixes for any signature mismatches found.`;
  }
  
  private async findClassDefinition(className: string, searchDir: string): Promise<string[]> {
    const foundFiles: string[] = [];
    const maxFiles = 10; // Limit search
    
    // First try to find in the same directory
    const localFiles = this.searchForClass(searchDir, className, maxFiles);
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
        const parentFiles = this.searchForClass(currentDir, className, maxFiles);
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
          const dirFiles = this.searchForClass(fullDir, className, maxFiles - foundFiles.length);
          foundFiles.push(...dirFiles);
          if (foundFiles.length >= maxFiles) break;
        }
      }
    }
    
    return foundFiles;
  }
  
  private searchForClass(dir: string, className: string, maxFiles: number): string[] {
    const foundFiles: string[] = [];
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.php', '.java', '.cs', '.cpp', '.hpp', '.py', '.rb'];
    
    // Common patterns for class file naming
    const possibleFileNames = [
      className, // ExactMatch.js
      className.charAt(0).toLowerCase() + className.slice(1), // camelCase.js
      className.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1), // kebab-case.js
      className.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1), // snake_case.js
    ];
    
    function traverse(currentDir: string, depth: number = 0) {
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
                traverse(fullPath, depth + 1);
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
                    const content = readFileSync(fullPath, 'utf-8');
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
    
    traverse(dir);
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
  
  private isPathSafe(path: string): boolean {
    const suspicious = ['../', '..\\', '/etc/', '\\etc\\', '/root/', '\\root\\'];
    const normalizedPath = path.toLowerCase();
    
    return !suspicious.some(pattern => normalizedPath.includes(pattern));
  }
}

export default SignatureDiffer;