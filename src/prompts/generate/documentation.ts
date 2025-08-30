/**
 * Documentation Generation Plugin - Modern v4.2 Architecture
 * Generates documentation for code with audience-specific formatting
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { readFileContent } from '../shared/helpers.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';

// Type definitions for documentation context
interface DocContext {
  projectType?: string;
  docStyle?: string;
  detailLevel?: string;
  includeExamples?: boolean;
  audience?: string;
  includeApiReference?: boolean;
  includeTroubleshooting?: boolean;
}

export class DocumentationGenerator extends BasePlugin implements IPromptPlugin {
  name = 'generate_documentation';
  category = 'generate' as const;
  description = 'Generate documentation for code with audience-specific formatting';
  
  parameters = {
    code: {
      type: 'string' as const,
      description: 'The code to document (optional if filePath is provided)',
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
    docStyle: {
      type: 'string' as const,
      description: 'Documentation style',
      required: false,
      enum: ['jsdoc', 'markdown', 'docstring', 'javadoc', 'phpdoc'],
      default: 'jsdoc'
    },
    includeExamples: {
      type: 'boolean' as const,
      description: 'Include usage examples in documentation',
      required: false,
      default: true
    },
    context: {
      type: 'object' as const,
      description: 'Optional context for project-specific documentation',
      required: false,
      properties: {
        projectType: {
          type: 'string' as const,
          enum: ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'node-api', 'n8n-node', 'n8n-workflow', 'html-component', 'browser-extension', 'cli-tool', 'generic'],
          description: 'Project type for appropriate documentation'
        },
        audience: {
          type: 'string' as const,
          enum: ['developer', 'end-user', 'technical', 'non-technical'],
          description: 'Target audience for documentation',
          default: 'developer'
        },
        detailLevel: {
          type: 'string' as const,
          enum: ['minimal', 'standard', 'comprehensive'],
          description: 'Level of detail in documentation',
          default: 'standard'
        },
        includeApiReference: {
          type: 'boolean' as const,
          description: 'Include API reference section',
          default: true
        },
        includeTroubleshooting: {
          type: 'boolean' as const,
          description: 'Include troubleshooting section',
          default: true
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
        let codeToDocument = secureParams.code;
        if (secureParams.filePath) {
          codeToDocument = await readFileContent(secureParams.filePath);
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
          code: codeToDocument
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
          'generate_documentation',
          'EXECUTION_ERROR',
          `Failed to generate documentation: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  getPromptStages(params: any): PromptStages {
    const context: DocContext = {
      projectType: params.context?.projectType || 'generic',
      docStyle: params.docStyle || 'jsdoc',
      detailLevel: params.context?.detailLevel || 'standard',
      includeExamples: params.includeExamples !== false,
      audience: params.context?.audience || 'developer',
      includeApiReference: params.context?.includeApiReference !== false,
      includeTroubleshooting: params.context?.includeTroubleshooting !== false
    };

    // STAGE 1: System instructions and context
    const systemAndContext = `You are a documentation expert specializing in creating clear, comprehensive documentation for ${context.audience} audiences.

Documentation Context:
- Style: ${context.docStyle}
- Detail Level: ${context.detailLevel}
- Project Type: ${context.projectType}
- Language: ${params.language || 'javascript'}
- Include Examples: ${context.includeExamples}
- Include API Reference: ${context.includeApiReference}
- Include Troubleshooting: ${context.includeTroubleshooting}

Your task is to create professional documentation that helps developers understand and effectively use the code.`;

    // STAGE 2: Data payload (the code to document)
    const dataPayload = `Code to document:

\`\`\`${params.language || 'javascript'}
${params.code}
\`\`\``;

    // STAGE 3: Output instructions
    const outputInstructions = `Generate comprehensive documentation with the following structure:

## 1. Overview
Brief description of purpose, problem solved, and key benefits

## 2. Installation/Setup
${this.getSetupInstructions(context.projectType)}

## 3. Usage
Core implementation patterns and basic usage examples

${context.includeApiReference ? `## 4. API Reference
Complete function/method reference with parameters and return types` : ''}

## 5. Configuration
Settings, environment variables, and customization options

## 6. Dependencies
External requirements and version constraints

${context.includeExamples ? `## 7. Examples
${this.getExampleRequirements(context.projectType, context.audience)}` : ''}

${context.includeTroubleshooting ? `## 8. Troubleshooting
Common issues and solutions` : ''}

## 9. Best Practices
Recommended patterns and anti-patterns to avoid

${this.getProjectSpecificDocRequirements(context.projectType)}

Format your response in clean ${context.docStyle} style, appropriate for ${context.audience} audience at ${context.detailLevel} detail level.`;

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
      temperature: 0.1,
      maxTokens: 2500
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'generate_documentation',
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
      temperature: 0.1,
      maxTokens: 2500
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'generate_documentation',
      response,
      model.identifier || 'unknown'
    );
  }

  // Helper functions for documentation
  private getSetupInstructions(projectType?: string): string {
    const setupGuides: Record<string, string> = {
      'wordpress-plugin': 'WordPress version requirements, installation steps, activation process',
      'wordpress-theme': 'WordPress version, theme installation, customizer setup',
      'node-api': 'Node version, npm install, environment setup, database configuration',
      'react-app': 'Prerequisites, npm/yarn install, development server setup',
      'react-component': 'Package installation, peer dependencies, usage in React app',
      'n8n-node': 'n8n version compatibility, node installation, credential setup',
      'n8n-workflow': 'n8n instance setup, workflow import, credential configuration',
      'html-component': 'Browser compatibility, CSS/JS dependencies, integration steps',
      'browser-extension': 'Browser compatibility, installation methods, permissions setup',
      'cli-tool': 'System requirements, installation via npm/binary, PATH setup',
      'generic': 'Prerequisites and installation steps'
    };
    return setupGuides[projectType || 'generic'] || setupGuides.generic;
  }

  private getExampleRequirements(_projectType?: string, audience?: string): string {
    if (audience === 'developer') {
      return 'Working code samples with imports, error handling, and edge cases';
    } else {
      return 'Simple, practical examples with clear explanations';
    }
  }

  private getProjectSpecificDocRequirements(projectType?: string): string {
    const requirements: Record<string, string> = {
      'wordpress-plugin': `
### WordPress-Specific Requirements:
- Hook reference (actions and filters)
- Shortcode usage (if applicable)
- Admin interface guide
- Database schema (if custom tables)
- Multisite considerations
- Translation/localization guide`,
      
      'wordpress-theme': `
### WordPress Theme Requirements:
- Template hierarchy
- Customizer options
- Widget areas
- Menu locations
- Theme hooks
- Child theme guide`,
      
      'node-api': `
### API-Specific Requirements:
- Endpoint reference with methods
- Request/response examples
- Authentication guide
- Rate limiting information
- Error response formats
- API versioning`,
      
      'react-app': `
### React-Specific Requirements:
- Component props and types
- State management approach
- Routing structure
- Build and deployment
- Performance optimization tips
- Browser compatibility`,
      
      'react-component': `
### React Component Requirements:
- Props interface
- Event callbacks
- Styling customization
- Usage examples
- Storybook stories
- Testing guide`,
      
      'n8n-node': `
### n8n-Specific Requirements:
- Node configuration options
- Credential setup guide
- Input/output data formats
- Error handling behavior
- Webhook setup (if applicable)
- Resource limitations`,
      
      'n8n-workflow': `
### n8n Workflow Requirements:
- Workflow purpose and flow
- Required nodes and versions
- Environment variables
- Credential requirements
- Trigger configuration
- Error handling strategy`,
      
      'html-component': `
### HTML Component Requirements:
- Browser support matrix
- CSS variables for theming
- JavaScript API
- Event listeners
- Accessibility features
- Integration examples`,
      
      'browser-extension': `
### Browser Extension Requirements:
- Supported browsers
- Installation guide
- Permission explanations
- User interface guide
- Storage usage
- Update process`,
      
      'cli-tool': `
### CLI Tool Requirements:
- Command reference
- Option flags
- Configuration files
- Environment variables
- Exit codes
- Scripting examples`,
      
      'generic': ''
    };
    
    return requirements[projectType || 'generic'] || '';
  }

  // Legacy compatibility method
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
}

export default DocumentationGenerator;
