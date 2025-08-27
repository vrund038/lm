/**
 * Multi-file analysis functions using FileContextManager
 */

import { FileContextManager } from './FileContextManager.js';
import { ResponseFormatter, FormattedResponse, ActionItem } from './ResponseFormatter.js';
import * as path from 'path';

// Singleton instances
let contextManager: FileContextManager | null = null;
let formatter: ResponseFormatter | null = null;

/**
 * Get or create the context manager
 */
function getContextManager(): FileContextManager {
  if (!contextManager) {
    contextManager = new FileContextManager();
  }
  return contextManager;
}

/**
 * Get or create the response formatter
 */
function getFormatter(): ResponseFormatter {
  if (!formatter) {
    formatter = new ResponseFormatter();
  }
  return formatter;
}

/**
 * Compare integration between multiple files
 */
export async function compareIntegration(
  files: string[],
  analysisType: string = 'integration',
  focus: string[] = []
): Promise<FormattedResponse> {
  const manager = getContextManager();
  const formatter = getFormatter();
  
  // Analyze all files
  const analyzedFiles = await Promise.all(
    files.map(file => manager.analyseFile(file))
  );
  
  const issues: ActionItem[] = [];
  const warnings: string[] = [];
  
  // Check integration based on type
  if (analysisType === 'integration' || focus.includes('method_compatibility')) {
    // Check method calls match signatures
    for (const file of analyzedFiles) {
      const calls = manager.findMethodCalls('');
      for (const call of calls) {
        if (call.from === file.path) {
          // Check if called method exists
          const symbols = manager.findSymbol(call.to);
          if (symbols.length === 0) {
            issues.push({
              file: file.path,
              line: call.line,
              operation: 'replace',
              code: `// WARNING: Method ${call.to} not found`,
              validated: true,
              reason: `Called method ${call.to} does not exist`
            });
          }
        }
      }
    }
  }
  
  if (focus.includes('namespace_dependencies')) {
    // Check imports and namespaces
    for (const file of analyzedFiles) {
      for (const cls of file.classes) {
        if (cls.extends) {
          // Check if parent class is imported
          const imported = file.imports.some(imp => imp.includes(cls.extends!));
          if (!imported) {
            issues.push({
              file: file.path,
              line: cls.line,
              operation: 'insert',
              code: `import { ${cls.extends} } from './${cls.extends}';`,
              validated: true,
              reason: `Missing import for parent class ${cls.extends}`
            });
          }
        }
      }
    }
  }
  
  return formatter.format({
    summary: `Integration analysis of ${files.length} files`,
    confidence: 0.85,
    critical: issues.filter(i => i.reason?.includes('not found')),
    recommended: issues.filter(i => i.reason?.includes('Missing import')),
    filesAnalyzed: files.length,
    warnings
  });
}

/**
 * Trace execution path through multiple files
 */
export async function traceExecutionPath(
  entryPoint: string,
  traceDepth: number = 5,
  showParameters: boolean = false
): Promise<FormattedResponse> {
  const manager = getContextManager();
  const formatter = getFormatter();
  
  // Parse entry point (e.g., "SearchHandler::handle_search_results")
  const [className, methodName] = entryPoint.split('::');
  
  const executionPath: string[] = [];
  const visited = new Set<string>();
  const issues: ActionItem[] = [];
  
  async function trace(point: string, depth: number) {
    if (depth <= 0 || visited.has(point)) return;
    visited.add(point);
    
    executionPath.push(`${'  '.repeat(traceDepth - depth)}${point}`);
    
    // Find all calls from this point
    const symbols = manager.findSymbol(point);
    for (const symbol of symbols) {
      if (symbol.key) {
        const filePath = symbol.key.split(':')[0];
        if (filePath) {
          const file = await manager.analyseFile(filePath);
          const calls = manager.findMethodCalls(methodName);
          
          for (const call of calls) {
            await trace(call.to, depth - 1);
          }
        }
      }
    }
  }
  
  await trace(entryPoint, traceDepth);
  
  return formatter.format({
    summary: `Execution trace from ${entryPoint}`,
    confidence: 0.9,
    critical: issues,
    details: {
      executionPath,
      depth: traceDepth,
      visitedNodes: visited.size
    }
  });
}

