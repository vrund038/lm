/**
 * Unit Test Generation Plugin
 * Generates unit tests for code with framework-specific patterns
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { readFileContent } from '../shared/helpers.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { withSecurity } from '../../security/integration-helpers.js';

// Type definitions for test context
interface TestContext {
  projectType?: string;
  testFramework?: string;
  coverageTarget?: string | number;
  testStyle?: string;
  mockStrategy?: string;
  includeEdgeCases?: boolean;
  includePerformanceTests?: boolean;
}

export class UnitTestGenerator extends BasePlugin implements IPromptPlugin {
  name = 'generate_unit_tests';
  category = 'generate' as const;
  description = 'Generate unit tests for code with framework-specific patterns';
  
  parameters = {
    code: {
      type: 'string' as const,
      description: 'The code to generate tests for (optional if filePath is provided)',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to code file (alternative to code parameter)',
      required: false
    },
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
      required: false,
      enum: ['basic', 'comprehensive', 'edge-cases'],
      default: 'comprehensive'
    },
    context: {
      type: 'object' as const,
      description: 'Optional context for framework-specific testing patterns',
      required: false,
      properties: {
        projectType: {
          type: 'string' as const,
          enum: ['wordpress-plugin', 'wordpress-theme', 'react-app', 'react-component', 'node-api', 'n8n-node', 'n8n-workflow', 'html-component', 'browser-extension', 'cli-tool', 'generic'],
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
        },
        includeEdgeCases: {
          type: 'boolean' as const,
          description: 'Include edge case tests',
          default: true
        },
        includePerformanceTests: {
          type: 'boolean' as const,
          description: 'Include performance tests',
          default: false
        }
      }
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      // Validate at least one input provided
      if (!secureParams.code && !secureParams.filePath) {
        throw new Error('Either code or filePath must be provided');
      }
      
      // Read file if needed
      let codeToTest = secureParams.code;
      if (secureParams.filePath) {
        codeToTest = await readFileContent(secureParams.filePath);
      }
      
      // Prepare context with defaults
      const context: TestContext = {
        projectType: secureParams.context?.projectType || 'generic',
        testFramework: secureParams.testFramework || 'jest',
        coverageTarget: this.getCoverageTargetPercent(secureParams.coverageTarget),
        testStyle: secureParams.context?.testStyle || 'descriptive',
        mockStrategy: secureParams.context?.mockStrategy || 'minimal',
        includeEdgeCases: secureParams.context?.includeEdgeCases !== false,
        includePerformanceTests: secureParams.context?.includePerformanceTests || false
      };
      
      // Generate prompt
      const prompt = this.getPrompt({ ...secureParams, code: codeToTest, context });
      
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
          content: 'You are an expert test engineer. Generate comprehensive, well-structured unit tests that follow best practices and provide excellent code coverage. Focus on readability, maintainability, and thorough edge case testing.'
        },
        {
          role: 'user', 
          content: prompt
        }
      ], {
        temperature: 0.2,
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
        'generate_unit_tests',
        response,
        model.identifier || 'unknown'
      );
      
    } catch (error: any) {
      return ResponseFactory.createErrorResponse(
        'generate_unit_tests',
        'MODEL_ERROR',
        `Failed to generate unit tests: ${error.message}`,
        { originalError: error.message },
        'unknown'
      );
    }
  }

  getPrompt(params: any): string {
    const content = params.code;
    const context = params.context || {};
    
    const { projectType, testFramework, coverageTarget = 80, mockStrategy = 'minimal' } = context;
    
    return `Generate comprehensive unit tests for ${projectType || 'generic'} code.

Testing Requirements:
- Framework: ${testFramework || 'jest'}
- Coverage Target: ${coverageTarget}% minimum
- Mock Strategy: ${mockStrategy}
- Test Style: ${context.testStyle || 'descriptive'}

Required Test Categories:
1. **Happy Path**: Standard successful operations
2. **Edge Cases**: Boundary conditions, empty inputs, null/undefined, large datasets
3. **Error Scenarios**: Invalid inputs, network failures, permission issues, timeouts
4. **Security Tests**: ${this.getSecurityTests(projectType)}
5. **Performance Tests**: ${context.includePerformanceTests ? 'Response times, memory usage, concurrent operations' : 'Skip performance tests'}
6. **Integration Points**: External dependencies, API calls, database operations

${this.getFrameworkTestGuidelines(context)}

Test Structure Requirements:
- Use descriptive test names: ${this.getTestNamingPattern(context.testStyle)}
- Group related tests in describe/context blocks
- Include proper setup/teardown (beforeEach/afterEach)
- Add inline comments for complex test logic
- Mock external dependencies appropriately
- Test both synchronous and asynchronous operations

Code to test:
${content}

Generate tests that:
- Are isolated and don't depend on external state
- Can run in any order
- Clean up after themselves
- Provide clear failure messages
- Cover the specified coverage target`;
  }

  private getCoverageTargetPercent(target?: string): number {
    const targets: Record<string, number> = {
      'basic': 60,
      'comprehensive': 80,
      'edge-cases': 90
    };
    return targets[target || 'comprehensive'] || 80;
  }

  private getTestNamingPattern(testStyle?: string): string {
    switch(testStyle) {
      case 'bdd':
        return '"should [expected behavior] when [condition]"';
      case 'given-when-then':
        return '"Given [context], when [action], then [outcome]"';
      case 'aaa':
        return '"[methodName]: [scenario] - [expected result]"';
      default:
        return '"should [expected behavior] when [condition]"';
    }
  }

  private getSecurityTests(projectType?: string): string {
    const securityTests: Record<string, string> = {
      'wordpress-plugin': 'Nonce validation, capability checks, SQL injection prevention, XSS escaping',
      'wordpress-theme': 'Output escaping, form validation, capability checks, safe file handling',
      'node-api': 'Input validation, authentication, authorization, rate limiting',
      'react-app': 'XSS prevention, prop validation, secure routing',
      'react-component': 'Props sanitization, event handler security, state validation',
      'n8n-node': 'Credential handling, input sanitization, API security',
      'n8n-workflow': 'Data validation, webhook security, error handling',
      'html-component': 'HTML injection prevention, form validation, accessibility',
      'browser-extension': 'CSP compliance, permission checks, cross-origin security',
      'cli-tool': 'Command injection prevention, path traversal, privilege escalation',
      'generic': 'Input validation, output sanitization, authorization checks'
    };
    
    return securityTests[projectType || 'generic'] || securityTests.generic;
  }

  private getFrameworkTestGuidelines(context: TestContext): string {
    const framework = context.testFramework || 'jest';
    const projectType = context.projectType || 'generic';
    
    const guidelines: Record<string, string> = {
      'jest': `
Jest-Specific Guidelines:
- Use describe blocks for grouping related tests
- Utilize beforeEach/afterEach for setup/teardown
- Mock modules with jest.mock()
- Use expect.assertions() for async tests
- Snapshot testing for UI components
- Coverage reports with --coverage flag`,
      
      'mocha': `
Mocha-Specific Guidelines:
- Use describe/it blocks for test organization
- Chai assertions for expectations
- Sinon for mocking and stubbing
- Handle async with done() or return promises
- Use before/after hooks for setup`,
      
      'phpunit': `
PHPUnit-Specific Guidelines:
- Extend TestCase class
- Use setUp() and tearDown() methods
- Data providers for parameterized tests
- Mock objects with getMockBuilder()
- @covers annotation for coverage
- @group annotation for test organization`,
      
      'pytest': `
Pytest-Specific Guidelines:
- Use fixtures for setup/teardown
- Parametrize tests with @pytest.mark.parametrize
- Mock with unittest.mock or pytest-mock
- Use assert statements for expectations
- Mark tests with @pytest.mark decorators`,
      
      'generic': `
General Testing Guidelines:
- Arrange-Act-Assert pattern
- One assertion per test when possible
- Descriptive test names
- Test isolation and independence
- Proper cleanup after tests`
    };
    
    const projectGuidelines: Record<string, string> = {
      'wordpress-plugin': `
WordPress Plugin Test Guidelines:
- Use Brain Monkey for WordPress function mocking
- Mock global WordPress functions
- Test hooks and filters separately
- Verify nonce and capability checks
- Test both admin and frontend contexts`,
      
      'react-app': `
React Application Test Guidelines:
- Use React Testing Library
- Test user interactions over implementation
- Mock API calls with MSW or jest
- Test component integration
- Verify accessibility with testing tools`,
      
      'node-api': `
Node.js API Test Guidelines:
- Use supertest for HTTP testing
- Mock database connections
- Test middleware separately
- Verify error handling
- Test rate limiting and auth`,
      
      'generic': ''
    };
    
    const frameworkGuide = guidelines[framework] || guidelines.generic;
    const projectGuide = projectGuidelines[projectType] || '';
    
    return frameworkGuide + projectGuide;
  }
}

export default UnitTestGenerator;
