/**
 * Plugin Loader and Registry
 * Dynamically loads and manages all prompt plugins
 * Modern v4.2 architecture - plugins handle their own context management
 */

import { IPromptPlugin } from './types.js';
import { BasePlugin } from './base-plugin.js';
import path from 'path';
import { promises as fs } from 'fs';
import { pathToFileURL } from 'url';

export class PluginLoader {
  private plugins: Map<string, IPromptPlugin> = new Map();
  private categories: Map<string, IPromptPlugin[]> = new Map();
  
  constructor() {
    // Initialize category maps
    this.categories.set('analyze', []);
    this.categories.set('generate', []);
    this.categories.set('custom', []);
    this.categories.set('system', []);
    this.categories.set('fun', []);
  }
  
  /**
   * Load all plugins from the prompts directory
   */
  async loadPlugins(promptsDir: string): Promise<void> {
    const categories = ['analyze', 'generate', 'custom', 'system', 'fun'];
    
    for (const category of categories) {
      const categoryPath = path.join(promptsDir, category);
      
      try {
        const files = await fs.readdir(categoryPath);
        
        for (const file of files) {
          if (file.endsWith('.js') && !file.includes('.test.')) { // Only load .js files, skip .d.ts and tests
            await this.loadPlugin(path.join(categoryPath, file), category as any);
          }
        }
      } catch (error) {
        // Silent error handling to avoid JSON-RPC interference
        // console.error(`Error loading plugins from ${category}:`, error);
      }
    }
    
    // Load system plugins from shared (cache management)
    await this.loadSystemPlugins(path.join(promptsDir, 'shared'));
  }
  
  /**
   * Load a single plugin file
   */
  private async loadPlugin(filePath: string, category: 'analyze' | 'generate' | 'custom' | 'system'): Promise<void> {
    try {
      // Skip .d.ts files (TypeScript declaration files)
      if (filePath.endsWith('.d.ts')) {
        return;
      }
      
      // Use pathToFileURL for proper ES module loading on Windows
      const fileUrl = pathToFileURL(filePath).href;
      const module = await import(fileUrl);
      const PluginClass = module.default;
      
      if (PluginClass && typeof PluginClass === 'function') {
        const plugin = new PluginClass();
        
        if (plugin instanceof BasePlugin) {
          this.registerPlugin(plugin);
          // Removed console.log to avoid JSON-RPC interference
        }
      }
    } catch (error) {
      // Silent error handling to avoid JSON-RPC interference
      // console.error(`Error loading plugin from ${filePath}:`, error);
    }
  }
  
  /**
   * Load system plugins (cache management, health check)
   */
  private async loadSystemPlugins(sharedDir: string): Promise<void> {
    // Load cache management plugins
    try {
      const cacheManagerPath = path.join(sharedDir, 'cache-manager.js');
      // Convert Windows path to proper file:// URL
      const fileUrl = `file:///${cacheManagerPath.replace(/\\/g, '/')}`;
      const cacheModule = await import(fileUrl);
      
      if (cacheModule.ClearCachePlugin) {
        this.registerPlugin(new cacheModule.ClearCachePlugin());
      }
      if (cacheModule.CacheStatisticsPlugin) {
        this.registerPlugin(new cacheModule.CacheStatisticsPlugin());
      }
    } catch (error) {
      // Silent error handling to avoid JSON-RPC interference  
      // console.error('Error loading cache management plugins:', error);
    }
  }
  
  /**
   * Register a plugin
   */
  registerPlugin(plugin: IPromptPlugin): void {
    // Validate plugin has required properties
    if (!plugin.name || !plugin.category || !plugin.execute) {
      throw new Error('Invalid plugin: missing required properties');
    }
    
    // Register in main map
    this.plugins.set(plugin.name, plugin);
    
    // Register in category map
    const categoryPlugins = this.categories.get(plugin.category) || [];
    categoryPlugins.push(plugin);
    this.categories.set(plugin.category, categoryPlugins);
  }
  
  /**
   * Get a plugin by name
   */
  getPlugin(name: string): IPromptPlugin | undefined {
    return this.plugins.get(name);
  }
  
  /**
   * Get all plugins
   */
  getPlugins(): IPromptPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Get plugins by category
   */
  getPluginsByCategory(category: 'analyze' | 'generate' | 'system'): IPromptPlugin[] {
    return this.categories.get(category) || [];
  }
  
  /**
   * Get plugin names
   */
  getPluginNames(): string[] {
    return Array.from(this.plugins.keys());
  }
  
  /**
   * Execute a plugin by name
   * Modern v4.2: Each plugin handles its own context management with ThreeStagePromptManager
   */
  async executePlugin(name: string, params: any, llmClient: any): Promise<any> {
    const plugin = this.getPlugin(name);
    
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }
    
    // Apply defaults and validate parameters
    if (plugin instanceof BasePlugin) {
      params = plugin.applyDefaults(params);
      plugin.validateParams(params);
    }
    
    // Execute plugin - let each plugin handle its own context management
    // Modern plugins use ThreeStagePromptManager internally for intelligent chunking
    return await plugin.execute(params, llmClient);
  }
}

export class PluginRegistry {
  private static instance: PluginLoader;
  
  static getInstance(): PluginLoader {
    if (!this.instance) {
      this.instance = new PluginLoader();
    }
    return this.instance;
  }
}

export default {
  PluginLoader,
  PluginRegistry
};
