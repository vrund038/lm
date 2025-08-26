// Enhanced tool definitions with context parameters for MCP registration
// This file contains the tool schemas that tell Claude what parameters are available

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const enhancedToolDefinitions: Tool[] = [
  // Enhanced existing tools with context support
  {
    name: 'analyze_code_structure',
    description: 'Analyze the structure of code with optional context for framework-specific insights. Provide context for WordPress, React, n8n, or other project types for better analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code to analyze (optional if filePath is provided)'
        },
        filePath: {
          type: 'string',
          description: 'Path to code file (alternative to code parameter)'
        },
        language: {
          type: 'string',
          description: 'Programming language (javascript, typescript, php, python, etc.)',
          default: 'javascript'
        },
        analysisDepth: {
          type: 'string',
          enum: ['basic', 'detailed', 'comprehensive'],
          description: 'Level of analysis detail',
          default: 'detailed'
        },
        context: {
          type: 'object',
          description: 'Optional context for domain-specific analysis',
          properties: {
            projectType: {
              type: 'string',
              enum: ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'n8n-node', 'node-api', 'html-component', 'generic'],
              description: 'Type of project for specialized analysis'
            },
            framework: {
              type: 'string',
              description: 'Framework being used (e.g., WordPress, React, Express)'
            },
            frameworkVersion: {
              type: 'string',
              description: 'Framework version (e.g., 6.0, 18.2.0)'
            },
            standards: {
              type: 'array',
              items: { type: 'string' },
              description: 'Coding standards to check against (e.g., WordPress Coding Standards, PSR-12)'
            },
            environment: {
              type: 'string',
              enum: ['browser', 'node', 'wordpress', 'hybrid'],
              description: 'Runtime environment'
            }
          }
        }
      },
      required: []
    }
  },

  {
    name: 'generate_unit_tests',
    description: 'Generate unit tests for code with framework-specific patterns. Provide context for React Testing Library, PHPUnit, Jest, or other frameworks.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code to generate tests for (optional if filePath is provided)'
        },
        filePath: {
          type: 'string',
          description: 'Path to code file (alternative to code parameter)'
        },
        language: {
          type: 'string',
          description: 'Programming language',
          default: 'javascript'
        },
        testFramework: {
          type: 'string',
          description: 'Testing framework to use (jest, mocha, pytest, phpunit, etc.)',
          default: 'jest'
        },
        coverageTarget: {
          type: 'string',
          enum: ['basic', 'comprehensive', 'edge-cases'],
          default: 'comprehensive'
        },
        context: {
          type: 'object',
          description: 'Optional context for framework-specific testing patterns',
          properties: {
            projectType: {
              type: 'string',
              enum: ['wordpress-plugin', 'react-app', 'node-api', 'generic'],
              description: 'Project type for appropriate test patterns'
            },
            testStyle: {
              type: 'string',
              enum: ['bdd', 'tdd', 'aaa', 'given-when-then'],
              description: 'Testing style preference'
            },
            mockStrategy: {
              type: 'string',
              enum: ['minimal', 'comprehensive', 'integration-preferred'],
              description: 'Mocking approach',
              default: 'minimal'
            },
            includeEdgeCases: {
              type: 'boolean',
              description: 'Include edge case tests',
              default: true
            },
            includePerformanceTests: {
              type: 'boolean',
              description: 'Include performance tests',
              default: false
            }
          }
        }
      },
      required: []
    }
  },

  {
    name: 'generate_documentation',
    description: 'Generate documentation for code with audience-specific formatting',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code to document (optional if filePath is provided)'
        },
        filePath: {
          type: 'string',
          description: 'Path to code file (alternative to code parameter)'
        },
        language: {
          type: 'string',
          description: 'Programming language',
          default: 'javascript'
        },
        docStyle: {
          type: 'string',
          enum: ['jsdoc', 'markdown', 'docstring', 'javadoc', 'phpdoc'],
          default: 'jsdoc'
        },
        includeExamples: {
          type: 'boolean',
          description: 'Include usage examples in documentation',
          default: true
        },
        context: {
          type: 'object',
          description: 'Optional context for project-specific documentation',
          properties: {
            projectType: {
              type: 'string',
              enum: ['wordpress-plugin', 'react-app', 'node-api', 'generic'],
              description: 'Project type for appropriate documentation'
            },
            audience: {
              type: 'string',
              enum: ['developer', 'end-user', 'technical', 'non-technical'],
              description: 'Target audience for documentation',
              default: 'developer'
            },
            detailLevel: {
              type: 'string',
              enum: ['minimal', 'standard', 'comprehensive'],
              description: 'Level of detail in documentation',
              default: 'standard'
            },
            includeApiReference: {
              type: 'boolean',
              description: 'Include API reference section',
              default: true
            },
            includeTroubleshooting: {
              type: 'boolean',
              description: 'Include troubleshooting section',
              default: true
            }
          }
        }
      },
      required: []
    }
  },

  {
    name: 'suggest_refactoring',
    description: 'Analyze code and suggest refactoring improvements with project-specific patterns',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The code to analyze for refactoring (optional if filePath is provided)'
        },
        filePath: {
          type: 'string',
          description: 'Path to code file (alternative to code parameter)'
        },
        language: {
          type: 'string',
          description: 'Programming language',
          default: 'javascript'
        },
        focusAreas: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['readability', 'performance', 'maintainability', 'testability', 'security', 'type-safety', 'error-handling', 'logging', 'documentation']
          },
          description: 'Areas to focus on for refactoring',
          default: ['readability', 'maintainability']
        },
        context: {
          type: 'object',
          description: 'Optional context for project-specific refactoring',
          properties: {
            projectType: {
              type: 'string',
              enum: ['wordpress-plugin', 'react-app', 'node-api', 'generic'],
              description: 'Project type for appropriate patterns'
            },
            preserveApi: {
              type: 'boolean',
              description: 'Maintain backward compatibility',
              default: true
            },
            modernizationLevel: {
              type: 'string',
              enum: ['conservative', 'moderate', 'aggressive'],
              description: 'How aggressively to modernize code',
              default: 'moderate'
            },
            targetComplexity: {
              type: 'number',
              description: 'Target cyclomatic complexity',
              default: 10
            },
            standards: {
              type: 'array',
              items: { type: 'string' },
              description: 'Coding standards to follow'
            }
          }
        }
      },
      required: []
    }
  },

  // New tools with full context support
  {
    name: 'generate_wordpress_plugin',
    description: 'Generate a complete WordPress plugin structure with all necessary files and best practices',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Plugin name'
        },
        description: {
          type: 'string',
          description: 'Plugin description'
        },
        features: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of features to include'
        },
        prefix: {
          type: 'string',
          description: 'Plugin prefix for functions and classes (e.g., "wp_my_plugin")'
        },
        wpVersion: {
          type: 'string',
          description: 'Minimum WordPress version',
          default: '6.0'
        },
        phpVersion: {
          type: 'string',
          description: 'Minimum PHP version',
          default: '7.4'
        },
        includeAdmin: {
          type: 'boolean',
          description: 'Include admin interface',
          default: true
        },
        includeDatabase: {
          type: 'boolean',
          description: 'Include database tables',
          default: false
        },
        includeAjax: {
          type: 'boolean',
          description: 'Include AJAX handlers',
          default: false
        },
        includeRest: {
          type: 'boolean',
          description: 'Include REST API endpoints',
          default: false
        },
        includeGutenberg: {
          type: 'boolean',
          description: 'Include Gutenberg blocks',
          default: false
        },
        textDomain: {
          type: 'string',
          description: 'Text domain for internationalization'
        }
      },
      required: ['name', 'description', 'features', 'prefix']
    }
  },

  {
    name: 'analyze_n8n_workflow',
    description: 'Analyze and optimize n8n workflow JSON for efficiency, error handling, and best practices',
    inputSchema: {
      type: 'object',
      properties: {
        workflow: {
          type: 'object',
          description: 'n8n workflow JSON object'
        },
        optimizationFocus: {
          type: 'string',
          enum: ['performance', 'error-handling', 'maintainability', 'all'],
          description: 'Primary optimization focus',
          default: 'all'
        },
        includeCredentialCheck: {
          type: 'boolean',
          description: 'Check for exposed credentials',
          default: true
        },
        suggestAlternativeNodes: {
          type: 'boolean',
          description: 'Suggest alternative node configurations',
          default: true
        }
      },
      required: ['workflow']
    }
  },

  {
    name: 'generate_responsive_component',
    description: 'Generate a responsive, accessible HTML/CSS component with modern best practices',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Component name'
        },
        type: {
          type: 'string',
          enum: ['button', 'form', 'card', 'modal', 'navigation', 'layout', 'custom'],
          description: 'Component type'
        },
        framework: {
          type: 'string',
          enum: ['vanilla', 'react', 'vue', 'angular', 'svelte'],
          description: 'Framework to use',
          default: 'vanilla'
        },
        designSystem: {
          type: 'string',
          description: 'Design system to follow',
          default: 'custom'
        },
        responsive: {
          type: 'boolean',
          description: 'Make component responsive',
          default: true
        },
        accessible: {
          type: 'boolean',
          description: 'Include accessibility features',
          default: true
        },
        animations: {
          type: 'boolean',
          description: 'Include animations',
          default: false
        },
        darkMode: {
          type: 'boolean',
          description: 'Include dark mode support',
          default: false
        }
      },
      required: ['name', 'type']
    }
  },

  {
    name: 'convert_to_typescript',
    description: 'Convert JavaScript code to TypeScript with comprehensive type annotations',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript code to convert'
        },
        filePath: {
          type: 'string',
          description: 'Path to JavaScript file'
        },
        strict: {
          type: 'boolean',
          description: 'Use strict TypeScript mode',
          default: true
        },
        target: {
          type: 'string',
          description: 'TypeScript target',
          default: 'ES2020'
        },
        module: {
          type: 'string',
          description: 'Module system',
          default: 'ESNext'
        },
        preserveComments: {
          type: 'boolean',
          description: 'Preserve original comments',
          default: true
        },
        addTypeGuards: {
          type: 'boolean',
          description: 'Add type guard functions',
          default: true
        },
        useInterfaces: {
          type: 'boolean',
          description: 'Prefer interfaces over type aliases',
          default: true
        },
        useEnums: {
          type: 'boolean',
          description: 'Use enums for fixed values',
          default: true
        }
      },
      required: []
    }
  },

  {
    name: 'security_audit',
    description: 'Perform a security audit on code with project-specific vulnerability checks',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Code to audit'
        },
        filePath: {
          type: 'string',
          description: 'Path to file to audit'
        },
        projectType: {
          type: 'string',
          enum: ['wordpress-plugin', 'react-app', 'node-api', 'browser-extension', 'cli-tool', 'generic'],
          description: 'Project type for specific security checks'
        },
        auditDepth: {
          type: 'string',
          enum: ['basic', 'standard', 'comprehensive'],
          description: 'Depth of security audit',
          default: 'standard'
        },
        includeOwasp: {
          type: 'boolean',
          description: 'Include OWASP Top 10 checks',
          default: true
        },
        includeDependencies: {
          type: 'boolean',
          description: 'Audit dependencies for vulnerabilities',
          default: false
        },
        customChecks: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional custom security checks'
        }
      },
      required: ['projectType']
    }
  },

  {
    name: 'health_check',
    description: 'Check if LM Studio is running and responding. Use this to verify the connection and optionally get detailed information about the loaded model.',
    inputSchema: {
      type: 'object',
      properties: {
        detailed: {
          type: 'boolean',
          description: 'Include detailed information about the loaded model and server status',
          default: false
        }
      },
      required: []
    }
  }
];

// Export a function to get tool by name
export function getToolDefinition(toolName: string): Tool | undefined {
  return enhancedToolDefinitions.find(tool => tool.name === toolName);
}

// Export tool names for validation
export const enhancedToolNames = enhancedToolDefinitions.map(tool => tool.name);
