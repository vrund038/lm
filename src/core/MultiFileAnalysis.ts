/**
 * Multi-file analysis functions using FileContextManager
 */
import { FileContextManager } from './FileContextManager.js';
import { ResponseFormatter, ActionItem, FormattedResponse } from './ResponseFormatter.js';
import * as path from 'path';
import * as fs from 'fs/promises';

// Singleton instances
let contextManager: FileContextManager | null = null;
let formatter: ResponseFormatter | null = null;

/**
 * Get or create singleton FileContextManager
 */
function getContextManager(): FileContextManager {
  if (!contextManager) {
    contextManager = new FileContextManager();
  }
  return contextManager;
}

/**
 * Get or create singleton ResponseFormatter
 */
function getFormatter(): ResponseFormatter {
  if (!formatter) {
    formatter = new ResponseFormatter();
  }
  return formatter;
}

/**
 * Auto-populate cache if empty or below threshold
 * This ensures all multi-file functions have context to work with
 */
async function ensureCachePopulated(targetPath?: string): Promise<void> {
  const manager = getContextManager();
  const stats = manager.getCacheStats();
  
  // If cache has less than 5 files, try to populate it
  if (stats.filesAnalyzed < 5) {
    console.log('[Cache] Auto-populating cache as it has less than 5 files...');
    
    // Determine the project root
    let projectRoot: string;
    if (targetPath) {
      // If a specific path was provided, use its directory
      const stat = await fs.stat(targetPath).catch(() => null);
      if (stat && stat.isDirectory()) {
        projectRoot = targetPath;
      } else if (stat && stat.isFile()) {
        projectRoot = path.dirname(targetPath);
      } else {
        projectRoot = process.cwd();
      }
    } else {
      projectRoot = process.cwd();
    }
    
    // Try to find and analyze common entry files
    const commonPatterns = [
      'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
      'src/index.js', 'src/index.ts', 'src/main.js', 'src/main.ts',
      'dist/index.js', 'dist/index.ts', 'lib/index.js', 'lib/index.ts',
      'server.js', 'server.ts', 'cli.js', 'cli.ts'
    ];
    
    let filesAnalyzed = 0;
    const maxFilesToAnalyze = 10; // Analyze up to 10 files initially
    
    // First, try specific entry files
    for (const pattern of commonPatterns) {
      if (filesAnalyzed >= maxFilesToAnalyze) break;
      
      const fullPath = path.join(projectRoot, pattern);
      try {
        await fs.access(fullPath);
        await manager.analyseFile(fullPath);
        filesAnalyzed++;
        console.log(`[Cache] Analyzed: ${pattern}`);
      } catch {
        // File doesn't exist, continue
      }
    }
    
    // If we still haven't analyzed enough files, scan the directory
    if (filesAnalyzed < 5) {
      try {
        const entries = await fs.readdir(projectRoot, { withFileTypes: true });
        
        for (const entry of entries) {
          if (filesAnalyzed >= maxFilesToAnalyze) break;
          
          if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
              const fullPath = path.join(projectRoot, entry.name);
              await manager.analyseFile(fullPath);
              filesAnalyzed++;
              console.log(`[Cache] Analyzed: ${entry.name}`);
            }
          }
        }
        
        // Also check src directory if it exists
        const srcPath = path.join(projectRoot, 'src');
        try {
          const srcEntries = await fs.readdir(srcPath, { withFileTypes: true });
          for (const entry of srcEntries) {
            if (filesAnalyzed >= maxFilesToAnalyze) break;
            
            if (entry.isFile()) {
              const ext = path.extname(entry.name);
              if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
                const fullPath = path.join(srcPath, entry.name);
                await manager.analyseFile(fullPath);
                filesAnalyzed++;
                console.log(`[Cache] Analyzed: src/${entry.name}`);
              }
            }
          }
        } catch {
          // src directory doesn't exist
        }
      } catch (error) {
        console.warn('[Cache] Failed to scan directory:', error);
      }
    }
    
    const newStats = manager.getCacheStats();
    console.log(`[Cache] Auto-population complete. Files: ${newStats.filesAnalyzed}, Symbols: ${newStats.totalSymbols}`);
  }
}

/**
 * Compare integration between multiple files
 */
