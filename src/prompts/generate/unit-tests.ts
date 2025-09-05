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
  MultiFileAnalysis,
  TokenCalculator
} from '../../utils/plugin-utilities.js';
import { getAnalysisCache } from '../../cache/index.js';

export class UnitTestGenerator extends BasePlugin implements IPromptPlugin {
  name = 'generate_unit_tests';
  category = 'generate' as const;
  description = 'Generate comprehensive unit tests for code with framework-specific patterns and complete coverage strategies';
  
  // Universal parameter set - supports both single and multi-file scenarios
  parameters = {
    // Single-file parameters
    code: {
      type: 'string' as const,
      description: 'The code to generate tests for (for single-file analysis)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to single file to generate tests for',
      required: false
    },
    
    // Multi-file parameters  
    projectPath: {
      type: 'string' as const,
      description: 'Path to project root (for multi-file test generation)',
      required: false
    },
    files: {
      type: 'array' as const,
      description: 'Array of specific file paths (for multi-file test generation)',
      required: false,
      items: { type: 'string' as const }
    },
    maxDepth: {
      type: 'number' as const,
      description: 'Maximum directory depth for multi-file discovery (1-5)',
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
    testFramework: {
      type: 'string' as const,
      description: 'Testing framework to use (jest, mocha, pytest, phpunit, etc.)',
      required: false,
      default: 'jest'
    },
    coverageTarget: {
      type: 'string' as const,
      description: 'Test coverage target level',
      enum: ['basic', 'comprehensive', 'edge-cases'],
      default: 'comprehensive',
      required: false
    },
    context: {
      type: 'object' as const,
      description: 'Optional context for framework-specific testing patterns',
      required: false,
      properties: {
        projectType: {
          type: 'string' as const,
          enum: ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'node-api', 'browser-extension', 'cli-tool', 'n8n-node', 'n8n-workflow', 'generic'],
          description: 'Project type for appropriate test patterns'
        },
        testStyle: {
          type: 'string' as const,
          enum: ['bdd', 'tdd', 'aaa', 'given-when-then'],
          description: 'Testing style preference'
        },
        mockStrategy: {
          type: 'string' as const,
          enum: ['minimal', 'comprehensive', 'integration-preferred'],
          description: 'Mocking approach',
          default: 'minimal'
        }
      }
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
        return ErrorHandler.createExecutionError('generate_unit_tests', error);
      }
    });
  }

  /**
   * Auto-detect whether this is single-file or multi-file analysis
   */
  private detectAnalysisMode(params: any): 'single-file' | 'multi-file' {
    // Single-file indicators take priority (avoids default parameter issues)
    if (params.code || params.filePath) {
      return 'single-file';
    }
    
    // Multi-file indicators
    if (params.projectPath || params.files) {
      return 'multi-file';
    }
    
    // Default to single-file for test generation
    return 'single-file';
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
    ParameterValidator.validateEnum(params, 'coverageTarget', ['basic', 'comprehensive', 'edge-cases']);
    ParameterValidator.validateEnum(params, 'testFramework', ['jest', 'mocha', 'pytest', 'phpunit', 'vitest', 'jasmine']);
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
    const promptManager = new ThreeStagePromptManager();
    const needsChunking = TokenCalculator.needsChunking(promptStages, contextLength);
    
    if (needsChunking) {
      const chunkSize = TokenCalculator.calculateOptimalChunkSize(promptStages, contextLength);
      const dataChunks = promptManager.chunkDataPayload(promptStages.dataPayload, chunkSize);
      const conversation = promptManager.createChunkedConversation(promptStages, dataChunks);
      const messages = [
        conversation.systemMessage,
        ...conversation.dataMessages,
        conversation.analysisMessage
      ];
      
      return await ResponseProcessor.executeChunked(
        messages,
        model,
        contextLength,
        'generate_unit_tests',
        'single'
      );
    } else {
      return await ResponseProcessor.executeDirect(
        promptStages,
        model,
        contextLength,
        'generate_unit_tests'
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
        params.language
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
    const promptManager = new ThreeStagePromptManager();
    const chunkSize = TokenCalculator.calculateOptimalChunkSize(promptStages, contextLength);
    const dataChunks = promptManager.chunkDataPayload(promptStages.dataPayload, chunkSize);
    const conversation = promptManager.createChunkedConversation(promptStages, dataChunks);
    const messages = [
      conversation.systemMessage,
      ...conversation.dataMessages,
      conversation.analysisMessage
    ];
    
    return await ResponseProcessor.executeChunked(
      messages,
      model,
      contextLength,
      'generate_unit_tests',
      'multifile'
    );
  }

  /**
   * Implement single-file prompt stages for test generation
   */
  private getSingleFilePromptStages(params: any): PromptStages {
    const { code, language, testFramework, coverageTarget, context = {} } = params;
    const projectType = context.projectType || 'generic';
    const testStyle = context.testStyle || 'bdd';
    const mockStrategy = context.mockStrategy || 'minimal';
    
    const systemAndContext = `You are an expert test engineer and quality assurance specialist with 15+ years of experience in ${testFramework} testing and ${language} development.

**YOUR EXPERTISE:**
- Advanced ${testFramework} patterns and best practices
- ${language} testing ecosystem and frameworks
- Test-driven development (TDD) and behavior-driven development (BDD)
- Mock strategies, fixtures, and test data management
- Performance testing and security testing methodologies
- CI/CD integration and test automation workflows

**TESTING CONTEXT:**
- Framework: ${testFramework}
- Language: ${language} 
- Coverage Target: ${this.getCoveragePercent(coverageTarget)}%
- Project Type: ${projectType}
- Test Style: ${testStyle}
- Mock Strategy: ${mockStrategy}
- Mode: Single File Test Generation

**YOUR MISSION:**
Generate comprehensive, production-ready unit tests that serve as both documentation and quality assurance. Your tests should be so thorough and well-written that they become the definitive specification of how the code should behave.

**QUALITY STANDARDS:**
- Tests must be maintainable, readable, and serve as living documentation
- Each test should have a single, clear responsibility
- Test names should read like specifications in plain English
- Setup and teardown should be clean and predictable
- Mocks should be realistic and properly isolated
- Error scenarios should be as thoroughly tested as success cases`;

    const dataPayload = `Code requiring comprehensive test coverage:

\`\`\`${language}
${code}
\`\`\``;

    const outputInstructions = `Generate a complete, production-ready test suite that includes:

## 🎯 REQUIRED TEST CATEGORIES

### 1. Happy Path Tests (Core Functionality)
- Standard successful operations with valid inputs
- Expected return values and side effects
- Normal flow execution paths

### 2. Edge Cases & Boundary Conditions  
- Empty inputs, null/undefined values
- Minimum and maximum valid values
- Zero-length arrays, empty strings, edge numbers
- Large datasets and performance boundaries

### 3. Error Handling & Validation
- Invalid input types and formats
- Out-of-range values and malformed data
- Network failures, timeouts, and external service errors
- Permission denied and authentication failures
- Proper error types and meaningful error messages

### 4. ${projectType === 'generic' ? 'Security Validation' : this.getProjectSpecificTests(projectType)}
${this.getSecurityTestsForProject(projectType)}

### 5. Integration Points & Dependencies
- External API calls and responses
- Database operations and transactions  
- File system operations
- Environment variable dependencies
- Third-party library interactions

## 🏗️ TEST STRUCTURE REQUIREMENTS

### Framework: ${testFramework}
${this.getFrameworkGuidelines(testFramework)}

### Test Organization:
- Group related tests using describe/context blocks
- Use descriptive test names following ${testStyle} style: ${this.getTestNamingPattern(testStyle)}
- Include proper setup (beforeEach/beforeAll) and cleanup (afterEach/afterAll)
- Organize tests from most common to least common scenarios

### Mocking Strategy: ${mockStrategy}
${this.getMockingGuidelines(mockStrategy, testFramework)}

## 📋 DELIVERABLE REQUIREMENTS

Provide a complete test file that includes:
- All necessary imports and dependencies
- Proper test suite structure with clear organization
- Comprehensive coverage of all identified functions/methods
- Realistic test data and fixtures
- Proper assertions with meaningful failure messages
- Performance considerations where relevant
- Accessibility testing (if UI components)
- Documentation comments for complex test scenarios

**Coverage Target**: Achieve ${this.getCoveragePercent(coverageTarget)}% coverage with meaningful tests, not just line coverage.

**Test Quality**: Each test should be independently runnable, deterministic, and provide clear diagnostics on failure.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement multi-file prompt stages for project-wide test generation
   */
  private getMultiFilePromptStages(params: any): PromptStages {
    const { analysisResult, testFramework, coverageTarget, fileCount, context = {} } = params;
    const projectType = context.projectType || 'generic';
    
    const systemAndContext = `You are a senior test architect with expertise in large-scale test suite design and ${testFramework} testing frameworks.

**YOUR EXPERTISE:**
- Multi-file test suite architecture and organization
- Test strategy design for complex applications
- Integration testing across components
- Test data management and shared fixtures
- Performance testing at scale
- Continuous integration and test automation

**PROJECT CONTEXT:**
- Framework: ${testFramework}
- Files Analyzed: ${fileCount}
- Coverage Target: ${this.getCoveragePercent(coverageTarget)}%
- Project Type: ${projectType}
- Mode: Multi-File Test Generation

**YOUR MISSION:**
Design and generate a comprehensive test suite architecture that covers all analyzed files while maintaining clean separation of concerns, shared utilities, and consistent testing patterns across the entire project.`;

    const dataPayload = `Multi-file project analysis:

${JSON.stringify(analysisResult, null, 2)}`;

    const outputInstructions = `Generate a comprehensive test suite architecture with:

## 🏗️ TEST SUITE ARCHITECTURE

### Test File Organization:
- One test file per source file following naming conventions
- Shared test utilities and fixtures in common directories
- Integration test suites for cross-file functionality
- Performance test suites for system-wide benchmarks

### Cross-File Testing Strategy:
- **Unit Tests**: Individual file/module testing in isolation
- **Integration Tests**: Inter-module communication and data flow
- **System Tests**: End-to-end functionality across the entire application
- **Contract Tests**: API boundaries and interface compliance

### Test Data Management:
- Centralized test fixtures and mock data
- Database seeding and cleanup strategies
- Shared mock implementations for common dependencies
- Environment-specific test configurations

### Shared Testing Utilities:
- Common setup and teardown helpers
- Custom matchers and assertions
- Mock factories and test builders
- Utility functions for data generation

## 📁 DELIVERABLES

For each analyzed file, provide:
1. **Individual test file** with comprehensive coverage
2. **Integration tests** where cross-file dependencies exist
3. **Shared utilities** for common testing patterns
4. **Test configuration** for the project
5. **README documentation** explaining the test strategy

## 🎯 QUALITY STANDARDS

- Maintain consistency in test style and structure across all files
- Ensure tests are maintainable and don't duplicate logic unnecessarily  
- Create realistic integration scenarios based on actual file dependencies
- Provide clear documentation for running and maintaining the test suite
- Consider performance implications of the full test suite execution

**Overall Coverage**: Achieve comprehensive testing across all ${fileCount} files while maintaining clean, maintainable test architecture.`;

    return { systemAndContext, dataPayload, outputInstructions };
  }

  /**
   * Implement for backwards compatibility
   */
  getPromptStages(params: any): PromptStages {
    const mode = this.detectAnalysisMode(params);
    
    if (mode === 'single-file') {
      return this.getSingleFilePromptStages(params);
    } else {
      return this.getMultiFilePromptStages(params);
    }
  }

  // Helper methods for test generation
  private async discoverRelevantFiles(
    projectPath: string, 
    maxDepth: number,
    language: string
  ): Promise<string[]> {
    const extensions = this.getFileExtensions(language);
    return await this.multiFileAnalysis.discoverFiles(projectPath, extensions, maxDepth);
  }

  private async performMultiFileAnalysis(
    files: string[],
    params: any,
    model: any,
    contextLength: number
  ): Promise<any> {
    const cacheKey = this.analysisCache.generateKey(
      'generate_unit_tests', 
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
      summary: `Test generation analysis for ${files.length} files`,
      findings: fileAnalysisResults,
      data: {
        fileCount: files.length,
        totalFunctions: fileAnalysisResults.reduce((sum: number, result: any) => sum + (result.functionCount || 0), 0),
        complexity: this.calculateOverallComplexity(fileAnalysisResults),
        dependencies: this.extractDependencies(fileAnalysisResults)
      }
    };
    
    await this.analysisCache.cacheAnalysis(cacheKey, aggregatedResult, {
      modelUsed: model.identifier || 'unknown',
      executionTime: Date.now() - Date.now(),
      timestamp: new Date().toISOString()
    });
    
    return aggregatedResult;
  }

  private async analyzeIndividualFile(file: string, params: any, model: any): Promise<any> {
    const content = await import('fs/promises').then(fs => fs.readFile(file, 'utf-8'));
    
    return {
      filePath: file,
      size: content.length,
      lines: content.split('\n').length,
      functionCount: this.estimateFunctionCount(content, params.language),
      complexity: this.estimateComplexity(content),
      dependencies: this.extractFileDependencies(content),
      testable: this.isFileTestable(content, params.language)
    };
  }

  private getFileExtensions(language: string): string[] {
    const extensionMap: Record<string, string[]> = {
      'javascript': ['.js', '.jsx', '.mjs'],
      'typescript': ['.ts', '.tsx'],
      'python': ['.py'],
      'php': ['.php', '.inc', '.module'],
      'java': ['.java'],
      'csharp': ['.cs'],
      'cpp': ['.cpp', '.cc', '.cxx', '.c++'],
      'c': ['.c', '.h']
    };
    
    return extensionMap[language] || ['.js', '.ts', '.jsx', '.tsx', '.py', '.php', '.java', '.cs', '.cpp', '.c'];
  }

  private getCoveragePercent(target: string): number {
    const targets: Record<string, number> = {
      'basic': 60,
      'comprehensive': 80,
      'edge-cases': 90
    };
    return targets[target] || 80;
  }

  private getTestNamingPattern(style: string): string {
    const patterns: Record<string, string> = {
      'bdd': '"should [expected behavior] when [condition]"',
      'given-when-then': '"Given [context], when [action], then [outcome]"',
      'aaa': '"[methodName]: [scenario] - [expected result]"',
      'tdd': '"test [functionality] with [input] expects [output]"'
    };
    return patterns[style] || patterns.bdd;
  }

  private getProjectSpecificTests(projectType: string): string {
    const tests: Record<string, string> = {
      'wordpress-plugin': 'WordPress-Specific Security & Integration Tests',
      'react-app': 'React Component & State Management Tests',
      'node-api': 'API Endpoint & Database Integration Tests',
      'browser-extension': 'Extension Permissions & Cross-Origin Tests',
      'cli-tool': 'Command Line Interface & System Integration Tests',
      'n8n-node': 'N8N Node Execution & Workflow Tests',
      'n8n-workflow': 'Workflow Logic & Data Transformation Tests'
    };
    return tests[projectType] || 'Application-Specific Security Tests';
  }

  private getSecurityTestsForProject(projectType: string): string {
    const security: Record<string, string> = {
      'wordpress-plugin': '- Nonce validation and CSRF protection\n- Capability checks and authorization\n- SQL injection prevention\n- XSS escaping and output sanitization\n- File upload security and path traversal prevention',
      'react-app': '- XSS prevention in JSX rendering\n- Props validation and sanitization\n- State injection attacks\n- Route guard authentication\n- Component security boundaries',
      'node-api': '- Input validation and sanitization\n- Authentication and authorization\n- Rate limiting and DDoS protection\n- SQL injection and NoSQL injection prevention\n- JWT token validation and refresh',
      'browser-extension': '- Content Security Policy compliance\n- Cross-origin request validation\n- Permission boundary testing\n- Message passing security\n- DOM injection prevention',
      'cli-tool': '- Command injection prevention\n- Path traversal attacks\n- Privilege escalation protection\n- Environment variable sanitization\n- File system permission validation',
      'n8n-node': '- Credential handling and encryption\n- Input data sanitization\n- API security and rate limiting\n- Webhook validation\n- Error information leakage prevention',
      'n8n-workflow': '- Data validation between nodes\n- Webhook security testing\n- Error handling without data exposure\n- Authentication token management\n- Input/output data sanitization'
    };
    return security[projectType] || '- Input validation and sanitization\n- Output encoding and escaping\n- Authentication and authorization checks\n- Error handling without information leakage';
  }

  private getFrameworkGuidelines(framework: string): string {
    const guidelines: Record<string, string> = {
      'jest': '- Use describe() for test grouping and it()/test() for individual tests\n- Utilize beforeEach/afterEach for setup/teardown\n- Mock modules with jest.mock() and manual mocks\n- Use expect() assertions with Jest matchers\n- Implement snapshot testing for UI components',
      'mocha': '- Structure tests with describe() and it() blocks\n- Use Chai for assertions (expect, should, assert)\n- Implement Sinon for spies, stubs, and mocks\n- Handle async tests with done() callbacks or promises\n- Use before/after hooks for test setup',
      'pytest': '- Use fixtures for test setup and dependency injection\n- Parametrize tests with @pytest.mark.parametrize\n- Mock dependencies with unittest.mock or pytest-mock\n- Use assert statements for simple assertions\n- Mark tests with decorators for organization',
      'phpunit': '- Extend TestCase class for all test classes\n- Use setUp() and tearDown() for test preparation\n- Create data providers for parametrized testing\n- Mock objects with getMockBuilder() or Prophecy\n- Use annotations (@covers, @group, @dataProvider)',
      'vitest': '- Similar to Jest with describe() and it()/test()\n- Use vi.mock() for module mocking\n- Leverage Vitest UI for debugging\n- Implement in-source testing capabilities\n- Use expect() with extended Vitest matchers'
    };
    return guidelines[framework] || guidelines.jest;
  }

  private getMockingGuidelines(strategy: string, framework: string): string {
    const strategies: Record<string, string> = {
      'minimal': `Mock only external dependencies and side effects:
- Network calls and API requests
- Database operations
- File system operations
- External services and third-party libraries
- Keep internal logic unmocked for integration confidence`,
      
      'comprehensive': `Mock most dependencies for isolation:
- All external dependencies and services
- Internal modules and complex dependencies
- Database and network operations
- Time-dependent functions (Date.now(), setTimeout)
- Random functions and non-deterministic behavior`,
      
      'integration-preferred': `Minimize mocks to test real integration:
- Mock only external services outside your control
- Use real database with test data
- Test actual file operations with temporary files
- Mock only network calls to external APIs
- Prefer dependency injection over mocking`
    };
    return strategies[strategy] || strategies.minimal;
  }

  // Helper methods for file analysis
  private estimateFunctionCount(content: string, language: string): number {
    const patterns: Record<string, RegExp> = {
      'javascript': /function\s+\w+|const\s+\w+\s*=\s*\(|class\s+\w+/g,
      'typescript': /function\s+\w+|const\s+\w+\s*=\s*\(|class\s+\w+/g,
      'python': /def\s+\w+|class\s+\w+/g,
      'php': /function\s+\w+|class\s+\w+/g,
      'java': /public\s+\w+\s+\w+\(|private\s+\w+\s+\w+\(/g
    };
    const pattern = patterns[language] || patterns.javascript;
    const matches = content.match(pattern);
    return matches ? matches.length : 0;
  }

  private estimateComplexity(content: string): string {
    const lines = content.split('\n').length;
    const cyclomaticIndicators = (content.match(/if\s*\(|while\s*\(|for\s*\(|switch\s*\(|catch\s*\(/g) || []).length;
    
    if (lines < 50 && cyclomaticIndicators < 5) return 'low';
    if (lines < 200 && cyclomaticIndicators < 15) return 'medium';
    return 'high';
  }

  private extractFileDependencies(content: string): string[] {
    const importMatches = content.match(/(?:import|require)\s*\(?['"`]([^'"`]+)['"`]/g) || [];
    return importMatches.map(match => {
      const result = match.match(/['"`]([^'"`]+)['"`]/);
      return result ? result[1] : '';
    }).filter(dep => dep && !dep.startsWith('.'));
  }

  private isFileTestable(content: string, language: string): boolean {
    const functionCount = this.estimateFunctionCount(content, language);
    const hasExports = /export|module\.exports/g.test(content);
    return functionCount > 0 || hasExports;
  }

  private calculateOverallComplexity(results: any[]): string {
    const complexities = results.map(r => r.complexity);
    const highCount = complexities.filter(c => c === 'high').length;
    const mediumCount = complexities.filter(c => c === 'medium').length;
    
    if (highCount > results.length * 0.3) return 'high';
    if (mediumCount > results.length * 0.5) return 'medium';
    return 'low';
  }

  private extractDependencies(results: any[]): string[] {
    const allDeps = results.flatMap(r => r.dependencies || []);
    return [...new Set(allDeps)];
  }
}

export default UnitTestGenerator;