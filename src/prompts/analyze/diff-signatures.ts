/**
 * Plugin Template - Modern v4.2 (Single Source of Truth)
 * 
 * Universal template that intelligently handles both single-file and multi-file analysis
 * Automatically detects analysis type based on provided parameters
 * 
 * Copy this template for creating any new plugin - it adapts to your needs
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { readFileContent } from '../shared/helpers.js';
import { 
  ModelSetup, 
  ResponseProcessor, 
  ParameterValidator, 
  ErrorHandler,
  MultiFileAnalysis
} from '../../utils/plugin-utilities.js';
import { getAnalysisCache } from '../../cache/index.js';

export class MethodSignatureDiffer extends BasePlugin implements IPromptPlugin {
  name = 'diff_method_signatures';
  category = 'analyze' as const;
  description = 'Compare method signatures between caller and callee to identify parameter mismatches and provide actionable fixes';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'The code to analyze (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single file to analyze',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Path to project root (for multi-file analysis)',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific file paths (for multi-file analysis)',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for multi-file discovery (1-5)',
      required: false,
      default: 3
    },
    
    // Specific parameters for method signature comparison
    callingFile: {
      type: 'string' as const,
      description: 'Absolute path to file containing the method call',
      required: false
    },
    calledClass: {
      type: 'string' as const,
      description: 'Class name containing the called method',
      required: false
    },
    methodName: {
      type: 'string' as const,
      description: 'Name of the method to check',
      required: false
    },
    
    // Universal parameters
    language: {
      type: 'string' as const,
      description: 'Programming language',
      required: false,
      default: 'javascript'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of analysis detail',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of analysis to perform',
      enum: ['signature', 'compatibility', 'comprehensive'],
      default: 'comprehensive',
      required: false
    }
  };

  private analysisCache = getAnalysisCache();
  private multiFileAnalysis = new MultiFileAnalysis();

  constructor() {
    super();
    // Cache and analysis utilities are initialized above
  }

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // 1. Auto-detect analysis mode based on parameters
        const analysisMode = this.detectAnalysisMode(secureParams);
        
        // 2. Validate parameters based on detected mode
        this.validateParameters(secureParams, analysisMode);
        
        // 3. Setup model
        const { model, contextLength } = await ModelSetup.getReadyModel(llmClient);
        
        // 4. Route to appropriate analysis method
        if (analysisMode === 'single-file') {
          return await this.executeSingleFileAnalysis(secureParams, model, contextLength);
        } else {
          return await this.executeMultiFileAnalysis(secureParams, model, contextLength);
        }
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('diff_method_signatures', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file indicators take priority (avoids default parameter issues)
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators - method signature comparison typically requires multiple files
    if (params.projectPath || params.files || 
        (params.callingFile && params.calledClass)) {
      return 'multi-file';
    }
    
    // Default to multi-file for method signature comparison
    return 'multi-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      ParameterValidator.validateCodeOrFile(params);
    } else {
      // For multi-file method signature comparison, we need either:
      // 1. Specific method signature params (callingFile + calledClass + methodName)
      // 2. General project analysis params (projectPath)
      if (params.callingFile && params.calledClass && params.methodName) {
        // Specific method signature comparison
        if (!params.callingFile || typeof params.callingFile !== 'string') {
          throw new Error('callingFile is required and must be a string for method signature comparison');
        }
        if (!params.calledClass || typeof params.calledClass !== 'string') {
          throw new Error('calledClass is required and must be a string for method signature comparison');
        }
        if (!params.methodName || typeof params.methodName !== 'string') {
          throw new Error('methodName is required and must be a string for method signature comparison');
        }
      } else {
        // General project analysis
        ParameterValidator.validateProjectPath(params);
        ParameterValidator.validateDepth(params);
      }
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['signature', 'compatibility', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
  }

  /**
   * Execute single-file analysis
   */
  private async executeSingleFileAnalysis(params: any, model: any, contextLength: number) {
    // Process single file input
    let codeToAnalyze = params.code;
    if (params.filePath) {
      codeToAnalyze = await readFileContent(params.filePath);
    }
    
    // Generate prompt stages for single file
    const promptStages = this.getSingleFilePromptStages({
      ...params,
      code: codeToAnalyze
    });
    
    // Execute with appropriate method
    const promptManager = new ThreeStagePromptManager(contextLength);
    const needsChunking = promptManager.needsChunking(promptStages);
    
    if (needsChunking) {
      const conversation = promptManager.createChunkedConversation(promptStages);
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      return await ResponseProcessor.executeChunked(
        messages,
        model,
        contextLength,
        'diff_method_signatures',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'diff_method_signatures'
      );
    }
  }

  /**
   * Execute multi-file analysis
   */
  private async executeMultiFileAnalysis(params: any, model: any, contextLength: number) {
    // For specific method signature comparison
    if (params.callingFile && params.calledClass && params.methodName) {
      return await this.executeSpecificMethodComparison(params, model, contextLength);
    }
    
    // For general project analysis
    let filesToAnalyze: string[] = params.files || 
      await this.discoverRelevantFiles(
        params.projectPath, 
        params.maxDepth,
        params.analysisType
      );
    
    // Perform multi-file analysis with caching
    const analysisResult = await this.performMultiFileAnalysis(
      filesToAnalyze,
      params,
      model,
      contextLength
    );
    
    // Generate prompt stages for multi-file
    const promptStages = this.getMultiFilePromptStages({
      ...params,
      analysisResult,
      fileCount: filesToAnalyze.length
    });
    
    // Always use chunking for multi-file
    const promptManager = new ThreeStagePromptManager(contextLength);
    const conversation = promptManager.createChunkedConversation(promptStages);
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];
    
    return await ResponseProcessor.executeChunked(
      messages,
      model,
      contextLength,
      'diff_method_signatures',
      'multifile'
    );
  }

  /**
   * Execute specific method signature comparison
   */
  private async executeSpecificMethodComparison(params: any, model: any, contextLength: number) {
    try {
      // Read calling file
      const callingFileContent = await readFileContent(params.callingFile);
      
      // Find files that might contain the called class
      const { dirname } = await import('path');
      const projectDir = dirname(params.callingFile);
      const classFiles = await this.findClassFiles(params.calledClass, projectDir);
      
      if (classFiles.length === 0) {
        throw new Error(`Could not find any files containing class: ${params.calledClass}`);
      }
      
      // Read class file contents
      const classFileContents: Record<string, string> = {};
      for (const file of classFiles) {
        try {
          classFileContents[file] = await readFileContent(file);
        } catch (error) {
          // Skip files we can't read
        }
      }
      
      // Generate prompt stages for specific comparison
      const promptStages = this.getSpecificComparisonPromptStages({
        ...params,
        callingFileContent,
        classFileContents
      });
      
      // Execute with appropriate method
      const promptManager = new ThreeStagePromptManager(contextLength);
      const needsChunking = promptManager.needsChunking(promptStages);
      
      if (needsChunking) {
        const conversation = promptManager.createChunkedConversation(promptStages);
        const messages = [
          conversation.systemMessage,
          ...conversation.dataMessages,
          conversation.analysisMessage
        ];
        
        return await ResponseProcessor.executeChunked(
          messages,
          model,
          contextLength,
          'diff_method_signatures',
          'multifile'
        );
      } else {
        return await ResponseProcessor.executeDirect(
          promptStages,
          model,
          contextLength,
          'diff_method_signatures'
        );
      }
      
    } catch (error: any) {
      return ErrorHandler.createExecutionError('diff_method_signatures', error);
    }
  }

  /**
   * Single-file prompt stages for method signature analysis within one file
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType } = params;
    
    const systemAndContext = `You are a senior software engineer and code review expert specializing in ${analysisDepth} method signature analysis and compatibility assessment.

**Your Expertise:**
- 15+ years of experience in ${language} development
- Deep understanding of method signatures, parameter passing, and type systems
- Expert in identifying compatibility issues that cause runtime errors
- Skilled at providing actionable, specific fix recommendations

**Analysis Context:**
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Mode: Single File Analysis

**Your Mission:**
Analyze method signatures within this file to identify potential compatibility issues, parameter mismatches, and provide concrete solutions that prevent runtime errors.`;

    const dataPayload = `File content to analyze for method signature issues:

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `**COMPREHENSIVE METHOD SIGNATURE ANALYSIS**

Provide your analysis in this structured format:

## Method Signature Issues Found

### Issue 1: [Type of Issue]
- **Method**: \`methodName()\`
- **Location**: Line X
- **Problem**: Clear description of the signature issue
- **Severity**: Critical/High/Medium/Low
- **Impact**: What happens at runtime
- **Fix**: Specific code change needed

### Issue 2: [Type of Issue]
[Continue for all issues found...]

## Method Compatibility Assessment

### Well-Defined Methods ✅
- List methods with clear, compatible signatures

### Problematic Methods ⚠️
- List methods with potential issues

## Recommendations

### Immediate Actions Required
1. [Most critical fixes needed]
2. [Second priority fixes]

### Long-term Improvements
1. [Architectural suggestions]
2. [Best practice recommendations]

## Code Examples

### Before (Problematic):
\`\`\`${language}
// Show problematic signature
\`\`\`

### After (Fixed):
\`\`\`${language}
// Show corrected signature
\`\`\`

**Analysis Confidence**: X%`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file prompt stages for cross-file method signature analysis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount } = params;
    
    const systemAndContext = `You are a senior software architect and integration specialist with ${analysisDepth} expertise in cross-file method signature compatibility.

**Your Expertise:**
- 20+ years of experience in large-scale software architecture
- Expert in identifying integration issues between modules and classes
- Deep knowledge of method signature compatibility across file boundaries
- Proven track record of preventing runtime integration failures

**Analysis Context:**
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Mode: Cross-File Integration Analysis

**Your Mission:**
Analyze method signatures across multiple files to identify integration risks, compatibility issues, and provide architectural recommendations for bulletproof inter-module communication.`;

    const dataPayload = `Cross-file method signature analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**CROSS-FILE METHOD SIGNATURE COMPATIBILITY REPORT**

## Executive Summary
- **Total Integration Points**: [number]
- **Critical Issues**: [number]
- **Files at Risk**: [list]
- **Overall Compatibility**: [percentage]

## Critical Integration Issues

### Issue 1: Method Signature Mismatch
- **Caller**: \`File A, Line X\`
- **Callee**: \`File B, Line Y\`
- **Method**: \`className.methodName()\`
- **Problem**: Detailed description of signature incompatibility
- **Runtime Impact**: What breaks when this is called
- **Severity**: Critical/High/Medium/Low
- **Fix Strategy**: Step-by-step resolution approach

[Continue for all critical issues...]

## Architecture Assessment

### Stable Integration Points ✅
- List well-designed, compatible method signatures

### Fragile Integration Points ⚠️
- List risky method calls requiring attention

### Missing Integration Points ❌
- Methods called but not found

## Compatibility Matrix

| Caller File | Called Class | Method | Status | Risk Level |
|-------------|--------------|---------|---------|------------|
| FileA.js | ClassB | methodX | ⚠️ Mismatch | High |
| FileC.ts | ClassD | methodY | ✅ Compatible | Low |

## Actionable Remediation Plan

### Phase 1: Critical Fixes (Do Now)
1. **Fix signature mismatch in ClassB.methodX**
   - Change: \`methodX(param1)\` → \`methodX(param1, param2)\`
   - Files to update: [specific files and lines]
   - Test strategy: [how to verify fix]

### Phase 2: Preventive Measures (Next Sprint)
1. [Improvements to prevent future issues]
2. [Tooling or process changes]

### Phase 3: Architecture Improvements (Future)
1. [Systematic improvements to method design]
2. [Interface standardization recommendations]

## Code Fixes

### Critical Fix Example:
**Before (Broken):**
\`\`\`javascript
// Caller expects: user.updateProfile(name, email)  
// Method provides: updateProfile(profileData)
\`\`\`

**After (Fixed):**
\`\`\`javascript
// Updated method signature for compatibility
\`\`\`

**Risk Assessment**: [Low/Medium/High] risk of regression`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Specific comparison prompt stages for targeted method signature analysis
   */
  private getSpecificComparisonPromptStages(params: any): PromptStages {
    const { callingFile, calledClass, methodName, callingFileContent, classFileContents } = params;
    
    const getBasename = (filePath: string) => {
      const parts = filePath.replace(/\\/g, '/').split('/');
      return parts[parts.length - 1];
    };
    
    const systemAndContext = `You are a world-class debugging specialist and method signature expert with forensic-level attention to detail.

**Your Expertise:**
- 25+ years of experience hunting down method signature bugs
- Expert in parameter compatibility, type coercion, and runtime behavior
- Legendary ability to spot subtle signature mismatches that cause production failures
- Known for providing surgical-precision fixes that solve problems permanently

**Debugging Mission:**
- **Target Method**: \`${calledClass}.${methodName}()\`
- **Calling File**: ${getBasename(callingFile)}
- **Called Class**: ${calledClass}

**Your Task:**
Perform forensic analysis of this specific method signature issue. Find the exact incompatibility, understand the runtime impact, and provide a bulletproof fix.`;

    const dataPayload = `**=== CALLING FILE CONTENT ===**
File: ${callingFile}

${callingFileContent}

**=== CLASS DEFINITION FILES ===**
${Object.entries(classFileContents).map(([file, content]) => 
  `File: ${file}\n${content}\n${'='.repeat(80)}`
).join('\n\n')}`;

    const outputInstructions = `**FORENSIC METHOD SIGNATURE ANALYSIS**

## Method Call Investigation

### 1. Call Site Analysis
- **File**: ${require('path').basename(callingFile)}
- **Line Number**: [exact line]
- **Call Pattern**: \`${calledClass}.${methodName}(parameters here)\`
- **Parameters Passed**: 
  1. \`param1\` - Type: [type], Value: [value/expression]
  2. \`param2\` - Type: [type], Value: [value/expression]
  [Continue for all parameters...]

### 2. Method Definition Analysis
- **File**: [which file contains the class]
- **Line Number**: [exact line]
- **Method Signature**: \`${methodName}(expected parameters)\`
- **Expected Parameters**:
  1. \`param1\` - Type: [expected type], Required: [yes/no], Default: [if any]
  2. \`param2\` - Type: [expected type], Required: [yes/no], Default: [if any]
  [Continue for all parameters...]

### 3. Compatibility Assessment

#### ✅ Compatible Aspects
- [List what's working correctly]

#### ❌ Incompatibilities Found
1. **Parameter Count Mismatch**
   - Passed: X parameters
   - Expected: Y parameters
   - Impact: [specific runtime behavior]

2. **Type Mismatches**
   - Parameter 1: Passing [actualType] but expecting [expectedType]
   - Parameter 2: [continue analysis...]

3. **Parameter Order Issues**
   - [If parameters are in wrong order]

## Runtime Impact Analysis

### What Happens When This Runs:
- **Best Case**: [if it somehow works]
- **Most Likely**: [typical failure mode]
- **Worst Case**: [catastrophic failure scenario]

### Error Messages You'll See:
\`\`\`
[Likely error messages or unexpected behavior]
\`\`\`

## Surgical Fix

### Option 1: Update Method Call (Recommended)
**File**: ${require('path').basename(callingFile)}
**Change this:**
\`\`\`javascript
${calledClass}.${methodName}(current_call_here)
\`\`\`

**To this:**
\`\`\`javascript
${calledClass}.${methodName}(corrected_call_here)
\`\`\`

### Option 2: Update Method Definition (If Needed)
**File**: [class definition file]
**Change the method signature if the call is correct but definition is wrong**

### Option 3: Adapter Pattern (For Complex Cases)
\`\`\`javascript
// If both sides have valid reasons to stay as-is
const adapter = {
  ${methodName}: (callerParams) => {
    return ${calledClass}.${methodName}(convertedParams);
  }
};
\`\`\`

## Testing Strategy
1. **Unit Test**: [specific test to verify fix]
2. **Integration Test**: [test the full call path]
3. **Regression Prevention**: [ensure fix doesn't break other callers]

**Confidence Level**: [High/Medium/Low] - with reasoning

**Fix Complexity**: [Simple/Moderate/Complex] - estimated effort required`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement for backwards compatibility
   * The system still expects this method, so we intelligently route to the appropriate stages
   */
  getPromptStages(params: any): PromptStages {
    const mode = this.detectAnalysisMode(params);
    
    // If we have specific method comparison parameters
    if (params.callingFile && params.calledClass && params.methodName) {
      return this.getSpecificComparisonPromptStages(params);
    }
    
    if (mode === 'single-file') {
      return this.getSingleFilePromptStages(params);
    } else {
      return this.getMultiFilePromptStages(params);
    }
  }

  // Multi-file helper methods
  private async discoverRelevantFiles(
    projectPath: string, 
    maxDepth: number,
    analysisType: string
  ): Promise<string[]> {
    const extensions = this.getFileExtensions(analysisType);
    return await this.multiFileAnalysis.discoverFiles(projectPath, extensions, maxDepth);
  }

  private async performMultiFileAnalysis(
    files: string[],
    params: any,
    model: any,
    contextLength: number
  ): Promise<any> {
    const cacheKey = this.analysisCache.generateKey(
      'diff_method_signatures', 
      params, 
      files
    );
    
    const cached = await this.analysisCache.get(cacheKey);
    if (cached) return cached;
    
    const fileAnalysisResults = await this.multiFileAnalysis.analyzeBatch(
      files,
      (file: string) => this.analyzeIndividualFile(file, params, model),
      contextLength
    );
    
    // Aggregate results into proper analysis result format
    const aggregatedResult = {
      summary: `Method signature analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        methodCalls: this.extractMethodCalls(fileAnalysisResults),
        classDefinitions: this.extractClassDefinitions(fileAnalysisResults)
      }
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now() - Date.now(), // TODO: Track actual execution time
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async analyzeIndividualFile(file: string, params: any, model: any): Promise<any> {
    const content = await import('fs/promises').then(fs => fs.readFile(file, 'utf-8'));
    
    return {
      filePath: file,
      size: content.length,
      lines: content.split('\n').length,
      extension: await import('path').then(p => p.extname(file)),
      // Extract method calls and class definitions for signature analysis
      methodCalls: this.findMethodCallsInContent(content),
      classDefinitions: this.findClassDefinitionsInContent(content)
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'signature': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java'],
      'compatibility': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java'], 
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private extractMethodCalls(results: any[]): any[] {
    return results.flatMap(result => result.methodCalls || []);
  }

  private extractClassDefinitions(results: any[]): any[] {
    return results.flatMap(result => result.classDefinitions || []);
  }

  private findMethodCallsInContent(content: string): any[] {
    // Simple heuristic to find method calls - can be enhanced
    const methodCallPattern = /(\w+)\.(\w+)\s*\(/g;
    const calls = [];
    let match;
    
    while ((match = methodCallPattern.exec(content)) !== null) {
      calls.push({
        object: match[1],
        method: match[2],
        line: content.substring(0, match.index).split('\n').length
      });
    }
    
    return calls;
  }

  private findClassDefinitionsInContent(content: string): any[] {
    // Simple heuristic to find class definitions
    const classPattern = /class\s+(\w+)/g;
    const classes = [];
    let match;
    
    while ((match = classPattern.exec(content)) !== null) {
      classes.push({
        name: match[1],
        line: content.substring(0, match.index).split('\n').length
      });
    }
    
    return classes;
  }

  /**
   * Find files that might contain the specified class
   */
  private async findClassFiles(className: string, searchDir: string): Promise<string[]> {
    const files = await this.multiFileAnalysis.discoverFiles(
      searchDir,
      ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java'],
      3
    );
    
    const classFiles: string[] = [];
    
    for (const file of files) {
      try {
        const content = await readFileContent(file);
        if (this.fileContainsClass(content, className)) {
          classFiles.push(file);
        }
      } catch (error) {
        // Skip files we can't read
      }
    }
    
    return classFiles;
  }

  private fileContainsClass(content: string, className: string): boolean {
    const classPatterns = [
      new RegExp(`class\\s+${className}\\s*{`, 'i'),
      new RegExp(`class\\s+${className}\\s+extends`, 'i'),
      new RegExp(`class\\s+${className}\\s+implements`, 'i'),
      new RegExp(`export\\s+class\\s+${className}`, 'i'),
      new RegExp(`function\\s+${className}\\s*\\(`, 'i'), // Constructor function
    ];
    
    return classPatterns.some(pattern => pattern.test(content));
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default MethodSignatureDiffer;
