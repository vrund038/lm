/**
 * Project Structure Analyzer Plugin
 * Analyzes complete project structure and architecture
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { resolve, join, extname, relative, basename } from 'path';

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
    // Validate project path
    if (!params.projectPath || typeof params.projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }
    
    const projectPath = resolve(params.projectPath);
    
    if (!this.isPathSafe(projectPath)) {
      throw new Error(`Access denied to path: ${projectPath}`);
    }
    
    if (!existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }
    
    if (!statSync(projectPath).isDirectory()) {
      throw new Error(`Project path is not a directory: ${projectPath}`);
    }
    
    // Parse parameters
    const focusAreas = params.focusAreas || [];
    const maxDepth = Math.min(Math.max(params.maxDepth || 3, 1), 10);
    
    // Analyze project structure
    const structure = this.analyzeProjectStructure(projectPath, maxDepth);
    
    // Read key configuration files
    const configFiles = this.readConfigurationFiles(projectPath);
    
    // Sample code files for pattern analysis
    const codeSamples = this.sampleCodeFiles(projectPath, structure);
    
    // Generate analysis prompt
    const prompt = this.getPrompt({
      projectPath,
      structure,
      configFiles,
      codeSamples,
      focusAreas,
      maxDepth
    });
    
    try {
      // Get the loaded model from LM Studio
      const models = await llmClient.llm.listLoaded();
      if (models.length === 0) {
        throw new Error('No model loaded in LM Studio. Please load a model first.');
      }
      
      // Use the first loaded model
      const model = models[0];
      
      // Call the model with proper LM Studio SDK pattern
      const prediction = model.respond([
        {
          role: 'system',
          content: 'You are a senior software architect with expertise in project analysis, code organization, and architectural patterns. Provide comprehensive analysis of project structures, identifying patterns, potential issues, and improvement opportunities.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
        temperature: 0.2,
        maxTokens: 5000
      });
      
      // Stream the response
      let response = '';
      for await (const chunk of prediction) {
        if (chunk.content) {
          response += chunk.content;
        }
      }
      
      return {
        analysis: response,
        metadata: {
          projectPath: basename(projectPath),
          totalFiles: structure.statistics.totalFiles,
          totalDirectories: structure.statistics.totalDirectories,
          maxDepth: structure.statistics.maxDepth,
          focusAreas,
          modelUsed: model.identifier || 'unknown'
        }
      };
      
    } catch (error: any) {
      throw new Error(`Failed to analyze project structure: ${error.message}`);
    }
  }

  getPrompt(params: any): string {
    const { projectPath, structure, configFiles, codeSamples, focusAreas, maxDepth } = params;
    
    // Format structure overview
    const structureOverview = this.formatStructureOverview(structure);
    
    // Format configuration files
    const configSection = this.formatConfigFiles(configFiles);
    
    // Format code samples
    const samplesSection = this.formatCodeSamples(codeSamples);
    
    // Build focus section
    const focusSection = focusAreas.length > 0
      ? `Focus specifically on: ${focusAreas.join(', ')}`
      : 'Provide comprehensive analysis of all aspects';
    
    return `You are an expert software architect specializing in project structure analysis and architecture assessment.

Analyze the structure and architecture of this project: ${basename(projectPath)}

PROJECT STATISTICS:
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
${structureOverview}

CONFIGURATION FILES:
${configSection}

CODE SAMPLES:
${samplesSection}

ANALYSIS REQUIREMENTS:
${focusSection}

Perform comprehensive analysis covering:

1. **Architecture Pattern**
   - Identify the overall architectural pattern (MVC, MVVM, Microservices, Monolith, etc.)
   - Assess how well the project follows the pattern
   - Note any deviations or mixed patterns

2. **Project Organization**
   - Evaluate directory structure and naming conventions
   - Assess separation of concerns
   - Identify any organizational anti-patterns
   - Suggest improvements to structure

3. **Dependency Analysis**
   - Identify key dependencies from configuration files
   - Assess dependency management approach
   - Note any outdated or risky dependencies
   - Check for dependency conflicts

4. **Code Patterns**
   - Identify design patterns used in the code samples
   - Assess consistency across the codebase
   - Note any anti-patterns or code smells
   - Evaluate code quality indicators

5. **Technology Stack**
   - Identify all technologies, frameworks, and languages used
   - Assess technology choices for the project's purpose
   - Note any technology conflicts or redundancies

6. **Build and Deployment**
   - Identify build tools and processes
   - Assess deployment configuration
   - Note CI/CD setup if present
   - Identify potential deployment issues

7. **Testing Strategy**
   - Identify testing frameworks and tools
   - Assess test coverage indicators
   - Note testing patterns used
   - Suggest testing improvements

8. **Documentation**
   - Assess documentation presence and quality
   - Identify missing documentation
   - Note documentation tools used

OUTPUT FORMAT:

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
  }
  
  private analyzeProjectStructure(projectPath: string, maxDepth: number): ProjectStructure {
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
    
    this.traverseDirectory(projectPath, structure, 0, maxDepth, projectPath);
    
    // Sort largest files
    structure.statistics.largestFiles = Array.from(structure.files.values())
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    
    return structure;
  }
  
  private traverseDirectory(
    dir: string,
    structure: ProjectStructure,
    currentDepth: number,
    maxDepth: number,
    projectRoot: string
  ): void {
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
            this.traverseDirectory(fullPath, structure, currentDepth + 1, maxDepth, projectRoot);
          } else if (stat.isFile()) {
            fileCount++;
            const ext = extname(entry).toLowerCase() || 'no-ext';
            const relativeFilePath = relative(projectRoot, fullPath);
            
            // Count lines for text files
            let lines = 0;
            if (this.isTextFile(ext)) {
              try {
                const content = readFileSync(fullPath, 'utf-8');
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
  
  private readConfigurationFiles(projectPath: string): Map<string, string> {
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
          const content = readFileSync(configPath, 'utf-8');
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
  
  private sampleCodeFiles(projectPath: string, structure: ProjectStructure): Map<string, string> {
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
        const content = readFileSync(fullPath, 'utf-8');
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