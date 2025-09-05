/**
 * TypeScript Conversion Plugin - Modern v4.3 Universal Template
 * 
 * Converts JavaScript code to TypeScript with comprehensive type annotations
 * Supports both individual files and entire projects
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { readFileContent } from '../shared/helpers.js';
import { 
  ModelSetup, 
  ResponseProcessor, 
  ParameterValidator, 
  ErrorHandler,
  MultiFileAnalysis,
  TokenCalculator
} from '../../utils/plugin-utilities.js';
import { getAnalysisCache } from '../../cache/index.js';

// Common Node.js modules - Use these instead of require()
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class TypeScriptConverter extends BasePlugin implements IPromptPlugin {
  name = 'convert_to_typescript';
  category = 'generate' as const;
  description = 'Convert JavaScript code to TypeScript with comprehensive type annotations and modern best practices';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'JavaScript code to convert (for single-file conversion)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single JavaScript file to convert',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Path to project root (for multi-file conversion)',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific JavaScript file paths to convert',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for multi-file discovery (1-5)',
      required: false,
      default: 3
    },
    
    // TypeScript configuration parameters
    strict: {
      type: 'boolean' as const,
      description: 'Use strict TypeScript mode',
      required: false,
      default: true
    },
    target: {
      type: 'string' as const,
      description: 'TypeScript compilation target',
      required: false,
      default: 'ES2020'
    },
    module: {
      type: 'string' as const,
      description: 'Module system',
      required: false,
      default: 'ESNext'
    },
    preserveComments: {
      type: 'boolean' as const,
      description: 'Preserve original comments and add TSDoc',
      required: false,
      default: true
    },
    addTypeGuards: {
      type: 'boolean' as const,
      description: 'Add type guard functions for runtime type checking',
      required: false,
      default: true
    },
    useInterfaces: {
      type: 'boolean' as const,
      description: 'Prefer interfaces over type aliases',
      required: false,
      default: true
    },
    useEnums: {
      type: 'boolean' as const,
      description: 'Use enums for fixed value sets',
      required: false,
      default: true
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of conversion detail',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of conversion to perform',
      enum: ['type-safety', 'modern-features', 'comprehensive'],
      default: 'comprehensive',
      required: false
    }
  };

  private analysisCache = getAnalysisCache();
  private multiFileAnalysis = new MultiFileAnalysis();

  constructor() {
    super();
    // Cache and analysis utilities are initialized above
  }

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // 1. Auto-detect analysis mode based on parameters
        const analysisMode = this.detectAnalysisMode(secureParams);
        
        // 2. Validate parameters based on detected mode
        this.validateParameters(secureParams, analysisMode);
        
        // 3. Setup model
        const { model, contextLength } = await ModelSetup.getReadyModel(llmClient);
        
        // 4. Route to appropriate analysis method
        if (analysisMode === 'single-file') {
          return await this.executeSingleFileAnalysis(secureParams, model, contextLength);
        } else {
          return await this.executeMultiFileAnalysis(secureParams, model, contextLength);
        }
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('convert_to_typescript', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file conversion
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file indicators take priority (JavaScript conversion is often file-by-file)
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default to single-file for TypeScript conversion (most common use case)
    return 'single-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      ParameterValidator.validateCodeOrFile(params);
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['type-safety', 'modern-features', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
  }

  /**
   * Execute single-file analysis
   */
  private async executeSingleFileAnalysis(params: any, model: any, contextLength: number) {
    // Process single file input
    let codeToAnalyze = params.code;
    if (params.filePath) {
      codeToAnalyze = await readFileContent(params.filePath);
    }
    
    // Generate prompt stages for single file
    const promptStages = this.getSingleFilePromptStages({
      ...params,
      code: codeToAnalyze
    });
    
    // Execute with appropriate method
    const promptManager = new ThreeStagePromptManager();
    const needsChunking = TokenCalculator.needsChunking(promptStages, contextLength);
    
    if (needsChunking) {
      const chunkSize = TokenCalculator.calculateOptimalChunkSize(promptStages, contextLength);
      const dataChunks = promptManager.chunkDataPayload(promptStages.dataPayload, chunkSize);
      const conversation = promptManager.createChunkedConversation(promptStages, dataChunks);
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      return await ResponseProcessor.executeChunked(
        messages,
        model,
        contextLength,
        'convert_to_typescript',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'convert_to_typescript'
      );
    }
  }

  /**
   * Execute multi-file analysis
   */
  private async executeMultiFileAnalysis(params: any, model: any, contextLength: number) {
    // Discover files
    let filesToAnalyze: string[] = params.files || 
      await this.discoverRelevantFiles(
        params.projectPath, 
        params.maxDepth,
        params.analysisType
      );
    
    // Perform multi-file analysis with caching
    const analysisResult = await this.performMultiFileAnalysis(
      filesToAnalyze,
      params,
      model,
      contextLength
    );
    
    // Generate prompt stages for multi-file
    const promptStages = this.getMultiFilePromptStages({
      ...params,
      analysisResult,
      fileCount: filesToAnalyze.length
    });
    
    // Always use chunking for multi-file
    const promptManager = new ThreeStagePromptManager();
    const chunkSize = TokenCalculator.calculateOptimalChunkSize(promptStages, contextLength);
    const dataChunks = promptManager.chunkDataPayload(promptStages.dataPayload, chunkSize);
    const conversation = promptManager.createChunkedConversation(promptStages, dataChunks);
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];
    
    return await ResponseProcessor.executeChunked(
      messages,
      model,
      contextLength,
      'convert_to_typescript',
      'multifile'
    );
  }

  /**
   * Single-file TypeScript conversion prompt stages
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { 
      code, 
      analysisDepth, 
      analysisType,
      strict = true,
      target = 'ES2020',
      module = 'ESNext',
      preserveComments = true,
      addTypeGuards = true,
      useInterfaces = true,
      useEnums = true
    } = params;
    
    const systemAndContext = `You are a world-class TypeScript expert and JavaScript modernization specialist with deep expertise in type system design and code transformation.

**Your Mission**: Transform JavaScript code into production-ready TypeScript that eliminates runtime errors, improves developer experience, and leverages modern language features.

**Conversion Configuration**:
- Strictness Level: ${strict ? 'Strict (zero any types)' : 'Relaxed (minimal any usage)'}
- Target: ${target}
- Module System: ${module}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Preserve Comments: ${preserveComments}
- Add Type Guards: ${addTypeGuards}
- Use Interfaces: ${useInterfaces}
- Use Enums: ${useEnums}

**Core Principles**:
1. **Type Safety First**: Every variable, parameter, and return value must be properly typed
2. **Modern TypeScript**: Use latest language features (4.5+) for maximum expressiveness
3. **Runtime Identical**: Converted code must have identical runtime behavior
4. **Developer Experience**: Types should make the code easier to understand and maintain
5. **Performance Conscious**: Use efficient TypeScript patterns that compile to optimal JavaScript`;

    const dataPayload = `JavaScript code to convert to TypeScript:

\`\`\`javascript
${code}
\`\`\``;

    const outputInstructions = `**Convert this JavaScript to TypeScript following these expert guidelines:**

## Type System Design
- **Explicit Types Everywhere**: Add comprehensive type annotations to all functions, variables, and object shapes
- **Smart Type Inference**: Use TypeScript's inference where it improves readability without sacrificing clarity
- **Union Types & Discriminated Unions**: Use union types for flexible APIs and discriminated unions for state management
- **Generic Programming**: Implement generics for reusable, type-safe components and utilities
${useInterfaces ? '- **Interface-First**: Create interfaces for all object shapes, extending and composing as needed' : '- **Type Aliases**: Use type aliases for object shapes and complex types'}
${useEnums ? '- **Enums for Constants**: Use const enums for performance and regular enums for runtime introspection' : '- **String Literals**: Use string literal unions instead of enums'}

## Modern TypeScript Features
- **Utility Types**: Leverage Partial, Required, Pick, Omit, Record, etc. for type manipulation
- **Template Literal Types**: Use template literals for strongly-typed string patterns
- **Conditional Types**: Implement conditional types for complex type relationships
${addTypeGuards ? '- **Type Guards**: Create custom type guards for runtime type safety' : '- **Type Assertions**: Use type assertions judiciously where type guards aren\'t needed'}
- **Const Assertions**: Use \`as const\` for immutable data and precise literal types
- **Module Imports**: Convert require() to modern ES6 imports with proper type imports

## Code Quality Enhancements
- **Error Handling**: Type Error objects and Promise rejections properly
- **Async/Await**: Ensure proper typing of async functions and their return types  
- **Event Handling**: Type event handlers and DOM interactions correctly
- **API Responses**: Create strong types for external API responses and internal data structures
${preserveComments ? '- **Documentation**: Preserve original comments and add TSDoc for public APIs' : '- **Essential Comments**: Keep only essential comments for complex logic'}

## Configuration Integration
- **tsconfig.json**: The code should work with strict TypeScript compiler settings
- **Import Resolution**: Use proper module resolution for the ${module} module system
- **Target Compatibility**: Code should compile cleanly to ${target}

**Output Format:**
\`\`\`typescript
// Converted TypeScript code here
// Include all necessary type definitions
// Add comprehensive type annotations
// Implement modern TypeScript patterns
\`\`\`

**Include after the code:**

### Type Safety Improvements
- List specific bugs this typing would catch at compile time
- Explain how types improve maintainability and refactoring

### Migration Notes  
- Any potential breaking changes during conversion
- Recommended IDE setup for optimal development experience

### Performance Considerations
- TypeScript patterns used that optimize for runtime performance
- Compile-time vs runtime trade-offs made`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file TypeScript conversion prompt stages
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount } = params;
    
    const systemAndContext = `You are a senior TypeScript architect specializing in large-scale JavaScript to TypeScript migrations and codebase modernization.

**Your Mission**: Orchestrate a comprehensive TypeScript conversion across ${fileCount} files, ensuring type consistency, shared interfaces, and optimal module boundaries.

**Migration Context**:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files to Convert: ${fileCount}
- Mode: Multi-File Project Conversion

**Architectural Considerations**:
1. **Shared Type Definitions**: Identify common types that should be extracted to shared modules
2. **Module Boundaries**: Optimize imports/exports for type safety and tree-shaking
3. **Dependency Resolution**: Handle circular dependencies and complex import chains
4. **Type Propagation**: Ensure types flow correctly through the entire application
5. **Migration Strategy**: Provide a phased conversion approach for minimal disruption`;

    const dataPayload = `Multi-file JavaScript analysis results:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**Provide a comprehensive multi-file TypeScript conversion strategy:**

## Conversion Strategy
### Phase 1: Foundation Types
- Extract shared interfaces and types to dedicated modules
- Create base types for common patterns across files
- Establish typing conventions for the codebase

### Phase 2: File-by-File Conversion
- Prioritized conversion order based on dependency graph
- Individual file conversion recommendations
- Import/export updates needed

### Phase 3: Integration & Optimization
- Cross-file type validation
- Shared utility type creation
- Performance optimization through type structure

## Shared Type Architecture
\`\`\`typescript
// Example: types/shared.ts
export interface CommonDataStructure {
  // Shared interfaces identified across files
}

// Example: types/api.ts  
export interface APIResponse<T> {
  // Common API response pattern
}
\`\`\`

## File Conversion Recommendations
${analysisResult.findings?.slice(0, 5).map((file: any) => `
### ${file.fileName}
- **Conversion Priority**: High/Medium/Low
- **Key Types Needed**: [List main interfaces/types]
- **Dependencies**: Files that must be converted first
- **Challenges**: Specific TypeScript issues to address
`).join('') || 'Analysis results will determine specific file recommendations'}

## Project Configuration
### Recommended tsconfig.json
\`\`\`json
{
  "compilerOptions": {
    "target": "${params.target || 'ES2020'}",
    "module": "${params.module || 'ESNext'}",
    "strict": ${params.strict !== false},
    // Additional recommended settings
  }
}
\`\`\`

## Migration Timeline
- **Week 1**: Foundation types and core utilities
- **Week 2-3**: Main application files (dependency order)
- **Week 4**: Integration testing and type refinement

## Risk Mitigation
- Breaking changes and their workarounds
- Testing strategy during conversion
- Rollback procedures if needed`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Backwards compatibility routing
   */
  getPromptStages(params: any): PromptStages {
    const mode = this.detectAnalysisMode(params);
    
    if (mode === 'single-file') {
      return this.getSingleFilePromptStages(params);
    } else {
      return this.getMultiFilePromptStages(params);
    }
  }

  // Multi-file helper methods
  private async discoverRelevantFiles(
    projectPath: string, 
    maxDepth: number,
    analysisType: string
  ): Promise<string[]> {
    const extensions = this.getFileExtensions(analysisType);
    return await this.multiFileAnalysis.discoverFiles(projectPath, extensions, maxDepth);
  }

  private async performMultiFileAnalysis(
    files: string[],
    params: any,
    model: any,
    contextLength: number
  ): Promise<any> {
    const cacheKey = this.analysisCache.generateKey(
      'convert_to_typescript', 
      params, 
      files
    );
    
    const cached = await this.analysisCache.get(cacheKey);
    if (cached) return cached;
    
    const fileAnalysisResults = await this.multiFileAnalysis.analyzeBatch(
      files,
      (file: string) => this.analyzeIndividualFile(file, params, model),
      contextLength
    );
    
    // Aggregate results into proper analysis result format
    const aggregatedResult = {
      summary: `TypeScript conversion analysis of ${files.length} JavaScript files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        jsFilesByType: this.categorizeJavaScriptFiles(fileAnalysisResults),
        conversionComplexity: this.assessConversionComplexity(fileAnalysisResults)
      }
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now() - Date.now(), // TODO: Track actual execution time
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async analyzeIndividualFile(file: string, params: any, model: any): Promise<any> {
    const content = await import('fs/promises').then(fs => fs.readFile(file, 'utf-8'));
    const stats = await import('fs/promises').then(fs => fs.stat(file));
    
    return {
      filePath: file,
      fileName: basename(file),
      size: content.length,
      lines: content.split('\n').length,
      extension: extname(file),
      relativePath: relative(params.projectPath || '', file),
      hasJSDoc: content.includes('/**'),
      usesModernJS: this.detectModernJSFeatures(content),
      complexityScore: this.calculateComplexity(content)
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'type-safety': ['.js', '.jsx'], // Focus on JavaScript files needing type safety
      'modern-features': ['.js', '.jsx', '.mjs'], // Include modern JS variants
      'comprehensive': ['.js', '.jsx', '.mjs', '.cjs'] // All JavaScript file types
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private categorizeJavaScriptFiles(results: any[]): Record<string, number> {
    const categories = {
      'components': 0,
      'utilities': 0,
      'services': 0,
      'types': 0,
      'tests': 0,
      'config': 0,
      'other': 0
    };
    
    results.forEach(result => {
      const path = result.fileName.toLowerCase();
      if (path.includes('component') || path.includes('jsx')) categories.components++;
      else if (path.includes('util') || path.includes('helper')) categories.utilities++;
      else if (path.includes('service') || path.includes('api')) categories.services++;
      else if (path.includes('type') || path.includes('interface')) categories.types++;
      else if (path.includes('test') || path.includes('spec')) categories.tests++;
      else if (path.includes('config') || path.includes('settings')) categories.config++;
      else categories.other++;
    });
    
    return categories;
  }

  private assessConversionComplexity(results: any[]): string {
    const avgComplexity = results.reduce((sum, result) => sum + (result.complexityScore || 0), 0) / results.length;
    if (avgComplexity > 0.8) return 'High - Complex patterns, extensive refactoring needed';
    if (avgComplexity > 0.5) return 'Medium - Moderate complexity, standard conversion';
    return 'Low - Straightforward conversion, minimal challenges';
  }

  private detectModernJSFeatures(content: string): boolean {
    const modernFeatures = [
      'const ', 'let ', '=>', 'async ', 'await ', 'import ', 'export ',
      'class ', '...', 'template literal', 'destructuring'
    ];
    return modernFeatures.some(feature => content.includes(feature));
  }

  private calculateComplexity(content: string): number {
    // Simple complexity scoring based on various JavaScript patterns
    const complexPatterns = [
      /function\s*\(/g,
      /=>/g,
      /if\s*\(/g,
      /for\s*\(/g,
      /while\s*\(/g,
      /try\s*{/g,
      /catch\s*\(/g,
      /switch\s*\(/g
    ];
    
    const totalPatterns = complexPatterns.reduce((sum, pattern) => {
      return sum + (content.match(pattern) || []).length;
    }, 0);
    
    // Normalize by file size (rough complexity per line)
    const lines = content.split('\n').length;
    return Math.min(totalPatterns / lines, 1);
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default TypeScriptConverter;
