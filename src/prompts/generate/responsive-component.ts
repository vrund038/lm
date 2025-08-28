/**
 * Responsive Component Generator
 * Generates responsive, accessible HTML/CSS components with modern best practices
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';

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
    // Validate required parameters
    if (!params.name || !params.type) {
      throw new Error('name and type are required');
    }
    
    // Prepare specifications
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
    
    // Generate prompt
    const prompt = this.getPrompt({ specs });
    
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
          content: 'You are an expert frontend developer specializing in responsive, accessible web components. Create production-ready HTML/CSS/JavaScript components following modern web standards, WCAG accessibility guidelines, and responsive design principles.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
        temperature: 0.3,
        maxTokens: 5000
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
        component: response,
        metadata: {
          componentName: params.name,
          componentType: params.type,
          framework: specs.framework,
          features: {
            responsive: specs.responsive,
            accessible: specs.accessible,
            animations: specs.animations,
            darkMode: specs.darkMode
          },
          modelUsed: model.identifier || 'unknown'
        }
      };
      
    } catch (error: any) {
      throw new Error(`Failed to generate responsive component: ${error.message}`);
    }
  }

  getPrompt(params: any): string {
    const specs = params.specs;
    const { name, type, framework = 'vanilla', designSystem = 'custom' } = specs;
    
    return `Create a responsive, accessible ${type} component named "${name}":

Component Specifications:
- Type: ${type}
- Framework: ${framework}
- Design System: ${designSystem}
- Responsive: ${specs.responsive !== false}
- Accessible: ${specs.accessible !== false}
- Animations: ${specs.animations || false}
- Dark Mode: ${specs.darkMode || false}

Requirements:

1. **HTML Structure**:
   - Semantic HTML5 elements
   - ARIA labels and roles where needed
   - Proper heading hierarchy
   - Form labels and associations
   - Landmark regions (if applicable)

2. **CSS Implementation**:
   - Mobile-first responsive design
   - CSS Grid and/or Flexbox for layout
   - CSS custom properties for theming:
     * --${name}-primary-color
     * --${name}-background
     * --${name}-text-color
     * --${name}-spacing
     * --${name}-border-radius
   - Container queries (if supported)
   - Logical properties for RTL support

3. **Accessibility Features**:
   - Keyboard navigation (tab order, arrow keys where appropriate)
   - Focus indicators (visible and high contrast)
   - Screen reader announcements
   - Color contrast (WCAG 2.1 AA minimum)
   - Touch targets (minimum 44x44px)
   - Reduced motion support

4. **Responsive Breakpoints**:
   - Mobile: 320px - 767px
   - Tablet: 768px - 1023px
   - Desktop: 1024px+
   - Handle landscape orientation
   - Fluid typography with clamp()

5. **Interactive Features** (if applicable):
   - State management (open/closed, active/inactive)
   - Smooth transitions
   - Loading states
   - Error states
   - Empty states

${specs.animations ? `
6. **Animation Requirements**:
   - Respect prefers-reduced-motion
   - Performance optimized (transform, opacity)
   - Natural easing functions
   - No layout shifts` : ''}

${specs.darkMode ? `
7. **Dark Mode Support**:
   - CSS custom properties for colors
   - Media query: prefers-color-scheme
   - Smooth transitions between modes
   - Proper contrast in both modes` : ''}

${framework === 'react' ? `
8. **React Specific**:
   - TypeScript interfaces for props
   - Proper event handlers
   - Ref forwarding support
   - Memoization where appropriate
   - Error boundaries` : ''}

${framework === 'vue' ? `
8. **Vue Specific**:
   - Composition API preferred
   - Props validation
   - Emitted events documentation
   - Scoped slots support
   - Transition components` : ''}

${framework === 'angular' ? `
8. **Angular Specific**:
   - Component decorator setup
   - Input/Output decorators
   - Change detection strategy
   - Template reference variables
   - Dependency injection` : ''}

${framework === 'svelte' ? `
8. **Svelte Specific**:
   - Props with defaults
   - Event dispatching
   - Stores for state
   - Transitions and animations
   - Slot support` : ''}

Generate:
1. **HTML Structure** with all semantic markup
2. **CSS Styles** (mobile-first, organized by component parts)
3. **JavaScript** (if interactive, with proper event handling)
4. **Usage Documentation** with examples
5. **Accessibility Notes** for developers
6. **Browser Support** information
7. **Customization Guide** for theming

Make it production-ready with performance optimization and cross-browser compatibility.`;
  }
}

export default ResponsiveComponentGenerator;
