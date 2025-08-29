/**
 * Pattern Finder Plugin
 * Finds usage of specific patterns across multiple files in a project
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, extname, relative } from 'path';

interface FileMatch {
  file: string;
  matches: Array<{
    line: number;
    column: number;
    match: string;
    context: string[];
  }>;
}

export class PatternFinder extends BasePlugin implements IPromptPlugin {
  name = 'find_pattern_usage';
  category = 'multifile' as const;
  description = 'Find usage of specific patterns across multiple files in a project. Supports regex patterns.';
  
  parameters = {
    projectPath: {
      type: 'string' as const,
      description: 'Absolute path to project root directory',
      required: true
    },
    patterns: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Patterns to search for (regex supported)',
      required: true
    },
    includeContext: {
      type: 'number' as const,
      default: 3,
      description: 'Number of context lines to include (0-10)',
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    // Validate parameters
    if (!params.projectPath || typeof params.projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }
    
    if (!params.patterns || !Array.isArray(params.patterns) || params.patterns.length === 0) {
      throw new Error('patterns is required and must be a non-empty array');
    }
    
    // Validate and resolve project path
    const projectPath = resolve(params.projectPath);
    if (!existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }
    
    if (!statSync(projectPath).isDirectory()) {
      throw new Error(`Project path is not a directory: ${projectPath}`);
    }
    
    // Security check
    if (!this.isPathSafe(projectPath)) {
      throw new Error(`Access denied to path: ${projectPath}`);
    }
    
    // Validate context lines
    const includeContext = Math.min(Math.max(params.includeContext || 3, 0), 10);
    
    // Find all code files in the project
    const codeFiles = this.findCodeFiles(projectPath);
    
    if (codeFiles.length === 0) {
      throw new Error(`No code files found in project: ${projectPath}`);
    }
    
    // Search for patterns in each file
    const results: FileMatch[] = [];
    const errors: string[] = [];
    
    for (const filePath of codeFiles) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const fileMatches = this.searchPatterns(lines, params.patterns, includeContext);
        
        if (fileMatches.length > 0) {
          results.push({
            file: relative(projectPath, filePath),
            matches: fileMatches
          });
        }
      } catch (error) {
        errors.push(`Failed to read ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Generate analysis prompt
    const prompt = this.getPrompt({
      projectPath,
      patterns: params.patterns,
      results,
      filesSearched: codeFiles.length,
      includeContext
    });
    
    // Estimate token count before sending to LLM
    const estimatedTokens = this.estimateTokenCount(prompt);
    
    // Check if prompt exceeds context window (23,000 tokens)
    if (estimatedTokens > 23000) {
      return await this.executeWithChunking(results, params, llmClient);
    }
    
    try {
      // Get the loaded model from LM Studio
      const models = await llmClient.llm.listLoaded();
      if (models.length === 0) {
        throw new Error('No model loaded in LM Studio. Please load a model first.');
      }
      
      // Use the first loaded model
      const model = models[0];
      
      // Call the model with proper LM Studio SDK pattern
      const prediction = model.respond([
        {
          role: 'system',
          content: 'You are an expert pattern analyst. Find, analyze, and explain usage patterns across multiple code files. Provide insights about pattern distribution, consistency, and potential improvements.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
        temperature: 0.2,
        maxTokens: 4000
      });
      
      // Stream the response
      let response = '';
      for await (const chunk of prediction) {
        if (chunk.content) {
          response += chunk.content;
        }
      }
      
      // Use ResponseFactory for consistent, spec-compliant output
      ResponseFactory.setStartTime();
      return ResponseFactory.parseAndCreateResponse(
        'find_pattern_usage',
        response,
        model.identifier || 'unknown'
      );
      
    } catch (error: any) {
      return ResponseFactory.createErrorResponse(
        'find_pattern_usage',
        'MODEL_ERROR',
        `Failed to find pattern usage: ${error.message}`,
        { originalError: error.message },
        'unknown'
      );
    }
    try {
      // Get the loaded model from LM Studio
      const models = await llmClient.llm.listLoaded();
      if (models.length === 0) {
        throw new Error('No model loaded in LM Studio. Please load a model first.');
      }
      
      // Use the first loaded model
      const model = models[0];
      
      // Call the model with proper LM Studio SDK pattern
      const prediction = model.respond([
        {
          role: 'system',
          content: 'You are an expert pattern analyst. Find, analyze, and explain usage patterns across multiple code files. Provide insights about pattern distribution, consistency, and potential improvements.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
        temperature: 0.2,
        maxTokens: 4000
      });
      
      // Stream the response
      let response = '';
      for await (const chunk of prediction) {
        if (chunk.content) {
          response += chunk.content;
        }
      }
      
      // Use ResponseFactory for consistent, spec-compliant output
      ResponseFactory.setStartTime();
      return ResponseFactory.parseAndCreateResponse(
        'find_pattern_usage',
        response,
        model.identifier || 'unknown'
      );
      
    } catch (error: any) {
      return ResponseFactory.createErrorResponse(
        'find_pattern_usage',
        'MODEL_ERROR',
        `Failed to find pattern usage: ${error.message}`,
        { originalError: error.message },
        'unknown'
      );
    }
  }

  getPrompt(params: any): string {
    const { projectPath, patterns, results, filesSearched, includeContext } = params;
    
    // Format results for the prompt
    let resultsSection = '';
    
    if (results.length === 0) {
      resultsSection = 'No matches found for the specified patterns.';
    } else {
      results.forEach((fileResult: FileMatch) => {
        resultsSection += `\n${'='.repeat(80)}\nFile: ${fileResult.file}\nMatches: ${fileResult.matches.length}\n${'='.repeat(80)}\n`;
        
        fileResult.matches.forEach((match, index) => {
          resultsSection += `\n[Match ${index + 1}] Line ${match.line}, Column ${match.column}:\n`;
          resultsSection += `Pattern matched: "${match.match}"\n`;
          
          if (match.context.length > 0) {
            resultsSection += 'Context:\n';
            match.context.forEach(contextLine => {
              resultsSection += `  ${contextLine}\n`;
            });
          }
        });
      });
    }
    
    return `You are an expert code analyst specializing in pattern recognition and code search analysis.

Analyze the pattern search results from project: ${projectPath}

Search Parameters:
- Patterns searched: ${patterns.map(p => `"${p}"`).join(', ')}
- Files searched: ${filesSearched}
- Context lines: ${includeContext}
- Files with matches: ${results.length}
- Total matches found: ${results.reduce((sum: number, r: FileMatch) => sum + r.matches.length, 0)}

Search Results:
${resultsSection}

ANALYSIS TASKS:

1. **Pattern Usage Summary**
   - Summarize how each pattern is being used across the codebase
   - Identify the primary purpose of each pattern occurrence
   - Note any variations or modifications of the patterns

2. **Distribution Analysis**
   - Which files/modules use these patterns most frequently?
   - Are patterns clustered in specific areas or spread throughout?
   - Identify any unexpected locations where patterns appear

3. **Context Analysis**
   - Based on the context, what is the purpose of these patterns?
   - Are they being used consistently across files?
   - Identify any misuse or anti-patterns

4. **Code Quality Assessment**
   - Are the patterns being used appropriately?
   - Any security concerns with how patterns are used?
   - Performance implications of the pattern usage

5. **Refactoring Opportunities**
   - Could these patterns be centralized or abstracted?
   - Are there duplications that could be eliminated?
   - Suggest improvements to pattern usage

OUTPUT FORMAT:

## Pattern Usage Overview
Summary of what was found and general observations

## Pattern Analysis
For each pattern:
- **Pattern**: [pattern]
- **Total Occurrences**: [count]
- **Files Affected**: [count]
- **Primary Use Cases**: [list]
- **Observations**: [notes]

## Distribution Analysis
- Most affected files
- Module/component breakdown
- Clustering observations

## Code Quality Findings
### Good Practices
- [List positive observations]

### Issues Found
- [List problems with severity]

### Security Concerns
- [Any security-related findings]

## Recommendations
1. **Immediate Actions**
   - [High priority fixes]

2. **Refactoring Suggestions**
   - [Medium-term improvements]

3. **Best Practices**
   - [Long-term recommendations]

## Conclusion
Summary and next steps

Provide actionable insights based on the pattern search results.`;
  }
  
  private searchPatterns(lines: string[], patterns: string[], contextSize: number): Array<any> {
    const matches: Array<any> = [];
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;
      
      for (const pattern of patterns) {
        try {
          // Try to create regex from pattern
          const regex = new RegExp(pattern, 'gi');
          let match;
          
          while ((match = regex.exec(line)) !== null) {
            // Get context lines
            const contextStart = Math.max(0, lineIndex - contextSize);
            const contextEnd = Math.min(lines.length - 1, lineIndex + contextSize);
            const contextLines: string[] = [];
            
            for (let i = contextStart; i <= contextEnd; i++) {
              const prefix = i === lineIndex ? '>>> ' : '    ';
              contextLines.push(`${prefix}${i + 1}: ${lines[i]}`);
            }
            
            matches.push({
              line: lineNumber,
              column: match.index + 1,
              match: match[0],
              context: contextLines
            });
          }
        } catch (error) {
          // If pattern is not a valid regex, do a simple string search
          const index = line.indexOf(pattern);
          if (index !== -1) {
            // Get context lines
            const contextStart = Math.max(0, lineIndex - contextSize);
            const contextEnd = Math.min(lines.length - 1, lineIndex + contextSize);
            const contextLines: string[] = [];
            
            for (let i = contextStart; i <= contextEnd; i++) {
              const prefix = i === lineIndex ? '>>> ' : '    ';
              contextLines.push(`${prefix}${i + 1}: ${lines[i]}`);
            }
            
            matches.push({
              line: lineNumber,
              column: index + 1,
              match: pattern,
              context: contextLines
            });
          }
        }
      }
    }
    
    return matches;
  }
  
  private findCodeFiles(projectPath: string): string[] {
    const codeFiles: string[] = [];
    const maxFiles = 500; // Prevent overwhelming analysis
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.hpp', '.rb', '.go', '.swift', '.kt', '.rs'];
    
    function traverse(dir: string) {
      if (codeFiles.length >= maxFiles) return;
      
      try {
        const entries = readdirSync(dir);
        
        for (const entry of entries) {
          if (codeFiles.length >= maxFiles) break;
          
          const fullPath = join(dir, entry);
          
          try {
            const stat = statSync(fullPath);
            
            if (stat.isDirectory()) {
              // Skip common non-source directories
              const skipDirs = ['node_modules', '.git', 'vendor', 'dist', 'build', '.next', 'out', 'target', '.idea', '.vscode', '__pycache__', '.pytest_cache'];
              if (!skipDirs.includes(entry)) {
                traverse(fullPath);
              }
            } else if (stat.isFile()) {
              const ext = extname(entry).toLowerCase();
              if (codeExtensions.includes(ext)) {
                codeFiles.push(fullPath);
              }
            }
          } catch (error) {
            // Skip files/dirs we can't access
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }
    
    traverse(projectPath);
    return codeFiles;
  }
  
  private isPathSafe(path: string): boolean {
    // Basic security check
    const suspicious = ['../', '..\\', '/etc/', '\\etc\\', '/root/', '\\root\\', '/sys/', '\\sys\\'];
    const normalizedPath = path.toLowerCase();
    
    return !suspicious.some(pattern => normalizedPath.includes(pattern));
  }
  
  /**
   * Estimate token count for a text string
   * Rough approximation: 1 token ≈ 4 characters
   */
  private estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Execute pattern finding with chunking for large result sets
   */
  private async executeWithChunking(results: FileMatch[], params: any, llmClient: any): Promise<any> {
    // Split results into manageable chunks (approximately 5000 tokens each)
    const chunkSize = Math.max(1, Math.floor(results.length / 4)); // Create ~4 chunks
    const chunks: FileMatch[][] = [];
    
    for (let i = 0; i < results.length; i += chunkSize) {
      chunks.push(results.slice(i, i + chunkSize));
    }
    
    // Process each chunk
    const chunkResults: any[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Generate prompt for this chunk
      const chunkPrompt = this.getPrompt({
        projectPath: params.projectPath,
        patterns: params.patterns,
        results: chunk,
        filesSearched: chunk.length,
        includeContext: params.includeContext || 3
      });
      
      try {
        const models = await llmClient.llm.listLoaded();
        const model = models[0];
        
        const prediction = model.respond([
          {
            role: 'system',
            content: 'You are an expert pattern analyst. Find, analyze, and explain usage patterns across multiple code files. Focus on the subset of files provided. Provide insights about pattern distribution, consistency, and potential improvements.'
          },
          {
            role: 'user',
            content: chunkPrompt
          }
        ]);
        
        // Collect response
        let chunkResponse = '';
        for await (const update of prediction) {
          if (update.content) {
            chunkResponse += update.content;
          }
        }
        
        chunkResults.push({
          chunk: i + 1,
          files: chunk.length,
          analysis: chunkResponse
        });
        
      } catch (error) {
        chunkResults.push({
          chunk: i + 1,
          files: chunk.length,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Combine all chunk results
    const summary = this.combineChunkResults(chunkResults, params);
    return summary;
  }
  
  /**
   * Combine results from multiple chunks into a cohesive analysis
   */
  private combineChunkResults(chunkResults: any[], params: any): any {
    const totalFiles = chunkResults.reduce((sum, chunk) => sum + (chunk.files || 0), 0);
    const errors = chunkResults.filter(chunk => chunk.error);
    const successfulChunks = chunkResults.filter(chunk => !chunk.error);
    
    return {
      summary: {
        totalFiles,
        chunksProcessed: chunkResults.length,
        successfulChunks: successfulChunks.length,
        errors: errors.length,
        patterns: params.patterns
      },
      chunkAnalyses: successfulChunks.map(chunk => ({
        chunkNumber: chunk.chunk,
        filesAnalyzed: chunk.files,
        analysis: chunk.analysis
      })),
      errors: errors.map(chunk => ({
        chunkNumber: chunk.chunk,
        error: chunk.error
      })),
      combinedInsights: successfulChunks.length > 0 
        ? "Pattern analysis completed across multiple file chunks. Review individual chunk analyses for detailed findings."
        : "No successful analysis due to processing errors."
    };
  }
}

export default PatternFinder;