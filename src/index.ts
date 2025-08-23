#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { LMStudioClient } from '@lmstudio/sdk';
import { readFile } from 'fs/promises';
import { extname, resolve, normalize, isAbsolute } from 'path';
import { config } from './config.js';
import { securityConfig } from './security-config.js';
import {
  TaskType,
  FileAnalysisParams,
  CsvAnalysisParams
} from './types.js';

// Security: Get allowed directories from config
const ALLOWED_DIRECTORIES = securityConfig.getAllowedDirectories();

export class LocalLLMServer {
  private server: Server;
  private lmStudioClient: LMStudioClient;

  constructor() {
    this.server = new Server(
      {
        name: 'local-llm-server',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.lmStudioClient = new LMStudioClient();
    this.setupHandlers();
  }

  // Fixed regex pattern for thinking tags
  private parseModelResponse(response: string): any {
    // Fixed regex - properly matches <think> tags
    const cleanResponse = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
    try {
      return JSON.parse(cleanResponse);
    } catch {
      return { content: cleanResponse };
    }
  }

  // Security: Validate file paths
  private isPathSafe(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') return false;
    
    // Must be absolute path
    if (!isAbsolute(filePath)) return false;
    
    // Normalize to prevent traversal
    const normalizedPath = resolve(normalize(filePath));
    
    // Check if within allowed directories
    return ALLOWED_DIRECTORIES.some(allowedDir => 
      normalizedPath.startsWith(allowedDir)
    );
  }

  private async callLMStudio(
    prompt: string,
    systemPrompt?: string,
    filePath?: string
  ): Promise<string> {
    const model = config.modelName === 'auto'
      ? (await this.lmStudioClient.llm.listLoaded())[0]?.identifier
      : config.modelName;

    if (!model) {
      throw new Error('No model loaded in LM Studio. Please load a model first.');
    }

    let finalPrompt = prompt;
    
    if (filePath) {
      // Security: Validate path before processing
      if (!this.isPathSafe(filePath)) {
        throw new Error('Invalid file path: Path must be absolute and within allowed directories');
      }

      const ext = extname(filePath).toLowerCase();
      
      if (!config.supportedFileTypes.includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}. Supported types: ${config.supportedFileTypes.join(', ')}`);
      }
      
      const stats = await import('fs').then(fs => fs.promises.stat(filePath));
      if (stats.size > config.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${config.maxFileSize} bytes)`);
      }
      
      // Read file content and include in prompt
      const fileContent = await this.readFileContent(filePath);
      finalPrompt = `File content from ${filePath}:\n\n${fileContent}\n\n${prompt}`;
    }

    const messages = systemPrompt 
      ? [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: finalPrompt }
        ]
      : [{ role: 'user' as const, content: finalPrompt }];

    const llm = await this.lmStudioClient.llm.model(model);
    const response = await llm.respond(messages, {
      temperature: config.temperature,
      maxTokens: config.maxTokens
    });

