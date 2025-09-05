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
  MultiFileAnalysis,
  TokenCalculator
} from '../../utils/plugin-utilities.js';
import { getAnalysisCache } from '../../cache/index.js';

export class IntegrationComparator extends BasePlugin implements IPromptPlugin {
  name = 'compare_integration';
  category = 'analyze' as const;
  description = 'Compare integration between multiple files to identify mismatches, missing imports, and compatibility issues. Returns actionable fixes with line numbers.';
  
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
      description: 'Array of absolute file paths to analyze',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for multi-file discovery (1-5)',
      required: false,
      default: 3
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
      description: 'Type of integration analysis to perform',
      enum: ['integration', 'compatibility', 'dependencies'],
      default: 'integration',
      required: false
    },
    focus: {
      type: 'array' as const,
      description: 'Specific areas to focus on: method_compatibility, namespace_dependencies, data_flow, missing_connections',
      required: false,
      default: [],
      items: { type: 'string' as const }
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
        return ErrorHandler.createExecutionError('compare_integration', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   * Integration comparison is primarily a multi-file operation
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file indicators (for analyzing integration patterns within one file)
    if (params.code || (params.filePath && !params.files && !params.projectPath)) {
      return 'single-file';
    }
    
    // Multi-file indicators - primary use case
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default to multi-file for integration comparison
    return 'multi-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      ParameterValidator.validateCodeOrFile(params);
    } else {
      // For multi-file, we need either projectPath OR files (at least 2)
      if (!params.projectPath && (!params.files || params.files.length < 2)) {
        throw new Error('Multi-file integration analysis requires either projectPath or at least 2 files');
      }
      if (params.projectPath) {
        ParameterValidator.validateProjectPath(params);
        ParameterValidator.validateDepth(params);
      }
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['integration', 'compatibility', 'dependencies']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
  }

  /**
   * Execute single-file analysis for integration patterns
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
    const promptManager = new ThreeStagePromptManager();
    const needsChunking = TokenCalculator.needsChunking(promptStages, contextLength);
    
    if (needsChunking) {
      const chunkSize = TokenCalculator.calculateOptimalChunkSize(promptStages, contextLength);
      const dataChunks = promptManager.chunkDataPayload(promptStages.dataPayload, chunkSize);
      const conversation = promptManager.createChunkedConversation(promptStages, dataChunks);
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      return await ResponseProcessor.executeChunked(
        messages,
        model,
        contextLength,
        'compare_integration',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'compare_integration'
      );
    }
  }

  /**
   * Execute multi-file analysis for cross-file integration
   */
  private async executeMultiFileAnalysis(params: any, model: any, contextLength: number) {
    // Discover files
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
    const promptManager = new ThreeStagePromptManager();
    const chunkSize = TokenCalculator.calculateOptimalChunkSize(promptStages, contextLength);
    const dataChunks = promptManager.chunkDataPayload(promptStages.dataPayload, chunkSize);
    const conversation = promptManager.createChunkedConversation(promptStages, dataChunks);
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];
    
    return await ResponseProcessor.executeChunked(
      messages,
      model,
      contextLength,
      'compare_integration',
      'multifile'
    );
  }

  /**
   * Single-file integration pattern analysis
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, focus } = params;
    
    const systemAndContext = `You are a senior software architect and integration specialist with 15+ years of experience analyzing ${language} codebases.

**ANALYSIS CONTEXT:**
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Focus Areas: ${focus && focus.length > 0 ? focus.join(', ') : 'General integration patterns'}
- Mode: Single File Integration Pattern Analysis

**YOUR EXPERTISE:**
- Deep understanding of integration patterns and anti-patterns
- Master of API design, interface contracts, and dependency management
- Expert in identifying potential integration issues before they cause runtime problems
- Specialist in providing actionable, specific recommendations with code examples

Your task is to analyze this single file for integration readiness, interface design quality, and potential compatibility issues with other components.`;

    const dataPayload = `**FILE TO ANALYZE FOR INTEGRATION PATTERNS:**

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `**PROVIDE CLEAN MARKDOWN INTEGRATION ANALYSIS:**

# Single File Integration Analysis

## Integration Readiness: [Excellent/Good/Fair/Poor]

## Key Findings
- **Interface Quality**: [Assessment of exports/public methods]
- **Dependency Health**: [Import/dependency structure assessment]
- **Contract Clarity**: [Method signatures and types assessment]

## Integration Issues Found

### Critical Issues
- [Issue description with line numbers if applicable]

### Recommendations  
1. [Specific actionable recommendations]
2. [Interface improvements needed]
3. [Type safety enhancements]

## Integration Strengths
- [Good patterns already in use]
- [Defensive programming practices]

**Analysis Complete** - Focus on actionable insights, not raw code dumps.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file cross-integration analysis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, focus } = params;
    
    const systemAndContext = `You are a senior software architect and integration specialist with 15+ years of experience analyzing complex multi-file systems.

**ANALYSIS CONTEXT:**
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Focus Areas: ${focus && focus.length > 0 ? focus.join(', ') : 'Comprehensive integration analysis'}
- Mode: Multi-File Integration Comparison

**YOUR EXPERTISE:**
- Master of cross-file dependency analysis and interface compatibility
- Expert in identifying integration anti-patterns that cause runtime failures
- Specialist in API contract validation and method signature compatibility
- Authority on data flow analysis and architectural integration patterns
- Expert at providing specific, actionable fixes with line numbers and code examples

**CRITICAL ANALYSIS AREAS:**
- Method signature mismatches between files
- Missing imports and unused exports
- Data type incompatibilities across interfaces  
- Circular dependency detection
- Interface contract violations
- Error handling consistency across file boundaries

Your task is to perform deep cross-file integration analysis, identifying ALL compatibility issues with specific fixes.`;

    const dataPayload = `**MULTI-FILE INTEGRATION ANALYSIS DATA:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**PROVIDE CLEAN MARKDOWN MULTI-FILE INTEGRATION ANALYSIS:**

# Multi-File Integration Analysis Report

## Executive Summary
- **Overall Integration Health**: [Excellent/Good/Fair/Poor/Critical]
- **Files Analyzed**: ${fileCount}
- **Critical Issues**: [Count]
- **Integration Risk**: [Low/Medium/High/Critical]

## Key Integration Issues Found

### 🚨 Critical Issues (Fix Immediately)
1. **[Issue Type]** in [filename.ts:123]
   - **Problem**: [Brief description]
   - **Impact**: [What breaks]
   - **Fix**: [Specific solution]

### ⚠️ High Priority Issues
1. **[Issue Type]** between [file1.ts] and [file2.ts]  
   - **Problem**: [Description]
   - **Fix**: [Solution]

### 📋 Medium Priority Issues
- [List of less critical but important issues]

## Method Compatibility Analysis
- **Compatible Calls**: [Count] ✅
- **Signature Mismatches**: [Count] ❌
- **Missing Implementations**: [Count] ⚠️

## Import/Export Health
- **Clean Dependencies**: [Count] ✅
- **Unused Exports**: [Count] 🧹
- **Missing Imports**: [Count] ❌
- **Circular Dependencies**: [Count] 🔄

## Architecture Assessment
- **Design Patterns**: [Good patterns found]
- **Anti-Patterns**: [Problematic patterns]
- **Coupling**: [Tight/Loose assessment]

## Priority Action Plan

### Phase 1: Critical Fixes (Do First)
1. [Fix critical integration breakages]
2. [Resolve method signature mismatches]

### Phase 2: Improvements (Do Next)
1. [Clean up unused exports]
2. [Improve interface consistency]

### Phase 3: Long-term (Do Later)  
1. [Architectural improvements]
2. [Enhanced error handling]

## Integration Testing Recommendations
- [Specific integration tests to write]
- [Mock strategies to use]
- [Error scenarios to test]

**Analysis Complete** - Focused on actionable insights, not data dumps.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Backwards compatibility method
   */
  getPromptStages(params: any): PromptStages {
    const mode = this.detectAnalysisMode(params);
    
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
      'compare_integration', 
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
    
    // Aggregate results for integration analysis (focus on insights, not raw content)
    const aggregatedResult = {
      summary: `Integration analysis of ${files.length} files`,
      integrationInsights: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        exportCount: this.countExports(fileAnalysisResults),
        importCount: this.countImports(fileAnalysisResults),
        methodCount: this.countMethods(fileAnalysisResults),
        interfaceCount: this.countInterfaces(fileAnalysisResults),
        integrationPatterns: this.identifyIntegrationPatterns(fileAnalysisResults),
        potentialIssues: this.identifyPotentialIssues(fileAnalysisResults)
      },
      fileList: fileAnalysisResults.map(f => ({
        fileName: f.fileName,
        filePath: f.filePath,
        size: f.size,
        lines: f.lines,
        hasExports: f.integrationInfo?.exports?.length > 0,
        hasImports: f.integrationInfo?.imports?.length > 0,
        methodCount: f.integrationInfo?.methods?.length || 0
      }))
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
    const stats = await import('fs/promises').then(fs => fs.stat(file));
    
    // Extract integration-relevant information
    const imports = this.extractFileImports(content);
    const exports = this.extractFileExports(content);
    const methods = this.extractFileMethods(content);
    const interfaces = this.extractFileInterfaces(content);
    
    return {
      filePath: file,
      fileName: file.split(/[/\\]/).pop(),
      size: content.length,
      lines: content.split('\n').length,
      extension: file.split('.').pop() || '',
      modified: stats.mtime,
      content: content.length < 2000 ? content : `[${content.length} characters] - Content available for analysis`, // Minimal content for context
      integrationInfo: {
        imports,
        exports,
        methods,
        interfaces
      }
    };
  }

  private countExports(fileResults: any[]): number {
    return fileResults.reduce((sum, file) => sum + (file.integrationInfo?.exports?.length || 0), 0);
  }

  private countImports(fileResults: any[]): number {
    return fileResults.reduce((sum, file) => sum + (file.integrationInfo?.imports?.length || 0), 0);
  }

  private countMethods(fileResults: any[]): number {
    return fileResults.reduce((sum, file) => sum + (file.integrationInfo?.methods?.length || 0), 0);
  }

  private countInterfaces(fileResults: any[]): number {
    return fileResults.reduce((sum, file) => sum + (file.integrationInfo?.interfaces?.length || 0), 0);
  }

  private identifyIntegrationPatterns(fileResults: any[]): string[] {
    const patterns = [];
    // Simple pattern detection based on file analysis
    if (fileResults.some(f => f.fileName?.includes('base-') || f.fileName?.includes('Base'))) {
      patterns.push('Inheritance Pattern');
    }
    if (fileResults.some(f => f.fileName?.includes('interface') || f.fileName?.includes('Interface'))) {
      patterns.push('Interface Segregation');
    }
    if (fileResults.some(f => f.fileName?.includes('factory') || f.fileName?.includes('Factory'))) {
      patterns.push('Factory Pattern');
    }
    return patterns;
  }

  private identifyPotentialIssues(fileResults: any[]): string[] {
    const issues = [];
    // Simple issue detection
    const largeFiles = fileResults.filter(f => f.size > 50000);
    if (largeFiles.length > 0) {
      issues.push(`Large files detected: ${largeFiles.length} files > 50KB`);
    }
    
    const filesWithManyMethods = fileResults.filter(f => (f.integrationInfo?.methods?.length || 0) > 20);
    if (filesWithManyMethods.length > 0) {
      issues.push(`High method count: ${filesWithManyMethods.length} files with >20 methods`);
    }
    
    return issues;
  }

  private extractExports(fileResults: any[]): any[] {
    return fileResults.flatMap(file => file.integrationInfo?.exports || []);
  }

  private extractImports(fileResults: any[]): any[] {
    return fileResults.flatMap(file => file.integrationInfo?.imports || []);
  }

  private extractMethods(fileResults: any[]): any[] {
    return fileResults.flatMap(file => file.integrationInfo?.methods || []);
  }

  private extractInterfaces(fileResults: any[]): any[] {
    return fileResults.flatMap(file => file.integrationInfo?.interfaces || []);
  }

  // Simple pattern matching for integration elements (can be enhanced)
  private extractFileImports(content: string): any[] {
    const importRegex = /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g;
    const imports = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        module: match[1],
        line: content.substring(0, match.index).split('\n').length
      });
    }
    
    return imports;
  }

  private extractFileExports(content: string): any[] {
    const exportRegex = /export\s+(function|class|const|let|var|interface|type)\s+(\w+)/g;
    const exports = [];
    let match;
    
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push({
        type: match[1],
        name: match[2],
        line: content.substring(0, match.index).split('\n').length
      });
    }
    
    return exports;
  }

  private extractFileMethods(content: string): any[] {
    const methodRegex = /(function\s+(\w+)|(\w+)\s*\(.*?\)\s*[{:])/g;
    const methods = [];
    let match;
    
    while ((match = methodRegex.exec(content)) !== null) {
      methods.push({
        name: match[2] || match[3],
        line: content.substring(0, match.index).split('\n').length
      });
    }
    
    return methods;
  }

  private extractFileInterfaces(content: string): any[] {
    const interfaceRegex = /interface\s+(\w+)/g;
    const interfaces = [];
    let match;
    
    while ((match = interfaceRegex.exec(content)) !== null) {
      interfaces.push({
        name: match[1],
        line: content.substring(0, match.index).split('\n').length
      });
    }
    
    return interfaces;
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'integration': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.java', '.cs'], 
      'compatibility': ['.js', '.ts', '.jsx', '.tsx', '.d.ts'], 
      'dependencies': ['.js', '.ts', '.jsx', '.tsx', '.json', '.package.json']
    };
    
    return extensionMap[analysisType] || extensionMap.integration;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default IntegrationComparator;