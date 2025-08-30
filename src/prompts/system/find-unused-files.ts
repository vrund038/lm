/**
 * Find Unused Files Plugin
 * Identifies genuinely unused TypeScript files in complex projects with dynamic loading patterns
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { readFileContent } from '../shared/helpers.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Type definitions for the comprehensive analysis
interface UnusedFilesContext {
  projectPath: string;
  entryPoints: string[];
  excludePatterns: string[];
  includeDevArtifacts: boolean;
  analyzeComments: boolean;
}

export class FindUnusedFiles extends BasePlugin implements IPromptPlugin {
  name = 'find_unused_files';
  category = 'system' as const;
  description = 'Identify genuinely unused TypeScript files in complex projects with dynamic loading patterns';
  
  parameters = {
    projectPath: {
      type: 'string' as const,
      description: 'Absolute path to project root',
      required: true
    },
    entryPoints: {
      type: 'array' as const,
      description: 'Entry point files to start dependency traversal',
      items: { type: 'string' as const },
      default: ['index.ts', 'main.ts', 'app.ts'],
      required: false
    },
    excludePatterns: {
      type: 'array' as const,
      description: 'File patterns to exclude from analysis',
      items: { type: 'string' as const },
      default: ['*.test.ts', '*.spec.ts', '*.d.ts'],
      required: false
    },
    includeDevArtifacts: {
      type: 'boolean' as const,
      description: 'Whether to flag potential dev artifacts',
      default: false,
      required: false
    },
    analyzeComments: {
      type: 'boolean' as const,
      description: 'Check for commented-out imports',
      default: true,
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      // Security validation using enhanced path validation
      if (!secureParams.projectPath || typeof secureParams.projectPath !== 'string') {
        throw new Error('Invalid project path');
      }

      // Import the secure path validation helper
      const { validateAndNormalizePath } = await import('../shared/helpers.js');
      
      // Use secure path validation and normalization
      const projectPath = await validateAndNormalizePath(secureParams.projectPath);

      // Prepare context with defaults
      const context: UnusedFilesContext = {
        projectPath: projectPath,
        entryPoints: secureParams.entryPoints || ['index.ts', 'main.ts', 'app.ts'],
        excludePatterns: secureParams.excludePatterns || ['*.test.ts', '*.spec.ts', '*.d.ts'],
        includeDevArtifacts: secureParams.includeDevArtifacts || false,
        analyzeComments: secureParams.analyzeComments || true
      };

      // Perform the comprehensive file analysis
      const analysisResult = await this.performFileAnalysis(context);

      // Get LLM response using modern architecture
      const models = await llmClient.llm.listLoaded();
      if (models.length === 0) {
        throw new Error('No model loaded in LM Studio');
      }

      const model = models[0];
      const contextLength = await model.getContextLength() || 23832;
      
      // Generate 3-stage prompt
      const promptStages = this.getPromptStages({
        ...secureParams,
        analysisResult,
        context
      });
      
      // Determine if chunking is needed
      const promptManager = new ThreeStagePromptManager(contextLength);
      const needsChunking = promptManager.needsChunking(promptStages);
      
      let response = '';
      if (needsChunking) {
        response = await this.executeWithChunking(promptStages, model, promptManager);
      } else {
        response = await this.executeDirect(promptStages, model);
      }

      // Parse and validate the response
      const parsedResult = this.parseResponse(response, analysisResult);

      // Use ResponseFactory for consistent output
      ResponseFactory.setStartTime();
      return ResponseFactory.createSystemResponse({
        status: 'completed',
        details: {
          summary: parsedResult.summary,
          usedFiles: parsedResult.usedFiles,
          unusedCandidates: parsedResult.unusedCandidates,
          devArtifacts: parsedResult.devArtifacts,
          recommendations: parsedResult.recommendations,
          rawAnalysis: analysisResult
        }
      });
    });
  }

  /**
   * Perform comprehensive file analysis programmatically
   */
  private async performFileAnalysis(context: UnusedFilesContext): Promise<any> {
    // Phase 1: Discover all files
    const allFiles = await this.discoverSourceFiles(context.projectPath, context.excludePatterns);
    
    // Phase 2: Build usage map
    const usageMap = new Map<string, {
      usedBy: string[];
      usageType: 'entry' | 'static' | 'dynamic' | 'config' | 'unused';
      confidence: 'high' | 'medium' | 'low';
      category?: 'dev-artifact' | 'legacy' | 'plugin' | 'config' | 'core';
    }>();

    // Initialize all files as unused
    allFiles.forEach(file => {
      usageMap.set(file, {
        usedBy: [],
        usageType: 'unused',
        confidence: 'low'
      });
    });

    // Phase 3: Static import analysis
    await this.analyzeStaticImports(allFiles, usageMap, context.analyzeComments);

    // Phase 4: Dynamic loading patterns
    await this.analyzeDynamicLoading(allFiles, usageMap, context.projectPath);

    // Phase 5: Entry point traversal
    await this.analyzeFromEntryPoints(context.entryPoints, context.projectPath, usageMap);

    // Phase 6: Configuration analysis
    await this.analyzeConfigurationFiles(context.projectPath, usageMap);

    // Phase 7: Dev artifacts detection
    const devArtifacts = context.includeDevArtifacts ? 
      await this.detectDevArtifacts(allFiles, usageMap) : 
      { duplicateFiles: [], temporaryFiles: [], legacyFiles: [] };

    return {
      totalFiles: allFiles.length,
      allFiles,
      usageMap: Object.fromEntries(usageMap),
      devArtifacts,
      analysisTimestamp: new Date().toISOString()
    };
  }

  private async discoverSourceFiles(projectPath: string, excludePatterns: string[]): Promise<string[]> {
    const sourceFiles: string[] = [];
    const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
    
    // Import secure path validation helper
    const { validateAndNormalizePath } = await import('../shared/helpers.js');

    const scanDir = async (dirPath: string): Promise<void> => {
      try {
        // Validate directory path before reading
        const validatedDirPath = await validateAndNormalizePath(dirPath);
        const entries = await fs.readdir(validatedDirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(validatedDirPath, entry.name);
          
          try {
            // Validate each constructed path before operations
            const validatedFullPath = await validateAndNormalizePath(fullPath);
            
            if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
              await scanDir(validatedFullPath);
            } else if (entry.isFile()) {
              if (sourceExtensions.some(ext => entry.name.endsWith(ext))) {
                const relativePath = path.relative(projectPath, validatedFullPath);
                if (!this.matchesExcludePattern(relativePath, excludePatterns)) {
                  sourceFiles.push(validatedFullPath);
                }
              }
            }
          } catch (pathError) {
            // Skip files/directories that fail path validation (security protection)
            continue;
          }
        }
      } catch (error) {
        // Skip directories we can't read or validate
      }
    };

    await scanDir(projectPath);
    return sourceFiles;
  }

  private matchesExcludePattern(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(filePath);
    });
  }

  private async analyzeStaticImports(files: string[], usageMap: Map<string, any>, analyzeComments: boolean): Promise<void> {
    const importPatterns = [
      /(?:^|\n)\s*(?:import|export).*?from\s+['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    ];

    if (analyzeComments) {
      importPatterns.push(/\/\/.*?(?:import|export).*?from\s+['"`]([^'"`]+)['"`]/g);
    }

    for (const file of files) {
      try {
        const content = await readFileContent(file);
        const fileDir = path.dirname(file);

        for (const pattern of importPatterns) {
          const matches = Array.from(content.matchAll(pattern));
          
          for (const match of matches) {
            const importPath = match[1];
            const resolvedPath = await this.resolveImportPath(importPath, fileDir);
            
            if (resolvedPath && usageMap.has(resolvedPath)) {
              const usage = usageMap.get(resolvedPath)!;
              usage.usageType = 'static';
              usage.confidence = 'high';
              usage.usedBy.push(file);
            }
          }
        }
      } catch (error) {
        // Skip files we can't read
      }
    }
  }

  private async analyzeDynamicLoading(files: string[], usageMap: Map<string, any>, projectPath: string): Promise<void> {
    const dynamicPatterns = [
      /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /import\s*\(\s*[^)]+\s*\)/g,
      /require\.resolve\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /readdir.*?import/gs,
      /loadPlugins?\s*\(/g
    ];

    for (const file of files) {
      try {
        const content = await readFileContent(file);
        
        // Check for dynamic loading patterns
        if (dynamicPatterns.some(pattern => pattern.test(content))) {
          await this.identifyDynamicTargets(file, content, usageMap, projectPath);
        }

        // Check if file is in plugin-like directory
        const relativePath = path.relative(projectPath, file);
        if (/plugins?|handlers?|middleware|extensions?/i.test(relativePath)) {
          const usage = usageMap.get(file)!;
          if (usage.usageType === 'unused') {
            usage.usageType = 'dynamic';
            usage.confidence = 'medium';
            usage.category = 'plugin';
          }
        }
      } catch (error) {
        // Skip files we can't read
      }
    }
  }

  private async identifyDynamicTargets(loaderFile: string, content: string, usageMap: Map<string, any>, projectPath: string): Promise<void> {
    const dirScanPatterns = [
      /readdir\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /glob\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /join\s*\(\s*__dirname\s*,\s*['"`]([^'"`]+)['"`]/g
    ];

    for (const pattern of dirScanPatterns) {
      const matches = Array.from(content.matchAll(pattern));
      
      for (const match of matches) {
        const dirPath = match[1];
        const absoluteDirPath = path.resolve(path.dirname(loaderFile), dirPath);
        
        try {
          const entries = await fs.readdir(absoluteDirPath, { withFileTypes: true });
          
          for (const entry of entries) {
            if (entry.isFile() && this.isSourceFile(entry.name)) {
              const targetFile = path.join(absoluteDirPath, entry.name);
              
              if (usageMap.has(targetFile)) {
                const usage = usageMap.get(targetFile)!;
                usage.usageType = 'dynamic';
                usage.confidence = 'high';
                usage.usedBy.push(loaderFile);
              }
            }
          }
        } catch (error) {
          // Directory might not exist
        }
      }
    }
  }

  private isSourceFile(filename: string): boolean {
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].some(ext => filename.endsWith(ext));
  }

  private async analyzeFromEntryPoints(entryPoints: string[], projectPath: string, usageMap: Map<string, any>): Promise<void> {
    // Import secure path validation helper
    const { validateAndNormalizePath } = await import('../shared/helpers.js');
    
    const visited = new Set<string>();
    const queue: string[] = [];

    // Find existing entry points
    for (const entryPoint of entryPoints) {
      try {
        // Use secure path validation for entry point construction
        const entryPath = await validateAndNormalizePath(path.join(projectPath, entryPoint));
        
        if (usageMap.has(entryPath)) {
          const usage = usageMap.get(entryPath)!;
          usage.usageType = 'entry';
          usage.confidence = 'high';
          queue.push(entryPath);
          visited.add(entryPath);
        }
      } catch (pathError) {
        // Skip invalid entry points (security protection)
        continue;
      }
    }

    // BFS traversal
    while (queue.length > 0) {
      const currentFile = queue.shift()!;
      
      try {
        const dependencies = await this.extractDependencies(currentFile);
        
        for (const depPath of dependencies) {
          if (usageMap.has(depPath) && !visited.has(depPath)) {
            const usage = usageMap.get(depPath)!;
            
            if (usage.usageType === 'unused') {
              usage.usageType = 'static';
              usage.confidence = 'high';
            }
            
            usage.usedBy.push(currentFile);
            queue.push(depPath);
            visited.add(depPath);
          }
        }
      } catch (error) {
        // Skip files we can't analyze
      }
    }
  }

  private async extractDependencies(filePath: string): Promise<string[]> {
    const dependencies: string[] = [];
    const fileDir = path.dirname(filePath);
    
    try {
      const content = await readFileContent(filePath);
      const importRegex = /(?:^|\n)\s*(?:import|export).*?from\s+['"`]([^'"`]+)['"`]/g;
      const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
      
      const imports = [
        ...Array.from(content.matchAll(importRegex)),
        ...Array.from(content.matchAll(requireRegex))
      ];

      for (const match of imports) {
        const importPath = match[1];
        const resolvedPath = await this.resolveImportPath(importPath, fileDir);
        
        if (resolvedPath) {
          dependencies.push(resolvedPath);
        }
      }
    } catch (error) {
      // Return empty array if file can't be read
    }

    return dependencies;
  }

  private async resolveImportPath(importPath: string, fromDir: string): Promise<string | null> {
    // Skip node_modules
    if (!importPath.startsWith('.') && !path.isAbsolute(importPath)) {
      return null;
    }

    try {
      const resolvedPath = path.resolve(fromDir, importPath);
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
      
      // Try as-is
      try {
        const stat = await fs.stat(resolvedPath);
        if (stat.isFile()) return resolvedPath;
      } catch {}

      // Try with extensions
      for (const ext of extensions) {
        try {
          const withExt = resolvedPath + ext;
          const stat = await fs.stat(withExt);
          if (stat.isFile()) return withExt;
        } catch {}
      }

      // Try as directory with index
      for (const ext of extensions) {
        try {
          const indexPath = path.join(resolvedPath, `index${ext}`);
          const stat = await fs.stat(indexPath);
          if (stat.isFile()) return indexPath;
        } catch {}
      }
    } catch {}

    return null;
  }

  private async analyzeConfigurationFiles(projectPath: string, usageMap: Map<string, any>): Promise<void> {
    const configFiles = ['package.json', 'tsconfig.json', 'webpack.config.js', '.babelrc'];
    
    for (const configFile of configFiles) {
      const configPath = path.join(projectPath, configFile);
      
      try {
        const content = await readFileContent(configPath);
        
        if (configFile.endsWith('.json')) {
          try {
            const config = JSON.parse(content);
            await this.analyzeJsonConfig(config, usageMap, projectPath);
          } catch {}
        }
      } catch {
        // Config file doesn't exist
      }
    }
  }

  private async analyzeJsonConfig(config: any, usageMap: Map<string, any>, projectPath: string): Promise<void> {
    // Check package.json scripts
    if (config.scripts) {
      for (const [, scriptContent] of Object.entries(config.scripts)) {
        if (typeof scriptContent === 'string') {
          const fileRefs = this.extractFileReferences(scriptContent as string);
          
          for (const fileRef of fileRefs) {
            const resolvedPath = path.resolve(projectPath, fileRef);
            if (usageMap.has(resolvedPath)) {
              const usage = usageMap.get(resolvedPath)!;
              usage.usageType = 'config';
              usage.confidence = 'high';
              usage.usedBy.push('package.json');
            }
          }
        }
      }
    }

    // Check tsconfig includes/files
    if (config.include || config.files) {
      const patterns = [...(config.include || []), ...(config.files || [])];

      for (const pattern of patterns) {
        if (typeof pattern === 'string') {
          const resolvedPath = path.resolve(projectPath, pattern);
          if (usageMap.has(resolvedPath)) {
            const usage = usageMap.get(resolvedPath)!;
            usage.usageType = 'config';
            usage.confidence = 'high';
            usage.usedBy.push('tsconfig.json');
          }
        }
      }
    }
  }

  private extractFileReferences(content: string): string[] {
    const refs: string[] = [];
    const patterns = [
      /['"`]([^'"`]*\.(?:ts|tsx|js|jsx|mjs|cjs))['"`]/g,
      /entry:\s*['"`]([^'"`]+)['"`]/g,
      /main:\s*['"`]([^'"`]+)['"`]/g,
      /module:\s*['"`]([^'"`]+)['"`]/g
    ];

    for (const pattern of patterns) {
      const matches = Array.from(content.matchAll(pattern));
      refs.push(...matches.map(match => match[1]));
    }

    return refs;
  }

  private async detectDevArtifacts(files: string[], usageMap: Map<string, any>): Promise<{
    duplicateFiles: string[];
    temporaryFiles: string[];
    legacyFiles: string[];
  }> {
    const duplicateFiles: string[] = [];
    const temporaryFiles: string[] = [];
    const legacyFiles: string[] = [];

    const tempPatterns = [
      /\btemp\b/i, /\btest\b/i, /\bdemo\b/i, /\bexample\b/i, /\bsandbox\b/i,
      /\bplayground\b/i, /\.backup\./, /\.old\./, /\.tmp\./, /-test\./, /-demo\./,
      /enhanced-/i, /experimental-/i
    ];

    const legacyPatterns = [
      /\blegacy\b/i, /\bold\b/i, /\bdeprecated\b/i, /\barchived?\b/i,
      /v[0-9]+\./, /-v[0-9]+\./, /\.legacy\./, /\.old\./
    ];

    for (const file of files) {
      const fileName = path.basename(file);
      
      if (tempPatterns.some(pattern => pattern.test(fileName))) {
        temporaryFiles.push(file);
        const usage = usageMap.get(file)!;
        usage.category = 'dev-artifact';
      }
      
      if (legacyPatterns.some(pattern => pattern.test(fileName))) {
        legacyFiles.push(file);
        const usage = usageMap.get(file)!;
        usage.category = 'legacy';
      }
    }

    // Group by similar names for duplicates
    const nameGroups: { [key: string]: string[] } = {};
    
    for (const file of files) {
      const fileName = path.basename(file, path.extname(file));
      const normalizedName = fileName.replace(/[-_]\d+$/, '').toLowerCase();
      
      if (!nameGroups[normalizedName]) {
        nameGroups[normalizedName] = [];
      }
      nameGroups[normalizedName].push(file);
    }

    for (const [, groupFiles] of Object.entries(nameGroups)) {
      if (groupFiles.length > 1) {
        const unusedInGroup = groupFiles.filter(file => {
          const usage = usageMap.get(file)!;
          return usage.usageType === 'unused';
        });
        
        if (unusedInGroup.length > 0) {
          duplicateFiles.push(...unusedInGroup);
          
          unusedInGroup.forEach(file => {
            const usage = usageMap.get(file)!;
            usage.category = 'dev-artifact';
          });
        }
      }
    }

    return { duplicateFiles, temporaryFiles, legacyFiles };
  }

  private parseResponse(response: string, analysisResult: any): any {
    // Generate structured results from the programmatic analysis
    const usageMap = analysisResult.usageMap;
    
    const usedFiles = {
      viaStaticImport: [] as string[],
      viaDynamicLoading: [] as string[],
      viaEntryPoints: [] as string[],
      viaConfiguration: [] as string[]
    };

    const unusedCandidates = {
      definitelyUnused: [] as string[],
      likelyUnused: [] as string[],
      unclear: [] as string[]
    };

    const recommendations = {
      safeToDelete: [] as string[],
      investigateFirst: [] as string[],
      keepForCompatibility: [] as string[]
    };

    for (const [file, usage] of Object.entries(usageMap)) {
      const usageData = usage as any;
      
      switch (usageData.usageType) {
        case 'static':
          usedFiles.viaStaticImport.push(file);
          break;
        case 'dynamic':
          usedFiles.viaDynamicLoading.push(file);
          break;
        case 'entry':
          usedFiles.viaEntryPoints.push(file);
          break;
        case 'config':
          usedFiles.viaConfiguration.push(file);
          break;
        case 'unused':
          if (usageData.confidence === 'high') {
            unusedCandidates.definitelyUnused.push(file);
            if (usageData.category === 'dev-artifact') {
              recommendations.safeToDelete.push(file);
            } else {
              recommendations.investigateFirst.push(file);
            }
          } else if (usageData.confidence === 'medium') {
            unusedCandidates.likelyUnused.push(file);
            recommendations.investigateFirst.push(file);
          } else {
            unusedCandidates.unclear.push(file);
            if (usageData.category === 'legacy') {
              recommendations.keepForCompatibility.push(file);
            } else {
              recommendations.investigateFirst.push(file);
            }
          }
          break;
      }
    }

    const usedFilesCount = usedFiles.viaStaticImport.length + 
                          usedFiles.viaDynamicLoading.length + 
                          usedFiles.viaEntryPoints.length + 
                          usedFiles.viaConfiguration.length;
    const unusedCount = unusedCandidates.definitelyUnused.length + 
                       unusedCandidates.likelyUnused.length + 
                       unusedCandidates.unclear.length;
    const devArtifactsCount = analysisResult.devArtifacts.duplicateFiles.length + 
                             analysisResult.devArtifacts.temporaryFiles.length + 
                             analysisResult.devArtifacts.legacyFiles.length;

    return {
      summary: {
        totalFiles: analysisResult.totalFiles,
        usedFiles: usedFilesCount,
        unusedCandidates: unusedCount,
        devArtifacts: devArtifactsCount
      },
      usedFiles,
      unusedCandidates,
      devArtifacts: analysisResult.devArtifacts,
      recommendations
    };
  }

  private getSystemPrompt(): string {
    return `You are an expert TypeScript/JavaScript code analyst specializing in identifying unused files in complex projects with dynamic loading patterns.

Your task is to analyze the programmatic file usage analysis and provide insights about:
1. Confidence levels in unused file detection
2. Potential risks of deleting files
3. Recommendations for cleanup strategies
4. Detection of complex patterns that static analysis might miss

Focus on:
- Plugin systems and dynamic loading
- Configuration-based file references
- Legacy vs modern architecture patterns
- Development artifacts vs production code
- Cross-references and indirect dependencies

Always consider that some files may appear unused but serve important purposes in:
- Plugin architectures
- Configuration systems
- Build processes
- Legacy compatibility
- External tooling`;
  }

  // MODERN: 3-Stage prompt architecture
  getPromptStages(params: any): PromptStages {
    const { analysisResult, context } = params;
    
    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert code architecture analyst specializing in unused file detection.

Analysis Context:
- Project Type: TypeScript/JavaScript project
- Detection Method: Comprehensive dependency traversal with dynamic loading analysis
- Entry Points: ${context.entryPoints.join(', ')}
- Total Files: ${analysisResult.totalFiles}
- Analysis Depth: Advanced pattern recognition

Your task is to provide expert insights on unused file detection results with practical cleanup recommendations.`;

    // STAGE 2: Data payload (analysis results)
    const dataPayload = `Project Analysis Results:
- Project Path: ${context.projectPath}
- Dev Artifacts Detection: ${context.includeDevArtifacts ? 'Enabled' : 'Disabled'}

Analysis Data:
${JSON.stringify(analysisResult, null, 2)}`;

    // STAGE 3: Output instructions
    const outputInstructions = `Provide comprehensive analysis covering:

## 1. Detection Reliability Assessment
- Confidence level of unused file identification
- Potential false positives and reasons
- Dynamic loading patterns that might be missed

## 2. File Classification Analysis
- Definitively unused files (safe to remove)
- Potentially unused files (investigate first)
- Files with unclear usage patterns

## 3. Cleanup Recommendations
- Safe removal candidates with justification
- Files requiring manual investigation
- Backup and testing strategies before deletion

## 4. Risk Assessment
- Potential impact of removing flagged files
- Edge cases and architectural considerations
- Plugin/configuration system implications

## 5. Maintenance Strategy
- Process for ongoing unused file management
- Integration with development workflow
- Automated detection improvements

Focus on practical, actionable guidance that balances code cleanup with system stability.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }

  // MODERN: Direct execution for small operations
  private async executeDirect(stages: PromptStages, model: any): Promise<string> {
    const messages = [
      {
        role: 'system',
        content: stages.systemAndContext
      },
      {
        role: 'user',
        content: stages.dataPayload
      },
      {
        role: 'user',
        content: stages.outputInstructions
      }
    ];

    const prediction = model.respond(messages, {
      temperature: 0.2,
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    return response;
  }

  // MODERN: Chunked execution for large operations
  private async executeWithChunking(stages: PromptStages, model: any, promptManager: ThreeStagePromptManager): Promise<string> {
    const conversation = promptManager.createChunkedConversation(stages);
    
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];

    const prediction = model.respond(messages, {
      temperature: 0.2,
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    return response;
  }

  // LEGACY: Backwards compatibility method

  // LEGACY: Backwards compatibility method
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
}

export default FindUnusedFiles;