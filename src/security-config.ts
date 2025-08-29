import { resolve, normalize } from 'path';

/**
 * Security configuration for Local LLM MCP
 * 
 * These settings control file access permissions and security policies.
 * Can be overridden via environment variables.
 */
export const securityConfig = {
  /**
   * Get the list of allowed directories from environment variable
   * NO DEFAULTS - Must be explicitly configured for security
   * 
   * @returns {string[]} Array of normalized, absolute paths
   * @throws {Error} If LLM_MCP_ALLOWED_DIRS is not set
   */
  getAllowedDirectories(): string[] {
    if (!process.env.LLM_MCP_ALLOWED_DIRS) {
      throw new Error(
        'SECURITY: LLM_MCP_ALLOWED_DIRS environment variable must be set. ' +
        'This defines which directories the Local LLM MCP can access.'
      );
    }
    
    return process.env.LLM_MCP_ALLOWED_DIRS
      .split(',')
      .map(dir => resolve(normalize(dir.trim())).toLowerCase()); // Normalize case for Windows
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

// No backwards compatibility exports - security must be explicitly configured
