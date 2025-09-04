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

export class CodeStructureAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_single_file';
  category = 'analyze' as const;
  description = 'Analyze code structure, quality, patterns, and provide actionable recommendations for individual files or entire projects';
  
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
      enum: ['structure', 'quality', 'security', 'performance', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    
    // Enhanced context parameter
    context: {
      type: 'object' as const,
      description: 'Optional context for framework-specific analysis',
      required: false,
      properties: {
        projectType: {
          type: 'string' as const,
          enum: ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'n8n-node', 'node-api', 'html-component', 'generic'],
          description: 'Type of project for specialized analysis'
        },
        framework: {
          type: 'string' as const,
          description: 'Framework being used (e.g., WordPress, React, Express)'
        },
        frameworkVersion: {
          type: 'string' as const,
          description: 'Framework version for version-specific recommendations'
        },
        standards: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Coding standards to validate against'
        },
        environment: {
          type: 'string' as const,
          enum: ['browser', 'node', 'wordpress', 'hybrid'],
          description: 'Runtime environment for context-aware analysis'
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
        return ErrorHandler.createExecutionError('analyze_single_file', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   * 
   * DETECTION GUIDE:
   * Single-file: code, filePath provided → analyze individual file
   * Multi-file: projectPath, files provided → analyze project/multiple files
   * Default: single-file (this plugin's primary use case)
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
    
    // Default to single-file for code analysis
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
    ParameterValidator.validateEnum(params, 'analysisType', ['structure', 'quality', 'security', 'performance', 'comprehensive']);
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
        'analyze_single_file',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'analyze_single_file'
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
      'analyze_single_file',
      'multifile'
    );
  }

  /**
   * Implement single-file prompt stages - OPTIMIZED FOR POWERFUL CODE ANALYSIS
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, filePath, context = {} } = params;
    const projectType = context.projectType || 'generic';
    const framework = context.framework || 'none specified';
    const standards = context.standards?.join(', ') || 'clean code principles';
    
    const systemAndContext = `You are a world-class senior software architect and code quality expert with deep expertise in ${language} and ${analysisDepth} code analysis.

**ANALYSIS CONTEXT:**
- Programming Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Project Type: ${projectType}
- Framework: ${framework} ${context.frameworkVersion ? `v${context.frameworkVersion}` : ''}
- Coding Standards: ${standards}
- Runtime Environment: ${context.environment || 'not specified'}
- File: ${filePath ? basename(filePath) : 'inline code'}

**YOUR EXPERTISE:**
You have 20+ years of experience in software development, code review, and architectural design. You understand:
- Design patterns and anti-patterns
- Performance optimization techniques
- Security vulnerabilities and best practices
- Framework-specific conventions and idioms
- Code maintainability and testability principles
- Industry best practices for ${language} development

${this.getProjectSpecificInstructions(projectType)}

**ANALYSIS APPROACH:**
1. **Structure Analysis**: Examine code organization, modularity, and architectural patterns
2. **Quality Assessment**: Evaluate maintainability, readability, and adherence to best practices
3. **Security Review**: Identify potential vulnerabilities and security concerns
4. **Performance Analysis**: Spot performance bottlenecks and optimization opportunities
5. **Actionable Recommendations**: Provide specific, implementable improvements with examples

You are thorough, insightful, and provide actionable feedback that helps developers grow and improve their code quality.`;

    const dataPayload = `**CODE TO ANALYZE:**

\`\`\`${language}
${code}
\`\`\`

${filePath ? `\n**File Path:** ${filePath}` : ''}`;

    const outputInstructions = `Provide a comprehensive code analysis covering all aspects of the ${language} code:

**Code Overview & Purpose:**
Provide a 2-3 sentence summary of what this code does, its overall quality level, and the main areas that need attention.

**Structural Analysis:**
- **Architecture**: Describe the code's architectural approach and organization
- **Components**: List key classes, functions, modules, and their roles
- **Dependencies**: Identify imports, exports, and external dependencies
- **Design Patterns**: Note any design patterns or architectural patterns used

**Quality Assessment:**
- **Lines of Code**: Estimate total lines and assess if appropriate for functionality
- **Complexity**: Evaluate cyclomatic complexity (low/medium/high) and maintainability
- **Code Quality**: Rate maintainability, testability, and reusability (high/medium/low)
- **Standards Adherence**: How well it follows ${language} and ${framework} best practices

**Issues & Findings:**
For each issue found, provide:
- **Type**: issue, improvement, security concern, or performance problem
- **Severity**: critical, high, medium, or low priority
- **Location**: Specific line numbers where possible
- **Description**: Clear explanation of the problem
- **Impact**: How this affects the code's functionality or quality
- **Recommendation**: Specific steps to fix or improve
- **Code Example**: Show before/after code where helpful

**Security Assessment:**
- **Vulnerability Analysis**: Identify potential security issues
- **Risk Level**: Overall security risk (critical/high/medium/low/none)  
- **Security Recommendations**: Specific security improvements needed
- **Best Practices**: Security practices being followed or missing

**Performance Analysis:**
- **Bottlenecks**: Identify performance issues or inefficiencies
- **Optimization Opportunities**: Suggest specific performance improvements
- **Impact Assessment**: Estimate the performance impact of suggested changes

**Actionable Recommendations:**
Organize suggestions by priority:
- **Immediate Actions**: Critical fixes needed right away
- **Short-term Improvements**: Quality enhancements for next iteration
- **Long-term Enhancements**: Architectural or major structural improvements

**Code Examples:**
Where applicable, provide before/after code examples showing:
- Current problematic code
- Improved version with fix applied
- Clear explanation of why the improvement helps

**Best Practices Assessment:**
- Highlight coding practices being done well
- Identify areas where ${language}/${framework} best practices should be adopted
- Consider ${projectType} specific requirements and conventions

**Implementation Guidance:**
- Prioritize recommendations by impact and effort required
- Provide specific, actionable steps that can be implemented immediately
- Consider the existing codebase context and constraints
- Balance perfectionism with practical improvement steps

Focus on being constructive, specific, and actionable. Include line numbers where possible, and ensure all recommendations are implementable within the project's context.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement multi-file prompt stages for project-wide analysis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, context = {} } = params;
    const projectType = context.projectType || 'generic';
    
    const systemAndContext = `You are a senior software architect specializing in ${analysisDepth} multi-file project analysis.

**PROJECT ANALYSIS CONTEXT:**
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Project Type: ${projectType}
- Mode: Multi-File Architecture Analysis

**YOUR EXPERTISE:**
You excel at identifying cross-file patterns, architectural issues, and system-wide improvements. You understand how files interact, dependencies flow, and architectural patterns emerge across codebases.

**FOCUS AREAS:**
- Cross-file dependencies and coupling
- Architectural patterns and violations  
- Code duplication and reuse opportunities
- Consistency across modules
- System-wide security and performance concerns`;

    const dataPayload = `**PROJECT ANALYSIS RESULTS:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**PROVIDE PROJECT-WIDE ANALYSIS:**

## Executive Summary
Overall architectural assessment and key findings across the entire project.

## Architecture Analysis
- **Architectural Patterns**: Patterns identified across the codebase
- **Architecture Violations**: Areas where architectural principles are violated
- **Architectural Strengths**: What the project does well architecturally  
- **Architectural Weaknesses**: Areas needing architectural improvement

## Cross-File Analysis
For each cross-file issue identified:
- **Issue Type**: Duplication, coupling, inconsistency, security, or performance
- **Severity Level**: Critical, high, medium, or low impact
- **Issue Title**: Descriptive name for the cross-file issue
- **Description**: Detailed explanation of the cross-file problem
- **Affected Files**: List of files involved in this issue
- **System Impact**: How this affects the overall system
- **Resolution Strategy**: Specific steps to resolve across files

## Dependency Analysis
- **Coupling Assessment**: Overall coupling level (high/medium/low)
- **Circular Dependencies**: Any circular dependency issues found
- **Unused Dependencies**: Dependencies that can be removed
- **Dependency Recommendations**: Improvements to dependency management

## Code Consistency Analysis
- **Naming Conventions**: Consistency assessment (consistent/inconsistent/mixed)
- **Code Style**: Style consistency across files (consistent/inconsistent/mixed)
- **Pattern Usage**: Pattern consistency across the codebase
- **Consistency Improvements**: Recommendations for better consistency

## System-Wide Recommendations
- **Architectural Improvements**: High-level architectural enhancements needed for better system design
- **Refactoring Opportunities**: Major refactoring opportunities across files to improve maintainability
- **Development Standards**: Coding standards and best practices that should be adopted project-wide
- **Tooling Recommendations**: Development tools and automation that would benefit the project
- **Quality Improvements**: Long-term quality enhancement strategies for sustainable development

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
      'analyze_single_file', 
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
    
    // Aggregate results for cross-file analysis
    const aggregatedResult = {
      summary: `Multi-file code analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      architecture: this.analyzeArchitecture(fileAnalysisResults),
      dependencies: this.analyzeDependencies(fileAnalysisResults),
      patterns: this.identifyPatterns(fileAnalysisResults),
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        languages: this.getLanguageDistribution(fileAnalysisResults),
        complexity: this.calculateProjectComplexity(fileAnalysisResults)
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
    const content = await readFile(file, 'utf-8');
    const stats = await stat(file);
    
    return {
      filePath: file,
      fileName: basename(file),
      size: content.length,
      lines: content.split('\n').length,
      extension: extname(file),
      relativePath: relative(params.projectPath || '', file),
      // Basic code analysis
      functions: this.extractFunctions(content),
      imports: this.extractImports(content),
      exports: this.extractExports(content),
      complexity: this.estimateComplexity(content),
      modified: stats.mtime
    };
  }

  // Enhanced analysis helper methods
  private analyzeArchitecture(results: any[]): any {
    return {
      fileTypes: this.groupByType(results),
      modularity: this.assessModularity(results),
      layering: this.identifyLayers(results)
    };
  }

  private analyzeDependencies(results: any[]): any {
    return {
      internal: this.findInternalDependencies(results),
      external: this.findExternalDependencies(results),
      circular: this.detectCircularDependencies(results)
    };
  }

  private identifyPatterns(results: any[]): string[] {
    // Simple pattern identification
    const patterns = [];
    if (results.some(r => r.fileName.includes('Controller'))) patterns.push('MVC Pattern');
    if (results.some(r => r.fileName.includes('Service'))) patterns.push('Service Layer');
    if (results.some(r => r.fileName.includes('Factory'))) patterns.push('Factory Pattern');
    return patterns;
  }

  private getLanguageDistribution(results: any[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    results.forEach(result => {
      const ext = result.extension || 'unknown';
      distribution[ext] = (distribution[ext] || 0) + 1;
    });
    return distribution;
  }

  private calculateProjectComplexity(results: any[]): string {
    const avgComplexity = results.reduce((sum, r) => sum + (r.complexity || 0), 0) / results.length;
    if (avgComplexity > 10) return 'high';
    if (avgComplexity > 5) return 'medium';
    return 'low';
  }

  // Simple code extraction methods
  private extractFunctions(content: string): string[] {
    const functionPattern = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|const\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*\(/g;
    const functions = [];
    let match;
    while ((match = functionPattern.exec(content)) !== null) {
      functions.push(match[1] || match[2]);
    }
    return functions;
  }

  private extractImports(content: string): string[] {
    const importPattern = /import.*?from\s+['"]([^'"]+)['"]/g;
    const imports = [];
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  private extractExports(content: string): string[] {
    const exportPattern = /export\s+(?:default\s+)?(?:class|function|const|let|var)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    const exports = [];
    let match;
    while ((match = exportPattern.exec(content)) !== null) {
      exports.push(match[1]);
    }
    return exports;
  }

  private estimateComplexity(content: string): number {
    // Simple complexity estimation based on control flow keywords
    const complexityKeywords = /\b(if|else|for|while|switch|case|catch|&&|\|\|)\b/g;
    const matches = content.match(complexityKeywords) || [];
    return matches.length;
  }

  // Placeholder methods for more advanced analysis
  private groupByType(results: any[]): Record<string, number> {
    return results.reduce((acc, r) => {
      const ext = r.extension || 'unknown';
      acc[ext] = (acc[ext] || 0) + 1;
      return acc;
    }, {});
  }

  private assessModularity(results: any[]): string {
    // Simple modularity assessment
    const avgFunctions = results.reduce((sum, r) => sum + (r.functions?.length || 0), 0) / results.length;
    return avgFunctions > 10 ? 'low' : avgFunctions > 5 ? 'medium' : 'high';
  }

  private identifyLayers(results: any[]): string[] {
    const layers = [];
    if (results.some(r => r.relativePath.includes('controller'))) layers.push('Controller Layer');
    if (results.some(r => r.relativePath.includes('service'))) layers.push('Service Layer');
    if (results.some(r => r.relativePath.includes('model'))) layers.push('Data Layer');
    return layers;
  }

  private findInternalDependencies(results: any[]): string[] {
    return results.flatMap(r => r.imports?.filter((imp: string) => imp.startsWith('.')) || []);
  }

  private findExternalDependencies(results: any[]): string[] {
    return results.flatMap(r => r.imports?.filter((imp: string) => !imp.startsWith('.')) || []);
  }

  private detectCircularDependencies(results: any[]): string[] {
    // Simplified circular dependency detection
    return []; // Placeholder for more complex analysis
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'structure': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.java', '.cs', '.rb', '.html', '.css', '.scss', '.sass', '.less'],
      'quality': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.java', '.cs', '.rb', '.html', '.css', '.scss', '.sass', '.less', '.json', '.yml', '.yaml'],
      'security': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.java', '.cs', '.html'],
      'performance': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.java', '.html', '.css', '.scss', '.sass'],
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.java', '.cs', '.rb', '.go', '.cpp', '.c', '.h', '.html', '.css', '.scss', '.sass', '.less', '.json', '.yml', '.yaml', '.md', '.txt', '.xml']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  /**
   * Project-specific analysis instructions
   */
  private getProjectSpecificInstructions(projectType: string): string {
    const instructions: Record<string, string> = {
      'wordpress-plugin': `
**WORDPRESS PLUGIN EXPERTISE:**
- Hook system: action/filter usage, priority settings, timing
- Database operations: $wpdb practices, custom tables, option API
- Admin interfaces: menu structure, settings API, meta boxes
- Security: nonces, capability checks, data sanitization, SQL injection prevention
- Multisite compatibility and network admin considerations
- Internationalization: text domains, translation functions
- Plugin architecture: activation/deactivation hooks, uninstall procedures`,

      'wordpress-theme': `
**WORDPRESS THEME EXPERTISE:**
- Template hierarchy and conditional tags
- Custom post types, taxonomies, and meta fields
- Customizer API and theme supports
- Widget areas, navigation menus, and custom widgets
- Asset enqueueing and dependency management
- Child theme compatibility and parent theme integration
- Performance: lazy loading, critical CSS, image optimization`,

      'react-app': `
**REACT APPLICATION EXPERTISE:**
- Component architecture: composition vs inheritance
- State management: Context, Redux, Zustand patterns
- Performance optimization: React.memo, useMemo, useCallback
- Side effects: useEffect best practices, cleanup functions
- Routing: React Router patterns, code splitting
- Testing: component testing, integration testing strategies
- Build optimization: bundle splitting, tree shaking`,

      'react-component': `
**REACT COMPONENT EXPERTISE:**
- Props design: interface clarity, default values, validation
- Hook patterns: custom hooks, dependency arrays
- Render performance: preventing unnecessary re-renders
- Accessibility: ARIA attributes, keyboard navigation, screen readers
- Styling approaches: CSS modules, styled-components, Tailwind
- Component patterns: controlled vs uncontrolled, compound components
- Testing: unit tests, snapshot tests, user interaction tests`,

      'n8n-node': `
**N8N NODE EXPERTISE:**
- Node structure: properties, credentials, resource locators
- Execute method: input processing, output formatting
- Error handling: user-friendly messages, retry strategies
- API integration: authentication, rate limiting, pagination
- Resource optimization: memory usage, execution time
- Testing: node testing framework, mock data patterns`,

      'node-api': `
**NODE.JS API EXPERTISE:**
- Express patterns: middleware design, route organization
- Authentication: JWT, sessions, OAuth implementations
- Database patterns: connection pooling, query optimization
- Error handling: async/await patterns, global error handlers
- Security: helmet, rate limiting, input validation
- Performance: caching strategies, response compression
- API design: RESTful principles, versioning, documentation`,

      'html-component': `
**HTML COMPONENT EXPERTISE:**
- Semantic HTML: proper element usage, document outline
- Accessibility: WCAG guidelines, ARIA attributes, keyboard navigation
- Progressive enhancement: baseline functionality, JavaScript enhancement
- CSS architecture: BEM methodology, component isolation
- Performance: critical path optimization, resource hints
- Browser compatibility: graceful degradation, polyfills
- Web standards: HTML5 validation, microdata, structured data`,

      'generic': `
**GENERAL CODE EXPERTISE:**
Focus on universal software engineering principles: SOLID principles, design patterns, code organization, error handling, testing strategies, performance optimization, and maintainability practices applicable across languages and frameworks.`
    };

    return instructions[projectType] || instructions.generic;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default CodeStructureAnalyzer;
