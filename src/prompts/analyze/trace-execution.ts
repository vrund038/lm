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

export class ExecutionPathTracer extends BasePlugin implements IPromptPlugin {
  name = 'trace_execution_path';
  category = 'analyze' as const;
  description = 'Trace execution path through multiple files starting from an entry point. Shows complete call flow with intelligent analysis and architectural insights.';
  
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
    
    // Execution tracing specific parameters
    entryPoint: {
      type: 'string' as const,
      description: 'Entry point like ClassName::methodName or functionName',
      required: true
    },
    traceDepth: {
      type: 'number' as const,
      description: 'Maximum depth to trace (1-10)',
      required: false,
      default: 5
    },
    showParameters: {
      type: 'boolean' as const,
      description: 'Include parameter information in trace',
      required: false,
      default: false
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
      enum: ['execution-flow', 'call-graph', 'comprehensive'],
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
        return ErrorHandler.createExecutionError('trace_execution_path', error);
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
    
    // Default to multi-file for execution tracing (usually spans multiple files)
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
      ParameterValidator.validateDepth(params, 1, 5);
    }
    
    // Execution tracing specific validations
    if (!params.entryPoint || typeof params.entryPoint !== 'string') {
      throw new Error('Entry point is required and must be a string (e.g., "ClassName::methodName" or "functionName")');
    }
    
