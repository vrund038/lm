/**
 * WordPress Plugin Generator
 * Generates a complete WordPress plugin structure with all necessary files and best practices
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';

// Type definitions for WordPress plugin requirements
interface WPPluginRequirements {
  name: string;
  description: string;
  features: string[];
  prefix: string;
  wpVersion?: string;
  phpVersion?: string;
  textDomain?: string;
  includeAdmin?: boolean;
  includeDatabase?: boolean;
  includeAjax?: boolean;
  includeRest?: boolean;
  includeGutenberg?: boolean;
}

export class WordPressPluginGenerator extends BasePlugin implements IPromptPlugin {
  name = 'generate_wordpress_plugin';
  category = 'generate' as const;
  description = 'Generate a complete WordPress plugin structure with all necessary files and best practices';
  
  parameters = {
    name: {
      type: 'string' as const,
      description: 'Plugin name',
      required: true
    },
    description: {
      type: 'string' as const,
      description: 'Plugin description',
      required: true
    },
    features: {
      type: 'array' as const,
      description: 'List of features to include',
      required: true,
      items: { type: 'string' as const }
    },
    prefix: {
      type: 'string' as const,
      description: 'Plugin prefix for functions and classes (e.g., "wp_my_plugin")',
      required: true
    },
    wpVersion: {
      type: 'string' as const,
      description: 'Minimum WordPress version',
      required: false,
      default: '6.0'
    },
    phpVersion: {
      type: 'string' as const,
      description: 'Minimum PHP version',
      required: false,
      default: '7.4'
    },
    textDomain: {
      type: 'string' as const,
      description: 'Text domain for internationalization',
      required: false
    },
    includeAdmin: {
      type: 'boolean' as const,
      description: 'Include admin interface',
      required: false,
      default: true
    },
    includeDatabase: {
      type: 'boolean' as const,
      description: 'Include database tables',
      required: false,
      default: false
    },
    includeAjax: {
      type: 'boolean' as const,
      description: 'Include AJAX handlers',
      required: false,
      default: false
    },
    includeRest: {
      type: 'boolean' as const,
      description: 'Include REST API endpoints',
      required: false,
      default: false
    },
    includeGutenberg: {
      type: 'boolean' as const,
      description: 'Include Gutenberg blocks',
      required: false,
      default: false
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      // Validate required parameters
      if (!secureParams.name || !secureParams.description || !secureParams.features || !secureParams.prefix) {
        throw new Error('name, description, features, and prefix are required');
      }
      
      // Prepare requirements
      const requirements: WPPluginRequirements = {
        name: secureParams.name,
        description: secureParams.description,
        features: secureParams.features,
        prefix: secureParams.prefix,
        wpVersion: secureParams.wpVersion || '6.0',
        phpVersion: secureParams.phpVersion || '7.4',
        textDomain: secureParams.textDomain || secureParams.prefix,
        includeAdmin: secureParams.includeAdmin !== false,
        includeDatabase: secureParams.includeDatabase || false,
        includeAjax: secureParams.includeAjax || false,
        includeRest: secureParams.includeRest || false,
        includeGutenberg: secureParams.includeGutenberg || false
      };
      
      try {
        // Get the loaded model from LM Studio
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        const model = models[0];
        const contextLength = await model.getContextLength() || 23832;
        
        // Generate 3-stage prompt
        const promptStages = this.getPromptStages({
          requirements
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
          'generate_wordpress_plugin',
          'MODEL_ERROR',
          `Failed to generate WordPress plugin: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  // MODERN: 3-Stage prompt architecture
  getPromptStages(params: any): PromptStages {
    const requirements = params.requirements;
    const { name, description, features, wpVersion = '6.0', phpVersion = '7.4', prefix } = requirements;
    
    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert WordPress plugin developer specializing in modern, secure plugin architecture.

Plugin Development Context:
- WordPress Standards: Follow WordPress Coding Standards (WPCS)
- Security: Implement proper nonces, capabilities, escaping, and sanitization
- Architecture: Use modern PHP patterns with namespaces and dependency injection
- Compatibility: WordPress ${wpVersion}+ and PHP ${phpVersion}+
- Internationalization: Ready for translation with proper text domains

Your task is to generate a complete, production-ready WordPress plugin structure.`;

    // STAGE 2: Data payload (plugin requirements)
    const dataPayload = `Plugin Specifications:
- Name: ${name}
- Description: ${description}
- Features: ${features.join(', ')}
- Prefix: ${prefix}
- Text Domain: ${requirements.textDomain || prefix}
- Include Admin Interface: ${requirements.includeAdmin}
- Include Database: ${requirements.includeDatabase}
- Include AJAX: ${requirements.includeAjax}
- Include REST API: ${requirements.includeRest}
- Include Gutenberg Blocks: ${requirements.includeGutenberg}`;

    // STAGE 3: Output instructions
    const outputInstructions = `Generate the complete WordPress plugin structure with these files:

## Required Components:
1. **Main Plugin File** (${prefix}.php):
   - Proper plugin headers with all metadata
   - Namespace: ${prefix.charAt(0).toUpperCase() + prefix.slice(1)}
   - Main plugin class with singleton pattern
   - Proper initialization hooks

2. **Activation/Deactivation** (includes/class-${prefix}-activator.php, includes/class-${prefix}-deactivator.php):
   - Database table creation (if needed)
   - Default options setup
   - Capability registration
   - Proper cleanup on deactivation

3. **Core Functionality** (includes/class-${prefix}-core.php):
   - Hook registration (actions and filters)
   - Feature initialization
   - Error handling

${requirements.includeAdmin ? `
4. **Admin Interface** (admin/class-${prefix}-admin.php):
   - Admin menu registration
   - Settings page with sections and fields
   - Form handling with nonces
   - Admin notices system` : ''}

${requirements.includeDatabase ? `
5. **Database Handler** (includes/class-${prefix}-db.php):
   - Custom table schema
   - CRUD operations with $wpdb
   - Data validation and sanitization` : ''}

${requirements.includeAjax ? `
6. **AJAX Handlers** (includes/class-${prefix}-ajax.php):
   - Nonce verification
   - Capability checks
   - Response formatting` : ''}

${requirements.includeRest ? `
7. **REST API Endpoints** (includes/class-${prefix}-rest.php):
   - Endpoint registration
   - Permission callbacks
   - Schema definitions` : ''}

${requirements.includeGutenberg ? `
8. **Gutenberg Blocks** (blocks/):
   - Block registration
   - JavaScript/CSS assets
   - Block attributes and rendering` : ''}

## WordPress Standards Required:
- Proper escaping: esc_html(), esc_attr(), esc_url()
- Sanitization: sanitize_text_field(), sanitize_email(), etc.
- Nonce verification for all forms and AJAX
- Capability checks for all admin functions
- Internationalization: __(), _e(), _x() functions
- WordPress hooks: properly registered actions and filters

Provide complete, functional code for each file with proper error handling and security measures.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }

  // MODERN: Direct execution for small operations
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
      maxTokens: 6000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'generate_wordpress_plugin',
      response,
      model.identifier || 'unknown'
    );
  }

  // MODERN: Chunked execution for large operations
  private async executeWithChunking(stages: PromptStages, llmClient: any, model: any, promptManager: ThreeStagePromptManager) {
    const conversation = promptManager.createChunkedConversation(stages);
    
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];

    const prediction = model.respond(messages, {
      temperature: 0.3,
      maxTokens: 6000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'generate_wordpress_plugin',
      response,
      model.identifier || 'unknown'
    );
  }

  // LEGACY: Backwards compatibility method
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
}

export default WordPressPluginGenerator;
