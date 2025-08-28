/**
 * Security Audit Plugin
 * Performs comprehensive security audits on code with project-specific vulnerability checks
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { readFileContent } from '../shared/helpers.js';

// Type definitions for security context
interface SecurityContext {
  projectType: string;
  auditDepth?: string;
  includeOwasp?: boolean;
  includeDependencies?: boolean;
  customChecks?: string[];
}

export class SecurityAuditor extends BasePlugin implements IPromptPlugin {
  name = 'security_audit';
  category = 'analyze' as const;
  description = 'Perform a security audit on code with project-specific vulnerability checks';
  
  parameters = {
    code: {
      type: 'string' as const,
      description: 'Code to audit',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to file to audit',
      required: false
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
    }
  };

  async execute(params: any, llmClient: any) {
    // Validate at least one input provided
    if (!params.code && !params.filePath) {
      throw new Error('Either code or filePath must be provided');
    }
    
    // Validate projectType is provided
    if (!params.projectType) {
      throw new Error('projectType is required for security audit');
    }
    
    // Read file if needed
    let codeToAudit = params.code;
    if (params.filePath) {
      codeToAudit = await readFileContent(params.filePath);
    }
    
    // Prepare context
    const context: SecurityContext = {
      projectType: params.projectType,
      auditDepth: params.auditDepth || 'standard',
      includeOwasp: params.includeOwasp !== false,
      includeDependencies: params.includeDependencies || false,
      customChecks: params.customChecks
    };
    
    // Generate prompt
    const prompt = this.getPrompt({ code: codeToAudit, context });
    
    try {
      // Get the loaded model from LM Studio
      const models = await llmClient.llm.listLoaded();
      if (models.length === 0) {
        throw new Error('No model loaded in LM Studio. Please load a model first.');
      }
      
      // Use the first loaded model
      const model = models[0];
      
      // Call the model with proper LM Studio SDK pattern
      const prediction = model.respond([
        {
          role: 'system',
          content: 'You are a cybersecurity expert specializing in code security audits. Provide comprehensive, actionable security analysis with specific vulnerability identification and remediation advice.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
        temperature: 0.1,
        maxTokens: 3000
      });
      
      // Stream the response
      let response = '';
      for await (const chunk of prediction) {
        if (chunk.content) {
          response += chunk.content;
        }
      }
      
      // Format response
      return {
        audit: response,
        metadata: {
          projectType: params.projectType,
          auditDepth: context.auditDepth,
          includesOwasp: context.includeOwasp,
          includesDependencies: context.includeDependencies,
          modelUsed: model.identifier || 'unknown'
        }
      };
      
    } catch (error: any) {
      throw new Error(`Failed to perform security audit: ${error.message}`);
    }
  }

  getPrompt(params: any): string {
    const code = params.code;
    const context = params.context;
    
    const { projectType, auditDepth = 'standard' } = context;
    
    return `Perform a ${auditDepth} security audit for this ${projectType} code:

Security Audit Configuration:
- Project Type: ${projectType}
- Audit Depth: ${auditDepth}
- Include OWASP: ${context.includeOwasp !== false}
- Check Dependencies: ${context.includeDependencies || false}
- Custom Checks: ${context.customChecks?.join(', ') || 'None'}

Security Checklist:
${this.getSecurityChecklist(projectType)}

Additional Checks for ${auditDepth} audit:
${this.getAuditDepthChecks(auditDepth)}

Analyze for:

1. **Input Validation**:
   - Unvalidated user input
   - Type coercion issues
   - Range validation
   - Format validation
   - Encoding issues

2. **Output Encoding**:
   - XSS vulnerabilities
   - HTML injection
   - JavaScript injection
   - CSS injection
   - SQL injection

3. **Authentication/Authorization**:
   - Broken authentication
   - Session management
   - Privilege escalation
   - Insecure direct object references
   - Missing function level access control

4. **Data Protection**:
   - Sensitive data exposure
   - Weak cryptography
   - Hardcoded secrets
   - Insecure data transmission
   - Insufficient data masking

5. **Security Misconfiguration**:
   - Default credentials
   - Unnecessary features enabled
   - Verbose error messages
   - Missing security headers
   - Outdated dependencies

6. **Common Vulnerabilities**:
   - Path traversal
   - Command injection
   - XXE (XML External Entities)
   - Deserialization flaws
   - LDAP injection

${context.includeOwasp !== false ? `
7. **OWASP Top 10 Compliance**:
   - Check against current OWASP Top 10
   - Provide OWASP references
   - Suggest OWASP recommended fixes` : ''}

${context.includeDependencies ? `
8. **Dependency Analysis**:
   - Known vulnerable dependencies
   - Outdated packages
   - License compliance
   - Supply chain risks` : ''}

Code to audit:
${code}

Provide:
1. **Vulnerability Report**:
   - Finding description
   - Severity (Critical/High/Medium/Low)
   - CVSS score (if applicable)
   - Location in code
   - Proof of concept (if safe to demonstrate)

2. **Remediation Code**:
   - Fixed version of vulnerable code
   - Security best practices applied
   - Comments explaining fixes

3. **Prevention Guidelines**:
   - How to prevent similar issues
   - Security coding standards
   - Testing recommendations

4. **Compliance Notes**:
   - Regulatory compliance issues
   - Industry standard violations
   - Framework-specific security guidelines

Format as a professional security audit report.`;
  }

  private getAuditDepthChecks(depth: string): string {
    const checks: Record<string, string> = {
      basic: 'Common vulnerabilities, obvious security flaws',
      standard: 'OWASP Top 10, framework-specific issues, basic cryptography',
      comprehensive: 'Advanced attack vectors, race conditions, side-channel attacks, cryptographic analysis, business logic flaws'
    };
    
    return checks[depth] || checks.standard;
  }

  private getSecurityChecklist(projectType: string): string {
    const checklists: Record<string, string> = {
      'wordpress-plugin': `
1. Nonce verification on all forms
2. Capability checks for privileged operations
3. SQL injection prevention with $wpdb->prepare()
4. XSS prevention with esc_html(), esc_attr(), etc.
5. CSRF protection on state-changing operations
6. File upload validation and sanitization
7. Option and meta value sanitization`,

      'wordpress-theme': `
1. Escaping all dynamic output
2. Nonce verification on forms
3. Capability checks for customizer
4. Safe file includes
5. SVG sanitization
6. JavaScript variable escaping
7. Theme option validation`,

      'node-api': `
1. Input validation on all endpoints
2. SQL injection prevention (parameterized queries)
3. XSS prevention in responses
4. Authentication token validation
5. Rate limiting implementation
6. CORS configuration
7. Dependency vulnerability scanning`,

      'react-app': `
1. XSS prevention with proper JSX escaping
2. URL and href validation
3. Dangerous HTML sanitization
4. Secure storage of sensitive data
5. API key protection
6. Content Security Policy compliance
7. Third-party library vulnerabilities`,

      'react-component': `
1. Props validation and sanitization
2. XSS prevention in rendered content
3. Event handler security
4. State management security
5. Secure data passing
6. Component isolation
7. Third-party integration security`,

      'n8n-node': `
1. Credential encryption and storage
2. Input validation for node parameters
3. API key and secret handling
4. Rate limiting respect
5. Error message sanitization
6. Webhook signature validation
7. Data exposure in logs`,

      'n8n-workflow': `
1. Exposed credentials in code nodes
2. Sensitive data in logs
3. Webhook authentication
4. Data validation between nodes
5. Error handling security
6. Third-party API security
7. Workflow access control`,

      'html-component': `
1. HTML injection prevention
2. JavaScript injection prevention
3. CSS injection prevention
4. Form validation
5. ARIA security considerations
6. iframe sandboxing
7. Link target validation`,

      'browser-extension': `
1. Content Security Policy
2. Permission minimization
3. Cross-origin communication security
4. Storage encryption
5. Code injection prevention
6. External resource validation
7. Update mechanism security`,

      'cli-tool': `
1. Command injection prevention
2. Path traversal prevention
3. Environment variable validation
4. File permission checks
5. Temporary file security
6. Signal handling
7. Privilege escalation prevention`,

      'generic': `
1. Input validation and sanitization
2. Output encoding
3. Authentication and authorization
4. Secure data storage
5. Error handling without info leakage
6. Dependency security
7. Security headers and configurations`
    };

    return checklists[projectType] || checklists.generic;
  }
}

export default SecurityAuditor;
