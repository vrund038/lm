/**
 * Project Documentation Generator Plugin
 * Generates comprehensive project documentation based on codebase analysis
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
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
    // Validate parameters
    if (!params.projectPath || typeof params.projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }
    
    // Validate and resolve project path using secure path validation
    const projectPath = await validateAndNormalizePath(params.projectPath);
    
    if (!existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }
    
    if (!statSync(projectPath).isDirectory()) {
      throw new Error(`Project path is not a directory: ${projectPath}`);
    }
    
    // Apply parameter defaults
    const docStyle = params.docStyle || 'markdown';
    const includeExamples = params.includeExamples !== false;
    const context = params.context || {};
    const maxDepth = Math.min(Math.max(params.maxDepth || 3, 1), 5);
    const focusAreas = params.focusAreas || ['api', 'architecture', 'setup'];
    
    try {
      // 1. Analyze project structure
      const projectStructure = await this.analyzeProjectStructure(projectPath, maxDepth);
      
      // 2. Identify key files for documentation
      const keyFiles = await this.identifyKeyFiles(projectStructure);
      
      // 3. Extract project metadata
      const projectMetadata = await this.extractProjectMetadata(projectPath, keyFiles);
      
      // Get model for context limit detection
      const models = await llmClient.llm.listLoaded();
      if (models.length === 0) {
        throw new Error('No model loaded in LM Studio. Please load a model first.');
      }
      
      const model = models[0];
      const contextLength = await model.getContextLength() || 23832;
      
      // Early chunking decision: Check if we need to process in chunks
      const estimatedTokens = this.estimateTokenUsage(projectStructure, keyFiles, projectMetadata);
      const systemOverhead = 3000; // System instructions overhead
      const availableTokens = Math.floor(contextLength * 0.8) - systemOverhead;
      
      if (estimatedTokens > availableTokens) {
        // Use chunked processing for large projects
        return await this.executeWithChunking(
          projectPath, projectStructure, keyFiles, projectMetadata,
          { docStyle, includeExamples, context, focusAreas },
          llmClient, model, availableTokens
        );
      }
      
      // Process normally for small projects
      return await this.executeSinglePass(
        projectPath, projectStructure, keyFiles, projectMetadata,
        { docStyle, includeExamples, context, focusAreas },
        llmClient, model
      );
      
    } catch (error) {
      throw new Error(`Failed to generate project documentation: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Execute for small projects that fit in single context window
   */
  private async executeSinglePass(
    projectPath: string,
    projectStructure: ProjectStructure,
    keyFiles: any[],
    projectMetadata: ProjectMetadata,
    options: any,
    llmClient: any,
    model: any
  ): Promise<any> {
    try {
      // Generate 3-stage prompt
      const promptStages = this.getPromptStages({
        projectPath,
        projectStructure,
        keyFiles,
        projectMetadata,
        ...options
      });
      
      // Get context limit for 3-stage manager
      const contextLength = await model.getContextLength();
      const promptManager = new ThreeStagePromptManager(contextLength || 23832);
      
      // Create chunked conversation
      const conversation = promptManager.createChunkedConversation(promptStages);
      
      // Build messages array for LM Studio
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      // Call the model with 3-stage conversation
      const prediction = model.respond(messages, {
        temperature: 0.1,
        maxTokens: 4000
      });
      
      // Stream the response
      let response = '';
      for await (const chunk of prediction) {
        if (chunk.content) {
          response += chunk.content;
        }
      }
      
      // Use ResponseFactory for consistent, spec-compliant output
      ResponseFactory.setStartTime();
      return ResponseFactory.parseAndCreateResponse(
        'generate_project_documentation',
        response,
        model.identifier || 'unknown'
      );
      
    } catch (error: any) {
      return ResponseFactory.createErrorResponse(
        'generate_project_documentation',
        'MODEL_ERROR',
        `Failed to generate project documentation: ${error.message}`,
        { originalError: error.message },
        'unknown'
      );
    }
  }

  /**
   * Execute for large projects using section-based chunking
   */
  private async executeWithChunking(
    projectPath: string,
    projectStructure: ProjectStructure,
    keyFiles: any[],
    projectMetadata: ProjectMetadata,
    options: any,
    llmClient: any,
    model: any,
    availableTokens: number
  ): Promise<any> {
    // Define documentation sections for chunking
    const sections = [
      { name: 'overview', focus: 'project overview and purpose' },
      { name: 'installation', focus: 'installation and setup instructions' },
      { name: 'usage', focus: 'usage guide and examples' },
      { name: 'api', focus: 'API documentation and reference' },
      { name: 'architecture', focus: 'architecture and structure overview' },
      { name: 'development', focus: 'development setup and guidelines' },
      { name: 'contributing', focus: 'contributing guidelines and processes' }
    ];
    
    const sectionResults: any[] = [];
    
    for (const section of sections) {
      try {
        // Skip sections not in focus areas (except overview which is always included)
        if (section.name !== 'overview' && !options.focusAreas.includes(section.name)) {
          continue;
        }
        
        const sectionPrompt = this.getSectionPrompt(section, {
          projectPath,
          projectStructure,
          keyFiles,
          projectMetadata,
          ...options
        });
        
        // Call the model for this section
        const prediction = model.respond([
          {
            role: 'system',
            content: 'You are a technical documentation specialist. Generate clear, comprehensive documentation sections that help developers understand and use projects effectively.'
          },
          {
            role: 'user',
            content: sectionPrompt
          }
        ], {
          temperature: 0.1,
          maxTokens: 2000
        });
        
        let sectionResponse = '';
        for await (const chunk of prediction) {
          if (chunk.content) {
            sectionResponse += chunk.content;
          }
        }
        
        sectionResults.push({
          section: section.name,
          content: sectionResponse,
          success: true
        });
        
      } catch (error) {
        sectionResults.push({
          section: section.name,
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false
        });
      }
    }
    
    // Combine all sections into final documentation
    const combinedDocumentation = this.combineSections(sectionResults, projectMetadata);
    
    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'generate_project_documentation',
      combinedDocumentation,
      model.identifier || 'unknown'
    );
  }

  /**
   * 3-Stage prompt architecture method
   */
  getPromptStages(params: any): PromptStages {
    const { projectPath, projectStructure, keyFiles, projectMetadata, docStyle, includeExamples, context, focusAreas } = params;
    
    // STAGE 1: System instructions and task context
    const systemAndContext = `You are a technical documentation specialist with expertise in creating comprehensive project documentation.

PROJECT ANALYSIS CONTEXT:
- Project: ${projectMetadata.name} (${projectMetadata.type})
- Version: ${projectMetadata.version}
- Languages: ${Object.entries(projectStructure.languages).map(([lang, count]) => `${lang} (${count} files)`).join(', ')}
- Total Files: ${projectStructure.totalFiles}
- Key Files: ${keyFiles.length}
- Documentation Style: ${docStyle}
- Include Examples: ${includeExamples ? 'Yes' : 'No'}
- Focus Areas: ${focusAreas.join(', ')}

DOCUMENTATION REQUIREMENTS:
Generate comprehensive ${docStyle}-formatted documentation that is:
- Clear and accessible to developers
- Technically accurate and up-to-date
- Well-structured with logical flow
- Includes practical examples ${includeExamples ? '' : '(minimal examples)'}
- Adapted for ${projectMetadata.type} projects`;

    // STAGE 2: Data payload (project analysis results)
    let dataPayload = `PROJECT METADATA:
Name: ${projectMetadata.name}
Type: ${projectMetadata.type}
Description: ${projectMetadata.description}
Version: ${projectMetadata.version}
Author: ${projectMetadata.author}
License: ${projectMetadata.license}

KEY FILES FOUND:
${keyFiles.map(f => `- ${f.path} (${f.type})`).join('\n')}

PROJECT STRUCTURE:
Directories: ${projectStructure.directories.slice(0, 10).join(', ')}${projectStructure.directories.length > 10 ? '...' : ''}

LANGUAGE BREAKDOWN:
${Object.entries(projectStructure.languages)
  .sort(([,a], [,b]) => (b as number) - (a as number))
  .map(([lang, count]) => `- ${lang}: ${count} files`)
  .join('\n')}

DEPENDENCIES (if available):
${projectMetadata.dependencies.slice(0, 10).join(', ')}${projectMetadata.dependencies.length > 10 ? '...' : ''}

SCRIPTS (if available):
${Object.entries(projectMetadata.scripts).slice(0, 5).map(([name, cmd]) => `- ${name}: ${cmd}`).join('\n')}`;

    // Add context-specific information if provided
    if (context && Object.keys(context).length > 0) {
      dataPayload += `\n\nADDITIONAL CONTEXT:
${JSON.stringify(context, null, 2)}`;
    }

    // STAGE 3: Output instructions and documentation structure
    const outputInstructions = `GENERATE COMPREHENSIVE PROJECT DOCUMENTATION:

Create complete documentation in ${docStyle} format with the following sections:

## 1. PROJECT OVERVIEW
- Brief description and purpose
- Key features and capabilities  
- Technology stack summary
- Target audience and use cases

## 2. INSTALLATION INSTRUCTIONS
- Prerequisites and system requirements
- Step-by-step installation process
- Environment setup and configuration
- Verification steps

## 3. USAGE GUIDE
- Quick start guide
- Basic usage examples${includeExamples ? '\n- Detailed code demonstrations' : ''}
- Common use cases and patterns
- Configuration options

${focusAreas.includes('api') ? `## 4. API DOCUMENTATION (DETAILED)
- Available functions/methods/endpoints
- Parameters, types, and return values
- Request/response examples
- Error handling and status codes
- Authentication (if applicable)` : '## 4. API REFERENCE\n- Basic API overview\n- Key endpoints or methods'}

${focusAreas.includes('architecture') ? `## 5. ARCHITECTURE OVERVIEW (DETAILED)
- System architecture and design
- Component relationships and dependencies
- Data flow and processing
- Design patterns and principles
- Performance considerations` : '## 5. ARCHITECTURE\n- Basic structure overview\n- Key components'}

## 6. DEVELOPMENT GUIDE
- Development environment setup
- Build processes and scripts
- Testing procedures and frameworks
- Debugging tips and tools
- Code organization principles

${focusAreas.includes('contributing') ? `## 7. CONTRIBUTING GUIDELINES (DETAILED)
- How to contribute to the project
- Code style and standards
- Pull request process
- Issue reporting guidelines
- Development workflow` : '## 7. CONTRIBUTING\n- Basic contribution information'}

## 8. TROUBLESHOOTING
- Common issues and solutions
- Error messages and fixes
- Performance troubleshooting
- FAQ section

## 9. ADDITIONAL RESOURCES
- External documentation links
- Related projects and tools
- Community resources and support
- Changelog and version history

FORMATTING REQUIREMENTS:
- Use proper ${docStyle} formatting
- Include clear headings and subheadings
- Add code blocks with appropriate syntax highlighting
- Use tables for structured information
- Include badges/shields for status indicators (if markdown)
- Ensure good readability and navigation

Generate the complete documentation now:`;

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

    const maxFiles = 1000; // Prevent overwhelming analysis
    
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
            // Validate path before operations
            await validateAndNormalizePath(fullPath);
            
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

  private async identifyKeyFiles(structure: ProjectStructure) {
    const keyFilePatterns = [
      'package.json', 'composer.json', 'requirements.txt', 'Cargo.toml',
      'README.md', 'README.rst', 'README.txt',
      'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
      'config.js', 'config.ts', 'webpack.config.js', 'vite.config.ts',
      'tsconfig.json', 'babel.config.js', '.env.example',
      'docker-compose.yml', 'Dockerfile', 'Makefile',
      'setup.py', '__init__.py',
      'plugin.php', 'functions.php', 'style.css'
    ];

    return structure.files.filter(file => 
      keyFilePatterns.some(pattern => 
        file.relativePath.toLowerCase().includes(pattern.toLowerCase()) ||
        file.relativePath.toLowerCase().endsWith(pattern.toLowerCase())
      )
    );
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
    if (packageJsonFile) {
      try {
        const content = await readFileContent(packageJsonFile.path);
        const packageJson = JSON.parse(content);
        
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
        else if (packageJson.name?.includes('mcp')) metadata.type = 'mcp-server';
        else metadata.type = 'node-project';
        
      } catch (error) {
        // Continue with defaults if package.json can't be parsed
      }
    }

    // Try to extract from composer.json (PHP)
    const composerJsonFile = keyFiles.find(f => f.relativePath.includes('composer.json'));
    if (composerJsonFile) {
      try {
        const content = await readFileContent(composerJsonFile.path);
        const composerJson = JSON.parse(content);
        
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

  private estimateTokenUsage(structure: ProjectStructure, keyFiles: any[], metadata: ProjectMetadata): number {
    // Rough estimation based on content size
    const baseTokens = 2000; // System instructions
    const structureTokens = structure.totalFiles * 10; // File listings
    const keyFileTokens = keyFiles.length * 50; // Key file analysis
    const metadataTokens = JSON.stringify(metadata).length / 4; // Metadata content
    
    return baseTokens + structureTokens + keyFileTokens + metadataTokens;
  }

  private getSectionPrompt(section: any, params: any): string {
    const { projectMetadata, docStyle } = params;
    
    return `Generate the ${section.name} section for project documentation.

Project: ${projectMetadata.name} (${projectMetadata.type})
Focus: ${section.focus}
Format: ${docStyle}

Create a comprehensive ${section.name} section that covers all relevant aspects for this type of project.
Use clear headings, practical examples, and appropriate formatting.

Generate the ${section.name} section now:`;
  }

  private combineSections(sectionResults: any[], metadata: ProjectMetadata): string {
    let combinedDoc = `# ${metadata.name}\n\n`;
    
    if (metadata.description) {
      combinedDoc += `${metadata.description}\n\n`;
    }
    
    const successfulSections = sectionResults.filter(r => r.success);
    
    for (const section of successfulSections) {
      combinedDoc += section.content + '\n\n';
    }
    
    // Add footer with generation info
    combinedDoc += `---\n\n*Documentation generated on ${new Date().toISOString()}*\n`;
    
    return combinedDoc;
  }

  /**
   * Get prompt for BasePlugin interface compatibility
   */
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
}

export default ProjectDocumentationGenerator;