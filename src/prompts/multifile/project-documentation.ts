/**
 * Project Documentation Generator Plugin
 * Generates comprehensive project documentation based on codebase analysis
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { existsSync, statSync } from 'fs';
import { resolve, join, extname, relative } from 'path';
import { readFileContent, validateAndNormalizePath } from '../shared/helpers.js';

interface ProjectStructure {
  directories: string[];
  files: Array<{ path: string; type: string; size: number; relativePath: string }>;
  totalFiles: number;
  languages: Record<string, number>;
}

interface ProjectMetadata {
  name: string;
  type: string;
  description: string;
  version: string;
  dependencies: string[];
  scripts: Record<string, string>;
  author: string;
  license: string;
}

export class ProjectDocumentationGenerator extends BasePlugin implements IPromptPlugin {
  name = 'generate_project_documentation';
  category = 'multifile' as const;
  description = 'Generate comprehensive project documentation based on codebase analysis';
  
  parameters = {
    projectPath: {
      type: 'string' as const,
      description: 'Absolute path to project root directory',
      required: true
    },
    docStyle: {
      type: 'string' as const,
      description: 'Documentation style to use',
      enum: ['markdown', 'jsdoc', 'typedoc', 'sphinx'],
      default: 'markdown',
      required: false
    },
    includeExamples: {
      type: 'boolean' as const,
      description: 'Include usage examples in documentation',
      default: true,
      required: false
    },
    context: {
      type: 'object' as const,
      description: 'Additional context for documentation generation',
      required: false
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth to analyze (1-5)',
      default: 3,
      required: false
    },
    focusAreas: {
      type: 'array' as const,
      description: 'Areas to focus on: api, architecture, setup, contributing',
      default: ['api', 'architecture', 'setup'],
      required: false
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // Validate parameters
        this.validateSecureParams(secureParams);
        
        // Path already validated by withSecurity
        const projectPath = secureParams.projectPath;
        
        if (!existsSync(projectPath)) {
          throw new Error(`Project path does not exist: ${projectPath}`);
        }
        
        if (!statSync(projectPath).isDirectory()) {
          throw new Error(`Project path is not a directory: ${projectPath}`);
        }
        
        // Apply parameter defaults
        const maxDepth = Math.min(Math.max(secureParams.maxDepth || 3, 1), 5);
        
        // Analyze project structure and metadata
        const projectStructure = await this.analyzeProjectStructure(projectPath, maxDepth);
        const keyFiles = await this.identifyKeyFiles(projectStructure);
        const projectMetadata = await this.extractProjectMetadata(projectPath, keyFiles);
        
        // Get model for context limit detection
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        const model = models[0];
        const contextLength = await model.getContextLength() || 23832;
        
        // Generate 3-stage prompt
        const promptStages = this.getPromptStages({
          ...secureParams,
          projectStructure,
          keyFiles,
          projectMetadata
        });
        
        // Determine if chunking is needed
        const promptManager = new ThreeStagePromptManager(contextLength);
        const needsChunking = promptManager.needsChunking(promptStages);
        
        if (needsChunking) {
          return await this.executeWithChunking(promptStages, llmClient, model, promptManager);
        } else {
          return await this.executeDirect(promptStages, llmClient, model);
        }
        
      } catch (error: any) {
        return ResponseFactory.createErrorResponse(
          'generate_project_documentation',
          'EXECUTION_ERROR',
          `Failed to generate project documentation: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  // MODERN PATTERN: Direct execution for manageable operations
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
      temperature: 0.3,
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'generate_project_documentation',
      response,
      model.identifier || 'unknown'
    );
  }

  // MODERN PATTERN: Chunked execution for large operations
  private async executeWithChunking(stages: PromptStages, llmClient: any, model: any, promptManager: ThreeStagePromptManager) {
    const conversation = promptManager.createChunkedConversation(stages);
    
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];

    const prediction = model.respond(messages, {
      temperature: 0.3,
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'generate_project_documentation',
      response,
      model.identifier || 'unknown'
    );
  }

  // MODERN PATTERN: Secure parameter validation
  private validateSecureParams(params: any): void {
    if (!params.projectPath || typeof params.projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }
  }

  getPromptStages(params: any): PromptStages {
    const { 
      projectPath, 
      projectStructure, 
      keyFiles,
      projectMetadata, 
      docStyle = 'markdown', 
      includeExamples = true,
      focusAreas = ['api', 'architecture', 'setup'],
      context = {}
    } = params;
    
    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert technical writer generating comprehensive project documentation.

Project Documentation Context:
- Project: ${projectMetadata.name} (${projectMetadata.type})
- Version: ${projectMetadata.version}
- Documentation Style: ${docStyle}
- Include Examples: ${includeExamples}
- Focus Areas: ${focusAreas.join(', ')}
- Total Files: ${projectStructure.totalFiles}
- Languages: ${Object.keys(projectStructure.languages).join(', ')}

Documentation Goals:
- Create clear, comprehensive documentation
- Include practical examples and usage
- Cover setup, API, and architecture
- Follow ${docStyle} formatting standards
- Make it accessible to developers of all levels`;

    // STAGE 2: Project analysis data
    let dataPayload = '=== PROJECT METADATA ===\n';
    dataPayload += JSON.stringify(projectMetadata, null, 2) + '\n\n';
    
    dataPayload += '=== PROJECT STRUCTURE ===\n';
    dataPayload += `Total Files: ${projectStructure.totalFiles}\n`;
    dataPayload += `Languages: ${Object.entries(projectStructure.languages)
      .map(([lang, count]) => `${lang} (${count} files)`)
      .join(', ')}\n`;
    dataPayload += `Key Directories: ${projectStructure.directories.slice(0, 10).join(', ')}\n\n`;
    
    // Key files content
    if (keyFiles && keyFiles.length > 0) {
      dataPayload += '=== KEY FILES ANALYSIS ===\n';
      keyFiles.forEach((file: any) => {
        dataPayload += `File: ${file.relativePath}\n`;
        dataPayload += `Type: ${file.type}\n`;
        dataPayload += `Size: ${Math.round(file.size / 1024)}KB\n`;
        if (file.content && file.content !== '[File too large to analyze]') {
          const content = file.content.length > 1000 ? 
            file.content.substring(0, 1000) + '...[truncated]' : 
            file.content;
          dataPayload += `Content:\n${content}\n`;
        }
        dataPayload += '-'.repeat(50) + '\n';
      });
    }
    
    if (context && Object.keys(context).length > 0) {
      dataPayload += '\n=== ADDITIONAL CONTEXT ===\n';
      dataPayload += JSON.stringify(context, null, 2);
    }

    // STAGE 3: Documentation generation instructions
    const outputInstructions = `Generate comprehensive ${docStyle} documentation for this project.

## Required Documentation Sections:

### 1. Project Overview
- Project name and brief description
- Key features and benefits
- Target audience and use cases
- Technology stack overview

### 2. Installation & Setup
- Prerequisites and system requirements
- Step-by-step installation instructions
- Environment configuration
- Quick start guide with examples

### 3. Project Structure
- Directory structure explanation
- Key files and their purposes
- Module organization
- Configuration files

### 4. API Documentation
- Main functions, classes, and methods
- Parameters, return values, and types
- Usage examples for key functionality
- Error handling and exceptions

### 5. Usage Examples
${includeExamples ? 
  '- Practical code examples with explanations\n- Common use cases and workflows\n- Best practices and recommendations\n- Sample configurations and setups' : 
  '- Basic usage patterns\n- Core concepts and principles\n- Integration guidelines'}

### 6. Development Guide
- Setting up development environment
- Testing procedures and frameworks
- Contributing guidelines
- Code style and conventions
- Build and deployment processes

### 7. Troubleshooting
- Common issues and solutions
- Error messages and fixes
- Performance considerations
- FAQ section

### 8. Additional Resources
- External documentation links
- Related projects and tools
- Community resources and support

## Output Requirements:
- Use proper ${docStyle} formatting
- Include syntax-highlighted code blocks
- Create clear section hierarchies
- Add table of contents if appropriate
- Make content scannable with headers, lists, and code examples
- Ensure examples are practical and runnable`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }

  private async analyzeProjectStructure(projectPath: string, maxDepth: number): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      directories: [],
      files: [],
      totalFiles: 0,
      languages: {}
    };

    const maxFiles = 500; // Prevent overwhelming analysis
    
    const analyzeDirectory = async (dirPath: string, currentDepth: number) => {
      if (currentDepth > maxDepth || structure.totalFiles >= maxFiles) return;
      
      try {
        const fs = await import('fs/promises');
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (structure.totalFiles >= maxFiles) break;
          
          const fullPath = join(dirPath, entry.name);
          const relativePath = relative(projectPath, fullPath);
          
          // Skip common ignore patterns
          if (this.shouldIgnore(entry.name, relativePath)) continue;
          
          try {
            if (entry.isDirectory()) {
              structure.directories.push(relativePath);
              await analyzeDirectory(fullPath, currentDepth + 1);
            } else if (entry.isFile()) {
              const stats = statSync(fullPath);
              const ext = extname(entry.name);
              const language = this.getLanguageFromExtension(ext);
              
              structure.files.push({
                path: fullPath,
                relativePath,
                type: language,
                size: stats.size
              });
              
              structure.totalFiles++;
              structure.languages[language] = (structure.languages[language] || 0) + 1;
            }
          } catch (error) {
            // Skip files/directories we can't access
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await analyzeDirectory(projectPath, 0);
    return structure;
  }

  private shouldIgnore(name: string, relativePath: string): boolean {
    const ignorePatterns = [
      'node_modules', '.git', '.vscode', 'dist', 'build', 'coverage',
      '__pycache__', '.pytest_cache', 'vendor', '.idea', '.DS_Store',
      'tmp', 'temp', 'logs', '.next', 'out', 'target'
    ];
    
    return ignorePatterns.some(pattern => 
      name.includes(pattern) || relativePath.includes(pattern)
    );
  }

  private getLanguageFromExtension(ext: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'react',
      '.tsx': 'react-typescript',
      '.py': 'python',
      '.php': 'php',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.vue': 'vue',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.sql': 'sql'
    };
    
    return languageMap[ext.toLowerCase()] || 'other';
  }

  private async identifyKeyFiles(structure: ProjectStructure): Promise<any[]> {
    const keyFilePatterns = [
      'package.json', 'composer.json', 'requirements.txt', 'Cargo.toml',
      'README.md', 'README.rst', 'README.txt',
      'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
      'config.js', 'config.ts', 'webpack.config.js', 'vite.config.ts',
      'tsconfig.json', 'babel.config.js', '.env.example',
      'docker-compose.yml', 'Dockerfile', 'Makefile'
    ];

    const keyFiles = structure.files.filter(file => 
      keyFilePatterns.some(pattern => 
        file.relativePath.toLowerCase().includes(pattern.toLowerCase())
      )
    ).slice(0, 15); // Limit key files

    // Read content for small key files
    const keyFilesWithContent = await Promise.all(
      keyFiles.map(async (file) => {
        try {
          if (file.size > 10000) { // Skip large files
            return { ...file, content: '[File too large to analyze]' };
          }
          
          const content = await readFileContent(file.path);
          return { ...file, content };
        } catch (error) {
          return { ...file, content: '[Could not read file]' };
        }
      })
    );
    
    return keyFilesWithContent;
  }

  private async extractProjectMetadata(projectPath: string, keyFiles: any[]): Promise<ProjectMetadata> {
    const path = await import('path');
    const metadata: ProjectMetadata = {
      name: path.basename(projectPath),
      type: 'generic',
      description: '',
      version: '',
      dependencies: [],
      scripts: {},
      author: '',
      license: ''
    };

    // Try to extract from package.json
    const packageJsonFile = keyFiles.find(f => f.relativePath.includes('package.json'));
    if (packageJsonFile && packageJsonFile.content && packageJsonFile.content !== '[File too large to analyze]') {
      try {
        const packageJson = JSON.parse(packageJsonFile.content);
        
        metadata.name = packageJson.name || metadata.name;
        metadata.description = packageJson.description || '';
        metadata.version = packageJson.version || '';
        metadata.author = packageJson.author || '';
        metadata.license = packageJson.license || '';
        metadata.scripts = packageJson.scripts || {};
        metadata.dependencies = Object.keys(packageJson.dependencies || {});
        
        // Detect project type from dependencies
        if (packageJson.dependencies?.react) metadata.type = 'react-app';
        else if (packageJson.dependencies?.vue) metadata.type = 'vue-app';
        else if (packageJson.dependencies?.express) metadata.type = 'node-api';
        else if (packageJson.dependencies?.next) metadata.type = 'nextjs-app';
        else metadata.type = 'node-project';
        
      } catch (error) {
        // Continue with defaults if package.json can't be parsed
      }
    }

    // Try to extract from composer.json (PHP)
    const composerJsonFile = keyFiles.find(f => f.relativePath.includes('composer.json'));
    if (composerJsonFile && composerJsonFile.content && composerJsonFile.content !== '[File too large to analyze]') {
      try {
        const composerJson = JSON.parse(composerJsonFile.content);
        
        metadata.name = composerJson.name || metadata.name;
        metadata.description = composerJson.description || metadata.description;
        metadata.version = composerJson.version || '';
        metadata.type = 'php-project';
        
        // Check for WordPress plugin
        if (keyFiles.some(f => f.relativePath.includes('plugin.php'))) {
          metadata.type = 'wordpress-plugin';
        }
        
      } catch (error) {
        // Continue with defaults
      }
    }

    return metadata;
  }

}

export default ProjectDocumentationGenerator;
