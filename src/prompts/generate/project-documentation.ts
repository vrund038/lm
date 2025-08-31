/**
 * Plugin Template - Modern v4.2 (Single Source of Truth)
 * 
 * Universal template that intelligently handles both single-file and multi-file analysis
 * Automatically detects analysis type based on provided parameters
 * 
 * Copy this template for creating any new plugin - it adapts to your needs
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { readFileContent } from '../shared/helpers.js';
import { 
  ModelSetup, 
  ResponseProcessor, 
  ParameterValidator, 
  ErrorHandler,
  MultiFileAnalysis
} from '../../utils/plugin-utilities.js';
import { getAnalysisCache } from '../../cache/index.js';

export class ProjectDocumentationGenerator extends BasePlugin implements IPromptPlugin {
  name = 'generate_project_documentation';
  category = 'generate' as const;
  description = 'Generate comprehensive project documentation based on codebase analysis with intelligent file discovery and structured output';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'The code to analyze (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single file to analyze',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Absolute path to project root directory',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific file paths (for multi-file analysis)',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for discovery (1-5)',
      required: false,
      default: 3
    },
    
    // Universal parameters
    language: {
      type: 'string' as const,
      description: 'Programming language',
      required: false,
      default: 'javascript'
    },
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of analysis detail',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of analysis to perform',
      enum: ['api', 'architecture', 'comprehensive'],
      default: 'comprehensive',
      required: false
    },
    
    // Documentation-specific parameters
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
    focusAreas: {
      type: 'array' as const,
      description: 'Areas to focus on: api, architecture, setup, contributing',
      default: ['api', 'architecture', 'setup'],
      required: false,
      items: { type: 'string' as const }
    }
  };

  private analysisCache = getAnalysisCache();
  private multiFileAnalysis = new MultiFileAnalysis();

  constructor() {
    super();
    // Cache and analysis utilities are initialized above
  }

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // 1. Auto-detect analysis mode based on parameters
        const analysisMode = this.detectAnalysisMode(secureParams);
        
        // 2. Validate parameters based on detected mode
        this.validateParameters(secureParams, analysisMode);
        
        // 3. Setup model
        const { model, contextLength } = await ModelSetup.getReadyModel(llmClient);
        
        // 4. Route to appropriate analysis method
        if (analysisMode === 'single-file') {
          return await this.executeSingleFileAnalysis(secureParams, model, contextLength);
        } else {
          return await this.executeMultiFileAnalysis(secureParams, model, contextLength);
        }
        
      } catch (error: any) {
        return ErrorHandler.createExecutionError('generate_project_documentation', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Multi-file indicators
    if (params.projectPath || params.files || params.maxDepth !== undefined) {
      return 'multi-file';
    }
    
    // Single-file indicators  
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Default to multi-file for project documentation
    return 'multi-file';
  }

  /**
   * Validate parameters based on detected analysis mode
   */
  private validateParameters(params: any, mode: 'single-file' | 'multi-file'): void {
    if (mode === 'single-file') {
      ParameterValidator.validateCodeOrFile(params);
    } else {
      ParameterValidator.validateProjectPath(params);
      ParameterValidator.validateDepth(params);
    }
    
    // Universal validations
    ParameterValidator.validateEnum(params, 'analysisType', ['api', 'architecture', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'analysisDepth', ['basic', 'detailed', 'comprehensive']);
    ParameterValidator.validateEnum(params, 'docStyle', ['markdown', 'jsdoc', 'typedoc', 'sphinx']);
  }

  /**
   * Execute single-file analysis
   */
  private async executeSingleFileAnalysis(params: any, model: any, contextLength: number) {
    // Process single file input
    let codeToAnalyze = params.code;
    if (params.filePath) {
      codeToAnalyze = await readFileContent(params.filePath);
    }
    
    // Generate prompt stages for single file
    const promptStages = this.getSingleFilePromptStages({
      ...params,
      code: codeToAnalyze
    });
    
    // Execute with appropriate method
    const promptManager = new ThreeStagePromptManager(contextLength);
    const needsChunking = promptManager.needsChunking(promptStages);
    
    if (needsChunking) {
      const conversation = promptManager.createChunkedConversation(promptStages);
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      return await ResponseProcessor.executeChunked(
        messages,
        model,
        contextLength,
        'generate_project_documentation',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'generate_project_documentation'
      );
    }
  }

  /**
   * Execute multi-file analysis
   */
  private async executeMultiFileAnalysis(params: any, model: any, contextLength: number) {
    // Discover files
    let filesToAnalyze: string[] = params.files || 
      await this.discoverRelevantFiles(
        params.projectPath, 
        params.maxDepth,
        params.analysisType
      );
    
    // Perform multi-file analysis with caching
    const analysisResult = await this.performMultiFileAnalysis(
      filesToAnalyze,
      params,
      model,
      contextLength
    );
    
    // Generate prompt stages for multi-file
    const promptStages = this.getMultiFilePromptStages({
      ...params,
      analysisResult,
      fileCount: filesToAnalyze.length
    });
    
    // Always use chunking for multi-file
    const promptManager = new ThreeStagePromptManager(contextLength);
    const conversation = promptManager.createChunkedConversation(promptStages);
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];
    
    return await ResponseProcessor.executeChunked(
      messages,
      model,
      contextLength,
      'generate_project_documentation',
      'multifile'
    );
  }

  /**
   * Implement single-file documentation generation
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, analysisDepth, analysisType, docStyle, includeExamples, focusAreas } = params;
    
    const systemAndContext = `You are an expert technical writer and documentation specialist with 15+ years of experience creating developer-focused documentation.

**YOUR EXPERTISE:**
- Technical writing for software projects
- API documentation and developer experience
- Code analysis and architectural documentation
- Best practices for ${docStyle} documentation
- Creating clear, actionable content for developers

Analysis Context:
- Language: ${language}
- Analysis Depth: ${analysisDepth}
- Analysis Type: ${analysisType}
- Documentation Style: ${docStyle}
- Include Examples: ${includeExamples}
- Focus Areas: ${focusAreas.join(', ')}
- Mode: Single File Documentation

**DOCUMENTATION PHILOSOPHY:**
Your documentation should be a developer's best friend - clear, practical, and immediately useful. Think of it as mentoring a fellow developer who needs to understand and use this code effectively.

**KEY PRINCIPLES:**
1. Lead with practical value - what can the developer accomplish?
2. Explain the "why" behind architectural decisions
3. Provide runnable examples that actually work
4. Anticipate common questions and address them proactively
5. Make it scannable with clear hierarchies and formatting`;

    const dataPayload = `File to document:

**File Analysis:**
- Language: ${language}
- Content Length: ${code.length} characters
- Lines: ${code.split('\n').length}

**Code Content:**
\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `Generate comprehensive ${docStyle} documentation for this file that serves as a complete reference for developers.

**REQUIRED DOCUMENTATION STRUCTURE:**

## File Overview
- **Purpose**: Clear, one-sentence description of what this file does
- **Key Features**: 3-5 bullet points of main capabilities
- **Dependencies**: What this file requires to function
- **Integration Points**: How this file connects to the broader system

## API Reference
${includeExamples ? 
`- **Functions/Classes**: Complete signature with parameter types and descriptions
- **Usage Examples**: Practical, copy-pasteable code examples for each main function
- **Return Values**: What developers can expect back, including error conditions
- **Best Practices**: How to use the API effectively and avoid common pitfalls` :
`- **Functions/Classes**: Method signatures with clear parameter descriptions
- **Core Concepts**: Key ideas developers need to understand
- **Integration Guidelines**: How to work with this file's functionality`}

## Implementation Details
- **Architecture Notes**: Design decisions and their rationale
- **Performance Considerations**: Important performance implications
- **Error Handling**: How errors are managed and what to expect
- **Configuration**: Any configuration options or environment dependencies

## Developer Guide
${focusAreas.includes('setup') ? `- **Setup Requirements**: What developers need to get started
- **Environment Setup**: Step-by-step configuration instructions` : ''}
${focusAreas.includes('contributing') ? `- **Contributing**: How to modify or extend this file
- **Testing**: How to test changes to this file` : ''}
- **Troubleshooting**: Common issues and their solutions
- **Related Files**: Other files developers should be aware of

**OUTPUT REQUIREMENTS:**
- Use proper ${docStyle} formatting with clear headers and code blocks
- Include syntax highlighting for code examples
- Create scannable content with bullet points and clear hierarchies
- Make examples practical and immediately useful
- Ensure content flows logically from overview to implementation details
- Write in an encouraging, helpful tone that empowers developers`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement multi-file project documentation generation
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, analysisType, analysisDepth, fileCount, docStyle, includeExamples, focusAreas } = params;
    
    const systemAndContext = `You are a senior technical writer and project documentation specialist with expertise in creating comprehensive project documentation that developers love to use.

**YOUR EXPERTISE:**
- 15+ years creating project documentation for open source and enterprise software
- Expert in ${docStyle} documentation standards and best practices
- Specializes in developer onboarding and API documentation
- Deep understanding of software architecture and project organization
- Proven track record of creating documentation that reduces support tickets by 80%

Analysis Context:
- Analysis Type: ${analysisType}
- Analysis Depth: ${analysisDepth}  
- Files Analyzed: ${fileCount}
- Documentation Style: ${docStyle}
- Include Examples: ${includeExamples}
- Focus Areas: ${focusAreas.join(', ')}
- Mode: Complete Project Documentation

**DOCUMENTATION MISSION:**
Create documentation so clear and helpful that:
1. New developers can contribute within their first week
2. Existing developers can quickly find what they need
3. The project becomes more maintainable and accessible
4. Support questions decrease significantly
5. The project attracts more contributors and users

**CORE PRINCIPLES:**
- Start with what developers can accomplish (outcomes over features)
- Provide a clear learning path from beginner to advanced
- Include real, working examples that solve actual problems
- Anticipate and answer the questions developers will have
- Make the documentation as engaging and clear as the best technical books`;

    const dataPayload = `Comprehensive project analysis results:

**Project Overview:**
- Total Files Analyzed: ${fileCount}
- Analysis Depth: ${analysisDepth}
- Focus Areas: ${focusAreas.join(', ')}

**Detailed Analysis:**
${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Create comprehensive ${docStyle} project documentation that serves as the definitive guide for this project.

**REQUIRED DOCUMENTATION SECTIONS:**

## 🚀 Project Overview
- **What This Project Does**: Clear, compelling description in plain English
- **Why It Matters**: The problem this project solves and why developers should care
- **Key Features**: 5-7 standout capabilities that make this project valuable
- **Who Should Use This**: Target audience and use cases
- **Technology Stack**: Core technologies and architectural approach

## ⚡ Quick Start Guide
${focusAreas.includes('setup') ? 
`- **Prerequisites**: Exact system requirements and dependencies
- **Installation**: Step-by-step installation process with verification steps
- **First Success**: Get developers to a working example in under 10 minutes
- **Next Steps**: Clear pathway to more advanced usage` :
`- **Getting Started**: Essential steps to begin using the project
- **Core Concepts**: Key ideas developers need to understand upfront`}

## 📁 Project Architecture
${focusAreas.includes('architecture') ?
`- **Directory Structure**: What each folder contains and why
- **Key Components**: Core modules and their responsibilities  
- **Data Flow**: How information moves through the system
- **Design Decisions**: Architectural choices and their rationale
- **Extension Points**: Where and how the project can be customized` :
`- **Project Organization**: How the codebase is structured
- **Core Components**: Main modules and their purposes`}

## 🔧 API Documentation
${focusAreas.includes('api') ?
`- **Core APIs**: Complete reference for main functions and classes
- **Authentication**: Security and access patterns
- **Request/Response Formats**: Data structures and examples
- **Error Handling**: Common error scenarios and resolutions
- **Rate Limits & Performance**: Important usage considerations` :
`- **Main Functions**: Key APIs and their usage
- **Integration Patterns**: How to work with the project's functionality`}

## 💡 Usage Examples
${includeExamples ?
`- **Common Use Cases**: 5-10 practical scenarios with complete code examples
- **Integration Examples**: How to use this project with other popular tools
- **Advanced Patterns**: Sophisticated usage for experienced developers
- **Best Practices**: Recommended approaches and patterns to avoid
- **Sample Projects**: Links to complete example implementations` :
`- **Basic Usage**: Essential usage patterns
- **Integration Guidelines**: How to incorporate into existing projects
- **Common Patterns**: Frequently used approaches`}

## 🛠️ Development Guide
${focusAreas.includes('contributing') ?
`- **Development Setup**: Complete environment setup for contributors
- **Code Style**: Coding standards and conventions
- **Testing Strategy**: How to run and write tests
- **Contribution Workflow**: Pull request process and guidelines
- **Release Process**: How updates are published and versioned` :
`- **Local Development**: Setting up for project modification
- **Testing**: How to verify changes work correctly`}

## 🔍 Troubleshooting
- **Common Issues**: The 10 most frequent problems and their solutions
- **Debug Mode**: How to get more information when things go wrong
- **Performance Issues**: Common performance problems and fixes
- **Environment Problems**: OS-specific issues and resolutions
- **Getting Help**: Where to find support and ask questions

## 🌟 Advanced Topics
- **Performance Optimization**: How to get the best performance
- **Security Considerations**: Important security practices
- **Monitoring & Observability**: How to monitor the project in production
- **Scaling Patterns**: Approaches for high-load scenarios
- **Integration Ecosystem**: Compatible tools and frameworks

## 📚 Resources
- **Related Projects**: Complementary tools and libraries
- **Learning Resources**: Tutorials, videos, and educational content  
- **Community**: Where to connect with other users and contributors
- **Changelog**: Recent updates and version history
- **Roadmap**: Planned features and project direction

**OUTPUT REQUIREMENTS:**
- Use engaging ${docStyle} formatting with emojis in headers for visual appeal
- Include practical, runnable code examples with clear explanations
- Create a logical flow from basic concepts to advanced usage
- Write in an encouraging, developer-friendly tone
- Make content highly scannable with clear hierarchies and formatting
- Include calls-to-action that encourage developers to try the project
- Ensure examples are realistic and solve real problems developers face
- Add tips, warnings, and pro-tips using appropriate markdown formatting`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement for backwards compatibility
   * The system still expects this method, so we intelligently route to the appropriate stages
   */
  getPromptStages(params: any): PromptStages {
    const mode = this.detectAnalysisMode(params);
    
    if (mode === 'single-file') {
      return this.getSingleFilePromptStages(params);
    } else {
      return this.getMultiFilePromptStages(params);
    }
  }

  // Multi-file helper methods
  private async discoverRelevantFiles(
    projectPath: string, 
    maxDepth: number,
    analysisType: string
  ): Promise<string[]> {
    const extensions = this.getFileExtensions(analysisType);
    
    // If analyzing /src, also include key files from parent directory
    const path = await import('path');
    const parentDir = path.dirname(projectPath);
    const isSourceDir = projectPath.endsWith('src') || projectPath.endsWith('src/');
    
    let sourceFiles = await this.multiFileAnalysis.discoverFiles(projectPath, extensions, maxDepth);
    
    if (isSourceDir) {
      // Add key project files from parent directory
      const keyProjectFiles = await this.findKeyProjectFiles(parentDir);
      sourceFiles = [...keyProjectFiles, ...sourceFiles];
    }
    
    return sourceFiles;
  }

  private async findKeyProjectFiles(projectRoot: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const keyFiles: string[] = [];
    
    const keyFileNames = [
      'package.json', 'composer.json', 'requirements.txt', 'Cargo.toml',
      'README.md', 'README.rst', 'README.txt', 'CHANGELOG.md',
      'tsconfig.json', '.env.example', '.gitignore'
    ];
    
    for (const fileName of keyFileNames) {
      const filePath = path.join(projectRoot, fileName);
      try {
        await fs.access(filePath);
        keyFiles.push(filePath);
      } catch {
        // File doesn't exist, skip it
      }
    }
    
    return keyFiles;
  }

  private async performMultiFileAnalysis(
    files: string[],
    params: any,
    model: any,
    contextLength: number
  ): Promise<any> {
    const cacheKey = this.analysisCache.generateKey(
      'generate_project_documentation', 
      params, 
      files
    );
    
    const cached = await this.analysisCache.get(cacheKey);
    if (cached) return cached;
    
    const fileAnalysisResults = await this.multiFileAnalysis.analyzeBatch(
      files,
      (file: string) => this.analyzeIndividualFile(file, params, model),
      contextLength
    );
    
    // Aggregate results into proper analysis result format
    const aggregatedResult = {
      summary: `Project documentation analysis of ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalSize: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.size || 0), 0),
        projectStructure: await this.buildProjectStructure(files, fileAnalysisResults),
        keyFiles: this.identifyKeyFiles(fileAnalysisResults),
        projectMetadata: this.extractProjectMetadata(files, fileAnalysisResults)
      }
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now() - Date.now(), // TODO: Track actual execution time
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async analyzeIndividualFile(file: string, params: any, model: any): Promise<any> {
    const content = await import('fs/promises').then(fs => fs.readFile(file, 'utf-8'));
    const path = await import('path');
    
    const isKeyFile = this.isKeyFile(path.basename(file));
    
    return {
      filePath: file,
      fileName: path.basename(file),
      extension: path.extname(file),
      size: content.length,
      lines: content.split('\n').length,
      language: this.getLanguageFromExtension(path.extname(file)),
      isKeyFile,
      // Only include content for key files, and limit it
      content: isKeyFile && content.length < 2000 ? content : 
               isKeyFile ? content.substring(0, 2000) + '...[truncated]' : 
               '[Content excluded - non-key file]'
    };
  }

  private getFileExtensions(analysisType: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'api': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.json'], // Focus on API-relevant files
      'architecture': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.md', '.json', '.yml', '.yaml'], // Include config and docs
      'comprehensive': ['.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.java', '.cs', '.cpp', '.h', '.css', '.html', '.md', '.json', '.xml', '.yml', '.yaml', '.sql'] // All relevant files
    };
    
    return extensionMap[analysisType] || extensionMap.comprehensive;
  }

  private getLanguageFromExtension(ext: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript', 
      '.jsx': 'react',
      '.tsx': 'react-typescript',
      '.php': 'php',
      '.py': 'python',
      '.java': 'java',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.h': 'c',
      '.css': 'css',
      '.html': 'html',
      '.md': 'markdown',
      '.json': 'json',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.sql': 'sql'
    };
    
    return languageMap[ext.toLowerCase()] || 'other';
  }

  private isKeyFile(fileName: string): boolean {
    const keyFilePatterns = [
      'package.json', 'composer.json', 'requirements.txt', 'Cargo.toml',
      'README.md', 'README.rst', 'README.txt', 'CHANGELOG.md',
      'index.js', 'index.ts', 'main.js', 'main.ts', 'app.js', 'app.ts',
      'config.js', 'config.ts', 'tsconfig.json', '.env.example'
    ];
    
    // Exact matches for critical files
    if (keyFilePatterns.includes(fileName.toLowerCase())) {
      return true;
    }
    
    // Pattern matches for important files
    const importantPatterns = [
      /^index\.(js|ts)$/i,
      /^main\.(js|ts)$/i,
      /^app\.(js|ts)$/i,
      /readme/i,
      /config/i
    ];
    
    return importantPatterns.some(pattern => pattern.test(fileName));
  }

  private async buildProjectStructure(files: string[], analysisResults: any[]): Promise<any> {
    const path = await import('path');
    const structure: Record<string, any> = {};
    
    files.forEach((file, index) => {
      const parts = file.split(path.sep);
      let current = structure;
      
      parts.forEach((part, partIndex) => {
        if (!current[part]) {
          current[part] = partIndex === parts.length - 1 ? analysisResults[index] : {};
        }
        if (partIndex < parts.length - 1) {
          current = current[part];
        }
      });
    });
    
    return structure;
  }

  private identifyKeyFiles(analysisResults: any[]): any[] {
    return analysisResults
      .filter(result => result.isKeyFile)
      .sort((a, b) => b.size - a.size)
      .slice(0, 10); // Top 10 key files
  }

  private extractProjectMetadata(files: string[], analysisResults: any[]): any {
    const packageJsonFile = analysisResults.find(result => 
      result.fileName === 'package.json'
    );
    
    if (packageJsonFile) {
      try {
        const packageJson = JSON.parse(packageJsonFile.content);
        return {
          name: packageJson.name || 'Unknown Project',
          version: packageJson.version || '1.0.0',
          description: packageJson.description || '',
          type: this.detectProjectType(packageJson, analysisResults),
          dependencies: Object.keys(packageJson.dependencies || {}),
          scripts: Object.keys(packageJson.scripts || {}),
          author: packageJson.author || '',
          license: packageJson.license || ''
        };
      } catch (error) {
        // Fallback if package.json can't be parsed
      }
    }
    
    // Default metadata
    return {
      name: 'Project Documentation',
      version: '1.0.0',
      description: 'Comprehensive project documentation',
      type: this.detectProjectTypeFromFiles(analysisResults),
      dependencies: [],
      scripts: [],
      author: '',
      license: ''
    };
  }

  private detectProjectType(packageJson: any, analysisResults: any[]): string {
    if (packageJson.dependencies?.react) return 'react-application';
    if (packageJson.dependencies?.vue) return 'vue-application';  
    if (packageJson.dependencies?.express) return 'node-api';
    if (packageJson.dependencies?.next) return 'nextjs-application';
    if (analysisResults.some(f => f.fileName.includes('plugin.php'))) return 'wordpress-plugin';
    if (analysisResults.some(f => f.fileName === 'style.css' && f.content.includes('Theme'))) return 'wordpress-theme';
    return 'node-project';
  }

  private detectProjectTypeFromFiles(analysisResults: any[]): string {
    const fileNames = analysisResults.map(r => r.fileName);
    
    if (fileNames.includes('package.json')) return 'node-project';
    if (fileNames.includes('composer.json')) return 'php-project';
    if (fileNames.includes('requirements.txt')) return 'python-project';
    if (fileNames.includes('Cargo.toml')) return 'rust-project';
    if (fileNames.some(f => f.endsWith('.csproj'))) return 'dotnet-project';
    
    return 'generic-project';
  }

  private generateCacheKey(files: string[], params: any): string {
    const fileHash = files.join('|');
    const paramHash = JSON.stringify(params);
    return `${fileHash}_${paramHash}`.substring(0, 64);
  }
}

export default ProjectDocumentationGenerator;