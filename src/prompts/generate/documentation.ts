/**
 * Documentation Generation Plugin
 * Generates documentation for code with audience-specific formatting
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { readFileContent } from '../shared/helpers.js';

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
    // Validate at least one input provided
    if (!params.code && !params.filePath) {
      throw new Error('Either code or filePath must be provided');
    }
    
    // Read file if needed
    let codeToDocument = params.code;
    if (params.filePath) {
      codeToDocument = await readFileContent(params.filePath);
    }
    
    // Prepare context with defaults
    const context: DocContext = {
      projectType: params.context?.projectType || 'generic',
      docStyle: params.docStyle || 'jsdoc',
      detailLevel: params.context?.detailLevel || 'standard',
      includeExamples: params.includeExamples !== false,
      audience: params.context?.audience || 'developer',
      includeApiReference: params.context?.includeApiReference !== false,
      includeTroubleshooting: params.context?.includeTroubleshooting !== false
    };
    
    // Generate prompt
    const prompt = this.getPrompt({ ...params, code: codeToDocument, context });
    
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
          content: 'You are a documentation expert. Generate clear, comprehensive documentation that helps developers understand and use code effectively. Follow the specified documentation style and include practical examples.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
        temperature: 0.1,
        maxTokens: 2500
      });
      
      // Stream the response
      let response = '';
      for await (const chunk of prediction) {
        if (chunk.content) {
          response += chunk.content;
        }
      }
      
      // Format response
      return {
        documentation: response,
        metadata: {
          language: params.language || 'javascript',
          docStyle: context.docStyle,
          audience: context.audience,
          projectType: context.projectType,
          modelUsed: model.identifier || 'unknown'
        }
      };
      
    } catch (error: any) {
      throw new Error(`Failed to generate documentation: ${error.message}`);
    }
  }

  getPrompt(params: any): string {
    const content = params.code;
    const context = params.context || {};
    
    const { projectType, docStyle, detailLevel, includeExamples, audience } = context;
    
    return `Generate documentation for ${audience || 'developer'} audience.

Documentation Standards:
- Style: ${docStyle || 'jsdoc'}
- Detail Level: ${detailLevel || 'standard'}
- Include Examples: ${includeExamples !== false}
- Project Type: ${projectType || 'generic'}

Required Sections:
1. **Overview**: What problem does this solve? Why was it built?
2. **Installation/Setup**: ${this.getSetupInstructions(projectType)}
3. **Usage**: How to implement/use this code
4. **API Reference**: ${context.includeApiReference !== false ? 'All public methods/functions with parameters and return types' : 'Skip API reference'}
5. **Configuration**: Required settings, environment variables, or options
6. **Dependencies**: External requirements and version constraints
7. **Examples**: ${includeExamples ? this.getExampleRequirements(projectType, audience) : 'Skip examples'}
8. **Troubleshooting**: ${context.includeTroubleshooting !== false ? 'Common issues and solutions' : 'Skip troubleshooting'}
9. **Best Practices**: Recommended usage patterns and anti-patterns to avoid

${this.getProjectSpecificDocRequirements(projectType)}

Documentation should be:
- Clear and concise for ${audience || 'developer'} audience
- Technically accurate with proper terminology
- Well-structured with logical flow
- Searchable with good headings
- Compatible with ${docStyle || 'jsdoc'} format

Code to document:
${content}`;
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
WordPress-Specific Documentation:
- Hook reference (actions and filters)
- Shortcode usage (if applicable)
- Admin interface guide
- Database schema (if custom tables)
- Multisite considerations
- Translation/localization guide`,
      
      'wordpress-theme': `
WordPress Theme Documentation:
- Template hierarchy
- Customizer options
- Widget areas
- Menu locations
- Theme hooks
- Child theme guide`,
      
      'node-api': `
API-Specific Documentation:
- Endpoint reference with methods
- Request/response examples
- Authentication guide
- Rate limiting information
- Error response formats
- API versioning`,
      
      'react-app': `
React-Specific Documentation:
- Component props and types
- State management approach
- Routing structure
- Build and deployment
- Performance optimization tips
- Browser compatibility`,
      
      'react-component': `
React Component Documentation:
- Props interface
- Event callbacks
- Styling customization
- Usage examples
- Storybook stories
- Testing guide`,
      
      'n8n-node': `
n8n-Specific Documentation:
- Node configuration options
- Credential setup guide
- Input/output data formats
- Error handling behavior
- Webhook setup (if applicable)
- Resource limitations`,
      
      'n8n-workflow': `
n8n Workflow Documentation:
- Workflow purpose and flow
- Required nodes and versions
- Environment variables
- Credential requirements
- Trigger configuration
- Error handling strategy`,
      
      'html-component': `
HTML Component Documentation:
- Browser support matrix
- CSS variables for theming
- JavaScript API
- Event listeners
- Accessibility features
- Integration examples`,
      
      'browser-extension': `
Browser Extension Documentation:
- Supported browsers
- Installation guide
- Permission explanations
- User interface guide
- Storage usage
- Update process`,
      
      'cli-tool': `
CLI Tool Documentation:
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
}

export default DocumentationGenerator;
