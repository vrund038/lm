// Complete index.ts update for enhanced prompts
// This preserves ALL existing functionality while adding context support

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { LMStudioClient } from '@lmstudio/sdk';
import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';
import { TaskType } from './types.js';
import { securityConfig } from './security-config.js';

// ADD THESE IMPORTS
import { enhancedToolDefinitions } from './enhanced-tool-definitions.js';
import { 
  createCodeStructurePrompt,
  createUnitTestPrompt,
  createDocumentationPrompt,
  createRefactoringPrompt,
  createWordPressPluginPrompt,
  createN8nWorkflowAnalysisPrompt,
  createResponsiveComponentPrompt,
  createTypeScriptConversionPrompt,
  createSecurityAuditPrompt
} from './enhanced-prompts.js';

// Security: Get allowed directories from config
const ALLOWED_DIRECTORIES = securityConfig.getAllowedDirectories();

// Security helper functions
function isPathSafe(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false;
  
  // Must be absolute path
  if (!path.isAbsolute(filePath)) return false;
  
  // Normalize to prevent traversal
  const normalizedPath = path.resolve(path.normalize(filePath));
  
  // Check if within allowed directories
  return ALLOWED_DIRECTORIES.some(allowedDir => 
    normalizedPath.startsWith(allowedDir)
  );
}

function validatePath(filePath: string): void {
  if (!isPathSafe(filePath)) {
    throw new Error('Invalid file path: Path must be absolute and within allowed directories');
  }
}

class LocalLLMServer {
  private server: Server;
  private lmStudioClient: LMStudioClient;
  
  constructor() {
    this.server = new Server(
      {
        name: 'local-llm-server',
        version: '3.0.0', // Bump version for enhanced features
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.lmStudioClient = new LMStudioClient({
      baseUrl: config.lmStudioUrl,
    });

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // Tool listing handler - returns all enhanced tool definitions
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: enhancedToolDefinitions,
    }));

