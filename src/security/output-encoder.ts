/**
 * Output Encoding and Sanitisation
 * 
 * Provides safe encoding of LLM outputs for different contexts
 * preventing XSS and other injection attacks in responses
 */

export type OutputContext = 'html' | 'json' | 'markdown' | 'plain-text' | 'code' | 'xml';

export interface EncodingOptions {
  context: OutputContext;
  preserveFormatting?: boolean;
  allowedTags?: string[];
  maxLength?: number;
}

export interface EncodingResult {
  encoded: string;
  truncated: boolean;
  removedElements: string[];
  warnings: string[];
}

export class OutputEncoder {
  
  // HTML entities for safe encoding
  private static readonly HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '\\': '&#x5C;',
    '`': '&#x60;'
  };
  
  // Safe HTML tags that can be preserved
  private static readonly SAFE_HTML_TAGS = [
    'p', 'br', 'strong', 'em', 'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
  ];
  
  // Dangerous patterns that should be removed regardless of context
  // REDUCED SCOPE: Only truly malicious patterns, not legitimate code constructs
  private static readonly DANGEROUS_PATTERNS = [
    // Only script tags with obviously malicious content
    /<script[^>]*>[^<]*(?:document\.cookie|window\.location|eval\(|setTimeout\(|setInterval\()[^<]*<\/script>/gi,
    
    // Only javascript: URLs (these are almost never legitimate in generated content)
    /href\s*=\s*["']javascript:[^"']*["']/gi,
    /src\s*=\s*["']javascript:[^"']*["']/gi,
    
    // Data URLs with script content (high risk)
    /data:text\/html[^"'>]*<script/gi,
    
    // Only CSS expressions (IE-specific XSS vector)
    /style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi
  ];
  
  /**
   * Encode output based on context
   */
  static encode(
    content: any,
    options: EncodingOptions
  ): EncodingResult {
    const warnings: string[] = [];
    const removedElements: string[] = [];
    let truncated = false;
    
    // Convert to string if not already
    let text = typeof content === 'string' ? content : JSON.stringify(content);
    
    // Apply length limits
    if (options.maxLength && text.length > options.maxLength) {
      text = text.substring(0, options.maxLength);
      truncated = true;
      warnings.push(`Content truncated to ${options.maxLength} characters`);
    }
    
    // Remove dangerous patterns first
    for (const pattern of this.DANGEROUS_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        removedElements.push(...matches);
        text = text.replace(pattern, '[REMOVED FOR SECURITY]');
        warnings.push(`Removed ${matches.length} dangerous element(s)`);
      }
    }
    
    // Context-specific encoding
    let encoded: string;
    
    switch (options.context) {
      case 'html':
        encoded = this.encodeForHtml(text, options);
        break;
      
      case 'json':
        encoded = this.encodeForJson(text);
        break;
      
      case 'markdown':
        encoded = this.encodeForMarkdown(text);
        break;
      
      case 'code':
        encoded = this.encodeForCode(text);
        break;
      
      case 'xml':
        encoded = this.encodeForXml(text);
        break;
      
      case 'plain-text':
      default:
        encoded = this.encodeForPlainText(text);
        break;
    }
    
    return {
      encoded,
      truncated,
      removedElements,
      warnings
    };
  }
  
  /**
   * Encode for HTML context
   */
  private static encodeForHtml(text: string, options: EncodingOptions): string {
    let encoded = text;
    
    if (options.preserveFormatting && options.allowedTags) {
      // Preserve specified safe tags
      encoded = this.sanitiseHtmlWithWhitelist(encoded, options.allowedTags);
    } else {
      // Escape all HTML entities
      encoded = this.escapeHtmlEntities(encoded);
    }
    
    return encoded;
  }
  
  /**
   * Encode for JSON context
   */
  private static encodeForJson(text: string): string {
    // Escape special JSON characters
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\f/g, '\\f');
      // Removed .replace(/\b/g, '\\b') - was incorrectly escaping word boundaries
  }
  
  /**
   * Encode for Markdown context
   */
  private static encodeForMarkdown(text: string): string {
    // Escape Markdown special characters that could be used maliciously
    return text
      .replace(/\[([^\]]*)\]\([^)]*javascript:[^)]*\)/gi, '[$1](javascript-link-removed)')
      .replace(/!\[([^\]]*)\]\([^)]*javascript:[^)]*\)/gi, '![$1](javascript-link-removed)')
      .replace(/<([^>]*javascript:[^>]*)>/gi, '&lt;javascript-link-removed&gt;');
  }
  
  /**
   * Encode for code context
   */
  private static encodeForCode(text: string): string {
    // For code context, we're less aggressive - only comment out truly dangerous functions
    // This preserves HTML/CSS/legitimate code while preventing execution of dangerous JS
    let encoded = text;
    
    // Only comment out dangerous eval-like functions, not CSS properties or HTML attributes
    encoded = encoded.replace(/\beval\s*\(/gi, '/* eval */ (');
    encoded = encoded.replace(/\bnew\s+Function\s*\(/gi, '/* new Function */ (');
    
    // Leave setTimeout/setInterval alone as they're common in legitimate code
    // Leave HTML/CSS content untouched
    
    return encoded;
  }
  
  /**
   * Encode for XML context
   */
  private static encodeForXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  
  /**
   * Encode for plain text context
   */
  private static encodeForPlainText(text: string): string {
    // Remove control characters and normalize whitespace
    return text
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  /**
   * Escape HTML entities
   */
  private static escapeHtmlEntities(text: string): string {
    return text.replace(/[&<>"'\/\\`]/g, (char) => this.HTML_ENTITIES[char] || char);
  }
  
  /**
   * Sanitise HTML while preserving whitelisted tags
   */
  private static sanitiseHtmlWithWhitelist(text: string, allowedTags: string[]): string {
    // This is a basic implementation - in production, use a library like DOMPurify
    let sanitised = text;
    
    // Remove all tags except allowed ones
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    
    sanitised = sanitised.replace(tagRegex, (match, tagName) => {
      if (allowedTags.includes(tagName.toLowerCase())) {
        // Remove any attributes that might be dangerous
        return match.replace(/\s+(on\w+|href|src|style)\s*=\s*["'][^"']*["']/gi, '');
      }
      // Remove the tag entirely
      return '';
    });
    
    return sanitised;
  }
  
  /**
   * Encode streaming response chunks safely
   */
  static encodeStreamChunk(
    chunk: string,
    context: OutputContext,
    chunkIndex: number
  ): { encoded: string; safe: boolean; warnings: string[] } {
    const warnings: string[] = [];
    let safe = true;
    
    // Check for injection patterns in chunk
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(chunk)) {
        safe = false;
        warnings.push(`Dangerous pattern detected in chunk ${chunkIndex}`);
      }
    }
    
    // Encode based on context
    const result = this.encode(chunk, { context });
    
    return {
      encoded: result.encoded,
      safe,
      warnings: [...warnings, ...result.warnings]
    };
  }
  
  /**
   * Batch encode multiple outputs
   */
  static encodeBatch(
    contents: string[],
    options: EncodingOptions
  ): EncodingResult[] {
    return contents.map(content => this.encode(content, options));
  }
  
  /**
   * Create safe output object for API responses
   */
  static createSafeResponse(
    data: any,
    context: OutputContext = 'json'
  ): { data: any; metadata: { encoded: boolean; warnings: string[] } } {
    const warnings: string[] = [];
    let encoded = data;
    
    if (typeof data === 'object' && data !== null) {
      encoded = this.encodeObjectRecursively(data, context, warnings);
    } else if (typeof data === 'string') {
      const result = this.encode(data, { context });
      encoded = result.encoded;
      warnings.push(...result.warnings);
    }
    
    return {
      data: encoded,
      metadata: {
        encoded: true,
        warnings
      }
    };
  }
  
  /**
   * Recursively encode object properties
   */
  private static encodeObjectRecursively(
    obj: any,
    context: OutputContext,
    warnings: string[]
  ): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.encodeObjectRecursively(item, context, warnings));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          const encodingResult = this.encode(value, { context });
          result[key] = encodingResult.encoded;
          warnings.push(...encodingResult.warnings);
        } else {
          result[key] = this.encodeObjectRecursively(value, context, warnings);
        }
      }
      return result;
    }
    
    return obj;
  }
  
  /**
   * Validate encoding is working correctly
   */
  static validateEncoding(): { passed: boolean; errors: string[] } {
    const errors: string[] = [];
    
    const testCases = [
      {
        input: '<script>alert("xss")</script>',
        context: 'html' as OutputContext,
        shouldContain: '&lt;script&gt;'
      },
      {
        input: '{"injection": "\\"}; alert(1); {"',
        context: 'json' as OutputContext,
        shouldContain: '\\"'
      },
      {
        input: '[Click here](javascript:alert(1))',
        context: 'markdown' as OutputContext,
        shouldContain: 'javascript-link-removed'
      }
    ];
    
    for (const testCase of testCases) {
      const result = this.encode(testCase.input, { context: testCase.context });
      if (!result.encoded.includes(testCase.shouldContain)) {
        errors.push(`Encoding failed for ${testCase.context}: expected "${testCase.shouldContain}" in result`);
      }
    }
    
    return {
      passed: errors.length === 0,
      errors
    };
  }
}