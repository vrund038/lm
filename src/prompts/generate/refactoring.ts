/**
 * Code Refactoring Suggestion Plugin
 * Analyzes code and suggests refactoring improvements with project-specific patterns
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { readFileContent } from '../shared/helpers.js';
import { ResponseFactory } from '../../validation/response-factory.js';

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
    // Validate at least one input provided
    if (!params.code && !params.filePath) {
      throw new Error('Either code or filePath must be provided');
    }
    
    // Read file if needed
    let codeToRefactor = params.code;
    if (params.filePath) {
      codeToRefactor = await readFileContent(params.filePath);
    }
    
    // Prepare context with defaults
    const context: RefactorContext = {
      projectType: params.context?.projectType || 'generic',
      focusAreas: params.focusAreas || ['readability', 'maintainability'],
      preserveApi: params.context?.preserveApi !== false,
      modernizationLevel: params.context?.modernizationLevel || 'moderate',
      targetComplexity: params.context?.targetComplexity || 10,
      standards: params.context?.standards,
      teamConventions: params.context?.teamConventions
    };
    
    // Generate prompt
    const prompt = this.getPrompt({ ...params, code: codeToRefactor, context });
    
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
          content: 'You are an expert software architect specializing in code refactoring. Provide specific, actionable refactoring suggestions that improve code quality, maintainability, and performance while preserving functionality.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
        temperature: 0.3,
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
        'suggest_refactoring',
        response,
        model.identifier || 'unknown'
      );
      
    } catch (error: any) {
      return ResponseFactory.createErrorResponse(
        'suggest_refactoring',
        'MODEL_ERROR',
        `Failed to suggest refactoring: ${error.message}`,
        { originalError: error.message },
        'unknown'
      );
    }
  }

  getPrompt(params: any): string {
    const content = params.code;
    const context = params.context || {};
    
    const { projectType, focusAreas, preserveApi = true, modernizationLevel = 'moderate' } = context;
    const standards = context.standards?.join(', ') || 'clean code principles';
    
    return `Analyze code for refactoring opportunities following ${projectType || 'generic'} best practices.

Refactoring Context:
- Focus Areas: ${(focusAreas || ['readability', 'maintainability']).join(', ')}
- Preserve API: ${preserveApi ? 'Yes - maintain backward compatibility' : 'No - breaking changes allowed'}
- Modernization Level: ${modernizationLevel}
- Standards: ${standards}
- Target Complexity: ${context.targetComplexity || 10} (cyclomatic complexity)

Refactoring Priorities:
1. **Code Smells**: ${this.getCodeSmellsToCheck(focusAreas || [])}
2. **Design Patterns**: Apply appropriate patterns for ${projectType || 'generic'}
3. **Performance**: ${(focusAreas || []).includes('performance') ? this.getPerformanceTargets(projectType) : 'Not a priority'}
4. **Maintainability**: ${(focusAreas || []).includes('maintainability') ? 'Improve readability, reduce coupling, increase cohesion' : 'Standard'}
5. **Security**: ${(focusAreas || []).includes('security') ? 'Apply security best practices' : 'Maintain current security level'}

Specific Guidelines:
${this.getRefactoringGuidelines(projectType, modernizationLevel)}

Consider:
- Breaking large functions (>50 lines) into smaller, focused methods
- Extracting reusable components/utilities
- Improving naming for clarity (${context.teamConventions?.naming || 'appropriate convention'})
- Reducing cyclomatic complexity below ${context.targetComplexity || 10}
- Adding appropriate error handling
- Implementing proper logging
- Updating deprecated APIs (modernization level: ${modernizationLevel})

Code to refactor:
${content}

Provide:
1. Refactored code with clear improvements
2. Explanation of each significant change
3. Impact assessment on:
   - Performance (if applicable)
   - Maintainability score
   - Test coverage implications
   - API compatibility (if preserving)
4. Migration guide if breaking changes`;
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
General Refactoring Rules:
- Maintain single responsibility principle
- Use dependency injection where appropriate
- Prefer composition over inheritance
- Apply DRY principle thoughtfully
- Keep functions pure when possible`;

    const modernization = modernizationLevel === 'aggressive' ? `
Aggressive Modernization:
- Update to latest language features
- Replace callbacks with promises/async
- Use modern module systems
- Apply latest framework patterns` : '';

    const projectGuidelines: Record<string, string> = {
      'wordpress-plugin': `
WordPress Refactoring:
- Use modern PHP features (${modernizationLevel === 'conservative' ? 'PHP 7.4+' : 'PHP 8.0+'})
- Replace direct SQL with $wpdb methods
- Use WordPress coding standards
- Implement proper hook organization
- Add namespace to avoid conflicts`,
      
      'wordpress-theme': `
WordPress Theme Refactoring:
- Use theme.json for block editor support
- Implement proper template parts
- Optimize asset loading
- Use WordPress coding standards
- Add proper escaping functions`,
      
      'node-api': `
Node.js Refactoring:
- Use async/await over callbacks
- Implement proper middleware structure
- Add request validation layer
- Improve error handling consistency
- Modularize route handlers`,
      
      'react-app': `
React Refactoring:
- Convert class components to hooks (if ${modernizationLevel !== 'conservative'})
- Extract custom hooks
- Optimize with memo/useMemo/useCallback
- Improve component composition
- Add proper TypeScript types`,
      
      'react-component': `
React Component Refactoring:
- Extract reusable logic to hooks
- Improve prop interfaces
- Add proper memoization
- Enhance accessibility
- Optimize bundle size`,
      
      'n8n-node': `
n8n Node Refactoring:
- Improve error handling
- Add proper TypeScript types
- Optimize credential handling
- Implement batching where possible
- Add comprehensive logging`,
      
      'n8n-workflow': `
n8n Workflow Refactoring:
- Simplify node connections
- Add error handling nodes
- Optimize data transformations
- Parallelize independent operations
- Add documentation nodes`,
      
      'html-component': `
HTML Component Refactoring:
- Improve semantic HTML
- Add ARIA labels
- Optimize CSS selectors
- Extract inline styles
- Add progressive enhancement`,
      
      'browser-extension': `
Browser Extension Refactoring:
- Minimize permission requirements
- Optimize content script injection
- Improve message passing
- Add proper error boundaries
- Implement lazy loading`,
      
      'cli-tool': `
CLI Tool Refactoring:
- Improve argument parsing
- Add command aliases
- Enhance help documentation
- Implement proper exit codes
- Add progress indicators`,
      
      'generic': ''
    };
    
    const projectSpecific = projectGuidelines[projectType || 'generic'] || '';
    
    return baseGuidelines + modernization + projectSpecific;
  }
}

export default RefactoringAnalyzer;
