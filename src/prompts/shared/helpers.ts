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
 * Safely reads file content with proper error handling
 */
export async function readFileContent(filePath: string): Promise<string> {
  // TODO: Implement with proper security checks
  return '';
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
