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
 * Safely reads file content with proper security checks
 */
export async function readFileContent(filePath: string): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  // Import security config
  const { securityConfig } = await import('../../security-config.js');
  
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path provided');
  }
  
  // Must be absolute path
  if (!path.isAbsolute(filePath)) {
    throw new Error('File path must be absolute');
  }
  
  // Normalize to prevent traversal
  const normalizedPath = path.resolve(path.normalize(filePath));
  
  // Check if within allowed directories
  const allowedDirs = securityConfig.getAllowedDirectories();
  const isPathSafe = allowedDirs.some(allowedDir => 
    normalizedPath.startsWith(allowedDir)
  );
  
  if (!isPathSafe) {
    throw new Error(`Access denied: Path '${filePath}' is outside allowed directories`);
  }
  
  try {
    // Check if file exists
    const stat = await fs.stat(normalizedPath);
    if (!stat.isFile()) {
      throw new Error(`Path '${filePath}' is not a file`);
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
  readFileContent,
  formatCodeForPrompt,
  truncateString,
  escapeForPrompt
};
