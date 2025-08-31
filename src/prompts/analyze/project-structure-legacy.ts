/**
 * Project Structure Analyzer Plugin
 * Analyzes complete project structure and architecture
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { resolve, join, extname, relative, basename } from 'path';
import { validateAndNormalizePath } from '../shared/helpers.js';
import { withSecurity } from '../../security/integration-helpers.js';

interface ProjectStructure {
  directories: Map<string, DirectoryInfo>;
  files: Map<string, FileInfo>;
  statistics: ProjectStatistics;
}

interface DirectoryInfo {
  path: string;
  fileCount: number;
  subdirCount: number;
  depth: number;
}

interface FileInfo {
  path: string;
  extension: string;
  size: number;
  lines?: number;
}

interface ProjectStatistics {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  totalLines: number;
  filesByExtension: Map<string, number>;
  largestFiles: FileInfo[];
  deepestPath: string;
  maxDepth: number;
}

export class ProjectStructureAnalyzer extends BasePlugin implements IPromptPlugin {
  name = 'analyze_project_structure';
  category = 'analyze' as const;
  description = 'Analyze complete project structure and architecture. Returns comprehensive architecture analysis.';
  
  parameters = {
    projectPath: {
      type: 'string' as const,
      description: 'Absolute path to project root',
      required: true
    },
    focusAreas: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Areas to focus on: architecture, dependencies, complexity, patterns',
      default: [],
      required: false
    },
    maxDepth: {
      type: 'number' as const,
      default: 3,
      description: 'Maximum directory depth to analyze',
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      // Validate project path
      if (!secureParams.projectPath || typeof secureParams.projectPath !== 'string') {
        throw new Error('projectPath is required and must be a string');
      }
      
      // Validate and resolve project path using secure path validation
      const projectPath = await validateAndNormalizePath(secureParams.projectPath);
      
      if (!existsSync(projectPath)) {
        throw new Error(`Project path does not exist: ${projectPath}`);
      }
      
      if (!statSync(projectPath).isDirectory()) {
        throw new Error(`Project path is not a directory: ${projectPath}`);
      }
      
      // Parse parameters
      const focusAreas = secureParams.focusAreas || [];
      const maxDepth = Math.min(Math.max(secureParams.maxDepth || 3, 1), 10);
      
      // Analyze project structure
      const structure = await this.analyzeProjectStructure(projectPath, maxDepth);
      
      // Read key configuration files
      const configFiles = await this.readConfigurationFiles(projectPath);
      
      // Sample code files for pattern analysis
      const codeSamples = await this.sampleCodeFiles(projectPath, structure);
      
      try {
        // Get the loaded model from LM Studio
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        // Use the first loaded model
        const model = models[0];
        const contextLength = await model.getContextLength() || 23832;
        
        // Generate 3-stage prompt
        const promptStages = this.getPromptStages({
          projectPath,
          structure,
          configFiles,
          codeSamples,
          focusAreas,
          maxDepth
        });
        
        // Check if chunking is needed
        const promptManager = new ThreeStagePromptManager(contextLength);
        const needsChunking = promptManager.needsChunking(promptStages);
        
        if (needsChunking) {
          return await this.executeWithChunking(promptStages, llmClient, model, promptManager);
        } else {
          return await this.executeDirect(promptStages, llmClient, model);
        }
        
      } catch (error: any) {
        return ResponseFactory.createErrorResponse(
          'analyze_project_structure',
          'MODEL_ERROR',
          `Failed to analyze project structure: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  getPromptStages(params: any): PromptStages {
    const { projectPath, structure, configFiles, codeSamples, focusAreas, maxDepth } = params;
    
    // STAGE 1: System instructions and context
    const systemAndContext = `You are a senior software architect with expertise in project analysis, code organization, and architectural patterns.

Analysis Context:
- Project: ${basename(projectPath)}
- Focus Areas: ${focusAreas.length > 0 ? focusAreas.join(', ') : 'comprehensive analysis'}
- Analysis Depth: ${maxDepth} directory levels
- Total Files: ${structure.statistics.totalFiles}
- Total Directories: ${structure.statistics.totalDirectories}

Your task is to provide comprehensive architecture analysis covering patterns, organization, dependencies, code quality, and actionable recommendations.`;

    // STAGE 2: Data payload (the project data to analyze)
    const dataPayload = `PROJECT STATISTICS:
- Total Files: ${structure.statistics.totalFiles}
- Total Directories: ${structure.statistics.totalDirectories}
- Maximum Depth: ${structure.statistics.maxDepth}
- Total Size: ${(structure.statistics.totalSize / 1024 / 1024).toFixed(2)} MB
- Total Lines of Code: ${structure.statistics.totalLines}

FILE DISTRIBUTION:
${Array.from(structure.statistics.filesByExtension.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([ext, count]) => `- ${ext}: ${count} files`)
  .join('\n')}

DIRECTORY STRUCTURE (depth ${maxDepth}):
${this.formatStructureOverview(structure)}

CONFIGURATION FILES:
${this.formatConfigFiles(configFiles)}

CODE SAMPLES:
${this.formatCodeSamples(codeSamples)}`;

    // STAGE 3: Output instructions
    const outputInstructions = `Perform comprehensive analysis and provide your response in the following structured format:

## Executive Summary
Brief overview of the project and key findings

## Architecture Analysis
### Pattern Identification
- Primary pattern: [pattern]
- Implementation quality: [score/10]
- Key observations: [list]

### Structure Assessment
- Organization: [well-structured/moderate/needs improvement]
- Key strengths: [list]
- Issues found: [list]

## Technology Stack
### Languages
- [List with percentages]

### Frameworks & Libraries
- [Categorized list]

### Tools & Infrastructure
- Build: [tools]
- Testing: [tools]
- Deployment: [tools]

## Code Quality Indicators
### Positive Patterns
- [List observed good practices]

### Issues & Anti-patterns
- [List problems with severity]

### Complexity Assessment
- Overall complexity: [low/medium/high]
- Hotspots: [areas of high complexity]

## Dependency Analysis
### Key Dependencies
- [List critical dependencies]

### Risks
- [Security, outdated, or problematic dependencies]

## Recommendations
### Critical (Address Immediately)
1. [High priority items]

### Important (Address Soon)
1. [Medium priority items]

### Suggested Improvements
1. [Nice to have items]

## Refactoring Opportunities
- [List specific refactoring suggestions]

## Best Practices Alignment
Score: [X/10]
- [List alignment with industry best practices]

## Conclusion
Summary and recommended next steps

Provide actionable insights and specific recommendations for improving the project structure and architecture.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }

  // MODERN: Direct execution for manageable projects
  private async executeDirect(stages: PromptStages, llmClient: any, model: any) {
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
      maxTokens: 5000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'analyze_project_structure',
      response,
      model.identifier || 'unknown'
    );
  }

  // MODERN: Chunked execution for large projects
  private async executeWithChunking(stages: PromptStages, llmClient: any, model: any, promptManager: ThreeStagePromptManager) {
    const conversation = promptManager.createChunkedConversation(stages);
    
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];

    const prediction = model.respond(messages, {
      temperature: 0.2,
      maxTokens: 5000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'analyze_project_structure',
      response,
      model.identifier || 'unknown'
    );
  }

  // LEGACY: Backwards compatibility method
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
  
  private async analyzeProjectStructure(projectPath: string, maxDepth: number): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      directories: new Map(),
      files: new Map(),
      statistics: {
        totalFiles: 0,
        totalDirectories: 0,
        totalSize: 0,
        totalLines: 0,
        filesByExtension: new Map(),
        largestFiles: [],
        deepestPath: '',
        maxDepth: 0
      }
    };
    
    await this.traverseDirectory(projectPath, structure, 0, maxDepth, projectPath);
    
    // Sort largest files
    structure.statistics.largestFiles = Array.from(structure.files.values())
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    
    return structure;
  }
  
  private async traverseDirectory(
    dir: string,
    structure: ProjectStructure,
    currentDepth: number,
    maxDepth: number,
    projectRoot: string
  ): Promise<void> {
    if (currentDepth > maxDepth) return;
    
    const relativePath = relative(projectRoot, dir);
    structure.directories.set(relativePath || '.', {
      path: relativePath || '.',
      fileCount: 0,
      subdirCount: 0,
      depth: currentDepth
    });
    
    structure.statistics.totalDirectories++;
    structure.statistics.maxDepth = Math.max(structure.statistics.maxDepth, currentDepth);
    
    if (currentDepth > structure.statistics.maxDepth) {
      structure.statistics.deepestPath = relativePath;
    }
    
    try {
      const entries = readdirSync(dir);
      let fileCount = 0;
      let subdirCount = 0;
      
      for (const entry of entries) {
        // Skip common non-project directories
        if (['node_modules', '.git', 'vendor', 'dist', 'build', '.next', '__pycache__'].includes(entry)) {
          continue;
        }
        
        const fullPath = join(dir, entry);
        
        try {
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            subdirCount++;
            await this.traverseDirectory(fullPath, structure, currentDepth + 1, maxDepth, projectRoot);
          } else if (stat.isFile()) {
            fileCount++;
            const ext = extname(entry).toLowerCase() || 'no-ext';
            const relativeFilePath = relative(projectRoot, fullPath);
            
            // Count lines for text files
            let lines = 0;
            if (this.isTextFile(ext)) {
              try {
                // SECURITY: Use secure file reading helper
                const { readFileContent } = await import('../shared/helpers.js');
                const content = await readFileContent(fullPath);
                lines = content.split('\n').length;
                structure.statistics.totalLines += lines;
              } catch {
                // Skip files we can't read
              }
            }
            
            structure.files.set(relativeFilePath, {
              path: relativeFilePath,
              extension: ext,
              size: stat.size,
              lines
            });
            
            structure.statistics.totalFiles++;
            structure.statistics.totalSize += stat.size;
            
            // Track extensions
            const extCount = structure.statistics.filesByExtension.get(ext) || 0;
            structure.statistics.filesByExtension.set(ext, extCount + 1);
          }
        } catch {
          // Skip entries we can't stat
        }
      }
      
      // Update directory info
      const dirInfo = structure.directories.get(relativePath || '.');
      if (dirInfo) {
        dirInfo.fileCount = fileCount;
        dirInfo.subdirCount = subdirCount;
      }
    } catch {
      // Skip directories we can't read
    }
  }
  
  private async readConfigurationFiles(projectPath: string): Promise<Map<string, string>> {
    const configs = new Map<string, string>();
    const configFiles = [
      'package.json',
      'composer.json',
      'pom.xml',
      'build.gradle',
      'requirements.txt',
      'Gemfile',
      'Cargo.toml',
      '.env.example',
      'docker-compose.yml',
      'Dockerfile',
      '.gitignore',
      'README.md',
      'tsconfig.json',
      'webpack.config.js',
      '.eslintrc.json',
      '.prettierrc'
    ];
    
    for (const configFile of configFiles) {
      const configPath = join(projectPath, configFile);
      if (existsSync(configPath)) {
        try {
          // SECURITY: Use secure file reading helper
          const { readFileContent } = await import('../shared/helpers.js');
          const content = await readFileContent(configPath);
          // Truncate large files
          const maxLength = 1000;
          if (content.length > maxLength) {
            configs.set(configFile, content.substring(0, maxLength) + '\n... (truncated)');
          } else {
            configs.set(configFile, content);
          }
        } catch {
          // Skip files we can't read
        }
      }
    }
    
    return configs;
  }
  
  private async sampleCodeFiles(projectPath: string, structure: ProjectStructure): Promise<Map<string, string>> {
    const samples = new Map<string, string>();
    const maxSamples = 5;
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.php', '.rb', '.go'];
    
    // Get a sample of code files
    const codeFiles = Array.from(structure.files.values())
      .filter(file => codeExtensions.includes(file.extension))
      .sort((a, b) => (b.lines || 0) - (a.lines || 0)) // Sort by size
      .slice(0, maxSamples);
    
    for (const file of codeFiles) {
      const fullPath = join(projectPath, file.path);
      try {
        // SECURITY: Use secure file reading helper
        const { readFileContent } = await import('../shared/helpers.js');
        const content = await readFileContent(fullPath);
        // Take first 50 lines as sample
        const lines = content.split('\n').slice(0, 50);
        samples.set(file.path, lines.join('\n') + (lines.length === 50 ? '\n... (truncated)' : ''));
      } catch {
        // Skip files we can't read
      }
    }
    
    return samples;
  }
  
  private formatStructureOverview(structure: ProjectStructure): string {
    const tree: string[] = [];
    const directories = Array.from(structure.directories.values())
      .sort((a, b) => {
        if (a.depth !== b.depth) return a.depth - b.depth;
        return a.path.localeCompare(b.path);
      });
    
    for (const dir of directories) {
      const indent = '  '.repeat(dir.depth);
      const name = dir.path === '.' ? '.' : basename(dir.path);
      const info = `(${dir.fileCount} files, ${dir.subdirCount} dirs)`;
      tree.push(`${indent}${name}/ ${info}`);
    }
    
    return tree.slice(0, 50).join('\n') + (tree.length > 50 ? '\n... (truncated)' : '');
  }
  
  private formatConfigFiles(configs: Map<string, string>): string {
    if (configs.size === 0) {
      return 'No standard configuration files found.';
    }
    
    const formatted: string[] = [];
    for (const [file, content] of configs.entries()) {
      formatted.push(`\n--- ${file} ---\n${content}`);
    }
    
    return formatted.join('\n');
  }
  
  private formatCodeSamples(samples: Map<string, string>): string {
    if (samples.size === 0) {
      return 'No code files sampled.';
    }
    
    const formatted: string[] = [];
    for (const [file, content] of samples.entries()) {
      formatted.push(`\n--- ${file} ---\n${content}`);
    }
    
    return formatted.join('\n');
  }
  
  private isTextFile(extension: string): boolean {
    const textExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt',
      '.py', '.java', '.cs', '.php', '.rb', '.go', '.rs',
      '.html', '.css', '.scss', '.sass', '.less',
      '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf',
      '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat',
      '.c', '.cpp', '.h', '.hpp', '.swift', '.kt', '.scala',
      '.r', '.m', '.sql', '.graphql', '.vue', '.svelte'
    ];
    
    return textExtensions.includes(extension);
  }
  
  private isPathSafe(path: string): boolean {
    const suspicious = ['../', '..\\', '/etc/', '\\etc\\', '/root/', '\\root\\'];
    const normalizedPath = path.toLowerCase();
    
    return !suspicious.some(pattern => normalizedPath.includes(pattern));
  }
}

export default ProjectStructureAnalyzer;