/**
 * Find pattern usage across multiple files
 */
export async function findPatternUsage(
  projectPath: string,
  patterns: string[],
  includeContext: number = 3
): Promise<FormattedResponse> {
  const formatter = getFormatter();
  const fs = await import('fs/promises');
  
  const results: any[] = [];
  const files = await fs.readdir(projectPath, { recursive: true });
  
  for (const file of files) {
    if (typeof file === 'string' && file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.php')) {
      const filePath = path.join(projectPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const pattern of patterns) {
        const regex = new RegExp(pattern, 'g');
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const contextStart = Math.max(0, i - includeContext);
            const contextEnd = Math.min(lines.length - 1, i + includeContext);
            const context = lines.slice(contextStart, contextEnd + 1).join('\n');
            
            results.push({
              file: filePath,
              line: i + 1,
              pattern,
              context,
              matchedLine: lines[i]
            });
          }
        }
      }
    }
  }
  
  return formatter.format({
    summary: `Found ${results.length} matches for patterns: ${patterns.join(', ')}`,
    confidence: 1.0,
    details: results,
    filesAnalyzed: files.length
  });
}

/**
 * Check if method signatures match between caller and callee
 */
export async function diffMethodSignatures(
  callingFile: string,
  calledClass: string,
  methodName: string
): Promise<FormattedResponse> {
  const manager = getContextManager();
  const formatter = getFormatter();
  
  const result = manager.compareMethodSignatures(callingFile, calledClass, methodName);
  
  const issues: ActionItem[] = [];
  
  if (!result.match && result.issues) {
    for (const issue of result.issues) {
      issues.push({
        file: callingFile,
        line: 0, // Would need to find actual line
        operation: 'replace',
        code: `// FIX: ${issue}`,
        validated: false,
        reason: issue
      });
    }
  }
  
  return formatter.format({
    summary: result.match ? 
      `Method signatures match for ${calledClass}.${methodName}` :
      `Method signature mismatch for ${calledClass}.${methodName}`,
    confidence: result.match ? 1.0 : 0.9,
    critical: issues,
    details: {
      expectedSignature: result.expectedSignature,
      callingSignature: result.callingSignature
    }
  });
}

/**
 * Analyze a complete project structure
 */
export async function analyzeProjectStructure(
  projectPath: string,
  focusAreas: string[] = [],
  maxDepth: number = 3
): Promise<FormattedResponse> {
  const manager = getContextManager();
  const formatter = getFormatter();
  const fs = await import('fs/promises');
  
  const files = await fs.readdir(projectPath, { recursive: true });
  let analyzedCount = 0;
  
  // Analyze all source files
  for (const file of files) {
    if (typeof file === 'string') {
      const ext = path.extname(file);
      if (['.js', '.ts', '.jsx', '.tsx', '.php', '.py'].includes(ext)) {
        const filePath = path.join(projectPath, file);
        await manager.analyseFile(filePath);
        analyzedCount++;
      }
    }
  }
  
  // Get statistics
  const stats = manager.getCacheStats();
  const allSymbols = manager.getAllSymbols();
  
  // Build architecture summary
  const architecture = {
    totalFiles: analyzedCount,
    totalClasses: 0,
    totalFunctions: 0,
    totalMethods: 0,
    dependencies: new Set<string>()
  };
  
  for (const [key, value] of allSymbols) {
    if (key.includes(':class:')) architecture.totalClasses++;
    if (key.includes(':function:')) architecture.totalFunctions++;
    if (key.includes('.') && !key.includes(':class:')) architecture.totalMethods++;
  }
  
  return formatter.format({
    summary: `Analyzed ${analyzedCount} files in project`,
    confidence: 0.95,
    filesAnalyzed: analyzedCount,
    details: {
      architecture,
      statistics: stats,
      focusAreas: focusAreas
    }
  });
}

/**
 * Clear analysis cache
 */
export function clearAnalysisCache(filePath?: string): void {
  const manager = getContextManager();
  manager.clearCache(filePath);
}

/**
 * Get cache statistics
 */
export function getCacheStatistics(): any {
  const manager = getContextManager();
  return manager.getCacheStats();
}
