/**
 * FileContextManager - Core component for multi-file awareness
 * Maintains shared context across multiple file analyses
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface ParsedFile {
  path: string;
  language: string;
  lastModified: Date;
  hash: string;
  content: string;
  lines: string[];
  
  // Structural analysis
  imports: string[];
  exports: string[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  methods: MethodInfo[];
  variables: VariableInfo[];
  
  // Relationships
  dependencies: string[];
  dependents: string[];
  calls: MethodCall[];
}

interface ClassInfo {
  name: string;
  line: number;
  extends?: string;
  implements?: string[];
  methods: string[];
  properties: string[];
}

interface FunctionInfo {
  name: string;
  line: number;
  parameters: ParameterInfo[];
  returnType?: string;
  async: boolean;
}

interface MethodInfo {
  className: string;
  name: string;
  line: number;
  parameters: ParameterInfo[];
  returnType?: string;
  visibility: 'public' | 'private' | 'protected';
  static: boolean;
  async: boolean;
}

interface ParameterInfo {
  name: string;
  type?: string;
  optional: boolean;
  defaultValue?: string;
}

interface VariableInfo {
  name: string;
  line: number;
  type?: string;
  scope: 'global' | 'local' | 'class';
}

interface MethodCall {
  from: string; // file:class.method or file:function
  to: string;   // file:class.method or file:function
  line: number;
  parameters?: string[];
}

interface FileRelationship {
  from: string;
  to: string;
  type: 'import' | 'extends' | 'implements' | 'uses' | 'calls';
  details?: any;
}

export class FileContextManager {
  private fileCache: Map<string, ParsedFile>;
  private relationships: Map<string, FileRelationship[]>;
  private symbolTable: Map<string, any>;
  private callGraph: Map<string, MethodCall[]>;
  private lastAnalysisTime: Map<string, number>;
  
  constructor() {
    this.fileCache = new Map();
    this.relationships = new Map();
    this.symbolTable = new Map();
    this.callGraph = new Map();
    this.lastAnalysisTime = new Map();
  }
  
  /**
   * Analyse a file and cache the results
   */
  async analyseFile(filePath: string, forceReparse: boolean = false): Promise<ParsedFile> {
    const normalizedPath = path.normalize(filePath);
    
    // Check cache validity
    if (!forceReparse && this.fileCache.has(normalizedPath)) {
      const cached = this.fileCache.get(normalizedPath)!;
      const stats = await fs.stat(normalizedPath);
      
      // Return cached if file hasn't changed
      if (stats.mtime <= cached.lastModified) {
        return cached;
      }
    }
    
    // Parse the file
    const parsed = await this.parseFile(normalizedPath);
    
    // Cache the result
    this.fileCache.set(normalizedPath, parsed);
    this.lastAnalysisTime.set(normalizedPath, Date.now());
    
    // Extract relationships
    this.extractRelationships(parsed);
    
    // Update symbol table
    this.updateSymbolTable(parsed);
    
    // Update call graph
    this.updateCallGraph(parsed);
    
    return parsed;
  }
  
  /**
   * Parse a file and extract structural information
   */
  private async parseFile(filePath: string): Promise<ParsedFile> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const stats = await fs.stat(filePath);
    const hash = crypto.createHash('md5').update(content).digest('hex');
    const language = this.detectLanguage(filePath);
    
    const parsed: ParsedFile = {
      path: filePath,
      language,
      lastModified: stats.mtime,
      hash,
      content,
      lines,
      imports: [],
      exports: [],
      classes: [],
      functions: [],
      methods: [],
      variables: [],
      dependencies: [],
      dependents: [],
      calls: []
    };
    
    // Language-specific parsing
    if (language === 'javascript' || language === 'typescript') {
      this.parseJavaScriptFile(parsed);
    } else if (language === 'php') {
      this.parsePHPFile(parsed);
    } else if (language === 'python') {
      this.parsePythonFile(parsed);
    }
    
    return parsed;
  }
  
  /**
   * Detect language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.php': 'php',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };
    return langMap[ext] || 'unknown';
  }
  
  /**
   * Parse JavaScript/TypeScript file
   */
  private parseJavaScriptFile(parsed: ParsedFile): void {
    const { lines } = parsed;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue; // Skip undefined lines
      const lineNum = i + 1;
      
      // Parse imports
      const importMatch = line.match(/^import\s+(.+?)\s+from\s+['"](.+?)['"]/);
      if (importMatch) {
        parsed.imports.push(importMatch[2]);
        parsed.dependencies.push(this.resolveImportPath(importMatch[2], parsed.path));
      }
      
      // Parse exports
      if (line.includes('export ')) {
        const exportMatch = line.match(/export\s+(default\s+)?(class|function|const|let|var)\s+(\w+)/);
        if (exportMatch) {
          parsed.exports.push(exportMatch[3]);
        }
      }
      
      // Parse classes
      const classMatch = line.match(/^(export\s+)?(default\s+)?class\s+(\w+)(\s+extends\s+(\w+))?(\s+implements\s+(.+?))?/);
      if (classMatch) {
        const classInfo: ClassInfo = {
          name: classMatch[3],
          line: lineNum,
          extends: classMatch[5],
          implements: classMatch[7]?.split(',').map(s => s.trim()),
          methods: [],
          properties: []
        };
        
        // Parse class body
        this.parseClassBody(lines, i, classInfo);
        parsed.classes.push(classInfo);
      }
      
      // Parse functions
      const funcMatch = line.match(/^(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
      if (funcMatch) {
        parsed.functions.push({
          name: funcMatch[3],
          line: lineNum,
          parameters: this.parseParameters(funcMatch[4]),
          async: !!funcMatch[2]
        });
      }
      
      // Parse arrow functions
      const arrowMatch = line.match(/^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/);
      if (arrowMatch) {
        parsed.functions.push({
          name: arrowMatch[2],
          line: lineNum,
          parameters: [],
          async: !!arrowMatch[3]
        });
      }
    }
  }
  
  /**
   * Parse PHP file
   */
  private parsePHPFile(parsed: ParsedFile): void {
    const { lines } = parsed;
    let currentClass: string | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // Parse namespace
      const namespaceMatch = line.match(/^namespace\s+(.+?);/);
      if (namespaceMatch) {
        // Store namespace info
      }
      
      // Parse use statements
      const useMatch = line.match(/^use\s+(.+?);/);
      if (useMatch) {
        parsed.imports.push(useMatch[1]);
      }
      
      // Parse classes
      const classMatch = line.match(/^(abstract\s+)?class\s+(\w+)(\s+extends\s+(\w+))?(\s+implements\s+(.+?))?/);
      if (classMatch) {
        currentClass = classMatch[2];
        const classInfo: ClassInfo = {
          name: classMatch[2],
          line: lineNum,
          extends: classMatch[4],
          implements: classMatch[6]?.split(',').map(s => s.trim()),
          methods: [],
          properties: []
        };
        parsed.classes.push(classInfo);
      }
      
      // Parse methods
      const methodMatch = line.match(/^\\s*(public|private|protected|static)\\s+(static\\s+)?function\\s+(\\w+)\\s*\\(([^)]*)\\)/);
      if (methodMatch && currentClass) {
        parsed.methods.push({
          className: currentClass,
          name: methodMatch[3],
          line: lineNum,
          parameters: this.parseParameters(methodMatch[4]),
          visibility: (methodMatch[1] as 'public' | 'private' | 'protected'),
          static: !!methodMatch[2],
          async: false
        });
      }
    }
  }
  
  /**
   * Parse Python file
   */
  private parsePythonFile(parsed: ParsedFile): void {
    const { lines } = parsed;
    let currentClass: string | null = null;
    let indentLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const currentIndent = line.search(/\\S/);
      
      // Parse imports
      if (line.startsWith('import ') || line.startsWith('from ')) {
        const importMatch = line.match(/^(from\\s+(.+?)\\s+)?import\\s+(.+)/);
        if (importMatch) {
          parsed.imports.push(importMatch[2] || importMatch[3]);
        }
      }
      
      // Parse classes
      const classMatch = line.match(/^class\\s+(\\w+)(\\((.+?)\\))?:/);
      if (classMatch) {
        currentClass = classMatch[1];
        indentLevel = currentIndent;
        const classInfo: ClassInfo = {
          name: classMatch[1],
          line: lineNum,
          extends: classMatch[3],
          methods: [],
          properties: []
        };
        parsed.classes.push(classInfo);
      }
      
      // Parse functions/methods
      const funcMatch = line.match(/^(\\s*)def\\s+(\\w+)\\s*\\(([^)]*)\\):/);
      if (funcMatch) {
        const funcIndent = funcMatch[1].length;
        const funcName = funcMatch[2];
        
        if (currentClass && funcIndent > indentLevel) {
          // It's a method
          parsed.methods.push({
            className: currentClass,
            name: funcName,
            line: lineNum,
            parameters: this.parseParameters(funcMatch[3]),
            visibility: funcName.startsWith('_') ? 'private' : 'public',
            static: false,
            async: false
          });
        } else {
          // It's a function
          parsed.functions.push({
            name: funcName,
            line: lineNum,
            parameters: this.parseParameters(funcMatch[3]),
            async: false
          });
        }
      }
    }
  }
  
  /**
   * Parse function/method parameters
   */
  private parseParameters(paramString: string): ParameterInfo[] {
    if (!paramString.trim()) return [];
    
    const params: ParameterInfo[] = [];
    const paramParts = paramString.split(',');
    
    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      // Handle TypeScript/JavaScript parameters
      const tsMatch = trimmed.match(/(\\w+)(\\??)?\\s*:?\\s*([^=]+)?(\\s*=\\s*(.+))?/);
      if (tsMatch) {
        params.push({
          name: tsMatch[1],
          type: tsMatch[3]?.trim(),
          optional: !!tsMatch[2] || !!tsMatch[4],
          defaultValue: tsMatch[5]?.trim()
        });
      }
    }
    
    return params;
  }  
  /**
   * Parse class body to extract methods and properties
   */
  private parseClassBody(lines: string[], startIndex: number, classInfo: ClassInfo): void {
    let braceCount = 0;
    let inClass = false;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      // Track braces to know when class ends
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          inClass = true;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && inClass) {
            return; // Class ended
          }
        }
      }
      
      if (inClass) {
        // Parse methods
        const methodMatch = line.match(/\\s*(public|private|protected)?\\s*(static)?\\s*(async)?\\s*(\\w+)\\s*\\(([^)]*)\\)/);
        if (methodMatch && !line.includes('function')) {
          classInfo.methods.push(methodMatch[4]);
        }
        
        // Parse properties
        const propMatch = line.match(/\\s*(public|private|protected)?\\s*(static)?\\s*(readonly)?\\s*(\\w+)\\s*[:=]/);
        if (propMatch) {
          classInfo.properties.push(propMatch[4]);
        }
      }
    }
  }
  
  /**
   * Extract relationships between files
   */
  private extractRelationships(parsed: ParsedFile): void {
    const fileRelationships: FileRelationship[] = [];
    
    // Import relationships
    for (const dep of parsed.dependencies) {
      fileRelationships.push({
        from: parsed.path,
        to: dep,
        type: 'import'
      });
    }
    
    // Class inheritance relationships
    for (const cls of parsed.classes) {
      if (cls.extends) {
        fileRelationships.push({
          from: `${parsed.path}:${cls.name}`,
          to: cls.extends,
          type: 'extends'
        });
      }
      
      if (cls.implements) {
        for (const intf of cls.implements) {
          fileRelationships.push({
            from: `${parsed.path}:${cls.name}`,
            to: intf,
            type: 'implements'
          });
        }
      }
    }
    
    this.relationships.set(parsed.path, fileRelationships);
  }
  
  /**
   * Update the symbol table with file symbols
   */
  private updateSymbolTable(parsed: ParsedFile): void {
    // Add classes to symbol table
    for (const cls of parsed.classes) {
      const key = `${parsed.path}:class:${cls.name}`;
      this.symbolTable.set(key, cls);
    }
    
    // Add functions to symbol table
    for (const func of parsed.functions) {
      const key = `${parsed.path}:function:${func.name}`;
      this.symbolTable.set(key, func);
    }
    
    // Add methods to symbol table
    for (const method of parsed.methods) {
      const key = `${parsed.path}:${method.className}.${method.name}`;
      this.symbolTable.set(key, method);
    }
  }
  
  /**
   * Update the call graph
   */
  private updateCallGraph(parsed: ParsedFile): void {
    const calls: MethodCall[] = [];
    
    // Simple call detection (would need more sophisticated parsing in production)
    for (let i = 0; i < parsed.lines.length; i++) {
      const line = parsed.lines[i];
      
      // Detect method calls like: this.methodName() or object.methodName()
      const callMatches = line.matchAll(/(\w+)\.(\w+)\s*\(/g);
      for (const match of callMatches) {
        calls.push({
          from: parsed.path,
          to: `${match[1]}.${match[2]}`,
          line: i + 1
        });
      }
      
      // Detect function calls
      const funcCallMatches = line.matchAll(/\b(\w+)\s*\(/g);
      for (const match of funcCallMatches) {
        // Skip language keywords
        if (!['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) {
          calls.push({
            from: parsed.path,
            to: match[1],
            line: i + 1
          });
        }
      }
    }
    
    this.callGraph.set(parsed.path, calls);
  }
  
  /**
   * Resolve import path to absolute file path
   */
  private resolveImportPath(importPath: string, fromFile: string): string {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const dir = path.dirname(fromFile);
      return path.resolve(dir, importPath);
    }
    
    // Handle node_modules or absolute imports
    return importPath;
  }
  
  // ============= Public Query Methods =============
  
  /**
   * Get all relationships for a file
   */
  getFileRelationships(filePath: string): FileRelationship[] {
    return this.relationships.get(path.normalize(filePath)) || [];
  }
  
  /**
   * Find all files that depend on a given file
   */
  getDependents(filePath: string): string[] {
    const normalizedPath = path.normalize(filePath);
    const dependents: Set<string> = new Set();
    
    for (const [file, rels] of this.relationships.entries()) {
      for (const rel of rels) {
        if (rel.to === normalizedPath) {
          dependents.add(file);
        }
      }
    }
    
    return Array.from(dependents);
  }
  
  /**
   * Find all calls to a specific method/function
   */
  findMethodCalls(methodName: string): MethodCall[] {
    const calls: MethodCall[] = [];
    
    for (const [file, fileCalls] of this.callGraph.entries()) {
      for (const call of fileCalls) {
        if (call.to.includes(methodName)) {
          calls.push(call);
        }
      }
    }
    
    return calls;
  }
  
  /**
   * Get all symbols (classes, functions, methods) in the project
   */
  getAllSymbols(): Map<string, any> {
    return new Map(this.symbolTable);
  }
  
  /**
   * Find a specific symbol by name
   */
  findSymbol(name: string): any[] {
    const results: any[] = [];
    
    for (const [key, value] of this.symbolTable.entries()) {
      if (key.includes(name)) {
        results.push({ key, ...value });
      }
    }
    
    return results;
  }
  
  /**
   * Compare method signatures between files
   */
  compareMethodSignatures(
    callingFile: string,
    calledClass: string,
    methodName: string
  ): {
    match: boolean;
    callingSignature?: any;
    expectedSignature?: any;
    issues?: string[];
  } {
    // Find the method call in the calling file
    const callingFileData = this.fileCache.get(path.normalize(callingFile));
    if (!callingFileData) {
      return { match: false, issues: ['Calling file not analyzed'] };
    }
    
    // Find the method definition
    const methodKey = `${calledClass}.${methodName}`;
    let expectedMethod: MethodInfo | undefined;
    
    for (const [key, value] of this.symbolTable.entries()) {
      if (key.includes(methodKey)) {
        expectedMethod = value as MethodInfo;
        break;
      }
    }
    
    if (!expectedMethod) {
      return { match: false, issues: ['Method definition not found'] };
    }
    
    // Compare signatures (simplified - would need more sophisticated analysis)
    return {
      match: true,
      expectedSignature: expectedMethod,
      issues: []
    };
  }
  
  /**
   * Clear cache for a specific file or all files
   */
  clearCache(filePath?: string): void {
    if (filePath) {
      const normalized = path.normalize(filePath);
      this.fileCache.delete(normalized);
      this.relationships.delete(normalized);
      this.callGraph.delete(normalized);
      this.lastAnalysisTime.delete(normalized);
      
      // Remove symbols for this file
      for (const key of this.symbolTable.keys()) {
        if (key.startsWith(normalized)) {
          this.symbolTable.delete(key);
        }
      }
    } else {
      // Clear all caches
      this.fileCache.clear();
      this.relationships.clear();
      this.symbolTable.clear();
      this.callGraph.clear();
      this.lastAnalysisTime.clear();
    }
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): {
    filesAnalyzed: number;
    totalSymbols: number;
    totalRelationships: number;
    cacheSize: number;
  } {
    let totalRelationships = 0;
    for (const rels of this.relationships.values()) {
      totalRelationships += rels.length;
    }
    
    return {
      filesAnalyzed: this.fileCache.size,
      totalSymbols: this.symbolTable.size,
      totalRelationships,
      cacheSize: JSON.stringify([...this.fileCache.values()]).length
    };
  }
}
