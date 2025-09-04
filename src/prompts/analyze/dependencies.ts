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

// Common Node.js modules - Use these instead of require()
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class DependencyAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_dependencies';
  category = 'analyze' as const;
  description = 'Analyze code dependencies including circular references, unused imports, version conflicts, and coupling issues';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'The code to analyze for dependencies (single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single file to analyze for dependencies',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Path to project root for comprehensive dependency analysis',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific file paths for dependency analysis',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for dependency discovery (1-5)',
      required: false,
      default: 4
    },
    
    // Analysis options
    analysisType: {
      type: 'string' as const,
      description: 'Type of dependency analysis to perform',
      enum: ['imports', 'circular', 'unused', 'coupling', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of dependency analysis detail',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    },
    language: {
      type: 'string' as const,
      description: 'Programming language for language-specific dependency patterns',
      required: false,
      default: 'javascript'
    },
    includePackageJson: {
      type: 'boolean' as const,
      description: 'Include package.json analysis for version conflicts',
      required: false,
      default: true
    },
    checkDevDependencies: {
      type: 'boolean' as const,
      description: 'Include devDependencies in analysis',
      required: false,
      default: false
    },
    ignorePatterns: {
      type: 'array' as const,
      description: 'Patterns to ignore (e.g., ["node_modules", "*.test.js"])',
      required: false,
      default: ["node_modules", "*.min.js", "*.bundle.js"],
      items: { type: 'string' as const }
    }
  };

  private analysisCache = getAnalysisCache();
  private multiFileAnalysis = new MultiFileAnalysis();

  constructor() {
    super();
  }

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        const analysisMode = this.detectAnalysisMode(secureParams);
        this.validateParameters(secureParams, analysisMode);
        const { model, contextLength } = await ModelSetup.getReadyModel(llmClient);
        
        if (analysisMode === 'single-file') {
          return await this.executeSingleFileAnalysis(secureParams, model, contextLength);
        } else {
          return await this.executeMultiFileAnalysis(secureParams, model, contextLength);
        }
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('analyze_dependencies', error);
      }
    });
  }

  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    if (params.code || params.filePath) {
      return 'single-file';
    }
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    return 'single-file';
  }

  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      ParameterValidator.validateCodeOrFile(params);
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params);
    }
    
    ParameterValidator.validateEnum(params, 'analysisType', ['imports', 'circular', 'unused', 'coupling', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
  }

  private async executeSingleFileAnalysis(params: any, model: any, contextLength: number) {
    let codeToAnalyze = params.code;
    if (params.filePath) {
      codeToAnalyze = await readFileContent(params.filePath);
    }
    
    const promptStages = this.getSingleFilePromptStages({
      ...params,
      code: codeToAnalyze
    });
    
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
        'analyze_dependencies',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'analyze_dependencies'
      );
    }
  }

  private async executeMultiFileAnalysis(params: any, model: any, contextLength: number) {
    let filesToAnalyze: string[] = params.files || 
      await this.discoverRelevantFiles(
        params.projectPath, 
        params.maxDepth,
        params.analysisType
      );
    
    const analysisResult = await this.performMultiFileAnalysis(
      filesToAnalyze,
      params,
      model,
      contextLength
    );
    
    const promptStages = this.getMultiFilePromptStages({
      ...params,
      analysisResult,
      fileCount: filesToAnalyze.length
    });
    
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
      'analyze_dependencies',
      'multifile'
    );
  }

  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType } = params;
    
    const systemAndContext = `You are an expert dependency analyst specializing in ${analysisDepth} ${analysisType} analysis.

Analysis Context:
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Mode: Single File Dependency Analysis

Your expertise includes:
- Import/export pattern analysis
- Circular dependency detection
- Version conflict identification
- Coupling assessment
- Dead code elimination

Your task is to provide actionable insights about this file's dependencies.`;

    const dataPayload = `Code to analyze for dependencies:

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `Provide comprehensive dependency analysis with the following structure:

**File Dependencies Summary**
Provide an overview of this file's dependency profile, including import/export patterns, external dependencies, and overall coupling assessment.

**Import Analysis**
- List all detected imports (modules, files, packages)
- Identify import types (static, dynamic, conditional)
- Note any unusual or problematic import patterns
- Assess import organization and consistency

**Export Analysis**
- Document all exports from this file
- Categorize export types (functions, classes, constants, types)
- Evaluate export design and API surface
- Identify potential unused exports

**Dependency Issues**
For each dependency-related issue found:
- Issue type (circular, unused, version, coupling, etc.)
- Severity level (critical, high, medium, low)
- Detailed explanation of the problem
- Specific lines or patterns involved
- Recommended resolution approach

**Optimization Opportunities**
- Potential import consolidation or reorganization
- Suggestions for reducing coupling
- Dead code elimination opportunities
- Performance improvements through lazy loading

**Recommendations**
Provide specific, actionable steps to improve the dependency structure, focusing on maintainability and performance impact while considering language-specific dependency patterns.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, projectPath } = params;
    
    const systemAndContext = `You are a senior software architect specializing in ${analysisDepth} multi-file dependency analysis and system architecture.

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Project: ${projectPath ? basename(projectPath) : 'multi-file analysis'}
- Mode: Comprehensive Project Dependency Analysis

Your expertise includes identifying system-wide dependency patterns, architectural issues, and cross-module coupling problems. You understand layered architecture, dependency inversion, circular dependency chains, and system-wide optimization opportunities.`;

    const dataPayload = `Project-wide dependency analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Provide comprehensive multi-file dependency analysis with the following structure:

**Project Dependency Overview**
Provide a high-level assessment of the project's dependency architecture across all ${fileCount} analyzed files, including overall coupling, circular dependencies, and architectural patterns.

**Cross-File Dependencies**
- Map key dependency relationships between files
- Identify architectural layers and their interactions
- Document shared dependencies and common patterns
- Assess overall system coupling and cohesion

**Systemic Issues**
For each system-wide dependency issue:
- Issue type (circular dependencies, tight coupling, architecture violations)
- Severity and impact on maintainability
- Files and modules involved
- Root cause analysis
- System-wide resolution strategy

**Architectural Recommendations**
- Dependency consolidation opportunities
- Suggestions for improving separation of concerns
- Refactoring opportunities for better architecture
- Long-term structural improvements

**Implementation Roadmap**
Provide a prioritized plan for addressing cross-file dependency issues, considering the impact on the overall system architecture and focusing on actionable insights that improve code maintainability and reduce technical debt.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  getPromptStages(params: any): PromptStages {
    const mode = this.detectAnalysisMode(params);
    
    if (mode === 'single-file') {
      return this.getSingleFilePromptStages(params);
    } else {
      return this.getMultiFilePromptStages(params);
    }
  }

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
      'analyze_dependencies', 
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
    
    const aggregatedResult = {
      summary: `Dependency analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        analysisTimestamp: new Date().toISOString()
      }
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now(),
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async analyzeIndividualFile(file: string, params: any, model: any): Promise<any> {
    const content = await readFile(file, 'utf-8');
    const stats = await stat(file);
    
    return {
      filePath: file,
      fileName: basename(file),
      size: content.length,
      lines: content.split('\n').length,
      extension: extname(file),
      relativePath: relative(params.projectPath || '', file),
      lastModified: stats.mtime.toISOString()
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'imports': ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'],
      'circular': ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'], 
      'unused': ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'],
      'coupling': ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'],
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.php', '.py']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }
}

export default DependencyAnalyzer;
