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

export class FindUnusedFilesAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'find_unused_files';
  category = 'system' as const;
  description = 'Identify genuinely unused TypeScript/JavaScript files in complex projects with dynamic loading patterns';
  
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
      description: 'Absolute path to project root',
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
      description: 'Maximum directory depth for discovery (1-5)',
      required: false,
      default: 4
    },
    
    // Analysis options
    language: {
      type: 'string' as const,
      description: 'Programming language',
      required: false,
      default: 'typescript'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of analysis detail',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of analysis to perform',
      enum: ['static', 'dynamic', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    entryPoints: {
      type: 'array' as const,
      description: 'Entry point files to start dependency traversal',
      required: false,
      default: ['index.ts', 'main.ts', 'app.ts'],
      items: { type: 'string' as const }
    },
    excludePatterns: {
      type: 'array' as const,
      description: 'File patterns to exclude from analysis',
      required: false,
      default: ['*.test.ts', '*.spec.ts', '*.d.ts'],
      items: { type: 'string' as const }
    },
    analyzeComments: {
      type: 'boolean' as const,
      description: 'Check for commented-out imports',
      required: false,
      default: true
    },
    includeDevArtifacts: {
      type: 'boolean' as const,
      description: 'Whether to flag potential dev artifacts',
      required: false,
      default: false
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
        return ErrorHandler.createExecutionError('find_unused_files', error);
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
    return 'multi-file'; // Default for unused file analysis
  }

  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      ParameterValidator.validateCodeOrFile(params);
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params);
    }
    
    ParameterValidator.validateEnum(params, 'analysisType', ['static', 'dynamic', 'comprehensive']);
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
        'find_unused_files',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'find_unused_files'
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
      'find_unused_files',
      'multifile'
    );
  }

  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, filePath } = params;
    
    const systemAndContext = `You are a senior software architect and code dependency expert specializing in ${analysisDepth} ${analysisType} analysis.

Your mission: Determine if this specific file is actively used or genuinely unused in a codebase.

Analysis Context:
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Mode: Single File Dependency Analysis
- File Path: ${filePath || 'provided code'}

Your expertise includes 15+ years experience with dependency analysis and dead code elimination, deep understanding of static imports, dynamic imports, and runtime loading patterns, expert knowledge of modern build tools, bundlers, and module resolution, and specialization in identifying truly unused code vs. conditionally loaded code.

Key analysis areas:
1. Static Import Detection - Traditional import/export statements
2. Dynamic Loading Patterns - Runtime imports, conditional loading
3. String References - File path references, dynamic requires
4. Export Analysis - What this file exports and how it might be used
5. Framework Patterns - Framework-specific loading (plugins, routes, etc.)

Your task is to provide expert analysis on whether this file appears to be genuinely unused or has dependencies.`;

    const dataPayload = `File to analyze:

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `Provide expert dependency analysis with the following structure:

**File Usage Assessment Summary**
Provide a professional assessment of this file's usage status, including what it exports, what it imports, and any framework-specific patterns detected.

**Analysis Details**
- List all exports found (functions, classes, constants, types)
- Identify all imports and dependencies 
- Note any framework-specific patterns (React hooks, Vue composables, etc.)
- Document evidence of dynamic loading or runtime usage

**Usage Evidence**
- Static import evidence (if imports/exports suggest active use)
- Dynamic loading clues (runtime imports, string references)
- Framework integration patterns (plugin systems, route handlers)
- Configuration or build tool references

**Assessment Conclusion**
- Usage status classification (actively_used, likely_unused, requires_investigation)
- Confidence level in the assessment (0.0 to 1.0)
- Specific reasons supporting the conclusion
- Recommended action (keep, investigate_further, safe_to_remove)

Focus on distinguishing between genuinely unused files and files that may be loaded dynamically or conditionally.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount } = params;
    
    const systemAndContext = `You are a world-class senior software architect specializing in ${analysisDepth} unused file analysis across ${fileCount} files.

Your expertise: Large-scale codebase cleanup, dependency graph analysis, dead code elimination strategies, and complex project refactoring with zero-risk unused file identification.

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Mode: Multi-File Unused File Analysis

Your mission: Identify genuinely unused files while avoiding false positives from dynamic loading, conditional imports, and framework-specific patterns.`;

    const dataPayload = `Multi-file unused file analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Provide world-class unused file analysis with the following structure:

**Executive Summary**
Provide key metrics: total files analyzed, count of genuinely unused files, potentially unused files, estimated technical debt reduction percentage, overall risk level (low/medium/high), and recommended action (immediate_cleanup/careful_review/major_refactoring_needed).

**Definitely Unused Files**
For each definitively unused file, provide:
- File path and confidence level (0.0-1.0)
- Comprehensive reasoning for why it's definitively unused
- Category: legacy, dead_code, orphaned, or experimental
- Safety assessment: whether it's safe to delete and deletion risk level
- Last modified date if available
- Potential impact of deletion

**Likely Unused Files**
For suspicious files that need verification:
- File path and confidence level
- Reasoning for why it appears unused but needs verification
- Category: conditional, plugin, or utility
- Safety assessment and deletion risk
- Specific verification steps needed
- Potential impact if deleted incorrectly

**Files Requiring Investigation**
For files with complex patterns needing human review:
- File path and confidence level
- Explanation of complex patterns detected
- Category: dynamic, framework, or complex
- Specific concerns making analysis uncertain
- Concrete investigation steps for manual verification

**Technical Debt Assessment**
- Estimated cleanup impact on codebase size and maintainability
- Risk assessment for batch deletion vs. individual file review
- Recommended cleanup strategy and implementation phases
- Long-term benefits of unused file elimination

**Implementation Guidance**
Provide a prioritized cleanup plan with specific steps, safety measures, and verification procedures to ensure accurate unused file removal without breaking functionality.`;

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
      'find_unused_files', 
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
      summary: `Unused files analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        entryPoints: params.entryPoints || ['index.ts', 'main.ts', 'app.ts'],
        excludePatterns: params.excludePatterns || ['*.test.ts', '*.spec.ts', '*.d.ts'],
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
      lastModified: stats.mtime.toISOString(),
      hasExports: /(?:^|\n)\s*export\s+/gm.test(content),
      hasImports: /(?:^|\n)\s*import\s+.*?from\s+/gm.test(content),
      isTestFile: /\.(test|spec)\.(ts|js)$/i.test(file),
      isDeclarationFile: file.endsWith('.d.ts')
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'static': ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'],
      'dynamic': ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.vue', '.svelte'],
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '.json', '.vue', '.svelte', '.php', '.py']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }
}

export default FindUnusedFilesAnalyzer;
