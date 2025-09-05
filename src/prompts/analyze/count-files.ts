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

export class CountFilesAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'count_files';
  category = 'analyze' as const;
  description = 'Analyze directory structure and generate markdown directory tree with file and folder counts';
  
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
      description: 'Path to directory root to analyze',
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
      description: 'Maximum directory depth for discovery (1-10)',
      required: false,
      default: 5
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
      enum: ['structure', 'counts', 'comprehensive'],
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
        return ErrorHandler.createExecutionError('count_files', error);
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
    
    // Default to multi-file for directory counting
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
    ParameterValidator.validateEnum(params, 'analysisType', ['structure', 'counts', 'comprehensive']);
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
        'count_files',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'count_files'
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
      'count_files',
      'multifile'
    );
  }

  /**
   * Implement single-file prompt stages for file analysis
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType } = params;
    
    const systemAndContext = `You are an expert file structure analyst specializing in ${analysisDepth} ${analysisType} analysis.

Analysis Context:
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Mode: Single File Analysis

Your task is to analyze the provided file content and provide insights about its structure, size, and characteristics in markdown format.`;

    const dataPayload = `File content to analyze:

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `Provide a comprehensive analysis of this individual file:

**File Overview:**
- Brief summary of what this file contains and its purpose  
- File type and primary language
- Approximate file size and lines of code
- Role within the project structure

**File Characteristics:**
- **File Type**: Primary classification (component, utility, configuration, etc.)
- **Lines of Code**: Estimated line count
- **File Size**: Approximate size description  
- **Language**: Programming language and any frameworks used
- **Complexity**: Assessment of file complexity (low/medium/high)

**Code Structure Analysis:**
- **Functions**: List of key functions and their purposes
- **Classes**: Any classes defined and their roles
- **Imports**: External dependencies and modules used
- **Exports**: What this file makes available to other modules
- **Constants & Variables**: Key configuration or data definitions

**File-Specific Recommendations:**
- Suggestions for improving this specific file
- Code quality improvements
- Structure or organization enhancements  
- Performance or maintainability considerations

**Context Within Project:**
- How this file fits into the overall project architecture
- Dependencies on other files
- Files that depend on this one
- Potential impact of changes to this file

Focus on providing actionable insights specific to this individual file while considering its role in the broader project context.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement multi-file prompt stages for directory structure analysis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount } = params;
    
    const systemAndContext = `You are an expert directory structure analyst specializing in ${analysisDepth} ${analysisType} analysis.

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Mode: Directory Structure Analysis

Your task is to create a comprehensive markdown directory tree structure showing files and folders with counts and statistics.`;

    const dataPayload = `Directory analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Create a comprehensive directory structure analysis and markdown tree representation:

**PROJECT OVERVIEW:**
- **Total Files Analyzed**: ${fileCount} files
- **Project Summary**: Brief description of the project's structure and organization
- **Overall Assessment**: How well-organized and structured the project appears to be

**DIRECTORY TREE STRUCTURE:**
Create a detailed markdown representation of the directory tree showing:
- All directories and subdirectories with proper indentation
- File counts per directory
- File types and extensions
- Total file and directory counts
- Key organizational patterns

**STATISTICAL ANALYSIS:**
- **File Type Distribution**: Breakdown by programming languages and file types
- **Directory Size Analysis**: Which directories contain the most files
- **Largest Files**: Notable large files and their purposes
- **File Organization Patterns**: How files are grouped and organized

**STRUCTURAL INSIGHTS:**
- **Architecture Patterns**: What architectural patterns are evident from the structure
- **Separation of Concerns**: How well different types of files are organized
- **Project Type**: Assessment of what type of project this appears to be
- **Development Stage**: Whether structure suggests early development, mature project, etc.

**PROJECT ORGANIZATION RECOMMENDATIONS:**
- **Structure Improvements**: Suggestions for better file organization
- **Missing Directories**: Standard directories that might be beneficial
- **File Naming**: Assessment of file naming conventions
- **Refactoring Opportunities**: Structural improvements that could help maintainability

**TECHNICAL ANALYSIS:**
- **Build System**: Evidence of build tools, configuration files, package managers
- **Development Workflow**: Testing, documentation, deployment file presence
- **Dependencies**: Package files, lock files, dependency management
- **Configuration**: Environment files, settings, configuration patterns

**MAINTENANCE & SCALABILITY:**
- **Code Organization**: How well the structure will scale with project growth
- **Team Collaboration**: Structure conducive to multiple developers
- **Documentation**: Presence and organization of documentation files
- **Testing**: Test file organization and coverage structure

Present this analysis in a clear, hierarchical format that helps developers understand both the current structure and opportunities for improvement.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement for backwards compatibility
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
      'count_files', 
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
      summary: `Directory structure analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        filesByType: this.groupFilesByType(fileAnalysisResults),
        directoryStructure: this.buildDirectoryStructure(files)
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
      size: content.length,
      lines: content.split('\n').length,
      extension: file.split('.').pop() || '',
      isDirectory: stats.isDirectory(),
      modified: stats.mtime
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'structure': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.h', '.css', '.html', '.md', '.json', '.xml', '.yml', '.yaml'], // Common file types for structure analysis
      'counts': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.h', '.css', '.html', '.md', '.json', '.xml', '.yml', '.yaml'], // Same for counting
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.h', '.css', '.html', '.md', '.json', '.xml', '.yml', '.yaml'] // Comprehensive analysis
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private groupFilesByType(results: any[]): Record<string, number> {
    const grouped: Record<string, number> = {};
    results.forEach(result => {
      const ext = result.extension || 'no-extension';
      grouped[ext] = (grouped[ext] || 0) + 1;
    });
    return grouped;
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

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default CountFilesAnalyzer;
