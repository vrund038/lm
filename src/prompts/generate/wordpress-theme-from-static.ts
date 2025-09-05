/**
 * WordPress Theme from Static Site Generator - Modern v4.3 Universal Template
 * 
 * Converts static HTML/CSS/JS sites into fully functional WordPress themes
 * Supports both URL analysis and local file directory conversion
 * Intelligently handles multiple pages to understand site structure and styling
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

export class WordPressThemeFromStaticGenerator extends BasePlugin implements IPromptPlugin {
  name = 'wordpress_theme_from_static';
  category = 'generate' as const;
  description = 'Convert static HTML/CSS/JS sites into fully functional WordPress themes with smart template detection';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Static site source parameters
    urls: {
      type: 'array' as const,
      description: 'Array of URLs to analyze for theme conversion (e.g., home, blog, about pages)',
      required: false,
      items: { type: 'string' as const }
    },
    url: {
      type: 'string' as const,
      description: 'Single URL to analyze for theme conversion',
      required: false
    },
    
    // WordPress theme parameters
    themeName: {
      type: 'string' as const,
      description: 'WordPress theme name',
      required: false,
      default: 'Custom Static Theme'
    },
    themeDescription: {
      type: 'string' as const,
      description: 'Theme description',
      required: false,
      default: 'WordPress theme generated from static site'
    },
    themeAuthor: {
      type: 'string' as const,
      description: 'Theme author name',
      required: false,
      default: 'Theme Generator'
    },
    themeVersion: {
      type: 'string' as const,
      description: 'Theme version',
      required: false,
      default: '1.0.0'
    },
    
    // Template compatibility parameters
    code: {
      type: 'string' as const,
      description: 'HTML content to convert (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to HTML file to convert',
      required: false
    },
    projectPath: {
      type: 'string' as const,
      description: 'Path to static site directory (for multi-file analysis)',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific static site files to analyze',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for static site discovery (1-5)',
      required: false,
      default: 3
    },
    
    // Theme generation options
    includeGutenberg: {
      type: 'boolean' as const,
      description: 'Include Gutenberg block support',
      required: false,
      default: true
    },
    includeWooCommerce: {
      type: 'boolean' as const,
      description: 'Include WooCommerce template support',
      required: false,
      default: false
    },
    includeCustomizer: {
      type: 'boolean' as const,
      description: 'Include WordPress Customizer options',
      required: false,
      default: true
    },
    includeMenus: {
      type: 'boolean' as const,
      description: 'Include dynamic WordPress menus',
      required: false,
      default: true
    },
    includeSidebars: {
      type: 'boolean' as const,
      description: 'Include WordPress sidebar/widget areas',
      required: false,
      default: true
    },
    
    // Universal parameters
    language: {
      type: 'string' as const,
      description: 'Primary language (HTML/PHP for WordPress themes)',
      required: false,
      default: 'html'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of analysis detail for theme conversion',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of theme conversion to perform',
      enum: ['simple', 'responsive', 'comprehensive'],
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
        return ErrorHandler.createExecutionError('wordpress_theme_from_static', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-page or multi-page/directory conversion
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file indicators: single URL, HTML content, or single file path
    if (params.url || params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators: multiple URLs, directory paths, or file arrays
    if (params.urls && params.urls.length > 1) {
      return 'multi-file';
    }
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default to single-file for simple conversions
    return 'single-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      // Validate single source input
      if (!params.url && !params.code && !params.filePath && (!params.urls || params.urls.length === 0)) {
        throw new Error('For theme conversion: url, urls, code, or filePath is required');
      }
    } else {
      // Validate multi-source input
      if (params.projectPath) {
        ParameterValidator.validateProjectPath(params);
        ParameterValidator.validateDepth(params);
      } else if (!params.urls || params.urls.length === 0) {
        throw new Error('For multi-file conversion: urls array or projectPath is required');
      }
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['simple', 'responsive', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
  }

  /**
   * Execute single-file analysis (single page/URL conversion)
   */
  private async executeSingleFileAnalysis(params: any, model: any, contextLength: number) {
    // Process single source input
    let contentToAnalyze = params.code;
    let sourceUrl = params.url;
    
    if (params.filePath) {
      contentToAnalyze = await readFileContent(params.filePath);
    } else if (params.urls && params.urls.length === 1) {
      sourceUrl = params.urls[0];
    }
    
    // Generate prompt stages for single source conversion
    const promptStages = this.getSingleFilePromptStages({
      ...params,
      content: contentToAnalyze,
      sourceUrl
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
        'wordpress_theme_from_static',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'wordpress_theme_from_static'
      );
    }
  }

  /**
   * Execute multi-file analysis (multiple pages/URLs or directory conversion)
   */
  private async executeMultiFileAnalysis(params: any, model: any, contextLength: number) {
    let analysisResult: any;
    
    if (params.projectPath) {
      // Directory-based conversion
      const filesToAnalyze = await this.discoverRelevantFiles(
        params.projectPath,
        params.maxDepth,
        params.analysisType
      );
      
      analysisResult = await this.performMultiFileAnalysis(
        filesToAnalyze,
        params,
        model,
        contextLength
      );
    } else if (params.urls) {
      // URL-based conversion
      analysisResult = await this.performMultiUrlAnalysis(
        params.urls,
        params,
        model,
        contextLength
      );
    }
    
    // Generate prompt stages for multi-source conversion
    const promptStages = this.getMultiFilePromptStages({
      ...params,
      analysisResult,
      sourceCount: params.urls?.length || analysisResult?.findings?.length || 0
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
      'wordpress_theme_from_static',
      'multifile'
    );
  }

  /**
   * Single-file prompt stages - Single page/URL to WordPress theme conversion
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { content, sourceUrl, analysisDepth, analysisType, themeName, themeDescription } = params;
    
    const systemAndContext = `You are an expert WordPress theme developer specializing in converting static sites to ${analysisDepth} ${analysisType} WordPress themes.

WordPress Theme Development Expertise:
- Static to Dynamic Conversion: Transform HTML/CSS/JS into PHP template hierarchy
- WordPress Standards: Follow WordPress Theme Review Guidelines and coding standards
- Template Hierarchy: Master WordPress template hierarchy (index, home, single, page, archive, etc.)
- Dynamic Content Integration: Replace static content with WordPress functions and loops
- Responsive Design: Maintain original responsiveness while adding WordPress functionality
- Performance Optimization: Enqueue scripts/styles properly, optimize images, minimize HTTP requests
- Accessibility: Maintain WCAG compliance throughout conversion process
- Cross-browser Compatibility: Ensure theme works across all major browsers
- SEO Best Practices: Implement proper meta tags, structured data, and SEO-friendly markup

Conversion Context:
- Analysis Depth: ${analysisDepth}
- Theme Complexity: ${analysisType}
- Source Type: ${sourceUrl ? 'URL-based conversion' : 'File-based conversion'}
- WordPress Features: Gutenberg ${params.includeGutenberg ? 'enabled' : 'disabled'}, WooCommerce ${params.includeWooCommerce ? 'enabled' : 'disabled'}

Your task is to create a complete, professional WordPress theme that preserves the original design while adding full WordPress functionality.`;

    const dataPayload = `Static Site Conversion Requirements:

**Theme Details:**
- Theme Name: ${themeName || 'Custom Static Theme'}
- Description: ${themeDescription || 'WordPress theme generated from static site'}
- Author: ${params.themeAuthor || 'Theme Generator'}
- Version: ${params.themeVersion || '1.0.0'}
${sourceUrl ? `- Source URL: ${sourceUrl}` : ''}

**WordPress Features to Include:**
- Gutenberg Block Editor Support: ${params.includeGutenberg !== false}
- WooCommerce Template Support: ${params.includeWooCommerce || false}
- WordPress Customizer Integration: ${params.includeCustomizer !== false}
- Dynamic Navigation Menus: ${params.includeMenus !== false}
- Sidebar/Widget Areas: ${params.includeSidebars !== false}

**Static Site Content to Convert:**
${content ? `
HTML Content:
\`\`\`html
${content}
\`\`\`
` : `
Source URL: ${sourceUrl}
Note: Analyze the provided URL to understand the site structure, design patterns, and styling approach.
`}

**Conversion Requirements:**
- Preserve exact visual design and layout
- Maintain responsive behavior and animations
- Convert static navigation to WordPress menus
- Transform static content areas into dynamic WordPress content
- Implement proper WordPress template hierarchy
- Add WordPress admin customization options`;

    const outputInstructions = `Generate a complete WordPress theme structure that perfectly replicates the static site design:

## Required WordPress Theme Structure:

### 1. Theme Root Files
- **style.css**: Main stylesheet with proper WordPress theme header
- **index.php**: Default template with WordPress loop
- **functions.php**: Theme functions, enqueues, and WordPress feature support
- **screenshot.png**: Theme screenshot (1200x900px description)

### 2. Template Hierarchy Files
Based on detected page types, include relevant templates:
- **home.php** / **front-page.php**: Homepage template
- **single.php**: Single post template
- **page.php**: Static page template
- **archive.php**: Archive pages template
- **search.php**: Search results template
- **404.php**: Error page template
- **header.php**: Header template with WordPress head functions
- **footer.php**: Footer template with WordPress footer functions
- **sidebar.php**: Sidebar with widget areas (if applicable)

### 3. Asset Management
- **js/**: JavaScript files with proper WordPress enqueuing
- **css/**: Additional stylesheets organized by purpose
- **images/**: Theme images and assets
- **fonts/**: Custom fonts (if used)

### 4. WordPress Integration Features
- **Template Parts**: Modular template components
- **Custom Post Types**: If needed for content structure
- **Customizer Options**: Theme customization panel
- **Widget Areas**: Dynamic sidebar/footer widget areas
- **Navigation Menus**: Dynamic menu locations

${params.includeGutenberg ? `
### 5. Gutenberg Block Support
- **blocks/**: Custom block styles and templates
- **theme.json**: Global theme settings for block editor
- **Block patterns**: Custom block patterns matching original design
` : ''}

${params.includeWooCommerce ? `
### 6. WooCommerce Integration
- **woocommerce/**: WooCommerce template overrides
- **WooCommerce styling**: Product page styling matching theme design
- **Cart/checkout**: Styled cart and checkout pages
` : ''}

## WordPress Standards Implementation:

### Theme Header Requirements (style.css):
\`\`\`css
/*
Theme Name: ${themeName || 'Custom Static Theme'}
Description: ${themeDescription || 'WordPress theme generated from static site'}
Author: ${params.themeAuthor || 'Theme Generator'}
Version: ${params.themeVersion || '1.0.0'}
Requires at least: 6.0
Tested up to: 6.4
Requires PHP: 7.4
License: GPL v2 or later
Text Domain: [theme-slug]
Tags: responsive, custom-design, static-conversion
*/
\`\`\`

### Functions.php Requirements:
- Proper theme setup with add_theme_support()
- Script/style enqueuing with wp_enqueue_script/style()
- Navigation menu registration
- Widget area registration
- Custom post type registration (if needed)
- Theme customizer options
- Gutenberg block support (if enabled)

### Template Requirements:
- WordPress head/footer functions: wp_head(), wp_footer()
- Proper WordPress loops with get_template_part()
- Conditional template loading
- Escape all output: esc_html(), esc_url(), esc_attr()
- Internationalization: __(), _e(), _x() functions
- WordPress body classes: body_class()

### Performance & SEO:
- Optimized CSS/JS loading
- Proper image handling with wp_get_attachment_image()
- Meta tags and structured data
- Page speed optimization
- Mobile-first responsive design

Provide complete, production-ready WordPress theme files that exactly replicate the original static site design while adding full WordPress functionality. Include detailed setup instructions and customization documentation.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file prompt stages - Multiple pages/URLs or directory conversion
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, sourceCount } = params;
    
    const systemAndContext = `You are an expert WordPress theme architect specializing in ${analysisDepth} ${analysisType} static site to WordPress conversions.

Multi-Source WordPress Theme Conversion Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Sources Analyzed: ${sourceCount}
- Mode: Multi-Page/Multi-File WordPress Theme Generation

Your task is to create a comprehensive WordPress theme that unifies multiple pages/sections while maintaining design consistency and adding full WordPress functionality.`;

    const dataPayload = `Multi-source static site analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Generate a comprehensive WordPress theme from multiple static sources:

## Multi-Source Theme Architecture:

### 1. Unified Design System Analysis
- **Design Patterns**: Common elements across all analyzed sources
- **Color Schemes**: Consistent color palette extraction
- **Typography**: Font families and sizing scales used
- **Layout Grids**: Responsive grid systems identified
- **Component Library**: Reusable UI components found

### 2. Template Hierarchy Strategy
Based on analyzed sources, create appropriate templates:
- **Page Templates**: Custom templates for different page types found
- **Content Variations**: Handle different content structures
- **Layout Variations**: Multiple layout options for different sections
- **Component Templates**: Reusable template parts

### 3. WordPress Theme Structure
Generate complete theme with:
- **Unified style.css**: Combining all CSS while maintaining organization
- **Template files**: Appropriate templates for all page types discovered
- **functions.php**: Comprehensive theme setup with all required features
- **Asset organization**: Properly structured JS/CSS/image assets

### 4. Multi-Source Integration Features
- **Content Type Detection**: Identify different content structures across sources
- **Navigation Synthesis**: Combine navigation patterns into cohesive menu system
- **Widget Area Strategy**: Determine optimal sidebar/widget placements
- **Customizer Options**: Theme options covering variations found in sources

### 5. Cross-Page Consistency
- **Design System**: Unified component system across all templates
- **Performance**: Optimized asset loading for multi-template theme
- **Accessibility**: Consistent accessibility implementation across all templates
- **Responsive Behavior**: Unified responsive design strategy

## Multi-Source Conversion Output:

{
  "themeOverview": {
    "detectedPageTypes": ["list of page types found"],
    "commonDesignElements": ["shared design patterns"],
    "uniqueFeatures": ["special features requiring custom implementation"],
    "recommendedTemplates": ["WordPress templates to create"]
  },
  "unifiedDesignSystem": {
    "colorPalette": ["primary colors extracted"],
    "typography": ["font systems identified"],
    "componentLibrary": ["reusable components found"],
    "layoutSystems": ["grid and layout patterns"]
  },
  "themeFiles": [
    {
      "filename": "style.css",
      "purpose": "Main stylesheet with unified design system",
      "content": "Complete CSS code"
    },
    {
      "filename": "index.php", 
      "purpose": "Default template with WordPress loop",
      "content": "Complete PHP template code"
    }
    // ... additional theme files
  ],
  "implementationGuide": {
    "setupInstructions": ["step-by-step theme setup"],
    "customizationOptions": ["available theme customizer options"],
    "maintenanceNotes": ["ongoing maintenance considerations"]
  }
}

Provide a complete, unified WordPress theme that successfully combines all analyzed sources into a cohesive, professional theme with full WordPress functionality.`;

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
      'wordpress_theme_from_static', 
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
    
    // Aggregate results into theme-specific analysis format
    const aggregatedResult = {
      summary: `Static site directory analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        htmlFiles: fileAnalysisResults.filter(f => f.extension === '.html').length,
        cssFiles: fileAnalysisResults.filter(f => f.extension === '.css').length,
        jsFiles: fileAnalysisResults.filter(f => f.extension === '.js').length,
        imageFiles: fileAnalysisResults.filter(f => ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(f.extension)).length,
        designPatterns: this.extractDesignPatterns(fileAnalysisResults),
        pageTypes: this.identifyPageTypes(fileAnalysisResults)
      }
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now() - Date.now(),
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async performMultiUrlAnalysis(
    urls: string[],
    params: any,
    model: any,
    contextLength: number
  ): Promise<any> {
    // For URL analysis, we'll create a structured analysis result
    // Note: Actual URL fetching would require additional implementation
    const analysisResult = {
      summary: `Multi-URL static site analysis of ${urls.length} pages`,
      findings: urls.map(url => ({
        url,
        pageType: this.guessPageTypeFromUrl(url),
        analysisNote: `URL analysis - would require fetch implementation for actual content`
      })),
      data: {
        urlCount: urls.length,
        estimatedPageTypes: urls.map(url => this.guessPageTypeFromUrl(url)),
        conversionComplexity: urls.length > 5 ? 'high' : urls.length > 2 ? 'medium' : 'low'
      }
    };
    
    return analysisResult;
  }

  private async analyzeIndividualFile(file: string, params: any, model: any): Promise<any> {
    const content = await import('fs/promises').then(fs => fs.readFile(file, 'utf-8'));
    const stats = await import('fs/promises').then(fs => fs.stat(file));
    
    // Static site specific analysis
    const isHtmlFile = extname(file).toLowerCase() === '.html';
    const isCssFile = extname(file).toLowerCase() === '.css';
    const isJsFile = extname(file).toLowerCase() === '.js';
    
    let pageType = 'unknown';
    if (isHtmlFile) {
      pageType = this.identifyHtmlPageType(basename(file), content);
    }
    
    return {
      filePath: file,
      fileName: basename(file),
      size: content.length,
      lines: content.split('\n').length,
      extension: extname(file),
      relativePath: relative(params.projectPath || '', file),
      isHtmlFile,
      isCssFile,
      isJsFile,
      pageType,
      hasBootstrap: content.includes('bootstrap'),
      hasJQuery: content.includes('jquery'),
      hasResponsiveDesign: content.includes('@media'),
      hasCustomFonts: content.includes('@font-face') || content.includes('googleapis.com/css')
    };
  }

  private identifyHtmlPageType(filename: string, content: string): string {
    const lowerName = filename.toLowerCase();
    const lowerContent = content.toLowerCase();
    
    if (lowerName.includes('index') || lowerName.includes('home')) return 'homepage';
    if (lowerName.includes('about')) return 'about-page';
    if (lowerName.includes('contact')) return 'contact-page';
    if (lowerName.includes('blog')) return 'blog-page';
    if (lowerName.includes('service')) return 'services-page';
    if (lowerName.includes('portfolio') || lowerName.includes('work')) return 'portfolio-page';
    if (lowerName.includes('product')) return 'product-page';
    if (lowerName.includes('news')) return 'news-page';
    
    // Content-based detection
    if (lowerContent.includes('blog') && lowerContent.includes('post')) return 'blog-page';
    if (lowerContent.includes('contact') && lowerContent.includes('form')) return 'contact-page';
    if (lowerContent.includes('portfolio') || lowerContent.includes('gallery')) return 'portfolio-page';
    
    return 'content-page';
  }

  private guessPageTypeFromUrl(url: string): string {
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.includes('/blog') || lowerUrl.includes('/news')) return 'blog-page';
    if (lowerUrl.includes('/about')) return 'about-page';
    if (lowerUrl.includes('/contact')) return 'contact-page';
    if (lowerUrl.includes('/services')) return 'services-page';
    if (lowerUrl.includes('/portfolio') || lowerUrl.includes('/work')) return 'portfolio-page';
    if (lowerUrl.includes('/products')) return 'product-page';
    if (lowerUrl.endsWith('/') || lowerUrl.includes('index')) return 'homepage';
    
    return 'content-page';
  }

  private extractDesignPatterns(results: any[]): any {
    const patterns = {
      hasBootstrap: results.some(f => f.hasBootstrap),
      hasJQuery: results.some(f => f.hasJQuery),
      hasResponsiveDesign: results.some(f => f.hasResponsiveDesign),
      hasCustomFonts: results.some(f => f.hasCustomFonts),
      commonFrameworks: []
    };
    
    if (patterns.hasBootstrap) patterns.commonFrameworks.push('Bootstrap');
    if (patterns.hasJQuery) patterns.commonFrameworks.push('jQuery');
    
    return patterns;
  }

  private identifyPageTypes(results: any[]): string[] {
    const pageTypes = new Set<string>();
    
    results.forEach(result => {
      if (result.pageType && result.pageType !== 'unknown') {
        pageTypes.add(result.pageType);
      }
    });
    
    return Array.from(pageTypes);
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'simple': ['.html', '.css', '.js'],
      'responsive': ['.html', '.css', '.js', '.scss', '.sass', '.less'],
      'comprehensive': ['.html', '.htm', '.css', '.js', '.scss', '.sass', '.less', '.json', '.xml', '.svg', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.woff', '.woff2', '.ttf', '.eot']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default WordPressThemeFromStaticGenerator;