/**
 * Plugin Template - Modern v4.2 (Single Source of Truth)
 * 
 * Universal template that intelligently handles both single-file and multi-file analysis
 * Automatically detects analysis type based on provided parameters
 * 
 * Copy this template for creating any new plugin - it adapts to your needs
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { readFileContent } from '../shared/helpers.js';
import { 
  ModelSetup, 
  ResponseProcessor, 
  ParameterValidator, 
  ErrorHandler,
  MultiFileAnalysis
} from '../../utils/plugin-utilities.js';
import { getAnalysisCache } from '../../cache/index.js';

// Common Node.js modules - Use these instead of require()
import { basename, dirname, extname, join, relative } from 'path';
import { readFile, stat, readdir } from 'fs/promises';

export class ResponsiveComponentGenerator extends BasePlugin implements IPromptPlugin {
  name = 'generate_responsive_component';
  category = 'generate' as const;
  description = 'Generate responsive, accessible HTML/CSS components with modern best practices';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Component generation parameters
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
    },
    saveDirectory: {
      type: 'string' as const,
      description: 'Directory to save the component project (e.g., "C:\\dev\\my-project"). If not provided, user will be prompted to specify location.',
      required: false
    },
    context: {
      type: 'object' as const,
      description: 'Rich context object with brand information, design references, content, colors, typography, and technical requirements',
      required: false
    }
  };

  private analysisCache = getAnalysisCache();
  private multiFileAnalysis = new MultiFileAnalysis();

  constructor() {
    super();
    // Cache and analysis utilities are initialized above
  }

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // Validate required parameters
        if (!secureParams.name || !secureParams.type) {
          throw new Error('name and type are required parameters');
        }
        
        // Handle directory specification
        if (!secureParams.saveDirectory) {
          return {
            success: false,
            requiresUserInput: true,
            message: `Please specify where to save the ${secureParams.name} component project.`,
            prompt: `Where would you like to save the component project?`,
            suggestions: [
              `C:\\dev\\${secureParams.name.toLowerCase()}-component`,
              `C:\\projects\\${secureParams.name.toLowerCase()}-component`,
              `C:\\components\\${secureParams.name.toLowerCase()}-component`
            ],
            nextAction: {
              function: 'generate_responsive_component',
              parameters: {
                ...secureParams,
                saveDirectory: '[USER_WILL_SPECIFY]'
              }
            }
          };
        }
        
        // Setup model
        const { model, contextLength } = await ModelSetup.getReadyModel(llmClient);
        
        // Generate component (this is always a generation task, not file analysis)
        const promptStages = this.getComponentGenerationStages(secureParams);
        
        // Execute with appropriate method
        const promptManager = new ThreeStagePromptManager(contextLength);
        const needsChunking = promptManager.needsChunking(promptStages);
        
        let response;
        if (needsChunking) {
          const conversation = promptManager.createChunkedConversation(promptStages);
          const messages = [
            conversation.systemMessage,
            ...conversation.dataMessages,
            conversation.analysisMessage
          ];
          
          response = await ResponseProcessor.executeChunked(
            messages,
            model,
            contextLength,
            'generate_responsive_component',
            'single'
          );
        } else {
          response = await ResponseProcessor.executeDirect(
            promptStages,
            model,
            contextLength,
            'generate_responsive_component'
          );
        }

        // Auto-save the generated component to the specified directory
        if (response.success && response.data?.content) {
          try {
            const saveResult = await this.autoSaveComponent(secureParams, response.data.content);
            
            // Add save information to the response
            response.data.savedFiles = saveResult;
            response.data.projectPath = saveResult.projectPath;
            response.data.demoUrl = saveResult.demoUrl;
            response.data.instructions = [
              `✅ Component project created at: ${saveResult.projectPath}`,
              `🌐 Open demo in browser: ${saveResult.demoUrl}`,
              `📁 Ready for GitHub: Complete project structure with README.md`,
              `🔧 Development ready: ${secureParams.framework !== 'vanilla' ? 'Run npm install to get started' : 'All files ready to use'}`
            ];
          } catch (saveError) {
            // Don't fail the entire operation if saving fails
            response.data.saveError = `Failed to auto-save component: ${saveError.message}`;
          }
        }

        return response;
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('generate_responsive_component', error);
      }
    });
  }

  /**
   * Generate component creation prompt stages
   */
  private getComponentGenerationStages(params: any): PromptStages {
    const { name, type, framework, designSystem, responsive, accessible, animations, darkMode, context } = params;
    
    const systemAndContext = `You are an expert frontend developer and UI/UX engineer with 15+ years of experience creating production-ready, accessible web components.

**YOUR EXPERTISE:**
- Modern web standards (HTML5, CSS Grid/Flexbox, ES6+)
- Accessibility compliance (WCAG 2.1 AA standards)
- Performance optimization (Core Web Vitals, progressive enhancement)
- Cross-browser compatibility and responsive design
- Framework-specific best practices and patterns
- Design system implementation and theming

**COMPONENT SPECIFICATIONS:**
- Component Name: ${name}
- Component Type: ${type}
- Target Framework: ${framework}
- Design System: ${designSystem}
- Responsive Design: ${responsive ? 'Mobile-first approach with fluid layouts' : 'Fixed-width design'}
- Accessibility: ${accessible ? 'Full WCAG 2.1 AA compliance with semantic markup' : 'Basic accessibility'}
- Animations: ${animations ? 'Performance-optimized CSS animations and transitions' : 'Static component without animations'}
- Dark Mode: ${darkMode ? 'System preference detection with CSS custom properties' : 'Single theme implementation'}

${context ? this.buildContextSection(context) : ''}

**QUALITY STANDARDS:**
You must create enterprise-grade components that are production-ready, maintainable, and follow industry best practices. Focus on creating components that developers will be excited to use and proud to ship.`;

    const dataPayload = `**COMPONENT REQUIREMENTS:**

**Functional Requirements:**
- Component must be fully functional and interactive
- All states and edge cases properly handled
- Consistent behavior across different screen sizes
- Graceful degradation for older browsers

**Technical Requirements:**
- Semantic HTML5 markup with proper structure
- Modern CSS with custom properties for theming
- Clean, maintainable JavaScript/TypeScript code
- Performance-optimized with minimal bundle impact
- Cross-browser compatible (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

**Framework-Specific Considerations:**
${this.getFrameworkRequirements(framework)}

**Accessibility Requirements:**
${accessible ? `
- Proper ARIA labels, roles, and properties
- Keyboard navigation support (Tab, Enter, Escape, Arrow keys)
- Screen reader compatibility with descriptive content
- Focus management and visual focus indicators
- Color contrast ratios meeting WCAG AA standards
- Error messaging and form validation feedback
` : '- Basic accessibility with semantic HTML'}

**Responsive Design Requirements:**
${responsive ? `
- Mobile-first CSS approach with progressive enhancement
- Flexible grid systems and fluid typography
- Touch-friendly interaction targets (minimum 44px)
- Optimized for common breakpoints: 320px, 768px, 1024px, 1440px
- Container queries where beneficial
` : '- Fixed-width design optimized for desktop'}

${context ? this.buildContextRequirements(context) : ''}`;

    const outputInstructions = `**GENERATE COMPLETE COMPONENT PACKAGE WITH STRUCTURED SECTIONS:**

**IMPORTANT**: Structure your response with clear section markers for automatic file extraction.

## 1. Component Implementation

\`\`\`${framework === 'react' ? 'tsx' : framework === 'vue' ? 'vue' : framework === 'angular' ? 'ts' : framework === 'svelte' ? 'svelte' : 'js'}
// Complete ${framework} component code here
\`\`\`

## 2. HTML Structure ${framework === 'vanilla' ? '(Main Implementation)' : '(Reference)'}

\`\`\`html
<!-- Semantic HTML5 markup with proper ARIA attributes -->
\`\`\`

## 3. CSS Styles

\`\`\`css
/* Complete component styles with custom properties for theming */
/* Include responsive design, dark mode (if enabled), and animations (if enabled) */
\`\`\`

## 4. Usage Examples

\`\`\`${framework === 'react' ? 'tsx' : framework === 'vue' ? 'vue' : 'js'}
// Basic usage example
// Advanced configuration example  
\`\`\`

## 5. Customization Guide
- CSS custom properties available
- Component configuration options
- Theming instructions

## 6. Accessibility Features
- Keyboard navigation support
- Screen reader compatibility  
- ARIA patterns implemented

## 7. Browser Support & Performance
- Compatibility matrix
- Performance optimizations included

**COMPONENT WILL BE AUTO-SAVED TO:** \`${params.saveDirectory || 'C:/DEV/components/' + name.toLowerCase() + '-component'}\`
- Component file: \`src/${name}.${this.getComponentExtension(framework)}\`
- Styles: \`styles/${name}.css\`
- Demo: \`demo/index.html\` (open in browser to test immediately)
- Documentation: \`README.md\`
${framework !== 'vanilla' ? `- Package: \`package.json\`${framework === 'react' ? ' (with React dependencies)' : framework === 'vue' ? ' (with Vue dependencies)' : ''}` : ''}

