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
import { basename } from 'path';

export class ProjectStructureAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_project_structure';
  category = 'analyze' as const;
  description = 'Analyze complete project structure and architecture. Returns comprehensive architecture analysis with patterns, dependencies, and strategic recommendations.';
  
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
    // Multi-file indicators
    if (params.projectPath || params.files || params.maxDepth !== undefined) {
      return 'multi-file';
    }
    
    // Single-file indicators  
    if (params.code || params.filePath) {
      return 'single-file';
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
      'analyze_project_structure',
      'multifile'
    );
  }

  /**
   * Single-file architectural analysis
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, focusAreas } = params;
    
    const systemAndContext = `You are a senior software architect with expertise in code architecture, design patterns, and structural analysis.

Analysis Context:
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Focus Areas: ${focusAreas.length > 0 ? focusAreas.join(', ') : 'comprehensive'}
- Mode: Single File Architecture Analysis

Your task is to analyze the architectural patterns, design quality, and structural organization of this individual file, providing actionable insights for improvement.`;

    const dataPayload = `Code to analyze:

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `Provide your architectural analysis in the following structured format:

## File Architecture Analysis

### Pattern Identification
- **Primary Pattern**: [pattern name and description]
- **Implementation Quality**: [score/10]
- **Pattern Adherence**: [how well pattern is followed]

### Structural Assessment
- **Organization**: [well-structured/moderate/needs improvement]
- **Separation of Concerns**: [excellent/good/poor]
- **Code Cohesion**: [high/medium/low]

### Design Quality
- **SOLID Principles Compliance**: [score/10]
- **Readability**: [score/10]
- **Maintainability**: [score/10]

### Identified Issues
- [List architectural issues with severity: critical/important/minor]

### Recommendations
1. **Critical**: [immediate architectural improvements needed]
2. **Important**: [significant improvements to consider]
3. **Suggested**: [nice-to-have improvements]

### Refactoring Opportunities
- [Specific refactoring suggestions with rationale]

**Overall Architecture Score**: [X/10]`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file project architecture analysis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, focusAreas, projectPath } = params;
    
    const systemAndContext = `You are a senior software architect with expertise in project architecture, system design, and enterprise patterns.

Analysis Context:
- Project: ${projectPath ? basename(projectPath) : 'Unknown'}
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Focus Areas: ${focusAreas.length > 0 ? focusAreas.join(', ') : 'comprehensive'}
- Mode: Complete Project Architecture Analysis

Your task is to provide comprehensive architectural analysis covering system design, patterns, dependencies, code organization, and strategic recommendations for the entire project.`;

    const dataPayload = `Project architecture analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Provide your comprehensive project architecture analysis in the following structured format:

## Executive Summary
Brief overview of the project architecture and key findings

## Architecture Analysis
### System Design Pattern
- **Primary Architecture**: [monolithic/microservices/layered/hexagonal/etc.]
- **Implementation Quality**: [score/10]
- **Pattern Consistency**: [excellent/good/poor]

### Project Organization
- **Structure Quality**: [score/10]
- **Module Organization**: [logical/acceptable/chaotic]
- **Dependency Management**: [excellent/good/poor]

## Technology Stack Assessment
### Languages & Frameworks
- **Primary Languages**: [list with usage percentages]
- **Frameworks**: [list major frameworks and versions]
- **Technology Alignment**: [modern/acceptable/outdated]

### Infrastructure & Tooling
- **Build System**: [assessment]
- **Testing Strategy**: [comprehensive/basic/minimal]
- **DevOps Integration**: [mature/developing/absent]

## Code Quality Indicators
### Positive Patterns
- [List observed good architectural practices]

### Anti-patterns & Issues
- [List architectural problems with severity: critical/important/minor]

### Complexity Assessment
- **Overall Complexity**: [low/medium/high/excessive]
- **Complexity Hotspots**: [areas requiring attention]

## Dependency Analysis
### Architecture Dependencies
- **Critical Dependencies**: [list key architectural dependencies]
- **Coupling Assessment**: [loose/tight/mixed]
- **Risk Factors**: [security, maintenance, vendor lock-in risks]

## Strategic Recommendations
### Critical (Address Immediately)
1. [High priority architectural changes]

### Important (Address Soon)  
1. [Medium priority improvements]

### Future Considerations
1. [Long-term architectural evolution suggestions]

## Refactoring Roadmap
### Phase 1: Foundation
- [Immediate structural improvements]

### Phase 2: Enhancement
- [Medium-term architectural upgrades]

### Phase 3: Evolution
- [Long-term architectural transformation]

## Architecture Maturity Score
**Overall Score**: [X/10]
- **Design Patterns**: [X/10]
- **Code Organization**: [X/10] 
- **Dependency Management**: [X/10]
- **Maintainability**: [X/10]
- **Scalability**: [X/10]

## Conclusion
Summary of architectural state and recommended next steps for optimal project evolution.`;

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
    
    // Enhanced aggregation for architectural analysis
    const aggregatedResult = {
      summary: `Project architecture analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      architecture: {
        totalFiles: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        totalLines: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.lines || 0), 0),
        filesByType: this.groupFilesByType(fileAnalysisResults),
        largestFiles: this.getLargestFiles(fileAnalysisResults),
        directoryStructure: this.buildDirectoryStructure(files),
        configurationFiles: await this.findConfigurationFiles(files),
        dependencyIndicators: this.analyzeDependencyPatterns(fileAnalysisResults)
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
    const lines = content.split('\n');
    
    return {
      filePath: file,
      size: content.length,
      lines: lines.length,
      extension: file.split('.').pop() || '',
      isDirectory: stats.isDirectory(),
      modified: stats.mtime,
      // Simple pattern detection
      hasImports: /^(import|require|from|#include)/m.test(content),
      hasExports: /^(export|module\.exports|__all__)/m.test(content),
      hasClasses: /^(class|interface|struct)/m.test(content),
      hasFunctions: /^(function|def|func|public|private)/m.test(content),
      complexity: this.estimateComplexity(content)
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'architecture': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go', '.rs', '.cpp', '.h', '.vue', '.svelte'],
      'patterns': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go', '.rs'],
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go', '.rs', '.cpp', '.h', '.vue', '.svelte', '.json', '.yaml', '.yml', '.xml', '.md']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  // Helper methods for enhanced project analysis
  private groupFilesByType(results: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    results.forEach(result => {
      const ext = result.extension || 'no-extension';
      grouped[ext] = (grouped[ext] || 0) + 1;
    });
    return grouped;
  }

  private getLargestFiles(results: any[]): any[] {
    return results
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, 10)
      .map(file => ({
        path: file.filePath,
        size: file.size,
        lines: file.lines
      }));
  }

  private buildDirectoryStructure(files: string[]): any {
    const structure: Record<string, any> = {};
    
    files.forEach(file => {
      const parts = file.split('/');
      let current = structure;
      
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? null : {};
        }
        if (current[part] !== null) {
          current = current[part];
        }
      });
    });
    
    return structure;
  }

  private async findConfigurationFiles(files: string[]): Promise<string[]> {
    const configPatterns = [
      'package.json', 'composer.json', 'pom.xml', 'build.gradle',
      'requirements.txt', 'Gemfile', 'Cargo.toml', 'go.mod',
      'tsconfig.json', 'webpack.config.js', '.eslintrc',
      'docker-compose.yml', 'Dockerfile', '.env', 'README.md'
    ];
    
    return files.filter(file => {
      const fileName = basename(file);
      return configPatterns.some(pattern => 
        fileName === pattern || fileName.includes(pattern.replace('.*', ''))
      );
    });
  }

  private analyzeDependencyPatterns(results: any[]): any {
    const patterns = {
      hasModuleSystem: results.some(r => r.hasImports || r.hasExports),
      hasClasses: results.filter(r => r.hasClasses).length,
      hasFunctions: results.filter(r => r.hasFunctions).length,
      averageComplexity: results.reduce((sum, r) => sum + (r.complexity || 0), 0) / results.length,
      complexFiles: results.filter(r => (r.complexity || 0) > 10).map(r => r.filePath)
    };
    
    return patterns;
  }

  private estimateComplexity(content: string): number {
    // Simple complexity estimation based on control structures
    const complexityPatterns = [
      /if\s*\(/g, /else/g, /while\s*\(/g, /for\s*\(/g, 
      /switch\s*\(/g, /case\s+/g, /catch\s*\(/g, /\?\s*:/g
    ];
    
    let complexity = 1; // Base complexity
    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    });
    
    return complexity;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default ProjectStructureAnalyzer;
