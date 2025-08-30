/**
 * Code Structure Analysis Plugin - Modern v4.2
 * Analyzes the structure of a single code file with framework-specific insights
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { readFileContent } from '../shared/helpers.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { withSecurity } from '../../security/integration-helpers.js';

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
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      // Validate at least one input provided
      if (!secureParams.code && !secureParams.filePath) {
        throw new Error('Either code or filePath must be provided');
      }
      
      // Read file if needed
      let codeToAnalyze = secureParams.code;
      if (secureParams.filePath) {
        codeToAnalyze = await readFileContent(secureParams.filePath);
      }
      
      try {
        // Get the loaded model from LM Studio
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        // Use the first loaded model
        const model = models[0];
        
        // Get the 3-stage prompt structure
        const promptStages = this.getPromptStages({ ...secureParams, code: codeToAnalyze });
        
        // For single file analysis, we typically don't need chunking
        // but we could add ThreeStagePromptManager logic here if needed
        const messages = [
          {
            role: 'system',
            content: promptStages.systemAndContext
          },
          {
            role: 'user',
            content: promptStages.dataPayload
          },
          {
            role: 'user',
            content: promptStages.outputInstructions
          }
        ];
        
        // Call the model with proper LM Studio SDK pattern
        const prediction = model.respond(messages, {
          temperature: 0.1,
          maxTokens: 2000
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
          'analyze_single_file',
          response,
          model.identifier || 'unknown'
        );
        
      } catch (error: any) {
        return ResponseFactory.createErrorResponse(
          'analyze_single_file',
          'MODEL_ERROR',
          `Failed to analyze code: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  /**
   * MODERN v4.2: 3-Stage Prompt Architecture
   */
  getPromptStages(params: any): PromptStages {
    const context = params.context || {};
    const projectType = context?.projectType || 'generic';
    const framework = context?.framework || 'none specified';
    const standards = context?.standards?.join(', ') || 'clean code principles';
    const language = params.language || context?.language || 'javascript';
    
    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert code analyst specializing in ${params.analysisDepth || 'detailed'} analysis.

Analysis Context:
- Project Type: ${projectType}
- Framework: ${framework} ${context?.frameworkVersion ? `v${context.frameworkVersion}` : ''}
- Programming Language: ${language}
- Coding Standards: ${standards}
- Environment: ${context?.environment || 'not specified'}
- Language Version: ${context?.languageVersion || 'latest'}

Your task is to provide structured, actionable analysis of code architecture, patterns, and potential improvements.

${this.getProjectSpecificInstructions(projectType)}`;

    // STAGE 2: Data payload (the code to analyze)
    const dataPayload = `Code to analyze:

\`\`\`${language}
${params.code}
\`\`\``;

    // STAGE 3: Output instructions
    const outputInstructions = `Provide your analysis as a JSON object with this exact structure:

{
  "summary": "Brief overview of the code architecture and purpose",
  "structure": {
    "classes": ["ClassName1", "ClassName2"],
    "functions": ["function1", "function2"],
    "imports": ["module1", "module2"],
    "exports": ["export1", "export2"],
    "dependencies": ["dependency1", "dependency2"]
  },
  "metrics": {
    "linesOfCode": 150,
    "cyclomaticComplexity": 8,
    "cognitiveComplexity": 12,
    "maintainabilityIndex": 75
  },
  "findings": [
    {
      "type": "issue",
      "severity": "medium",
      "message": "Issue description",
      "line": 42,
      "recommendation": "How to fix this"
    }
  ],
  "patterns": ["pattern1", "pattern2"],
  "suggestions": ["suggestion1", "suggestion2"]
}

Focus on:
- Specific line numbers where possible
- Actionable recommendations
- Performance implications
- Security considerations
- Testability and maintainability`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
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

      'generic': 'Focus on general code quality, maintainability, and best practices.'
    };

    return instructions[projectType] || instructions.generic;
  }
}

export default CodeStructureAnalyzer;