    // Validate trace depth
    if (params.traceDepth && (params.traceDepth < 1 || params.traceDepth > 10)) {
      throw new Error('Trace depth must be between 1 and 10');
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['execution-flow', 'call-graph', 'comprehensive']);
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
        'trace_execution_path',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'trace_execution_path'
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
      'trace_execution_path',
      'multifile'
    );
  }

  /**
   * Single-file execution tracing prompt stages
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, entryPoint, traceDepth, showParameters } = params;
    
    const systemAndContext = `You are an expert execution flow analyst and senior software architect specializing in ${analysisDepth} ${analysisType} analysis.

Your expertise spans 15+ years in software architecture, debugging, performance optimization, and code analysis across multiple programming languages and paradigms.

Analysis Context:
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Entry Point: ${entryPoint}
- Trace Depth: ${traceDepth} levels
- Parameter Details: ${showParameters ? 'Include full method signatures and parameters' : 'Focus on method names and call flow'}
- Mode: Single File Execution Analysis

CORE COMPETENCIES:
- Execution flow tracing and call graph analysis
- Performance bottleneck identification
- Architecture pattern recognition
- Cross-cutting concern analysis
- Error handling pathway evaluation
- Code quality and maintainability assessment

Your task is to trace the execution path starting from the specified entry point within this single file, providing deep architectural insights and actionable recommendations for optimization and improvement.`;

    const dataPayload = `Code to analyze for execution tracing:

Entry Point: ${entryPoint}

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `EXECUTION TRACING ANALYSIS - SINGLE FILE

Perform comprehensive execution flow analysis starting from: **${entryPoint}**

## 1. ENTRY POINT VALIDATION
- Locate the exact entry point in the provided code
- Verify the entry point signature and accessibility
- Note the initial execution context (function, method, closure scope)

## 2. EXECUTION FLOW TRACING
Trace the execution path step-by-step up to ${traceDepth} levels deep:

**Flow Visualization:**
\`\`\`
${entryPoint}
├─> Step 1: [Line X] FunctionCall${showParameters ? '(param1: type, param2: type)' : '()'}
│   ├─> Step 1.1: [Line Y] SubFunction${showParameters ? '(args)' : ''}
│   │   └─> Step 1.1.1: [Line Z] DeeperCall
│   └─> Step 1.2: [Line A] ConditionalBranch
├─> Step 2: [Line B] NextOperation
└─> Step 3: [Line C] FinalStep
\`\`\`

${showParameters ? '**Include for each step:**\n- Full method signatures with parameter types\n- Actual arguments passed at each call site\n- Parameter transformations and validations' : '**Include for each step:**\n- Method/function names and line numbers\n- Conditional branches that affect flow\n- Loop iterations and recursive patterns'}

## 3. EXECUTION ANALYSIS

**Control Flow Patterns:**
- Conditional branches and their impact
- Loop structures and iteration patterns
- Exception handling and error paths
- Asynchronous operations and callbacks

**Data Flow Analysis:**
- Variable mutations throughout execution
- Parameter passing and transformation
- Return value propagation
- Side effects and state changes

## 4. PERFORMANCE INSIGHTS

**Execution Characteristics:**
- Computational complexity assessment
- Potential performance bottlenecks
- Resource usage patterns
- Scalability considerations

**Optimization Opportunities:**
- Redundant operations identification
- Caching potential
- Algorithm improvement suggestions
- Resource management optimizations

## 5. ARCHITECTURE QUALITY ASSESSMENT

**Code Structure Analysis:**
- Single Responsibility Principle adherence
- Function/method length and complexity
- Coupling and cohesion evaluation
- Design pattern usage

**Maintainability Factors:**
- Code readability and clarity
- Error handling robustness
- Documentation coverage
- Testing considerations

## 6. ACTIONABLE RECOMMENDATIONS

**Immediate Improvements:**
1. [Specific, implementable suggestions]
2. [Performance optimizations]
3. [Code quality enhancements]

**Strategic Refactoring Opportunities:**
1. [Architectural improvements]
2. [Design pattern implementations]
3. [Long-term maintainability enhancements]

## 7. EXECUTION SUMMARY

Provide a concise summary:
- **Total execution steps**: [count]
- **Maximum depth reached**: [level]
- **Conditional branches**: [count]
- **Performance rating**: [Excellent/Good/Fair/Poor]
- **Maintainability score**: [1-10 with rationale]
- **Critical issues found**: [count and brief list]

Focus on providing practical, actionable insights that help developers understand, debug, and optimize their code execution paths.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file execution tracing prompt stages
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, entryPoint, traceDepth, showParameters } = params;
    
    const systemAndContext = `You are a senior software architect and execution flow expert specializing in ${analysisDepth} multi-file ${analysisType} analysis.

With 15+ years of experience in complex system architecture, you excel at:
- Cross-file execution tracing and dependency analysis
- Large-scale system performance optimization
- Architecture pattern identification across codebases
- Inter-module communication analysis
- System bottleneck detection and resolution

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Entry Point: ${entryPoint}
- Trace Depth: ${traceDepth} levels
- Parameter Analysis: ${showParameters ? 'Include detailed signatures and data flow' : 'Focus on call patterns and structure'}
- Mode: Multi-File Cross-System Analysis

ADVANCED CAPABILITIES:
- Cross-file execution path mapping
- Inter-module dependency analysis
- System-wide performance profiling
- Architecture anti-pattern detection
- Scalability and maintainability assessment
- Integration point vulnerability analysis

Your task is to trace execution flow across multiple files, providing strategic architectural insights and comprehensive system-level recommendations.`;

    const dataPayload = `Multi-file execution analysis results for entry point: ${entryPoint}

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `MULTI-FILE EXECUTION TRACING ANALYSIS

Perform comprehensive cross-file execution flow analysis starting from: **${entryPoint}**

## 1. CROSS-FILE ENTRY POINT ANALYSIS
- **Entry Point Location**: [File:Line] or analysis of likely location
- **Initial Context**: [Module/Class/Namespace] 
- **Accessibility**: [Public/Private/Protected/Internal]
- **Dependencies**: [Immediate imports/requires needed]

## 2. CROSS-FILE EXECUTION TRACE

**System-Wide Execution Flow:**
\`\`\`
${entryPoint} [EntryFile.ext:line]
├─> FileA.method1() [FileA.ext:line]
│   ├─> FileB.helper() [FileB.ext:line] 
│   │   └─> FileC.utility() [FileC.ext:line]
│   └─> FileA.validation() [FileA.ext:line]
├─> FileD.process() [FileD.ext:line]
│   ├─> FileE.transform() [FileE.ext:line]
│   └─> FileF.save() [FileF.ext:line]
└─> FileA.cleanup() [FileA.ext:line]
\`\`\`

**File Transition Analysis:**
For each cross-file call, detail:
${showParameters ? '- Full method signatures and parameter mappings\n- Data transformation between files\n- Interface contract compliance\n- Error propagation patterns' : '- Method names and call patterns\n- File-to-file dependencies\n- Interface boundaries\n- Error handling chains'}

## 3. SYSTEM ARCHITECTURE ANALYSIS

**Module Interaction Patterns:**
- **Coupling Analysis**: [Tight/Loose coupling assessment]
- **Cohesion Evaluation**: [High/Medium/Low cohesion ratings]
- **Dependency Direction**: [Proper/Circular/Inverted dependencies]
- **Interface Quality**: [Clean/Complex/Inconsistent interfaces]

**Cross-File Communication:**
- **Data Flow Patterns**: [How data moves between files]
- **Error Propagation**: [How errors bubble through the system]
- **State Management**: [Shared state and mutation patterns]
- **Resource Sharing**: [Database connections, file handles, etc.]

## 4. PERFORMANCE & SCALABILITY ASSESSMENT

**System-Level Performance:**
- **Cross-File Call Overhead**: [Network/I/O/Memory implications]
- **Data Transfer Efficiency**: [Serialization, caching opportunities]
- **Bottleneck Identification**: [Files/methods with highest call frequency]
- **Scalability Constraints**: [System limits and growth barriers]

**Resource Usage Analysis:**
- **Memory Footprint**: [Object lifecycle across files]
- **I/O Operations**: [File/database/network access patterns]
- **CPU Utilization**: [Computational hotspots]
- **Concurrency Considerations**: [Thread safety, async patterns]

## 5. ARCHITECTURE QUALITY & PATTERNS

**Design Patterns Detected:**
- **Structural Patterns**: [MVC, Layered Architecture, etc.]
- **Behavioral Patterns**: [Observer, Command, Strategy, etc.]
- **Integration Patterns**: [Facade, Adapter, Proxy, etc.]

**Architecture Anti-Patterns:**
- **God Object**: [Files/classes with too many responsibilities]
- **Circular Dependencies**: [Problematic dependency cycles]
- **Tight Coupling**: [Hard-to-change interdependencies]
- **Inappropriate Intimacy**: [Classes knowing too much about each other]

## 6. CRITICAL SYSTEM ANALYSIS

**Potential Issues Found:**
- **Missing Error Handling**: [Unhandled exceptions across file boundaries]
- **Resource Leaks**: [Unclosed connections, memory leaks]
- **Security Vulnerabilities**: [Input validation gaps, injection points]
- **Concurrency Issues**: [Race conditions, deadlock potential]

**Integration Weaknesses:**
- **Fragile Interfaces**: [Brittle contracts between modules]
- **Single Points of Failure**: [Critical system dependencies]
- **Data Consistency**: [State synchronization problems]
- **Version Compatibility**: [API mismatch risks]

## 7. STRATEGIC RECOMMENDATIONS

**Immediate Actions (High Priority):**
1. **Critical Fixes**: [Security/performance/stability issues]
2. **Quick Wins**: [Low-effort, high-impact improvements]
3. **Risk Mitigation**: [Address single points of failure]

**Medium-Term Improvements:**
1. **Architecture Refactoring**: [Module restructuring opportunities]
2. **Performance Optimization**: [System-wide efficiency improvements]
3. **Interface Cleanup**: [API standardization and improvement]

**Long-Term Strategic Initiatives:**
1. **Scalability Enhancements**: [Prepare for growth]
2. **Maintainability Improvements**: [Reduce technical debt]
3. **Technology Modernization**: [Upgrade opportunities]

## 8. EXECUTION FLOW SUMMARY

**System Execution Characteristics:**
- **Total Files Involved**: ${fileCount}
- **Cross-File Transitions**: [count]
- **Maximum Execution Depth**: [level reached]
- **Circular Dependencies**: [count and severity]
- **Performance Bottlenecks**: [top 3 critical areas]

**System Health Assessment:**
- **Architecture Quality**: [Excellent/Good/Fair/Poor]
- **Maintainability Score**: [1-10 with detailed rationale]
- **Scalability Rating**: [High/Medium/Low with constraints]
- **Security Posture**: [Strong/Adequate/Weak with specific concerns]

**Next Steps Priority Matrix:**
| Priority | Action Item | Impact | Effort | Timeline |
|----------|-------------|---------|--------|----------|
| High     | [Action]    | High    | Low    | Week 1   |
| Medium   | [Action]    | Medium  | Medium | Month 1  |
| Low      | [Action]    | High    | High   | Quarter  |

Focus on providing strategic, system-level insights that help architects and senior developers understand the holistic execution patterns and make informed decisions about system evolution and optimization.`;

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
      'trace_execution_path', 
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
      summary: `Cross-file execution analysis of ${files.length} files for entry point: ${params.entryPoint}`,
      findings: fileAnalysisResults,
      data: {
        entryPoint: params.entryPoint,
        traceDepth: params.traceDepth,
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        entryPointInfo: this.parseEntryPoint(params.entryPoint),
        crossFileTransitions: this.identifyPotentialTransitions(fileAnalysisResults, params.entryPoint)
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
      modified: stats.mtime,
      hasEntryPoint: content.includes(params.entryPoint.split('::').pop() || params.entryPoint),
      functionCount: (content.match(/function\s+\w+/g) || []).length,
      classCount: (content.match(/class\s+\w+/g) || []).length
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'execution-flow': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.c', '.h'],
      'call-graph': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.c', '.h'], 
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.rb', '.go', '.rs']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private parseEntryPoint(entryPoint: string): any {
    // Parse different entry point formats
    const doubleColonMatch = entryPoint.match(/^([^:]+)::(.+)$/);
    if (doubleColonMatch) {
      return {
        type: 'class_method',
        className: doubleColonMatch[1],
        methodName: doubleColonMatch[2]
      };
    }
    
    const dotMatch = entryPoint.match(/^([^.]+)\.(.+)$/);
    if (dotMatch) {
      return {
        type: 'qualified',
        namespace: dotMatch[1],
        name: dotMatch[2]
      };
    }
    
    return {
      type: 'function',
      functionName: entryPoint
    };
  }

  private identifyPotentialTransitions(fileAnalysisResults: any[], entryPoint: string): any[] {
    // Identify files that might have cross-file calls based on content analysis
    const transitions: any[] = [];
    const entryPointName = entryPoint.split('::').pop() || entryPoint;
    
    fileAnalysisResults.forEach(file => {
      if (file.hasEntryPoint) {
        transitions.push({
          file: file.filePath,
          type: 'entry_point_location',
          confidence: 'high'
        });
      }
    });
    
    return transitions;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default ExecutionPathTracer;
