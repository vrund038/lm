/**
 * Dependency Analysis Plugin - Modern v4.3
 * 
 * Universal template that intelligently handles both single-file and multi-file analysis
 * Automatically detects analysis type based on provided parameters
 * 
 * Analyzes code dependencies, circular references, unused imports, version conflicts
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

export class DependencyAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_dependencies';
  category = 'analyze' as const;
  description = 'Analyze code dependencies, circular references, unused imports, version conflicts, and coupling issues across files and projects';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'The code to analyze for dependencies (single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single file to analyze for dependencies',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Path to project root for comprehensive dependency analysis',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific file paths for dependency analysis',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for dependency discovery (1-5)',
      required: false,
      default: 4
    },
    
    // Universal parameters
    language: {
      type: 'string' as const,
      description: 'Programming language for language-specific dependency patterns',
      required: false,
      default: 'javascript'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of dependency analysis detail',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of dependency analysis to perform',
      enum: ['imports', 'circular', 'unused', 'coupling', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    
    // Dependency-specific parameters
    includePackageJson: {
      type: 'boolean' as const,
      description: 'Include package.json analysis for version conflicts',
      required: false,
      default: true
    },
    checkDevDependencies: {
      type: 'boolean' as const,
      description: 'Include devDependencies in analysis',
      required: false,
      default: false
    },
    ignorePatterns: {
      type: 'array' as const,
      description: 'Patterns to ignore (e.g., ["node_modules", "*.test.js"])',
      required: false,
      items: { type: 'string' as const },
      default: ['node_modules', '*.min.js', '*.bundle.js']
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
        return ErrorHandler.createExecutionError('analyze_dependencies', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   * Dependencies are typically analyzed at project level, so default to multi-file
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file indicators take priority for specific file dependency analysis
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default to multi-file for dependency analysis (most common use case)
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
    ParameterValidator.validateEnum(params, 'analysisType', ['imports', 'circular', 'unused', 'coupling', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
  }

  /**
   * Execute single-file dependency analysis
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
        'analyze_dependencies',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'analyze_dependencies'
      );
    }
  }

  /**
   * Execute multi-file dependency analysis
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
      'analyze_dependencies',
      'multifile'
    );
  }

  /**
   * Single-file dependency analysis prompt stages
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, filePath } = params;
    
    const systemAndContext = `You are a world-class software architect and dependency expert specializing in ${analysisDepth} dependency analysis for ${language} projects.

**ANALYSIS CONTEXT:**
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- File: ${filePath ? basename(filePath) : 'inline code'}
- Mode: Single File Dependency Analysis

**YOUR EXPERTISE:**
You have 20+ years of experience in software architecture, dependency management, and code organization. You excel at:

**DEPENDENCY PATTERN RECOGNITION:**
- Import/export patterns and their implications
- Module coupling and cohesion analysis
- Dead code and unused import detection
- Dependency injection patterns
- Interface segregation and dependency inversion

**LANGUAGE-SPECIFIC EXPERTISE:**
- **JavaScript/TypeScript**: ES6 modules, CommonJS, dynamic imports, barrel exports
- **Python**: import statements, __init__.py patterns, circular import issues
- **PHP**: namespace usage, autoloading, composer dependencies
- **Java**: package structure, import optimization, circular dependencies
- **C#**: using statements, namespace organization, assembly references

**ANALYSIS APPROACH:**
1. **Import Analysis**: Examine all import/require/include statements
2. **Usage Tracking**: Identify which imports are actually used
3. **Coupling Assessment**: Evaluate how tightly coupled dependencies are
4. **Pattern Recognition**: Identify dependency injection, factory patterns
5. **Optimization Opportunities**: Spot ways to reduce dependencies

Your goal is to provide actionable insights that improve code maintainability, reduce coupling, and eliminate dead dependencies.`;

    const dataPayload = `**CODE TO ANALYZE FOR DEPENDENCIES:**

\`\`\`${language}
${code}
\`\`\`

${filePath ? `\n**File Context:** ${filePath}` : ''}`;

    const outputInstructions = `**PROVIDE YOUR DEPENDENCY ANALYSIS AS STRUCTURED JSON:**

{
  "summary": "2-3 sentence overview of the file's dependency patterns and main concerns",
  
  "imports": {
    "total": 12,
    "used": 8,
    "unused": ["unusedModule1", "unusedModule2"],
    "external": ["lodash", "react", "express"],
    "internal": ["./utils", "../components/Header"],
    "dynamic": ["import('./lazy-component')"],
    "patterns": ["barrel imports", "namespace imports", "default imports"]
  },
  
  "exports": {
    "total": 5,
    "types": ["default export", "named exports"],
    "unused": ["unusedExport1"],
    "patterns": ["re-exports", "barrel exports"]
  },
  
  "coupling": {
    "level": "high|medium|low",
    "afferentCoupling": 3,
    "efferentCoupling": 8,
    "instability": 0.73,
    "concerns": ["tightly coupled to UI framework", "depends on many utilities"]
  },
  
  "dependencies": {
    "direct": ["dependency1", "dependency2"],
    "transitive": ["indirect dependency via dependency1"],
    "circular": [],
    "redundant": ["could be replaced by existing dependency"],
    "heavy": ["large library used for small feature"]
  },
  
  "issues": [
    {
      "type": "unused_import|circular_dependency|tight_coupling|redundant_dependency",
      "severity": "high|medium|low",
      "description": "Detailed issue description",
      "line": 42,
      "import": "import statement causing issue",
      "impact": "How this affects maintainability/performance",
      "solution": "Specific action to resolve"
    }
  ],
  
  "recommendations": {
    "immediate": [
      "Remove unused imports: lodash, moment",
      "Extract interface to reduce coupling"
    ],
    "refactoring": [
      "Consider dependency injection for database access",
      "Replace heavy library with lighter alternative"
    ],
    "architecture": [
      "Implement adapter pattern for external dependencies",
      "Create abstraction layer for data access"
    ]
  },
  
  "metrics": {
    "dependencyCount": 15,
    "unusedImports": 4,
    "couplingScore": "medium",
    "maintainabilityImpact": "high|medium|low"
  },
  
  "optimizations": [
    {
      "type": "remove_unused|lazy_load|replace_heavy|extract_interface",
      "description": "Optimization description",
      "impact": "Expected improvement",
      "effort": "high|medium|low",
      "before": "// Current problematic code",
      "after": "// Optimized version"
    }
  ],
  
  "confidence": 0.92
}

**CRITICAL REQUIREMENTS:**
- Identify ALL imports and their actual usage
- Spot circular dependencies and coupling issues
- Provide specific line numbers where possible
- Include concrete before/after examples for optimizations
- Focus on maintainability and performance impact
- Consider language-specific dependency patterns`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file dependency analysis prompt stages
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, projectPath } = params;
    
    const systemAndContext = `You are a senior software architect specializing in ${analysisDepth} multi-file dependency analysis and system architecture.

**PROJECT DEPENDENCY ANALYSIS CONTEXT:**
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Project: ${projectPath ? basename(projectPath) : 'multi-file analysis'}
- Mode: Comprehensive Project Dependency Analysis

**YOUR EXPERTISE:**
You excel at identifying system-wide dependency patterns, architectural issues, and cross-module coupling problems. You understand:

**ARCHITECTURAL PATTERNS:**
- Layered architecture and dependency direction
- Dependency inversion and interface segregation
- Module federation and micro-frontend patterns
- Service-oriented architecture dependencies

**CROSS-FILE ANALYSIS:**
- Circular dependency chains across multiple files
- Coupling between modules and layers
- Shared dependency usage patterns  
- Architecture violation detection
- Dead code elimination opportunities

**SYSTEM-WIDE OPTIMIZATION:**
- Dependency consolidation opportunities
- Bundle size optimization strategies
- Lazy loading and code splitting recommendations
- Refactoring for better separation of concerns

Your goal is to provide a comprehensive architectural assessment with actionable recommendations for dependency optimization across the entire codebase.`;

    const dataPayload = `**PROJECT-WIDE DEPENDENCY ANALYSIS RESULTS:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**PROVIDE YOUR PROJECT-WIDE DEPENDENCY ANALYSIS:**

{
  "summary": "Overall dependency health and key architectural findings across the project",
  
  "systemOverview": {
    "totalFiles": ${fileCount},
    "totalDependencies": 0,
    "externalDependencies": 0,
    "internalDependencies": 0,
    "dependencyDepth": "shallow|moderate|deep",
    "architecturePattern": "layered|microservices|modular|monolithic",
    "healthScore": "excellent|good|fair|poor"
  },
  
  "circularDependencies": [
    {
      "cycle": ["FileA.js", "FileB.js", "FileC.js", "FileA.js"],
      "severity": "critical|high|medium|low",
      "impact": "Description of what breaks due to this circular dependency",
      "solution": "Specific steps to break the cycle",
      "affectedFeatures": ["feature1", "feature2"]
    }
  ],
  
  "couplingAnalysis": {
    "highCoupling": [
      {
        "files": ["tightly-coupled-file1.js", "tightly-coupled-file2.js"],
        "couplingType": "data|control|content|common|external",
        "severity": "high|medium|low",
        "recommendation": "How to reduce coupling between these files"
      }
    ],
    "lowCohesion": [
      {
        "file": "scattered-responsibilities.js", 
        "issues": ["mixed concerns", "multiple reasons to change"],
        "refactoring": "Split into focused modules"
      }
    ]
  },
  
  "unusedDependencies": {
    "packages": ["unused-package-1", "unused-package-2"],
    "internalModules": ["unused-util.js", "legacy-helper.js"],
    "potentialSavings": "Bundle size reduction estimate",
    "cleanupPlan": ["Step 1", "Step 2", "Step 3"]
  },
  
  "dependencyConflicts": [
    {
      "type": "version_mismatch|duplicate_functionality|incompatible_licenses",
      "description": "Conflict description",
      "affectedPackages": ["package-a@1.0", "package-b@2.0"],
      "resolution": "How to resolve the conflict",
      "priority": "high|medium|low"
    }
  ],
  
  "architecturalViolations": [
    {
      "violation": "Data layer accessing presentation layer",
      "files": ["data/user-service.js", "ui/user-component.js"],
      "principle": "Dependency Inversion Principle",
      "fix": "Introduce interface/abstraction layer"
    }
  ],
  
  "optimizationOpportunities": {
    "bundleOptimization": [
      "Code split large dependencies",
      "Use dynamic imports for conditional features",
      "Implement tree shaking for unused exports"
    ],
    "performanceImprovements": [
      "Lazy load non-critical dependencies",
      "Replace heavy libraries with lighter alternatives",
      "Implement dependency injection for better testability"
    ],
    "maintenanceImprovements": [
      "Extract shared interfaces",
      "Create adapter layers for external dependencies", 
      "Implement facade pattern for complex subsystems"
    ]
  },
  
  "migrationPlan": {
    "phase1": {
      "title": "Quick Wins (1-2 weeks)",
      "tasks": ["Remove unused imports", "Fix simple circular dependencies"],
      "impact": "Immediate bundle size reduction"
    },
    "phase2": {
      "title": "Structural Improvements (1 month)",
      "tasks": ["Extract interfaces", "Implement dependency injection"],
      "impact": "Better testability and maintainability"
    },
    "phase3": {
      "title": "Architectural Refactoring (2-3 months)",
      "tasks": ["Redesign tightly coupled modules", "Implement clean architecture"],
      "impact": "Long-term maintainability and scalability"
    }
  },
  
  "riskAssessment": {
    "criticalIssues": 2,
    "refactoringRisk": "high|medium|low",
    "testingRequirements": ["Unit tests for refactored modules", "Integration tests for dependency changes"],
    "rollbackPlan": "Steps to safely revert changes if issues arise"
  }
}`;

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
      'analyze_dependencies', 
      params, 
      files
    );
    
    const cached = await this.analysisCache.get(cacheKey);
    if (cached) return cached;
    
    // Include package.json analysis if requested
    const packageJsonData = await this.analyzePackageJson(params.projectPath, params.includePackageJson);
    
    const fileAnalysisResults = await this.multiFileAnalysis.analyzeBatch(
      files,
      (file: string) => this.analyzeIndividualFile(file, params, model),
      contextLength
    );
    
    // Enhanced dependency analysis aggregation
    const aggregatedResult = {
      summary: `Dependency analysis of ${files.length} files`,
      packageJson: packageJsonData,
      dependencies: this.analyzeDependencyRelationships(fileAnalysisResults),
      circularDependencies: this.detectCircularDependencies(fileAnalysisResults),
      unusedDependencies: this.findUnusedDependencies(fileAnalysisResults, packageJsonData),
      couplingMetrics: this.calculateCouplingMetrics(fileAnalysisResults),
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        totalImports: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.imports?.length || 0), 0),
        totalExports: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.exports?.length || 0), 0),
        dependencyComplexity: this.calculateDependencyComplexity(fileAnalysisResults)
      }
    };
    
    const startTime = performance.now();
    const executionTime = performance.now() - startTime;
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Math.round(executionTime),
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
      // Dependency-specific analysis
      imports: this.extractImports(content, extname(file)),
      exports: this.extractExports(content, extname(file)),
      requires: this.extractRequires(content),
      dynamicImports: this.extractDynamicImports(content),
      dependencies: this.identifyDependencies(content),
      modified: stats.mtime
    };
  }

  // Enhanced dependency analysis methods
  private async analyzePackageJson(projectPath: string, includeAnalysis: boolean): Promise<any> {
    if (!includeAnalysis || !projectPath) return null;
    
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageContent = await readFile(packageJsonPath, 'utf-8');
      const packageData = JSON.parse(packageContent);
      
      return {
        dependencies: packageData.dependencies || {},
        devDependencies: packageData.devDependencies || {},
        peerDependencies: packageData.peerDependencies || {},
        total: Object.keys(packageData.dependencies || {}).length + 
               Object.keys(packageData.devDependencies || {}).length,
        outdated: [], // Placeholder for version analysis
        vulnerabilities: [] // Placeholder for security analysis
      };
    } catch (error) {
      return { error: 'Package.json not found or invalid' };
    }
  }

  private analyzeDependencyRelationships(results: any[]): any {
    const relationships = new Map();
    
    results.forEach(file => {
      const filePath = file.relativePath;
      const imports = file.imports || [];
      
      relationships.set(filePath, {
        imports: imports.filter(imp => imp.startsWith('.')), // Internal dependencies
        external: imports.filter(imp => !imp.startsWith('.')), // External dependencies
        exports: file.exports || []
      });
    });
    
    return Object.fromEntries(relationships);
  }

  private detectCircularDependencies(results: any[]): any[] {
    // Simplified circular dependency detection
    const dependencies = new Map();
    const circular = [];
    
    results.forEach(file => {
      const internalImports = (file.imports || []).filter(imp => imp.startsWith('.'));
      dependencies.set(file.relativePath, internalImports);
    });
    
    // TODO: Implement proper cycle detection algorithm
    return circular;
  }

  private findUnusedDependencies(results: any[], packageData: any): any {
    if (!packageData) return { packages: [], internal: [] };
    
    const usedPackages = new Set();
    results.forEach(file => {
      (file.imports || []).forEach(imp => {
        if (!imp.startsWith('.')) {
          // Extract package name (handle scoped packages)
          const packageName = imp.startsWith('@') ? 
            imp.split('/').slice(0, 2).join('/') : 
            imp.split('/')[0];
          usedPackages.add(packageName);
        }
      });
    });
    
    const allPackages = Object.keys(packageData.dependencies || {});
    const unused = allPackages.filter(pkg => !usedPackages.has(pkg));
    
    return {
      packages: unused,
      internal: [], // Placeholder for unused internal modules
      potentialSavings: `${unused.length} packages`
    };
  }

  private calculateCouplingMetrics(results: any[]): any {
    const totalFiles = results.length;
    const totalImports = results.reduce((sum, r) => sum + (r.imports?.length || 0), 0);
    
    return {
      averageImportsPerFile: totalImports / totalFiles,
      couplingLevel: totalImports / totalFiles > 10 ? 'high' : 
                   totalImports / totalFiles > 5 ? 'medium' : 'low',
      mostCoupled: results
        .sort((a, b) => (b.imports?.length || 0) - (a.imports?.length || 0))
        .slice(0, 3)
        .map(r => ({ file: r.fileName, imports: r.imports?.length || 0 }))
    };
  }

  private calculateDependencyComplexity(results: any[]): string {
    const avgDependencies = results.reduce((sum, r) => sum + (r.dependencies?.length || 0), 0) / results.length;
    if (avgDependencies > 20) return 'very high';
    if (avgDependencies > 15) return 'high';
    if (avgDependencies > 10) return 'medium';
    return 'low';
  }

  // Language-specific import/export extraction
  private extractImports(content: string, extension: string): string[] {
    const imports = [];
    
    // JavaScript/TypeScript ES6 imports
    if (['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(extension)) {
      const importPattern = /import.*?from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = importPattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }
    
    // Python imports
    if (extension === '.py') {
      const importPattern = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
      let match;
      while ((match = importPattern.exec(content)) !== null) {
        imports.push(match[1] || match[2]);
      }
    }
    
    // PHP includes/requires
    if (extension === '.php') {
      const includePattern = /(?:include|require)(?:_once)?\s*\(?['"]([^'"]+)['"]/g;
      let match;
      while ((match = includePattern.exec(content)) !== null) {
        imports.push(match[1]);
      }
    }
    
    return imports;
  }

  private extractExports(content: string, extension: string): string[] {
    const exports = [];
    
    // JavaScript/TypeScript exports
    if (['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(extension)) {
      // Named exports
      const namedExportPattern = /export\s+(?:const|let|var|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
      let match;
      while ((match = namedExportPattern.exec(content)) !== null) {
        exports.push(match[1]);
      }
      
      // Default exports
      if (content.includes('export default')) {
        exports.push('default');
      }
    }
    
    return exports;
  }

  private extractRequires(content: string): string[] {
    const requires = [];
    const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = requirePattern.exec(content)) !== null) {
      requires.push(match[1]);
    }
    return requires;
  }

  private extractDynamicImports(content: string): string[] {
    const dynamicImports = [];
    const dynamicPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;
    while ((match = dynamicPattern.exec(content)) !== null) {
      dynamicImports.push(match[1]);
    }
    return dynamicImports;
  }

  private identifyDependencies(content: string): string[] {
    // Combine all import types
    const allDependencies = [
      ...this.extractImports(content, '.js'), // Default to JS pattern
      ...this.extractRequires(content),
      ...this.extractDynamicImports(content)
    ];
    
    // Remove duplicates and return
    return [...new Set(allDependencies)];
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'imports': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.rb', '.java', '.cs'],
      'circular': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php'],
      'unused': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.rb', '.java'],
      'coupling': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.rb', '.java', '.cs'],
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.rb', '.java', '.cs', '.go', '.rs']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default DependencyAnalyzer;
