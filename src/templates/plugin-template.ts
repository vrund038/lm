/**
 * Plugin Template - Modern v4.2 (Single Source of Truth)
 * 
 * Universal template that intelligently handles both single-file and multi-file analysis
 * Automatically detects analysis type based on provided parameters
 * 
 * Copy this template for creating any new plugin - it adapts to your needs
 * 
 * ⚠️  CRITICAL: OUTPUT INSTRUCTIONS MUST USE NATURAL LANGUAGE, NOT JSON SCHEMAS! ⚠️
 * 
 * The ResponseFactory automatically handles all JSON formatting. If you put JSON schemas
 * in outputInstructions, you'll get double-processing and escaped content. Always use 
 * natural language instructions that describe WHAT you want, not HOW to format it.
 * 
 * ✅ GOOD: "Provide a comprehensive analysis including structure, quality metrics..."
 * ❌ BAD:  '{ "summary": "...", "structure": {...} }' (causes escaping issues)
 */

// TEMPLATE: Update these import paths based on where you place your plugin:
// For analyze/ plugins: use '../../plugins/', '../shared/', '../../core/', etc.
// For generate/ plugins: use '../../plugins/', '../shared/', '../../core/', etc.  
// For system/ plugins: use '../../plugins/', '../shared/', '../../core/', etc.
// For custom/ plugins: use '../../plugins/', '../shared/', '../../core/', etc.
// For fun/ plugins: use '../../plugins/', '../shared/', '../../core/', etc.
// THESE ARE TEMPLATE INSTRUCTIONS - The actual imports below are correct for this template file
import { BasePlugin } from '../plugins/base-plugin.js';
import { IPromptPlugin } from '../prompts/shared/types.js';
import { ThreeStagePromptManager } from '../core/ThreeStagePromptManager.js';
import { PromptStages } from '../types/prompt-stages.js';
import { withSecurity } from '../security/integration-helpers.js';
import { readFileContent } from '../prompts/shared/helpers.js';
import { 
  ModelSetup, 
  ResponseProcessor, 
  ParameterValidator, 
  ErrorHandler,
  MultiFileAnalysis
} from '../utils/plugin-utilities.js';
import { getAnalysisCache } from '../cache/index.js';

