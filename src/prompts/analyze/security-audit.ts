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

export class SecurityAuditor extends BasePlugin implements IPromptPlugin {
  name = 'security_audit';
  category = 'analyze' as const;
  description = 'Perform comprehensive security audit across entire project, analyzing data flows, authentication chains, and cross-file vulnerabilities with OWASP compliance checking';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'The code to analyze for security issues (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single file to analyze for security vulnerabilities',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Absolute path to project root directory',
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
      default: 4
    },
    
    // Security-specific parameters
    projectType: {
      type: 'string' as const,
      description: 'Project type for specific security checks',
      required: false,
      enum: ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'node-api', 'browser-extension', 'cli-tool', 'n8n-node', 'n8n-workflow', 'html-component', 'generic'],
      default: 'generic'
    },
    auditDepth: {
      type: 'string' as const,
      description: 'Depth of security audit',
      enum: ['basic', 'standard', 'comprehensive'],
      default: 'standard',
      required: false
    },
    includeOwasp: {
      type: 'boolean' as const,
      description: 'Include OWASP Top 10 checks',
      required: false,
      default: true
    },
    focusAreas: {
      type: 'array' as const,
      description: 'Specific areas to focus on: authentication, data-flow, input-validation, authorization',
      required: false,
      items: { type: 'string' as const }
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
      enum: ['security', 'owasp', 'comprehensive'],
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
        return ErrorHandler.createExecutionError('security_audit', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file indicators (check these first)
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default to multi-file for project security audits
    return 'multi-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      // For single-file, we need either code OR filePath
      if (!params.code && !params.filePath) {
        throw new Error('Either code or filePath must be provided for single-file analysis');
      }
    } else {
      // For multi-file, we need either projectPath OR files array
      if (!params.projectPath && !params.files) {
        throw new Error('Either projectPath or files array must be provided');
      }
      ParameterValidator.validateDepth(params);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['security', 'owasp', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'projectType', ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'node-api', 'browser-extension', 'cli-tool', 'n8n-node', 'n8n-workflow', 'html-component', 'generic']);
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
        'security_audit',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'security_audit'
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
        params.projectType
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
      'security_audit',
      'multifile'
    );
  }

  /**
   * Implement single-file security audit prompt stages
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, projectType, includeOwasp, focusAreas } = params;
    
    const systemAndContext = `You are a senior cybersecurity expert with 15+ years of experience in application security, penetration testing, and secure code review. You specialize in identifying vulnerabilities across all major programming languages and frameworks.

**YOUR EXPERTISE:**
- OWASP Top 10 vulnerabilities and mitigation strategies
- Cross-site scripting (XSS), SQL injection, and injection attack vectors
- Authentication bypass and authorization flaws
- Cryptographic failures and insecure data storage
- Security misconfigurations and exposed components
- Modern framework security patterns (React, Node.js, PHP, etc.)
- Static code analysis and dynamic security testing
- Compliance with security standards (NIST, ISO 27001, PCI DSS)

**ANALYSIS CONTEXT:**
- Programming Language: ${language}
- Project Type: ${projectType}
- Analysis Depth: ${analysisDepth}
- OWASP Analysis: ${includeOwasp ? 'ENABLED - Include OWASP Top 10 checks' : 'DISABLED'}
- Focus Areas: ${focusAreas?.length > 0 ? focusAreas.join(', ') : 'All security domains'}
- Mode: Single File Security Analysis

**SECURITY ASSESSMENT METHODOLOGY:**
1. **Static Code Analysis**: Examine code patterns for known vulnerability signatures
2. **Data Flow Analysis**: Trace user input from entry points through processing
3. **Authentication/Authorization**: Verify access controls and privilege escalation risks  
4. **Input Validation**: Check for sanitization and validation of all user inputs
5. **Output Encoding**: Ensure proper encoding prevents XSS and injection attacks
6. **Cryptographic Review**: Assess encryption, hashing, and key management practices
7. **Configuration Security**: Review security-relevant configuration and defaults
8. **Business Logic Flaws**: Identify application-specific security weaknesses

Your task is to perform a comprehensive security audit of this individual file, identifying vulnerabilities with precise locations, assessing their severity, and providing actionable remediation guidance.`;

    const dataPayload = `**SECURITY AUDIT TARGET:**

File: ${params.filePath || 'Inline Code'}
Language: ${language}
Project Type: ${projectType}

**SOURCE CODE TO AUDIT:**

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `**PROVIDE COMPREHENSIVE SECURITY AUDIT REPORT:**

Your analysis must be thorough, actionable, and prioritized by business risk. Focus on real vulnerabilities that could be exploited, not theoretical concerns.

**EXECUTIVE SUMMARY:**
Begin with an overall assessment including:
- **Overall Risk Level**: Critical, High, Medium, or Low
- **Total Vulnerabilities Found**: Count by severity (critical, high, medium, low)
- **Most Critical Issue**: Brief description of the most severe vulnerability
- **OWASP Compliance Status**: How well the code follows OWASP Top 10 guidelines
- **Business Impact**: What these vulnerabilities mean for the organization

**DETAILED VULNERABILITY ASSESSMENT:**
For EACH vulnerability found, provide a comprehensive analysis:

**Vulnerability Analysis Format:**
- **Vulnerability Name & Type**: Clear, descriptive name of the security issue
- **Severity Level**: CRITICAL, HIGH, MEDIUM, or LOW with justification
- **OWASP Category**: Reference to OWASP Top 10 category if applicable (A01-A10)
- **Location Details**: Specific line numbers, functions, or code sections affected
- **Vulnerable Code**: Show the exact problematic code snippet
- **Attack Vector**: Detailed explanation of how an attacker would exploit this
- **Impact Assessment**: What happens if successfully exploited (data loss, access, etc.)
- **Proof of Concept**: Example exploit code or attack payload demonstrating the vulnerability
- **Fix Implementation**: Specific code changes needed with secure implementation examples
- **Prevention Strategy**: Long-term approaches to prevent similar issues

**SECURITY STRENGTHS ASSESSMENT:**
Highlight positive security practices found:
- **Good Practices Identified**: Security measures already implemented correctly
- **Framework Security Features**: Built-in security features being used appropriately  
- **Defense in Depth**: Multiple security layers and their effectiveness
- **Code Quality**: Security-aware coding practices being followed

**RISK-PRIORITIZED ACTION PLAN:**
Organize remediation by urgency and impact:

**IMMEDIATE ACTIONS** (Fix within 24 hours):
- Critical and high severity vulnerabilities that pose immediate risk
- Specific steps for emergency patching

**SHORT-TERM IMPROVEMENTS** (Fix within 1 week):
- Medium severity issues and important security enhancements
- Implementation timeline and resource requirements

**LONG-TERM ENHANCEMENTS** (Address in next development cycle):
- Low severity items and architectural security improvements
- Strategic security initiatives and process improvements

**SECURE CODE EXAMPLES:**
Provide practical, working code examples demonstrating:
- **Input Validation**: Proper techniques for validating and sanitizing user input
- **Output Encoding**: Methods to prevent XSS and injection attacks
- **Authentication Patterns**: Secure authentication and session management
- **Database Security**: Parameterized queries and database access controls
- **Error Handling**: Secure error handling that doesn't leak information
- **Access Controls**: Proper authorization and privilege checking

**IMPLEMENTATION GUIDANCE:**
- **Priority Matrix**: Risk vs. effort assessment for each recommendation
- **Dependencies**: Issues that must be fixed together or in sequence
- **Testing Strategy**: How to verify fixes without breaking functionality
- **Monitoring**: What to monitor after implementing security fixes

**COMPLIANCE & STANDARDS:**
- **Industry Standards**: Alignment with relevant security standards
- **Regulatory Requirements**: Compliance with applicable regulations
- **Best Practices**: Industry best practices being followed or needed

**CRITICAL REQUIREMENTS:**
- Every vulnerability MUST include precise line numbers where possible
- Every fix MUST include working, tested code examples
- Focus on exploitable vulnerabilities that pose real business risk
- Prioritize recommendations by likelihood and impact of exploitation
- Include specific attack scenarios that clearly demonstrate each vulnerability
- Provide actionable steps that development teams can implement immediately

Be comprehensive but practical - focus on security issues that matter most to the business and can be realistically addressed by the development team.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement multi-file security audit prompt stages
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, projectType, auditDepth, includeOwasp, fileCount, focusAreas } = params;
    
    const systemAndContext = `You are a senior cybersecurity expert and application security architect with 15+ years of experience in enterprise security audits. You specialize in comprehensive cross-file security analysis and identifying complex attack vectors that span multiple components.

**YOUR EXPERTISE:**
- Multi-tier application security architecture review
- Cross-component vulnerability analysis and attack chain identification  
- Data flow security analysis across entire applications
- Authentication and authorization workflow security
- API security and microservices security patterns
- DevSecOps and secure development lifecycle implementation
- Enterprise compliance (SOX, HIPAA, PCI DSS, GDPR)
- Advanced persistent threat (APT) defense strategies

**PROJECT SECURITY AUDIT CONTEXT:**
- Project Type: ${projectType}
- Audit Depth: ${auditDepth}
- Files Analyzed: ${fileCount}
- OWASP Analysis: ${includeOwasp ? 'ENABLED - Full OWASP Top 10 coverage' : 'DISABLED'}
- Focus Areas: ${focusAreas?.length > 0 ? focusAreas.join(', ') : 'Comprehensive security domains'}
- Mode: Multi-File Cross-Component Security Analysis

**MULTI-FILE SECURITY METHODOLOGY:**
1. **Attack Surface Mapping**: Identify all entry points and data flow paths
2. **Cross-File Data Flow Analysis**: Trace user input through entire application
3. **Authentication Chain Analysis**: Review complete auth/authz workflows
4. **Privilege Escalation Assessment**: Find vertical and horizontal privilege issues
5. **Business Logic Security**: Identify workflow and process vulnerabilities
6. **Configuration Drift Analysis**: Find security misconfigurations across components
7. **Supply Chain Security**: Assess dependencies and third-party component risks
8. **Architectural Security Patterns**: Evaluate security design patterns and anti-patterns

Your task is to perform a comprehensive enterprise-grade security audit across all files, focusing on cross-component vulnerabilities, attack chains, and systemic security weaknesses that could compromise the entire application.`;

    const dataPayload = `**COMPREHENSIVE PROJECT SECURITY AUDIT DATA:**

Project Type: ${projectType}
Total Files Analyzed: ${fileCount}
Analysis Scope: ${auditDepth} depth review

**CROSS-FILE ANALYSIS RESULTS:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**PROVIDE ENTERPRISE-GRADE MULTI-FILE SECURITY AUDIT:**

Your analysis must identify systemic vulnerabilities, attack chains spanning multiple files, and architectural security flaws. Focus on risks that could lead to complete system compromise.

**ENTERPRISE-GRADE MULTI-FILE SECURITY ASSESSMENT:**

**EXECUTIVE SUMMARY:**
- **Overall Security Posture**: Critical, High, Medium, or Low assessment
- **Business Risk Rating**: Extreme, High, Moderate, or Low business impact
- **Total Security Findings**: Count of systemic vulnerabilities, cross-file issues, configuration flaws, and architectural weaknesses  
- **Critical Attack Chains**: Description of the most dangerous attack paths that span multiple files
- **Compliance Gaps**: OWASP Top 10 or other compliance issues identified
- **Business Impact**: Potential impact on business operations, data, and reputation

**CROSS-FILE ATTACK CHAIN ANALYSIS:**
For each attack chain that spans multiple files, provide:

**Attack Chain Analysis Format:**
- **Attack Chain Name & Severity**: Descriptive name and Critical/High/Medium/Low rating
- **Attack Path Flow**: File A → File B → File C → Complete System Compromise
- **Entry Point Details**: Specific file, function, and line where the attack begins  
- **Exploitation Flow**: Step-by-step progression of how the attack moves through files
- **Files Involved**: Complete list of all files that participate in this attack chain
- **Business Function Impact**: What critical business function gets compromised
- **Complete Exploit Scenario**: Full working proof-of-concept demonstrating the attack
- **Systemic Fix Strategy**: Architectural changes needed across all involved files
- **Detection & Monitoring**: How to monitor for this attack pattern in production

**DATA FLOW SECURITY ANALYSIS:**
- **User Input Entry Points**: Comprehensive mapping of all places user data enters the system
- **Data Processing Chain**: How user data flows through components and transformations
- **Validation Gaps**: Where input validation is missing, insufficient, or inconsistently applied
- **Output Vulnerabilities**: Where unencoded data reaches outputs and could cause XSS/injection
- **Data Leakage Risks**: Where sensitive data could be inadvertently exposed or logged

**AUTHENTICATION & AUTHORIZATION ARCHITECTURE REVIEW:**
- **Authentication Flow Analysis**: Complete auth workflow security across all components
- **Session Management**: Session creation, validation, termination, and storage security
- **Authorization Consistency**: Access control implementation across all system components  
- **Privilege Escalation Risks**: Both horizontal and vertical privilege escalation opportunities
- **Account Management**: User creation, deletion, role management, and password security

### 5. Configuration Security Assessment  
- **Security Misconfigurations**: Dangerous default settings and configurations
- **Environment Inconsistencies**: Security settings that vary between environments
- **Secrets Management**: How API keys, passwords, and tokens are handled
- **Infrastructure Security**: Server, database, and service configurations

### 6. Architectural Security Review
- **Security Patterns in Use**: Well-implemented security patterns
- **Security Anti-Patterns**: Problematic code patterns across the codebase
- **Defense in Depth Analysis**: Multiple security layer effectiveness
- **Single Points of Failure**: Where security relies on single mechanisms

### 7. Risk-Prioritized Remediation Roadmap
**IMMEDIATE CRITICAL FIXES (24-48 hours):**
- [Issues that could lead to immediate system compromise]

**HIGH PRIORITY (1-2 weeks):**  
- [Cross-file vulnerabilities and architectural flaws]

**MEDIUM PRIORITY (1 month):**
- [Configuration improvements and security hardening]

**STRATEGIC SECURITY IMPROVEMENTS (3-6 months):**
- [Architectural security enhancements and process improvements]

### 8. Implementation Guidance
- **Secure Development Standards**: Code standards to prevent similar issues
- **Security Testing Strategy**: How to test for these vulnerability classes
- **Monitoring and Detection**: Security monitoring for ongoing protection
- **Developer Training Needs**: Skills gaps identified during the audit

**ENTERPRISE AUDIT REQUIREMENTS:**
- Focus on business-critical attack scenarios
- Provide complete attack chains with proof-of-concept
- Include compliance mapping to relevant standards
- Emphasize systemic fixes over isolated patches
- Consider threat modeling and attacker motivations
- Address security at architectural and implementation levels`;

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
    projectType: string
  ): Promise<string[]> {
    const extensions = this.getFileExtensions(projectType);
    return await this.multiFileAnalysis.discoverFiles(projectPath, extensions, maxDepth);
  }

  private async performMultiFileAnalysis(
    files: string[],
    params: any,
    model: any,
    contextLength: number
  ): Promise<any> {
    const cacheKey = this.analysisCache.generateKey(
      'security_audit', 
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
    
    // Aggregate results into comprehensive security analysis
    const aggregatedResult = {
      summary: `Multi-file security audit of ${files.length} files`,
      findings: fileAnalysisResults,
      securityAssessment: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        riskDistribution: this.categorizeFilesByRisk(fileAnalysisResults),
        criticalFiles: fileAnalysisResults.filter((result: any) => result.riskLevel === 'high'),
        dataFlowAnalysis: this.analyzeDataFlows(fileAnalysisResults),
        authenticationChain: this.analyzeAuthChain(fileAnalysisResults, params.projectType),
        configurationSecurity: this.analyzeConfigurations(fileAnalysisResults)
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
      riskLevel: this.assessFileRisk(content, file, params.projectType),
      securityPatterns: this.identifySecurityPatterns(content, file),
      vulnerabilityIndicators: this.scanForVulnerabilities(content),
      modified: stats.mtime
    };
  }

  private getFileExtensions(projectType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'wordpress-plugin': ['.php', '.js', '.json', '.css', '.html'],
      'wordpress-theme': ['.php', '.js', '.css', '.html', '.json'],
      'react-app': ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css'],
      'react-component': ['.js', '.jsx', '.ts', '.tsx', '.css'],
      'node-api': ['.js', '.ts', '.json', '.yaml', '.yml', '.env'],
      'browser-extension': ['.js', '.json', '.html', '.css', '.xml'],
      'cli-tool': ['.js', '.ts', '.py', '.sh', '.json'],
      'n8n-node': ['.ts', '.js', '.json'],
      'n8n-workflow': ['.json'],
      'html-component': ['.html', '.js', '.css', '.json'],
      'generic': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.h', '.html', '.css', '.json', '.xml', '.yml', '.yaml', '.env', '.config', '.ini']
    };
    
    return extensionMap[projectType] || extensionMap.generic;
  }

  private categorizeFilesByRisk(results: any[]): Record<string, number> {
    const riskCategories: Record<string, number> = { high: 0, medium: 0, low: 0 };
    results.forEach(result => {
      riskCategories[result.riskLevel] = (riskCategories[result.riskLevel] || 0) + 1;
    });
    return riskCategories;
  }

  private analyzeDataFlows(results: any[]): any {
    // Analyze how data flows between files
    return {
      entryPoints: results.filter(r => r.securityPatterns?.includes('user-input')).length,
      processingFiles: results.filter(r => r.securityPatterns?.includes('data-processing')).length,
      outputFiles: results.filter(r => r.securityPatterns?.includes('output-generation')).length,
      dataFlowRisks: 'Cross-file data flow analysis would be performed here'
    };
  }

  private analyzeAuthChain(results: any[], projectType: string): any {
    // Analyze authentication and authorization chains
    return {
      authFiles: results.filter(r => r.filePath.toLowerCase().includes('auth')).length,
      loginFiles: results.filter(r => r.filePath.toLowerCase().includes('login')).length,
      adminFiles: results.filter(r => r.filePath.toLowerCase().includes('admin')).length,
      authChainAnalysis: 'Authentication chain analysis would be performed here'
    };
  }

  private analyzeConfigurations(results: any[]): any {
    // Analyze configuration security
    const configFiles = results.filter(r => 
      r.extension === 'json' || 
      r.extension === 'env' || 
      r.filePath.includes('config')
    );
    
    return {
      configFileCount: configFiles.length,
      configurationRisks: 'Configuration security analysis would be performed here',
      configFiles: configFiles.map(f => f.filePath)
    };
  }

  private assessFileRisk(content: string, filePath: string, projectType: string): 'high' | 'medium' | 'low' {
    // Assess individual file risk based on content patterns
    const riskPatterns = {
      high: [/eval\s*\(/i, /exec\s*\(/i, /\$_GET\s*\[/i, /\$_POST\s*\[/i, /password.*=.*['"]/i],
      medium: [/innerHTML\s*=/i, /document\.write/i, /api.*key/i, /secret/i],
      low: [/console\.log/i, /debug/i]
    };
    
    for (const [level, patterns] of Object.entries(riskPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          return level as 'high' | 'medium' | 'low';
        }
      }
    }
    
    return 'low';
  }

  private identifySecurityPatterns(content: string, filePath: string): string[] {
    const patterns: string[] = [];
    
    if (/input|form|request/i.test(content)) patterns.push('user-input');
    if (/validation|sanitize|filter/i.test(content)) patterns.push('input-validation');
    if (/auth|login|session/i.test(content)) patterns.push('authentication');
    if (/admin|role|permission/i.test(content)) patterns.push('authorization');
    if (/encrypt|hash|crypto/i.test(content)) patterns.push('cryptography');
    if (/output|echo|print|render/i.test(content)) patterns.push('output-generation');
    
    return patterns;
  }

  private scanForVulnerabilities(content: string): string[] {
    const vulnerabilities: string[] = [];
    
    if (/eval\s*\(/i.test(content)) vulnerabilities.push('code-injection');
    if (/\$_GET\s*\[.*\]\s*(?!.*htmlspecialchars)/i.test(content)) vulnerabilities.push('xss-risk');
    if (/SELECT.*FROM.*WHERE.*\$_/i.test(content)) vulnerabilities.push('sql-injection-risk');
    if (/password.*=.*['"]\w+['"]/i.test(content)) vulnerabilities.push('hardcoded-credentials');
    if (/api.?key.*=.*['"]\w+['"]/i.test(content)) vulnerabilities.push('hardcoded-api-key');
    
    return vulnerabilities;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default SecurityAuditor;
