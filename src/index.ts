import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { LMStudioClient } from '@lmstudio/sdk';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { config } from './config.js';
import { OffloadTask, TaskType, FileAnalysisParams, CsvAnalysisParams } from './types.js';

class LocalLLMServer {
  private server: Server;
  private client: LMStudioClient;
  
  constructor() {
    this.server = new Server({
      name: 'local-llm-assistant',
      version: '2.0.0',
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    this.client = new LMStudioClient();
    
    this.setupHandlers();
  }

  private parseModelResponse(response: string): any {
    // Strip thinking tags if present (for models like Qwen3)
    const cleanResponse = response.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    
    // Try to parse as JSON if requested
    try {
      return JSON.parse(cleanResponse);
    } catch {
      // If not JSON, return as structured object
      return { content: cleanResponse };
    }
  }

  private async callLMStudio(
    prompt: string, 
    systemPrompt?: string,
    filePath?: string
  ): Promise<string> {
    try {
      // Get the first loaded model if 'auto' is specified
      let modelIdentifier = config.modelName;
      if (modelIdentifier === 'auto') {
        const loadedModels = await this.client.llm.listLoaded();
        if (loadedModels.length === 0) {
          throw new Error('No models loaded in LM Studio. Please load a model first.');
        }
        modelIdentifier = loadedModels[0].identifier;
      }
      
      const model = await this.client.llm.model(modelIdentifier);
      
      const messages: any[] = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ];
      
      // Add file attachment if provided
      if (filePath) {
        // Validate file extension
        const ext = extname(filePath).toLowerCase();
        if (!config.supportedFileTypes.includes(ext)) {
          throw new Error(`Unsupported file type: ${ext}. Supported types: ${config.supportedFileTypes.join(', ')}`);
        }
        
        // Check file size
        const stats = await import('fs').then(fs => fs.promises.stat(filePath));
        if (stats.size > config.maxFileSize) {
          throw new Error(`File too large: ${stats.size} bytes. Maximum size: ${config.maxFileSize} bytes`);
        }
        
        // Add file content to the message
        const fileContent = await this.readFileContent(filePath);
        messages.push({
          role: 'user',
          content: `File content from ${filePath}:\n\n${fileContent}`
        });
      }
      
      const response = await model.respond(messages, {
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });
      
      return response.content;
    } catch (error: any) {
      if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
        throw new Error('LM Studio is not running. Please start LM Studio and load a model.');
      }
      throw error;
    }
  }

