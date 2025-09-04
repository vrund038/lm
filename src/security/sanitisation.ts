/**
 * Sanitisation I/O Helper Module
 * Provides comprehensive input/output sanitisation for the Houtini LM MCP
 * 
 * Architecture Integration:
 * - Input: Sanitise user parameters before plugin execution
 * - Output: Clean LLM responses before returning to client
 * - File: Validate and clean file content before processing
 */

import { readFileSync } from 'fs';
import { resolve, normalize, isAbsolute } from 'path';

// Get config at runtime to avoid circular dependencies
function getConfig() {
  try {
    // DIRECT FIX: Use environment variables directly instead of config loading
    const envDirs = process.env.LLM_MCP_ALLOWED_DIRS;
    const allowedDirectories = envDirs ? envDirs.split(',') : ['C:\\MCP', 'C:\\DEV'];
    
    return {
      security: {
        allowedDirectories: allowedDirectories,
        maxInputSize: {
          'file-path': 1000,
          'code': 100000,
          'general': 50000,
          'prompt': 20000
        }
      }
    };
  } catch {
    // Fallback configuration
    return {
      security: {
        allowedDirectories: ['C:\\MCP', 'C:\\DEV'],
        maxInputSize: {
          'file-path': 1000,
          'code': 100000,
          'general': 50000,
          'prompt': 20000
        }
      }
    };
  }
}

