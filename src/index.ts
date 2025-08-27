// Enhanced index.ts with multi-file analysis capabilities
// This integrates the FileContextManager and ResponseFormatter

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

// Import existing enhanced tools
import { enhancedToolDefinitions } from './enhanced-tool-definitions.js';
import { multiFileToolDefinitions } from './enhanced-tool-definitions-multifile.js';
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

// Import new multi-file components
import {
  compareIntegration,
  traceExecutionPath,
  findPatternUsage,
  diffMethodSignatures,
  analyzeProjectStructure,
  clearAnalysisCache,
  getCacheStatistics
} from './core/MultiFileAnalysis.js';
import { ResponseFormatter } from './core/ResponseFormatter.js';

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
  private responseFormatter: ResponseFormatter;
  
  constructor() {
    this.server = new Server(
      {
        name: 'local-llm-server',
        version: '4.0.0', // Bump version for multi-file support
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
      }
    );

    this.lmStudioClient = new LMStudioClient({
      baseUrl: config.lmStudioUrl,
    });
    
    this.responseFormatter = new ResponseFormatter();

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // Tool listing handler - returns both enhanced and multi-file tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [...enhancedToolDefinitions, ...multiFileToolDefinitions],
    }));

    // Resources handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));
    
    // Prompts handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [],
    }));

    // Main tool handler - handles both existing and new multi-file tools
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: args } = request.params;
      
      // Handle multi-file tools first (no LLM needed)
      if (this.isMultiFileTool(toolName)) {
        return this.handleMultiFileTool(toolName, args);
      }
      
      // Handle existing tools with LLM
      return this.handleLLMTool(toolName, args);
    });
  }
  
  private isMultiFileTool(toolName: string): boolean {
    const multiFileTools = [
      'compare_integration',
      'trace_execution_path',
      'find_pattern_usage',
      'diff_method_signatures',
      'analyze_project_structure',
      'clear_analysis_cache',
      'get_cache_statistics'
    ];
    return multiFileTools.includes(toolName);
  }
  
  private async handleMultiFileTool(toolName: string, args: any): Promise<any> {
    try {
      // Validate paths for security
      if (args.files) {
        for (const file of args.files) {
          validatePath(file);
        }
      }
      if (args.projectPath) {
        validatePath(args.projectPath);
      }
      if (args.callingFile) {
        validatePath(args.callingFile);
      }
      if (args.filePath) {
        validatePath(args.filePath);
      }
      
      let result;
      
      switch (toolName) {
        case 'compare_integration':
          result = await compareIntegration(
            args.files,
            args.analysisType,
            args.focus || []
          );
          break;
          
        case 'trace_execution_path':
          result = await traceExecutionPath(
            args.entryPoint,
            args.traceDepth || 5,
            args.showParameters || false
          );
          break;
          
        case 'find_pattern_usage':
          result = await findPatternUsage(
            args.projectPath,
            args.patterns,
            args.includeContext || 3
          );
          break;
          
        case 'diff_method_signatures':
          result = await diffMethodSignatures(
            args.callingFile,
            args.calledClass,
            args.methodName
          );
          break;
          
        case 'analyze_project_structure':
          result = await analyzeProjectStructure(
            args.projectPath,
            args.focusAreas || [],
            args.maxDepth || 3
          );
          break;
          
        case 'clear_analysis_cache':
          clearAnalysisCache(args.filePath);
          result = {
            summary: args.filePath ? 
              `Cache cleared for ${args.filePath}` : 
              'All analysis cache cleared',
            confidence: 1.0,
            actions: { critical: [], recommended: [], optional: [] },
            metadata: {
              filesAnalyzed: 0,
              tokensSaved: 0,
              executionTime: 0,
              timestamp: new Date().toISOString()
            }
          };
          break;
          
        case 'get_cache_statistics':
          const stats = getCacheStatistics();
          result = {
            summary: `Cache contains ${stats.filesAnalyzed} analyzed files`,
            confidence: 1.0,
            actions: { critical: [], recommended: [], optional: [] },
            details: stats,
            metadata: {
              filesAnalyzed: stats.filesAnalyzed,
              tokensSaved: 0,
              executionTime: 0,
              timestamp: new Date().toISOString()
            }
          };
          break;
          
        default:
          throw new Error(`Unknown multi-file tool: ${toolName}`);
      }
      
      // Return formatted JSON response
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
      
    } catch (error) {
      console.error(`[Multi-file Tool Error] ${toolName}:`, error);
      
      // Return error in structured format
      const errorResponse = this.responseFormatter.format({
        summary: `Error in ${toolName}: ${error.message}`,
        confidence: 0,
        errors: [error.message],
        filesAnalyzed: 0
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(errorResponse, null, 2)
          }
        ],
        isError: true
      };
    }
  }
  
  private async handleLLMTool(toolName: string, args: any): Promise<any> {
    try {
      // Security validation
      if (args.filePath) {
        validatePath(args.filePath);
      }
      
      // Check LM Studio connection
      const models = await this.lmStudioClient.llm.listLoaded();
      if (models.length === 0) {
        throw new Error('No model loaded in LM Studio. Please load a model first.');
      }
      
      const modelName = models[0].identifier;
      const model = await this.lmStudioClient.llm.model(modelName);
      
      // Process based on tool type
      let prompt = '';
      let content = '';
      
      // Read file if needed
      if (args.filePath) {
        content = await fs.readFile(args.filePath, 'utf-8');
      } else if (args.code) {
        content = args.code;
      }
      
      // Generate prompt based on tool - ALL 15 TOOLS RESTORED
      switch (toolName) {
        case 'analyze_code_structure':
          prompt = createCodeStructurePrompt(content, args.context);
          break;
          
        case 'generate_unit_tests':
          prompt = createUnitTestPrompt(content, args.context);
          break;
          
        case 'generate_documentation':
          prompt = createDocumentationPrompt(content, args.context);
          break;
          
        case 'suggest_refactoring':
          prompt = createRefactoringPrompt(content, args.context);
          break;
          
        case 'generate_wordpress_plugin':
          prompt = createWordPressPluginPrompt(args);
          break;
          
        case 'analyze_n8n_workflow':
          prompt = createN8nWorkflowAnalysisPrompt(args.workflow || {});
          break;
          
        case 'generate_responsive_component':
          prompt = createResponsiveComponentPrompt(args);
          break;
          
        case 'convert_to_typescript':
          prompt = createTypeScriptConversionPrompt(content, args.context);
          break;
          
        case 'security_audit':
          prompt = createSecurityAuditPrompt(content, args);
          break;
          
        case 'health_check':
          // Special case - doesn't need LLM
          return await this.handleHealthCheck(args);
          
        case 'validate_syntax':
          prompt = `Validate the syntax and find potential bugs in this code:\n\n${content}\n\nProvide a structured response with:\n- Syntax errors found\n- Potential bugs\n- Type mismatches\n- Undefined variables\n- Suggestions for fixes`;
          break;
          
        case 'detect_patterns':
          prompt = `Analyze this code and detect design patterns and anti-patterns:\n\n${content}\n\nIdentify:\n- Design patterns used\n- Anti-patterns present\n- Code smells\n- Architectural patterns\n- Recommendations`;
          break;
          
        case 'suggest_variable_names':
          const namingConvention = args.namingConvention || 'camelCase';
          prompt = `Suggest better variable names for this code using ${namingConvention}:\n\n${content}\n\nFor each variable:\n- Current name\n- Suggested name\n- Reason for change\n- Context of usage`;
          break;
          
        case 'analyze_file':
          const instructions = args.instructions || 'Analyze this file comprehensively';
          prompt = `${instructions}\n\nFile content:\n${content}\n\nProvide structured analysis based on the instructions.`;
          break;
          
        case 'analyze_csv_data':
          const filterCriteria = args.filterCriteria ? JSON.stringify(args.filterCriteria) : 'none';
          const columns = args.columns ? args.columns.join(', ') : 'all';
          prompt = `Analyze this CSV data:\n- Filter criteria: ${filterCriteria}\n- Columns to analyze: ${columns}\n- Return format: ${args.returnFormat || 'summary'}\n\nData:\n${content}\n\nProvide analysis with statistics, patterns, and insights.`;
          break;
          
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      
      // Get response from LLM
      const prediction = model.respond([
        {
          role: 'system',
          content: 'You are an expert code analyst. Provide structured, actionable responses.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]);
      
      let response = '';
      for await (const text of prediction) {
        response += text;
      }
      
      // Format response
      const formattedResponse = this.responseFormatter.format({
        rawResponse: response,
        filesAnalyzed: 1
      });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(formattedResponse, null, 2)
          }
        ]
      };
      
    } catch (error) {
      console.error(`[LLM Tool Error] ${toolName}:`, error);
      throw error;
    }
  }
  
  // Helper method for health check
  private async handleHealthCheck(args: any) {
    try {
      const { detailed } = args || {};
      const models = await this.lmStudioClient.llm.listLoaded();
      
      const response: any = {
        status: 'ready',
        models: models.map((m: any) => ({ 
          identifier: m.identifier, 
          path: m.path 
        })),
        lmStudioUrl: config.lmStudioUrl,
        version: '4.0.0',
        multiFileSupport: true
      };
      
      if (detailed && models.length > 0 && models[0]) {
        response.modelDetails = {
          identifier: models[0].identifier,
          path: models[0].path,
        };
        response.capabilities = {
          legacyTools: 15,
          multiFileTools: 7,
          frameworkSupport: ['wordpress', 'react', 'n8n', 'typescript'],
          tokenSavings: '94% average'
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[LocalLLM Server] Connected and running with multi-file support v4.0.0');
  }
}

const server = new LocalLLMServer();
server.run().catch(console.error);
