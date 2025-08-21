import { resolve, normalize } from 'path';

/**
 * Security configuration for Local LLM MCP
 * 
 * These settings control file access permissions and security policies.
 * Can be overridden via environment variables.
 */
export const securityConfig = {
  /**
   * Default allowed directories for file operations
   * These directories are used when LLM_MCP_ALLOWED_DIRS environment variable is not set
   * 
   * @type {string[]}
   */
  defaultAllowedDirectories: [
    process.cwd(),      // Current working directory
    'C:\\MCP',          // MCP tools directory
    'C:\\Dev',          // Development directory
    // Add more default directories as needed
  ],

  /**
   * Get the list of allowed directories
   * Prioritizes environment variable over defaults
   * 
   * @returns {string[]} Array of normalized, absolute paths
   */
  getAllowedDirectories(): string[] {
    if (process.env.LLM_MCP_ALLOWED_DIRS) {
      return process.env.LLM_MCP_ALLOWED_DIRS
        .split(',')
        .map(dir => resolve(normalize(dir.trim())));
    }
    
    return this.defaultAllowedDirectories
      .map(dir => resolve(normalize(dir)));
  },

  /**
   * Additional security settings
   */
  security: {
    /** Maximum file size in bytes (200MB default) */
    maxFileSize: 200 * 1024 * 1024,
    
    /** Enforce absolute paths */
    requireAbsolutePaths: true,
    
    /** Log security violations */
    logSecurityViolations: true,
    
    /** Allowed file extensions */
    allowedExtensions: [
      '.csv', '.json', '.txt', '.js', '.ts', '.py', 
      '.md', '.log', '.jsx', '.tsx', '.java', '.c', 
      '.cpp', '.rs', '.go', '.php', '.rb', '.swift'
    ]
  },

  /**
   * Authentication settings (for future implementation)
   */
  auth: {
    /** Enable API key authentication */
    enableApiKey: false,
    
    /** API key header name */
    apiKeyHeader: 'X-API-Key',
    
    /** Enable rate limiting */
    enableRateLimit: false,
    
    /** Rate limit window in milliseconds */
    rateLimitWindow: 15 * 60 * 1000, // 15 minutes
    
    /** Maximum requests per window */
    rateLimitMax: 100
  }
};

// For backwards compatibility
export const DEFAULT_ALLOWED_DIRS = securityConfig.defaultAllowedDirectories;