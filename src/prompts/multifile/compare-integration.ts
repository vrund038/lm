/**
 * Multi-file Integration Comparison Plugin
 * Compares integration between multiple files to identify issues
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { readFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';

export class IntegrationComparator extends BasePlugin implements IPromptPlugin {
  name = 'compare_integration';
  category = 'multifile' as const;
  description = 'Compare integration between multiple files to identify mismatches, missing imports, and compatibility issues. Returns actionable fixes with line numbers.';
  
  parameters = {
    files: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Array of absolute file paths to analyze',
      required: true
    },
    analysisType: {
      type: 'string' as const,
      enum: ['integration', 'compatibility', 'dependencies'],
      default: 'integration',
      description: 'Type of integration analysis',
      required: false
    },
    focus: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Specific areas to focus on: method_compatibility, namespace_dependencies, data_flow, missing_connections',
      default: [],
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    // Validate required parameters
    if (!params.files || !Array.isArray(params.files) || params.files.length < 2) {
      throw new Error('At least 2 files are required for integration comparison');
    }
    
    // Read all files with security checks
    const fileContents: Record<string, { content: string; error?: string }> = {};
    
    for (const filePath of params.files) {
      try {
        // Validate and resolve path
        const resolvedPath = resolve(filePath);
        
        // Security check - ensure path is safe
        if (!this.isPathSafe(resolvedPath)) {
          throw new Error(`Access denied to path: ${filePath}`);
        }
        
        if (!existsSync(resolvedPath)) {
          fileContents[filePath] = {
            content: '',
            error: 'File not found'
          };
          continue;
        }
        
        // Read file content
        const content = readFileSync(resolvedPath, 'utf-8');
        fileContents[filePath] = { content };
      } catch (error) {
        fileContents[filePath] = {
          content: '',
          error: error instanceof Error ? error.message : 'Unknown error reading file'
        };
      }
    }
    
    // Check if we have at least 2 valid files
    const validFiles = Object.entries(fileContents).filter(([_, data]) => !data.error && data.content);
    if (validFiles.length < 2) {
      const errors = Object.entries(fileContents)
        .filter(([_, data]) => data.error)
        .map(([path, data]) => `${path}: ${data.error}`)
        .join('\n');
      throw new Error(`Could not read enough files for comparison. Errors:\n${errors}`);
    }
    
    // Generate prompt with all file contents
    const prompt = this.getPrompt({
      ...params,
      fileContents: Object.fromEntries(
        Object.entries(fileContents).map(([path, data]) => [path, data.content])
      )
    });
    
    // Execute and return
    const response = await llmClient.complete(prompt);
    
    return {
      content: response,
      metadata: {
        filesAnalyzed: validFiles.length,
        analysisType: params.analysisType || 'integration',
        focusAreas: params.focus || [],
        errors: Object.entries(fileContents)
          .filter(([_, data]) => data.error)
          .map(([path, data]) => ({ path, error: data.error }))
      }
    };
  }

  getPrompt(params: any): string {
    const { fileContents, analysisType = 'integration', focus = [] } = params;
    
    // Build file sections with proper formatting
    let filesSection = '';
    Object.entries(fileContents).forEach(([path, content]) => {
      const fileName = basename(path);
      filesSection += `\n${'='.repeat(80)}\nFile: ${fileName}\nPath: ${path}\n${'='.repeat(80)}\n${content}\n`;
    });
    
    // Build focus areas section
    const focusSection = focus.length > 0 
      ? this.buildFocusSection(focus)
      : this.getDefaultFocusSection(analysisType);
    
    return `You are an expert code analyst specializing in ${analysisType} analysis across multiple files.

Analyze the following ${Object.keys(fileContents).length} files for ${analysisType} issues:

${filesSection}

ANALYSIS REQUIREMENTS:
${focusSection}

ANALYSIS TASKS:
1. **Method Compatibility**
   - Verify all called methods exist with correct signatures
   - Check parameter types and counts match
   - Identify any parameter ordering issues
   - Flag deprecated method usage

2. **Namespace and Import Analysis**
   - Identify missing import statements
   - Find incorrect namespace references
   - Detect circular dependencies
   - Check for unused imports

3. **Data Flow Analysis**
   - Trace how data moves between files
   - Identify type mismatches in data passed between components
   - Find potential null/undefined issues
   - Check for data transformation problems

4. **Integration Issues**
   - Find undefined references and broken dependencies
   - Identify incompatible interfaces
   - Check for version mismatches
   - Detect missing required properties or methods

5. **Architecture Consistency**
   - Verify consistent patterns across files
   - Check for proper separation of concerns
   - Identify tight coupling issues

OUTPUT FORMAT:
Structure your response as follows:

## Summary
Brief overview of the integration status

## Critical Issues (Must Fix)
- Issue: [Description]
  Location: [File:Line]
  Fix: [Specific code change]

## High Priority Issues
- Issue: [Description]
  Location: [File:Line]
  Fix: [Specific code change]

## Medium Priority Issues
- Issue: [Description]
  Location: [File:Line]
  Suggestion: [Recommended change]

## Low Priority Issues
- Issue: [Description]
  Location: [File:Line]
  Note: [Optional improvement]

## Recommended Refactoring
If applicable, suggest architectural improvements

## Verification Steps
List steps to verify the fixes work correctly

Provide specific, actionable fixes with exact code snippets that can be directly applied.`;
  }
  
  private buildFocusSection(focus: string[]): string {
    const focusMap: Record<string, string> = {
      'method_compatibility': 'Pay special attention to method signatures and parameter matching',
      'namespace_dependencies': 'Focus on import statements and namespace resolution',
      'data_flow': 'Trace data movement and transformations between components',
      'missing_connections': 'Identify undefined references and broken links'
    };
    
    const focusDescriptions = focus
      .map(f => focusMap[f] || f)
      .map((desc, i) => `${i + 1}. ${desc}`)
      .join('\n');
    
    return `Focus Areas (Priority):\n${focusDescriptions}`;
  }
  
  private getDefaultFocusSection(analysisType: string): string {
    const defaults: Record<string, string> = {
      'integration': 'Analyze all aspects of file integration with equal priority',
      'compatibility': 'Focus on API compatibility and version alignment',
      'dependencies': 'Emphasize dependency analysis and import resolution'
    };
    
    return defaults[analysisType] || defaults['integration'];
  }
  
  private isPathSafe(path: string): boolean {
    // Basic security check - ensure path doesn't contain suspicious patterns
    const suspicious = ['../', '..\\', '/etc/', '\\etc\\', '/root/', '\\root\\'];
    const normalizedPath = path.toLowerCase();
    
    return !suspicious.some(pattern => normalizedPath.includes(pattern));
  }
}

export default IntegrationComparator;