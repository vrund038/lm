# Analysis Functions Guide

**Your expert code intelligence toolkit**

The analysis functions provide professional-level insights into your codebase, helping you understand structure, identify issues, and make informed architectural decisions. Each function uses battle-tested prompts with hundreds of hours of refinement.

## Quick Start Examples

These natural language prompts get you started immediately:

```
Use houtini-lm to analyse my React component for code quality issues
```

```
Check the security of my WordPress plugin using houtini-lm comprehensive audit
```

```
Use houtini-lm to find all unused files in my project directory safely
```

```
Generate a beautiful project structure overview using houtini-lm count files
```

```
Use houtini-lm to trace the execution path from my login function
```

## Core Analysis Functions

### 1. `analyze_single_file` - Deep Code Analysis

**Purpose**: Expert-level analysis of individual files with actionable insights

**Simple usage**:
```
Analyse C:/project/src/UserAuth.tsx using houtini-lm for quality and security issues
```

**What you get**:
- Code quality assessment with confidence scoring
- Security vulnerability detection with risk levels
- Performance optimisation suggestions
- Framework-specific recommendations
- Refactoring opportunities with risk assessment

**Advanced usage**:
```json
{
  "name": "houtini-lm:analyze_single_file",
  "parameters": {
    "filePath": "C:/project/src/components/UserAuth.tsx",
    "analysisDepth": "comprehensive",
    "context": {
      "framework": "React",
      "typescript": true,
      "focus": "security"
    }
  }
}
```

### 2. `count_files` - Project Structure Intelligence

**Purpose**: Beautiful markdown directory trees with architectural insights

**Simple usage**:
```
Use houtini-lm to create a project overview for C:/my-react-app
```

**What you get**:
```markdown
📁 my-react-app/
├── 📁 src/ (45 files)
│   ├── 📁 components/ (12 files)
│   └── 📁 hooks/ (8 files)
├── 📁 public/ (3 files)
└── 📄 package.json

Technologies: React, TypeScript, Tailwind
Architecture: Component-based with custom hooks
```

**Advanced usage**:
```json
{
  "name": "houtini-lm:count_files", 
  "parameters": {
    "projectPath": "C:/enterprise-project",
    "maxDepth": 4,
    "analysisType": "comprehensive"
  }
}
```

### 3. `find_unused_files` - Smart Dead Code Detection

**Purpose**: Conservative identification of genuinely unused files

**Simple usage**:
```
Use houtini-lm to safely find unused files in C:/project/src
```

**What you get**:
- Risk-categorised results (definitely safe vs. investigate)
- Conservative analysis to avoid false positives
- Cleanup recommendations with confidence scoring
- Technical debt reduction estimates

**Advanced usage**:
```json
{
  "name": "houtini-lm:find_unused_files",
  "parameters": {
    "projectPath": "C:/my-project/src",
    "entryPoints": ["index.ts", "main.ts", "app.ts"],
    "analyzeComments": true
  }
}
```

### 4. `security_audit` - Comprehensive Security Analysis

**Purpose**: OWASP-compliant security vulnerability detection

**Simple usage**:
```
Run a security audit on my web application using houtini-lm
```

**What you get**:
- OWASP Top 10 compliance checking
- Cross-file vulnerability analysis
- Authentication and authorization assessment
- Input validation and sanitisation review
- Actionable security recommendations

**Advanced usage**:
```json
{
  "name": "houtini-lm:security_audit",
  "parameters": {
    "projectPath": "C:/web-application",
    "auditDepth": "comprehensive", 
    "focusAreas": ["authentication", "input-validation"],
    "includeOwasp": true
  }
}
```

### 5. `analyze_dependencies` - Dependency Intelligence

**Purpose**: Understand project dependencies and relationships

**Simple usage**:
```
Use houtini-lm to check for circular dependencies in my project
```

**What you get**:
- Circular dependency detection
- Unused import identification
- Package.json analysis
- Coupling assessment
- Architectural insights

## WordPress-Specific Analysis

### 6. `analyze_wordpress_security` - WordPress Security Specialist