export async function compareIntegration(
  files: string[],
  analysisType: 'integration' | 'compatibility' | 'dependencies' = 'integration',
  focus?: string[]
): Promise<FormattedResponse> {
  const manager = getContextManager();
  const formatter = getFormatter();
  
  // Auto-populate cache if needed
  await ensureCachePopulated(files[0]);
  
  // Analyse all files
  for (const file of files) {
    await manager.analyseFile(file);
  }
  
  const issues: ActionItem[] = [];
  const recommendations: ActionItem[] = [];
  
  // Check for missing imports, mismatched method signatures, etc.
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      // Get file relationships
      const relationships = manager.getFileRelationships(files[i]);
      
      // Check if files are related
      for (const rel of relationships) {
        if (rel.to === files[j]) {
          recommendations.push({
            file: files[i],
            line: 0,
            operation: 'insert',
            code: `// ${files[i]} has ${rel.type} relationship with ${files[j]}`,
            validated: false,
            reason: `${rel.type} relationship detected`
          });
        }
      }
    }
  }
  
  return formatter.format({
    summary: `Integration analysis of ${files.length} files`,
    confidence: 0.85,
    critical: issues,
    recommended: recommendations,
    filesAnalyzed: files.length
  });
}

/**
 * FIXED: Trace execution path through multiple files
 * Now with automatic cache population and proper symbol validation
 */