Generate production-quality code that developers can immediately use, test in browser, and commit to GitHub!`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Get framework-specific requirements for better component generation
   */
  private getFrameworkRequirements(framework: string): string {
    const requirements: Record<string, string> = {
      'react': `
**React-Specific Requirements:**
- Functional component with TypeScript interfaces
- Props validation and default values
- Ref forwarding for DOM access
- Custom hooks for complex state management
- Memo optimization where appropriate
- Error boundary considerations`,

      'vue': `
**Vue-Specific Requirements:**
- Composition API with TypeScript support
- Props definition with validation
- Emitted events documentation
- Scoped styles and CSS modules
- Reactive properties and computed values
- Template reference variables`,

      'angular': `
**Angular-Specific Requirements:**
- Component class with decorators
- Input/Output property bindings
- Change detection strategy optimization
- Dependency injection patterns
- Angular Material integration (if applicable)
- OnPush change detection where beneficial`,

      'svelte': `
**Svelte-Specific Requirements:**
- Component script with TypeScript
- Reactive declarations and stores
- Component events and slots
- Built-in transition animations
- Style encapsulation
- Progressive enhancement patterns`,

      'vanilla': `
**Vanilla JavaScript Requirements:**
- ES6+ module pattern or class-based approach
- Web Components compatibility (Custom Elements API)
- Event delegation for performance
- DOM manipulation helpers
- Progressive enhancement approach
- No framework dependencies`
    };

    return requirements[framework] || requirements['vanilla'];
  }

  /**
   * Required for backwards compatibility
   */
  getPromptStages(params: any): PromptStages {
    return this.getComponentGenerationStages(params);
  }

  // Generation-specific helper methods
  private async discoverRelevantFiles(
    projectPath: string, 
    maxDepth: number,
    analysisType: string
  ): Promise<string[]> {
    // For component generation, we don't typically need file discovery
    // But the template requires this method
    return [];
  }

  private async performMultiFileAnalysis(
    files: string[],
    params: any,
    model: any,
    contextLength: number
  ): Promise<any> {
    // Component generation doesn't use multi-file analysis
    // But template requires this method for consistency
    return {
      summary: `Component generation request for ${params.name}`,
      findings: [],
      data: {
        componentSpecs: params
      }
    };
  }

  private async analyzeIndividualFile(file: string, params: any, model: any): Promise<any> {
    // Not used for component generation, but required by template
    return {
      filePath: file,
      fileName: basename(file),
      size: 0,
      lines: 0
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    // Component generation doesn't use file extensions in the same way
    // But template requires this method
    return ['.js', '.ts', '.jsx', '.tsx', '.html', '.css'];
  }

  private generateCacheKey(files: string[], params: any): string {
    const paramHash = JSON.stringify(params);
    return `component_${paramHash}`.substring(0, 64);
  }

  /**
   * Auto-save the generated component to a specified directory structure ready for browser testing and GitHub
   */
  private async autoSaveComponent(params: any, generatedContent: string): Promise<any> {
    const { name, framework, saveDirectory } = params;
    const componentName = name.charAt(0).toUpperCase() + name.slice(1); // Capitalize first letter
    
    // Use specified directory or default to DEV folder
    const baseDir = saveDirectory || `C:/DEV/components/${componentName.toLowerCase()}-component`;
    
    // Normalize path separators for consistency
    const normalizedBaseDir = baseDir.replace(/\\/g, '/');
    
    // Create directory structure
    await this.ensureDirectory(normalizedBaseDir);
    await this.ensureDirectory(`${normalizedBaseDir}/src`);
    await this.ensureDirectory(`${normalizedBaseDir}/styles`);
    await this.ensureDirectory(`${normalizedBaseDir}/demo`);
    
    const savedFiles = [];
    
    try {
      // Extract different sections from the generated content
      const sections = this.extractSections(generatedContent);
      
      // Save component file
      if (sections.component) {
        const componentExtension = this.getComponentExtension(framework);
        const componentPath = `${normalizedBaseDir}/src/${componentName}.${componentExtension}`;
        await this.writeFile(componentPath, sections.component);
        savedFiles.push(componentPath);
      }
      
      // Save CSS file
      if (sections.css) {
        const cssPath = `${normalizedBaseDir}/styles/${componentName}.css`;
        await this.writeFile(cssPath, sections.css);
        savedFiles.push(cssPath);
      }
      
      // Save demo HTML file
      const demoHtml = this.generateDemoHtml(componentName, sections, params);
      const demoPath = `${normalizedBaseDir}/demo/index.html`;
      await this.writeFile(demoPath, demoHtml);
      savedFiles.push(demoPath);
      
      // Save README.md with documentation
      const readme = this.generateReadme(componentName, sections, params);
      const readmePath = `${normalizedBaseDir}/README.md`;
      await this.writeFile(readmePath, readme);
      savedFiles.push(readmePath);
      
      // Save package.json for npm projects
      if (framework !== 'vanilla') {
        const packageJson = this.generatePackageJson(componentName, framework);
        const packagePath = `${normalizedBaseDir}/package.json`;
        await this.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
        savedFiles.push(packagePath);
      }
      
      return {
        success: true,
        projectPath: normalizedBaseDir,
        savedFiles,
        demoUrl: `file://${normalizedBaseDir.replace(/\//g, '\\\\')}\\\\demo\\\\index.html`,
        message: `Component saved successfully! Open ${normalizedBaseDir}/demo/index.html in browser to test.`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        partialFiles: savedFiles
      };
    }
  }
  
  /**
   * Extract different sections from the generated markdown content
   */
  private extractSections(content: string): any {
    const sections: any = {};
    
    // Extract component code (TypeScript/JavaScript)
    const componentMatch = content.match(/```(?:tsx?|jsx?|js|ts)\n([\s\S]*?)\n```/);
    if (componentMatch) {
      sections.component = componentMatch[1];
    }
    
    // Extract CSS
    const cssMatch = content.match(/```css\n([\s\S]*?)\n```/);
    if (cssMatch) {
      sections.css = cssMatch[1];
    }
    
    // Extract HTML structure
    const htmlMatch = content.match(/```html\n([\s\S]*?)\n```/);
    if (htmlMatch) {
      sections.html = htmlMatch[1];
    }
    
    // Extract usage examples
    const usageMatch = content.match(/## (?:5\\.)?\\s*Usage Examples[\\s\\S]*?```(?:tsx?|jsx?)\n([\\s\\S]*?)\n```/);
    if (usageMatch) {
      sections.usage = usageMatch[1];
    }
    
    return sections;
  }
  
  /**
   * Generate a demo HTML file for immediate browser testing
   */
  private generateDemoHtml(componentName: string, sections: any, params: any): string {
    const { framework, responsive, darkMode } = params;
    
    const title = `${componentName} Demo`;
    const cssLink = framework === 'vanilla' 
      ? `<link rel="stylesheet" href="../styles/${componentName}.css">`
      : `<link rel="stylesheet" href="../styles/${componentName}.css">`;
      
    const darkModeToggle = darkMode ? `
    <div class="demo-controls">
      <button onclick="toggleDarkMode()" class="theme-toggle">🌓 Toggle Dark Mode</button>
    </div>` : '';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    ${cssLink}
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            min-height: 100vh;
            transition: background-color 0.3s ease;
        }
        
        .demo-container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .demo-header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .demo-controls {
            margin-bottom: 20px;
            text-align: center;
        }
        
        .theme-toggle {
            padding: 8px 16px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .theme-toggle:hover {
            background: #0056b3;
        }
        
        .demo-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .demo-section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .demo-section h3 {
            margin-top: 0;
            color: #333;
        }
        
        @media (prefers-color-scheme: dark) {
            body { background: #121212; }
            .demo-section { background: #1e1e1e; color: #fff; }
            .demo-section h3 { color: #fff; }
        }
        
        /* Component specific demo styles */
        .component-showcase {
            padding: 40px 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            margin-bottom: 40px;
        }
        
        ${responsive ? '@media (max-width: 768px) { .demo-grid { grid-template-columns: 1fr; } }' : ''}
    </style>
</head>
<body>
    <div class="demo-container">
        <header class="demo-header">
            <h1>${title}</h1>
            <p>Interactive demo of the ${componentName} component</p>
        </header>
        
        ${darkModeToggle}
        
        <div class="component-showcase">
            <h2>Live Component Demo</h2>
            <div class="demo-grid">
                <div class="demo-section">
                    <h3>Default Configuration</h3>
                    ${this.generateComponentDemo(componentName, sections, params, 'default')}
                </div>
                
                <div class="demo-section">
                    <h3>With Custom Props</h3>
                    ${this.generateComponentDemo(componentName, sections, params, 'custom')}
                </div>
                
                ${responsive ? `
                <div class="demo-section">
                    <h3>Responsive Behavior</h3>
                    <p>Resize your browser window to see responsive behavior in action.</p>
                </div>` : ''}
            </div>
        </div>
        
        <div class="demo-section">
            <h3>Component Features</h3>
            <ul>
                <li>Framework: ${framework}</li>
                <li>Responsive: ${responsive ? 'Yes' : 'No'}</li>
                <li>Accessible: ${params.accessible ? 'Yes' : 'No'}</li>
                <li>Dark Mode: ${darkMode ? 'Yes' : 'No'}</li>
                <li>Animations: ${params.animations ? 'Yes' : 'No'}</li>
            </ul>
        </div>
    </div>
    
    ${framework === 'vanilla' ? this.generateVanillaScript(sections) : ''}
    
    ${darkMode ? `
    <script>
        function toggleDarkMode() {
            document.body.classList.toggle('dark-mode');
        }
    </script>` : ''}
</body>
</html>`;
  }
  
  /**
   * Generate component demo instances for the HTML demo
   */
  private generateComponentDemo(componentName: string, sections: any, params: any, variant: string): string {
    const { framework, type } = params;
    
    if (framework === 'vanilla') {
      // Generate vanilla HTML demo
      return sections.html || `<div class="${componentName.toLowerCase()}-demo">Component demo placeholder</div>`;
    } else {
      // For framework components, show placeholder that would be replaced by actual framework rendering
      return `<div class="component-placeholder">
        <p><strong>${componentName}</strong> component would render here</p>
        <p><em>This is a ${variant} configuration</em></p>
        <p>In a real ${framework} app, this would be:</p>
        <code>&lt;${componentName} ${variant === 'custom' ? 'customProp="value"' : ''}/&gt;</code>
      </div>`;
    }
  }
  
  /**
   * Generate vanilla JavaScript for interactive demo
   */
  private generateVanillaScript(sections: any): string {
    if (!sections.component) return '';
    
    return `
    <script>
        // Component initialization and demo functionality
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize component demos
            console.log('Component demo initialized');
        });
    </script>`;
  }
  
  /**
   * Generate README.md with full documentation
   */
  private generateReadme(componentName: string, sections: any, params: any): string {
    const { framework, type, responsive, accessible, darkMode, animations } = params;
    
    return `# ${componentName} Component

Generated responsive ${type} component for ${framework}

## Features

- ✅ **Responsive Design**: ${responsive ? 'Mobile-first responsive layout' : 'Fixed-width design'}
- ✅ **Accessibility**: ${accessible ? 'WCAG 2.1 AA compliant' : 'Basic accessibility'}
- ✅ **Dark Mode**: ${darkMode ? 'System preference detection' : 'Single theme'}
- ✅ **Animations**: ${animations ? 'Smooth CSS animations' : 'Static component'}
- ✅ **Framework**: ${framework}
- ✅ **Production Ready**: Enterprise-grade code quality

## Quick Start

### Demo
Open \`demo/index.html\` in your browser to see the component in action.

### Installation
${framework !== 'vanilla' ? `
\`\`\`bash
npm install
\`\`\`
` : ''}

### Usage
${framework === 'react' ? `
\`\`\`tsx
import ${componentName} from './src/${componentName}';

function App() {
  return (
    <${componentName} 
      // Add your props here
    />
  );
}
\`\`\`
` : framework === 'vue' ? `
\`\`\`vue
<template>
  <${componentName} />
</template>

<script>
import ${componentName} from './src/${componentName}.vue';

export default {
  components: {
    ${componentName}
  }
}
</script>
\`\`\`
` : `
\`\`\`html
<link rel="stylesheet" href="styles/${componentName}.css">
<!-- Add your HTML structure here -->
\`\`\`
`}

## File Structure

\`\`\`
${componentName.toLowerCase()}-component/
├── src/
│   └── ${componentName}.${this.getComponentExtension(framework)}
├── styles/
│   └── ${componentName}.css
├── demo/
│   └── index.html
${framework !== 'vanilla' ? '├── package.json' : ''}
└── README.md
\`\`\`

## Customization

The component uses CSS custom properties for easy theming:

\`\`\`css
:root {
  --${componentName.toLowerCase()}-primary-color: #007bff;
  --${componentName.toLowerCase()}-background: #ffffff;
  /* Add more custom properties as needed */
}
\`\`\`

## Browser Support

- Chrome 90+
- Firefox 88+  
- Safari 14+
- Edge 90+

## Contributing

This component was generated using an AI assistant. Feel free to modify and enhance as needed for your specific use case.

## License

MIT License - feel free to use in your projects!
`;
  }
  
  /**
   * Generate package.json for framework projects
   */
  private generatePackageJson(componentName: string, framework: string): any {
    const basePackage = {
      name: `${componentName.toLowerCase()}-component`,
      version: "1.0.0",
      description: `Responsive ${componentName} component for ${framework}`,
      main: `src/${componentName}.${this.getComponentExtension(framework)}`,
      scripts: {
        start: "npm run dev",
        dev: "echo 'Add your dev server command here'",
        build: "echo 'Add your build command here'",
        test: "echo 'Add your test command here'"
      },
      keywords: [
        componentName.toLowerCase(),
        framework,
        "component",
        "responsive",
        "accessible"
      ],
      author: "AI Assistant",
      license: "MIT"
    };
    
    // Add framework-specific dependencies
    if (framework === 'react') {
      basePackage['dependencies'] = {
        "react": "^18.0.0",
        "react-dom": "^18.0.0"
      };
      basePackage['devDependencies'] = {
        "@types/react": "^18.0.0",
        "@types/react-dom": "^18.0.0",
        "typescript": "^5.0.0"
      };
    } else if (framework === 'vue') {
      basePackage['dependencies'] = {
        "vue": "^3.0.0"
      };
      basePackage['devDependencies'] = {
        "@vitejs/plugin-vue": "^4.0.0",
        "typescript": "^5.0.0",
        "vite": "^4.0.0"
      };
    }
    
    return basePackage;
  }
  
  /**
   * Build rich context section from provided context object
   */
  private buildContextSection(context: any): string {
    let contextSection = '\n**PROJECT CONTEXT & BRAND REQUIREMENTS:**\n';
    
    // Project information
    if (context.project) {
      contextSection += `- Project: ${context.project}\n`;
    }
    if (context.reference) {
      contextSection += `- Design Reference: ${context.reference}\n`;
    }
    if (context.target_audience) {
      contextSection += `- Target Audience: ${context.target_audience}\n`;
    }
    if (context.brand_positioning) {
      contextSection += `- Brand Position: ${context.brand_positioning}\n`;
    }
    
    // Brand colors
    if (context.brand_colors) {
      contextSection += '\n**BRAND COLORS:**\n';
      Object.entries(context.brand_colors).forEach(([key, value]) => {
        contextSection += `- ${key}: ${value}\n`;
      });
    }
    
    // Typography
    if (context.typography) {
      contextSection += '\n**TYPOGRAPHY:**\n';
      Object.entries(context.typography).forEach(([key, value]) => {
        contextSection += `- ${key}: ${value}\n`;
      });
    }
    
    // Hero content
    if (context.hero_content) {
      contextSection += '\n**HERO SECTION CONTENT:**\n';
      Object.entries(context.hero_content).forEach(([key, value]) => {
        contextSection += `- ${key}: ${value}\n`;
      });
    }
    
    // Navigation
    if (context.navigation) {
      contextSection += '\n**NAVIGATION:**\n';
      contextSection += `- Brand: ${context.navigation.brand}\n`;
      contextSection += `- Greeting: ${context.navigation.greeting}\n`;
      if (context.navigation.links) {
        contextSection += `- Links: ${context.navigation.links.join(', ')}\n`;
      }
    }
    
    // Stats data
    if (context.stats_data && Array.isArray(context.stats_data)) {
      contextSection += '\n**STATISTICS TO SHOWCASE:**\n';
      context.stats_data.forEach((stat: any, index: number) => {
        contextSection += `${index + 1}. ${stat.number} - ${stat.label} (${stat.context})\n`;
      });
    }
    
    // Key features
    if (context.key_features && Array.isArray(context.key_features)) {
      contextSection += '\n**KEY FEATURES TO HIGHLIGHT:**\n';
      context.key_features.forEach((feature: any, index: number) => {
        contextSection += `${index + 1}. **${feature.title}**: ${feature.description}\n`;
      });
    }
    
    // Design reference HTML
    if (context.design_reference_html) {
      contextSection += '\n**DESIGN REFERENCE HTML:**\n';
      contextSection += `Reference structure to inspire layout and styling:\n${context.design_reference_html}\n`;
    }
    
    // Technical requirements
    if (context.technical_requirements) {
      contextSection += '\n**TECHNICAL REQUIREMENTS:**\n';
      Object.entries(context.technical_requirements).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          contextSection += `- ${key}: ${value.join(', ')}\n`;
        } else {
          contextSection += `- ${key}: ${value}\n`;
        }
      });
    }
    
    contextSection += '\n**CONTEXT INTEGRATION REQUIREMENT:**\nYou MUST incorporate ALL the provided context information into the component design. Use the brand colors, typography, hero content, navigation structure, statistics, and key features exactly as specified. This is not optional context - it is required content that must appear in the final component.\n';
    
    return contextSection;
  }

  /**
   * Build context-specific implementation requirements
   */
  private buildContextRequirements(context: any): string {
    let requirements = '\n**CONTEXT-SPECIFIC IMPLEMENTATION REQUIREMENTS:**\n';
    
    if (context.brand_colors) {
      requirements += '- Implement exact brand colors using CSS custom properties\n';
      requirements += '- Ensure proper color contrast ratios for accessibility\n';
    }
    
    if (context.hero_content) {
      requirements += '- Create prominent hero section with provided headline and description\n';
      requirements += '- Style CTAs according to brand guidelines\n';
    }
    
    if (context.stats_data) {
      requirements += '- Design statistics section showcasing provided data points\n';
      requirements += '- Make statistics visually impactful and easy to scan\n';
    }
    
    if (context.key_features) {
      requirements += '- Create feature section highlighting provided benefits\n';
      requirements += '- Use icons or visual elements to enhance feature presentation\n';
    }
    
    if (context.navigation) {
      requirements += '- Implement navigation with provided brand name and links\n';
      requirements += '- Include brand greeting element in appropriate location\n';
    }
    
    if (context.design_reference_html) {
      requirements += '- Use design reference as structural and styling inspiration\n';
      requirements += '- Adapt reference patterns to fit provided content\n';
    }
    
    if (context.technical_requirements) {
      requirements += '- Meet all specified technical requirements\n';
      requirements += '- Optimize for provided breakpoints and performance targets\n';
    }
    
    requirements += '\n**CONTENT PRIORITY:**\nAll provided content (headlines, descriptions, statistics, features) must be prominently featured. This is a real project with specific content requirements, not a generic template.\n';
    
    return requirements;
  }

  /**
   * Get appropriate file extension for the framework
   */
  private getComponentExtension(framework: string): string {
    const extensions: Record<string, string> = {
      'react': 'tsx',
      'vue': 'vue',
      'angular': 'ts',
      'svelte': 'svelte',
      'vanilla': 'js'
    };
    
    return extensions[framework] || 'js';
  }
  
  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDirectory(path: string): Promise<void> {
    try {
      await import('fs/promises').then(fs => fs.mkdir(path, { recursive: true }));
    } catch (error) {
      // Directory might already exist, that's okay
    }
  }
  
  /**
   * Write file with error handling
   */
  private async writeFile(path: string, content: string): Promise<void> {
    await import('fs/promises').then(fs => fs.writeFile(path, content, 'utf-8'));
  }
}

export default ResponsiveComponentGenerator;
