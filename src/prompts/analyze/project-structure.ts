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

// Common Node.js modules - Use these instead of require()
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class ProjectStructureAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_project_structure';
  category = 'analyze' as const;
  description = 'Analyze complete project structure and architecture with actionable strategic recommendations';
  
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
      description: 'Maximum directory depth to analyze (1-5)',
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
      enum: ['architecture', 'patterns', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    focusAreas: {
      type: 'array' as const,
      description: 'Areas to focus on: architecture, dependencies, complexity, patterns',
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
        return ErrorHandler.createExecutionError('analyze_project_structure', error);
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
    
    // Multi-file indicators
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default to multi-file for project structure analysis
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
    ParameterValidator.validateEnum(params, 'analysisType', ['architecture', 'patterns', 'comprehensive']);
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
        'analyze_project_structure',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'analyze_project_structure'
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
      'analyze_project_structure',
      'multifile'
    );
  }

  /**
   * Single-file structure analysis - focuses on file's role in larger architecture
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, filePath } = params;
    const fileName = filePath ? basename(filePath) : 'unknown';
    const focusAreas = params.focusAreas || [];
    
    const systemAndContext = `You are a senior software architect with 15+ years of experience analyzing codebases and providing strategic guidance to development teams.

**YOUR EXPERTISE:**
- Identifying architectural patterns and anti-patterns
- Recognizing scalability bottlenecks and technical debt
- Providing actionable recommendations that balance pragmatism with best practices
- Understanding business impact of technical decisions

**ANALYSIS CONTEXT:**
- File: ${fileName}
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Focus Areas: ${focusAreas.length ? focusAreas.join(', ') : 'comprehensive'}
- Mode: Single File Architectural Analysis

**YOUR MISSION:**
Analyze this file's role in the broader architecture. Don't just describe what it does - explain its strategic importance, potential issues, and how it fits into modern software patterns.`;

    const dataPayload = `File to analyze: ${fileName}

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `Provide comprehensive architectural analysis of this file covering:

**Executive Summary:**
- **File Role**: What role does this file play in the overall architecture?
- **Architectural Pattern**: What pattern does this file implement or support?
- **Business Criticality**: How critical is this file to business operations?

**Structural Analysis:**
- **Primary Responsibilities**: List the main responsibilities of this file
- **Dependencies**: 
  - Key imports and what this file relies on
  - What this file exports and provides to other parts
  - Coupling assessment (tight/loose/moderate) with explanation
- **Design Patterns**: Identify any design patterns used in this file
- **Code Organization**: Assessment of how well the code is structured internally

**Architectural Insights:**
- **Strengths & Opportunities**: What this file does well architecturally
- **Technical Debt**: Areas where technical debt is accumulating
- **Scalability Considerations**: How will this file behave as the system grows?
- **Maintainability Score**: Rate 1-10 with detailed explanation

**Strategic Recommendations:**
For each recommendation, provide:
- **Priority**: High/medium/low priority level
- **Recommendation**: Specific actionable recommendation
- **Rationale**: Why this matters for the business/team
- **Effort**: Low/medium/high implementation effort
- **Impact**: Business or technical impact of implementing this

**Confidence Assessment:** Your confidence level in this analysis

Focus on strategic architectural insights that help developers make better decisions, not just code review comments.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file project structure analysis - comprehensive architectural overview
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, projectPath } = params;
    const focusAreas = params.focusAreas || [];
    const projectName = projectPath ? basename(projectPath) : 'Project';
    
    const systemAndContext = `You are a senior software architect and technical consultant specializing in ${analysisDepth} ${analysisType} analysis.

**YOUR EXPERTISE:**
- 15+ years architecting scalable software systems
- Expert in identifying patterns, anti-patterns, and architectural smells
- Skilled at translating technical analysis into business recommendations
- Proven track record helping teams improve system design and maintainability

**PROJECT CONTEXT:**
- Project: ${projectName}
- Files Analyzed: ${fileCount}
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Focus Areas: ${focusAreas.length ? focusAreas.join(', ') : 'comprehensive architecture'}
- Mode: Complete Project Architecture Analysis

**YOUR MISSION:**
Provide a comprehensive architectural assessment that helps the development team understand their system's current state and chart a path forward. Focus on actionable insights that balance technical excellence with practical business needs.`;

    const dataPayload = `Complete project structure analysis:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Provide comprehensive project architecture analysis covering:

**Executive Summary:**
- **Overall Architectural Health**: Assess as excellent/good/concerning/poor with 2-sentence explanation
- **Primary Strengths**: Top 3 architectural strengths of this project
- **Critical Concerns**: Top 3 areas requiring immediate attention
- **Recommended Focus**: What should the team prioritize next?

**Architectural Overview:**
- **Detected Patterns**: For each pattern found:
  - Pattern name (e.g., MVC, Microservices, Layered)
  - Implementation quality (well/partially/poorly implemented)
  - Impact on the system
- **System Complexity**: 
  - Complexity level (low/moderate/high/excessive)
  - Justification for this complexity level
  - Whether the complexity is manageable
- **Code Organization**: 
  - Directory structure assessment (well-organized/adequate/chaotic)
  - Separation of concerns (clear/mixed/tangled)  
  - Consistency score (1-10 with explanation)

**Dependency Analysis:**
- **External Dependencies**: 
  - Count and risk level assessment (low/medium/high)
  - List of concerning outdated dependencies
  - Dependency management recommendations
- **Internal Coupling**: 
  - Coupling level (loose/moderate/tight)
  - Files or modules with coupling issues
  - Specific decoupling suggestions

**Quality and Maintainability:**
- **Code Quality Score**: Rate 1-10 with detailed explanation
- **Technical Debt Areas**: For each area:
  - Specific area of technical debt
  - Severity (low/medium/high/critical)
  - Business impact explanation
  - Specific remediation steps
- **Testability**: Assessment of how easy this codebase is to test
- **Documentation**: Current state of project documentation

**Scalability and Performance:**
- **Current Scalability**: Assessment of how well this system will scale
- **Performance Bottlenecks**: Identified or potential performance issues
- **Resource Utilization**: Efficient or concerning resource usage patterns
- **Scaling Recommendations**: Specific recommendations for growth

**Strategic Recommendations:**
For each recommendation, provide:
- **Category**: architecture/dependencies/quality/performance/team
- **Priority**: critical/high/medium/low
- **Recommendation**: Specific actionable recommendation
- **Business Justification**: Why this matters for business success
- **Technical Justification**: Technical reasoning
- **Estimated Effort**: hours/days/weeks/months
- **Expected Impact**: Measurable impact on team or system
- **Prerequisites**: What needs to happen first
- **Risk of Not Implementing**: What happens if this is ignored

**Next Steps:**
- **Immediate Actions**: Actions to take this week
- **Short-term Actions**: Actions for next 1-3 months
- **Long-term Initiatives**: Strategic initiatives for 6+ months
- **Team Capability Needs**: Skills or knowledge the team should develop

Focus on recommendations that help the team ship better software faster. Every suggestion should clearly explain both the technical benefit and business value.`;

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
      'analyze_project_structure', 
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
    
    // Aggregate results into comprehensive project analysis
    const aggregatedResult = {
      summary: `Project structure analysis of ${files.length} files`,
      projectMetrics: {
        totalFiles: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        averageFileSize: Math.round(fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0) / files.length),
        totalLines: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.lines || 0), 0),
        fileTypeDistribution: this.analyzeFileTypes(fileAnalysisResults),
        directoryStructure: this.analyzeDirectoryStructure(files, params.projectPath)
      },
      architecturalInsights: {
        largestFiles: fileAnalysisResults
          .sort((a, b) => (b.size || 0) - (a.size || 0))
          .slice(0, 10)
          .map(f => ({ path: f.relativePath, size: f.size, lines: f.lines })),
        complexityIndicators: this.calculateComplexityMetrics(fileAnalysisResults),
        organizationPatterns: this.identifyOrganizationPatterns(files),
        dependencyStructure: this.analyzeDependencyStructure(fileAnalysisResults)
      },
      fileAnalysisResults
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now() - Date.now(), // TODO: Track actual execution time
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
      directory: dirname(relative(params.projectPath || '', file)),
      isEmpty: content.trim().length === 0,
      isConfigFile: this.isConfigFile(file),
      isTestFile: this.isTestFile(file),
      lastModified: stats.mtime,
      // Basic complexity indicators
      functionsCount: this.countFunctions(content),
      importsCount: this.countImports(content),
      exportsCount: this.countExports(content)
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'architecture': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go', '.json', '.yaml', '.yml', '.xml'],
      'patterns': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go', '.vue', '.svelte'],
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go', '.vue', '.svelte', '.json', '.yaml', '.yml', '.xml', '.md', '.txt', '.css', '.scss', '.less']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  // Helper methods for analysis
  private analyzeFileTypes(results: any[]): Record<string, number> {
    const typeCount: Record<string, number> = {};
    results.forEach(result => {
      const ext = result.extension || 'no-extension';
      typeCount[ext] = (typeCount[ext] || 0) + 1;
    });
    return typeCount;
  }

  private analyzeDirectoryStructure(files: string[], projectPath?: string): any {
    const structure: Record<string, any> = {};
    files.forEach(file => {
      const relativePath = projectPath ? relative(projectPath, file) : file;
      const parts = relativePath.split(/[\/\\]/);
      let current = structure;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // It's a file
          if (!current._files) current._files = [];
          current._files.push(part);
        } else {
          // It's a directory
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });
    return structure;
  }

  private calculateComplexityMetrics(results: any[]): any {
    const sizes = results.map(r => r.size || 0);
    const lines = results.map(r => r.lines || 0);
    
    return {
      fileSizeVariance: this.calculateVariance(sizes),
      lineLengthVariance: this.calculateVariance(lines),
      largeFileCount: sizes.filter(s => s > 10000).length,
      veryLargeFileCount: sizes.filter(s => s > 50000).length
    };
  }

  private identifyOrganizationPatterns(files: string[]): string[] {
    const patterns: string[] = [];
    
    // Check for common patterns
    if (files.some(f => f.includes('/src/'))) patterns.push('src-directory');
    if (files.some(f => f.includes('/lib/'))) patterns.push('lib-directory');
    if (files.some(f => f.includes('/components/'))) patterns.push('component-structure');
    if (files.some(f => f.includes('/utils/') || f.includes('/helpers/'))) patterns.push('utility-separation');
    if (files.some(f => f.includes('/test/') || f.includes('/__tests__/'))) patterns.push('test-organization');
    if (files.some(f => f.includes('/config/'))) patterns.push('configuration-separation');
    
    return patterns;
  }

  private analyzeDependencyStructure(results: any[]): any {
    const totalImports = results.reduce((sum, r) => sum + (r.importsCount || 0), 0);
    const totalExports = results.reduce((sum, r) => sum + (r.exportsCount || 0), 0);
    const filesWithImports = results.filter(r => (r.importsCount || 0) > 0).length;
    const filesWithExports = results.filter(r => (r.exportsCount || 0) > 0).length;
    
    return {
      totalImports,
      totalExports,
      averageImportsPerFile: filesWithImports ? Math.round(totalImports / filesWithImports) : 0,
      averageExportsPerFile: filesWithExports ? Math.round(totalExports / filesWithExports) : 0,
      interconnectionLevel: filesWithImports / results.length
    };
  }

  // Utility methods
  private isConfigFile(file: string): boolean {
    const configPatterns = ['.json', '.yaml', '.yml', '.xml', '.ini', '.toml', '.config.', 'package.json', 'tsconfig.', 'webpack.', 'babel.'];
    return configPatterns.some(pattern => file.includes(pattern));
  }

  private isTestFile(file: string): boolean {
    const testPatterns = ['.test.', '.spec.', '__test__', '__spec__', '/test/', '/tests/', '/spec/'];
    return testPatterns.some(pattern => file.includes(pattern));
  }

  private countFunctions(content: string): number {
    // Simple function counting - can be enhanced
    const functionPatterns = [
      /function\s+\w+/g,
      /const\s+\w+\s*=\s*\(/g,
      /let\s+\w+\s*=\s*\(/g,
      /\w+\s*:\s*function/g,
      /\w+\s*=>\s*/g
    ];
    
    return functionPatterns.reduce((count, pattern) => {
      const matches = content.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  private countImports(content: string): number {
    const importPatterns = [
      /^import\s+/gm,
      /^const\s+.*=\s*require\(/gm,
      /^from\s+.*import/gm
    ];
    
    return importPatterns.reduce((count, pattern) => {
      const matches = content.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  private countExports(content: string): number {
    const exportPatterns = [
      /^export\s+/gm,
      /^module\.exports/gm,
      /^exports\./gm
    ];
    
    return exportPatterns.reduce((count, pattern) => {
      const matches = content.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  private calculateVariance(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default ProjectStructureAnalyzer;