// Common Node.js modules - Use these instead of require()
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class TEMPLATE_UniversalPlugin extends BasePlugin implements IPromptPlugin {
  name = 'TEMPLATE_function_name';
  category = 'analyze' as const; // TEMPLATE: Change to 'analyze' | 'generate' | 'multifile' | 'system' | 'custom'
  description = 'TEMPLATE: Describe what this plugin does (handles both single and multi-file)';
  
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
      enum: ['TEMPLATE_type1', 'TEMPLATE_type2', 'comprehensive'],
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
        return ErrorHandler.createExecutionError('TEMPLATE_function_name', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   * 
   * DETECTION GUIDE:
   * Single-file: code, filePath provided → analyze individual file
   * Multi-file: projectPath, files, maxDepth provided → analyze project/multiple files
   * Default: Choose based on your plugin's primary use case
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file indicators take priority (avoids default parameter issues)
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // TEMPLATE: Choose your default based on plugin purpose
    // For file-focused plugins: return 'single-file'
    // For project-focused plugins: return 'multi-file'
    return 'single-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      ParameterValidator.validateCodeOrFile(params);
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['TEMPLATE_type1', 'TEMPLATE_type2', 'comprehensive']);
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
        'TEMPLATE_function_name',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'TEMPLATE_function_name'
      );
    }
  }

  /**
   * Execute multi-file analysis
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
      'TEMPLATE_function_name',
      'multifile'
    );
  }

  /**
   * TEMPLATE: Implement your single-file prompt stages
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType } = params;
    
    const systemAndContext = `You are an expert code analyst specializing in ${analysisDepth} ${analysisType} analysis.

Analysis Context:
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Mode: Single File Analysis

TEMPLATE: Add your specific single-file system instructions here.

Your task is to provide actionable insights and recommendations for this individual file.`;

    const dataPayload = `Code to analyze:

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `TEMPLATE: Define your specific single-file output format here.

**IMPORTANT: Use natural language instructions, NOT JSON schemas!**
The ResponseFactory will handle all JSON formatting automatically.

Example single-file analysis format:

**File Overview:**
Provide a brief summary of what this file does and its overall quality.

**Structural Analysis:**  
- **Components**: List key classes, functions, and their purposes
- **Dependencies**: Identify imports, exports, and external dependencies
- **Architecture**: Describe the code's architectural approach

**Quality Assessment:**
- **Code Quality**: Rate maintainability, testability, and reusability
- **Complexity**: Evaluate cyclomatic complexity and readability
- **Standards**: Adherence to language and framework best practices

**Issues & Recommendations:**
For each finding, provide:
- **Type**: Issue category (improvement, security, performance, etc.)  
- **Severity**: Priority level (critical, high, medium, low)
- **Description**: Clear explanation of the problem or opportunity
- **Location**: Specific line numbers where applicable
- **Solution**: Actionable steps to address the issue

**Implementation Guidance:**
Organize recommendations by priority and provide specific, actionable steps that developers can implement immediately.

Focus on being constructive, specific, and actionable while maintaining professional quality suitable for production use.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * TEMPLATE: Implement your multi-file prompt stages
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount } = params;
    
    const systemAndContext = `You are an expert multi-file code analyst specializing in ${analysisDepth} ${analysisType} analysis.

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Mode: Multi-File Analysis

TEMPLATE: Add your specific multi-file system instructions here.

Your task is to provide comprehensive cross-file insights and architectural recommendations.`;

    const dataPayload = `Multi-file analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `TEMPLATE: Define your specific multi-file output format here.

**IMPORTANT: Use natural language instructions, NOT JSON schemas!** 
The ResponseFactory will handle all JSON formatting automatically.

Example multi-file analysis format:

**Project Overview:**
Provide a comprehensive summary of the project architecture and organization across all ${fileCount} analyzed files.

**Cross-File Analysis:**
- **Architecture Patterns**: Identify architectural patterns and their implementation
- **Dependencies**: Map inter-file dependencies and coupling issues
- **Consistency**: Assess coding style, naming conventions, and pattern consistency
- **Duplication**: Identify code duplication and reuse opportunities

**System-Wide Findings:**
For each cross-file issue, provide:
- **Issue Type**: Architecture, coupling, duplication, inconsistency, etc.
- **Severity**: Impact on system maintainability and scalability
- **Affected Files**: Specific files involved in the issue
- **System Impact**: How this affects overall architecture
- **Resolution Strategy**: Multi-file refactoring or improvement approach

**Architectural Recommendations:**
- **Immediate Actions**: Critical architectural fixes needed across files
- **Structural Improvements**: Medium-term refactoring opportunities  
- **Long-term Enhancements**: Strategic architectural evolution suggestions

**Implementation Roadmap:**
Provide a prioritized plan for implementing cross-file improvements, considering dependencies between changes and minimizing disruption to existing functionality.

Focus on systemic issues that affect multiple files and provide architectural insights that individual file analysis cannot reveal.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * TEMPLATE: Implement for backwards compatibility
   * The system still expects this method, so we intelligently route to the appropriate stages
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
      'TEMPLATE_function_name', 
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
      summary: `Multi-file analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        // TEMPLATE: Add your specific aggregation logic here
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
    const stats = await import('fs/promises').then(fs => fs.stat(file));
    
    return {
      filePath: file,
      fileName: basename(file), // ✅ Use imported basename instead of require('path').basename
      size: content.length,
      lines: content.split('\n').length,
      extension: extname(file), // ✅ Use imported extname
      relativePath: relative(params.projectPath || '', file), // ✅ Use imported relative
      // TEMPLATE: Add your specific individual file analysis here
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    // TEMPLATE: Update these extensions to match your analysis needs
    // Common extensions by category:
    // Code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php']
    // Config: ['.json', '.yaml', '.yml', '.xml', '.toml', '.ini']
    // Docs: ['.md', '.txt', '.rst', '.adoc']
    // All: [...code, ...config, ...docs]
    
    const extensionMap: Record<string, string[]> = {
      'TEMPLATE_type1': ['.js', '.ts', '.jsx', '.tsx'],
      'TEMPLATE_type2': ['.php', '.inc', '.module'], 
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default TEMPLATE_UniversalPlugin;

/*
PLUGIN TEMPLATE USAGE:
1. Copy this file to your plugin location (src/prompts/[category]/)
2. Replace all TEMPLATE_ placeholders:
   - TEMPLATE_UniversalPlugin → Your class name
   - TEMPLATE_function_name → Your MCP function name  
   - TEMPLATE_category → Your plugin category
   - TEMPLATE_type1, TEMPLATE_type2 → Your analysis types
3. Choose your default mode in detectAnalysisMode():
   - File-focused plugins: return 'single-file' (e.g., code analysis, linting)
   - Project-focused plugins: return 'multi-file' (e.g., architecture, counting)
4. Implement getSingleFilePromptStages() for single-file logic
5. Implement getMultiFilePromptStages() for multi-file logic  
6. Update individual file analysis logic if needed
7. Use provided Node.js imports (path, fs/promises) instead of require()
8. Build and restart Claude

⚠️  CRITICAL RULE: OUTPUT INSTRUCTIONS MUST BE NATURAL LANGUAGE ONLY! ⚠️

✅ DO: Use comprehensive natural language instructions describing what analysis to provide
❌ DON'T: Put JSON schemas in outputInstructions (causes double-processing & escaping)

The ResponseFactory automatically converts natural language responses to clean JSON.
If you specify JSON format in prompts, you get garbled, escaped content.

AUTOMATIC DETECTION:
✅ Single-file: When code/filePath provided
✅ Multi-file: When projectPath/files/maxDepth provided  
✅ Intelligent parameter validation based on detected mode
✅ Appropriate execution path (direct/chunked) chosen automatically
✅ Same utilities used for both modes

BENEFITS:
✅ Single source of truth - one template for all scenarios
✅ Automatic mode detection - no need to choose
✅ Consistent behavior across single/multi-file
✅ Less maintenance - fix bugs once
✅ Flexible parameters - supports all use cases
✅ Code reuse - shared validation, processing, error handling
✅ Clean JSON responses - ResponseFactory handles all formatting

UTILITIES PROVIDED:
✅ ModelSetup - Model loading and context detection  
✅ ResponseProcessor - Token calculation and execution
✅ ParameterValidator - Common validation patterns
✅ ErrorHandler - Standardized error responses
✅ ResponseFactory - Universal JSON formatting (don't duplicate this!)
✅ Common Node.js imports - path, fs/promises (use these instead of require)

COMMON MISTAKES TO AVOID:
❌ Don't use require() - use the provided ES module imports
❌ Don't hardcode single/multi-file - let detection handle it
❌ Don't duplicate template architecture - only replace designated areas
❌ Don't create custom utilities - use the provided ones
❌ DON'T PUT JSON SCHEMAS IN OUTPUT INSTRUCTIONS - use natural language only!
*/