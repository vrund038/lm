/**
 * Plugin Template - Modern v4.3 (Improved)
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

// Common Node.js modules - Use these instead of require()
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class CodeQualityAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_code_quality';
  category = 'analyze' as const;
  description = 'Analyze code quality including complexity, maintainability, and best practices adherence';
  
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
      enum: ['complexity', 'maintainability', 'comprehensive'],
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
        return ErrorHandler.createExecutionError('analyze_code_quality', error);
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
    // Single-file indicators take priority
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // For code quality, default to single-file (analyze individual files)
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
    ParameterValidator.validateEnum(params, 'analysisType', ['complexity', 'maintainability', 'comprehensive']);
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
        'analyze_code_quality',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'analyze_code_quality'
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
      'analyze_code_quality',
      'multifile'
    );
  }

  /**
   * Single-file code quality analysis
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType } = params;
    
    const systemAndContext = `You are an expert code quality analyst specializing in ${analysisDepth} ${analysisType} analysis.

Analysis Context:
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Mode: Single File Quality Analysis

Your task is to analyze code quality metrics including complexity, maintainability, readability, and adherence to best practices for this individual file.`;

    const dataPayload = `Code to analyze:

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `Provide comprehensive code quality analysis including:

**Quality Assessment Overview**
- Overall quality evaluation with numerical scoring out of 10
- Complexity assessment focusing on cyclomatic complexity and maintainability  
- Readability evaluation covering naming conventions, code organization, and clarity
- Maintainability score considering future modification ease

**Detailed Quality Analysis**
- Cyclomatic complexity assessment with specific complexity hotspots
- Function and method length analysis identifying overly complex functions
- Variable naming consistency and clarity evaluation
- Code organization patterns and structural assessment
- Documentation quality and inline comment effectiveness

**Best Practices Adherence Evaluation**
- SOLID principles compliance with specific examples and scoring
- DRY principle adherence identifying code duplication patterns
- Error handling consistency and robustness assessment
- Language-specific best practices and idiom usage
- Performance considerations and optimization opportunities

**Quality Issues and Recommendations**
- Critical quality issues requiring immediate attention with specific line references
- Important improvements for maintainability and readability enhancement
- Minor refinements and polish opportunities for code excellence
- Prioritized recommendation list focusing on highest impact improvements first

**Implementation Guidance**
- Specific actionable steps for addressing identified quality issues
- Code refactoring suggestions with examples where applicable
- Long-term quality improvement strategies and practices
- Confidence assessment of the analysis accuracy and completeness

Focus on providing actionable insights that developers can implement immediately to improve code quality, maintainability, and team productivity.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file project quality analysis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount } = params;
    
    const systemAndContext = `You are an expert project code quality analyst specializing in ${analysisDepth} ${analysisType} analysis.

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Mode: Project-wide Quality Analysis

Your task is to provide comprehensive code quality assessment across the entire project, identifying patterns, consistency issues, and quality metrics.`;

    const dataPayload = `Project quality analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Provide comprehensive project-wide code quality analysis including:

**Project Quality Overview**
- Overall project quality assessment with numerical scoring and quality maturity evaluation
- Quality consistency analysis across the entire codebase identifying patterns and variations
- Project maintainability assessment focusing on long-term sustainability and evolution capability

**Quality Distribution Analysis**
- Quality variance across files identifying high-performing and problematic areas
- Consistency patterns in coding standards, naming conventions, and structural approaches
- Quality hotspots requiring immediate attention and areas of excellence to replicate

**Cross-File Quality Patterns**
- Consistent quality patterns and practices implemented well across multiple files
- Inconsistent areas showing quality variations that impact team productivity
- Systematic quality issues affecting multiple components or architectural layers
- Code quality trends and evolution patterns throughout the project structure

**Strategic Quality Issues**
- Critical systemic problems affecting multiple files requiring architectural attention
- Quality consistency issues creating maintenance burden and reducing team velocity  
- Technical debt accumulation patterns and their impact on project sustainability
- Cross-cutting concerns and quality patterns that span multiple modules or components

**Project Quality Recommendations**
- Immediate action items for addressing urgent quality problems across the project
- Quality standards and coding guidelines recommendations for team adoption
- Tooling and automation suggestions for maintaining consistent quality levels
- Refactoring prioritization strategy focusing on highest impact quality improvements
- Long-term quality improvement roadmap and architectural evolution guidance

**Implementation Strategy**
- Phase-based approach to implementing quality improvements across the project
- Team adoption strategies for quality standards and best practices
- Measurement and monitoring approaches for tracking quality improvements over time
- Project quality maturity assessment and growth pathway recommendations

Focus on providing strategic, actionable insights that improve overall project quality, team productivity, and long-term maintainability across the entire codebase.`;

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
      'analyze_code_quality', 
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
    
    // Aggregate results for quality analysis
    const aggregatedResult = {
      summary: `Code quality analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      qualityMetrics: {
        totalFiles: files.length,
        averageComplexity: this.calculateAverageComplexity(fileAnalysisResults),
        qualityDistribution: this.analyzeQualityDistribution(fileAnalysisResults),
        commonIssues: this.identifyCommonIssues(fileAnalysisResults)
      }
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now() - Date.now(),
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
      complexity: this.estimateComplexity(content),
      qualityScore: this.estimateQualityScore(content)
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    // Updated extensions for code quality analysis
    const extensionMap: Record<string, string[]> = {
      'complexity': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs'],
      'maintainability': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php'], 
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  // Quality analysis helper methods
  private estimateComplexity(content: string): number {
    const complexityPatterns = [
      /if\s*\(/g, /else/g, /while\s*\(/g, /for\s*\(/g, 
      /switch\s*\(/g, /case\s+/g, /catch\s*\(/g, /\?\s*:/g
    ];
    
    let complexity = 1;
    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  private estimateQualityScore(content: string): number {
    let score = 10; // Start with perfect score
    
    // Deduct points for quality issues
    if (content.includes('console.log')) score -= 1; // Debug statements
    if (content.includes('TODO') || content.includes('FIXME')) score -= 1; // Incomplete code
    if (content.length > 1000 && !content.includes('\n\n')) score -= 1; // Lack of spacing
    if (!/\/\*\*|\*\/|\/\//.test(content)) score -= 2; // No comments
    
    return Math.max(0, score);
  }

  private calculateAverageComplexity(results: any[]): number {
    const totalComplexity = results.reduce((sum, result) => sum + (result.complexity || 0), 0);
    return results.length > 0 ? totalComplexity / results.length : 0;
  }

  private analyzeQualityDistribution(results: any[]): any {
    const distribution = { high: 0, medium: 0, low: 0 };
    
    results.forEach(result => {
      const score = result.qualityScore || 0;
      if (score >= 8) distribution.high++;
      else if (score >= 6) distribution.medium++;
      else distribution.low++;
    });
    
    return distribution;
  }

  private identifyCommonIssues(results: any[]): string[] {
    const issues: string[] = [];
    
    const highComplexityFiles = results.filter(r => (r.complexity || 0) > 10).length;
    if (highComplexityFiles > results.length * 0.2) {
      issues.push('High complexity in multiple files');
    }
    
    const lowQualityFiles = results.filter(r => (r.qualityScore || 0) < 6).length;
    if (lowQualityFiles > results.length * 0.1) {
      issues.push('Quality issues across multiple files');
    }
    
    return issues;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default CodeQualityAnalyzer;
