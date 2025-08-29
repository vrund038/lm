/**
 * Shared helper functions for all plugins
 */

/**
 * Validates that required parameters are present
 */
export function validateRequiredParams(params: any, required: string[]): void {
  for (const param of required) {
    if (!params[param]) {
      throw new Error(`Missing required parameter: ${param}`);
    }
  }
}

/**
 * Safely validates and normalizes a file path to prevent path traversal attacks
 * This function should be used before any file operations
 */
export async function validateAndNormalizePath(filePath: string): Promise<string> {
  const path = await import('path');
  const { securityConfig } = await import('../../security-config.js');
  
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path provided');
  }
  
  // Must be absolute path
  if (!path.isAbsolute(filePath)) {
    throw new Error('File path must be absolute');
  }
  
  // Normalize and resolve to canonical form
  const normalizedPath = path.resolve(path.normalize(filePath));
  
  // Get allowed directories and ensure they're also resolved and normalized for Windows
  const allowedDirs = securityConfig.getAllowedDirectories(); // These are already lowercase
  
  // Check if the resolved path is within allowed boundaries (case-insensitive for Windows)
  const normalizedPathLower = normalizedPath.toLowerCase();
  const isPathSafe = allowedDirs.some(allowedDir => {
    // Ensure both paths end with path separator for accurate comparison
    const normalizedAllowedDir = allowedDir.endsWith(path.sep) ? allowedDir : allowedDir + path.sep;
    const pathToCheck = normalizedPathLower + path.sep;
    
    // The path must start with the allowed directory and not escape via ".."
    return pathToCheck.startsWith(normalizedAllowedDir) || normalizedPathLower === allowedDir;
  });
  
  if (!isPathSafe) {
    throw new Error(`Access denied: Path '${filePath}' is outside allowed directories`);
  }
  
  // Additional security: Validate against any remaining path traversal attempts
  if (normalizedPath.includes('..') || filePath.includes('..')) {
    throw new Error(`Access denied: Path contains path traversal sequences`);
  }
  
  return normalizedPath;
}

/**
 * Safely reads file content with proper security checks and path traversal protection
 * Uses the validateAndNormalizePath function to ensure security
 */
export async function readFileContent(filePath: string): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Import security config
  const { securityConfig } = await import('../../security-config.js');
  
  // First, validate and normalize the path (this includes all security checks)
  const normalizedPath = await validateAndNormalizePath(filePath);
  
  try {
    // Check if file exists and is actually a file (not directory)
    const stat = await fs.stat(normalizedPath);
    if (!stat.isFile()) {
      throw new Error(`Path '${filePath}' is not a file`);
    }
    
    // Check file size limit
    if (stat.size > securityConfig.security.maxFileSize) {
      throw new Error(`File '${filePath}' exceeds maximum size limit (${securityConfig.security.maxFileSize} bytes)`);
    }
    
    // Check file extension if restrictions are in place
    const fileExt = path.extname(normalizedPath).toLowerCase();
    if (securityConfig.security.allowedExtensions.length > 0 && 
        !securityConfig.security.allowedExtensions.includes(fileExt)) {
      throw new Error(`File extension '${fileExt}' is not allowed`);
    }
    
    // Read file content
    const content = await fs.readFile(normalizedPath, 'utf-8');
    return content;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    } else if (error.code === 'EACCES') {
      throw new Error(`Permission denied: ${filePath}`);
    } else {
      // Re-throw our custom errors as-is
      if (error.message.includes('Access denied') || 
          error.message.includes('exceeds maximum size') ||
          error.message.includes('not allowed')) {
        throw error;
      }
      throw new Error(`Failed to read file '${filePath}': ${error.message}`);
    }
  }
}

/**
 * Formats code snippets for inclusion in prompts
 */
export function formatCodeForPrompt(code: string, language: string): string {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

/**
 * Truncates long strings with ellipsis
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Escapes special characters in strings for safe prompt inclusion
 */
export function escapeForPrompt(str: string): string {
  return str.replace(/[`\\]/g, '\\$&');
}

export default {
  validateRequiredParams,
  validateAndNormalizePath,
  readFileContent,
  formatCodeForPrompt,
  truncateString,
  escapeForPrompt
};
