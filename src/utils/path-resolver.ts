import { stat } from 'fs/promises';
import { join, extname, basename } from 'path';

/**
 * Analyze a path for MCP usage and provide intelligent suggestions
 */
export async function analyzePathForMCP(path: string) {
  try {
    const stats = await stat(path);
    
    const result: any = {
      exists: true,
      type: stats.isDirectory() ? 'directory' : 'file',
      suggestedParameter: stats.isDirectory() ? 'projectPath' : 'filePath',
      size: stats.size,
      canRead: true,
      lastModified: stats.mtime,
      extension: stats.isFile() ? extname(path) : null,
      basename: basename(path)
    };

    // Add helpful hints based on analysis
    if (stats.isDirectory()) {
      result.hint = `This is a directory. Use 'projectPath' parameter for multi-file analysis.`;
    } else {
      result.hint = `This is a file (${result.extension || 'no extension'}). Use 'filePath' parameter for single-file analysis.`;
    }

    return result;
    
  } catch (error: any) {
    return {
      exists: false,
      type: 'unknown',
      error: error.message,
      suggestedParameter: 'filePath', // default guess
      hint: `Path not found or inaccessible. Check the path exists and you have permissions.`,
      canRead: false
    };
  }
}

/**
 * Enhanced validation helper with path intelligence
 */
export async function validatePathWithHints(params: any, pathParam: 'filePath' | 'projectPath') {
  const path = params[pathParam];
  if (!path) return null;

  const analysis = await analyzePathForMCP(path);
  
  if (!analysis.exists) {
    throw new Error(`Path not found: ${path}. ${analysis.hint}`);
  }

  // Check for parameter mismatch
  if (pathParam === 'filePath' && analysis.type === 'directory') {
    throw new Error(
      `Parameter mismatch: '${path}' is a directory, but you used 'filePath'. ` +
      `Try using 'projectPath' instead for directory analysis.`
    );
  }
  
  if (pathParam === 'projectPath' && analysis.type === 'file') {
    throw new Error(
      `Parameter mismatch: '${path}' is a file, but you used 'projectPath'. ` +
      `Try using 'filePath' instead for single-file analysis.`
    );
  }

  return analysis;
}

/**
 * Smart path suggestion helper
 */
export function suggestParameterForPath(pathString: string): 'filePath' | 'projectPath' {
  // Quick heuristics before filesystem check
  const hasExtension = extname(pathString).length > 0;
  const endsWithSrc = pathString.endsWith('src') || pathString.endsWith('src/');
  const containsWildcard = pathString.includes('*');
  
  if (containsWildcard || endsWithSrc) {
    return 'projectPath';
  }
  
  if (hasExtension) {
    return 'filePath';
  }
  
  // Default to projectPath for ambiguous cases
  return 'projectPath';
}