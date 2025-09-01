/**
 * Custom Prompt Executor - Modern v4.3 Universal Template
 * 
 * Universal fallback function that allows Claude to communicate any task directly to local LLM
 * Acts as the Swiss Army knife for tasks that don't match other specialized functions
 * 
 * Created using the modern universal template architecture
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

export class CustomPromptExecutor extends BasePlugin implements IPromptPlugin {
  name = 'custom_prompt';
  category = 'custom' as const;
  description = 'Universal fallback executor for any custom prompt with optional file context. Uses dynamic token allocation based on your loaded model - can handle everything from quick tasks to comprehensive multi-file analysis. The Swiss Army knife when no other specialized function matches your needs.';
  
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
      description: 'Array of specific file paths to include as context',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for multi-file discovery (1-5)',
      required: false,
      default: 3
    },
    
    // Custom prompt specific parameters
    prompt: {
      type: 'string' as const,
      description: 'The custom prompt/task to send to local LLM',
      required: true
    },
    working_directory: {
      type: 'string' as const,
      description: 'Working directory context (defaults to current working directory)',
      required: false
    },
    context: {
      type: 'object' as const,
      description: 'Optional structured context object for the task',
      required: false,
      properties: {
        task_type: { type: 'string' as const },
        requirements: { type: 'array' as const },
        constraints: { type: 'array' as const },
        output_format: { type: 'string' as const }
      }
    },

    
    // Universal parameters
    language: {
      type: 'string' as const,
      description: 'Programming language (if applicable)',
      required: false,
      default: 'text'
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
      enum: ['general', 'technical', 'creative', 'analytical'],
      default: 'general',
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
        return ErrorHandler.createExecutionError('custom_prompt', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Multi-file indicators
    if (params.projectPath || (params.files && params.files.length > 1)) {
      return 'multi-file';
    }
    
    // Single-file indicators or no file context (just prompt)
    if (params.code || params.filePath || (params.files && params.files.length === 1) || (!params.projectPath && !params.files)) {
      return 'single-file';
    }
    
    // Default to single-file for simple prompts
    return 'single-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    // Always require the prompt
    if (!params.prompt || typeof params.prompt !== 'string') {
      throw new Error('Prompt is required and must be a string');
    }
    
    if (mode === 'single-file') {
      // Single-file mode can work with just a prompt, or with file context
      if (params.filePath) {
        ParameterValidator.validateCodeOrFile(params);
      }
    } else {
      // Multi-file mode requires either projectPath or files array
      if (!params.projectPath && !params.files) {
        throw new Error('Multi-file mode requires either projectPath or files array');
      }
      if (params.projectPath) {
        ParameterValidator.validateProjectPath(params);
      }
      ParameterValidator.validateDepth(params);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['general', 'technical', 'creative', 'analytical']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
  }

  /**
   * Execute single-file analysis
   */
  private async executeSingleFileAnalysis(params: any, model: any, contextLength: number) {
    // Process single file input
    let codeToAnalyze = params.code || '';
    if (params.filePath) {
      codeToAnalyze = await readFileContent(params.filePath);
    } else if (params.files && params.files.length === 1) {
      codeToAnalyze = await readFileContent(params.files[0]);
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
        'custom_prompt',
        'single'
      );
    } else {
      // Simplified direct execution to avoid ResponseProcessor issues
      const maxTokens = Math.min(2000, Math.floor(contextLength * 0.3));
      const fullPrompt = `${promptStages.systemAndContext}

${promptStages.dataPayload}

${promptStages.outputInstructions}`;

      const response = await model.complete(fullPrompt, { maxTokens, temperature: 0.7 });
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        modelUsed: model.identifier || 'unknown',
        executionTimeMs: 0,
        data: response?.content || response?.text || response || 'No response content'
      };
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
      'custom_prompt',
      'multifile'
    );
  }

  /**
   * Single-file prompt stages - optimized for universal custom tasks
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { prompt, code, language, analysisDepth, analysisType, context, working_directory } = params;
    
    let systemAndContext = `You are an expert AI assistant specializing in ${analysisDepth} ${analysisType} tasks.

**Your Role**: Universal problem-solver and task executor with full access to dynamic token allocation
**Analysis Context**:
- Task Type: ${analysisType}
- Analysis Depth: ${analysisDepth}
- Language: ${language}
- Mode: Single File/Context Analysis
- Token Allocation: Dynamic (optimized for your current model's context window)

**Your Mission**: Execute the custom task with precision, creativity, and actionable results. You have access to the full context window of the loaded model, so don't hesitate to be comprehensive when the task requires it. You are the Swiss Army knife - adaptable, reliable, and comprehensive.`;

    if (working_directory) {
      systemAndContext += `\n- Working Directory: ${working_directory}`;
    }
    
    if (context) {
      systemAndContext += `\n\n**Task Context**:`;
      if (context.task_type) systemAndContext += `\n- Task Type: ${context.task_type}`;
      if (context.requirements) systemAndContext += `\n- Requirements: ${Array.isArray(context.requirements) ? context.requirements.join(', ') : context.requirements}`;
      if (context.constraints) systemAndContext += `\n- Constraints: ${Array.isArray(context.constraints) ? context.constraints.join(', ') : context.constraints}`;
      if (context.output_format) systemAndContext += `\n- Output Format: ${context.output_format}`;
    }

    let dataPayload = '';
    if (code && code.trim()) {
      dataPayload = `**File Content for Analysis:**

\`\`\`${language}
${code}
\`\`\``;
    } else {
      dataPayload = `**Context**: Ready to execute custom task without specific file context.`;
    }

    const outputInstructions = `**CUSTOM TASK TO EXECUTE:**

${prompt}

**Your Response Should:**
- Directly address the task requirements
- Be actionable and practical
- Match the requested output format (if specified)
- Demonstrate deep understanding and expertise
- Provide clear, implementable solutions

Execute this task with excellence and precision. You are Claude's trusted specialist for custom operations.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file prompt stages - optimized for complex custom tasks across multiple files
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { prompt, analysisResult, analysisType, analysisDepth, fileCount, context, working_directory } = params;
    
    let systemAndContext = `You are an expert multi-file AI analyst specializing in ${analysisDepth} ${analysisType} tasks.

**Your Role**: Advanced multi-file task executor and architectural consultant with full dynamic token access
**Analysis Context**:
- Task Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Processed: ${fileCount}
- Mode: Multi-File Custom Analysis
- Token Allocation: Dynamic (full model context window available)

**Your Mission**: Execute complex custom tasks across multiple files with comprehensive understanding. You have access to the full context window, so provide detailed, thorough analysis when appropriate. You excel at seeing patterns, relationships, and providing strategic insights across entire codebases and project structures.`;

    if (working_directory) {
      systemAndContext += `\n- Working Directory: ${working_directory}`;
    }
    
    if (context) {
      systemAndContext += `\n\n**Task Context**:`;
      if (context.task_type) systemAndContext += `\n- Task Type: ${context.task_type}`;
      if (context.requirements) systemAndContext += `\n- Requirements: ${Array.isArray(context.requirements) ? context.requirements.join(', ') : context.requirements}`;
      if (context.constraints) systemAndContext += `\n- Constraints: ${Array.isArray(context.constraints) ? context.constraints.join(', ') : context.constraints}`;
      if (context.output_format) systemAndContext += `\n- Output Format: ${context.output_format}`;
    }

    const dataPayload = `**Multi-File Analysis Results:**

${JSON.stringify(analysisResult, null, 2)}

**Files Analyzed**: ${fileCount} files processed across the project structure.`;

    const outputInstructions = `**CUSTOM MULTI-FILE TASK TO EXECUTE:**

${prompt}

**Your Multi-File Response Should:**
- Synthesize insights across all ${fileCount} analyzed files
- Identify cross-file patterns, dependencies, and relationships
- Provide architectural and strategic recommendations
- Address the task with comprehensive project-wide understanding
- Deliver actionable results that consider the entire codebase context
- Match any specified output format requirements

Execute this complex multi-file task with expert-level analysis and strategic thinking. You are Claude's advanced specialist for comprehensive project-wide operations.`;

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
      'custom_prompt', 
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
      summary: `Multi-file custom task analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        customTaskContext: {
          prompt: params.prompt,
          analysisType: params.analysisType,
          context: params.context
        }
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
      extension: file.split('.').pop() || '',
      customContext: {
        taskType: params.analysisType,
        prompt: params.prompt
      }
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'general': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.md', '.txt', '.json', '.xml', '.css', '.html'],
      'technical': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.h', '.go', '.rs', '.rb'],
      'creative': ['.md', '.txt', '.html', '.css', '.json', '.xml', '.yml', '.yaml'],
      'analytical': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.json', '.csv', '.sql', '.md']
    };
    
    return extensionMap[analysisType] || extensionMap.general;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default CustomPromptExecutor;
