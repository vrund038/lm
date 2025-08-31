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

export class DatabaseQueryAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_database_queries';
  category = 'analyze' as const;
  description = 'Analyze database queries for performance, security, and best practices in code files or entire projects';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'The code to analyze for database queries (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single file to analyze for database queries',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Path to project root (for multi-file database analysis)',
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
      default: 'php'
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
      description: 'Type of database analysis to perform',
      enum: ['security', 'performance', 'best-practices', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    
    // Database-specific parameters
    context: {
      type: 'object' as const,
      description: 'Database and framework context for specialized analysis',
      required: false,
      properties: {
        database: {
          type: 'string' as const,
          enum: ['mysql', 'postgresql', 'sqlite', 'mongodb', 'generic'],
          description: 'Database engine for engine-specific optimizations'
        },
        framework: {
          type: 'string' as const,
          enum: ['wordpress', 'laravel', 'symfony', 'django', 'rails', 'express', 'generic'],
          description: 'Framework for framework-specific query patterns'
        },
        orm: {
          type: 'string' as const,
          enum: ['eloquent', 'doctrine', 'sequelize', 'mongoose', 'activerecord', 'none'],
          description: 'ORM/Query builder being used'
        },
        environment: {
          type: 'string' as const,
          enum: ['development', 'staging', 'production'],
          description: 'Environment context for performance recommendations'
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
        return ErrorHandler.createExecutionError('analyze_database_queries', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
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
    
    // Default to single-file for focused query analysis
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
    ParameterValidator.validateEnum(params, 'analysisType', ['security', 'performance', 'best-practices', 'comprehensive']);
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
    
    // Extract database queries from the code
    const extractedQueries = this.extractDatabaseQueries(codeToAnalyze, params.language, params.context);
    
    // Generate prompt stages for single file
    const promptStages = this.getSingleFilePromptStages({
      ...params,
      code: codeToAnalyze,
      extractedQueries
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
        'analyze_database_queries',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'analyze_database_queries'
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
      'analyze_database_queries',
      'multifile'
    );
  }

  /**
   * Database Query Analysis - Single File Expert Analysis
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, extractedQueries, filePath, context = {} } = params;
    const database = context.database || 'generic';
    const framework = context.framework || 'generic';
    const orm = context.orm || 'none';
    const environment = context.environment || 'production';
    
    const systemAndContext = `You are a world-class database performance expert and security specialist with 20+ years of experience optimizing database queries across all major platforms.

**DATABASE ANALYSIS CONTEXT:**
- Database Engine: ${database}
- Framework: ${framework}
- ORM/Query Builder: ${orm}
- Programming Language: ${language}
- Environment: ${environment}
- Analysis Focus: ${analysisType}
- Analysis Depth: ${analysisDepth}
- File: ${filePath ? basename(filePath) : 'inline code'}

**YOUR EXPERTISE:**
You are recognized as a leading expert in:
- SQL query optimization and execution plan analysis
- Database security and injection prevention
- Framework-specific query patterns (WordPress $wpdb, Laravel Eloquent, etc.)
- Performance bottleneck identification and resolution
- Index strategy and database schema optimization
- N+1 query problem detection and solutions
- Query caching strategies and implementation
- Database-specific optimization techniques for ${database}

${this.getDatabaseSpecificInstructions(database, framework, orm)}

**ANALYSIS APPROACH:**
1. **Query Detection**: Identify all database queries in the code
2. **Security Assessment**: Evaluate for SQL injection vulnerabilities
3. **Performance Analysis**: Identify bottlenecks, N+1 problems, and optimization opportunities
4. **Best Practices Review**: Check against framework and database best practices
5. **Actionable Recommendations**: Provide specific, implementable improvements with examples

You provide expert-level analysis that helps developers write secure, performant database code.`;

    const dataPayload = `**CODE WITH DATABASE QUERIES:**

\`\`\`${language}
${code}
\`\`\`

**EXTRACTED DATABASE QUERIES:**
${extractedQueries.length > 0 ? 
  extractedQueries.map((query, index) => 
    `**Query ${index + 1}** (Line ${query.line}):\n\`\`\`sql\n${query.query}\n\`\`\`\nContext: ${query.context}\n`
  ).join('\n') : 
  'No explicit database queries detected. Analyzing for potential query patterns and ORM usage.'
}

${filePath ? `\n**File Path:** ${filePath}` : ''}`;

    const outputInstructions = `**PROVIDE COMPREHENSIVE DATABASE QUERY ANALYSIS AS JSON:**

{
  "summary": "2-3 sentence overview of database usage, query patterns, and main security/performance concerns",
  
  "queryAnalysis": {
    "totalQueries": ${extractedQueries.length},
    "queryTypes": ["SELECT", "INSERT", "UPDATE", "DELETE"],
    "complexQueries": ["complex query 1", "complex query 2"],
    "dynamicQueries": ["dynamic query 1", "dynamic query 2"]
  },
  
  "securityFindings": [
    {
      "type": "sql_injection|prepared_statements|input_validation",
      "severity": "critical|high|medium|low",
      "query": "vulnerable query snippet",
      "line": 42,
      "vulnerability": "Detailed description of security issue",
      "exploit": "How this could be exploited",
      "fix": "Specific fix with code example",
      "example": "Secure code implementation"
    }
  ],
  
  "performanceFindings": [
    {
      "type": "n_plus_one|missing_index|inefficient_query|excessive_joins",
      "severity": "critical|high|medium|low", 
      "query": "problematic query",
      "line": 55,
      "issue": "Detailed performance issue description",
      "impact": "Performance impact (queries/second, memory usage)",
      "optimization": "Specific optimization strategy",
      "optimizedQuery": "Improved query example"
    }
  ],
  
  "bestPracticeViolations": [
    {
      "practice": "Best practice being violated",
      "line": 78,
      "current": "Current implementation",
      "recommended": "Recommended implementation",
      "benefit": "Why this improvement matters"
    }
  ],
  
  "recommendations": {
    "immediate": [
      "Critical security fix 1",
      "Critical performance fix 1"
    ],
    "shortTerm": [
      "Performance optimization 1",
      "Code quality improvement 1"
    ],
    "longTerm": [
      "Architectural improvement 1",
      "Scalability enhancement 1"
    ]
  },
  
  "codeExamples": {
    "before": "// Current problematic database code",
    "after": "// Optimized and secure version",
    "explanation": "Why this improvement enhances security and performance"
  },
  
  "indexRecommendations": [
    {
      "table": "table_name",
      "columns": ["column1", "column2"],
      "type": "btree|hash|partial",
      "reasoning": "Why this index improves performance"
    }
  ],
  
  "metrics": {
    "estimatedQueriesPerRequest": 5,
    "potentialBottlenecks": 2,
    "securityRiskLevel": "high|medium|low",
    "optimizationPotential": "high|medium|low"
  },
  
  "confidence": 0.92
}

**CRITICAL REQUIREMENTS:**
- Focus on real, exploitable security vulnerabilities
- Provide specific query optimizations with measurable impact
- Include framework-specific best practices for ${framework}
- Consider ${database}-specific optimization techniques
- Prioritize fixes by impact and implementation difficulty`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file database analysis for project-wide query patterns
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, context = {} } = params;
    const database = context.database || 'generic';
    const framework = context.framework || 'generic';
    
    const systemAndContext = `You are a senior database architect specializing in ${analysisDepth} multi-file database analysis and optimization.

**PROJECT DATABASE ANALYSIS CONTEXT:**
- Database Engine: ${database}
- Framework: ${framework}
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Mode: Multi-File Database Architecture Analysis

**YOUR EXPERTISE:**
You excel at identifying cross-file database patterns, architectural issues, and system-wide database optimization opportunities. You understand how queries interact across modules, transaction boundaries, and data consistency patterns.

**FOCUS AREAS:**
- Cross-file query patterns and duplication
- Database transaction boundaries and consistency
- Query performance across the application
- Security patterns and vulnerabilities at scale
- Database schema utilization and optimization opportunities`;

    const dataPayload = `**PROJECT DATABASE ANALYSIS RESULTS:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**PROVIDE PROJECT-WIDE DATABASE ANALYSIS:**

{
  "summary": "Overall database usage patterns and key architectural findings across the project",
  
  "architecture": {
    "queryPatterns": ["pattern 1", "pattern 2"],
    "dataAccessLayers": ["layer 1", "layer 2"],
    "transactionBoundaries": ["boundary pattern 1", "boundary pattern 2"],
    "consistencyApproach": "eventual|strong|mixed"
  },
  
  "crossFileFindings": [
    {
      "type": "query_duplication|transaction_issues|n_plus_one_pattern|security_pattern",
      "severity": "critical|high|medium|low",
      "title": "Cross-file database issue",
      "description": "Detailed description of the system-wide issue",
      "affectedFiles": ["file1.php", "file2.php", "file3.php"],
      "impact": "Performance/security impact across the system",
      "recommendation": "System-wide fix strategy"
    }
  ],
  
  "performanceArchitecture": {
    "queryDistribution": "How queries are distributed across files",
    "bottleneckPatterns": ["bottleneck 1", "bottleneck 2"],
    "cachingStrategy": "current caching approach",
    "optimizationOpportunities": ["opportunity 1", "opportunity 2"]
  },
  
  "securityArchitecture": {
    "inputValidationPatterns": "consistent|inconsistent|missing",
    "preparedStatementUsage": "high|medium|low",
    "privilegePatterns": ["pattern 1", "pattern 2"],
    "riskAreas": ["high risk area 1", "high risk area 2"]
  },
  
  "systemWideRecommendations": {
    "architecture": ["database architecture improvement 1", "improvement 2"],
    "performance": ["system performance optimization 1", "optimization 2"],
    "security": ["security enhancement 1", "enhancement 2"],
    "maintainability": ["maintainability improvement 1", "improvement 2"]
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
      'analyze_database_queries', 
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
    
    // Aggregate database-specific results
    const aggregatedResult = {
      summary: `Multi-file database analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      database: this.analyzeDatabasePatterns(fileAnalysisResults),
      queries: this.aggregateQueryAnalysis(fileAnalysisResults),
      security: this.aggregateSecurityFindings(fileAnalysisResults),
      performance: this.aggregatePerformanceFindings(fileAnalysisResults),
      data: {
        fileCount: files.length,
        totalQueries: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.queryCount || 0), 0),
        riskLevel: this.calculateRiskLevel(fileAnalysisResults),
        frameworks: this.identifyDatabaseFrameworks(fileAnalysisResults)
      }
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now(),
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async analyzeIndividualFile(file: string, params: any, model: any): Promise<any> {
    const content = await readFile(file, 'utf-8');
    const stats = await stat(file);
    const queries = this.extractDatabaseQueries(content, params.language, params.context);
    
    return {
      filePath: file,
      fileName: basename(file),
      size: content.length,
      lines: content.split('\n').length,
      extension: extname(file),
      relativePath: relative(params.projectPath || '', file),
      // Database-specific analysis
      queryCount: queries.length,
      queries: queries,
      databaseCalls: this.countDatabaseCalls(content),
      securityRisks: this.identifySecurityRisks(queries),
      performanceIssues: this.identifyPerformanceIssues(queries),
      modified: stats.mtime
    };
  }

  /**
   * Extract database queries from code using patterns for different languages/frameworks
   */
  private extractDatabaseQueries(code: string, language: string = 'php', context: any = {}): any[] {
    const queries: any[] = [];
    const lines = code.split('\n');
    
    // WordPress $wpdb patterns
    const wpdbPatterns = [
      /\$wpdb->query\s*\(\s*['"](.*?)['"].*?\)/gi,
      /\$wpdb->get_results\s*\(\s*['"](.*?)['"].*?\)/gi,
      /\$wpdb->get_var\s*\(\s*['"](.*?)['"].*?\)/gi,
      /\$wpdb->get_row\s*\(\s*['"](.*?)['"].*?\)/gi,
      /\$wpdb->prepare\s*\(\s*['"](.*?)['"].*?\)/gi
    ];
    
    // Raw SQL patterns
    const sqlPatterns = [
      /(SELECT\s+.*?FROM\s+.*?)(?=;|\s*$|\s*\))/gis,
      /(INSERT\s+INTO\s+.*?)(?=;|\s*$|\s*\))/gis,
      /(UPDATE\s+.*?SET\s+.*?)(?=;|\s*$|\s*\))/gis,
      /(DELETE\s+FROM\s+.*?)(?=;|\s*$|\s*\))/gis
    ];
    
    // Laravel Eloquent patterns
    const eloquentPatterns = [
      /DB::select\s*\(\s*['"](.*?)['"].*?\)/gi,
      /DB::insert\s*\(\s*['"](.*?)['"].*?\)/gi,
      /DB::update\s*\(\s*['"](.*?)['"].*?\)/gi,
      /DB::delete\s*\(\s*['"](.*?)['"].*?\)/gi
    ];
    
    const patterns = [...wpdbPatterns, ...sqlPatterns, ...eloquentPatterns];
    
    lines.forEach((line, index) => {
      patterns.forEach(pattern => {
        let match;
        pattern.lastIndex = 0; // Reset regex
        while ((match = pattern.exec(line)) !== null) {
          queries.push({
            query: match[1] || match[0],
            line: index + 1,
            context: this.getQueryContext(line),
            type: this.getQueryType(match[1] || match[0]),
            framework: this.detectQueryFramework(line)
          });
        }
      });
    });
    
    return queries;
  }

  private getQueryContext(line: string): string {
    if (line.includes('$wpdb')) return 'WordPress';
    if (line.includes('DB::')) return 'Laravel';
    if (line.includes('query(') || line.includes('execute(')) return 'Direct SQL';
    return 'Unknown';
  }

  private getQueryType(query: string): string {
    if (/^SELECT/i.test(query.trim())) return 'SELECT';
    if (/^INSERT/i.test(query.trim())) return 'INSERT';
    if (/^UPDATE/i.test(query.trim())) return 'UPDATE';
    if (/^DELETE/i.test(query.trim())) return 'DELETE';
    return 'OTHER';
  }

  private detectQueryFramework(line: string): string {
    if (line.includes('$wpdb')) return 'WordPress';
    if (line.includes('DB::')) return 'Laravel';
    if (line.includes('PDO')) return 'PDO';
    return 'Generic';
  }

  private countDatabaseCalls(content: string): number {
    const dbCallPatterns = [
      /\$wpdb->/g,
      /DB::/g,
      /->query\(/g,
      /->execute\(/g,
      /mysqli_/g,
      /pg_query/g
    ];
    
    return dbCallPatterns.reduce((count, pattern) => {
      const matches = content.match(pattern) || [];
      return count + matches.length;
    }, 0);
  }

  private identifySecurityRisks(queries: any[]): string[] {
    const risks: string[] = [];
    
    queries.forEach(query => {
      // Check for potential SQL injection
      if (query.query.includes('$') && !query.query.includes('prepare')) {
        risks.push('Potential SQL injection vulnerability');
      }
      
      // Check for dynamic query construction
      if (query.query.includes('{') || query.query.includes('}')) {
        risks.push('Dynamic query construction detected');
      }
      
      // Check for missing prepared statements
      if (query.framework === 'WordPress' && !query.context.includes('prepare')) {
        risks.push('Unprepared WordPress query');
      }
    });
    
    return [...new Set(risks)]; // Remove duplicates
  }

  private identifyPerformanceIssues(queries: any[]): string[] {
    const issues: string[] = [];
    
    queries.forEach(query => {
      // Check for SELECT *
      if (query.query.includes('SELECT *')) {
        issues.push('SELECT * usage detected');
      }
      
      // Check for missing WHERE clauses in UPDATE/DELETE
      if ((query.type === 'UPDATE' || query.type === 'DELETE') && !query.query.includes('WHERE')) {
        issues.push('Missing WHERE clause in destructive operation');
      }
      
      // Check for potential N+1 queries (simple heuristic)
      if (query.context.includes('foreach') || query.context.includes('for (')) {
        issues.push('Potential N+1 query pattern');
      }
    });
    
    return [...new Set(issues)];
  }

  // Database-specific aggregation methods
  private analyzeDatabasePatterns(results: any[]): any {
    return {
      totalQueries: results.reduce((sum, r) => sum + (r.queryCount || 0), 0),
      frameworks: this.identifyDatabaseFrameworks(results),
      queryTypes: this.aggregateQueryTypes(results)
    };
  }

  private aggregateQueryAnalysis(results: any[]): any {
    const allQueries = results.flatMap(r => r.queries || []);
    return {
      total: allQueries.length,
      byType: this.groupBy(allQueries, 'type'),
      byFramework: this.groupBy(allQueries, 'framework')
    };
  }

  private aggregateSecurityFindings(results: any[]): any {
    const allRisks = results.flatMap(r => r.securityRisks || []);
    return {
      totalRisks: allRisks.length,
      riskTypes: this.countOccurrences(allRisks)
    };
  }

  private aggregatePerformanceFindings(results: any[]): any {
    const allIssues = results.flatMap(r => r.performanceIssues || []);
    return {
      totalIssues: allIssues.length,
      issueTypes: this.countOccurrences(allIssues)
    };
  }

  private calculateRiskLevel(results: any[]): string {
    const totalRisks = results.reduce((sum, r) => sum + (r.securityRisks?.length || 0), 0);
    if (totalRisks > 10) return 'high';
    if (totalRisks > 5) return 'medium';
    return 'low';
  }

  private identifyDatabaseFrameworks(results: any[]): string[] {
    const frameworks = new Set<string>();
    results.forEach(result => {
      if (result.queries) {
        result.queries.forEach((query: any) => {
          frameworks.add(query.framework);
        });
      }
    });
    return Array.from(frameworks);
  }

  private aggregateQueryTypes(results: any[]): Record<string, number> {
    const types: Record<string, number> = {};
    results.forEach(result => {
      if (result.queries) {
        result.queries.forEach((query: any) => {
          types[query.type] = (types[query.type] || 0) + 1;
        });
      }
    });
    return types;
  }

  private groupBy(array: any[], key: string): Record<string, number> {
    return array.reduce((groups, item) => {
      const group = item[key] || 'unknown';
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }

  private countOccurrences(array: string[]): Record<string, number> {
    return array.reduce((counts, item) => {
      counts[item] = (counts[item] || 0) + 1;
      return counts;
    }, {});
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'security': ['.php', '.js', '.ts', '.py', '.rb', '.java', '.cs', '.sql'],
      'performance': ['.php', '.js', '.ts', '.py', '.rb', '.java', '.cs', '.sql'],
      'best-practices': ['.php', '.js', '.ts', '.py', '.rb', '.java', '.cs', '.sql'],
      'comprehensive': ['.php', '.js', '.ts', '.py', '.rb', '.java', '.cs', '.sql', '.jsp', '.asp', '.aspx']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  /**
   * Database and framework-specific expert instructions
   */
  private getDatabaseSpecificInstructions(database: string, framework: string, orm: string): string {
    const instructions: Record<string, string> = {
      'wordpress': `
**WORDPRESS DATABASE EXPERTISE:**
- $wpdb best practices: Always use $wpdb->prepare() for dynamic queries
- WordPress query functions: get_results(), get_var(), get_row(), get_col()
- Custom table naming: Use $wpdb->prefix for table prefixes
- Caching integration: wp_cache_* functions for query result caching
- Security: Validate and sanitize all input, use wpdb::esc_like() for LIKE queries
- Performance: Avoid queries in loops, use WP_Query efficiently, leverage object caching
- Schema: Follow WordPress database schema conventions, use dbDelta() for table creation`,

      'laravel': `
**LARAVEL DATABASE EXPERTISE:**
- Eloquent ORM: Use relationships to avoid N+1 queries, eager loading with with()
- Query Builder: DB::table() with proper parameter binding
- Raw queries: Always use DB::select() with parameter binding, never string concatenation
- Migrations: Use Schema builder for database changes, maintain rollback capability
- Performance: Query scopes, database indexes, query caching with Redis/Memcached
- Security: Always use parameter binding, validate inputs with Form Requests
- Transactions: Use DB::transaction() for data consistency`,

      'django': `
**DJANGO DATABASE EXPERTISE:**
- ORM QuerySets: Use select_related() and prefetch_related() to minimize queries
- Raw SQL: Always use parameterized queries, never string formatting
- Migrations: Use Django migrations for schema changes
- Performance: Database indexes, QuerySet optimization, database connection pooling
- Security: Django ORM provides SQL injection protection by default
- Caching: Use Django's cache framework for query result caching`,

      'generic': `
**GENERAL DATABASE EXPERTISE:**
- Always use prepared statements or parameterized queries
- Validate and sanitize all user inputs before database operations
- Use appropriate indexes for query performance
- Avoid SELECT * and fetch only required columns
- Implement proper error handling and logging
- Use transactions for data consistency
- Consider connection pooling for high-traffic applications`
    };

    return instructions[framework] || instructions[database] || instructions.generic;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default DatabaseQueryAnalyzer;