    return response.content;
  }

  private async readFileContent(filePath: string): Promise<string> {
    // Security: Validate path
    if (!this.isPathSafe(filePath)) {
      throw new Error('Invalid file path: Path must be absolute and within allowed directories');
    }
    
    try {
      return await readFile(filePath, 'utf-8');
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'health_check',
            description: 'Check if LM Studio is running and responding',
            inputSchema: {
              type: 'object',
              properties: {
                detailed: {
                  type: 'boolean',
                  description: 'Include detailed status information',
                  default: false
                }
              }
            }
          },
          {
            name: 'analyze_code_structure',
            description: 'Analyze the structure of code and provide insights about its organization',
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
                  description: 'Programming language (javascript, python, java, etc.)',
                  default: 'javascript'
                },
                analysisDepth: {
                  type: 'string',
                  enum: ['basic', 'detailed', 'comprehensive'],
                  description: 'Level of analysis detail',
                  default: 'detailed'
                }
              },
              required: []
            }
          },
          {
            name: 'generate_unit_tests',
            description: 'Generate unit tests for the provided code',
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
                  description: 'Testing framework to use (jest, mocha, pytest, junit, etc.)',
                  default: 'jest'
                },
                coverageTarget: {
                  type: 'string',
                  enum: ['basic', 'comprehensive', 'edge-cases'],
                  default: 'comprehensive'
                }
              },
              required: []
            }
          },
          {
            name: 'generate_documentation',
            description: 'Generate documentation for code',
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
                  enum: ['jsdoc', 'markdown', 'docstring', 'javadoc'],
                  default: 'jsdoc'
                },
                includeExamples: {
                  type: 'boolean',
                  description: 'Include usage examples in documentation',
                  default: true
                }
              },
              required: []
            }
          },
          {
            name: 'suggest_refactoring',
            description: 'Analyze code and suggest refactoring improvements',
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
                    enum: ['readability', 'performance', 'maintainability', 'testability', 'security']
                  },
                  default: ['readability', 'maintainability']
                }
              },
              required: []
            }
          },
          {
            name: 'detect_patterns',
            description: 'Detect design patterns and anti-patterns in code',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'The code to analyze for patterns (optional if filePath is provided)'
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
                patternTypes: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['design-patterns', 'anti-patterns', 'code-smells', 'best-practices']
                  },
                  default: ['design-patterns', 'anti-patterns']
                }
              },
              required: []
            }
          },
          {
            name: 'validate_syntax',
            description: 'Validate code syntax and provide error details',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'The code to validate (optional if filePath is provided)'
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
                strictMode: {
                  type: 'boolean',
                  description: 'Use strict validation rules',
                  default: true
                }
              },
              required: []
            }
          },
          {
            name: 'suggest_variable_names',
            description: 'Suggest better variable and function names',
            inputSchema: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  description: 'The code with variables to rename (optional if filePath is provided)'
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
                namingConvention: {
                  type: 'string',
                  enum: ['camelCase', 'snake_case', 'PascalCase', 'kebab-case'],
                  default: 'camelCase'
                }
              },
              required: []
            }
          },
          {
            name: 'analyze_file',
            description: 'Analyze a file using local LLM with optional instructions',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Absolute path to the file to analyze'
                },
                instructions: {
                  type: 'string',
                  description: 'Specific analysis instructions'
                },
                extractFormat: {
                  type: 'string',
                  enum: ['json', 'list', 'summary'],
                  description: 'Desired output format',
                  default: 'summary'
                }
              },
              required: ['filePath']
            }
          },
          {
            name: 'analyze_csv_data',
            description: 'Analyze CSV data with specific filtering criteria',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: {
                  type: 'string',
                  description: 'Path to CSV file'
                },
                filterCriteria: {
                  type: 'string',
                  description: 'What to filter for (e.g., "automotive and motorsport companies")'
                },
                columns: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific columns to analyze'
                },
                returnFormat: {
                  type: 'string',
                  enum: ['json', 'csv', 'list'],
                  default: 'json'
                }
              },
              required: ['filePath', 'filterCriteria']
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'health_check':
            return await this.checkStatus(Boolean(args && typeof args === 'object' && 'detailed' in args && args.detailed));
          
          case 'analyze_code_structure':
          case 'generate_unit_tests':
          case 'generate_documentation':
          case 'suggest_refactoring':
          case 'detect_patterns':
          case 'validate_syntax':
          case 'suggest_variable_names':
            return await this.handleCodeAnalysis(args, name as TaskType);
          
          case 'analyze_file':
            return await this.handleFileAnalysis(args as unknown as FileAnalysisParams);
          
          case 'analyze_csv_data':
            return await this.handleCsvAnalysis(args as unknown as CsvAnalysisParams);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error: any) {
        if (error instanceof McpError) throw error;
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  private async checkStatus(detailed: boolean = false): Promise<any> {
    try {
      const models = await this.lmStudioClient.llm.listLoaded();
      
      if (models.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'LM Studio is running but no models are loaded. Please load a model to use this server.'
          }]
        };
      }

      // Security: Don't expose sensitive paths in non-detailed mode
      const modelInfo = detailed 
        ? models.map(m => ({
            identifier: m.identifier,
            path: m.path // Only show in detailed mode
          }))
        : models.map(m => ({
            identifier: m.identifier
          }));

      return {
        content: [{
          type: 'text',
          text: detailed
            ? JSON.stringify({
                status: 'ready',
                models: modelInfo,
                lmStudioUrl: config.lmStudioUrl,
                modelDetails: modelInfo[0]
              }, null, 2)
            : `LM Studio is ready with ${models.length} model(s) loaded.`
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `LM Studio connection failed: ${error.message}. Please ensure LM Studio is running with the local server started.`
        }]
      };
    }
  }

  // Other methods remain the same but with path validation added
  private async handleCodeAnalysis(args: any, taskType: TaskType): Promise<any> {
    let content = args.code;
    
    if (!content && args.filePath) {
      try {
        content = await this.readFileContent(args.filePath);
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error reading file: ${error.message}`
          }]
        };
      }
    }

    if (!content) {
      return {
        content: [{
          type: 'text',
          text: 'Error: No code content provided. Please provide either "code" or "filePath" parameter.'
        }]
      };
    }

    const language = args.language || 'unknown';
    const taskPrompt = config.taskPrompts[taskType];
    
    if (!taskPrompt) {
      throw new Error(`Unknown task type: ${taskType}`);
    }

    try {
      const prompt = taskPrompt.prompt(content, language, args);
      const response = await this.callLMStudio(prompt, taskPrompt.systemPrompt);
      const parsed = this.parseModelResponse(response);

      return {
        content: [{
          type: 'text',
          text: typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }]
      };
    }
  }

  private async handleFileAnalysis(args: FileAnalysisParams): Promise<any> {
    const { filePath, instructions, extractFormat } = args;
    
    const taskPrompt = config.taskPrompts[TaskType.ANALYZE_FILE];
    const prompt = taskPrompt.prompt('', undefined, { instructions, extractFormat });
    
    try {
      const response = await this.callLMStudio(prompt, taskPrompt.systemPrompt, filePath);
      const parsed = this.parseModelResponse(response);

      return {
        content: [{
          type: 'text',
          text: typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }]
      };
    }
  }

  private async handleCsvAnalysis(args: CsvAnalysisParams): Promise<any> {
    const { filePath, filterCriteria, columns, returnFormat } = args;
    
    const taskPrompt = config.taskPrompts[TaskType.ANALYZE_CSV_DATA];
    const prompt = taskPrompt.prompt('', undefined, { filterCriteria, columns, returnFormat });
    
    try {
      const response = await this.callLMStudio(prompt, taskPrompt.systemPrompt, filePath);
      const parsed = this.parseModelResponse(response);

      return {
        content: [{
          type: 'text',
          text: typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : parsed
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}`
        }]
      };
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Local LLM MCP server started');
  }
}

// Export for NPM usage
export default LocalLLMServer;

// Only run if called directly
import { fileURLToPath } from 'url';

const isMainModule = () => {
  if (!process.argv[1]) return false;
  const modulePath = fileURLToPath(import.meta.url);
  const mainPath = normalize(process.argv[1]);
  return modulePath === mainPath;
};

if (isMainModule()) {
  const server = new LocalLLMServer();
  server.start().catch(console.error);
}