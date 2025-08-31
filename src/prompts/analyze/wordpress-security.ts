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

export class WordPressSecurityAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_wordpress_security';
  category = 'analyze' as const;
  description = 'Comprehensive WordPress security analysis for plugins, themes, and core implementations with OWASP and WordPress-specific vulnerability detection';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'The WordPress code to analyze (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single WordPress file to analyze',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Path to WordPress plugin/theme root (for multi-file analysis)',
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
    
    // WordPress-specific parameters
    wpType: {
      type: 'string' as const,
      description: 'WordPress component type',
      enum: ['plugin', 'theme', 'core', 'mu-plugin', 'dropin'],
      default: 'plugin',
      required: false
    },
    wpVersion: {
      type: 'string' as const,
      description: 'Target WordPress version for compatibility checks',
      required: false,
      default: '6.4'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of security analysis detail',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of security analysis to perform',
      enum: ['owasp', 'wordpress', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    
    // Security-specific parameters
    includeOwaspTop10: {
      type: 'boolean' as const,
      description: 'Include OWASP Top 10 vulnerability checks',
      default: true,
      required: false
    },
    checkCapabilities: {
      type: 'boolean' as const,
      description: 'Analyze WordPress capability and role management',
      default: true,
      required: false
    },
    auditDatabaseQueries: {
      type: 'boolean' as const,
      description: 'Audit database queries for SQL injection vulnerabilities',
      default: true,
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
        return ErrorHandler.createExecutionError('analyze_wordpress_security', error);
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
    
    // Default to multi-file for WordPress plugin/theme analysis
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
    ParameterValidator.validateEnum(params, 'analysisType', ['owasp', 'wordpress', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'wpType', ['plugin', 'theme', 'core', 'mu-plugin', 'dropin']);
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
        'analyze_wordpress_security',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'analyze_wordpress_security'
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
      'analyze_wordpress_security',
      'multifile'
    );
  }

  /**
   * WordPress Security Analysis - Single File Expert Prompt
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, wpType, wpVersion, analysisDepth, analysisType, filePath } = params;
    const fileName = filePath ? basename(filePath) : 'WordPress file';
    
    const systemAndContext = `You are a world-class WordPress security expert with 15+ years of experience in WordPress core development, plugin security auditing, and vulnerability research. You've discovered and patched hundreds of WordPress security vulnerabilities and are intimately familiar with the WordPress Security Team's standards.

**YOUR EXPERTISE:**
- WordPress Core Security Architecture (hooks, capabilities, data validation)
- OWASP Top 10 vulnerabilities in WordPress context
- WordPress-specific attack vectors (privilege escalation, data exposure, injection attacks)
- WordPress Coding Standards security requirements
- Plugin Review Team security guidelines
- WordFence, Sucuri, and security scanner detection patterns

**ANALYSIS CONTEXT:**
- WordPress Component: ${wpType}
- WordPress Version: ${wpVersion}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- File: ${fileName}
- OWASP Top 10: ${params.includeOwaspTop10 ? 'Enabled' : 'Disabled'}
- Capability Checks: ${params.checkCapabilities ? 'Enabled' : 'Disabled'}  
- Database Auditing: ${params.auditDatabaseQueries ? 'Enabled' : 'Disabled'}

**WORDPRESS SECURITY FOCUS AREAS:**

🔒 **Authentication & Authorization:**
- wp_verify_nonce() usage and nonce validation
- current_user_can() capability checks
- is_user_logged_in() authentication verification
- Role and capability management
- Session handling and user meta security

🛡️ **Data Validation & Sanitization:**
- sanitize_text_field(), sanitize_email(), sanitize_url() usage
- wp_kses() and wp_kses_post() for HTML filtering  
- esc_html(), esc_attr(), esc_url() output escaping
- wp_unslash() and stripslashes_deep() handling
- Custom validation function security

💉 **SQL Injection Prevention:**
- $wpdb->prepare() statement usage
- Direct query vulnerabilities
- Custom table operations security
- Meta query and WP_Query parameter validation
- Database prefix usage and table access

🌐 **Cross-Site Scripting (XSS) Prevention:**
- Output escaping in templates and admin areas
- AJAX handler security and validation
- JavaScript variable escaping
- Admin notice and error message security
- Custom field and user input handling

🔐 **WordPress-Specific Vulnerabilities:**
- File upload restrictions and validation
- Shortcode parameter validation and escaping  
- Widget and customizer security
- REST API endpoint authorization
- Admin AJAX action security
- Cron job security and scheduling

**SECURITY AUDIT METHODOLOGY:**
1. **Privilege Escalation Detection**: Identify unauthorized capability bypasses
2. **Data Exposure Analysis**: Find information leakage vulnerabilities  
3. **Injection Vector Mapping**: Locate all user input processing points
4. **Authentication Bypass Detection**: Check for login and nonce circumvention
5. **File Security Assessment**: Analyze upload, inclusion, and access controls`;

    const dataPayload = `**WORDPRESS CODE TO ANALYZE:**

\`\`\`php
${code}
\`\`\`

${filePath ? `\n**File Context:** ${filePath}` : ''}

**SECURITY ANALYSIS INSTRUCTIONS:**
Focus on WordPress-specific security patterns and vulnerabilities. Pay special attention to user input handling, capability checks, nonce validation, database queries, and output escaping.`;

    const outputInstructions = `**PROVIDE COMPREHENSIVE WORDPRESS SECURITY ANALYSIS:**

{
  "securitySummary": "2-3 sentence overview of the file's security posture and most critical vulnerabilities",
  
  "criticalFindings": [
    {
      "vulnerability": "SQL Injection in Custom Query",
      "severity": "critical|high|medium|low",
      "cweId": "CWE-89",
      "owaspCategory": "A03:2021 – Injection",
      "line": 42,
      "codeSnippet": "SELECT * FROM wp_posts WHERE ID = $_GET['id']",
      "description": "Direct user input used in SQL query without sanitization",
      "exploit": "Attacker can inject malicious SQL: ?id=1 UNION SELECT user_pass FROM wp_users",
      "impact": "Complete database compromise, data theft, privilege escalation",
      "fix": "Use $wpdb->prepare(): $wpdb->prepare('SELECT * FROM wp_posts WHERE ID = %d', intval($_GET['id']))",
      "wpFunction": "$wpdb->prepare()"
    }
  ],
  
  "authenticationIssues": [
    {
      "issue": "Missing capability check",
      "severity": "high", 
      "line": 67,
      "description": "Administrative function accessible without proper capability verification",
      "fix": "Add: if (!current_user_can('manage_options')) wp_die('Insufficient permissions');",
      "wpFunction": "current_user_can()"
    }
  ],
  
  "dataValidationIssues": [
    {
      "issue": "Unsanitized user input",
      "severity": "medium",
      "line": 23,
      "description": "User input stored without proper sanitization",
      "fix": "Use: sanitize_text_field($_POST['user_input'])",
      "wpFunction": "sanitize_text_field()"
    }
  ],
  
  "outputEscapingIssues": [
    {
      "issue": "Unescaped output in HTML context", 
      "severity": "high",
      "line": 89,
      "description": "User data output without proper escaping - XSS vulnerability",
      "fix": "Use: echo esc_html($user_data) instead of echo $user_data",
      "wpFunction": "esc_html()"
    }
  ],
  
  "nonceValidationIssues": [
    {
      "issue": "Missing nonce verification",
      "severity": "medium", 
      "line": 34,
      "description": "Form processing without CSRF protection",
      "fix": "Add: wp_verify_nonce($_POST['_wpnonce'], 'action_name')",
      "wpFunction": "wp_verify_nonce()"
    }
  ],
  
  "fileSecurityIssues": [
    {
      "issue": "Unrestricted file upload",
      "severity": "critical",
      "line": 156,
      "description": "File upload without type or size validation",
      "fix": "Validate file type with wp_check_filetype() and restrict extensions",
      "wpFunction": "wp_check_filetype()"
    }
  ],
  
  "wordpressSpecificIssues": [
    {
      "issue": "Direct file access not prevented",
      "severity": "low",
      "description": "PHP file missing ABSPATH check",
      "fix": "Add: if (!defined('ABSPATH')) exit; at the top of the file",
      "wpFunction": "defined('ABSPATH')"
    }
  ],
  
  "securityBestPractices": {
    "implemented": [
      "Proper hook usage",
      "Sanitized database queries"
    ],
    "missing": [
      "Input validation on all user data",
      "Output escaping in templates",
      "Capability checks on administrative functions"
    ]
  },
  
  "owaspTop10Assessment": [
    {
      "category": "A01:2021 – Broken Access Control",
      "status": "vulnerable|secure|needs_review",
      "findings": ["Missing capability checks", "Direct file access allowed"]
    },
    {
      "category": "A03:2021 – Injection", 
      "status": "vulnerable|secure|needs_review",
      "findings": ["SQL injection in line 42", "Unsanitized input processing"]
    }
  ],
  
  "recommendedActions": {
    "immediate": [
      "Fix critical SQL injection vulnerability on line 42",
      "Add capability checks to administrative functions"
    ],
    "shortTerm": [
      "Implement comprehensive input validation",
      "Add output escaping throughout templates"
    ],
    "longTerm": [
      "Implement security code review process",
      "Add automated security testing"
    ]
  },
  
  "securityScore": 4,
  "maxSecurityScore": 10,
  "confidence": 0.95
}

**CRITICAL REQUIREMENTS:**
- Focus on WordPress-specific security patterns and functions
- Provide specific WordPress function recommendations (wp_verify_nonce, current_user_can, etc.)
- Include CWE IDs and OWASP mappings where applicable  
- Give concrete, copy-paste fixes for each vulnerability
- Prioritize findings by potential impact and exploitability`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * WordPress Security Analysis - Multi-File Project Audit
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, wpType } = params;
    
    const systemAndContext = `You are a senior WordPress security consultant specializing in ${analysisDepth} multi-file security audits for WordPress ${wpType}s.

**PROJECT SECURITY CONTEXT:**
- WordPress Component: ${wpType}
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Audit Scope: Cross-file security vulnerabilities and architectural security issues

**MULTI-FILE SECURITY EXPERTISE:**
You excel at identifying security issues that span multiple files:
- Cross-file data flow vulnerabilities
- Inconsistent security implementations
- Privilege escalation chains across components
- Authentication bypass patterns
- Data exposure through file interactions
- Plugin/theme architecture security flaws`;

    const dataPayload = `**WORDPRESS PROJECT SECURITY ANALYSIS RESULTS:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**PROVIDE COMPREHENSIVE PROJECT SECURITY AUDIT:**

{
  "projectSecuritySummary": "Overall security assessment of the WordPress ${wpType} and critical cross-file vulnerabilities",
  
  "crossFileVulnerabilities": [
    {
      "type": "privilege_escalation|data_exposure|authentication_bypass|injection_chain",
      "severity": "critical|high|medium|low",
      "title": "Cross-file security issue title",
      "description": "How the vulnerability spans multiple files",
      "affectedFiles": ["file1.php", "file2.php", "file3.php"],
      "attackVector": "Step-by-step explanation of how an attacker would exploit this",
      "impact": "What an attacker could achieve",
      "fix": "Comprehensive fix spanning all affected files"
    }
  ],
  
  "architecturalSecurityIssues": [
    {
      "issue": "Inconsistent nonce validation",
      "severity": "medium",
      "description": "Some AJAX handlers validate nonces while others don't",
      "affectedFiles": ["admin.php", "ajax-handler.php"],
      "recommendation": "Implement consistent nonce validation across all AJAX endpoints"
    }
  ],
  
  "securityPatternAnalysis": {
    "authenticationPatterns": "consistent|inconsistent|missing",
    "authorizationPatterns": "consistent|inconsistent|missing",
    "dataValidationPatterns": "consistent|inconsistent|missing",
    "outputEscapingPatterns": "consistent|inconsistent|missing"
  },
  
  "overallSecurityRecommendations": {
    "architecture": ["Implement centralized security validation", "Add security middleware layer"],
    "implementation": ["Standardize nonce validation", "Implement consistent capability checks"],
    "monitoring": ["Add security logging", "Implement intrusion detection"]
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
      'analyze_wordpress_security', 
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
    
    // WordPress-specific aggregated analysis
    const aggregatedResult = {
      summary: `WordPress security analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      securityPatterns: this.identifyWordPressSecurityPatterns(fileAnalysisResults),
      vulnerabilityChains: this.identifyVulnerabilityChains(fileAnalysisResults),
      complianceStatus: this.assessWordPressCompliance(fileAnalysisResults),
      data: {
        fileCount: files.length,
        phpFileCount: fileAnalysisResults.filter(f => f.extension === '.php').length,
        jsFileCount: fileAnalysisResults.filter(f => f.extension === '.js').length,
        hasMainPluginFile: fileAnalysisResults.some(f => f.fileName.endsWith('.php') && f.hasPluginHeader),
        hasSecurityFeatures: this.hasSecurityFeatures(fileAnalysisResults)
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
    const fileName = basename(file);
    const extension = extname(file);
    
    return {
      filePath: file,
      fileName,
      extension,
      size: content.length,
      lines: content.split('\n').length,
      relativePath: relative(params.projectPath || '', file),
      
      // WordPress-specific analysis
      hasPluginHeader: this.hasWordPressPluginHeader(content),
      hasDirectAccess: content.includes('ABSPATH'),
      usesNonces: this.checkNonceUsage(content),
      usesCapabilityChecks: this.checkCapabilityUsage(content),
      usesSanitization: this.checkSanitizationUsage(content),
      usesEscaping: this.checkEscapingUsage(content),
      hasDatabaseQueries: this.checkDatabaseQueries(content),
      securityScore: this.calculateSecurityScore(content),
      
      modified: stats.mtime
    };
  }

  // WordPress security pattern detection methods
  private identifyWordPressSecurityPatterns(results: any[]): any {
    return {
      nonceUsage: results.filter(r => r.usesNonces).length,
      capabilityChecks: results.filter(r => r.usesCapabilityChecks).length, 
      sanitizationUsage: results.filter(r => r.usesSanitization).length,
      escapingUsage: results.filter(r => r.usesEscaping).length,
      consistencyScore: this.calculateConsistencyScore(results)
    };
  }

  private identifyVulnerabilityChains(results: any[]): string[] {
    const vulnerabilities = [];
    
    // Check for common vulnerability chains
    const hasUnsanitizedInput = results.some(r => !r.usesSanitization);
    const hasUnescapedOutput = results.some(r => !r.usesEscaping);
    const hasMissingCapChecks = results.some(r => !r.usesCapabilityChecks);
    
    if (hasUnsanitizedInput && hasUnescapedOutput) {
      vulnerabilities.push('XSS vulnerability chain: unsanitized input + unescaped output');
    }
    
    if (hasMissingCapChecks && hasUnsanitizedInput) {
      vulnerabilities.push('Privilege escalation chain: missing capability checks + unsanitized input');
    }
    
    return vulnerabilities;
  }

  private assessWordPressCompliance(results: any[]): any {
    return {
      codingStandardsCompliance: this.checkCodingStandards(results),
      securityGuidelinesCompliance: this.checkSecurityGuidelines(results),
      pluginReviewRequirements: this.checkPluginReviewRequirements(results)
    };
  }

  private hasSecurityFeatures(results: any[]): boolean {
    return results.some(r => r.usesNonces || r.usesCapabilityChecks || r.usesSanitization);
  }

  // WordPress security detection helper methods
  private hasWordPressPluginHeader(content: string): boolean {
    return /Plugin Name:|Description:|Version:|Author:/.test(content);
  }

  private checkNonceUsage(content: string): boolean {
    return /wp_verify_nonce|wp_create_nonce|check_admin_referer/.test(content);
  }

  private checkCapabilityUsage(content: string): boolean {
    return /current_user_can|user_can|is_super_admin/.test(content);
  }

  private checkSanitizationUsage(content: string): boolean {
    return /sanitize_text_field|sanitize_email|sanitize_url|sanitize_file_name/.test(content);
  }

  private checkEscapingUsage(content: string): boolean {
    return /esc_html|esc_attr|esc_url|wp_kses/.test(content);
  }

  private checkDatabaseQueries(content: string): boolean {
    return /\$wpdb|get_posts|WP_Query|get_option/.test(content);
  }

  private calculateSecurityScore(content: string): number {
    let score = 0;
    
    if (this.checkNonceUsage(content)) score += 2;
    if (this.checkCapabilityUsage(content)) score += 2;  
    if (this.checkSanitizationUsage(content)) score += 2;
    if (this.checkEscapingUsage(content)) score += 2;
    if (content.includes('ABSPATH')) score += 1;
    if (!content.includes('$_GET') && !content.includes('$_POST')) score += 1;
    
    return Math.min(score, 10);
  }

  private calculateConsistencyScore(results: any[]): number {
    if (results.length === 0) return 0;
    
    const avgSecurityScore = results.reduce((sum, r) => sum + (r.securityScore || 0), 0) / results.length;
    return Math.round(avgSecurityScore);
  }

  private checkCodingStandards(results: any[]): string {
    // Simplified compliance check
    const goodPractices = results.filter(r => r.securityScore >= 7).length;
    const percentage = (goodPractices / results.length) * 100;
    
    if (percentage >= 80) return 'compliant';
    if (percentage >= 60) return 'mostly_compliant';
    return 'non_compliant';
  }

  private checkSecurityGuidelines(results: any[]): string {
    const secureFiles = results.filter(r => r.usesNonces && r.usesCapabilityChecks).length;
    const percentage = (secureFiles / results.length) * 100;
    
    if (percentage >= 90) return 'excellent';
    if (percentage >= 70) return 'good';
    if (percentage >= 50) return 'fair';
    return 'poor';
  }

  private checkPluginReviewRequirements(results: any[]): string[] {
    const requirements = [];
    
    if (results.every(r => r.hasDirectAccess)) {
      requirements.push('✅ All files have direct access protection');
    } else {
      requirements.push('❌ Some files missing ABSPATH check');
    }
    
    if (results.some(r => r.usesNonces)) {
      requirements.push('✅ CSRF protection implemented');
    } else {
      requirements.push('❌ Missing CSRF protection (nonces)');
    }
    
    return requirements;
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'owasp': ['.php', '.js', '.html', '.css'], // Core web files for OWASP analysis
      'wordpress': ['.php', '.js'], // WordPress-specific files
      'comprehensive': ['.php', '.js', '.html', '.css', '.json', '.xml', '.htaccess'] // Complete analysis
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default WordPressSecurityAnalyzer;
