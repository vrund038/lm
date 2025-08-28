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
    this.server.onerror = (error) => console.error('[MCP Error]', error);
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
      console.log('[Plugin Server] Loading plugins...');
      
      // Load plugins from prompts directory
      const promptsDir = path.join(__dirname, 'prompts');
      await this.pluginLoader.loadPlugins(promptsDir);
      
      // Load system plugins
      await this.loadSystemPlugins();
      
      this.pluginsInitialized = true;
      
      const stats = this.getPluginStats();
      console.log(`[Plugin Server] Loaded ${stats.totalPlugins} plugins:`);
      console.log(`  - Analyze: ${stats.categories.analyze}`);
      console.log(`  - Generate: ${stats.categories.generate}`);
      console.log(`  - Multifile: ${stats.categories.multifile}`);
      console.log(`  - System: ${stats.categories.system}`);
      console.log(`[Plugin Server] Available tools:`, stats.pluginNames);
      
    } catch (error) {
      console.error('[Plugin Server] Failed to initialize plugins:', error);
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
        if (file.endsWith('.ts') || file.endsWith('.js')) {
          const filePath = path.join(systemDir, file);
          await this.loadSystemPlugin(filePath);
        }
      }
    } catch (error) {
      console.error('[Plugin Server] Error loading system plugins:', error);
    }
  }

  /**
   * Load a single system plugin
   */
  private async loadSystemPlugin(filePath: string): Promise<void> {
    try {
      // Convert to file:// URL for proper ESM import
      const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
      const module = await import(fileUrl);
      const PluginClass = module.default;
      
      if (PluginClass && typeof PluginClass === 'function') {
        const plugin = new PluginClass();
        this.pluginLoader.registerPlugin(plugin);
        console.log(`[Plugin Server] Loaded system plugin: ${plugin.name}`);
      }
    } catch (error) {
      console.error(`[Plugin Server] Error loading system plugin ${filePath}:`, error);
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
      
      console.log(`[Plugin Server] Listing ${tools.length} tools`);
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
      
      console.log(`[Plugin Server] Executing tool: ${toolName}`);
      console.log(`[Plugin Server] Arguments:`, JSON.stringify(args, null, 2));
      
      if (!this.pluginsInitialized) {
        await this.initializePlugins();
      }
      
      try {
        // Execute plugin
        const result = await this.pluginLoader.executePlugin(toolName, args, this.lmStudioClient);
        
        console.log(`[Plugin Server] Tool ${toolName} executed successfully`);
        
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
        console.error(`[Plugin Server] Tool execution failed for ${toolName}:`, error);
        
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
    console.log('[Plugin Server] Starting Local LLM MCP Server v4.0 (Plugin Architecture)');
    console.log('[Plugin Server] LM Studio URL:', config.lmStudioUrl);
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.log('[Plugin Server] Server started and ready for connections');
  }
}

// Start the server
const server = new LocalLLMServer();
server.start().catch((error) => {
  console.error('[Plugin Server] Failed to start server:', error);
  process.exit(1);
});
