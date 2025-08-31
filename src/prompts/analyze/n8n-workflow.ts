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

export class N8nWorkflowAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_n8n_workflow';
  category = 'analyze' as const;
  description = 'Analyze and optimize n8n workflow JSON for efficiency, error handling, and best practices';
  
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
    
    // n8n-specific parameters
    workflow: {
      type: 'object' as const,
      description: 'n8n workflow JSON object',
      required: false
    },
    optimizationFocus: {
      type: 'string' as const,
      description: 'Primary optimization focus',
      enum: ['performance', 'error-handling', 'maintainability', 'all'],
      default: 'all',
      required: false
    },
    includeCredentialCheck: {
      type: 'boolean' as const,
      description: 'Check for exposed credentials',
      default: true,
      required: false
    },
    suggestAlternativeNodes: {
      type: 'boolean' as const,
      description: 'Suggest alternative node configurations',
      default: true,
      required: false
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
      enum: ['workflow', 'security', 'comprehensive'],
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
        return ErrorHandler.createExecutionError('analyze_n8n_workflow', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // n8n workflow object indicates single-file analysis
    if (params.workflow) {
      return 'single-file';
    }
    
    // Multi-file indicators
    if (params.projectPath || params.files || params.maxDepth !== undefined) {
      return 'multi-file';
    }
    
    // Single-file indicators  
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Default to single-file for n8n workflow analysis
    return 'single-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      // For n8n, either workflow object, code, or filePath is required
      if (!params.workflow && !params.code && !params.filePath) {
        throw new Error('Either workflow object, code, or filePath is required for n8n workflow analysis');
      }
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['workflow', 'security', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'optimizationFocus', ['performance', 'error-handling', 'maintainability', 'all']);
  }

  /**
   * Execute single-file analysis
   */
  private async executeSingleFileAnalysis(params: any, model: any, contextLength: number) {
    // Process workflow input - could be direct workflow object, code string, or file
    let workflowToAnalyze;
    
    if (params.workflow) {
      workflowToAnalyze = params.workflow;
    } else if (params.filePath) {
      const fileContent = await readFileContent(params.filePath);
      try {
        workflowToAnalyze = JSON.parse(fileContent);
      } catch (error) {
        throw new Error('Failed to parse workflow JSON from file');
      }
    } else if (params.code) {
      try {
        workflowToAnalyze = JSON.parse(params.code);
      } catch (error) {
        throw new Error('Failed to parse workflow JSON from code parameter');
      }
    }
    
    // Generate prompt stages for single workflow
    const promptStages = this.getSingleFilePromptStages({
      ...params,
      workflow: workflowToAnalyze
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
        'analyze_n8n_workflow',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'analyze_n8n_workflow'
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
      'analyze_n8n_workflow',
      'multifile'
    );
  }

  /**
   * Implement n8n workflow single-file prompt stages
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { workflow, optimizationFocus, includeCredentialCheck, suggestAlternativeNodes, analysisDepth } = params;
    
    const systemAndContext = `You are an expert n8n workflow optimization specialist with extensive experience in automation, API integration, and workflow efficiency.

Analysis Context:
- Optimization Focus: ${optimizationFocus}
- Analysis Depth: ${analysisDepth}
- Include Credential Check: ${includeCredentialCheck}
- Suggest Alternative Nodes: ${suggestAlternativeNodes}
- Mode: Single Workflow Analysis

Your expertise covers:
- n8n node configurations and best practices
- API optimization and rate limiting strategies
- Error handling and workflow resilience
- Performance optimization and parallel processing
- Security assessment for automation workflows
- Workflow maintainability and organization

Your task is to provide comprehensive analysis and actionable optimization recommendations for this n8n workflow.`;

    const dataPayload = `n8n Workflow to Analyze:

\`\`\`json
${JSON.stringify(workflow, null, 2)}
\`\`\``;

    const outputInstructions = `Analyze this n8n workflow and provide a comprehensive optimization report in the following structured format:

## Workflow Analysis Summary
- Overall complexity assessment (node count: ${workflow?.nodes?.length || 0})
- Flow efficiency rating
- Primary optimization opportunities identified

## Detailed Analysis

### 1. Efficiency Issues
- Redundant nodes or operations
- Duplicate API calls that could be consolidated
- Unnecessary data transformations
- Node consolidation opportunities

### 2. Error Handling Review
- Missing error handling (Error Trigger nodes)
- Proper try-catch pattern implementation
- Retry configurations and strategies
- Error notification setup

### 3. Performance Optimization
- Bottlenecks and synchronous operations
- Parallel processing opportunities
- API rate limiting considerations
- Memory usage with large datasets

${includeCredentialCheck ? `
### 4. Security Assessment
- Exposed credentials or API keys in node configurations
- Sensitive data in logs or outputs
- Webhook authentication security
- Input sanitization validation
` : ''}

### 5. Maintainability Improvements
- Node naming conventions and clarity
- Workflow organization and logical grouping
- Sub-workflow opportunities for reusability
- Documentation completeness

${suggestAlternativeNodes ? `
### 6. Alternative Node Suggestions
- More efficient node alternatives for current setup
- Built-in vs custom code node recommendations
- Community node suggestions for better functionality
- Simpler implementation approaches
` : ''}

## Implementation Recommendations
1. **Priority Changes** (high impact, low effort first)
2. **Performance Improvements** with expected metrics
3. **Step-by-step Implementation Guide**
4. **Risk Assessment** for proposed changes

## Optimized Workflow Structure
Provide specific suggestions for structural improvements to the workflow design.

${this.getOptimizationFocusInstructions(optimizationFocus)}

**Important**: Reference specific node names and IDs from the workflow. Provide actionable recommendations with clear business impact and implementation steps.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement multi-file n8n workflow analysis (for multiple workflow files)
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, optimizationFocus } = params;
    
    const systemAndContext = `You are an expert n8n workflow architect specializing in ${analysisDepth} ${analysisType} analysis across multiple workflows.

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Workflows Analyzed: ${fileCount}
- Optimization Focus: ${optimizationFocus}
- Mode: Multi-Workflow Analysis

Your task is to provide comprehensive cross-workflow insights, identify shared patterns, and suggest architectural improvements across the entire n8n workflow collection.`;

    const dataPayload = `Multi-workflow analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Provide comprehensive multi-workflow analysis in the following structured format:

## Multi-Workflow Summary
Overall analysis of ${fileCount} n8n workflows with architectural recommendations

## Cross-Workflow Findings
### Shared Patterns & Duplications
- Common node configurations that could be standardized
- Duplicate API calls across workflows
- Shared data processing patterns
- Common error handling approaches

### Integration Opportunities  
- Workflows that could be combined or share sub-workflows
- Common triggers or data sources
- Shared credential management opportunities
- Cross-workflow dependencies and data flow

### Architectural Improvements
- Workflow organization and naming conventions
- Sub-workflow extraction opportunities
- Shared utility workflow recommendations
- Common variable and environment management

## Performance & Efficiency Analysis
- Resource usage across workflows
- Bottlenecks affecting multiple workflows
- Optimization opportunities with compound benefits
- Scaling considerations for the workflow collection

## Recommendations
### Immediate Actions
1. High-impact standardizations
2. Duplicate elimination priorities
3. Quick performance wins

### Strategic Improvements  
1. Architectural restructuring suggestions
2. Long-term maintainability enhancements
3. Scalability preparations

### Implementation Roadmap
Step-by-step approach for optimizing the entire workflow ecosystem

Focus on ${optimizationFocus} aspects and provide specific, actionable recommendations for managing multiple n8n workflows effectively.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Get focus-specific additional instructions
   */
  private getOptimizationFocusInstructions(focus: string): string {
    const instructions: Record<string, string> = {
      'performance': `
**Performance Focus Instructions:**
- Prioritize execution speed improvements and resource optimization
- Identify memory usage patterns and optimization opportunities
- Focus heavily on API call efficiency and caching strategies
- Suggest parallel processing configurations where beneficial
- Provide specific performance metrics estimates and benchmarks`,

      'error-handling': `
**Error Handling Focus Instructions:**
- Examine every potential failure point in the workflow
- Recommend comprehensive error recovery and resilience strategies
- Suggest proper retry logic configurations with exponential backoff
- Focus extensively on workflow reliability and fault tolerance
- Include detailed alerting, monitoring, and notification recommendations`,

      'maintainability': `
**Maintainability Focus Instructions:**
- Assess workflow complexity and readability thoroughly
- Review workflow organization, structure, and documentation
- Focus on long-term maintenance and team collaboration aspects
- Suggest modularization and reusability opportunities
- Consider upgrade paths and version management implications`,

      'all': `
**Comprehensive Analysis Instructions:**
- Balance all aspects: performance, reliability, maintainability, and security
- Prioritize recommendations by impact, implementation effort, and business value
- Consider scalability, future requirements, and growth scenarios
- Provide holistic optimization strategy with clear implementation phases`
    };
    
    return instructions[focus] || instructions.all;
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
      'analyze_n8n_workflow', 
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
    
    // Aggregate results into n8n-specific analysis format
    const aggregatedResult = {
      summary: `n8n workflow analysis of ${files.length} workflow files`,
      findings: fileAnalysisResults,
      data: {
        workflowCount: files.length,
        totalNodes: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.nodeCount || 0), 0),
        commonPatterns: this.identifyCommonPatterns(fileAnalysisResults),
        sharedTriggers: this.identifySharedTriggers(fileAnalysisResults)
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
    
    try {
      const workflow = JSON.parse(content);
      return {
        filePath: file,
        size: content.length,
        nodeCount: workflow.nodes?.length || 0,
        connections: workflow.connections ? Object.keys(workflow.connections).length : 0,
        triggers: workflow.nodes?.filter((node: any) => node.type?.includes('trigger')) || [],
        hasCredentials: workflow.nodes?.some((node: any) => node.credentials) || false
      };
    } catch (error) {
      return {
        filePath: file,
        size: content.length,
        error: 'Invalid JSON workflow file'
      };
    }
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'workflow': ['.json'], // n8n workflows are JSON files
      'security': ['.json'], // Same for security analysis
      'comprehensive': ['.json'] // Comprehensive analysis of JSON workflows
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private identifyCommonPatterns(results: any[]): string[] {
    // Analyze common node patterns across workflows
    const nodeTypes: Record<string, number> = {};
    
    results.forEach(result => {
      if (result.triggers) {
        result.triggers.forEach((trigger: any) => {
          nodeTypes[trigger.type] = (nodeTypes[trigger.type] || 0) + 1;
        });
      }
    });
    
    return Object.entries(nodeTypes)
      .filter(([_, count]) => count > 1)
      .map(([type, count]) => `${type} (used in ${count} workflows)`);
  }

  private identifySharedTriggers(results: any[]): string[] {
    const triggers = new Set<string>();
    
    results.forEach(result => {
      if (result.triggers) {
        result.triggers.forEach((trigger: any) => {
          triggers.add(trigger.type);
        });
      }
    });
    
    return Array.from(triggers);
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default N8nWorkflowAnalyzer;
