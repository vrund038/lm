/**
 * Code Structure Analysis Plugin
 * Analyzes the structure of a single code file with framework-specific insights
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { readFileContent } from '../shared/helpers.js';

// Type definitions for analysis context
interface AnalysisContext {
  projectType?: string;
  framework?: string;
  frameworkVersion?: string;
  standards?: string[];
  environment?: string;
  language?: string;
  languageVersion?: string;
}

export class CodeStructureAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_single_file';
  category = 'analyze' as const;
  description = 'Analyze the structure of a single code file with optional context for framework-specific insights';
  
  parameters = {
    code: {
      type: 'string' as const,
      description: 'The code to analyze (optional if filePath is provided)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to code file (alternative to code parameter)',
      required: false
    },
    language: {
      type: 'string' as const,
      description: 'Programming language (javascript, typescript, php, python, etc.)',
      required: false,
      default: 'javascript'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of analysis detail',
      required: false,
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed'
    },
    context: {
      type: 'object' as const,
      description: 'Optional context for domain-specific analysis',
      required: false,
      properties: {
        projectType: {
          type: 'string' as const,
          enum: ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'n8n-node', 'node-api', 'html-component', 'generic'],
          description: 'Type of project for specialized analysis'
        },
        framework: {
          type: 'string' as const,
          description: 'Framework being used (e.g., WordPress, React, Express)'
        },
        frameworkVersion: {
          type: 'string' as const,
          description: 'Framework version (e.g., 6.0, 18.2.0)'
        },
        standards: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Coding standards to check against (e.g., WordPress Coding Standards, PSR-12)'
        },
        environment: {
          type: 'string' as const,
          enum: ['browser', 'node', 'wordpress', 'hybrid'],
          description: 'Runtime environment'
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
    let codeToAnalyze = params.code;
    if (params.filePath) {
      codeToAnalyze = await readFileContent(params.filePath);
    }
    
    // Prepare context with defaults
    const context: AnalysisContext = {
      projectType: params.context?.projectType || 'generic',
      framework: params.context?.framework || 'none specified',
      frameworkVersion: params.context?.frameworkVersion,
      standards: params.context?.standards,
      environment: params.context?.environment,
      language: params.language || 'javascript',
      languageVersion: params.context?.languageVersion
    };
    
    // Generate prompt
    const prompt = this.getPrompt({ ...params, code: codeToAnalyze, context });
    
    // Execute and return
    const response = await llmClient.complete(prompt);
    
    // Format response
    return {
      content: response,
      metadata: {
        language: params.language || 'javascript',
        analysisDepth: params.analysisDepth || 'detailed',
        projectType: context.projectType
      }
    };
  }

  getPrompt(params: any): string {
    const content = params.code;
    const context = params.context || {};
    
    const projectType = context?.projectType || 'generic';
    const framework = context?.framework || 'none specified';
    const standards = context?.standards?.join(', ') || 'clean code principles';
    
    return `You are analyzing ${context?.language || 'code'} for a ${projectType} project.

Context:
- Project Type: ${projectType}
- Framework: ${framework} ${context?.frameworkVersion ? `v${context.frameworkVersion}` : ''}
- Coding Standards: ${standards}
- Environment: ${context?.environment || 'not specified'}

Analyze and provide:
1. **Architecture Overview**: High-level design patterns and structure
2. **Dependencies**: External libraries, their versions, and purposes
3. **Entry Points**: Main execution flows, initialization, and bootstrapping
4. **Data Flow**: How data moves through the system, transformations, and storage
5. **Integration Points**: APIs, hooks, events, or extension points
6. **Code Organization**: Module structure, separation of concerns
7. **Potential Issues**: Anti-patterns, technical debt, or improvement areas

${this.getProjectSpecificInstructions(projectType)}

Consider:
- Language version compatibility (${context?.languageVersion || 'latest'})
- Performance implications of architectural choices
- Testability and maintainability of the structure
- Security considerations for the architecture

Code to analyze:
${content}`;
  }

  private getProjectSpecificInstructions(projectType: string): string {
    const instructions: Record<string, string> = {
      'wordpress-plugin': `
WordPress Plugin Specific Analysis:
- Hook usage and organization (actions vs filters)
- Database interactions ($wpdb usage)
- Admin interface components
- AJAX handlers and REST API endpoints
- Security measures (nonces, capabilities, escaping)
- Multisite compatibility considerations
- Translation readiness (i18n functions)`,

      'wordpress-theme': `
WordPress Theme Specific Analysis:
- Template hierarchy usage
- Custom post types and taxonomies
- Customizer integration
- Widget areas and custom widgets
- Menu locations and navigation
- Asset loading and dependencies
- Child theme compatibility`,

      'react-app': `
React Application Specific Analysis:
- Component hierarchy and composition
- State management approach (Context, Redux, etc.)
- Routing structure and lazy loading
- Custom hooks usage
- Performance optimizations (memo, useMemo, useCallback)
- Side effect management
- Testing setup and coverage`,

      'react-component': `
React Component Specific Analysis:
- Props interface and validation
- Internal state management
- Event handlers and callbacks
- Render optimization opportunities
- Accessibility implementation
- Styling approach (CSS-in-JS, modules, etc.)
- Reusability and composability`,

      'n8n-node': `
n8n Node Specific Analysis:
- Credential type definitions
- Node parameter structure
- Execute method implementation
- Error handling strategy
- Resource optimization
- API interaction patterns
- Testing hooks`,

      'node-api': `
Node.js API Specific Analysis:
- Route organization and middleware
- Authentication/authorization implementation
- Database connection patterns
- Error handling middleware
- Request validation
- Response formatting
- API versioning strategy`,

      'html-component': `
HTML Component Specific Analysis:
- Semantic HTML structure
- Accessibility features (ARIA)
- JavaScript enhancement strategy
- CSS architecture
- Browser compatibility
- Performance considerations
- Progressive enhancement`,

      'generic': ''
    };

    return instructions[projectType] || instructions.generic;
  }
}

export default CodeStructureAnalyzer;
