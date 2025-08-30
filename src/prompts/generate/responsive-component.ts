/**
 * Responsive Component Generator - Modern v4.2 Architecture
 * Generates responsive, accessible HTML/CSS components with modern best practices
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';

// Type definitions for component specifications
interface ComponentSpecs {
  name: string;
  type: string;
  framework?: string;
  designSystem?: string;
  responsive?: boolean;
  accessible?: boolean;
  animations?: boolean;
  darkMode?: boolean;
}

export class ResponsiveComponentGenerator extends BasePlugin implements IPromptPlugin {
  name = 'generate_responsive_component';
  category = 'generate' as const;
  description = 'Generate a responsive, accessible HTML/CSS component with modern best practices';
  
  parameters = {
    name: {
      type: 'string' as const,
      description: 'Component name',
      required: true
    },
    type: {
      type: 'string' as const,
      description: 'Component type',
      required: true,
      enum: ['button', 'form', 'card', 'modal', 'navigation', 'layout', 'custom']
    },
    framework: {
      type: 'string' as const,
      description: 'Framework to use',
      required: false,
      enum: ['vanilla', 'react', 'vue', 'angular', 'svelte'],
      default: 'vanilla'
    },
    designSystem: {
      type: 'string' as const,
      description: 'Design system to follow',
      required: false,
      default: 'custom'
    },
    responsive: {
      type: 'boolean' as const,
      description: 'Make component responsive',
      required: false,
      default: true
    },
    accessible: {
      type: 'boolean' as const,
      description: 'Include accessibility features',
      required: false,
      default: true
    },
    animations: {
      type: 'boolean' as const,
      description: 'Include animations',
      required: false,
      default: false
    },
    darkMode: {
      type: 'boolean' as const,
      description: 'Include dark mode support',
      required: false,
      default: false
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // Validate required parameters
        if (!secureParams.name || !secureParams.type) {
          throw new Error('name and type are required');
        }
        
        // Get loaded models
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        const model = models[0];
        const contextLength = await model.getContextLength() || 23832;
        
        // Generate 3-stage prompt
        const promptStages = this.getPromptStages(secureParams);
        
        // Determine if chunking is needed (components usually don't need chunking)
        const promptManager = new ThreeStagePromptManager(contextLength);
        const needsChunking = promptManager.needsChunking(promptStages);
        
        if (needsChunking) {
          return await this.executeWithChunking(promptStages, llmClient, model, promptManager);
        } else {
          return await this.executeDirect(promptStages, llmClient, model);
        }
        
      } catch (error: any) {
        return ResponseFactory.createErrorResponse(
          'generate_responsive_component',
          'EXECUTION_ERROR',
          `Failed to generate responsive component: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  getPromptStages(params: any): PromptStages {
    const specs: ComponentSpecs = {
      name: params.name,
      type: params.type,
      framework: params.framework || 'vanilla',
      designSystem: params.designSystem || 'custom',
      responsive: params.responsive !== false,
      accessible: params.accessible !== false,
      animations: params.animations || false,
      darkMode: params.darkMode || false
    };

    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert frontend developer specializing in responsive, accessible web components. Your task is to create production-ready components following modern web standards.

Component Specifications:
- Name: ${specs.name}
- Type: ${specs.type}
- Framework: ${specs.framework}
- Design System: ${specs.designSystem}
- Responsive: ${specs.responsive}
- Accessible: ${specs.accessible}
- Animations: ${specs.animations}
- Dark Mode: ${specs.darkMode}

You must create components that follow WCAG accessibility guidelines, responsive design principles, and modern frontend best practices.`;

    // STAGE 2: Data payload (specifications and requirements)
    const dataPayload = `Create a ${specs.type} component named "${specs.name}" with the following requirements:

**Technical Requirements:**
- Framework: ${specs.framework}
- Design System: ${specs.designSystem}
- Responsive Design: ${specs.responsive ? 'Mobile-first approach' : 'Fixed width'}
- Accessibility: ${specs.accessible ? 'WCAG 2.1 AA compliance' : 'Basic accessibility'}
- Animations: ${specs.animations ? 'Performance-optimized animations' : 'Static component'}
- Dark Mode: ${specs.darkMode ? 'System preference detection' : 'Single theme'}

**Browser Compatibility:**
- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Progressive enhancement for older browsers
- CSS feature detection where needed

**Performance Requirements:**
- Minimize layout shifts (CLS)
- Optimize for Core Web Vitals
- Efficient CSS selectors
- Minimal JavaScript where needed`;

    // STAGE 3: Output instructions
    const outputInstructions = `Generate a complete, production-ready component with this structure:

## HTML Structure
Semantic HTML5 markup with proper ARIA attributes

## CSS Styles
Component styles with custom properties for theming:
- Mobile-first responsive design
- Dark mode support (if enabled)
- Animation definitions (if enabled)

## JavaScript Functionality
Interactive behavior implementation:
- Event handlers
- State management
- Error handling

${this.getFrameworkSpecificRequirements(specs.framework)}

## Usage Examples
- Basic implementation
- Advanced customization
- Integration examples

## Accessibility Features
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- Color contrast compliance

## Customization Guide
CSS custom properties available:
- --${specs.name}-primary-color
- --${specs.name}-background
- --${specs.name}-text-color
- --${specs.name}-spacing
- --${specs.name}-border-radius

## Browser Support Matrix
Compatible browsers and fallbacks

## Performance Notes
- Rendering optimizations
- Bundle size considerations
- Runtime performance tips

Ensure all code is production-ready with proper error handling and edge case coverage.`;

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
      maxTokens: 5000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'generate_responsive_component',
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
      maxTokens: 5000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'generate_responsive_component',
      response,
      model.identifier || 'unknown'
    );
  }

  // Helper function for framework-specific requirements
  private getFrameworkSpecificRequirements(framework: string): string {
    const requirements: Record<string, string> = {
      'react': `
## React Implementation
TypeScript component with proper props interface:
- Ref forwarding support
- Memoization where appropriate
- Error boundaries

### Props Interface
- Type definitions for all props
- Default values documentation
- Event handler signatures`,

      'vue': `
## Vue Implementation
Composition API implementation:
- Props validation
- Emitted events documentation
- Scoped slots support

### Vue Features
- Composition API setup
- Reactive properties
- Template refs
- Event emission`,

      'angular': `
## Angular Implementation
Component decorator setup:
- Input/Output decorators
- Change detection strategy
- Template reference variables

### Angular Features
- Component lifecycle hooks
- Dependency injection
- Template binding
- Event handling`,

      'svelte': `
## Svelte Implementation
Component with enhanced features:
- Props with defaults
- Event dispatching
- Stores for state
- Transitions and animations

### Svelte Features
- Reactive declarations
- Component events
- Slot support
- Built-in transitions`,

      'vanilla': `
## Vanilla JavaScript
ES6+ implementation:
- Class or factory function pattern
- Event delegation
- DOM manipulation helpers
- Module pattern

### Vanilla Features
- No framework dependencies
- Web Components compatibility
- Progressive enhancement
- Minimal JavaScript footprint`
    };

    return requirements[framework] || requirements['vanilla'];
  }

  // Legacy compatibility method
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
}

export default ResponsiveComponentGenerator;
