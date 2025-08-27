// Multi-file analysis tool definitions
// These are the new tools that provide multi-file awareness

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const multiFileToolDefinitions: Tool[] = [
  {
    name: 'compare_integration',
    description: 'Compare integration between multiple files to identify mismatches, missing imports, and compatibility issues. Returns actionable fixes with line numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of absolute file paths to analyze'
        },
        analysisType: {
          type: 'string',
          enum: ['integration', 'compatibility', 'dependencies'],
          default: 'integration',
          description: 'Type of integration analysis'
        },
        focus: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific areas to focus on: method_compatibility, namespace_dependencies, data_flow, missing_connections',
          default: []
        }
      },
      required: ['files']
    }
  },
  {
    name: 'trace_execution_path',
    description: 'Trace execution path through multiple files starting from an entry point. Shows complete call flow.',
    inputSchema: {
      type: 'object',
      properties: {
        entryPoint: {
          type: 'string',
          description: 'Entry point like ClassName::methodName or functionName'
        },
        traceDepth: {
          type: 'number',
          default: 5,
          description: 'Maximum depth to trace (1-10)'
        },
        showParameters: {
          type: 'boolean',
          default: false,
          description: 'Include parameter information in trace'
        }
      },
      required: ['entryPoint']
    }
  },
  {
    name: 'find_pattern_usage',
    description: 'Find usage of specific patterns across multiple files in a project. Supports regex patterns.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to project root directory'
        },
        patterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns to search for (regex supported)'
        },
        includeContext: {
          type: 'number',
          default: 3,
          description: 'Number of context lines to include (0-10)'
        }
      },
      required: ['projectPath', 'patterns']
    }
  },
  {
    name: 'diff_method_signatures',
    description: 'Compare method signatures between caller and callee to identify parameter mismatches.',
    inputSchema: {
      type: 'object',
      properties: {
        callingFile: {
          type: 'string',
          description: 'Absolute path to file containing the method call'
        },
        calledClass: {
          type: 'string',
          description: 'Class name containing the called method'
        },
        methodName: {
          type: 'string',
          description: 'Name of the method to check'
        }
      },
      required: ['callingFile', 'calledClass', 'methodName']
    }
  },
  {
    name: 'analyze_project_structure',
    description: 'Analyze complete project structure and architecture. Returns comprehensive architecture analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to project root'
        },
        focusAreas: {
          type: 'array',
          items: { type: 'string' },
          description: 'Areas to focus on: architecture, dependencies, complexity, patterns',
          default: []
        },
        maxDepth: {
          type: 'number',
          default: 3,
          description: 'Maximum directory depth to analyze'
        }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'clear_analysis_cache',
    description: 'Clear the multi-file analysis cache for a specific file or all files.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Optional: specific file to clear from cache. If not provided, clears all cache.'
        }
      }
    }
  },
  {
    name: 'get_cache_statistics',
    description: 'Get statistics about the current analysis cache.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];
