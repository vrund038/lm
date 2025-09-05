/**
 * WordPress Theme Comprehensive Auditor - Modern v4.3
 * 
 * Chains multiple analysis steps for comprehensive WordPress theme audit
 * Covers theme-specific security, performance, accessibility, and code quality
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

// Common Node.js modules
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class WordPressThemeAuditor extends BasePlugin implements IPromptPlugin {
  name = 'audit_wordpress_theme';
  category = 'analyze' as const;
  description = 'Comprehensive WordPress theme audit - chains multiple analysis steps for security, performance, accessibility, SEO, and code quality';
  
  parameters = {
    // Multi-file parameters (primary mode for theme audit)
    projectPath: {
      type: 'string' as const,
      description: 'Path to WordPress theme root directory',
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
      enum: ['security', 'performance', 'accessibility', 'seo', 'quality', 'full-audit'],
      default: 'full-audit',
      required: false
    },
    
    // Theme-specific analysis steps
    includeSteps: {
      type: 'array' as const,
      description: 'Analysis steps to include in theme audit',
      required: false,
      items: { type: 'string' as const },
      default: ['structure', 'security', 'performance', 'accessibility', 'quality', 'seo']
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
    },
    
    // Theme-specific options
    themeType: {
      type: 'string' as const,
      description: 'Type of WordPress theme',
      enum: ['classic', 'block', 'hybrid'],
      default: 'classic',
      required: false
    },
    checkAccessibility: {
      type: 'boolean' as const,
      description: 'Include detailed accessibility audit',
      default: true,
      required: false
    }
  };

  private analysisCache = getAnalysisCache();
  private multiFileAnalysis = new MultiFileAnalysis();

  constructor() {
    super();
  }

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // 1. Validate WordPress theme structure
        this.validateWordPressTheme(secureParams);
        
        // 2. Setup model
        const { model, contextLength } = await ModelSetup.getReadyModel(llmClient);
        
        // 3. Execute chained theme analysis workflow
        return await this.executeChainedThemeAnalysis(secureParams, llmClient, model, contextLength);
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('audit_wordpress_theme', error);
      }
    });
  }

  /**
   * Validate WordPress theme structure
   */
  private validateWordPressTheme(params: any): void {
    ParameterValidator.validateProjectPath(params);
    ParameterValidator.validateDepth(params);
    ParameterValidator.validateEnum(params, 'auditType', ['security', 'performance', 'accessibility', 'seo', 'quality', 'full-audit']);
    ParameterValidator.validateEnum(params, 'auditDepth', ['basic', 'detailed', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'themeType', ['classic', 'block', 'hybrid']);
  }

  /**
   * Execute the chained theme analysis workflow
   */
  private async executeChainedThemeAnalysis(params: any, llmClient: any, model: any, contextLength: number) {
    const auditSteps = params.includeSteps || ['structure', 'security', 'performance', 'accessibility', 'quality', 'seo'];
    const results: Record<string, any> = {};
    const stepExecutionLog: string[] = [];
    
    try {
      stepExecutionLog.push(`Starting WordPress theme audit with ${auditSteps.length} steps`);
      stepExecutionLog.push(`Theme type: ${params.themeType || 'classic'}`);
      
      // Step 1: Theme Structure Overview
      if (auditSteps.includes('structure')) {
        stepExecutionLog.push('Executing: Theme structure analysis');
        results.structure = await this.runAnalysisStep('count_files', {
          projectPath: params.projectPath,
          analysisType: 'comprehensive',
          maxDepth: params.maxDepth
        }, llmClient);
        stepExecutionLog.push(`Structure analysis: ${results.structure.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 2: WordPress Theme Security Audit
      if (auditSteps.includes('security')) {
        stepExecutionLog.push('Executing: WordPress theme security analysis');
        results.security = await this.runAnalysisStep('analyze_wordpress_security', {
          projectPath: params.projectPath,
          wpType: 'theme',
          wpVersion: params.wpVersion,
          analysisType: 'comprehensive',
          includeOwaspTop10: true
        }, llmClient);
        stepExecutionLog.push(`Security analysis: ${results.security.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 3: Performance Analysis (theme-specific)
      if (auditSteps.includes('performance')) {
        stepExecutionLog.push('Executing: Theme performance analysis');
        results.performance = await this.runAnalysisStep('analyze_code_quality', {
          projectPath: params.projectPath,
          analysisType: 'performance',
          language: 'php',
          context: { 
            projectType: 'wordpress-theme',
            themeType: params.themeType,
            focusAreas: ['performance', 'optimization']
          }
        }, llmClient);
        stepExecutionLog.push(`Performance analysis: ${results.performance.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 4: Accessibility Audit
      if (auditSteps.includes('accessibility') && params.checkAccessibility) {
        stepExecutionLog.push('Executing: Accessibility analysis');
        results.accessibility = await this.runAnalysisStep('analyze_single_file', {
          projectPath: params.projectPath,
          analysisType: 'comprehensive',
          context: {
            projectType: 'wordpress-theme',
            focusAreas: ['accessibility', 'wcag', 'semantic-html'],
            standards: ['WCAG 2.1 AA', 'Section 508']
          }
        }, llmClient);
        stepExecutionLog.push(`Accessibility analysis: ${results.accessibility.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 5: Code Quality Assessment
      if (auditSteps.includes('quality')) {
        stepExecutionLog.push('Executing: Code quality analysis');
        results.quality = await this.runAnalysisStep('analyze_code_quality', {
          projectPath: params.projectPath,
          analysisType: 'comprehensive',
          language: 'php',
          context: { projectType: 'wordpress-theme' }
        }, llmClient);
        stepExecutionLog.push(`Quality analysis: ${results.quality.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 6: SEO Analysis
      if (auditSteps.includes('seo')) {
        stepExecutionLog.push('Executing: SEO structure analysis');
        results.seo = await this.runAnalysisStep('analyze_single_file', {
          projectPath: params.projectPath,
          analysisType: 'comprehensive',
          context: {
            projectType: 'wordpress-theme',
            focusAreas: ['seo', 'structured-data', 'meta-tags', 'performance']
          }
        }, llmClient);
        stepExecutionLog.push(`SEO analysis: ${results.seo.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 7: Database Query Analysis (if applicable)
      if (auditSteps.includes('database')) {
        stepExecutionLog.push('Executing: Database query analysis');
        results.database = await this.runAnalysisStep('analyze_database_queries', {
          projectPath: params.projectPath,
          analysisType: 'comprehensive',
          context: { projectType: 'wordpress-theme' }
        }, llmClient);
        stepExecutionLog.push(`Database analysis: ${results.database.success ? 'SUCCESS' : 'FAILED'}`);
      }
      
      // Step 8: Synthesize all results
      stepExecutionLog.push('Synthesizing comprehensive theme audit report');
      const synthesizedResults = await this.synthesizeThemeAuditResults({
        ...results,
        executionLog: stepExecutionLog,
        completedSteps: auditSteps.filter(step => results[step]?.success),
        failedSteps: auditSteps.filter(step => results[step]?.success === false)
      }, params, model, contextLength);
      
      stepExecutionLog.push('Theme audit synthesis: COMPLETED');
      return synthesizedResults;
      
    } catch (error: any) {
      stepExecutionLog.push(`Theme audit failed: ${error.message}`);
      return ErrorHandler.createExecutionError('audit_wordpress_theme', error);
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
          summary: `Failed ${functionName} analysis`,
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
        summary: 'System error during analysis',
        success: false
      };
    }
  }

  /**
   * Synthesize all theme audit results into comprehensive report
   */
  private async synthesizeThemeAuditResults(results: Record<string, any>, params: any, model: any, contextLength: number) {
    // Generate final synthesis prompt stages
    const promptStages = this.getMultiFilePromptStages({
      ...params,
      analysisResult: results,
      stepCount: Object.keys(results).length
    });
    
    // Always use chunking for comprehensive synthesis
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
      'audit_wordpress_theme',
      'multifile'
    );
  }

  /**
   * Single-file mode not applicable for theme audit
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const systemAndContext = `WordPress Theme Auditor - Single File Mode

This mode is not recommended for WordPress theme audits. 
Use multi-file mode with projectPath parameter for comprehensive theme analysis.`;

    const dataPayload = `Single file analysis not supported for WordPress theme audits.
Please use projectPath parameter to analyze the entire theme structure.`;

    const outputInstructions = `{
  "error": "Single file mode not supported for WordPress theme audits",
  "recommendation": "Use projectPath parameter for comprehensive theme analysis"
}`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file prompt stages for comprehensive theme audit synthesis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, auditType, auditDepth, wpVersion, phpVersion, themeType, stepCount } = params;
    
    const systemAndContext = `You are a senior WordPress theme developer and security expert with 15+ years of experience auditing enterprise WordPress themes for performance, accessibility, and security.

**THEME AUDIT CONTEXT:**
- Audit Type: ${auditType}
- Audit Depth: ${auditDepth}
- Analysis Steps Completed: ${stepCount}
- Theme Type: ${themeType}
- Target WordPress Version: ${wpVersion}
- Target PHP Version: ${phpVersion}

**YOUR EXPERTISE:**
You are internationally recognized for:
- WordPress theme security auditing and vulnerability assessment
- Frontend performance optimization for WordPress themes
- Accessibility compliance (WCAG 2.1 AA, Section 508)
- SEO optimization and Core Web Vitals improvement
- Theme architecture and template hierarchy mastery
- WordPress.org theme repository review standards

**THEME-SPECIFIC AUDIT METHODOLOGY:**
1. **Security Assessment**: Template injection, XSS, CSRF, data sanitization
2. **Performance Analysis**: Asset loading, image optimization, caching strategies
3. **Accessibility Review**: ARIA labels, keyboard navigation, screen reader support
4. **SEO Optimization**: Structured data, meta tags, page speed, mobile responsiveness
5. **Code Quality**: WordPress Coding Standards, template hierarchy compliance
6. **Architecture Review**: Child theme compatibility, customizer integration

**CRITICAL THEME FOCUS AREAS:**
- Template security: Proper escaping and sanitization in templates
- Asset optimization: CSS/JS minification, critical path optimization
- Accessibility compliance: Color contrast, focus management, semantic HTML
- SEO implementation: Schema markup, Open Graph, Twitter Cards
- Performance bottlenecks: Render-blocking resources, unused CSS
- WordPress integration: Proper enqueueing, theme supports, customizer
- Cross-browser compatibility and responsive design
- Template hierarchy compliance and hook usage`;

    const dataPayload = `**COMPREHENSIVE THEME AUDIT RESULTS:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**PROVIDE COMPREHENSIVE WORDPRESS THEME AUDIT REPORT:**

{
  "executiveSummary": {
    "overallRating": "critical|high-risk|medium-risk|low-risk|excellent",
    "themeReadiness": "production-ready|needs-fixes|major-issues|not-ready",
    "primaryConcerns": ["concern1", "concern2", "concern3"],
    "strengths": ["strength1", "strength2"],
    "timeToFix": "immediate|1-2 days|1 week|2+ weeks",
    "wpOrgCompliance": "compliant|minor-issues|major-issues|non-compliant"
  },
  
  "securityAssessment": {
    "criticalVulnerabilities": [
      {
        "type": "XSS|CSRF|Template Injection|Data Exposure",
        "severity": "critical|high|medium|low",
        "location": "specific template and line",
        "description": "detailed vulnerability description",
        "exploit": "how this could be exploited in theme context",
        "fix": "specific theme security fix with code example"
      }
    ],
    "templateSecurity": {
      "escaping": "proper|inconsistent|missing",
      "sanitization": "proper|inconsistent|missing",
      "authorization": "proper|inconsistent|missing"
    },
    "securityScore": "A|B|C|D|F"
  },
  
  "performanceAssessment": {
    "coreWebVitals": {
      "lcp": "good|needs-improvement|poor",
      "fid": "good|needs-improvement|poor", 
      "cls": "good|needs-improvement|poor"
    },
    "assetOptimization": {
      "css": "optimized|needs-optimization|poor",
      "javascript": "optimized|needs-optimization|poor",
      "images": "optimized|needs-optimization|poor"
    },
    "performanceIssues": [
      {
        "type": "Render Blocking|Unused CSS|Large Images|Slow Queries",
        "severity": "critical|high|medium|low",
        "location": "specific file or template",
        "impact": "performance impact description",
        "optimization": "specific optimization recommendation"
      }
    ],
    "performanceScore": "A|B|C|D|F"
  },
  
  "accessibilityAssessment": {
    "wcagCompliance": {
      "level": "AA|A|Non-compliant",
      "score": "A|B|C|D|F"
    },
    "accessibilityIssues": [
      {
        "type": "Color Contrast|Keyboard Navigation|Screen Reader|ARIA|Focus Management",
        "severity": "critical|high|medium|low",
        "location": "specific template or component",
        "wcagCriterion": "1.4.3|2.1.1|4.1.2|etc",
        "fix": "specific accessibility fix with code example"
      }
    ],
    "keyboardNavigation": "full|partial|broken",
    "screenReaderSupport": "excellent|good|poor"
  },
  
  "seoAssessment": {
    "technicalSeo": {
      "structuredData": "implemented|partial|missing",
      "metaTags": "complete|incomplete|missing",
      "performance": "fast|average|slow"
    },
    "seoIssues": [
      {
        "type": "Missing Meta|No Structured Data|Slow Loading|Poor Mobile",
        "severity": "high|medium|low",
        "impact": "SEO impact description",
        "recommendation": "specific SEO improvement"
      }
    ],
    "seoScore": "A|B|C|D|F"
  },
  
  "codeQualityAssessment": {
    "wordpressStandards": {
      "phpCompliance": "high|medium|low",
      "cssCompliance": "high|medium|low",
      "jsCompliance": "high|medium|low"
    },
    "themeStructure": {
      "templateHierarchy": "proper|issues|broken",
      "childThemeSupport": "excellent|good|poor",
      "customizerIntegration": "complete|partial|missing"
    },
    "qualityScore": "A|B|C|D|F"
  },
  
  "actionPlan": {
    "immediate": [
      {
        "priority": 1,
        "task": "fix critical security vulnerability",
        "category": "security|performance|accessibility|seo|quality",
        "estimatedTime": "2 hours",
        "risk": "critical|high|medium|low"
      }
    ],
    "shortTerm": [
      {
        "priority": 2,
        "task": "optimize Core Web Vitals",
        "category": "performance",
        "estimatedTime": "4 hours",
        "risk": "medium"
      }
    ],
    "longTerm": [
      {
        "priority": 3,
        "task": "improve accessibility compliance",
        "category": "accessibility",
        "estimatedTime": "2 days",
        "risk": "low"
      }
    ]
  },
  
  "complianceReport": {
    "wordpressOrgReady": true,
    "accessibilityCompliant": true,
    "performanceOptimized": false,
    "issuesBlocking": ["issue1", "issue2"],
    "recommendationsForSubmission": ["recommendation1", "recommendation2"]
  }
}

**REQUIREMENTS:**
- Provide specific template file names and line numbers for all issues
- Include code examples for theme-specific fixes where applicable
- Prioritize findings by user impact and compliance requirements
- Focus on WordPress theme-specific best practices and standards
- Ensure all recommendations are testable and implementable
- Consider theme type (classic vs block) in recommendations`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Backwards compatibility method
   */
  getPromptStages(params: any): PromptStages {
    return this.getMultiFilePromptStages(params);
  }

  // Unused methods for theme audit workflow
  private async discoverRelevantFiles(projectPath: string, maxDepth: number, analysisType: string): Promise<string[]> {
    const extensions = ['.php', '.css', '.js', '.json', '.xml', '.txt', '.md', '.scss', '.sass'];
    return await this.multiFileAnalysis.discoverFiles(projectPath, extensions, maxDepth);
  }

  private async performMultiFileAnalysis(files: string[], params: any, model: any, contextLength: number): Promise<any> {
    return {};
  }

  private async analyzeIndividualFile(file: string, params: any, model: any): Promise<any> {
    return {};
  }

  private getFileExtensions(analysisType: string): string[] {
    return ['.php', '.css', '.js', '.json', '.xml', '.txt', '.md', '.scss', '.sass'];
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default WordPressThemeAuditor;
