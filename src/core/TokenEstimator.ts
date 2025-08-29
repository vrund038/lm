/**
 * Token Estimator - Intelligent token counting for different content types
 * 
 * This utility provides accurate token estimation for various input types
 * to help the Context Window Manager make informed chunking decisions.
 */

export interface TokenEstimatorConfig {
  contextLimit: number;
  estimationFactor: number;
}

export class TokenEstimator {
  private config: TokenEstimatorConfig;
  private tokenCache = new Map<string, number>();

  constructor(config: TokenEstimatorConfig) {
    this.config = config;
  }

  /**
   * Estimate tokens for various input types
   */
  estimateTokens(input: any, pluginName?: string): number {
    if (input === null || input === undefined) {
      return 0;
    }

    // Check cache first for strings
    if (typeof input === 'string') {
      const cached = this.tokenCache.get(input);
      if (cached !== undefined) {
        return cached;
      }
    }

    let tokens = 0;

    if (typeof input === 'string') {
      tokens = this.estimateStringTokens(input);
    } else if (Array.isArray(input)) {
      tokens = this.estimateArrayTokens(input);
    } else if (typeof input === 'object') {
      tokens = this.estimateObjectTokens(input);
    } else {
      // Fallback for other types
      tokens = this.estimateStringTokens(String(input));
    }

    // Apply plugin-specific adjustments
    tokens = this.applyPluginAdjustments(tokens, pluginName);

    // Apply estimation factor
    tokens = Math.ceil(tokens * this.config.estimationFactor);

    // Cache string results
    if (typeof input === 'string' && input.length < 10000) {
      this.tokenCache.set(input, tokens);
    }

    return tokens;
  }

  /**
   * Estimate tokens for string content
   */
  private estimateStringTokens(text: string): number {
    if (!text) return 0;

    // Different estimation methods based on content type
    if (this.isCode(text)) {
      return this.estimateCodeTokens(text);
    } else if (this.isStructuredData(text)) {
      return this.estimateStructuredTokens(text);
    } else {
      return this.estimateNaturalLanguageTokens(text);
    }
  }

  /**
   * Estimate tokens for code content
   */
  private estimateCodeTokens(code: string): number {
    // Code typically has more tokens per character due to symbols and keywords
    // Remove comments and whitespace for more accurate counting
    const cleanCode = this.removeCodeComments(code);
    const codeTokens = cleanCode.split(/[\s\(\)\{\}\[\];,\.]+/).filter(token => token.length > 0);
    
    // Add overhead for symbols and operators
    const symbolCount = (code.match(/[{}\[\]();,.=+\-*\/]/g) || []).length;
    
    return codeTokens.length + Math.ceil(symbolCount * 0.5);
  }

  /**
   * Estimate tokens for natural language
   */
  private estimateNaturalLanguageTokens(text: string): number {
    // GPT-style estimation: roughly 3-4 characters per token for English
    // Adjust based on language complexity
    const avgCharsPerToken = this.detectLanguageComplexity(text);
    return Math.ceil(text.length / avgCharsPerToken);
  }

  /**
   * Estimate tokens for structured data (JSON, XML, etc.)
   */
  private estimateStructuredTokens(text: string): number {
    // Structured data has predictable token patterns
    try {
      if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        const parsed = JSON.parse(text);
        return this.estimateObjectTokens(parsed);
      }
    } catch {
      // Not valid JSON, fall back to character counting
    }
    
