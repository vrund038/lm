/**
 * WordPress Plugin Generator
 * Generates a complete WordPress plugin structure with all necessary files and best practices
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { withSecurity } from '../../security/integration-helpers.js';

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
      
      // Generate prompt
      const prompt = this.getPrompt({ requirements });
      
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
            content: 'You are an expert WordPress plugin developer. Generate complete, production-ready WordPress plugins following WordPress coding standards, security best practices, and modern PHP patterns. Include proper hooks, nonces, capabilities, and internationalization.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
        temperature: 0.3,
        maxTokens: 6000
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
        'generate_wordpress_plugin',
        response,
        model.identifier || 'unknown'
      );
      
    } catch (error: any) {
      return ResponseFactory.createErrorResponse(
        'generate_wordpress_plugin',
        'MODEL_ERROR',
        `Failed to generate WordPress plugin: ${error.message}`,
        { originalError: error.message },
        'unknown'
      );
    }
  }

  getPrompt(params: any): string {
    const requirements = params.requirements;
    const { name, description, features, wpVersion = '6.0', phpVersion = '7.4', prefix } = requirements;
    
    return `Create a WordPress plugin following these specifications:

Plugin Details:
- Name: ${name}
- Purpose: ${description}
- Features: ${features.join(', ')}
- WordPress Version: ${wpVersion}+
- PHP Version: ${phpVersion}+
- Text Domain: ${requirements.textDomain || prefix}

Required Components:
1. **Main Plugin File** (${prefix}.php):
   - Proper plugin headers with all metadata
   - Namespace: ${prefix.charAt(0).toUpperCase() + prefix.slice(1)}
   - Main plugin class with singleton pattern
   - Proper initialization hooks

2. **Activation/Deactivation** (includes/class-${prefix}-activator.php, includes/class-${prefix}-deactivator.php):
   - Database table creation (if needed)
   - Default options setup
   - Capability registration
   - Scheduled events setup
   - Proper cleanup on deactivation

3. **Core Functionality** (includes/class-${prefix}-core.php):
   - Hook registration (actions and filters)
   - Dependency injection setup
   - Feature initialization
   - Error handling

${requirements.includeAdmin ? `
4. **Admin Interface** (admin/class-${prefix}-admin.php):
   - Admin menu registration
   - Settings page with sections and fields
   - Form handling with nonces
   - Admin notices system
   - Screen options (if applicable)` : ''}

${requirements.includeDatabase ? `
5. **Database Handler** (includes/class-${prefix}-db.php):
   - Custom table schema
   - CRUD operations with $wpdb
   - Data validation and sanitization
   - Migration support for updates` : ''}

${requirements.includeAjax ? `
6. **AJAX Handlers** (includes/class-${prefix}-ajax.php):
   - Nonce verification
   - Capability checks
   - Response formatting
   - Error handling with wp_send_json_error()` : ''}

${requirements.includeRest ? `
7. **REST API Endpoints** (includes/class-${prefix}-rest.php):
   - Endpoint registration
   - Permission callbacks
   - Schema definitions
   - Response formatting` : ''}

${requirements.includeGutenberg ? `
8. **Gutenberg Block** (blocks/):
   - Block registration
   - Edit and save components
   - Block attributes and controls
   - Server-side rendering (if dynamic)` : ''}

9. **Uninstall Cleanup** (uninstall.php):
   - Remove database tables
   - Clean up options
   - Remove user meta
   - Clear scheduled events

WordPress Coding Standards to Follow:
- Use proper prefixing: ${prefix}_ for functions, ${prefix.toUpperCase()}_ for constants
- Escape all output: esc_html(), esc_attr(), esc_url(), wp_kses()
- Sanitize all input: sanitize_text_field(), sanitize_email(), etc.
- Use WordPress APIs exclusively (don't reinvent)
- Include inline documentation (PHPDoc blocks)
- Implement internationalization: __(), _e(), _n()
- Add action/filter documentation

Security Requirements:
- Nonce verification on all forms and AJAX
- Capability checks: current_user_can()
- SQL injection prevention: $wpdb->prepare()
- File upload validation (if applicable)
- Data validation before saving

Generate:
1. Complete file structure with all necessary files
2. Core plugin code with proper OOP structure
3. Basic admin interface with settings
4. Installation and usage instructions
5. Hook reference documentation

File Structure:
${prefix}/
├── ${prefix}.php
├── uninstall.php
├── readme.txt
├── includes/
│   ├── class-${prefix}-activator.php
│   ├── class-${prefix}-deactivator.php
│   ├── class-${prefix}-core.php
│   └── class-${prefix}-loader.php
├── admin/
│   ├── class-${prefix}-admin.php
│   ├── css/
│   └── js/
├── public/
│   ├── class-${prefix}-public.php
│   ├── css/
│   └── js/
└── languages/

Provide complete, working code for each file with proper WordPress standards and security practices.`;
  }
}

export default WordPressPluginGenerator;