// Security patterns for prompt injection detection
const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction manipulation
  /ignore\s+(previous|all|your)\s+instructions?/i,
  /forget\s+(everything|all|previous)/i,
  /new\s+instructions?/i,
  /system\s*[:;]\s*/i,
  /override\s+security/i,
  
  // Role manipulation attempts
  /you\s+are\s+now\s+(a|an)/i,
  /act\s+as\s+(if|a|an)/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /roleplay\s+as/i,
  
  // Data extraction attempts
  /show\s+me\s+(your|the)\s+(system|prompt|instructions)/i,
  /what\s+(is|are)\s+(your|the)\s+(instructions|system)/i,
  /reveal\s+(your|the)\s+prompt/i,
  
  // Script injection patterns
  /<script[^>]*>/i,
  /javascript\s*:/i,
  /on\w+\s*=\s*["\']?[^"'>]*["\']?/i,
  /eval\s*\(/i,
  /function\s*\(/i,
  
  // Command injection patterns
  /;\s*(rm|del|format|shutdown|reboot)/i,
  /\|\s*(curl|wget|nc|netcat)/i,
  /&&\s*(cat|ls|dir|type)/i,
  
  // Path traversal in prompts
  /\.\.\/|\.\.\\/i,
  /%2e%2e%2f|%2e%2e%5c/i
];

// HTML entities for output encoding
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;'
};

// Allowed file extensions for processing
const ALLOWED_FILE_EXTENSIONS = [
  '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', '.py', '.php',
  '.html', '.css', '.xml', '.yml', '.yaml', '.sql', '.sh', '.bat'
];

export interface SanitisationResult {
  cleaned: string;
  warnings: string[];
  blocked: boolean;
  reason?: string;
}

export interface FileSanitisationResult extends SanitisationResult {
  path: string;
  size: number;
  encoding: string;
}

export class SanitisationHelper {
  
  /**
   * Sanitise user input parameters before plugin execution
   */
  static sanitiseInput(input: any, context: string = 'general'): SanitisationResult {
    const warnings: string[] = [];
    
    if (typeof input !== 'string') {
      if (typeof input === 'object') {
        return this.sanitiseObject(input, context);
      }
      return {
        cleaned: String(input),
        warnings: [],
        blocked: false
      };
    }
    
    let cleaned = input;
    
    // Check for prompt injection patterns
    const injectionCheck = this.detectPromptInjection(cleaned);
    if (injectionCheck.detected) {
      return {
        cleaned: '',
        warnings: injectionCheck.patterns,
        blocked: true,
        reason: 'Potential prompt injection detected'
      };
    }
    
    // Remove null bytes (security risk)
    if (cleaned.includes('\0')) {
      cleaned = cleaned.replace(/\0/g, '');
      warnings.push('Null bytes removed from input');
    }
    
    // Limit input size based on context
    const maxSize = this.getMaxInputSize(context);
    if (cleaned.length > maxSize) {
      cleaned = cleaned.substring(0, maxSize);
      warnings.push(`Input truncated to ${maxSize} characters`);
    }
    
    // Context-specific sanitisation
    if (context === 'file-path') {
      const pathResult = this.sanitiseFilePath(cleaned);
      return {
        cleaned: pathResult.cleaned,
        warnings: [...warnings, ...pathResult.warnings],
        blocked: pathResult.blocked,
        reason: pathResult.reason
      };
    }
    
    if (context === 'code') {
      cleaned = this.sanitiseCode(cleaned);
    }
    
    return {
      cleaned,
      warnings,
      blocked: false
    };
  }
  
  /**
   * Sanitise object parameters recursively
   */
  private static sanitiseObject(obj: any, context: string): SanitisationResult {
    const warnings: string[] = [];
    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const result = this.sanitiseInput(value, context);
        if (result.blocked) {
          return result;
        }
        cleaned[key] = result.cleaned;
        warnings.push(...result.warnings);
      } else if (typeof value === 'object' && value !== null) {
        const result = this.sanitiseObject(value, context);
        if (result.blocked) {
          return result;
        }
        cleaned[key] = result.cleaned;
        warnings.push(...result.warnings);
      } else {
        cleaned[key] = value;
      }
    }
    
    return {
      cleaned,
      warnings,
      blocked: false
    };
  }
  
  /**
   * Sanitise file paths to prevent traversal attacks
   */
  static sanitiseFilePath(filePath: string): SanitisationResult {
    const warnings: string[] = [];
    
    // Check for path traversal sequences
    if (filePath.includes('..')) {
      return {
        cleaned: '',
        warnings: ['Path traversal sequence detected'],
        blocked: true,
        reason: 'Path traversal attempt blocked'
      };
    }
    
    // Normalize and resolve path
    let cleaned: string;
    try {
      cleaned = normalize(resolve(filePath));
    } catch (error) {
      return {
        cleaned: '',
        warnings: ['Invalid path format'],
        blocked: true,
        reason: 'Path resolution failed'
      };
    }
    
    // Check if path is within allowed directories
    const config = getConfig();
    const allowedDirs = config.security?.allowedDirectories || [process.cwd()];
    
    if (allowedDirs.length > 0) {
      const isAllowed = allowedDirs.some(dir => cleaned.startsWith(resolve(dir)));
      if (!isAllowed) {
        return {
          cleaned: '',
          warnings: ['Path outside allowed directories'],
          blocked: true,
          reason: 'Access to path denied'
        };
      }
    }
    
    // Check file extension
    const ext = cleaned.toLowerCase().split('.').pop();
    if (ext && !ALLOWED_FILE_EXTENSIONS.includes(`.${ext}`)) {
      warnings.push(`File extension .${ext} may not be safe to process`);
    }
    
    return {
      cleaned,
      warnings,
      blocked: false
    };
  }
  
  /**
   * Sanitise file content before processing
   */
  static sanitiseFileContent(filePath: string): FileSanitisationResult {
    const pathResult = this.sanitiseFilePath(filePath);
    if (pathResult.blocked) {
      return {
        ...pathResult,
        path: filePath,
        size: 0,
        encoding: 'unknown'
      };
    }
    
    try {
      const content = readFileSync(pathResult.cleaned, 'utf-8');
      const contentResult = this.sanitiseInput(content, 'code');
      
      return {
        cleaned: contentResult.cleaned,
        warnings: [...pathResult.warnings, ...contentResult.warnings],
        blocked: contentResult.blocked,
        reason: contentResult.reason,
        path: pathResult.cleaned,
        size: content.length,
        encoding: 'utf-8'
      };
    } catch (error) {
      return {
        cleaned: '',
        warnings: [`Failed to read file: ${error}`],
        blocked: true,
        reason: 'File read error',
        path: pathResult.cleaned,
        size: 0,
        encoding: 'unknown'
      };
    }
  }
  
  /**
   * Sanitise LLM output before returning to client
   */
  static sanitiseOutput(output: any, format: 'html' | 'text' | 'json' = 'text'): SanitisationResult {
    const warnings: string[] = [];
    
    if (typeof output !== 'string') {
      if (typeof output === 'object') {
        const cleaned = this.sanitiseObjectOutput(output, format);
        return {
          cleaned,
          warnings,
          blocked: false
        };
      }
      return {
        cleaned: String(output),
        warnings,
        blocked: false
      };
    }
    
    let cleaned = output;
    
    // Check for potential script injection in output
    if (format === 'html') {
      cleaned = this.escapeHtml(cleaned);
    }
    
    // Remove any potential prompt injection that might have leaked through
    const injectionCheck = this.detectPromptInjection(cleaned);
    if (injectionCheck.detected) {
      // Don't block output, but sanitise suspicious patterns
      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        cleaned = cleaned.replace(pattern, '[REDACTED]');
      }
      warnings.push('Potential prompt injection patterns sanitised in output');
    }
    
    return {
      cleaned,
      warnings,
      blocked: false
    };
  }
  
  /**
   * Escape HTML entities to prevent XSS
   */
  private static escapeHtml(text: string): string {
    return text.replace(/[&<>"'\/]/g, (char) => HTML_ENTITIES[char] || char);
  }
  
  /**
   * Sanitise object output recursively
   */
  private static sanitiseObjectOutput(obj: any, format: 'html' | 'text' | 'json'): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitiseObjectOutput(item, format));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          const sanitised = this.sanitiseOutput(value, format);
          result[key] = sanitised.cleaned;
        } else {
          result[key] = this.sanitiseObjectOutput(value, format);
        }
      }
      return result;
    }
    
    return obj;
  }
  
  /**
   * Detect potential prompt injection patterns
   */
  private static detectPromptInjection(text: string): { detected: boolean; patterns: string[] } {
    const detectedPatterns: string[] = [];
    
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        detectedPatterns.push(pattern.toString());
      }
    }
    
    return {
      detected: detectedPatterns.length > 0,
      patterns: detectedPatterns
    };
  }
  
  /**
   * Sanitise code content (basic cleanup)
   */
  private static sanitiseCode(code: string): string {
    // Remove potential eval() calls and other dangerous functions
    let cleaned = code.replace(/eval\s*\(/gi, '/* eval */ (');
    cleaned = cleaned.replace(/Function\s*\(/gi, '/* Function */ (');
    
    // Remove script tags if present
    cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    return cleaned;
  }
  
  /**
   * Get maximum input size based on context
   */
  private static getMaxInputSize(context: string): number {
    const config = getConfig();
    const limits = config.security?.maxInputSize || {
      'file-path': 1000,
      'code': 100000,
      'general': 50000,
      'prompt': 20000
    };
    
    return limits[context as keyof typeof limits] || limits.general;
  }
  
  /**
   * Validate that sanitisation is working correctly
   */
  static validateSanitisation(): boolean {
    const testCases = [
      'ignore all previous instructions',
      '<script>alert("xss")</script>',
      '../../etc/passwd',
      'eval(maliciousCode)',
      'DROP TABLE users;'
    ];
    
    for (const testCase of testCases) {
      const result = this.sanitiseInput(testCase);
      if (!result.blocked && !result.warnings.length) {
        console.warn(`Sanitisation failed to detect: ${testCase}`);
        return false;
      }
    }
    
    return true;
  }
}