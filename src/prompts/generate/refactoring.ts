/**
 * Code Refactoring Suggestion Plugin - Modern v4.2 Architecture
 * Analyzes code and suggests refactoring improvements with project-specific patterns
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { readFileContent } from '../shared/helpers.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';

// Type definitions for refactoring context
interface RefactorContext {
  projectType?: string;
  focusAreas?: string[];
  preserveApi?: boolean;
  modernizationLevel?: string;
  targetComplexity?: number;
  standards?: string[];
  teamConventions?: {
    naming?: string;
  };
}

export class RefactoringAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'suggest_refactoring';
  category = 'generate' as const;
  description = 'Analyze code and suggest refactoring improvements with project-specific patterns';
  
  parameters = {
    code: {
      type: 'string' as const,
      description: 'The code to analyze for refactoring (optional if filePath is provided)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to code file (alternative to code parameter)',
      required: false
    },
    language: {
      type: 'string' as const,
      description: 'Programming language',
      required: false,
      default: 'javascript'
    },
    focusAreas: {
      type: 'array' as const,
      description: 'Areas to focus on for refactoring',
      required: false,
      items: {
        type: 'string' as const,
        enum: ['readability', 'performance', 'maintainability', 'testability', 'security', 'type-safety', 'error-handling', 'logging', 'documentation']
      },
      default: ['readability', 'maintainability']
    },
    context: {
      type: 'object' as const,
      description: 'Optional context for project-specific refactoring',
      required: false,
      properties: {
        projectType: {
          type: 'string' as const,
          enum: ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'node-api', 'n8n-node', 'n8n-workflow', 'html-component', 'browser-extension', 'cli-tool', 'generic'],
          description: 'Project type for appropriate patterns'
        },
        preserveApi: {
          type: 'boolean' as const,
          description: 'Maintain backward compatibility',
          default: true
        },
        modernizationLevel: {
          type: 'string' as const,
          enum: ['conservative', 'moderate', 'aggressive'],
          description: 'How aggressively to modernize code',
          default: 'moderate'
        },
        targetComplexity: {
          type: 'number' as const,
          description: 'Target cyclomatic complexity',
          default: 10
        },
        standards: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Coding standards to follow'
        }
      }
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // Validate at least one input provided
        if (!secureParams.code && !secureParams.filePath) {
          throw new Error('Either code or filePath must be provided');
        }
        
        // Read file if needed
        let codeToRefactor = secureParams.code;
        if (secureParams.filePath) {
          codeToRefactor = await readFileContent(secureParams.filePath);
        }
        
        // Get loaded models
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        const model = models[0];
        const contextLength = await model.getContextLength() || 23832;
        
        // Generate 3-stage prompt
        const promptStages = this.getPromptStages({
          ...secureParams,
          code: codeToRefactor
        });
        
        // Determine if chunking is needed
        const promptManager = new ThreeStagePromptManager(contextLength);
        const needsChunking = promptManager.needsChunking(promptStages);
        
        if (needsChunking) {
          return await this.executeWithChunking(promptStages, llmClient, model, promptManager);
        } else {
          return await this.executeDirect(promptStages, llmClient, model);
        }
        
      } catch (error: any) {
        return ResponseFactory.createErrorResponse(
          'suggest_refactoring',
          'EXECUTION_ERROR',
          `Failed to suggest refactoring: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  getPromptStages(params: any): PromptStages {
    const context: RefactorContext = {
      projectType: params.context?.projectType || 'generic',
      focusAreas: params.focusAreas || ['readability', 'maintainability'],
      preserveApi: params.context?.preserveApi !== false,
      modernizationLevel: params.context?.modernizationLevel || 'moderate',
      targetComplexity: params.context?.targetComplexity || 10,
      standards: params.context?.standards,
      teamConventions: params.context?.teamConventions
    };

    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert software architect specializing in code refactoring. Your task is to provide specific, actionable refactoring suggestions that improve code quality while preserving functionality.

Refactoring Context:
- Project Type: ${context.projectType}
- Language: ${params.language || 'javascript'}
- Focus Areas: ${context.focusAreas.join(', ')}
- Preserve API: ${context.preserveApi ? 'Yes - maintain backward compatibility' : 'No - breaking changes allowed'}
- Modernization Level: ${context.modernizationLevel}
- Target Complexity: ${context.targetComplexity} (cyclomatic complexity)
- Standards: ${context.standards?.join(', ') || 'clean code principles'}

Your analysis should identify code smells, suggest design patterns, and provide concrete improvements.`;

    // STAGE 2: Data payload (the code to refactor)
    const dataPayload = `Code to analyze for refactoring:

\`\`\`${params.language || 'javascript'}
${params.code}
\`\`\``;

    // STAGE 3: Output instructions
    const outputInstructions = `Provide comprehensive refactoring analysis with this structure:

## Code Smells Identified
${this.getCodeSmellsToCheck(context.focusAreas)}

## Refactoring Suggestions
For each significant issue found, provide:
- **Issue**: Specific problem identified
- **Impact**: How it affects ${context.focusAreas.join(', ')}
- **Solution**: Concrete refactoring approach
- **Priority**: High/Medium/Low based on impact

## Refactored Code Examples
Show before/after code snippets for major improvements

## Design Pattern Recommendations
${this.getRefactoringGuidelines(context.projectType, context.modernizationLevel)}

## Performance Impact
${context.focusAreas.includes('performance') ? this.getPerformanceTargets(context.projectType) : 'Focus on maintainability over performance'}

## Migration Strategy
${context.preserveApi ? 'Provide backward-compatible migration path' : 'Outline breaking changes and migration steps'}

## Quality Metrics Improvement
- Current vs. target cyclomatic complexity
- Maintainability improvements
- Test coverage considerations
- Security enhancements (if applicable)

Focus on practical, implementable suggestions that align with ${context.projectType} best practices and ${context.modernizationLevel} modernization approach.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }

  // Direct execution for small operations
  private async executeDirect(stages: PromptStages, llmClient: any, model: any) {
    const messages = [
      {
        role: 'system',
        content: stages.systemAndContext
      },
      {
        role: 'user',
        content: stages.dataPayload
      },
      {
        role: 'user',
        content: stages.outputInstructions
      }
    ];

    const prediction = model.respond(messages, {
      temperature: 0.3,
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'suggest_refactoring',
      response,
      model.identifier || 'unknown'
    );
  }

  // Chunked execution for large operations
  private async executeWithChunking(stages: PromptStages, llmClient: any, model: any, promptManager: ThreeStagePromptManager) {
    const conversation = promptManager.createChunkedConversation(stages);
    
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];

    const prediction = model.respond(messages, {
      temperature: 0.3,
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'suggest_refactoring',
      response,
      model.identifier || 'unknown'
    );
  }

  // Helper functions for refactoring
  private getCodeSmellsToCheck(focusAreas: string[]): string {
    const smells: string[] = ['Large classes', 'Long methods', 'Duplicate code'];
    
    if (focusAreas.includes('readability')) {
      smells.push('Complex conditionals', 'Magic numbers', 'Poor naming');
    }
    if (focusAreas.includes('maintainability')) {
      smells.push('Tight coupling', 'Feature envy', 'Inappropriate intimacy');
    }
    if (focusAreas.includes('performance')) {
      smells.push('Inefficient loops', 'Memory leaks', 'N+1 queries');
    }
    
    return smells.join(', ');
  }

  private getPerformanceTargets(projectType?: string): string {
    const targets: Record<string, string> = {
      'wordpress-plugin': 'Reduce database queries, use transients, optimize hooks',
      'wordpress-theme': 'Minimize render-blocking resources, optimize images, lazy loading',
      'node-api': 'Improve response time, reduce memory usage, optimize database queries',
      'react-app': 'Reduce re-renders, optimize bundle size, improve initial load',
      'react-component': 'Minimize re-renders, reduce bundle impact, optimize props',
      'n8n-node': 'Handle large datasets efficiently, minimize API calls, stream processing',
      'n8n-workflow': 'Reduce node count, parallelize operations, batch processing',
      'html-component': 'Minimize reflows/repaints, optimize animations, reduce JavaScript',
      'browser-extension': 'Reduce memory footprint, optimize content scripts, minimize permissions',
      'cli-tool': 'Improve startup time, reduce memory usage, optimize file operations',
      'generic': 'Optimize algorithms, reduce memory allocation, improve caching'
    };
    
    return targets[projectType || 'generic'] || targets.generic;
  }

  private getRefactoringGuidelines(projectType?: string, modernizationLevel?: string): string {
    const baseGuidelines = `
General Patterns:
- Single responsibility principle
- Dependency injection
- Composition over inheritance
- DRY principle (applied thoughtfully)
- Pure functions where possible`;

    const modernization = modernizationLevel === 'aggressive' ? `
- Update to latest language features
- Replace callbacks with promises/async
- Use modern module systems
- Apply latest framework patterns` : '';

    const projectGuidelines: Record<string, string> = {
      'wordpress-plugin': `
WordPress-Specific:
- Modern PHP features (${modernizationLevel === 'conservative' ? 'PHP 7.4+' : 'PHP 8.0+'})
- Replace direct SQL with $wpdb methods
- WordPress coding standards
- Proper hook organization
- Namespace implementation`,
      
      'wordpress-theme': `
WordPress Theme:
- theme.json for block editor support
- Template parts optimization
- Asset loading improvements
- Escaping functions
- Performance optimization`,
      
      'node-api': `
Node.js API:
- Async/await over callbacks
- Middleware structure
- Request validation
- Error handling consistency
- Modular route handlers`,
      
      'react-app': `
React Application:
- Hooks over class components (if ${modernizationLevel !== 'conservative'})
- Custom hooks extraction
- Memoization optimization
- Component composition
- TypeScript integration`,
      
      'react-component': `
React Component:
- Reusable logic hooks
- Prop interface improvements
- Memoization strategies
- Accessibility enhancements
- Bundle optimization`,
      
      'n8n-node': `
n8n Node:
- Error handling improvements
- TypeScript implementation
- Credential optimization
- Batch processing
- Comprehensive logging`,
      
      'n8n-workflow': `
n8n Workflow:
- Node simplification
- Error handling nodes
- Data transformation optimization
- Parallel processing
- Documentation enhancement`,
      
      'html-component': `
HTML Component:
- Semantic HTML improvements
- ARIA implementation
- CSS optimization
- Progressive enhancement
- Performance optimization`,
      
      'browser-extension': `
Browser Extension:
- Permission minimization
- Content script optimization
- Message passing improvements
- Error boundaries
- Lazy loading implementation`,
      
      'cli-tool': `
CLI Tool:
- Argument parsing improvements
- Command aliases
- Help documentation
- Exit codes
- Progress indicators`,
      
      'generic': ''
    };
    
    const projectSpecific = projectGuidelines[projectType || 'generic'] || '';
    
    return baseGuidelines + modernization + projectSpecific;
  }

  // Legacy compatibility method
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
}

export default RefactoringAnalyzer;
