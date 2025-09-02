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

// Common Node.js modules - Use these instead of require()
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class RefactoringAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'suggest_refactoring';
  category = 'generate' as const;
  description = 'Analyze code and suggest refactoring improvements with project-specific patterns (handles both single and multi-file)';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'The code to analyze for refactoring (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single file to refactor',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Path to project root (for multi-file refactoring analysis)',
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
      description: 'Type of refactoring to focus on',
      enum: ['readability', 'performance', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    
    // Refactoring-specific parameters
    focusAreas: {
      type: 'array' as const,
      description: 'Areas to focus on for refactoring',
      required: false,
      items: {
        type: 'string' as const,
        enum: ['readability', 'performance', 'maintainability', 'testability', 'security', 'type-safety', 'error-handling', 'logging', 'documentation']
      },
      default: ['readability', 'maintainability']
    },
    context: {
      type: 'object' as const,
      description: 'Optional context for project-specific refactoring',
      required: false,
      properties: {
        projectType: {
          type: 'string' as const,
          enum: ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'node-api', 'n8n-node', 'n8n-workflow', 'html-component', 'browser-extension', 'cli-tool', 'generic'],
          description: 'Project type for appropriate patterns'
        },
        preserveApi: {
          type: 'boolean' as const,
          description: 'Maintain backward compatibility',
          default: true
        },
        modernizationLevel: {
          type: 'string' as const,
          enum: ['conservative', 'moderate', 'aggressive'],
          description: 'How aggressively to modernize code',
          default: 'moderate'
        },
        targetComplexity: {
          type: 'number' as const,
          description: 'Target cyclomatic complexity',
          default: 10
        },
        standards: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Coding standards to follow'
        }
      }
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
        return ErrorHandler.createExecutionError('suggest_refactoring', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   * 
   * For refactoring: Single-file is primary use case, multi-file for project-wide patterns
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
    
    // Default to single-file for refactoring (most common use case)
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
    ParameterValidator.validateEnum(params, 'analysisType', ['readability', 'performance', 'comprehensive']);
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
        'suggest_refactoring',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'suggest_refactoring'
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
      'suggest_refactoring',
      'multifile'
    );
  }

  /**
   * Implement single-file refactoring prompt stages
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, focusAreas, context } = params;
    const projectType = context?.projectType || 'generic';
    const modernizationLevel = context?.modernizationLevel || 'moderate';
    const preserveApi = context?.preserveApi !== false;
    const targetComplexity = context?.targetComplexity || 10;
    
    const systemAndContext = `You are a world-class software architect and refactoring expert with 20+ years of experience. Your mission is to transform code into masterpieces of clarity, performance, and maintainability.

**REFACTORING CONTEXT:**
- Language: ${language}
- Project Type: ${projectType}
- Analysis Focus: ${analysisType} (${analysisDepth} analysis)
- Focus Areas: ${focusAreas?.join(', ') || 'readability, maintainability'}
- API Preservation: ${preserveApi ? 'CRITICAL - Maintain backward compatibility' : 'Breaking changes allowed'}
- Modernization Level: ${modernizationLevel}
- Target Complexity: ≤${targetComplexity} cyclomatic complexity
- Standards: ${context?.standards?.join(', ') || 'Clean Code, SOLID principles'}

**YOUR EXPERTISE:**
${this.getProjectSpecificExpertise(projectType, language)}

**REFACTORING PHILOSOPHY:**
- Code should read like well-written prose
- Every line should have a clear purpose
- Complexity is the enemy of maintainability
- Performance optimizations must be measurable
- Security should be built-in, not bolted-on

You identify anti-patterns like a detective finds clues, and you craft solutions that developers will thank you for years later.`;

    const dataPayload = `**CODE TO REFACTOR:**

\`\`\`${language}
${code}
\`\`\`

**CONTEXT CLUES:**
- File appears to be: ${this.inferCodePurpose(code, language)}
- Estimated complexity: ${this.estimateComplexity(code)}
- Key patterns detected: ${this.detectPatterns(code, language)}`;

    const outputInstructions = `**DELIVER COMPREHENSIVE REFACTORING ANALYSIS:**

## 🔍 Code Health Assessment
**Current State Analysis:**
- Code smells identified (be specific with line references)
- Complexity metrics (cyclomatic, cognitive load)
- Maintainability score and reasoning
- Performance bottlenecks (if ${focusAreas?.includes('performance') ? 'applicable' : 'obvious'})
- Security vulnerabilities (if ${focusAreas?.includes('security') ? 'applicable' : 'critical'})

## ✨ Refactoring Roadmap
**Priority 1 (Critical Issues):**
- Issue: [Specific problem with line numbers]
- Impact: [How it hurts ${focusAreas?.join(', ')}]
- Solution: [Exact refactoring technique]
- Code Example: [Before/after snippet]

**Priority 2 (Significant Improvements):**
[Same structure as Priority 1]

**Priority 3 (Polish & Optimization):**
[Same structure as Priority 1]

## 🏗️ Architecture Recommendations
${this.getArchitectureGuidelines(projectType, modernizationLevel)}

## 📝 Refactored Code Examples
Show complete before/after examples for major improvements:

\`\`\`${language}
// BEFORE (problematic)
[original code section]

// AFTER (refactored)
[improved code section]
\`\`\`

## 📊 Improvement Metrics
- Complexity reduction: [current] → [target]
- Readability improvement: [specific gains]
- Performance impact: ${focusAreas?.includes('performance') ? '[measurable improvements]' : '[maintainability focused]'}
- Test coverage considerations
- ${preserveApi ? 'Backward compatibility: [how preserved]' : 'Breaking changes: [migration path]'}

## 🚀 Implementation Strategy
**Phase 1 (Foundation):** [Safe, non-breaking improvements]
**Phase 2 (Enhancement):** [Structural improvements]
**Phase 3 (Optimization):** [Performance and advanced patterns]

**Migration Notes:** ${preserveApi ? 'All changes maintain API compatibility' : 'Breaking changes documented with migration guide'}

Focus on providing actionable, copy-paste ready improvements that make developers say "Wow, this is so much cleaner!"`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement multi-file refactoring prompt stages
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, focusAreas, context } = params;
    const projectType = context?.projectType || 'generic';
    
    const systemAndContext = `You are a senior software architect specializing in large-scale refactoring and system design. Your expertise lies in identifying cross-file patterns, architectural debt, and system-wide improvements.

**PROJECT-WIDE REFACTORING CONTEXT:**
- Project Type: ${projectType}
- Files Analyzed: ${fileCount}
- Analysis Focus: ${analysisType} (${analysisDepth} analysis)
- Focus Areas: ${focusAreas?.join(', ') || 'architecture, maintainability'}
- Scope: Cross-file patterns and system architecture

**YOUR ARCHITECTURAL EXPERTISE:**
${this.getProjectSpecificExpertise(projectType, 'multi-file')}

**SYSTEM-LEVEL REFACTORING PHILOSOPHY:**
- Architecture should support change, not resist it
- Coupling should be loose, cohesion should be high
- Patterns should emerge naturally, not be forced
- Dependencies should flow in one direction
- Complexity should be managed, not just moved around

You see the forest, not just the trees, and you design systems that scale gracefully.`;

    const dataPayload = `**PROJECT ANALYSIS RESULTS:**

${JSON.stringify(analysisResult, null, 2)}

**SYSTEM OVERVIEW:**
- Total Files: ${fileCount}
- Project Structure: ${this.analyzeProjectStructure(analysisResult)}
- Key Dependencies: ${this.identifyKeyDependencies(analysisResult)}`;

    const outputInstructions = `**DELIVER PROJECT-WIDE REFACTORING STRATEGY:**

## 🏗️ Architectural Assessment
**Current Architecture Analysis:**
- System boundaries and responsibilities
- Coupling and cohesion patterns
- Dependency direction and cycles
- Cross-cutting concerns identification

## 🎯 Cross-File Refactoring Opportunities
**Pattern-Level Issues:**
- Anti-pattern: [Specific architectural problem]
- Affected Files: [List of files showing this pattern]
- Impact: [How it hurts system ${focusAreas?.join(', ')}]
- Solution: [Architectural refactoring approach]
- Migration Strategy: [Step-by-step approach]

## 📁 File Organization Recommendations
**Directory Structure Improvements:**
- Current issues with organization
- Proposed structure changes
- File naming conventions
- Module boundary definitions

## 🔄 Dependency Refactoring
**Dependency Health:**
- Circular dependency issues
- Missing abstractions
- Coupling hotspots
- Dependency injection opportunities

## 📋 System-Wide Improvements
**Cross-Cutting Refactoring:**
1. **Error Handling Standardization**
2. **Logging Strategy Unification** 
3. **Configuration Management**
4. **Testing Strategy Alignment**
5. **Performance Monitoring Integration**

## 🚀 Implementation Roadmap
**Phase 1 (Foundation):** [Architecture groundwork]
- Files to refactor: [specific list]
- Dependencies to restructure
- New abstractions to introduce

**Phase 2 (Systematization):** [Pattern application]
- Cross-file pattern implementation
- Interface standardization
- Testing infrastructure

**Phase 3 (Optimization):** [Performance and scaling]
- Performance bottleneck resolution
- Scalability improvements
- Monitoring and observability

## 📊 Project Health Metrics
- Architecture debt reduction
- Coupling metrics improvement
- Code reuse opportunities
- Maintainability index gains

Provide a roadmap that transforms the entire codebase into a well-architected, maintainable system that developers love working with.`;

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
      'suggest_refactoring', 
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
      summary: `Refactoring analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        codeHealth: this.assessCodeHealth(fileAnalysisResults),
        architecturalPatterns: this.identifyArchitecturalPatterns(fileAnalysisResults)
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
    const content = await readFile(file, 'utf-8');
    const stats = await stat(file);
    
    return {
      filePath: file,
      fileName: basename(file),
      size: content.length,
      lines: content.split('\n').length,
      extension: extname(file),
      relativePath: relative(params.projectPath || '', file),
      complexity: this.estimateComplexity(content),
      patterns: this.detectPatterns(content, extname(file).substring(1)),
      purpose: this.inferCodePurpose(content, extname(file).substring(1))
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'readability': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb'],
      'performance': ['.js', '.ts', '.py', '.java', '.cs', '.cpp', '.c', '.php'], 
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go', '.rs', '.cpp', '.c']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  // Helper methods for intelligent analysis
  private getProjectSpecificExpertise(projectType: string, language: string): string {
    const expertise: Record<string, string> = {
      'wordpress-plugin': 'WordPress hooks, actions, filters, security (nonces, sanitization), database optimization, WP coding standards',
      'wordpress-theme': 'Template hierarchy, theme.json, block patterns, accessibility, performance optimization, SEO',
      'react-app': 'Component composition, hooks optimization, state management, performance (memoization, lazy loading)',
      'react-component': 'Reusable patterns, prop design, accessibility, testing strategies, Storybook integration',
      'node-api': 'RESTful design, middleware patterns, error handling, security (authentication, validation), performance',
      'n8n-node': 'Webhook handling, credential management, error recovery, data transformation, batch processing',
      'n8n-workflow': 'Node orchestration, error handling, data flow optimization, conditional logic, loop efficiency',
      'html-component': 'Semantic HTML, CSS architecture, accessibility (ARIA), progressive enhancement, performance',
      'browser-extension': 'Content scripts, message passing, permission management, security, cross-browser compatibility',
      'cli-tool': 'Argument parsing, error handling, progress indication, cross-platform compatibility, performance',
      'generic': 'Clean code principles, SOLID design, design patterns, testing strategies, documentation'
    };
    
    return expertise[projectType] || expertise.generic;
  }

  private getArchitectureGuidelines(projectType: string, modernizationLevel: string): string {
    const base = `**Design Patterns to Consider:**
- Strategy Pattern for algorithm variations
- Observer Pattern for event handling
- Factory Pattern for object creation
- Repository Pattern for data access`;

    const modernization = modernizationLevel === 'aggressive' ? `
**Modernization Opportunities:**
- Latest language features and syntax
- Modern async patterns (async/await over callbacks)
- Module system upgrades
- Framework pattern updates` : '';

    const projectSpecific: Record<string, string> = {
      'wordpress-plugin': `
**WordPress Architecture:**
- Proper hook organization and priority
- Object-oriented plugin structure
- Namespace implementation
- Admin interface separation`,
      'react-app': `
**React Architecture:**
- Component composition patterns
- Custom hooks for logic reuse
- Context API for state management
- Error boundary implementation`,
      'node-api': `
**API Architecture:**
- Layered architecture (controller, service, repository)
- Middleware chain optimization
- Input validation strategies
- Response consistency patterns`
    };

    return base + modernization + (projectSpecific[projectType] || '');
  }

  private estimateComplexity(code: string): string {
    const lines = code.split('\n').length;
    const functions = (code.match(/function|=>|def |class /g) || []).length;
    const conditions = (code.match(/if|else|switch|case|for|while|catch/g) || []).length;
    
    if (conditions > functions * 3) return 'High';
    if (conditions > functions * 1.5) return 'Moderate';
    return 'Low';
  }

  private detectPatterns(code: string, language: string): string[] {
    const patterns: string[] = [];
    
    if (code.includes('class ') || code.includes('function ')) patterns.push('Object-Oriented');
    if (code.includes('=>') || code.includes('map(') || code.includes('filter(')) patterns.push('Functional');
    if (code.includes('async') || code.includes('await') || code.includes('Promise')) patterns.push('Asynchronous');
    if (code.includes('try') || code.includes('catch')) patterns.push('Error-Handling');
    if (code.includes('test(') || code.includes('describe(') || code.includes('it(')) patterns.push('Testing');
    
    return patterns;
  }

  private inferCodePurpose(code: string, language: string): string {
    if (code.includes('router') || code.includes('app.get') || code.includes('express')) return 'API/Server';
    if (code.includes('component') || code.includes('jsx') || code.includes('useState')) return 'UI Component';
    if (code.includes('test') || code.includes('spec') || code.includes('describe')) return 'Test Suite';
    if (code.includes('config') || code.includes('settings') || code.includes('env')) return 'Configuration';
    if (code.includes('util') || code.includes('helper') || code.includes('lib')) return 'Utility/Helper';
    return 'Business Logic';
  }

  private assessCodeHealth(results: any[]): any {
    return {
      averageComplexity: results.reduce((sum, r) => sum + (r.complexity === 'High' ? 3 : r.complexity === 'Moderate' ? 2 : 1), 0) / results.length,
      largestFiles: results.sort((a, b) => b.size - a.size).slice(0, 3),
      patternDistribution: this.aggregatePatterns(results)
    };
  }

  private identifyArchitecturalPatterns(results: any[]): string[] {
    const allPatterns = results.flatMap(r => r.patterns || []);
    const uniquePatterns = [...new Set(allPatterns)];
    return uniquePatterns;
  }

  private aggregatePatterns(results: any[]): Record<string, number> {
    const patternCount: Record<string, number> = {};
    results.forEach(result => {
      (result.patterns || []).forEach((pattern: string) => {
        patternCount[pattern] = (patternCount[pattern] || 0) + 1;
      });
    });
    return patternCount;
  }

  private analyzeProjectStructure(analysisResult: any): string {
    // Simple structure analysis based on file paths
    const files = analysisResult.findings || [];
    const directories = [...new Set(files.map((f: any) => dirname(f.relativePath || f.filePath)))];
    return `${directories.length} directories, organized by ${directories.includes('src') ? 'source structure' : 'functional areas'}`;
  }

  private identifyKeyDependencies(analysisResult: any): string {
    // Extract patterns that suggest dependencies
    const findings = analysisResult.findings || [];
    const imports = findings.flatMap((f: any) => f.patterns || []).filter((p: string) => p.includes('import') || p.includes('require'));
    return imports.length > 0 ? `${imports.length} import patterns detected` : 'Self-contained modules';
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default RefactoringAnalyzer;
