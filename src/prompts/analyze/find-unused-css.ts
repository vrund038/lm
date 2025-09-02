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
import { CssParser } from '../../utils/css-parser.js';

// Common Node.js modules
import { basename, relative } from 'path';
import { readFile } from 'fs/promises';

export class FindUnusedCSSAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'find_unused_css';
  category = 'analyze' as const;
  description = 'Analyze CSS usage and identify unused selectors for performance optimization. Supports both URL analysis and local file analysis.';
  
  // Universal parameter set - supports both URL and local file scenarios
  parameters = {
    // URL analysis
    url: {
      type: 'string' as const,
      description: 'URL to analyze for CSS usage (single page)',
      required: false
    },
    
    // Single-file parameters
    cssPath: {
      type: 'string' as const,
      description: 'Path to CSS file to analyze',
      required: false
    },
    htmlPath: {
      type: 'string' as const,
      description: 'Path to HTML file to check CSS usage against',
      required: false
    },
    code: {
      type: 'string' as const,
      description: 'CSS code to analyze (for single-code analysis)',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Path to project directory containing HTML/CSS files',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Specific HTML/CSS file paths to analyze',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for file discovery',
      required: false,
      default: 3
    },
    
    // Analysis options
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of analysis detail',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of CSS analysis to perform',
      enum: ['performance', 'usage', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    includeMediaQueries: {
      type: 'boolean' as const,
      description: 'Include media query analysis',
      default: true,
      required: false
    },
    ignorePseudoSelectors: {
      type: 'boolean' as const,
      description: 'Ignore pseudo-selectors like :hover, :focus',
      default: false,
      required: false
    },
    
    // Compatibility
    language: {
      type: 'string' as const,
      description: 'File language (css, html)',
      required: false,
      default: 'css'
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to CSS file to analyze',
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
        // 1. Auto-detect analysis mode based on parameters
        const analysisMode = this.detectAnalysisMode(secureParams);
        
        // 2. Validate parameters based on detected mode
        this.validateParameters(secureParams, analysisMode);
        
        // 3. Setup model
        const { model, contextLength } = await ModelSetup.getReadyModel(llmClient);
        
        // 4. Route to appropriate analysis method
        if (analysisMode === 'url') {
          return await this.executeURLAnalysis(secureParams, model, contextLength);
        } else if (analysisMode === 'single-file') {
          return await this.executeSingleFileAnalysis(secureParams, model, contextLength);
        } else {
          return await this.executeMultiFileAnalysis(secureParams, model, contextLength);
        }
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('find_unused_css', error);
      }
    });
  }

  /**
   * Auto-detect whether this is URL, single-file or multi-file analysis
   */
  private detectAnalysisMode(params: any): 'url' | 'single-file' | 'multi-file' {
    // URL analysis takes priority
    if (params.url) {
      return 'url';
    }
    
    // Single-file indicators (CSS + optional HTML)
    if (params.code || params.cssPath || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default to single-file for CSS analysis
    return 'single-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'url' | 'single-file' | 'multi-file'): void {
    if (mode === 'url') {
      if (!params.url) {
        throw new Error('URL parameter is required for URL analysis');
      }
    } else if (mode === 'single-file') {
      if (!params.code && !params.cssPath && !params.filePath) {
        throw new Error('Either code, cssPath, or filePath is required for single-file analysis');
      }
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['performance', 'usage', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
  }

  /**
   * Execute URL analysis: Puppeteer -> CSS Parser -> Local LLM
   */
  private async executeURLAnalysis(params: any, model: any, contextLength: number) {
    // Step 1: Extract data from URL using Puppeteer
    const urlData = await this.extractURLDataWithPuppeteer(params.url);
    
    // Step 2: Process CSS with our utility
    const processedCSSData = this.processCSSData(urlData);
    
    // Step 3: Generate prompt stages for Local LLM
    const promptStages = this.getURLAnalysisPromptStages({
      ...params,
      urlData: processedCSSData
    });
    
    // Step 4: Execute with proper chunking
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
        'find_unused_css',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'find_unused_css'
      );
    }
  }

  /**
   * Execute single-file analysis: File -> CSS Parser -> Local LLM
   */
  private async executeSingleFileAnalysis(params: any, model: any, contextLength: number) {
    // Step 1: Process CSS input
    let cssContent = params.code;
    if (params.cssPath || params.filePath) {
      const filePath = params.cssPath || params.filePath;
      cssContent = await readFileContent(filePath);
    }

    // Step 2: Process optional HTML input
    let htmlContent = '';
    if (params.htmlPath) {
      htmlContent = await readFileContent(params.htmlPath);
    }
    
    // Step 3: Process with CSS Parser utility
    const processedData = this.processLocalCSSData(cssContent, htmlContent, params);
    
    // Step 4: Generate prompt stages
    const promptStages = this.getSingleFilePromptStages({
      ...params,
      processedData
    });
    
    // Step 5: Execute with proper chunking
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
        'find_unused_css',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'find_unused_css'
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
      'find_unused_css',
      'multifile'
    );
  }

  /**
   * Extract data from URL using Puppeteer (runs before LLM)
   */
  private async extractURLDataWithPuppeteer(url: string) {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      
      // Extract HTML content
      const htmlContent = await page.content();
      
      // Extract all CSS rules from stylesheets
      const cssData = await page.evaluate(() => {
        const cssRules: Array<{
          selector: string;
          cssText: string;
          sourceHref: string;
          media: string | null;
        }> = [];
        const usedSelectors = new Set<string>();
        
        // Get all stylesheets - use any to bypass TypeScript DOM checks
        const stylesheets = Array.from((globalThis as any).document.styleSheets);
        
        stylesheets.forEach((stylesheet: any) => {
          try {
            const rules = Array.from(stylesheet.cssRules || []);
            rules.forEach((rule: any) => {
              if (rule.selectorText) {
                cssRules.push({
                  selector: rule.selectorText,
                  cssText: rule.cssText,
                  sourceHref: stylesheet.href || 'inline',
                  media: rule.media ? rule.media.mediaText : null
                });
              }
            });
          } catch (e) {
            // Skip CORS-protected stylesheets - note this limitation
          }
        });
        
        // Test each selector to see if it's used
        cssRules.forEach(rule => {
          try {
            const elements = (globalThis as any).document.querySelectorAll(rule.selector);
            if (elements.length > 0) {
              usedSelectors.add(rule.selector);
            }
          } catch (e) {
            // Invalid selector - mark as potentially unused
          }
        });
        
        return {
          totalRules: cssRules.length,
          totalUsed: usedSelectors.size,
          rules: cssRules.map(rule => ({
            ...rule,
            isUsed: usedSelectors.has(rule.selector)
          })),
          pageTitle: (globalThis as any).document.title,
          pageUrl: (globalThis as any).window.location.href
        };
      });
      
      return {
        url,
        htmlContent,
        cssData,
        timestamp: new Date().toISOString()
      };
      
    } finally {
      await browser.close();
    }
  }

  /**
   * Process CSS data using our CSS parser utility
   */
  private processCSSData(urlData: any) {
    const { cssData, htmlContent } = urlData;
    
    // Use our CSS parser to get additional analysis
    const frameworks = CssParser.detectBasicFrameworks(htmlContent);
    
    // Process each stylesheet's rules
    const processedRules = cssData.rules.map((rule: any) => {
      return {
        selector: rule.selector,
        isUsed: rule.isUsed,
        source: rule.sourceHref,
        media: rule.media,
        cssText: rule.cssText
      };
    });
    
    // Group by usage status
    const usedRules = processedRules.filter((rule: any) => rule.isUsed);
    const unusedRules = processedRules.filter((rule: any) => !rule.isUsed);
    
    return {
      summary: {
        totalRules: cssData.totalRules,
        usedRules: usedRules.length,
        unusedRules: unusedRules.length,
        unusedPercentage: Math.round((unusedRules.length / cssData.totalRules) * 100),
        detectedFrameworks: frameworks
      },
      usedRules,
      unusedRules,
      pageInfo: {
        title: cssData.pageTitle,
        url: cssData.pageUrl,
        timestamp: urlData.timestamp
      }
    };
  }

  /**
   * Process local CSS data using our parser utility
   */
  private processLocalCSSData(cssContent: string, htmlContent: string, params: any) {
    // Extract selectors using our CSS parser
    const selectors = CssParser.extractSelectors(cssContent, params.cssPath || 'input');
    const frameworks = CssParser.detectBasicFrameworks(cssContent);
    const fileSizeKB = CssParser.getFileSizeKB(cssContent);
    
    // If we have HTML content, check usage
    let usedSelectors: string[] = [];
    let unusedSelectors = [...selectors];
    
    if (htmlContent) {
      // Simple check for selector usage in HTML
      selectors.forEach(sel => {
        const selectorText = sel.selector;
        
        // Basic usage detection (could be enhanced)
        if (this.isSelectorUsedInHTML(selectorText, htmlContent, params.ignorePseudoSelectors)) {
          usedSelectors.push(selectorText);
          unusedSelectors = unusedSelectors.filter(u => u.selector !== selectorText);
        }
      });
    }
    
    return {
      summary: {
        totalSelectors: selectors.length,
        usedSelectors: usedSelectors.length,
        unusedSelectors: unusedSelectors.length,
        unusedPercentage: htmlContent ? Math.round((unusedSelectors.length / selectors.length) * 100) : null,
        fileSizeKB,
        detectedFrameworks: frameworks,
        includeMediaQueries: params.includeMediaQueries
      },
      allSelectors: selectors,
      usedSelectors,
      unusedSelectors,
      hasHTML: !!htmlContent
    };
  }

  /**
   * Basic selector usage detection in HTML
   */
  private isSelectorUsedInHTML(selector: string, html: string, ignorePseudo: boolean = false): boolean {
    // Remove pseudo-selectors if requested
    if (ignorePseudo) {
      selector = selector.replace(/:(hover|focus|active|visited|link|first-child|last-child|nth-child\([^)]+\))/g, '');
    }
    
    // Extract class and ID selectors for basic matching
    const classMatches = selector.match(/\\.([a-zA-Z0-9_-]+)/g);
    const idMatches = selector.match(/#([a-zA-Z0-9_-]+)/g);
    const elementMatches = selector.match(/^[a-zA-Z][a-zA-Z0-9]*(?![.#])/);
    
    // Check for class usage
    if (classMatches) {
      for (const classMatch of classMatches) {
        const className = classMatch.substring(1); // Remove the dot
        if (html.includes(`class="${className}"`) || html.includes(`class='${className}'`) || 
            html.includes(`class="[^"]*${className}[^"]*"`) || html.includes(`class='[^']*${className}[^']*'`)) {
          return true;
        }
      }
    }
    
    // Check for ID usage
    if (idMatches) {
      for (const idMatch of idMatches) {
        const idName = idMatch.substring(1); // Remove the hash
        if (html.includes(`id="${idName}"`) || html.includes(`id='${idName}'`)) {
          return true;
        }
      }
    }
    
    // Check for element usage
    if (elementMatches) {
      const element = elementMatches[0];
      if (html.includes(`<${element}`) || html.includes(`</${element}`)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * URL analysis prompt stages
   */
  private getURLAnalysisPromptStages(params: any): PromptStages {
    const { urlData, analysisDepth, analysisType } = params;
    
    const systemAndContext = `You are an expert CSS performance analyst specializing in ${analysisDepth} ${analysisType} analysis of live websites.

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}
- Mode: Live URL Analysis
- URL: ${urlData.pageInfo.url}

Your Mission:
Analyze CSS usage patterns from a live website to identify performance optimization opportunities. Focus on unused selectors, CSS bloat, and optimization recommendations.

Your Expertise:
- CSS performance optimization and unused code detection
- Web performance analysis and Core Web Vitals impact
- Framework CSS analysis and cleanup strategies
- Cross-browser compatibility and selector efficiency
- CSS architecture and maintainability best practices

Analysis Methodology:
1. Examine the CSS usage data extracted from the live page
2. Identify genuinely unused selectors vs. dynamic/JS-dependent rules
3. Assess performance impact and optimization opportunities
4. Provide conservative recommendations that won't break functionality
5. Consider framework patterns and common CSS practices`;

    const dataPayload = `URL Analysis Data:

Page Information:
- Title: ${urlData.pageInfo.title}
- URL: ${urlData.pageInfo.url}
- Analysis Date: ${urlData.pageInfo.timestamp}

CSS Usage Summary:
- Total CSS Rules: ${urlData.summary.totalRules}
- Used Rules: ${urlData.summary.usedRules}
- Unused Rules: ${urlData.summary.unusedRules}
- Unused Percentage: ${urlData.summary.unusedPercentage}%
- Detected Frameworks: ${urlData.summary.detectedFrameworks.join(', ') || 'None detected'}

Unused CSS Rules (Sample):
${JSON.stringify(urlData.unusedRules.slice(0, 20), null, 2)}

Used CSS Rules (Sample):
${JSON.stringify(urlData.usedRules.slice(0, 10), null, 2)}

Note: Analysis based on current page state. Dynamic content and JavaScript interactions may affect actual usage.`;

    const outputInstructions = `Provide your URL CSS analysis in the following structured JSON format:

{
  "summary": "Executive summary of CSS usage and optimization opportunities",
  "unusedAnalysis": {
    "totalUnused": number,
    "percentage": number,
    "categories": {
      "safeToRemove": ["selectors that are definitely unused"],
      "requiresInvestigation": ["selectors that might be used by JS or dynamic content"],
      "frameworkRelated": ["selectors from detected frameworks"]
    }
  },
  "performanceImpact": {
    "estimatedSavings": "Estimated file size reduction",
    "loadTimeImpact": "Expected performance improvement",
    "coreWebVitalsImpact": "Impact on Core Web Vitals scores"
  },
  "recommendations": [
    {
      "action": "Specific optimization action",
      "impact": "high|medium|low",
      "effort": "low|medium|high", 
      "description": "Detailed explanation and implementation guidance"
    }
  ],
  "frameworkInsights": {
    "detectedFrameworks": ["list of frameworks"],
    "frameworkSpecificAdvice": "Advice for optimizing framework CSS"
  },
  "warnings": ["Important considerations before making changes"],
  "confidence": 0.85
}`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Single-file analysis prompt stages
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { processedData, analysisDepth, analysisType } = params;
    
    const systemAndContext = `You are an expert CSS code analyst specializing in ${analysisDepth} ${analysisType} analysis of CSS files.

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}
- Mode: Local File Analysis
- Has HTML Reference: ${processedData.hasHTML}

Your Mission:
Analyze CSS file structure and usage patterns to identify optimization opportunities, unused selectors, and code quality issues.

Your Expertise:
- CSS architecture and organization best practices
- Selector efficiency and performance optimization
- CSS maintainability and code quality assessment
- Framework detection and optimization strategies
- Cross-file dependency analysis and cleanup

Analysis Methodology:
1. Examine CSS structure and selector patterns
2. Identify potential unused or redundant selectors
3. Assess code organization and maintainability
4. Provide optimization recommendations
5. Consider framework patterns and modern CSS practices`;

    const dataPayload = `CSS File Analysis Data:

Summary:
- Total Selectors: ${processedData.summary.totalSelectors}
- File Size: ${processedData.summary.fileSizeKB} KB
- Detected Frameworks: ${processedData.summary.detectedFrameworks.join(', ') || 'None detected'}
${processedData.hasHTML ? `- Used Selectors: ${processedData.summary.usedSelectors}
- Unused Selectors: ${processedData.summary.unusedSelectors}
- Unused Percentage: ${processedData.summary.unusedPercentage}%` : '- HTML Reference: Not provided (usage analysis limited)'}

All Selectors:
${JSON.stringify(processedData.allSelectors, null, 2)}

${processedData.hasHTML ? `
Unused Selectors:
${JSON.stringify(processedData.unusedSelectors, null, 2)}
` : ''}`;

    const outputInstructions = `Provide your CSS file analysis in the following structured JSON format:

{
  "summary": "Overview of CSS file structure and quality",
  "fileAnalysis": {
    "structure": "Assessment of CSS organization and architecture",
    "complexity": "Code complexity and maintainability evaluation",
    "frameworks": ["detected frameworks and their usage patterns"]
  },
  ${processedData.hasHTML ? `"usageAnalysis": {
    "unusedSelectors": number,
    "usagePatterns": "Analysis of selector usage patterns",
    "potentialSavings": "Estimated optimization potential"
  },` : ''}
  "qualityIssues": [
    {
      "type": "Issue category",
      "severity": "high|medium|low",
      "description": "Detailed issue description",
      "selectors": ["affected selectors"],
      "recommendation": "How to fix this issue"
    }
  ],
  "optimizationOpportunities": [
    {
      "opportunity": "Specific optimization suggestion",
      "benefit": "Expected improvement",
      "implementation": "How to implement this optimization"
    }
  ],
  "recommendations": ["Priority recommendations for improvement"],
  "confidence": 0.85
}`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file analysis prompt stages
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount } = params;
    
    const systemAndContext = `You are an expert multi-file CSS analyst specializing in ${analysisDepth} ${analysisType} analysis across web projects.

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}
- Files Analyzed: ${fileCount}
- Mode: Multi-File Project Analysis

Your Mission:
Analyze CSS usage patterns across an entire web project to identify cross-file optimization opportunities, architectural issues, and comprehensive cleanup strategies.

Your Expertise:
- Project-wide CSS architecture and organization
- Cross-file CSS dependency analysis and optimization
- Multi-file unused code detection and cleanup strategies
- CSS performance optimization at project scale
- Framework integration and optimization across files

Analysis Methodology:
1. Examine cross-file CSS patterns and dependencies
2. Identify project-wide unused or redundant styles
3. Assess overall CSS architecture and organization
4. Provide comprehensive optimization strategy
5. Consider build process and deployment optimization`;

    const dataPayload = `Multi-File CSS Analysis Results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Provide your multi-file CSS analysis in the following structured JSON format:

{
  "summary": "Overall project CSS analysis and optimization potential",
  "projectAnalysis": {
    "architecture": "Assessment of project CSS organization",
    "totalSize": "Combined CSS file sizes",
    "frameworks": ["detected frameworks across project"],
    "duplicatePatterns": "Analysis of duplicate or redundant CSS across files"
  },
  "crossFileFindings": [
    {
      "type": "optimization|redundancy|architecture",
      "severity": "high|medium|low",
      "description": "Cross-file issue description",
      "affectedFiles": ["file1.css", "file2.css"],
      "recommendation": "How to optimize across files"
    }
  ],
  "optimizationStrategy": {
    "priorityOrder": ["recommended optimization sequence"],
    "estimatedSavings": "Project-wide optimization potential",
    "buildProcessRecommendations": "Suggestions for build optimization"
  },
  "recommendations": ["Priority project-wide recommendations"],
  "confidence": 0.85
}`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file helper methods
   */
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
      'find_unused_css', 
      params, 
      files
    );
    
    const cached = await this.analysisCache.get(cacheKey);
    if (cached) return cached;
    
    const fileAnalysisResults = await this.multiFileAnalysis.analyzeBatch(
      files,
      (file: string) => this.analyzeIndividualCSSFile(file, params, model),
      contextLength
    );
    
    // Aggregate results
    const aggregatedResult = {
      summary: `Multi-file CSS analysis of ${files.length} files`,
      files: fileAnalysisResults,
      totalSizeKB: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.sizeKB || 0), 0),
      totalSelectors: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.selectorCount || 0), 0),
      combinedFrameworks: [...new Set(fileAnalysisResults.flatMap((result: any) => result.frameworks || []))]
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now(),
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async analyzeIndividualCSSFile(file: string, params: any, model: any): Promise<any> {
    const content = await readFile(file, 'utf-8');
    const selectors = CssParser.extractSelectors(content, file);
    const frameworks = CssParser.detectBasicFrameworks(content);
    const sizeKB = CssParser.getFileSizeKB(content);
    
    return {
      filePath: file,
      fileName: basename(file),
      sizeKB,
      selectorCount: selectors.length,
      frameworks,
      relativePath: relative(params.projectPath || '', file),
      selectors: selectors.slice(0, 10) // Sample for analysis
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'performance': ['.css', '.scss', '.sass', '.less'],
      'usage': ['.css', '.html', '.htm', '.php', '.jsx', '.tsx', '.vue'],
      'comprehensive': ['.css', '.scss', '.sass', '.less', '.html', '.htm', '.php', '.jsx', '.tsx', '.vue']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  /**
   * For backwards compatibility
   */
  getPromptStages(params: any): PromptStages {
    const mode = this.detectAnalysisMode(params);
    
    if (mode === 'url') {
      // This shouldn't be called for URL mode as it requires async processing
      throw new Error('URL analysis requires async processing - use execute method');
    } else if (mode === 'single-file') {
      return this.getSingleFilePromptStages(params);
    } else {
      return this.getMultiFilePromptStages(params);
    }
  }
}

export default FindUnusedCSSAnalyzer;