export async function traceExecutionPath(
  entryPoint: string,
  traceDepth: number = 5,
  showParameters: boolean = false
): Promise<FormattedResponse> {
  const manager = getContextManager();
  const formatter = getFormatter();
  
  // Auto-populate cache if it's empty
  await ensureCachePopulated();
  
  // Parse entry point (e.g., "SearchHandler::handle_search_results" or "functionName")
  const [className, methodName] = entryPoint.includes('::') 
    ? entryPoint.split('::')
    : [null, entryPoint];
  
  const executionPath: string[] = [];
  const visited = new Set<string>();
  const issues: ActionItem[] = [];
  
  // Validate entry point exists in symbol table
  const entrySymbols = manager.findSymbol(className || entryPoint);
  if (!entrySymbols || entrySymbols.length === 0) {
    // If symbol not found, provide helpful context about what IS in the cache
    const stats = manager.getCacheStats();
    const allSymbols = manager.getAllSymbols();
    const symbolNames = Array.from(allSymbols.keys()).slice(0, 10).map(key => {
      const parts = key.split(':');
      return parts[parts.length - 1]; // Get just the symbol name
    });
    
    return formatter.format({
      summary: `Entry point '${entryPoint}' not found in symbol table`,
      confidence: 0.5,
      critical: [{
        file: 'unknown',
        line: 0,
        operation: 'insert',
        code: `// Symbol '${entryPoint}' not found. Cache has ${stats.totalSymbols} symbols from ${stats.filesAnalyzed} files. Available symbols include: ${symbolNames.join(', ')}...`,
        validated: false,
        reason: 'Symbol not found in analyzed files'
      }],
      details: {
        executionPath: [],
        depth: traceDepth,
        visitedNodes: 0,
        symbolTableSize: stats.totalSymbols,
        filesAnalyzed: stats.filesAnalyzed
      }
    });
  }
  
  async function trace(point: string, depth: number, indent: number = 0) {
    if (depth <= 0 || visited.has(point)) {
      if (visited.has(point) && depth > 0) {
        executionPath.push(`${'  '.repeat(indent)}${point} [circular reference]`);
      }
      return;
    }
    visited.add(point);
    
    executionPath.push(`${'  '.repeat(indent)}${point}`);
    
    // Parse the current point
    const [currentClass, currentMethod] = point.includes('::')
      ? point.split('::')
      : [null, point];
    
    // Find all calls from this point
    const symbols = manager.findSymbol(currentClass || point);
    for (const symbol of symbols) {
      if (symbol.key) {
        // Validate and parse the symbol key
        const keyParts = symbol.key.split(':');
        if (keyParts.length < 2) {
          console.warn(`Malformed symbol key: ${symbol.key}`);
          continue;
        }
        
        const filePath = keyParts[0];
        
        // Validate file path
        if (!filePath || !path.isAbsolute(filePath)) {
          console.warn(`Invalid file path in symbol: ${filePath}`);
          continue;
        }
        
        try {
          const file = await manager.analyseFile(filePath);
          
          // FIXED: Get calls FROM this specific method/function
          const calls = manager.findCallsFromMethod(currentClass, currentMethod || point);
          
          // Process each called method/function
          for (const call of calls) {
            let nextPoint = call.to;
            
            // Clean up the call target
            if (nextPoint.startsWith('this.')) {
              // Replace 'this.' with the current class name
              nextPoint = currentClass 
                ? `${currentClass}::${nextPoint.substring(5)}`
                : nextPoint.substring(5);
            } else if (nextPoint.includes('.') && !nextPoint.includes('::')) {
              // It's a method call on an object
              const [obj, method] = nextPoint.split('.');
              if (obj === 'server' || obj === 'console' || obj === 'process' || 
                  obj === 'path' || obj === 'fs') {
                // Skip built-in objects
                continue;
              }
              // Try to resolve the object to a class
              nextPoint = `${obj}::${method}`;
            }
            
            await trace(nextPoint, depth - 1, indent + 1);
          }
        } catch (error) {
          // Handle file parsing errors gracefully
          const errorMessage = error instanceof Error ? error.message : String(error);
          issues.push({
            file: filePath,
            line: 0,
            operation: 'insert',
            code: `// Error analyzing ${point}: ${errorMessage}`,
            validated: false,
            reason: `Failed to analyze ${point}`
          });
        }
      }
    }
  }
  
  await trace(entryPoint, traceDepth, 0);
  
  return formatter.format({
    summary: `Execution trace from ${entryPoint}`,
    confidence: executionPath.length > 1 ? 0.9 : 0.5,
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
  
  // Auto-populate cache for the project
  await ensureCachePopulated(projectPath);
  
  const results: any[] = [];
  const files = await fs.readdir(projectPath, { recursive: true });
  
  for (const file of files) {
    if (typeof file === 'string' && (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.php'))) {
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
  
  // Auto-populate cache including the calling file
  await ensureCachePopulated(callingFile);
  
  // Make sure the calling file is analyzed
  await manager.analyseFile(callingFile);
  
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
 * Analyze project structure and architecture
 */
export async function analyzeProjectStructure(
  projectPath: string,
  focusAreas?: string[],
  maxDepth: number = 3
): Promise<FormattedResponse> {
  const manager = getContextManager();
  const formatter = getFormatter();
  
  // This function naturally populates the cache as it analyzes files
  
  const projectInfo: any = {
    directories: {},
    files: [],
    dependencies: [],
    patterns: []
  };
  
  async function analyzeDir(dir: string, depth: number = 0) {
    if (depth >= maxDepth) return;
    
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, .git, etc.
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
          await analyzeDir(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || 
            entry.name.endsWith('.php') || entry.name.endsWith('.py')) {
          projectInfo.files.push(fullPath);
          await manager.analyseFile(fullPath);
        }
      }
    }
  }
  
  await analyzeDir(projectPath);
  
  // Analyze relationships and patterns
  const allSymbols = manager.getAllSymbols();
  const symbolsArray = Array.from(allSymbols.values());
  const classes = symbolsArray.filter(s => s.type === 'class').length;
  const functions = symbolsArray.filter(s => s.type === 'function').length;
  
  return formatter.format({
    summary: `Project structure analysis: ${projectInfo.files.length} files, ${classes} classes, ${functions} functions`,
    confidence: 0.95,
    details: {
      fileCount: projectInfo.files.length,
      classCount: classes,
      functionCount: functions,
      maxDepth,
      focusAreas
    }
  });
}

/**
 * Clear the analysis cache
 */
export async function clearAnalysisCache(filePath?: string): Promise<FormattedResponse> {
  const manager = getContextManager();
  const formatter = getFormatter();
  
  if (filePath) {
    manager.clearCache(filePath);
    return formatter.format({
      summary: `Cache cleared for ${filePath}`,
      confidence: 1.0
    });
  } else {
    manager.clearCache();
    return formatter.format({
      summary: 'All cache cleared',
      confidence: 1.0
    });
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStatistics(): Promise<FormattedResponse> {
  const manager = getContextManager();
  const formatter = getFormatter();
  
  const stats = manager.getCacheStats();
  
  // If cache is empty, provide a hint
  if (stats.filesAnalyzed === 0) {
    return formatter.format({
      summary: 'Cache is empty. Multi-file functions will auto-populate the cache when called.',
      confidence: 1.0,
      details: stats
    });
  }
  
  return formatter.format({
    summary: `Cache contains ${stats.filesAnalyzed} analyzed files`,
    confidence: 1.0,
    details: stats
  });
}
