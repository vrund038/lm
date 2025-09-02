/**
 * Plugin Template - Modern v4.2 (Single Source of Truth)
 * 
 * Universal template that intelligently handles both single-file and multi-file analysis
 * Automatically detects analysis type based on provided parameters
 * 
 * Copy this template for creating any new plugin - it adapts to your needs
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
  MultiFileAnalysis
} from '../../utils/plugin-utilities.js';
import { getAnalysisCache } from '../../cache/index.js';

export class PatternFinderPlugin extends BasePlugin implements IPromptPlugin {
  name = 'find_pattern_usage';
  category = 'analyze' as const;
  description = 'Find usage of specific patterns across multiple files in a project. Supports regex patterns with intelligent context analysis.';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'The code to analyze (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single file to analyze',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Absolute path to project root directory',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific file paths (for multi-file analysis)',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for multi-file discovery (1-5)',
      required: false
    },
    
    // Pattern-specific parameters
    patterns: {
      type: 'array' as const,
      description: 'Patterns to search for (regex supported)',
      required: true,
      items: { type: 'string' as const }
    },
    includeContext: {
      type: 'number' as const,
      description: 'Number of context lines to include (0-10)',
      required: false,
      default: 3
    },
    
    // Universal parameters
    language: {
      type: 'string' as const,
      description: 'Programming language',
      required: false,
      default: 'javascript'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of analysis detail',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of analysis to perform',
      enum: ['patterns', 'security', 'comprehensive'],
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
        return ErrorHandler.createExecutionError('find_pattern_usage', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file indicators take priority (avoids default parameter issues)
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default to multi-file for pattern finding (usually project-wide)
    return 'multi-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    // Validate patterns (required for both modes)
    if (!params.patterns || !Array.isArray(params.patterns) || params.patterns.length === 0) {
      throw new Error('patterns parameter is required and must be a non-empty array');
    }
    
    if (mode === 'single-file') {
      ParameterValidator.validateCodeOrFile(params);
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params, 1, 5);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['patterns', 'security', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
    
    // Validate context lines
    if (params.includeContext !== undefined) {
      const context = parseInt(params.includeContext);
      if (isNaN(context) || context < 0 || context > 10) {
        throw new Error('includeContext must be a number between 0 and 10');
      }
    }
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
    
    // Search patterns in the single file
    const patternMatches = this.searchPatternsInCode(codeToAnalyze, params.patterns, params.includeContext || 3);
    
    // Generate prompt stages for single file
    const promptStages = this.getSingleFilePromptStages({
      ...params,
      code: codeToAnalyze,
      patternMatches
    });
    
    // Execute with appropriate method
    const promptManager = new ThreeStagePromptManager(contextLength);
    const needsChunking = promptManager.needsChunking(promptStages);
    
    if (needsChunking) {
      const conversation = promptManager.createChunkedConversation(promptStages);
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      return await ResponseProcessor.executeChunked(
        messages,
        model,
        contextLength,
        'find_pattern_usage',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'find_pattern_usage'
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
    const promptManager = new ThreeStagePromptManager(contextLength);
    const conversation = promptManager.createChunkedConversation(promptStages);
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];
    
    return await ResponseProcessor.executeChunked(
      messages,
      model,
      contextLength,
      'find_pattern_usage',
      'multifile'
    );
  }

  /**
   * Search patterns in single code block
   */
  private searchPatternsInCode(code: string, patterns: string[], contextLines: number): any {
    const lines = code.split('\n');
    const matches: any[] = [];
    
    patterns.forEach(pattern => {
      lines.forEach((line, lineIndex) => {
        try {
          // Try regex first
          const regex = new RegExp(pattern, 'gi');
          let match;
          while ((match = regex.exec(line)) !== null) {
            matches.push({
              pattern,
              line: lineIndex + 1,
              column: match.index + 1,
              match: match[0],
              context: this.getContextLines(lines, lineIndex, contextLines)
            });
          }
        } catch {
          // Fallback to literal search
          const index = line.toLowerCase().indexOf(pattern.toLowerCase());
          if (index !== -1) {
            matches.push({
              pattern,
              line: lineIndex + 1,
              column: index + 1,
              match: pattern,
              context: this.getContextLines(lines, lineIndex, contextLines)
            });
          }
        }
      });
    });
    
    return {
      totalMatches: matches.length,
      patterns: patterns,
      matches
    };
  }

  /**
   * Get context lines around a match
   */
  private getContextLines(lines: string[], matchLineIndex: number, contextSize: number): string[] {
    const start = Math.max(0, matchLineIndex - contextSize);
    const end = Math.min(lines.length - 1, matchLineIndex + contextSize);
    const contextLines: string[] = [];
    
    for (let i = start; i <= end; i++) {
      const prefix = i === matchLineIndex ? '>>> ' : '    ';
      contextLines.push(`${prefix}${i + 1}: ${lines[i]}`);
    }
    
    return contextLines;
  }

  /**
   * Single-file pattern analysis prompt
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { patterns, patternMatches, analysisDepth, analysisType, filePath } = params;
    
    const systemAndContext = `You are an expert code pattern analyst specializing in ${analysisDepth} ${analysisType} analysis.

**Your Expertise:**
- Advanced pattern recognition and usage analysis
- Code quality assessment and security implications
- Refactoring opportunities identification
- Best practices for pattern implementation

**Analysis Context:**
- File: ${filePath || 'Code block'}
- Patterns searched: ${patterns.length}
- Total matches found: ${patternMatches.totalMatches}
- Analysis depth: ${analysisDepth}
- Focus: ${analysisType} analysis

**Your Mission:**
Provide expert analysis of how the specified patterns are used in this code, identifying usage quality, potential issues, and improvement opportunities.`;

    const dataPayload = `**PATTERN SEARCH RESULTS:**

Patterns searched: ${patterns.map((p: string) => `"${p}"`).join(', ')}
Total matches found: ${patternMatches.totalMatches}

${patternMatches.matches.length === 0 ? 
  'No matches found for the specified patterns.' : 
  patternMatches.matches.map((match: any, index: number) => `
**Match ${index + 1}:**
- Pattern: "${match.pattern}"
- Location: Line ${match.line}, Column ${match.column}
- Matched text: "${match.match}"

Context:
${match.context.join('\n')}
`).join('\n')}`;

    const outputInstructions = `**PROVIDE COMPREHENSIVE PATTERN ANALYSIS:**

## Pattern Usage Summary
Brief overview of what patterns were found and their primary usage

## Detailed Pattern Analysis
For each pattern found:
- **Pattern**: "${patterns[0]}" (example)
- **Occurrences**: [count]
- **Usage Context**: [how it's being used]
- **Quality Assessment**: [good/problematic/needs improvement]
- **Security Implications**: [if any]

## Code Quality Findings
### ✅ Good Practices Observed
- [List positive pattern usage]

### ⚠️ Issues Identified
- [List problematic usage with severity]

### 🔒 Security Considerations
- [Any security-related findings from pattern usage]

## Improvement Recommendations
1. **Immediate Actions**
   - [High priority fixes or improvements]

2. **Code Enhancement Suggestions**
   - [Ways to improve pattern usage]

3. **Best Practice Guidelines**
   - [Recommendations for optimal pattern implementation]

## Conclusion
Overall assessment and next steps for pattern optimization in this code.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Multi-file pattern analysis prompt - optimized for comprehensive project analysis
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { patterns, analysisResult, analysisType, analysisDepth, fileCount } = params;
    
    const systemAndContext = `You are a senior software architect and code quality expert specializing in ${analysisDepth} ${analysisType} pattern analysis across large codebases.

**Your Expert Capabilities:**
- Cross-file pattern usage analysis and architectural implications
- Security vulnerability identification through pattern analysis  
- Code maintainability and refactoring opportunity assessment
- Team coding standards and consistency evaluation
- Performance implications of pattern distribution

**Project Analysis Context:**
- Project scope: ${fileCount} files analyzed
- Patterns searched: ${patterns.length} distinct patterns
- Analysis focus: ${analysisType} analysis
- Analysis depth: ${analysisDepth}

**Strategic Mission:**
Provide executive-level insights on pattern usage across the entire codebase, identifying architectural strengths, risks, and strategic improvement opportunities that will enhance code quality, security, and maintainability.`;

    const dataPayload = `**COMPREHENSIVE PROJECT PATTERN ANALYSIS:**

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `**DELIVER STRATEGIC PATTERN ANALYSIS REPORT:**

# Executive Summary
## Key Findings
- Most critical pattern usage issues discovered
- Primary architectural insights
- Strategic recommendations priority

## Risk Assessment
- **High Risk**: [Critical issues requiring immediate attention]
- **Medium Risk**: [Important issues for next sprint]  
- **Low Risk**: [Long-term improvements]

# Detailed Pattern Analysis

## Pattern Distribution Map
For each pattern searched:
- **Pattern**: "${patterns[0]}" (example)
- **Total Occurrences**: [count across all files]
- **File Distribution**: [how spread across codebase]
- **Hotspots**: [files/modules with heavy usage]
- **Usage Consistency**: [consistent vs. varied implementations]

## Architectural Insights
### Code Organization Quality
- How patterns reveal architectural decisions
- Consistency of implementation approaches
- Module coupling implications

### Design Pattern Assessment
- Appropriate use of design patterns
- Anti-patterns discovered
- Missing abstractions opportunities

## Security & Quality Analysis
### 🔒 Security Implications
- Pattern usage that creates vulnerabilities
- Input validation consistency
- Authentication/authorization pattern usage

### 🏗️ Code Quality Impact  
- Pattern usage affecting maintainability
- Technical debt indicators
- Testing implications of pattern choices

## Strategic Recommendations

### 1. Immediate Actions (This Sprint)
- [Critical fixes needed now]
- [Security vulnerabilities to address]

### 2. Architectural Improvements (Next Quarter)
- [Refactoring opportunities for better pattern usage]
- [Consolidation of duplicate pattern implementations]

### 3. Long-term Strategy (6-12 months)
- [Team training on proper pattern usage]
- [Code standards establishment]
- [Tooling to enforce pattern consistency]

## Implementation Roadmap
1. **Week 1-2**: Address critical security findings
2. **Month 1**: Implement high-impact refactoring
3. **Quarter 1**: Establish team standards and tooling
4. **Ongoing**: Monitor pattern usage evolution

# Conclusion
**Bottom Line**: [Most important takeaway for technical leadership]
**Success Metrics**: [How to measure improvement]
**Next Steps**: [Specific actions to begin immediately]`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement for backwards compatibility
   * The system still expects this method, so we intelligently route to the appropriate stages
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
      'find_pattern_usage', 
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
      summary: `Pattern analysis across ${files.length} files`,
      patterns: params.patterns,
      totalFiles: files.length,
      findings: fileAnalysisResults,
      statistics: {
        filesWithMatches: fileAnalysisResults.filter((r: any) => r.matches && r.matches.length > 0).length,
        totalMatches: fileAnalysisResults.reduce((sum: number, r: any) => sum + (r.matches?.length || 0), 0),
        patternsFound: [...new Set(fileAnalysisResults.flatMap((r: any) => r.matches?.map((m: any) => m.pattern) || []))]
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
    try {
      const content = await import('fs/promises').then(fs => fs.readFile(file, 'utf-8'));
      const patternMatches = this.searchPatternsInCode(content, params.patterns, params.includeContext || 3);
      
      return {
        filePath: file,
        size: content.length,
        lines: content.split('\n').length,
        matches: patternMatches.matches,
        totalMatches: patternMatches.totalMatches
      };
    } catch (error) {
      return {
        filePath: file,
        size: 0,
        lines: 0,
        matches: [],
        totalMatches: 0,
        error: 'Could not read file'
      };
    }
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'patterns': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.rb', '.go', '.swift'], 
      'security': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs'], // Focus on web/app languages for security
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.c', '.h', '.rb', '.go', '.swift', '.kt', '.rs']
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default PatternFinderPlugin;