    // Count structural elements
    const structuralTokens = (text.match(/[{}\[\]":,]/g) || []).length;
    const contentLength = text.replace(/[{}\[\]":,\s]/g, '').length;
    
    return structuralTokens + Math.ceil(contentLength / 4);
  }

  /**
   * Estimate tokens for array content
   */
  private estimateArrayTokens(array: any[]): number {
    let totalTokens = 2; // Array brackets
    
    for (const item of array) {
      totalTokens += this.estimateTokens(item);
      totalTokens += 1; // Comma separator
    }
    
    return totalTokens;
  }

  /**
   * Estimate tokens for object content
   */
  private estimateObjectTokens(obj: object): number {
    let totalTokens = 2; // Object braces
    
    for (const [key, value] of Object.entries(obj)) {
      totalTokens += this.estimateTokens(key); // Key
      totalTokens += 1; // Colon
      totalTokens += this.estimateTokens(value); // Value
      totalTokens += 1; // Comma
    }
    
    return totalTokens;
  }

  /**
   * Apply plugin-specific token adjustments
   */
  private applyPluginAdjustments(tokens: number, pluginName?: string): number {
    if (!pluginName) return tokens;

    // Plugin-specific multipliers based on prompt complexity
    const adjustments: Record<string, number> = {
      'analyze_single_file': 1.3, // Complex analysis prompts
      'security_audit': 1.4, // Detailed security analysis
      'generate_unit_tests': 1.2, // Test generation overhead
      'generate_documentation': 1.1, // Documentation formatting
      'trace_execution_path': 1.5, // Complex tracing analysis
      'find_pattern_usage': 1.3, // Pattern matching complexity
      'compare_integration': 1.4, // Multi-file comparison
      'analyze_project_structure': 1.5, // Comprehensive project analysis
      'generate_wordpress_plugin': 1.6, // Large code generation
      'convert_to_typescript': 1.2, // Type conversion overhead
    };

    const multiplier = adjustments[pluginName] || 1.0;
    return Math.ceil(tokens * multiplier);
  }

  /**
   * Detect if content is code
   */
  private isCode(text: string): boolean {
    const codeIndicators = [
      'function', 'class', 'const', 'let', 'var', 'import', 'export',
      '=>', '{', '}', '()', ';', '//', '/*', '*/', '<?php', 'def ', 'if __name__'
    ];
    
    const indicatorCount = codeIndicators.reduce((count, indicator) => {
      return count + (text.includes(indicator) ? 1 : 0);
    }, 0);
    
    return indicatorCount >= 2;
  }

  /**
   * Detect if content is structured data
   */
  private isStructuredData(text: string): boolean {
    const trimmed = text.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      trimmed.startsWith('<?xml') ||
      trimmed.includes('<html')
    );
  }

  /**
   * Remove comments from code for cleaner token counting
   */
  private removeCodeComments(code: string): string {
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '') // Block comments
      .replace(/\/\/.*$/gm, '') // Line comments
      .replace(/^\s*#.*$/gm, '') // Python comments
      .replace(/<!--[\s\S]*?-->/g, ''); // HTML comments
  }

  /**
   * Detect language complexity for token estimation
   */
  private detectLanguageComplexity(text: string): number {
    // More complex languages have more tokens per character
    if (this.containsCJK(text)) {
      return 2.5; // Chinese, Japanese, Korean are more token-dense
    } else if (this.containsComplexScripts(text)) {
      return 3.0; // Arabic, Hebrew, etc.
    } else if (this.isVeryTechnical(text)) {
      return 3.2; // Technical content with many specialized terms
    } else {
      return 3.8; // Standard English text
    }
  }

  /**
   * Check if text contains CJK characters
   */
  private containsCJK(text: string): boolean {
    return /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff]/.test(text);
  }

  /**
   * Check if text contains complex scripts
   */
  private containsComplexScripts(text: string): boolean {
    return /[\u0600-\u06ff\u0590-\u05ff\u0700-\u074f]/.test(text);
  }

  /**
   * Check if text is very technical
   */
  private isVeryTechnical(text: string): boolean {
    const technicalTerms = [
      'algorithm', 'implementation', 'architecture', 'methodology', 
      'optimization', 'configuration', 'initialization', 'synchronization',
      'authentication', 'authorization', 'encryption', 'serialization'
    ];
    
    const technicalCount = technicalTerms.reduce((count, term) => {
      return count + (text.toLowerCase().includes(term) ? 1 : 0);
    }, 0);
    
    return technicalCount >= 3;
  }

  /**
   * Get estimation statistics
   */
  getStats(): {
    cacheSize: number;
    contextLimit: number;
    estimationFactor: number;
  } {
    return {
      cacheSize: this.tokenCache.size,
      contextLimit: this.config.contextLimit,
      estimationFactor: this.config.estimationFactor
    };
  }

  /**
   * Clear the token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
  }

  /**
   * Estimate tokens for a complete plugin execution
   * Including prompt overhead and response tokens
   */
  estimatePluginExecution(params: any, pluginName: string): {
    inputTokens: number;
    promptOverhead: number;
    estimatedResponseTokens: number;
    totalEstimated: number;
  } {
    const inputTokens = this.estimateTokens(params, pluginName);
    const promptOverhead = this.getPromptOverhead(pluginName);
    const estimatedResponseTokens = this.estimateResponseTokens(pluginName, inputTokens);
    
    return {
      inputTokens,
      promptOverhead,
      estimatedResponseTokens,
      totalEstimated: inputTokens + promptOverhead + estimatedResponseTokens
    };
  }

  /**
   * Get prompt overhead for different plugin types
   */
  private getPromptOverhead(pluginName: string): number {
    const overheads: Record<string, number> = {
      'analyze_single_file': 200,
      'security_audit': 300,
      'generate_unit_tests': 150,
      'generate_documentation': 100,
      'trace_execution_path': 250,
      'find_pattern_usage': 200,
      'compare_integration': 300,
      'analyze_project_structure': 400,
      'generate_wordpress_plugin': 500,
      'convert_to_typescript': 180,
    };

    return overheads[pluginName] || 100;
  }

  /**
   * Estimate response token count based on plugin type and input size
   */
  private estimateResponseTokens(pluginName: string, inputTokens: number): number {
    // Response size is typically proportional to input size but varies by plugin type
    const responseRatios: Record<string, number> = {
      'analyze_single_file': 0.3, // Analysis is typically shorter than input
      'security_audit': 0.8, // Comprehensive reports can be large
      'generate_unit_tests': 1.2, // Tests can be larger than original code
      'generate_documentation': 0.6, // Documentation is substantial but not huge
      'trace_execution_path': 0.4, // Trace results are structured summaries
      'find_pattern_usage': 0.2, // Pattern results are typically concise
      'compare_integration': 0.5, // Comparison results are moderate
      'analyze_project_structure': 0.7, // Project analysis is comprehensive
      'generate_wordpress_plugin': 3.0, // Code generation is much larger
      'convert_to_typescript': 1.1, // TypeScript is slightly larger than JS
    };

    const ratio = responseRatios[pluginName] || 0.3;
    return Math.ceil(inputTokens * ratio);
  }
}
