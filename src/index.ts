/**
 * Local LLM MCP Server - Plugin Architecture v4.0
 * Complete plugin-based replacement of legacy switch-case system
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { LMStudioClient } from '@lmstudio/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { PluginLoader, PluginRegistry } from './plugins/index.js';

// Get current directory for plugin loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LocalLLMServer {
  private server: Server;
  private lmStudioClient: LMStudioClient;
  private pluginLoader: PluginLoader;
  private pluginsInitialized: boolean = false;

  constructor() {
    this.server = new Server(
      {
        name: 'local-llm-server',
        version: '4.0.0-plugin-architecture',
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
    
    this.pluginLoader = PluginRegistry.getInstance();

    this.setupHandlers();
    
    // Error handling
    this.server.onerror = (error) => {
      // Silent error handling for MCP protocol compliance
    };
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  /**
   * Initialize plugins from directories
   */
  private async initializePlugins(): Promise<void> {
    if (this.pluginsInitialized) return;

    try {
      // Removed console.log to avoid JSON-RPC interference
      
      // Load plugins from prompts directory
      const promptsDir = path.join(__dirname, 'prompts');
      await this.pluginLoader.loadPlugins(promptsDir);
      
      // Load system plugins
      await this.loadSystemPlugins();
      
      this.pluginsInitialized = true;
      
      // Silent initialization - no console output
      
    } catch (error) {
      // Silent error handling to avoid JSON-RPC interference
      throw error;
    }
  }

  /**
   * Load system plugins from the system directory
   */
  private async loadSystemPlugins(): Promise<void> {
    try {
      const systemDir = path.join(__dirname, 'system');
      const { promises: fs } = await import('fs');
      
      const files = await fs.readdir(systemDir);
      
      for (const file of files) {
        if (file.endsWith('.js')) { // Only load .js files, skip .d.ts
          const filePath = path.join(systemDir, file);
          await this.loadSystemPlugin(filePath);
        }
      }
    } catch (error) {
      // Silent error handling to avoid JSON-RPC interference
      // console.error('[Plugin Server] Error loading system plugins:', error);
    }
  }

  /**
   * Load a single system plugin
   */
  private async loadSystemPlugin(filePath: string): Promise<void> {
    try {
      // Convert to proper file:// URL for Windows
      const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
      const module = await import(fileUrl);
      const PluginClass = module.default;
      
      if (PluginClass && typeof PluginClass === 'function') {
        const plugin = new PluginClass();
        this.pluginLoader.registerPlugin(plugin);
        // Removed console.log to avoid JSON-RPC interference
      }
    } catch (error) {
      // Silent error handling to avoid JSON-RPC interference
      // console.error(`[Plugin Server] Error loading system plugin ${filePath}:`, error);
    }
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // Tool listing handler - returns plugin-generated tool definitions
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (!this.pluginsInitialized) {
        await this.initializePlugins();
      }
      
      const tools = this.pluginLoader.getPlugins().map(plugin => plugin.getToolDefinition());
      
      // Silent operation - no console output
      return { tools };
    });

    // Resources handler (empty for now)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [],
    }));
    
    // Prompts handler (empty for now)
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [],
    }));

    // Main tool handler - routes all calls through plugin system
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name: toolName, arguments: args } = request.params;
      
      // Silent operation - no console output unless error
      
      if (!this.pluginsInitialized) {
        await this.initializePlugins();
      }
      
      try {
        // Execute plugin
        const result = await this.pluginLoader.executePlugin(toolName, args, this.lmStudioClient);
        
        // Silent success - no console output
        
        // Return standardized MCP response
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        };
        
      } catch (error: any) {
        // Silent error handling - only return error response without logging
        
        // Return error as MCP response
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: true,
                message: error.message || 'Tool execution failed',
                tool: toolName,
                timestamp: new Date().toISOString()
              }, null, 2)
            }
          ]
        };
      }
    });
  }

  /**
   * Get plugin statistics
   */
  private getPluginStats(): any {
    const plugins = this.pluginLoader.getPlugins();
    const categories = {
      analyze: this.pluginLoader.getPluginsByCategory('analyze').length,
      generate: this.pluginLoader.getPluginsByCategory('generate').length,
      multifile: this.pluginLoader.getPluginsByCategory('multifile').length,
      system: this.pluginLoader.getPluginsByCategory('system').length
    };

    return {
      totalPlugins: plugins.length,
      categories,
      pluginNames: plugins.map(p => p.name)
    };
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Silent startup - no console output to avoid JSON-RPC interference
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Server started silently
  }
}

// Start the server
const server = new LocalLLMServer();
server.start().catch((error) => {
  // Silent error handling - only exit on critical startup failure
  process.exit(1);
});