  private async streamResponse(
    prompt: string,
    filePath?: string,
    systemPrompt?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    try {
      // Get the first loaded model if 'auto' is specified
      let modelIdentifier = config.modelName;
      if (modelIdentifier === 'auto') {
        const loadedModels = await this.client.llm.listLoaded();
        if (loadedModels.length === 0) {
          throw new Error('No models loaded in LM Studio. Please load a model first.');
        }
        modelIdentifier = loadedModels[0].identifier;
      }
      
      const model = await this.client.llm.model(modelIdentifier);
      
      const messages: any[] = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ];
      
      if (filePath) {
        const fileContent = await this.readFileContent(filePath);
        messages.push({
          role: 'user',
          content: `File content from ${filePath}:\n\n${fileContent}`
        });
      }
      
      // Use streaming API  
      const prediction = model.respond(messages, {
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });
      
      let fullResponse = '';
      for await (const { content } of prediction) {
        fullResponse += content;
        onChunk?.(content);
      }
      
      return fullResponse;
    } catch (error: any) {
      if (error.message?.includes('ECONNREFUSED') || error.code === 'ECONNREFUSED') {
        throw new Error('LM Studio is not running. Please start LM Studio and load a model.');
      }
      throw error;
    }
  }

  private async readFileContent(filePath: string): Promise<string> {
    try {
      return await readFile(filePath, 'utf-8');
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
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
        },        {
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
        },
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
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case 'health_check':
          return await this.checkStatus(args?.detailed as boolean);

        case 'analyze_code_structure':
          return await this.handleCodeAnalysis(args, TaskType.CODE_STRUCTURE);

        case 'generate_unit_tests':
          return await this.handleCodeAnalysis(args, TaskType.GENERATE_TESTS);

        case 'generate_documentation':
          return await this.handleCodeAnalysis(args, TaskType.DOCUMENT_FUNCTION);

        case 'suggest_refactoring':
          return await this.handleCodeAnalysis(args, TaskType.SUGGEST_REFACTOR);

        case 'detect_patterns':
          return await this.handleCodeAnalysis(args, TaskType.CHECK_PATTERNS);

        case 'validate_syntax':
          return await this.handleCodeAnalysis(args, TaskType.FIND_BUGS);

        case 'suggest_variable_names':
          return await this.handleCodeAnalysis(args, TaskType.GENERATE_TYPES);

        case 'analyze_file':
          return await this.handleFileAnalysis(args as unknown as FileAnalysisParams);

        case 'analyze_csv_data':
          return await this.handleCsvAnalysis(args as unknown as CsvAnalysisParams);

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async checkStatus(detailed: boolean = false) {
    try {
      const loadedModels = await this.client.llm.listLoaded();
      const status = loadedModels.length > 0 ? 'ready' : 'no_model_loaded';
      
      const result: any = {
        status,
        models: loadedModels.map((m: any) => m.identifier),
        lmStudioUrl: config.lmStudioUrl
      };

      if (detailed && loadedModels.length > 0) {
        // Get more info about the loaded model
        const model = loadedModels[0];
        result.modelDetails = {
          identifier: model.identifier,
          path: model.path,
          // Add any other available model properties
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'offline',
            error: 'LM Studio is not running',
            lmStudioUrl: config.lmStudioUrl
          }, null, 2)
        }]
      };
    }
  }

  private async handleCodeAnalysis(args: any, taskType: TaskType) {
    let content = args.code;
    
    // If filePath is provided, read from file
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
          text: 'Error: No code content or file path provided'
        }]
      };
    }

    const taskPrompts = config.taskPrompts[taskType];
    if (!taskPrompts) {
      throw new Error(`Unknown task type: ${taskType}`);
    }

    try {
      const additionalParams = {
        analysisDepth: args.analysisDepth,
        testFramework: args.testFramework,
        coverageTarget: args.coverageTarget,
        docStyle: args.docStyle,
        includeExamples: args.includeExamples,
        focusAreas: args.focusAreas,
        patternTypes: args.patternTypes,
        strictMode: args.strictMode,
        namingConvention: args.namingConvention
      };
      
      const prompt = taskPrompts.prompt(content, args.language, additionalParams);
      const result = await this.callLMStudio(prompt, taskPrompts.systemPrompt, args.filePath);
      
      return {
        content: [{
          type: 'text',
          text: result
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error.message}\n\nMake sure LM Studio is running with a model loaded.`
        }]
      };
    }
  }

  private async handleFileAnalysis(args: FileAnalysisParams) {
    const taskPrompts = config.taskPrompts[TaskType.ANALYZE_FILE];
    
    try {
      // For file analysis, we'll pass the file path directly to LM Studio
      const prompt = taskPrompts.prompt('', undefined, {
        instructions: args.instructions,
        extractFormat: args.extractFormat
      });
      
      const result = await this.callLMStudio(prompt, taskPrompts.systemPrompt, args.filePath);
      
      // If JSON format was requested, try to parse and return structured data
      if (args.extractFormat === 'json') {
        const parsed = this.parseModelResponse(result);
        return {
          content: [{
            type: 'text',
            text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
          }]
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: result
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error analyzing file: ${error.message}`
        }]
      };
    }
  }

  private async handleCsvAnalysis(args: CsvAnalysisParams) {
    const taskPrompts = config.taskPrompts[TaskType.ANALYZE_CSV_DATA];
    
    try {
      // Pass CSV file directly to LM Studio with filtering instructions
      const prompt = taskPrompts.prompt('', undefined, {
        filterCriteria: args.filterCriteria,
        columns: args.columns,
        returnFormat: args.returnFormat
      });
      
      const result = await this.callLMStudio(prompt, taskPrompts.systemPrompt, args.filePath);
      
      // If JSON format was requested, try to parse and return structured data
      if (args.returnFormat === 'json') {
        const parsed = this.parseModelResponse(result);
        return {
          content: [{
            type: 'text',
            text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
          }]
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: result
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `Error analyzing CSV: ${error.message}`
        }]
      };
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Local LLM MCP Server v2.0.0 started with LM Studio SDK');
  }
}

// Start the server
const server = new LocalLLMServer();
server.start().catch(console.error);
