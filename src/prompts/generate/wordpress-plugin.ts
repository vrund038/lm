/**
 * WordPress Plugin Generator
 * Generates a complete WordPress plugin structure with all necessary files and best practices
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';

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
    // Validate required parameters
    if (!params.name || !params.description || !params.features || !params.prefix) {
      throw new Error('name, description, features, and prefix are required');
    }
    
    // Prepare requirements
    const requirements: WPPluginRequirements = {
      name: params.name,
      description: params.description,
      features: params.features,
      prefix: params.prefix,
      wpVersion: params.wpVersion || '6.0',
      phpVersion: params.phpVersion || '7.4',
      textDomain: params.textDomain || params.prefix,
      includeAdmin: params.includeAdmin !== false,
      includeDatabase: params.includeDatabase || false,
      includeAjax: params.includeAjax || false,
      includeRest: params.includeRest || false,
      includeGutenberg: params.includeGutenberg || false
    };
    
    // Generate prompt
    const prompt = this.getPrompt({ requirements });
    
    // Execute and return
    const response = await llmClient.complete(prompt);
    
    // Format response
    return {
      content: response,
      metadata: {
        pluginName: params.name,
        prefix: params.prefix,
        components: {
          admin: requirements.includeAdmin,
          database: requirements.includeDatabase,
          ajax: requirements.includeAjax,
          rest: requirements.includeRest,
          gutenberg: requirements.includeGutenberg
        }
      }
    };
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
