/**
 * WordPress Plugin Generator - Modern v4.3 Universal Template
 * 
 * Generates complete WordPress plugin structures with all necessary files and best practices
 * Intelligently handles plugin requirements and generates production-ready code
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

// Common Node.js modules - Use these instead of require()
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class WordPressPluginGenerator extends BasePlugin implements IPromptPlugin {
  name = 'generate_wordpress_plugin';
  category = 'generate' as const;
  description = 'Generate a complete WordPress plugin structure with all necessary files and best practices';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // WordPress plugin specific parameters
    name: {
      type: 'string' as const,
      description: 'Plugin name',
      required: true
    },
    description: {
      type: 'string' as const,
      description: 'Plugin description',
      required: true
    },
    features: {
      type: 'array' as const,
      description: 'List of features to include',
      required: true,
      items: { type: 'string' as const }
    },
    prefix: {
      type: 'string' as const,
      description: 'Plugin prefix for functions and classes (e.g., "wp_my_plugin")',
      required: true
    },
    
    // Optional WordPress parameters
    wpVersion: {
      type: 'string' as const,
      description: 'Minimum WordPress version',
      required: false,
      default: '6.0'
    },
    phpVersion: {
      type: 'string' as const,
      description: 'Minimum PHP version',
      required: false,
      default: '7.4'
    },
    textDomain: {
      type: 'string' as const,
      description: 'Text domain for internationalization',
      required: false
    },
    
    // Feature flags
    includeAdmin: {
      type: 'boolean' as const,
      description: 'Include admin interface',
      required: false,
      default: true
    },
    includeDatabase: {
      type: 'boolean' as const,
      description: 'Include database tables',
      required: false,
      default: false
    },
    includeAjax: {
      type: 'boolean' as const,
      description: 'Include AJAX handlers',
      required: false,
      default: false
    },
    includeRest: {
      type: 'boolean' as const,
      description: 'Include REST API endpoints',
      required: false,
      default: false
    },
    includeGutenberg: {
      type: 'boolean' as const,
      description: 'Include Gutenberg blocks',
      required: false,
      default: false
    },
    
    // Template compatibility parameters (for future flexibility)
    code: {
      type: 'string' as const,
      description: 'Existing plugin code to analyze (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to existing plugin file to analyze',
      required: false
    },
    projectPath: {
      type: 'string' as const,
      description: 'Path to existing plugin project root (for multi-file analysis)',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific plugin files to analyze (for multi-file analysis)',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for plugin analysis (1-5)',
      required: false,
      default: 3
    },
    
    // Universal parameters
    language: {
      type: 'string' as const,
      description: 'Programming language (PHP for WordPress)',
      required: false,
      default: 'php'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of plugin generation detail',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of plugin generation to perform',
      enum: ['simple', 'advanced', 'comprehensive'],
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
        return ErrorHandler.createExecutionError('generate_wordpress_plugin', error);
      }
    });
  }

  /**
   * Auto-detect whether this is plugin generation or plugin analysis
   * 
   * For WordPress plugins, we default to generation (single-file mode) unless 
   * existing plugin files are provided for analysis
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Multi-file mode: when analyzing existing plugin projects
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Single-file mode: when analyzing individual plugin files or generating new plugins
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Default to single-file for plugin generation (most common use case)
    return 'single-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      // For plugin generation, require plugin-specific parameters
      if (!params.code && !params.filePath) {
        // This is plugin generation - validate required fields
        if (!params.name || !params.description || !params.features || !params.prefix) {
          throw new Error('For plugin generation: name, description, features, and prefix are required');
        }
      } else {
        // This is plugin analysis - use standard validation
        ParameterValidator.validateCodeOrFile(params);
      }
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['simple', 'advanced', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
  }

  /**
   * Execute single-file analysis (plugin generation or single file analysis)
   */
  private async executeSingleFileAnalysis(params: any, model: any, contextLength: number) {
    // Process single file input if provided, otherwise this is plugin generation
    let codeToAnalyze = params.code;
    if (params.filePath) {
      codeToAnalyze = await readFileContent(params.filePath);
    }
    
    // Generate prompt stages for single file (generation or analysis)
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
        'generate_wordpress_plugin',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'generate_wordpress_plugin'
      );
    }
  }

  /**
   * Execute multi-file analysis (existing plugin project analysis)
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
      'generate_wordpress_plugin',
      'multifile'
    );
  }

  /**
   * Single-file prompt stages - WordPress plugin generation or single file analysis
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, analysisDepth, analysisType, name, description, features, prefix } = params;
    
    // Determine if this is generation or analysis
    const isGeneration = !code && name && description && features && prefix;
    
    let systemAndContext: string;
    let dataPayload: string;
    let outputInstructions: string;
    
    if (isGeneration) {
      // Plugin Generation Mode
      systemAndContext = `You are an expert WordPress plugin developer specializing in ${analysisDepth} ${analysisType} plugin development.

WordPress Plugin Development Expertise:
- WordPress Standards: Follow WordPress Coding Standards (WPCS) meticulously
- Security Best Practices: Implement proper nonces, capabilities, escaping, and sanitization
- Modern PHP Architecture: Use namespaces, dependency injection, and design patterns
- Compatibility: WordPress ${params.wpVersion || '6.0'}+ and PHP ${params.phpVersion || '7.4'}+
- Internationalization: Ready for translation with proper text domains
- Performance: Optimize for speed, lazy loading, and minimal footprint
- Accessibility: WCAG compliant admin interfaces
- Code Quality: Clean, maintainable, well-documented code

Generation Context:
- Plugin Generation Mode: Creating complete, production-ready plugin structure
- Analysis Depth: ${analysisDepth}
- Plugin Complexity: ${analysisType}

Your task is to generate a complete, professional WordPress plugin that developers can immediately use in production.`;

      dataPayload = `WordPress Plugin Requirements:

**Core Details:**
- Plugin Name: ${name}
- Description: ${description}
- Features Required: ${features.join(', ')}
- Function Prefix: ${prefix}
- Text Domain: ${params.textDomain || prefix}

**Technical Requirements:**
- Minimum WordPress Version: ${params.wpVersion || '6.0'}
- Minimum PHP Version: ${params.phpVersion || '7.4'}
- Include Admin Interface: ${params.includeAdmin !== false}
- Include Database Tables: ${params.includeDatabase || false}
- Include AJAX Handlers: ${params.includeAjax || false}
- Include REST API Endpoints: ${params.includeRest || false}
- Include Gutenberg Blocks: ${params.includeGutenberg || false}

**Quality Standards Required:**
- WordPress Coding Standards (WPCS) compliance
- Security-first approach with proper sanitization
- Internationalization ready
- Performance optimized
- Accessibility compliant admin interfaces
- Comprehensive documentation`;

      outputInstructions = `Generate a complete WordPress plugin structure with production-ready code, comprehensive QA analysis, and deployment package preparation:

## Part 1: Complete Plugin Architecture

### 1. Main Plugin File (${prefix}.php)
- Complete plugin header with all metadata
- Namespace: ${prefix.charAt(0).toUpperCase() + prefix.slice(1)}
- Main plugin class with singleton pattern
- Proper activation/deactivation hooks with error handling
- Security checks and early exits
- **CRITICAL**: Include activation safety checks to prevent fatal errors

### 2. Core Plugin Structure
- **Includes Directory**: Core functionality classes
  - Main plugin class (${prefix}-core.php)
  - Activation/deactivation handlers with rollback capability
  - Security and validation utilities

${params.includeAdmin !== false ? `
### 3. Admin Interface (admin/)
- Admin menu registration with proper capabilities
- Settings API implementation with sections and fields
- Form handling with nonces and validation
- Admin notices system with dismissible functionality
- Dashboard widgets (if relevant)` : ''}

${params.includeDatabase ? `
### 4. Database Layer (includes/database/)
- Custom table schema with proper indexes and rollback
- Database abstraction layer with $wpdb
- Migration system with version checking
- Data validation and sanitization layers with error recovery` : ''}

${params.includeAjax ? `
### 5. AJAX System (includes/ajax/)
- Nonce verification for all AJAX calls
- Capability checks and user permissions
- Structured response formatting with error codes
- Error handling and logging with graceful degradation` : ''}

${params.includeRest ? `
### 6. REST API (includes/rest/)
- Custom endpoint registration with permission callbacks
- Authentication and authorization layers
- Request/response schema definitions with validation
- API versioning and backward compatibility` : ''}

${params.includeGutenberg ? `
### 7. Gutenberg Integration (blocks/)
- Block registration with fallback for older WordPress
- JavaScript/CSS asset management with dependency checking
- Block attributes and server-side rendering
- Editor and frontend styles with theme compatibility` : ''}

## Part 2: Essential WordPress Standards Implementation

### Security Requirements (MANDATORY):
- Nonce verification: wp_verify_nonce() for ALL forms and AJAX
- Capability checks: current_user_can() for ALL admin functions
- Data escaping: esc_html(), esc_attr(), esc_url() for ALL output
- Input sanitization: sanitize_text_field(), sanitize_email(), etc.
- SQL injection prevention: $wpdb prepared statements ONLY
- File inclusion security: Absolute paths and existence checks

### Activation Safety Requirements (CRITICAL):
- PHP version compatibility checks before class definitions
- WordPress version compatibility verification
- Required function/class existence checks
- Database connection verification (if database features used)
- Write permission checks for required directories
- Memory limit and execution time considerations
- Graceful failure with informative error messages

### Code Quality Requirements:
- WordPress hooks: Properly registered actions and filters
- Error handling: Try-catch blocks with wp_die() for user-facing errors
- Logging: error_log() for debugging with conditional logging
- Documentation: PHPDoc blocks for ALL functions and classes
- Coding standards: WordPress-VIP-Go standards compliance

### Performance Requirements:
- Lazy loading: Load heavy resources only when needed
- Caching: Implement transients with expiration and cleanup
- Database optimization: Proper indexes and optimized queries
- Asset optimization: Minification and concatenation strategies

## Part 3: QA Analysis and Validation

### Pre-Activation Checklist Analysis:
Provide a comprehensive QA analysis covering:

1. **Fatal Error Prevention:**
   - All class names unique and properly namespaced
   - All function names prefixed to avoid conflicts
   - All required files exist and are properly included
   - All WordPress functions have availability checks
   - All third-party dependencies properly loaded

2. **Security Vulnerability Assessment:**
   - All user inputs properly sanitized
   - All outputs properly escaped
   - All nonces implemented correctly
   - All capability checks in place
   - All SQL queries use prepared statements

3. **WordPress Compatibility Verification:**
   - Minimum WordPress version requirements met
   - Hooks and filters properly registered
   - Admin interfaces follow WordPress UI guidelines
   - Internationalization properly implemented
   - Settings API correctly utilized

4. **Performance Impact Assessment:**
   - Database queries optimized and indexed
   - Assets properly enqueued with dependencies
   - Caching implemented where beneficial
   - Memory usage considerations addressed

## Part 4: Deployment Package Preparation

### ZIP Package Instructions:
1. **File Structure for ZIP**: Complete directory listing for packaging
2. **README.txt Creation**: WordPress.org standard readme with installation steps
3. **Version Management**: Clear version numbering and changelog
4. **Asset Optimization**: Minified CSS/JS for production
5. **Permission Settings**: Correct file permissions (644 for files, 755 for directories)

### Installation Testing Checklist:
1. **Upload Test**: ZIP file uploads successfully via WordPress admin
2. **Activation Test**: Plugin activates without fatal errors
3. **Functionality Test**: All features work as expected
4. **Deactivation Test**: Plugin deactivates cleanly without orphaned data
5. **Reactivation Test**: Plugin reactivates properly with saved settings

## Part 5: Output Format Requirements

Provide your response in exactly this structure:

### A. Complete Plugin Code
[All plugin files with full, production-ready code]

### B. QA Analysis Report
\`\`\`
# Plugin QA Analysis Report

## Fatal Error Prevention: ✅ PASS / ⚠️ WARNING / ❌ FAIL
- Class naming conflicts: [assessment]
- Function naming conflicts: [assessment]
- File inclusion safety: [assessment]
- WordPress function availability: [assessment]

## Security Assessment: ✅ PASS / ⚠️ WARNING / ❌ FAIL
- Input sanitization: [assessment]
- Output escaping: [assessment]
- Nonce implementation: [assessment]
- Capability checks: [assessment]
- SQL injection prevention: [assessment]

## WordPress Compatibility: ✅ PASS / ⚠️ WARNING / ❌ FAIL
- Version requirements: [assessment]
- Hook implementation: [assessment]
- Admin UI compliance: [assessment]
- Internationalization: [assessment]

## Performance Assessment: ✅ PASS / ⚠️ WARNING / ❌ FAIL
- Database optimization: [assessment]
- Asset management: [assessment]
- Caching implementation: [assessment]
- Memory usage: [assessment]

## Overall Plugin Grade: A / B / C / D / F
[Summary of plugin quality and readiness]
\`\`\`

### C. ZIP Package Creation Guide
\`\`\`
# Plugin ZIP Package Instructions

1. **Create ZIP Structure:**
   - Include all plugin files in folder named: ${prefix}
   - Maintain exact directory structure shown above
   - Include README.txt with WordPress.org format

2. **File Permissions:**
   - PHP files: 644
   - CSS/JS files: 644
   - Directories: 755

3. **ZIP Creation Command:**
   [Provide command-line or manual ZIP creation steps]

4. **Upload Instructions:**
   - Navigate to WordPress Admin → Plugins → Add New → Upload Plugin
   - Select the created ZIP file
   - Click "Install Now"
   - Activate the plugin
\`\`\`

### D. Testing Checklist
\`\`\`
# Pre-Deployment Testing

□ ZIP file uploads successfully
□ Plugin activates without errors
□ Admin menu appears correctly
□ Settings page functions properly
□ All features work as designed
□ No PHP errors in debug log
□ Plugin deactivates cleanly
□ Reactivation works properly
□ No database orphans after deactivation
\`\`\`

Provide complete, functional, production-ready code that has been thoroughly analyzed for activation safety, security vulnerabilities, and WordPress compatibility. Include comprehensive QA analysis, deployment preparation, and testing procedures.`;

    } else {
      // Plugin Analysis Mode
      systemAndContext = `You are an expert WordPress plugin analyst specializing in ${analysisDepth} ${analysisType} analysis.

Analysis Context:
- Language: PHP (WordPress)
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Mode: Single WordPress Plugin File Analysis

Your task is to provide actionable insights and recommendations for this individual WordPress plugin file.`;

      dataPayload = `WordPress plugin code to analyze:

\`\`\`php
${code}
\`\`\``;

      outputInstructions = `Provide comprehensive WordPress plugin analysis in the following structured format:

{
  "summary": "Brief overview of this plugin file's purpose and functionality",
  "analysis": {
    "wordpressCompliance": {
      "codingStandards": "assessment of WPCS compliance",
      "hooksUsage": "evaluation of actions and filters usage",
      "apiUsage": "assessment of WordPress API usage"
    },
    "security": {
      "nonceUsage": "evaluation of nonce implementation",
      "sanitization": "input sanitization assessment",
      "escaping": "output escaping assessment",
      "capabilities": "user capability checks assessment"
    },
    "functionality": {
      "coreFeatures": ["list of main features identified"],
      "integrations": ["WordPress integrations detected"],
      "dependencies": ["external dependencies identified"]
    },
    "codeQuality": {
      "structure": "code organization assessment",
      "documentation": "code documentation quality",
      "errorHandling": "error handling implementation"
    }
  },
  "recommendations": [
    "specific WordPress-focused recommendations for improvement"
  ],
  "securityConcerns": [
    "identified security issues with suggested fixes"
  ],
  "confidence": 0.85
}`;
    }

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file prompt stages - WordPress plugin project analysis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount } = params;
    
    const systemAndContext = `You are an expert WordPress plugin architect specializing in ${analysisDepth} ${analysisType} analysis.

WordPress Plugin Project Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Mode: Multi-File WordPress Plugin Project Analysis

Your task is to provide comprehensive architectural insights and recommendations for this WordPress plugin project.`;

    const dataPayload = `WordPress plugin project analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Provide comprehensive WordPress plugin project analysis in the following structured format:

{
  "summary": "Overall WordPress plugin project assessment",
  "architecture": {
    "pluginStructure": "evaluation of plugin organization and structure",
    "namespacing": "assessment of PHP namespacing and class organization",
    "hookSystem": "evaluation of WordPress hooks implementation across files"
  },
  "crossFileFindings": [
    {
      "type": "security|performance|compatibility|standards",
      "severity": "high|medium|low",
      "description": "Cross-file issue description in WordPress context", 
      "affectedFiles": ["file1.php", "file2.php"],
      "recommendation": "WordPress-specific fix recommendation"
    }
  ],
  "wordpressCompliance": {
    "codingStandards": "overall WPCS compliance assessment",
    "securityImplementation": "security best practices implementation",
    "performanceOptimization": "performance optimization assessment",
    "accessibilityCompliance": "accessibility standards compliance"
  },
  "recommendations": [
    "project-wide WordPress plugin improvement recommendations"
  ],
  "migrationPath": "suggestions for modernizing the plugin architecture"
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
      'generate_wordpress_plugin', 
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
    
    // Aggregate results into proper analysis result format
    const aggregatedResult = {
      summary: `WordPress plugin project analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        pluginStructure: this.analyzePluginStructure(fileAnalysisResults),
        phpFiles: fileAnalysisResults.filter(f => f.extension === '.php').length,
        jsFiles: fileAnalysisResults.filter(f => f.extension === '.js').length,
        cssFiles: fileAnalysisResults.filter(f => f.extension === '.css').length
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
    
    // WordPress-specific file analysis
    const isMainPluginFile = basename(file).endsWith('.php') && content.includes('Plugin Name:');
    const hasWordPressHooks = content.includes('add_action') || content.includes('add_filter');
    const hasSecurityChecks = content.includes('wp_verify_nonce') || content.includes('current_user_can');
    
    return {
      filePath: file,
      fileName: basename(file),
      size: content.length,
      lines: content.split('\n').length,
      extension: extname(file),
      relativePath: relative(params.projectPath || '', file),
      isMainPluginFile,
      hasWordPressHooks,
      hasSecurityChecks,
      fileType: this.categorizeWordPressFile(file, content)
    };
  }

  private categorizeWordPressFile(filePath: string, content: string): string {
    const fileName = basename(filePath).toLowerCase();
    const fileContent = content.toLowerCase();
    
    if (fileName.endsWith('.php')) {
      if (fileContent.includes('plugin name:')) return 'main-plugin-file';
      if (fileName.includes('admin')) return 'admin-file';
      if (fileName.includes('ajax')) return 'ajax-handler';
      if (fileName.includes('rest') || fileName.includes('api')) return 'rest-api';
      if (fileName.includes('block')) return 'gutenberg-block';
      if (fileName.includes('widget')) return 'widget';
      if (fileName.includes('shortcode')) return 'shortcode';
      return 'php-file';
    }
    
    if (fileName.endsWith('.js')) {
      if (fileContent.includes('wp.blocks')) return 'gutenberg-script';
      if (fileContent.includes('jquery')) return 'jquery-script';
      return 'javascript-file';
    }
    
    if (fileName.endsWith('.css')) {
      if (fileName.includes('admin')) return 'admin-styles';
      return 'stylesheet';
    }
    
    return 'other-file';
  }

  private analyzePluginStructure(fileResults: any[]): any {
    const structure = {
      hasMainFile: fileResults.some(f => f.isMainPluginFile),
      hasAdminInterface: fileResults.some(f => f.fileType === 'admin-file'),
      hasAjaxHandlers: fileResults.some(f => f.fileType === 'ajax-handler'),
      hasRestAPI: fileResults.some(f => f.fileType === 'rest-api'),
      hasGutenbergBlocks: fileResults.some(f => f.fileType === 'gutenberg-block' || f.fileType === 'gutenberg-script'),
      securityImplementation: fileResults.filter(f => f.hasSecurityChecks).length / fileResults.length
    };
    
    return structure;
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'simple': ['.php', '.js', '.css'],
      'advanced': ['.php', '.js', '.css', '.json', '.md', '.txt'],
      'comprehensive': ['.php', '.js', '.css', '.json', '.md', '.txt', '.xml', '.yml', '.yaml', '.po', '.pot']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default WordPressPluginGenerator;
