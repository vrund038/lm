/**
 * Multi-file Integration Comparison Plugin
 * Compares integration between multiple files to identify issues
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { FileContextManager } from '../../core/FileContextManager.js';

export class IntegrationComparator extends BasePlugin implements IPromptPlugin {
  name = 'compare_integration';
  category = 'multifile' as const;
  description = 'Compare integration between multiple files to identify mismatches, missing imports, and compatibility issues';
  
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
    if (!params.files || params.files.length < 2) {
      throw new Error('At least 2 files are required for integration comparison');
    }
    
    // Use FileContextManager to read all files
    // TODO: Implement proper file reading with security checks
    const fileContents: Record<string, string> = {};
    
    for (const filePath of params.files) {
      // Placeholder - needs proper implementation
      fileContents[filePath] = `// File content would be read here for: ${filePath}`;
    }
    
    // Generate prompt with all file contents
    const prompt = this.getPrompt({ ...params, fileContents });
    
    // Execute and return
    const response = await llmClient.complete(prompt);
    
    return {
      content: response,
      metadata: {
        filesAnalyzed: params.files.length,
        analysisType: params.analysisType || 'integration',
        focusAreas: params.focus || []
      }
    };
  }

  getPrompt(params: any): string {
    const { fileContents, analysisType = 'integration', focus = [] } = params;
    
    let filesSection = '';
    for (const [path, content] of Object.entries(fileContents)) {
      filesSection += `\nFile: ${path}\n${'='.repeat(50)}\n${content}\n`;
    }
    
    const focusSection = focus.length > 0 
      ? `Focus specifically on: ${focus.join(', ')}`
      : 'Analyze all integration aspects';
    
    return `Perform ${analysisType} analysis on the following files:

${filesSection}

Analysis Type: ${analysisType}
${focusSection}

Analyze and identify:
1. **Method Compatibility**: Check if called methods exist with correct signatures
2. **Namespace/Import Issues**: Missing imports, incorrect namespaces
3. **Data Flow**: How data moves between files, type mismatches
4. **Missing Connections**: Undefined references, broken dependencies
5. **Integration Problems**: Incompatible interfaces, version mismatches

Provide:
1. List of integration issues with severity (Critical/High/Medium/Low)
2. Exact locations (file:line) for each issue
3. Specific fixes with code snippets
4. Suggested refactoring if needed
5. Verification steps to ensure fixes work

Format as actionable items that can be directly applied.`;
  }
}

export default IntegrationComparator;