    // Resources handler - we don't have resources, return empty array
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));

    // Prompts handler - we don't have prompts, return empty array
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [],
    }));

    // UPDATE the tool request handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      // Type assertion for arguments
      const typedArgs = args as any;
      
      try {
        switch (name) {
          // ENHANCED TOOLS WITH CONTEXT SUPPORT
          case 'analyze_code_structure': {
            const { code, filePath, language, context } = typedArgs;
            const content = code || await this.readFileContent(filePath);
            
            let prompt: string;
            if (context) {
              // Use enhanced context-aware prompt
              prompt = createCodeStructurePrompt(content, {
                ...context,
                language: language || context.language
              });
            } else {
              // Fallback to existing prompt for backward compatibility
              prompt = config.taskPrompts[TaskType.CODE_STRUCTURE].prompt(
                content,
                language
              );
            }
            
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'generate_unit_tests': {
            const { code, filePath, language, testFramework, coverageTarget, context } = typedArgs;
            const content = code || await this.readFileContent(filePath);
            
            let prompt: string;
            if (context) {
              // Enhanced version with full context
              prompt = createUnitTestPrompt(content, {
                projectType: context.projectType || 'generic',
                testFramework: testFramework || 'jest',
                coverageTarget: coverageTarget === 'basic' ? 60 : 
                               coverageTarget === 'comprehensive' ? 80 : 90,
                ...context
              });
            } else {
              // Existing prompt
              prompt = config.taskPrompts[TaskType.GENERATE_TESTS].prompt(
                content,
                language,
                { framework: testFramework }
              );
            }
            
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'generate_documentation': {
            const { code, filePath, language, docStyle, includeExamples, context } = typedArgs;
            const content = code || await this.readFileContent(filePath);
            
            let prompt: string;
            if (context) {
              // Enhanced documentation with context
              prompt = createDocumentationPrompt(content, {
                projectType: context.projectType || 'generic',
                docStyle: docStyle || 'jsdoc',
                detailLevel: context.detailLevel || 'standard',
                includeExamples: includeExamples !== false,
                audience: context.audience || 'developer',
                ...context
              });
            } else {
              // Existing prompt
              prompt = config.taskPrompts[TaskType.DOCUMENT_FUNCTION].prompt(
                content,
                language,
                { docStyle }
              );
            }
            
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'suggest_refactoring': {
            const { code, filePath, language, focusAreas, context } = typedArgs;
            const content = code || await this.readFileContent(filePath);
            
            let prompt: string;
            if (context) {
              // Enhanced refactoring with context
              prompt = createRefactoringPrompt(content, {
                projectType: context.projectType || 'generic',
                focusAreas: focusAreas || ['readability', 'maintainability'],
                ...context
              });
            } else {
              // Existing prompt
              prompt = config.taskPrompts[TaskType.SUGGEST_REFACTOR].prompt(
                content,
                language
              );
            }
            
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          // EXISTING TOOLS (PRESERVED AS-IS)
          case 'detect_patterns': {
            const { code, filePath, language } = typedArgs;
            const content = code || await this.readFileContent(filePath);
            const prompt = config.taskPrompts[TaskType.CHECK_PATTERNS].prompt(
              content,
              language
            );
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'validate_syntax': {
            const { code, filePath, language } = typedArgs;
            const content = code || await this.readFileContent(filePath);
            const prompt = config.taskPrompts[TaskType.FIND_BUGS].prompt(
              content,
              language
            );
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'suggest_variable_names': {
            const { code, filePath, language, namingConvention } = typedArgs;
            const content = code || await this.readFileContent(filePath);
            const prompt = config.taskPrompts[TaskType.VARIABLE_NAMES].prompt(
              content,
              language,
              { namingConvention }
            );
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'analyze_file': {
            return this.handleFileAnalysis(typedArgs);
          }
          
          case 'analyze_csv_data': {
            return this.handleCsvAnalysis(typedArgs);
          }
          
          case 'health_check': {
            return this.handleHealthCheck(typedArgs);
          }
          
          // NEW ENHANCED TOOLS
          case 'generate_wordpress_plugin': {
            const prompt = createWordPressPluginPrompt(typedArgs);
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'analyze_n8n_workflow': {
            const { workflow } = typedArgs;
            const prompt = createN8nWorkflowAnalysisPrompt(workflow || {});
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'generate_responsive_component': {
            const prompt = createResponsiveComponentPrompt(typedArgs);
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'convert_to_typescript': {
            const { code, filePath, ...tsContext } = typedArgs;
            const content = code || await this.readFileContent(filePath);
            const prompt = createTypeScriptConversionPrompt(content, tsContext);
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'security_audit': {
            const { code, filePath, ...securityContext } = typedArgs;
            const content = code || await this.readFileContent(filePath);
            const prompt = createSecurityAuditPrompt(content, securityContext);
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          default: {
            throw new Error(`Unknown tool: ${name}`);
          }
        }
      } catch (error) {
        console.error(`Error in tool ${name}:`, error);
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    });
  }

  // ALL EXISTING METHODS REMAIN UNCHANGED
  private async handleHealthCheck(args: any) {
    try {
      const { detailed } = args || {};
      const models = await this.lmStudioClient.llm.listLoaded();
      
      const response: any = {
        status: 'ready',
        models: models.map(m => ({ identifier: m.identifier, path: m.path })),
        lmStudioUrl: config.lmStudioUrl,
      };
      
      if (detailed && models.length > 0 && models[0]) {
        response.modelDetails = {
          identifier: models[0].identifier,
          path: models[0].path,
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            lmStudioUrl: config.lmStudioUrl
          }, null, 2)
        }]
      };
    }
  }

  private async handleFileAnalysis(args: any) {
    const { filePath, instructions, extractFormat } = args || {};
    
    if (!filePath) {
      throw new Error('filePath is required');
    }
    
    const content = await this.readFileContent(filePath);
    const prompt = config.taskPrompts[TaskType.ANALYZE_FILE].prompt(
      content,
      undefined,
      { instructions, extractFormat }
    );
    
    const result = await this.callLMStudio(prompt);
    return { content: [{ type: 'text', text: result }] };
  }

  private async handleCsvAnalysis(args: any) {
    const { filePath, filterCriteria, columns, returnFormat } = args || {};
    
    if (!filePath) {
      throw new Error('filePath is required');
    }
    
    if (!filterCriteria) {
      throw new Error('filterCriteria is required');
    }
    
    const content = await this.readFileContent(filePath);
    const prompt = config.taskPrompts[TaskType.ANALYZE_CSV_DATA].prompt(
      content,
      undefined,
      { filterCriteria, columns, returnFormat }
    );
    
    const result = await this.callLMStudio(prompt);
    return { content: [{ type: 'text', text: result }] };
  }

  private async readFileContent(filePath: string): Promise<string> {
    try {
      const normalizedPath = path.normalize(filePath);
      
      if (!isPathSafe(normalizedPath)) {
        throw new Error('Invalid file path');
      }
      
      const absolutePath = path.isAbsolute(normalizedPath) 
        ? normalizedPath 
        : path.join(process.cwd(), normalizedPath);
      
      validatePath(absolutePath);
      const stats = await fs.stat(absolutePath);
      
      if (stats.size > config.maxFileSize) {
        throw new Error(`File too large (max ${config.maxFileSize / 1024 / 1024}MB)`);
      }
      
      const ext = path.extname(absolutePath).toLowerCase();
      if (!config.supportedFileTypes.includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}`);
      }
      
      return await fs.readFile(absolutePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async callLMStudio(prompt: string): Promise<string> {
    try {
      const model = config.modelName === 'auto'
        ? (await this.lmStudioClient.llm.listLoaded())[0]?.identifier
        : config.modelName;

      if (!model) {
        throw new Error('No model loaded in LM Studio. Please load a model first.');
      }

      const llm = await this.lmStudioClient.llm.model(model);
      const response = await llm.respond([
        { role: 'user', content: prompt }
      ], {
        temperature: config.temperature,
        maxTokens: config.maxTokens
      });
      
      return this.parseModelResponse(response.content);
    } catch (error) {
      throw new Error(`LM Studio error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseModelResponse(response: string): string {
    const thinkingPattern = /<think>[\s\S]*?<\/think>/g;
    return response.replace(thinkingPattern, '').trim();
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Local LLM MCP server running...');
  }
}

const server = new LocalLLMServer();
server.run().catch(console.error);