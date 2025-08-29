/**
 * Pattern Finder Plugin
 * Finds usage of specific patterns across multiple files in a project
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { existsSync, statSync } from 'fs';
import { resolve, join, extname, relative } from 'path';
import { readFileContent, validateAndNormalizePath } from '../shared/helpers.js';

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
    
    // Validate and resolve project path using secure path validation
    const projectPath = await validateAndNormalizePath(params.projectPath);
    
    if (!existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }
    
    if (!statSync(projectPath).isDirectory()) {
      throw new Error(`Project path is not a directory: ${projectPath}`);
    }
    
    // Validate context lines
    const includeContext = Math.min(Math.max(params.includeContext || 3, 0), 10);
    
    // Find all code files in the project
    const codeFiles = await this.findCodeFiles(projectPath);
    
    if (codeFiles.length === 0) {
      throw new Error(`No code files found in project: ${projectPath}`);
    }
    
    // Early chunking decision: Check if we need to process files in chunks
    const estimatedFilesTokens = codeFiles.length * 500; // Rough estimate per file
    const systemOverhead = 2000; // System instructions overhead
    
    // Get model for context limit detection
    const models = await llmClient.llm.listLoaded();
    if (models.length === 0) {
      throw new Error('No model loaded in LM Studio. Please load a model first.');
    }
    
    const model = models[0];
    const contextLength = await model.getContextLength() || 23832;
    const availableTokens = Math.floor(contextLength * 0.8) - systemOverhead; // 80% with system overhead
    
    if (estimatedFilesTokens > availableTokens) {
      // Process files in chunks
      return await this.executeWithFileChunking(codeFiles, params, llmClient, model, availableTokens);
    }
    
    // Process normally for small operations
    return await this.executeSinglePass(codeFiles, params, llmClient, model);
  }

  /**
   * Execute for small operations that fit in single context window
   */
  private async executeSinglePass(codeFiles: string[], params: any, llmClient: any, model: any): Promise<any> {
    const { projectPath, includeContext } = params;
    
    // Search for patterns in each file
    const results: FileMatch[] = [];
    
    for (const filePath of codeFiles) {
      try {
        const content = await readFileContent(filePath);
        const lines = content.split('\n');
        const fileMatches = this.searchPatterns(lines, params.patterns, includeContext);
        
        if (fileMatches.length > 0) {
          results.push({
            file: relative(projectPath, filePath),
            matches: fileMatches
          });
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Generate 3-stage prompt
    const promptStages = this.getPromptStages({
      projectPath,
      patterns: params.patterns,
      results,
      filesSearched: codeFiles.length,
      includeContext
    });
    
    try {
      // Get context limit for 3-stage manager
      const contextLength = await model.getContextLength();
      const promptManager = new ThreeStagePromptManager(contextLength || 23832);
      
      // Create chunked conversation
      const conversation = promptManager.createChunkedConversation(promptStages);
      
      // Build messages array for LM Studio
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      // Call the model with 3-stage conversation
      const prediction = model.respond(messages, {
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

  /**
   * Execute for large operations using file-level chunking
   */
  private async executeWithFileChunking(codeFiles: string[], params: any, llmClient: any, model: any, availableTokens: number): Promise<any> {
    // Simple file chunking - divide files into manageable chunks
    const chunkSize = Math.max(1, Math.floor(codeFiles.length / 4)); // Create ~4 chunks
    const fileChunks: string[][] = [];
    
    for (let i = 0; i < codeFiles.length; i += chunkSize) {
      fileChunks.push(codeFiles.slice(i, i + chunkSize));
    }
    
    const chunkResults: any[] = [];
    
    for (let chunkIndex = 0; chunkIndex < fileChunks.length; chunkIndex++) {
      try {
        const chunkFiles = fileChunks[chunkIndex];
        const result = await this.executeSinglePass(chunkFiles, params, llmClient, model);
        
        chunkResults.push({
          chunkIndex,
          result,
          success: true
        });
      } catch (error) {
        chunkResults.push({
          chunkIndex,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }
    
    // Combine results
    const successfulChunks = chunkResults.filter(r => r.success);
    
    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'find_pattern_usage',
      JSON.stringify({
        summary: {
          totalChunks: fileChunks.length,
          successfulChunks: successfulChunks.length,
          totalFiles: codeFiles.length
        },
        results: successfulChunks.map(r => r.result)
      }, null, 2),
      model.identifier || 'unknown'
    );
  }



  /**
   * 3-Stage prompt architecture method
   */
  getPromptStages(params: any): PromptStages {
    const { projectPath, patterns, results, filesSearched, includeContext } = params;
    
    // STAGE 1: System instructions and task context
    const systemAndContext = `You are an expert code analyst specializing in pattern recognition and code search analysis.

Project Analysis Context:
- Project path: ${projectPath}
- Patterns searched: ${patterns.map(p => `"${p}"`).join(', ')}
- Files searched: ${filesSearched}
- Context lines: ${includeContext}
- Files with matches: ${results.length}
- Total matches found: ${results.reduce((sum: number, r: FileMatch) => sum + r.matches.length, 0)}`;

    // STAGE 2: Data payload (search results)
    let dataPayload = '';
    
    if (results.length === 0) {
      dataPayload = 'No matches found for the specified patterns.';
    } else {
      results.forEach((fileResult: FileMatch) => {
        dataPayload += `\n${'='.repeat(80)}\nFile: ${fileResult.file}\nMatches: ${fileResult.matches.length}\n${'='.repeat(80)}\n`;
        
        fileResult.matches.forEach((match, index) => {
          dataPayload += `\n[Match ${index + 1}] Line ${match.line}, Column ${match.column}:\n`;
          dataPayload += `Pattern matched: "${match.match}"\n`;
          
          if (match.context.length > 0) {
            dataPayload += 'Context:\n';
            match.context.forEach(contextLine => {
              dataPayload += `  ${contextLine}\n`;
            });
          }
        });
      });
    }

    // STAGE 3: Output instructions and analysis tasks
    const outputInstructions = `ANALYSIS TASKS:

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

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
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
  
  private async findCodeFiles(projectPath: string): Promise<string[]> {
    const codeFiles: string[] = [];
    const maxFiles = 500; // Prevent overwhelming analysis
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.hpp', '.rb', '.go', '.swift', '.kt', '.rs'];
    
    async function traverse(dir: string) {
      if (codeFiles.length >= maxFiles) return;
      
      try {
        // Use fs.promises for secure async operation
        const fs = await import('fs/promises');
        const entries = await fs.readdir(dir);
        
        for (const entry of entries) {
          if (codeFiles.length >= maxFiles) break;
          
          try {
            // SECURITY FIX: Validate constructed path before operations  
            const { validateAndNormalizePath } = await import('../shared/helpers.js');
            const fullPath = await validateAndNormalizePath(join(dir, entry));
            const stat = statSync(fullPath);
            
            if (stat.isDirectory()) {
              // Skip common non-source directories
              const skipDirs = ['node_modules', '.git', 'vendor', 'dist', 'build', '.next', 'out', 'target', '.idea', '.vscode', '__pycache__', '.pytest_cache'];
              if (!skipDirs.includes(entry)) {
                await traverse(fullPath);
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
    
    await traverse(projectPath);
    return codeFiles;
  }
  
  /**
   * Get prompt for BasePlugin interface compatibility
   */
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }

}

export default PatternFinder;
