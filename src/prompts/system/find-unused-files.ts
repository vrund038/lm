/**
 * Find Unused Files Plugin - Modern v4.3
 * 
 * Identifies genuinely unused TypeScript/JavaScript files in complex projects 
 * Automatically detects single-file or project-wide analysis mode
 * 
 * Built with the universal template for consistency and performance
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
    
    // Unused files specific parameters
    entryPoints: {
      type: 'array' as const,
      description: 'Entry point files to start dependency traversal',
      items: { type: 'string' as const },
      default: ['index.ts', 'main.ts', 'app.ts'],
      required: false
    },
    excludePatterns: {
      type: 'array' as const,
      description: 'File patterns to exclude from analysis',
      items: { type: 'string' as const },
      default: ['*.test.ts', '*.spec.ts', '*.d.ts'],
      required: false
    },
    includeDevArtifacts: {
      type: 'boolean' as const,
      description: 'Whether to flag potential dev artifacts',
      default: false,
      required: false
    },
    analyzeComments: {
      type: 'boolean' as const,
      description: 'Check for commented-out imports',
      default: true,
      required: false
    },
    
    // Universal parameters
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
        return ErrorHandler.createExecutionError('find_unused_files', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   * 
   * For unused files analysis, multi-file is the primary use case
   * Single-file mode only used for checking if a specific file has dependencies
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
    
    // Default to multi-file for unused files analysis (project-focused)
    return 'multi-file';
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
    ParameterValidator.validateEnum(params, 'analysisType', ['static', 'dynamic', 'comprehensive']);
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
      'find_unused_files',
      'multifile'
    );
  }

  /**
   * Single-file prompt stages - Check if a specific file is used
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, filePath } = params;
    
    const systemAndContext = `You are a senior software architect and code dependency expert specializing in ${analysisDepth} ${analysisType} analysis.

**Your Mission**: Determine if this specific file is actively used or genuinely unused in a codebase.

**Analysis Context:**
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Mode: Single File Dependency Analysis
- File Path: ${filePath || 'provided code'}

**Your Expertise:**
- 15+ years experience with dependency analysis and dead code elimination
- Deep understanding of static imports, dynamic imports, and runtime loading patterns
- Expert knowledge of modern build tools, bundlers, and module resolution
- Specialized in identifying truly unused code vs. conditionally loaded code

**Analysis Methodology:**
1. **Static Import Analysis** - Look for direct import/require statements
2. **Dynamic Loading Patterns** - Detect runtime imports, conditional loading
3. **String References** - Find file path references, dynamic requires
4. **Export Analysis** - Identify what this file exports and how it might be used
5. **Framework Patterns** - Recognize framework-specific loading (plugins, routes, etc.)

Your task is to provide expert analysis on whether this file appears to be genuinely unused or has dependencies.`;

    const dataPayload = `**File to analyze:**

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `**Provide expert dependency analysis in this JSON format:**

{
  "summary": "Professional assessment of this file's usage status",
  "analysis": {
    "exportsFound": ["list of things this file exports"],
    "importsDetected": ["list of dependencies this file has"],
    "frameworkPatterns": ["any framework-specific patterns detected"],
    "dynamicLoadingClues": ["evidence of dynamic/runtime usage"],
    "stringReferences": ["any string-based references that might load this file"]
  },
  "usageAssessment": {
    "status": "likely_used|likely_unused|uncertain",
    "confidence": 0.85,
    "reasoning": "Detailed explanation of why you reached this conclusion",
    "riskLevel": "low|medium|high"
  },
  "recommendations": [
    "Specific actionable recommendations",
    "If uncertain, explain what additional analysis is needed",
    "Safe deletion procedures if unused"
  ],
  "warnings": [
    "Any risks or edge cases to consider",
    "Potential dynamic loading patterns that could be missed"
  ]
}

**Remember**: False positives (marking used code as unused) are much worse than false negatives. When uncertain, err on the side of caution and mark as "uncertain" with clear reasoning.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file prompt stages - Comprehensive unused files analysis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, entryPoints, excludePatterns } = params;
    
    const systemAndContext = `You are a world-class software architect and technical debt specialist with ${analysisDepth} expertise in ${analysisType} analysis.

**Your Mission**: Identify genuinely unused files in this codebase while avoiding false positives that could break the application.

**Analysis Context:**
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Entry Points: ${JSON.stringify(entryPoints)}
- Excluded Patterns: ${JSON.stringify(excludePatterns)}
- Mode: Comprehensive Project-Wide Unused File Analysis

**Your World-Class Expertise:**
- 15+ years architecting large-scale applications with complex dependency graphs
- Expert in modern JavaScript/TypeScript ecosystems, build tools, and bundlers
- Deep understanding of dynamic loading, plugin systems, and framework patterns
- Specialized in safe refactoring and technical debt elimination
- Track record of helping teams clean up codebases without breaking functionality

**Advanced Analysis Methodology:**
1. **Dependency Graph Construction** - Map all import/export relationships
2. **Entry Point Traversal** - Trace usage from application entry points
3. **Dynamic Pattern Recognition** - Identify runtime loading, plugins, routes
4. **Framework Integration Analysis** - Detect framework-specific file loading
5. **Build System Awareness** - Consider webpack, vite, rollup patterns
6. **Risk Assessment** - Categorize files by deletion safety level

**Critical Success Factors:**
- **Zero Breaking Changes**: Never recommend deleting files that could break the app
- **Confidence Scoring**: Provide honest confidence levels for each recommendation
- **Actionable Intelligence**: Focus on files that are genuinely safe to remove
- **Business Impact**: Consider maintenance burden vs. deletion risk

Your analysis will directly impact production systems - be thorough, accurate, and conservative.`;

    const dataPayload = `**Comprehensive Project Analysis Results:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**Provide world-class unused file analysis in this JSON format:**

{
  "executiveSummary": {
    "totalFilesAnalyzed": ${fileCount},
    "genuinelyUnusedCount": 0,
    "potentiallyUnusedCount": 0,
    "technicalDebtReduction": "estimated percentage of cleanup opportunity",
    "overallRisk": "low|medium|high",
    "recommendedAction": "immediate_cleanup|careful_review|major_refactoring_needed"
  },
  "definitelyUnused": [
    {
      "filePath": "path/to/file.ts",
      "confidence": 0.95,
      "reasoning": "Comprehensive explanation of why this is definitively unused",
      "category": "legacy|dead_code|orphaned|experimental",
      "safeToDelete": true,
      "deletionRisk": "low",
      "lastModified": "if available from analysis",
      "potentialImpact": "none expected - isolated file with no dependencies"
    }
  ],
  "likelyUnused": [
    {
      "filePath": "path/to/suspicious.ts",
      "confidence": 0.75,
      "reasoning": "Why this appears unused but needs verification",
      "category": "conditional|plugin|utility",
      "safeToDelete": false,
      "deletionRisk": "medium",
      "verificationSteps": ["specific steps to verify safety"],
      "potentialImpact": "possible runtime errors if used dynamically"
    }
  ],
  "requiresInvestigation": [
    {
      "filePath": "path/to/unclear.ts",
      "confidence": 0.40,
      "reasoning": "Complex patterns detected - needs human review",
      "category": "dynamic|framework|complex",
      "concerns": ["specific patterns that make analysis uncertain"],
      "investigationSteps": ["concrete steps for manual verification"]
    }
  ],
  "architecturalInsights": {
    "dependencyHotspots": ["files with many dependencies - architectural concerns"],
    "isolatedClusters": ["groups of files that seem disconnected from main app"],
    "frameworkPatterns": ["framework-specific loading patterns detected"],
    "buildSystemClues": ["build configuration insights affecting file usage"]
  },
  "actionPlan": {
    "phase1_SafeCleanup": ["files safe to delete immediately"],
    "phase2_CarefulReview": ["files requiring verification before deletion"],
    "phase3_ArchitecturalReview": ["files suggesting deeper architectural issues"],
    "estimatedEffort": "hours/days needed for safe cleanup",
    "riskMitigation": ["steps to minimize cleanup risks"]
  },
  "recommendations": [
    "Prioritized recommendations for technical debt reduction",
    "Process improvements to prevent future unused file accumulation",
    "Tooling suggestions for ongoing codebase health monitoring"
  ]
}

**Critical Reminder**: This analysis will guide deletion of potentially business-critical code. Be extremely conservative with confidence scores. A false positive (marking used code as unused) could cause production outages. When in doubt, recommend investigation rather than deletion.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Backwards compatibility method - routes to appropriate stages
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
      'find_unused_files', 
      params, 
      files
    );
    
    const cached = await this.analysisCache.get(cacheKey);
    if (cached) return cached;
    
    // Perform comprehensive dependency analysis
    const dependencyMap = await this.buildDependencyMap(files, params);
    const usageAnalysis = await this.analyzeUsagePatterns(files, dependencyMap, params);
    
    const fileAnalysisResults = await this.multiFileAnalysis.analyzeBatch(
      files,
      (file: string) => this.analyzeIndividualFile(file, params, model),
      contextLength
    );
    
    // Aggregate results into comprehensive analysis
    const aggregatedResult = {
      summary: `Unused files analysis of ${files.length} files`,
      dependencyMap: dependencyMap,
      usageAnalysis: usageAnalysis,
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
      executionTime: Date.now() - Date.now(), // TODO: Track actual execution time
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async buildDependencyMap(files: string[], params: any): Promise<Map<string, string[]>> {
    const dependencyMap = new Map<string, string[]>();
    
    for (const file of files) {
      try {
        const content = await readFile(file, 'utf-8');
        const dependencies = await this.extractDependencies(content, file, params);
        dependencyMap.set(file, dependencies);
      } catch (error) {
        dependencyMap.set(file, []);
      }
    }
    
    return dependencyMap;
  }

  private async extractDependencies(content: string, filePath: string, params: any): Promise<string[]> {
    const dependencies: string[] = [];
    
    // Static import patterns
    const importPatterns = [
      /(?:^|\n)\s*(?:import|export).*?from\s+['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g // Dynamic imports
    ];
    
    // Include commented imports if requested
    if (params.analyzeComments) {
      importPatterns.push(/\/\/.*?(?:import|export).*?from\s+['"`]([^'"`]+)['"`]/g);
      importPatterns.push(/\/\*.*?(?:import|export).*?from\s+['"`]([^'"`]+)['"`].*?\*\//g);
    }
    
    for (const pattern of importPatterns) {
      const matches = Array.from(content.matchAll(pattern));
      for (const match of matches) {
        if (match[1] && !match[1].startsWith('.')) {
          dependencies.push(match[1]);
        }
      }
    }
    
    return dependencies;
  }

  private async analyzeUsagePatterns(
    files: string[], 
    dependencyMap: Map<string, string[]>,
    params: any
  ): Promise<any> {
    const usageMap = new Map<string, {
      directDependents: string[];
      indirectDependents: string[];
      usageType: 'entry' | 'static' | 'dynamic' | 'unused';
      confidence: number;
    }>();
    
    // Initialize all files as potentially unused
    files.forEach(file => {
      usageMap.set(file, {
        directDependents: [],
        indirectDependents: [],
        usageType: 'unused',
        confidence: 0.5
      });
    });
    
    // Mark entry points as used
    const entryPoints = params.entryPoints || ['index.ts', 'main.ts', 'app.ts'];
    files.forEach(file => {
      const fileName = basename(file);
      if (entryPoints.some(entry => fileName.includes(entry.replace('.ts', '')))) {
        const usage = usageMap.get(file)!;
        usage.usageType = 'entry';
        usage.confidence = 0.95;
      }
    });
    
    // Build reverse dependency mapping
    dependencyMap.forEach((deps, file) => {
      deps.forEach(dep => {
        // Find files that might match this dependency
        const matchingFiles = files.filter(f => {
          const relativePath = relative(dirname(file), f);
          return relativePath.includes(dep) || basename(f).includes(dep);
        });
        
        matchingFiles.forEach(matchedFile => {
          const usage = usageMap.get(matchedFile);
          if (usage) {
            usage.directDependents.push(file);
            if (usage.usageType === 'unused') {
              usage.usageType = 'static';
              usage.confidence = Math.min(0.8, usage.confidence + 0.3);
            }
          }
        });
      });
    });
    
    return Object.fromEntries(usageMap);
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

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default FindUnusedFilesAnalyzer;
