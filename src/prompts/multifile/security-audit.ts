/**
 * Multifile Security Audit Plugin
 * Performs comprehensive security audits across entire projects,
 * analyzing data flows, authentication chains, and cross-file vulnerabilities
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname, relative, basename } from 'path';

interface SecurityFile {
  path: string;
  type: 'critical' | 'security-sensitive' | 'config' | 'standard';
  content: string;
  size: number;
  risk: 'high' | 'medium' | 'low';
  purpose: string;
}

interface SecurityIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  files: Array<{
    path: string;
    line: number;
    code?: string;
  }>;
  description: string;
  impact: string;
  recommendation: string;
}

export class MultiFileSecurityAuditor extends BasePlugin implements IPromptPlugin {
  name = 'security_audit';
  category = 'multifile' as const;
  description = 'Perform comprehensive security audit across entire project, analyzing data flows, authentication chains, and cross-file vulnerabilities';
  
  parameters = {
    projectPath: {
      type: 'string' as const,
      description: 'Absolute path to project root directory',
      required: true
    },
    projectType: {
      type: 'string' as const,
      description: 'Project type for specific security checks',
      required: true,
      enum: ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'node-api', 'browser-extension', 'cli-tool', 'n8n-node', 'n8n-workflow', 'html-component', 'generic']
    },
    auditDepth: {
      type: 'string' as const,
      description: 'Depth of security audit',
      required: false,
      enum: ['basic', 'standard', 'comprehensive'],
      default: 'standard'
    },
    includeOwasp: {
      type: 'boolean' as const,
      description: 'Include OWASP Top 10 checks',
      required: false,
      default: true
    },
    includeDependencies: {
      type: 'boolean' as const,
      description: 'Audit dependencies for vulnerabilities',
      required: false,
      default: false
    },
    customChecks: {
      type: 'array' as const,
      description: 'Additional custom security checks',
      required: false,
      items: { type: 'string' as const }
    },
    focusAreas: {
      type: 'array' as const,
      description: 'Specific areas to focus on: authentication, data-flow, input-validation, authorization',
      required: false,
      items: { type: 'string' as const }
    }
  };

  async execute(params: any, llmClient: any) {
    // Validate parameters
    if (!params.projectPath || typeof params.projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }
    
    if (!params.projectType) {
      throw new Error('projectType is required for security audit');
    }
    
    // Validate and resolve project path
    const projectPath = resolve(params.projectPath);
    if (!existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }
    
    if (!statSync(projectPath).isDirectory()) {
      throw new Error(`Project path is not a directory: ${projectPath}`);
    }
    
    // Security check
    if (!this.isPathSafe(projectPath)) {
      throw new Error(`Access denied to path: ${projectPath}`);
    }

    // Find and categorize security-relevant files
    const securityFiles = this.findSecurityRelevantFiles(projectPath, params.projectType);
    
    if (securityFiles.length === 0) {
      throw new Error(`No security-relevant files found in project: ${projectPath}`);
    }

    // Get model for context limit detection
    const models = await llmClient.llm.listLoaded();
    if (models.length === 0) {
      throw new Error('No model loaded in LM Studio. Please load a model first.');
    }
    
    const model = models[0];
    const contextLength = await model.getContextLength() || 23832;
    const availableTokens = Math.floor(contextLength * 0.8) - 2000; // 80% with system overhead

    // Estimate tokens needed
    const estimatedTokens = this.estimateTokensNeeded(securityFiles);
    
    if (estimatedTokens > availableTokens) {
      // Use file chunking for large projects
      return await this.executeWithFileChunking(securityFiles, params, llmClient, model, availableTokens);
    }
    
    // Process all files in single pass
    return await this.executeSinglePass(securityFiles, params, llmClient, model);
  }

  /**
   * Execute security audit in single pass for smaller projects
   */
  private async executeSinglePass(securityFiles: SecurityFile[], params: any, llmClient: any, model: any): Promise<any> {
    // Generate comprehensive security analysis data
    const auditData = await this.performSecurityAnalysis(securityFiles, params);
    
    // Generate 3-stage prompt
    const promptStages = this.getPromptStages({
      ...params,
      securityFiles,
      auditData
    });
    
    try {
      // Get context limit for 3-stage manager
      const contextLength = await model.getContextLength();
      const promptManager = new ThreeStagePromptManager(contextLength || 23832);
      
      // Create chunked conversation
      const conversation = promptManager.createChunkedConversation(promptStages);
      
      // Build messages array for LM Studio
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      // Call the model with 3-stage conversation
      const prediction = model.respond(messages, {
        temperature: 0.1,
        maxTokens: 4000
      });
      
      // Stream the response
      let response = '';
      for await (const chunk of prediction) {
        if (chunk.content) {
          response += chunk.content;
        }
      }
      
      // Use ResponseFactory for consistent output
      ResponseFactory.setStartTime();
      return ResponseFactory.parseAndCreateResponse(
        'security_audit',
        response,
        model.identifier || 'unknown'
      );
      
    } catch (error: any) {
      return ResponseFactory.createErrorResponse(
        'security_audit',
        'MODEL_ERROR',
        `Failed to perform security audit: ${error.message}`,
        { originalError: error.message },
        'unknown'
      );
    }
  }

  /**
   * Execute security audit with file chunking for large projects
   */
  private async executeWithFileChunking(securityFiles: SecurityFile[], params: any, llmClient: any, model: any, availableTokens: number): Promise<any> {
    // Prioritize critical files first
    const sortedFiles = securityFiles.sort((a, b) => {
      const priority = { 'critical': 3, 'security-sensitive': 2, 'config': 1, 'standard': 0 };
      return priority[b.type] - priority[a.type];
    });
    
    // Create chunks based on token estimates
    const fileChunks: SecurityFile[][] = [];
    let currentChunk: SecurityFile[] = [];
    let currentTokens = 0;
    
    for (const file of sortedFiles) {
      const fileTokens = Math.ceil(file.content.length / 4); // Rough token estimate
      
      if (currentTokens + fileTokens > availableTokens && currentChunk.length > 0) {
        fileChunks.push([...currentChunk]);
        currentChunk = [file];
        currentTokens = fileTokens;
      } else {
        currentChunk.push(file);
        currentTokens += fileTokens;
      }
    }
    
    if (currentChunk.length > 0) {
      fileChunks.push(currentChunk);
    }
    
    const chunkResults: any[] = [];
    
    // Process each chunk
    for (let chunkIndex = 0; chunkIndex < fileChunks.length; chunkIndex++) {
      try {
        const chunkFiles = fileChunks[chunkIndex];
        const result = await this.executeSinglePass(chunkFiles, params, llmClient, model);
        
        chunkResults.push({
          chunkIndex,
          fileCount: chunkFiles.length,
          result,
          success: true
        });
      } catch (error) {
        chunkResults.push({
          chunkIndex,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }
    
    // Combine results
    const successfulChunks = chunkResults.filter(r => r.success);
    
    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'security_audit',
      JSON.stringify({
        summary: {
          totalChunks: fileChunks.length,
          successfulChunks: successfulChunks.length,
          totalFiles: securityFiles.length,
          auditScope: 'multifile-chunked'
        },
        results: successfulChunks.map(r => r.result)
      }, null, 2),
      model.identifier || 'unknown'
    );
  }

  /**
   * Find and categorize security-relevant files in the project
   */
  private findSecurityRelevantFiles(projectPath: string, projectType: string): SecurityFile[] {
    const securityFiles: SecurityFile[] = [];
    const maxFiles = 200; // Prevent overwhelming analysis
    
    // Define file patterns based on project type
    const securityPatterns = this.getSecurityFilePatterns(projectType);
    
    const traverse = (dir: string) => {
      if (securityFiles.length >= maxFiles) return;
      
      try {
        const entries = readdirSync(dir);
        
        for (const entry of entries) {
          if (securityFiles.length >= maxFiles) break;
          
          const fullPath = join(dir, entry);
          
          try {
            const stat = statSync(fullPath);
            
            if (stat.isDirectory()) {
              // Skip common non-source directories but include config dirs
              const skipDirs = ['node_modules', '.git', 'vendor', 'dist', 'build', '.next', 'out', 'target', '.idea', '.vscode', '__pycache__', '.pytest_cache'];
              if (!skipDirs.includes(entry)) {
                traverse(fullPath);
              }
            } else if (stat.isFile()) {
              const fileType = this.categorizeSecurityFile(fullPath, entry, projectType, securityPatterns);
              
              if (fileType) {
                try {
                  const content = readFileSync(fullPath, 'utf-8');
                  
                  // Skip very large files (>100KB) to avoid context overflow
                  if (stat.size > 100 * 1024) {
                    continue;
                  }
                  
                  securityFiles.push({
                    path: relative(projectPath, fullPath),
                    type: fileType,
                    content,
                    size: stat.size,
                    risk: this.assessFileRisk(content, fileType, entry),
                    purpose: this.inferFilePurpose(fullPath, entry, projectType)
                  });
                } catch (error) {
                  // Skip files that can't be read
                }
              }
            }
          } catch (error) {
            // Skip files/dirs we can't access
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    traverse(projectPath);
    return securityFiles;
  }

  /**
   * Get security file patterns based on project type
   */
  private getSecurityFilePatterns(projectType: string): any {
    const patterns: Record<string, any> = {
      'wordpress-plugin': {
        critical: [/admin.*\.php$/, /class.*admin.*\.php$/, /.*-admin\.php$/, /functions\.php$/],
        sensitive: [/auth.*\.php$/, /login.*\.php$/, /user.*\.php$/, /.*ajax.*\.php$/],
        config: [/config.*\.php$/, /settings.*\.php$/, /.*\.json$/, /\.env.*$/]
      },
      'wordpress-theme': {
        critical: [/functions\.php$/, /.*-admin\.php$/],
        sensitive: [/auth.*\.php$/, /user.*\.php$/, /comments.*\.php$/],
        config: [/theme\.json$/, /style\.css$/, /\.env.*$/]
      },
      'node-api': {
        critical: [/auth.*\.(js|ts)$/, /middleware.*\.(js|ts)$/, /routes.*\.(js|ts)$/],
        sensitive: [/.*controller.*\.(js|ts)$/, /.*service.*\.(js|ts)$/, /.*model.*\.(js|ts)$/],
        config: [/config.*\.(js|ts|json)$/, /\.env.*$/, /package\.json$/, /.*\.config\.(js|ts)$/]
      },
      'react-app': {
        critical: [/.*auth.*\.(js|jsx|ts|tsx)$/, /.*api.*\.(js|jsx|ts|tsx)$/],
        sensitive: [/.*hook.*\.(js|jsx|ts|tsx)$/, /.*context.*\.(js|jsx|ts|tsx)$/, /.*service.*\.(js|jsx|ts|tsx)$/],
        config: [/\.env.*$/, /package\.json$/, /.*\.config\.(js|ts)$/, /public\/.*\.html$/]
      },
      'react-component': {
        critical: [/.*\.(jsx|tsx)$/],
        sensitive: [/.*hook.*\.(js|jsx|ts|tsx)$/, /.*context.*\.(js|jsx|ts|tsx)$/],
        config: [/package\.json$/, /.*\.config\.(js|ts)$/]
      },
      'generic': {
        critical: [/auth.*\.(js|ts|php|py)$/, /admin.*\.(js|ts|php|py)$/, /login.*\.(js|ts|php|py)$/],
        sensitive: [/.*controller.*/, /.*service.*/, /.*model.*/, /.*api.*/],
        config: [/config.*/, /\.env.*$/, /package\.json$/, /.*\.config\./]
      }
    };

    return patterns[projectType] || patterns.generic;
  }

  /**
   * Categorize a file based on security relevance
   */
  private categorizeSecurityFile(fullPath: string, filename: string, projectType: string, patterns: any): 'critical' | 'security-sensitive' | 'config' | 'standard' | null {
    const ext = extname(filename).toLowerCase();
    const securityExtensions = ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.go', '.rb', '.json', '.env', '.yml', '.yaml', '.xml', '.html'];
    
    if (!securityExtensions.includes(ext) && !filename.startsWith('.env')) {
      return null;
    }
    
    // Check against critical patterns
    if (patterns.critical?.some((pattern: RegExp) => pattern.test(filename))) {
      return 'critical';
    }
    
    // Check against sensitive patterns
    if (patterns.sensitive?.some((pattern: RegExp) => pattern.test(filename))) {
      return 'security-sensitive';
    }
    
    // Check against config patterns
    if (patterns.config?.some((pattern: RegExp) => pattern.test(filename))) {
      return 'config';
    }
    
    // Check content for security keywords
    const securityKeywords = [
      'password', 'auth', 'login', 'token', 'secret', 'key', 'credential',
      'permission', 'role', 'access', 'security', 'encrypt', 'decrypt',
      'sanitize', 'validate', 'escape', 'sql', 'query', 'database'
    ];
    
    const lowerFilename = filename.toLowerCase();
    const hasSecurityKeywords = securityKeywords.some(keyword => lowerFilename.includes(keyword));
    
    if (hasSecurityKeywords) {
      return 'security-sensitive';
    }
    
    // Include all code files as standard for comprehensive audit
    return 'standard';
  }

  /**
   * Assess the risk level of a file based on its content
   */
  private assessFileRisk(content: string, fileType: string, filename: string): 'high' | 'medium' | 'low' {
    const highRiskPatterns = [
      /eval\s*\(/gi,
      /exec\s*\(/gi,
      /system\s*\(/gi,
      /\$_GET\s*\[/gi,
      /\$_POST\s*\[/gi,
      /\$_REQUEST\s*\[/gi,
      /innerHTML\s*=/gi,
      /document\.write/gi,
      /dangerouslySetInnerHTML/gi,
      /password.*=.*['"]/gi,
      /secret.*=.*['"]/gi,
      /api.*key.*=.*['"]/gi
    ];
    
    const highRiskCount = highRiskPatterns.filter(pattern => pattern.test(content)).length;
    
    if (fileType === 'critical' || highRiskCount >= 3) {
      return 'high';
    }
    
    if (fileType === 'security-sensitive' || highRiskCount >= 1) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Infer the purpose of a file for security context
   */
  private inferFilePurpose(fullPath: string, filename: string, projectType: string): string {
    const purposePatterns: Record<string, string> = {
      'auth': 'Authentication & Authorization',
      'login': 'User Login System',
      'admin': 'Administrative Interface',
      'api': 'API Endpoints',
      'controller': 'Request Handler',
      'model': 'Data Model',
      'service': 'Business Logic',
      'middleware': 'Request Processing',
      'config': 'Configuration',
      'route': 'URL Routing',
      'database': 'Database Operations',
      'validation': 'Input Validation',
      'sanitize': 'Data Sanitization',
      'security': 'Security Functions'
    };
    
    const lowerFilename = filename.toLowerCase();
    
    for (const [keyword, purpose] of Object.entries(purposePatterns)) {
      if (lowerFilename.includes(keyword)) {
        return purpose;
      }
    }
    
    if (filename.includes('.env')) return 'Environment Configuration';
    if (filename === 'package.json') return 'Dependency Configuration';
    if (filename.endsWith('.json')) return 'Configuration File';
    
    return 'Application Logic';
  }

  /**
   * Perform comprehensive security analysis on files
   */
  private async performSecurityAnalysis(securityFiles: SecurityFile[], params: any): Promise<any> {
    const { projectType, auditDepth = 'standard' } = params;
    
    // Analyze data flows between files
    const dataFlows = this.analyzeDataFlows(securityFiles);
    
    // Find authentication/authorization chains
    const authChains = this.findAuthenticationChains(securityFiles, projectType);
    
    // Identify potential vulnerabilities
    const vulnerabilities = this.identifyVulnerabilities(securityFiles, projectType, auditDepth);
    
    // Check configuration security
    const configSecurity = this.checkConfigurationSecurity(securityFiles, projectType);
    
    return {
      dataFlows,
      authChains,
      vulnerabilities,
      configSecurity,
      filesSummary: {
        critical: securityFiles.filter(f => f.type === 'critical').length,
        sensitive: securityFiles.filter(f => f.type === 'security-sensitive').length,
        config: securityFiles.filter(f => f.type === 'config').length,
        total: securityFiles.length
      }
    };
  }

  /**
   * Analyze data flows between files for security assessment
   */
  private analyzeDataFlows(securityFiles: SecurityFile[]): any {
    const flows: any[] = [];
    
    // Look for data movement patterns
    securityFiles.forEach(file => {
      // Find inputs (GET, POST, user input)
      const inputs = this.findInputSources(file.content);
      
      // Find outputs (database, responses, files)
      const outputs = this.findOutputSinks(file.content);
      
      if (inputs.length > 0 || outputs.length > 0) {
        flows.push({
          file: file.path,
          purpose: file.purpose,
          risk: file.risk,
          inputs,
          outputs
        });
      }
    });
    
    return flows;
  }

  /**
   * Find input sources in file content
   */
  private findInputSources(content: string): string[] {
    const inputPatterns = [
      { pattern: /\$_GET\s*\[/g, type: 'GET parameter' },
      { pattern: /\$_POST\s*\[/g, type: 'POST parameter' },
      { pattern: /\$_REQUEST\s*\[/g, type: 'REQUEST parameter' },
      { pattern: /req\.params/g, type: 'Route parameter' },
      { pattern: /req\.body/g, type: 'Request body' },
      { pattern: /req\.query/g, type: 'Query parameter' },
      { pattern: /useState/g, type: 'React state' },
      { pattern: /props\./g, type: 'Component props' }
    ];
    
    const found: string[] = [];
    inputPatterns.forEach(({ pattern, type }) => {
      if (pattern.test(content)) {
        found.push(type);
      }
    });
    
    return found;
  }

  /**
   * Find output sinks in file content
   */
  private findOutputSinks(content: string): string[] {
    const outputPatterns = [
      { pattern: /\$wpdb->(query|get_results|prepare)/g, type: 'Database query' },
      { pattern: /SELECT\s+.*FROM/gi, type: 'SQL query' },
      { pattern: /INSERT\s+INTO/gi, type: 'Database insert' },
      { pattern: /UPDATE\s+.*SET/gi, type: 'Database update' },
      { pattern: /res\.send|res\.json/g, type: 'HTTP response' },
      { pattern: /echo\s+|print\s+/g, type: 'Direct output' },
      { pattern: /innerHTML\s*=/g, type: 'DOM manipulation' },
      { pattern: /document\.write/g, type: 'Document write' }
    ];
    
    const found: string[] = [];
    outputPatterns.forEach(({ pattern, type }) => {
      if (pattern.test(content)) {
        found.push(type);
      }
    });
    
    return found;
  }

  /**
   * Find authentication chains across files
   */
  private findAuthenticationChains(securityFiles: SecurityFile[], projectType: string): any {
    const authFiles = securityFiles.filter(f => 
      f.purpose.includes('Auth') || 
      f.path.includes('auth') || 
      f.content.includes('password') || 
      f.content.includes('login')
    );
    
    return {
      authenticationFiles: authFiles.map(f => ({
        path: f.path,
        purpose: f.purpose,
        risk: f.risk,
        hasPasswordHandling: f.content.includes('password'),
        hasTokenHandling: f.content.includes('token'),
        hasSessionHandling: f.content.includes('session'),
        hasEncryption: /encrypt|hash|bcrypt|password_hash/.test(f.content)
      })),
      patterns: this.getAuthPatterns(projectType)
    };
  }

  /**
   * Get authentication patterns for specific project types
   */
  private getAuthPatterns(projectType: string): string[] {
    const patterns: Record<string, string[]> = {
      'wordpress-plugin': ['wp_verify_nonce', 'current_user_can', 'wp_login', 'wp_authenticate'],
      'wordpress-theme': ['wp_verify_nonce', 'current_user_can', 'is_user_logged_in'],
      'node-api': ['passport', 'jwt', 'bcrypt', 'session', 'authenticate'],
      'react-app': ['useAuth', 'AuthContext', 'login', 'logout', 'token'],
      'generic': ['auth', 'login', 'password', 'token', 'session']
    };
    
    return patterns[projectType] || patterns.generic;
  }

  /**
   * Identify potential vulnerabilities across files
   */
  private identifyVulnerabilities(securityFiles: SecurityFile[], projectType: string, auditDepth: string): SecurityIssue[] {
    const vulnerabilities: SecurityIssue[] = [];
    
    securityFiles.forEach(file => {
      // Check for SQL injection
      if (this.checkSQLInjection(file.content)) {
        vulnerabilities.push({
          type: 'SQL Injection',
          severity: 'critical',
          files: [{ path: file.path, line: 0 }],
          description: 'Potential SQL injection vulnerability found',
          impact: 'Data breach, unauthorized database access',
          recommendation: 'Use parameterized queries or prepared statements'
        });
      }
      
      // Check for XSS
      if (this.checkXSS(file.content)) {
        vulnerabilities.push({
          type: 'Cross-Site Scripting (XSS)',
          severity: 'high',
          files: [{ path: file.path, line: 0 }],
          description: 'Potential XSS vulnerability found',
          impact: 'Script injection, session hijacking',
          recommendation: 'Sanitize and escape all user inputs'
        });
      }
      
      // Add more vulnerability checks based on audit depth
      if (auditDepth !== 'basic') {
        // Additional checks for standard/comprehensive
      }
    });
    
    return vulnerabilities;
  }

  /**
   * Check for SQL injection vulnerabilities
   */
  private checkSQLInjection(content: string): boolean {
    const sqlInjectionPatterns = [
      /\$_GET\s*\[.*\]\s*\)/,
      /\$_POST\s*\[.*\]\s*\)/,
      /query\s*\(\s*['"]\s*SELECT.*\$_/gi,
      /"\s*\.\s*\$_[GET|POST]/gi
    ];
    
    return sqlInjectionPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check for XSS vulnerabilities
   */
  private checkXSS(content: string): boolean {
    const xssPatterns = [
      /innerHTML\s*=\s*.*\$_/gi,
      /echo\s+\$_[GET|POST]/gi,
      /document\.write\s*\(.*\$_/gi,
      /dangerouslySetInnerHTML.*\$_/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check configuration security
   */
  private checkConfigurationSecurity(securityFiles: SecurityFile[], projectType: string): any {
    const configFiles = securityFiles.filter(f => f.type === 'config');
    const issues: string[] = [];
    
    configFiles.forEach(file => {
      // Check for hardcoded secrets
      if (/password\s*=\s*["'].*["']/gi.test(file.content)) {
        issues.push(`Hardcoded password in ${file.path}`);
      }
      
      if (/api.*key\s*=\s*["'].*["']/gi.test(file.content)) {
        issues.push(`Hardcoded API key in ${file.path}`);
      }
      
      if (/secret\s*=\s*["'].*["']/gi.test(file.content)) {
        issues.push(`Hardcoded secret in ${file.path}`);
      }
    });
    
    return {
      configFiles: configFiles.map(f => f.path),
      securityIssues: issues,
      recommendations: this.getConfigRecommendations(projectType)
    };
  }

  /**
   * Get configuration security recommendations
   */
  private getConfigRecommendations(projectType: string): string[] {
    const recommendations: Record<string, string[]> = {
      'wordpress-plugin': [
        'Use WordPress constants for configuration',
        'Store sensitive data in wp-config.php',
        'Use nonces for form validation',
        'Sanitize all options on save'
      ],
      'node-api': [
        'Use environment variables for secrets',
        'Implement proper CORS configuration',
        'Use HTTPS for all communications',
        'Implement rate limiting'
      ],
      'react-app': [
        'Keep API keys on server side only',
        'Use environment variables for configuration',
        'Implement Content Security Policy',
        'Validate all props and state'
      ],
      'generic': [
        'Use environment variables for sensitive data',
        'Implement proper access controls',
        'Keep configuration files secure',
        'Regular security updates'
      ]
    };
    
    return recommendations[projectType] || recommendations.generic;
  }

  /**
   * Estimate tokens needed for processing
   */
  private estimateTokensNeeded(securityFiles: SecurityFile[]): number {
    const contentTokens = securityFiles.reduce((sum, file) => sum + Math.ceil(file.content.length / 4), 0);
    const systemOverhead = 3000;
    const analysisOverhead = 2000;
    
    return contentTokens + systemOverhead + analysisOverhead;
  }

  /**
   * Generate 3-stage prompt for security audit
   */
  getPromptStages(params: any): PromptStages {
    const { projectType, auditDepth, includeOwasp, securityFiles, auditData } = params;
    
    // STAGE 1: System instructions and context
    const systemAndContext = `You are a cybersecurity expert conducting a comprehensive security audit.

Project Security Audit Context:
- Project Type: ${projectType}
- Audit Depth: ${auditDepth}
- OWASP Analysis: ${includeOwasp ? 'Enabled' : 'Disabled'}
- Total Files Analyzed: ${securityFiles.length}
- Critical Files: ${auditData.filesSummary.critical}
- Security-Sensitive Files: ${auditData.filesSummary.sensitive}
- Configuration Files: ${auditData.filesSummary.config}

Focus Areas:
${this.getSecurityFocusAreas(projectType, auditDepth)}`;

    // STAGE 2: Security audit data
    let dataPayload = '';
    
    // File analysis summary
    dataPayload += '\n=== SECURITY FILE ANALYSIS ===\n';
    securityFiles.forEach(file => {
      dataPayload += `\nFile: ${file.path} [${file.type}] [${file.risk} risk]\n`;
      dataPayload += `Purpose: ${file.purpose}\n`;
      dataPayload += `Size: ${Math.ceil(file.size / 1024)}KB\n`;
      dataPayload += `Content:\n${file.content.substring(0, 2000)}${file.content.length > 2000 ? '...[truncated]' : ''}\n`;
      dataPayload += '-'.repeat(80) + '\n';
    });
    
    // Data flow analysis
    dataPayload += '\n=== DATA FLOW ANALYSIS ===\n';
    dataPayload += JSON.stringify(auditData.dataFlows, null, 2);
    
    // Authentication chains
    dataPayload += '\n=== AUTHENTICATION ANALYSIS ===\n';
    dataPayload += JSON.stringify(auditData.authChains, null, 2);
    
    // Vulnerabilities
    if (auditData.vulnerabilities.length > 0) {
      dataPayload += '\n=== VULNERABILITY ANALYSIS ===\n';
      dataPayload += JSON.stringify(auditData.vulnerabilities, null, 2);
    }
    
    // Configuration security
    dataPayload += '\n=== CONFIGURATION SECURITY ===\n';
    dataPayload += JSON.stringify(auditData.configSecurity, null, 2);

    // STAGE 3: Analysis instructions
    const outputInstructions = `COMPREHENSIVE SECURITY AUDIT ANALYSIS

Analyze the entire project for security vulnerabilities and provide actionable recommendations.

## Required Analysis Sections:

### 1. Executive Summary
- Overall security posture (Critical/High/Medium/Low risk)
- Total vulnerabilities found by severity
- Most critical issues requiring immediate attention
- Compliance status with industry standards

### 2. Cross-File Security Analysis
- **Data Flow Security**: Trace user input through the application
- **Authentication Chain**: Analyze complete auth workflows
- **Authorization Consistency**: Check access control across files
- **Input Validation Coverage**: Identify validation gaps
- **Output Encoding**: Check for XSS prevention

### 3. Vulnerability Assessment
For each vulnerability found:
- **Type**: Specific vulnerability (SQL Injection, XSS, etc.)
- **Severity**: Critical/High/Medium/Low
- **Location**: File(s) and line numbers
- **Impact**: What could happen if exploited
- **Evidence**: Code snippets showing the issue
- **Fix**: Specific remediation steps with code examples

### 4. Architecture Security Review
- **Security Patterns**: Good practices already in use
- **Anti-patterns**: Problematic code patterns
- **Missing Controls**: Security measures not implemented
- **Configuration Issues**: Insecure settings or exposed secrets

### 5. ${projectType} Specific Analysis
${this.getProjectSpecificSecurityChecklist(projectType)}

### 6. Compliance Assessment
${includeOwasp ? '- **OWASP Top 10 Compliance**: Status against each category' : ''}
- **Industry Standards**: Relevant compliance requirements
- **Framework Security**: Adherence to framework security guidelines
- **Best Practices**: Alignment with security best practices

### 7. Remediation Roadmap
#### Immediate Actions (Critical/High)
- List vulnerabilities requiring immediate fixes
- Provide specific code changes
- Include security testing steps

#### Medium-Term Improvements
- Security enhancements for better defence
- Code refactoring for security
- Additional security controls

#### Long-Term Strategy
- Security training recommendations
- Security tooling integration
- Ongoing security practices

### 8. Security Testing Recommendations
- Unit tests for security functions
- Integration tests for auth flows
- Penetration testing areas
- Automated security scanning

## Output Format Requirements:
- Use markdown formatting for readability
- Include code snippets with proper syntax highlighting
- Provide severity ratings for all findings
- Include line numbers where issues are found
- Give specific, actionable recommendations
- Prioritize findings by risk and effort to fix

Provide a thorough, professional security audit report that development teams can immediately act upon.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }

  /**
   * Get security focus areas for project type and audit depth
   */
  private getSecurityFocusAreas(projectType: string, auditDepth: string): string {
    const focusAreas: Record<string, Record<string, string[]>> = {
      'wordpress-plugin': {
        'basic': ['Nonce validation', 'Capability checks', 'Input sanitization'],
        'standard': ['SQL injection prevention', 'XSS protection', 'CSRF protection', 'File upload security'],
        'comprehensive': ['Admin interface security', 'AJAX security', 'Database security', 'Plugin interactions', 'Multisite compatibility']
      },
      'node-api': {
        'basic': ['Input validation', 'Authentication', 'Basic authorization'],
        'standard': ['JWT security', 'Database security', 'CORS configuration', 'Rate limiting'],
        'comprehensive': ['Advanced auth patterns', 'API security', 'Dependency vulnerabilities', 'Infrastructure security']
      },
      'react-app': {
        'basic': ['XSS prevention', 'Component security', 'Props validation'],
        'standard': ['Authentication flows', 'State management security', 'API integration security'],
        'comprehensive': ['Advanced React patterns', 'Bundle security', 'CSP implementation', 'Third-party integrations']
      }
    };
    
    const areas = focusAreas[projectType]?.[auditDepth] || ['Input validation', 'Output encoding', 'Authentication', 'Authorization'];
    return areas.map(area => `- ${area}`).join('\n');
  }

  /**
   * Get project-specific security checklist
   */
  private getProjectSpecificSecurityChecklist(projectType: string): string {
    const checklists: Record<string, string> = {
      'wordpress-plugin': `
- **WordPress Security Standards**:
  - Nonce verification on all state-changing operations
  - Capability checks for privileged functions
  - Proper use of $wpdb->prepare() for database queries
  - Output escaping with esc_html(), esc_attr(), etc.
  - Secure file handling and uploads
  - Option validation and sanitization`,

      'node-api': `
- **Node.js API Security**:
  - Express security middleware configuration
  - JWT token security and refresh strategies
  - Database query parameterization
  - CORS policy validation
  - Rate limiting implementation
  - Environment variable security`,

      'react-app': `
- **React Application Security**:
  - Component prop validation and sanitization
  - Secure state management practices
  - XSS prevention in JSX rendering
  - Secure routing and navigation
  - Third-party library security
  - Build process security`,

      'generic': `
- **General Security Principles**:
  - Input validation and sanitization
  - Output encoding and escaping
  - Authentication and session management
  - Authorization and access control
  - Error handling without information disclosure
  - Secure configuration management`
    };

    return checklists[projectType] || checklists.generic;
  }

  /**
   * BasePlugin compatibility method
   */
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }

  /**
   * Security path validation
   */
  private isPathSafe(path: string): boolean {
    const suspicious = ['../', '..\\', '/etc/', '\\etc\\', '/root/', '\\root\\', '/sys/', '\\sys\\'];
    const normalizedPath = path.toLowerCase();
    
    return !suspicious.some(pattern => normalizedPath.includes(pattern));
  }
}

export default MultiFileSecurityAuditor;