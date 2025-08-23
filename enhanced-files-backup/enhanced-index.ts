// Complete index.ts update for enhanced prompts
// This preserves ALL existing functionality while adding context support

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { LMStudioClient } from '@lmstudio/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { OffloadTask, TaskType } from './types.js';
import { validatePath, isPathSafe } from './security-config.js';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LocalLLMServer {
  private server: Server;
  private lmStudioClient: LMStudioClient;
  
  constructor() {
    this.server = new Server(
      {
        name: 'local-llm-server',
        version: '2.3.0', // Bump version for enhanced features
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
    // REPLACE the manual tool additions with enhanced definitions
    enhancedToolDefinitions.forEach(toolDef => {
      this.server.addTool(toolDef);
    });

    // Tool listing handler remains the same
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: enhancedToolDefinitions,
    }));

    // UPDATE the tool request handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          // ENHANCED TOOLS WITH CONTEXT SUPPORT
          case 'analyze_code_structure': {
            const { code, filePath, language, analysisDepth, context } = args;
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
            const { code, filePath, language, testFramework, coverageTarget, context } = args;
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
            const { code, filePath, language, docStyle, includeExamples, context } = args;
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
            const { code, filePath, language, focusAreas, context } = args;
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
            const { code, filePath, language, patternTypes } = args;
            const content = code || await this.readFileContent(filePath);
            const prompt = config.taskPrompts[TaskType.CHECK_PATTERNS].prompt(
              content,
              language
            );
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'validate_syntax': {
            const { code, filePath, language, strictMode } = args;
            const content = code || await this.readFileContent(filePath);
            const prompt = config.taskPrompts[TaskType.FIND_BUGS].prompt(
              content,
              language
            );
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'suggest_variable_names': {
            const { code, filePath, language, namingConvention } = args;
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
            return this.handleFileAnalysis(args);
          }
          
          case 'analyze_csv_data': {
            return this.handleCsvAnalysis(args);
          }
          
          case 'health_check': {
            return this.handleHealthCheck(args);
          }
          
          // NEW ENHANCED TOOLS
          case 'generate_wordpress_plugin': {
            const prompt = createWordPressPluginPrompt(args);
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'analyze_n8n_workflow': {
            const { workflow } = args;
            const prompt = createN8nWorkflowAnalysisPrompt(workflow);
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'generate_responsive_component': {
            const prompt = createResponsiveComponentPrompt(args);
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'convert_to_typescript': {
            const { code, filePath, ...tsContext } = args;
            const content = code || await this.readFileContent(filePath);
            const prompt = createTypeScriptConversionPrompt(content, tsContext);
            const result = await this.callLMStudio(prompt);
            return { content: [{ type: 'text', text: result }] };
          }
          
          case 'security_audit': {
            const { code, filePath, ...securityContext } = args;
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
      const { detailed } = args;
      const models = await this.lmStudioClient.llm.listDownloadedModels();
      
      const response: any = {
        status: 'ready',
        models: models.map(m => ({ identifier: m.identifier, path: m.path })),
        lmStudioUrl: config.lmStudioUrl,
      };
      
      if (detailed && models.length > 0) {
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
    const { filePath, instructions, extractFormat } = args;
    
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
    const { filePath, filterCriteria, columns, returnFormat } = args;
    
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
      
      const validatedPath = validatePath(absolutePath);
      const stats = await fs.stat(validatedPath);
      
      if (stats.size > config.maxFileSize) {
        throw new Error(`File too large (max ${config.maxFileSize / 1024 / 1024}MB)`);
      }
      
      const ext = path.extname(validatedPath).toLowerCase();
      if (!config.supportedFileTypes.includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}`);
      }
      
      return await fs.readFile(validatedPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async callLMStudio(prompt: string): Promise<string> {
    try {
      const model = await this.lmStudioClient.llm.get({ 
        path: config.modelName,
        fallbackToAny: true 
      });
      
      if (!model) {
        throw new Error('No model loaded in LM Studio');
      }
      
      const prediction = model.respond([
        { role: 'user', content: prompt }
      ], {
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        topP: config.topP,
      });
      
      let response = '';
      for await (const chunk of prediction) {
        response += chunk.content;
      }
      
      return this.parseModelResponse(response);
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
