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

export class WordPressPluginAuditor extends BasePlugin implements IPromptPlugin {
  name = 'audit_wordpress_plugin';
  category = 'analyze' as const;
  description = 'Comprehensive WordPress plugin audit - chains multiple analysis steps for security, performance, dependencies, and code quality';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Multi-file parameters (primary mode for plugin audit)
    projectPath: {
      type: 'string' as const,
      description: 'Path to WordPress plugin root directory',
      required: true
    },
    
    // Analysis configuration
    auditDepth: {
      type: 'string' as const,
      description: 'Depth of audit analysis',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    auditType: {
      type: 'string' as const,
      description: 'Type of audit focus',
      enum: ['security', 'performance', 'quality', 'full-audit'],
      default: 'full-audit',
      required: false
    },
    
    // Analysis step configuration
    includeSteps: {
      type: 'array' as const,
      description: 'Analysis steps to include in audit',
      required: false,
      items: { type: 'string' as const },
      default: ['structure', 'dependencies', 'security', 'database', 'quality']
    },
    
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for analysis (1-5)',
      required: false,
      default: 4
    },
    
    // WordPress-specific context
    wpVersion: {
      type: 'string' as const,
      description: 'Target WordPress version for compatibility checks',
      required: false,
      default: '6.4'
    },
    phpVersion: {
      type: 'string' as const,
      description: 'Target PHP version for compatibility checks', 
      required: false,
      default: '8.0'
    }
  };

  private analysisCache = getAnalysisCache();
  private multiFileAnalysis = new MultiFileAnalysis();
  private chainedResults: Map<string, any> = new Map();

  constructor() {
    super();
    // Cache and analysis utilities are initialized above
  }

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // 1. Validate WordPress plugin structure
        this.validateWordPressPlugin(secureParams);
        
        // 2. Setup model
        const { model, contextLength } = await ModelSetup.getReadyModel(llmClient);
        
        // 3. Execute chained analysis workflow
        return await this.executeChainedAnalysis(secureParams, llmClient, model, contextLength);
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('audit_wordpress_plugin', error);
      }
    });
  }

  /**
   * Validate WordPress plugin structure
   */
  private validateWordPressPlugin(params: any): void {
    ParameterValidator.validateProjectPath(params);
    ParameterValidator.validateDepth(params);
    ParameterValidator.validateEnum(params, 'auditType', ['security', 'performance', 'quality', 'full-audit']);
    ParameterValidator.validateEnum(params, 'auditDepth', ['basic', 'detailed', 'comprehensive']);
  }

  /**
   * Execute the chained analysis workflow
   */
  private async executeChainedAnalysis(params: any, llmClient: any, model: any, contextLength: number) {
    const auditSteps = params.includeSteps || ['structure', 'dependencies', 'security', 'database', 'quality'];
    const results: Record<string, any> = {};
    const stepExecutionLog: string[] = [];
    
    try {
      stepExecutionLog.push(`Starting WordPress plugin audit with ${auditSteps.length} steps`);
      
      // Step 1: Project Structure Overview
      if (auditSteps.includes('structure')) {
        stepExecutionLog.push('Executing: Project structure analysis');
        results.structure = await this.runAnalysisStep('count_files', {
          projectPath: params.projectPath,
          analysisType: 'comprehensive',
          maxDepth: params.maxDepth
        }, llmClient);
        stepExecutionLog.push(`Structure analysis: ${results.structure.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 2: Dependencies Analysis  
      if (auditSteps.includes('dependencies')) {
        stepExecutionLog.push('Executing: Dependencies analysis');
        results.dependencies = await this.runAnalysisStep('analyze_dependencies', {
          projectPath: params.projectPath,
          analysisType: 'comprehensive',
          includePackageJson: true,
          checkDevDependencies: false
        }, llmClient);
        stepExecutionLog.push(`Dependencies analysis: ${results.dependencies.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 3: WordPress Security Audit
      if (auditSteps.includes('security')) {
        stepExecutionLog.push('Executing: WordPress security analysis');
        results.security = await this.runAnalysisStep('analyze_wordpress_security', {
          projectPath: params.projectPath,
          wpType: 'plugin',
          wpVersion: params.wpVersion,
          analysisType: 'comprehensive',
          includeOwaspTop10: true
        }, llmClient);
        stepExecutionLog.push(`Security analysis: ${results.security.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 4: Database Query Analysis
      if (auditSteps.includes('database')) {
        stepExecutionLog.push('Executing: Database query analysis');
        results.database = await this.runAnalysisStep('analyze_database_queries', {
          projectPath: params.projectPath,
          analysisType: 'comprehensive',
          context: { projectType: 'wordpress-plugin' }
        }, llmClient);
        stepExecutionLog.push(`Database analysis: ${results.database.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 5: Code Quality Assessment
      if (auditSteps.includes('quality')) {
        stepExecutionLog.push('Executing: Code quality analysis');
        results.quality = await this.runAnalysisStep('analyze_code_quality', {
          projectPath: params.projectPath,
          analysisType: 'comprehensive',
          language: 'php'
        }, llmClient);
        stepExecutionLog.push(`Quality analysis: ${results.quality.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 6: Synthesize all results
      stepExecutionLog.push('Synthesizing comprehensive audit report');
      const synthesizedResults = await this.synthesizeAuditResults({
        ...results,
        executionLog: stepExecutionLog,
        completedSteps: auditSteps.filter(step => results[step]?.success),
        failedSteps: auditSteps.filter(step => results[step]?.success === false)
      }, params, model, contextLength);
      
      stepExecutionLog.push('Audit synthesis: COMPLETED');
      return synthesizedResults;
      
    } catch (error: any) {
      stepExecutionLog.push(`Audit failed: ${error.message}`);
      return ErrorHandler.createExecutionError('audit_wordpress_plugin', error);
    }
  }

  /**
   * Run individual analysis step by calling other MCP functions
   */
  private async runAnalysisStep(functionName: string, stepParams: any, llmClient: any): Promise<any> {
    try {
      // Check cache first
      const cacheKey = this.analysisCache.generateKey(functionName, stepParams, []);
      const cached = await this.analysisCache.get(cacheKey);
      if (cached) return cached;
      
      // Import the plugin loader to call other MCP functions
      const { PluginRegistry } = await import('../../plugins/index.js');
      const pluginLoader = PluginRegistry.getInstance();
      
      // Execute the specific analysis function
      let result;
      try {
        result = await pluginLoader.executePlugin(functionName, stepParams, llmClient);
        
        // Wrap successful results
        const wrappedResult = {
          stepName: functionName,
          parameters: stepParams,
          status: 'completed',
          timestamp: new Date().toISOString(),
          data: result.data || result,
          summary: `Completed ${functionName} analysis`,
          success: true
        };
        
        // Cache the result
        await this.analysisCache.cacheAnalysis(cacheKey, wrappedResult, {
          modelUsed: result.modelUsed || 'unknown',
          executionTime: result.executionTimeMs || 0,
          timestamp: new Date().toISOString()
        });
        
        return wrappedResult;
        
      } catch (pluginError: any) {
        // If the plugin doesn't exist or fails, return error result
        const errorResult = {
          stepName: functionName,
          status: 'failed',
          error: pluginError.message,
          timestamp: new Date().toISOString(),
          success: false
        };
        
        return errorResult;
      }
      
    } catch (error: any) {
      return {
        stepName: functionName,
        status: 'system-error',
        error: error.message,
        timestamp: new Date().toISOString(),
        success: false
      };
    }
  }

  /**
   * Synthesize all audit results into comprehensive report
   */
  private async synthesizeAuditResults(results: Record<string, any>, params: any, model: any, contextLength: number) {
    // Generate final synthesis prompt stages
    const promptStages = this.getMultiFilePromptStages({
      ...params,
      analysisResult: results,
      stepCount: Object.keys(results).length
    });
    
    // Always use chunking for comprehensive synthesis
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
      'audit_wordpress_plugin',
      'multifile'
    );
  }

  /**
   * Single-file mode not applicable for plugin audit
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const systemAndContext = `WordPress Plugin Auditor - Single File Mode

This mode is not recommended for WordPress plugin audits. 
Use multi-file mode with projectPath parameter for comprehensive plugin analysis.`;

    const dataPayload = `Single file analysis not supported for WordPress plugin audits.
Please use projectPath parameter to analyze the entire plugin structure.`;

    const outputInstructions = `{
  "error": "Single file mode not supported for WordPress plugin audits",
  "recommendation": "Use projectPath parameter for comprehensive plugin analysis"
}`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file prompt stages for comprehensive audit synthesis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, auditType, auditDepth, wpVersion, phpVersion, stepCount } = params;
    
    const systemAndContext = `You are a senior WordPress plugin security and performance expert with 15+ years of experience auditing enterprise WordPress installations.

**AUDIT CONTEXT:**
- Audit Type: ${auditType}
- Audit Depth: ${auditDepth}
- Analysis Steps Completed: ${stepCount}
- Target WordPress Version: ${wpVersion}
- Target PHP Version: ${phpVersion}
- Plugin Type: WordPress Plugin

**YOUR EXPERTISE:**
You are internationally recognized for:
- WordPress plugin security auditing and penetration testing
- Performance optimization for high-traffic WordPress sites
- Code quality assessment for WordPress.org repository submissions
- Database optimization and query performance analysis
- Dependency management and conflict resolution

**AUDIT METHODOLOGY:**
1. **Security Assessment**: OWASP Top 10, WordPress-specific vulnerabilities
2. **Performance Analysis**: Database queries, caching, resource usage
3. **Code Quality Review**: WordPress Coding Standards, best practices
4. **Dependency Analysis**: Plugin conflicts, version compatibility
5. **Architecture Review**: Plugin structure, hooks usage, extensibility

**CRITICAL FOCUS AREAS:**
- SQL injection vulnerabilities in custom queries
- XSS vulnerabilities in admin interfaces and frontend output
- CSRF protection through nonces validation
- Capability and permission checks
- Data sanitization and validation
- Performance bottlenecks in database queries
- Unused code and dependencies
- WordPress API compliance and best practices`;

    const dataPayload = `**COMPREHENSIVE AUDIT RESULTS:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**PROVIDE COMPREHENSIVE WORDPRESS PLUGIN AUDIT REPORT:**

{
  "executiveSummary": {
    "overallRating": "critical|high-risk|medium-risk|low-risk|excellent",
    "primaryConcerns": ["concern1", "concern2", "concern3"],
    "strengths": ["strength1", "strength2"],
    "recommendedActions": ["action1", "action2"],
    "timeToFix": "immediate|1-2 days|1 week|2+ weeks"
  },
  
  "securityAssessment": {
    "criticalVulnerabilities": [
      {
        "type": "SQL Injection|XSS|CSRF|Authentication Bypass",
        "severity": "critical|high|medium|low",
        "location": "specific file and line",
        "description": "detailed vulnerability description",
        "exploit": "how this could be exploited",
        "fix": "specific fix with code example"
      }
    ],
    "securityScore": "A|B|C|D|F",
    "complianceIssues": ["OWASP issue 1", "WordPress security issue 2"]
  },
  
  "performanceAssessment": {
    "databaseIssues": [
      {
        "type": "N+1 Query|Missing Index|Inefficient Query|Direct SQL",
        "severity": "critical|high|medium|low",
        "location": "file and function",
        "impact": "performance impact description",
        "optimization": "specific optimization recommendation"
      }
    ],
    "performanceScore": "A|B|C|D|F",
    "bottlenecks": ["bottleneck1", "bottleneck2"],
    "optimizations": ["optimization1", "optimization2"]
  },
  
  "codeQualityAssessment": {
    "wordpressStandards": {
      "compliance": "high|medium|low",
      "violations": ["violation1", "violation2"],
      "score": "A|B|C|D|F"
    },
    "maintainability": {
      "score": "high|medium|low",
      "issues": ["issue1", "issue2"],
      "improvements": ["improvement1", "improvement2"]
    }
  },
  
  "dependencyAssessment": {
    "unusedCode": ["unused file 1", "unused function 2"],
    "conflicts": ["potential conflict 1"],
    "outdatedDependencies": ["dependency1", "dependency2"],
    "recommendations": ["remove unused X", "update Y to version Z"]
  },
  
  "actionPlan": {
    "immediate": [
      {
        "priority": 1,
        "task": "fix critical security vulnerability",
        "estimatedTime": "2 hours",
        "risk": "critical"
      }
    ],
    "shortTerm": [
      {
        "priority": 2,
        "task": "optimize database queries",
        "estimatedTime": "4 hours",
        "risk": "medium"
      }
    ],
    "longTerm": [
      {
        "priority": 3,
        "task": "refactor architecture",
        "estimatedTime": "2 days",
        "risk": "low"
      }
    ]
  },
  
  "complianceReport": {
    "wordpressOrgReady": true,
    "issuesBlocking": ["issue1", "issue2"],
    "recommendationsForSubmission": ["recommendation1", "recommendation2"]
  }
}

**REQUIREMENTS:**
- Provide specific file names and line numbers for all issues
- Include code examples for fixes where applicable
- Prioritize findings by business impact and security risk
- Ensure all recommendations are actionable and testable
- Focus on WordPress-specific best practices and security guidelines`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Backwards compatibility method
   */
  getPromptStages(params: any): PromptStages {
    return this.getMultiFilePromptStages(params);
  }

  /**
   * Not used in plugin audit workflow
   */
  private async discoverRelevantFiles(projectPath: string, maxDepth: number, analysisType: string): Promise<string[]> {
    const extensions = ['.php', '.js', '.css', '.json', '.xml', '.txt', '.md'];
    return await this.multiFileAnalysis.discoverFiles(projectPath, extensions, maxDepth);
  }

  /**
   * Not used in chained analysis workflow  
   */
  private async performMultiFileAnalysis(files: string[], params: any, model: any, contextLength: number): Promise<any> {
    return {};
  }

  /**
   * Not used in chained analysis workflow
   */
  private async analyzeIndividualFile(file: string, params: any, model: any): Promise<any> {
    return {};
  }

  /**
   * WordPress plugin file extensions
   */
  private getFileExtensions(analysisType: string): string[] {
    return ['.php', '.js', '.css', '.json', '.xml', '.txt', '.md', '.yml', '.yaml'];
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default WordPressPluginAuditor;