**Simple usage**:
```
Use houtini-lm to audit my WordPress plugin for security vulnerabilities
```

**Advanced usage**:
```json
{
  "name": "houtini-lm:analyze_wordpress_security",
  "parameters": {
    "projectPath": "C:/wp-plugin",
    "wpType": "plugin",
    "auditDatabaseQueries": true,
    "checkCapabilities": true
  }
}
```

### 7. `audit_wordpress_plugin` - Complete Plugin Assessment

**Simple usage**:
```
Run a comprehensive WordPress plugin audit using houtini-lm
```

**What you get**:
- Structure analysis and WordPress standards compliance
- Security audit with vulnerability detection
- Database query security analysis
- Code quality metrics
- Performance recommendations

### 8. `audit_wordpress_theme` - Theme Quality Assurance

**Simple usage**:
```
Audit my WordPress theme for quality and accessibility using houtini-lm
```

**What you get**:
- Theme structure and standards compliance
- Accessibility audit (WCAG compliance)
- Performance analysis
- SEO optimization review
- Security assessment

## Advanced Analysis Functions

### 9. `analyze_code_quality` - Quality Metrics

**Simple usage**:
```
Use houtini-lm to assess code quality across my entire project
```

### 10. `find_unused_css` - CSS Optimization

**Simple usage**:
```
Find unused CSS in my website using houtini-lm
```

### 11. `analyze_project_structure` - Architecture Assessment

**Simple usage**:
```
Analyze my project architecture using houtini-lm comprehensive review
```

### 12. `analyze_database_queries` - SQL Security Analysis

**Simple usage**:
```
Check my PHP files for SQL injection vulnerabilities using houtini-lm
```

### 13. `analyze_n8n_workflow` - Workflow Optimization

**Simple usage**:
```
Optimize my n8n workflow JSON using houtini-lm
```

## Cross-File Analysis Tools

### 14. `compare_integration` - Integration Compatibility

**Simple usage**:
```
Check API compatibility between my frontend and backend using houtini-lm
```

### 15. `diff_method_signatures` - Signature Comparison

**Simple usage**:
```
Compare method signatures for breaking changes using houtini-lm
```

### 16. `find_pattern_usage` - Pattern Detection

**Simple usage**:
```
Find all TODO comments in my project using houtini-lm pattern search
```

### 17. `trace_execution_path` - Flow Analysis

**Simple usage**:
```
Trace execution flow from UserController login method using houtini-lm
```

## Best Practices

### Getting High-Quality Analysis

1. **Be specific about context**: Mention frameworks, languages, and specific concerns
2. **Use appropriate depth**: Start with "detailed", use "comprehensive" for important analysis
3. **Include file paths**: Always use absolute paths for reliability
4. **Specify focus areas**: Mention if you're concerned about security, performance, or quality

### Workflow Patterns

**New Project Assessment:**
1. `count_files` - Understand structure
2. `security_audit` - Identify vulnerabilities  
3. `find_unused_files` - Cleanup opportunities
4. Strategic planning with Claude

**Legacy Code Review:**
1. `analyze_single_file` - Key files assessment
2. `find_pattern_usage` - Anti-pattern detection
3. `analyze_dependencies` - Relationship mapping
4. Refactoring strategy with Claude

**WordPress Development:**
1. `audit_wordpress_plugin` - Complete assessment
2. `analyze_wordpress_security` - Security focus
3. Strategic improvements with Claude

## Troubleshooting

**Poor Analysis Quality**:
- Use "comprehensive" depth for important analysis
- Include specific framework context
- Ensure you're using a 13B+ parameter model

**File Access Issues**:
- Use absolute file paths
- Check `LLM_MCP_ALLOWED_DIRS` includes your project
- Verify Desktop Commander MCP is installed

**Performance Problems**:
- Start with smaller projects or single files
- Use "basic" depth for large projects initially
- Ensure LM Studio model is fully loaded

---

*These analysis functions are your code intelligence toolkit - use them to understand codebases quickly, identify issues early, and make informed architectural decisions.*