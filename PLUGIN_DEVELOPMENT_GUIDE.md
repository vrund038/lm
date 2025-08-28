# Local LLM MCP Plugin Architecture - Developer Integration Guide

## Overview

The Local LLM MCP server uses a plugin-based architecture to offload routine tasks to a local LLM (via LM Studio), preserving Claude's context window for strategic work. This guide explains how to develop, test, and integrate new plugins.

## Technology Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (strict mode)
- **Module System**: ESM (ECMAScript Modules)
- **MCP SDK**: `@modelcontextprotocol/sdk` for tool registration
- **LLM Client**: `@lmstudio/sdk` for local LLM communication
- **WebSocket**: Connection to LM Studio at `ws://localhost:1234`

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude Desktop │────▶│  MCP Server      │────▶│   LM Studio     │
│  (MCP Client)   │◀────│  (Plugin System) │◀────│   (Local LLM)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Plugin Registry   │
                    └─────────────────────┘
                               │
        ┌──────────────┬───────┴────────┬──────────────┐
        ▼              ▼                ▼              ▼
   [Analyze]      [Generate]      [Multifile]     [System]
    Plugins        Plugins         Plugins        Plugins
```

## Directory Structure

```
src/
├── plugins/                 # Plugin system core
│   ├── base-plugin.ts      # Base class all plugins extend
│   ├── index.ts            # Plugin loader and registry
│   └── types.ts            # TypeScript interfaces
│
├── prompts/                # Plugin implementations
│   ├── analyze/           # Analysis plugins
│   │   ├── single-file.ts
│   │   ├── security-audit.ts
│   │   └── ...
│   ├── generate/          # Generation plugins
│   │   ├── unit-tests.ts
│   │   ├── documentation.ts
│   │   └── ...
│   ├── multifile/         # Multi-file analysis plugins
│   │   └── ...
│   └── shared/            # Shared utilities
│       ├── helpers.ts     # Common functions
│       ├── templates.ts   # Prompt templates
│       ├── types.ts       # Shared types
│       └── cache-manager.ts
│
├── core/                   # Core functionality
│   ├── MultiFileAnalysis.ts
│   ├── ResponseFormatter.ts
│   └── FileContextManager.ts
│
├── system/                 # System utilities
│   └── health-check.ts
│
└── index.ts               # Main server entry point
```

## Creating a New Plugin

### Step 1: Choose the Category

Determine which category your plugin belongs to:
- **analyze**: Code/file analysis tasks
- **generate**: Code/content generation tasks
- **multifile**: Cross-file analysis tasks
- **system**: Utility/maintenance tasks

### Step 2: Create the Plugin File

Create a new file in the appropriate category folder:

```typescript
// src/prompts/analyze/my-analyzer.ts

import { BasePlugin } from '../../plugins/base-plugin';
import { IPromptPlugin } from '../../plugins/types';
import { validateRequiredParams, readFileContent } from '../shared/helpers';

export class MyAnalyzer extends BasePlugin implements IPromptPlugin {
  // Required: Unique name for MCP registration
  name = 'analyze_my_feature';
  
  // Required: Plugin category
  category = 'analyze' as const;
  
  // Required: Human-readable description
  description = 'Analyzes something specific in the code';
  
  // Required: Parameter definitions
  parameters = {
    code: {
      type: 'string' as const,
      description: 'The code to analyze',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to the file to analyze',
      required: false
    },
    analysisType: {
      type: 'string' as const,
      description: 'Type of analysis to perform',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    }
  };

  // Required: Execute the plugin
  async execute(params: any, llmClient: any) {
    // 1. Validate parameters
    this.validateParams(params);
    
    // 2. Custom validation
    if (!params.code && !params.filePath) {
      throw new Error('Either code or filePath must be provided');
    }
    
    // 3. Process inputs
    let codeToAnalyze = params.code;
    if (params.filePath) {
      // Security checks are handled in readFileContent
      codeToAnalyze = await readFileContent(params.filePath);
    }
    
    // 4. Generate prompt
    const prompt = this.getPrompt({ ...params, code: codeToAnalyze });
    
    // 5. Call LLM and return response
    const response = await llmClient.complete(prompt);
    return this.formatResponse(response);
  }

  // Required: Generate the prompt for the LLM
  getPrompt(params: any): string {
    const { code, analysisType } = params;
    
    return `
      You are an expert code analyzer. Analyze the following code with a focus on ${analysisType} analysis.
      
      Code to analyze:
      \`\`\`
      ${code}
      \`\`\`
      
      Provide your analysis in the following format:
      1. Summary: Brief overview
      2. Key Findings: Important observations
      3. Issues: Any problems found
      4. Suggestions: Recommendations for improvement
      
      Be specific and actionable in your recommendations.
    `;
  }

  // Optional: Format the LLM response
  private formatResponse(response: string): any {
    // Parse or structure the response as needed
    return {
      analysis: response,
      timestamp: new Date().toISOString()
    };
  }
}

export default MyAnalyzer;
```

### Step 3: Register the Plugin

The plugin is automatically registered when the server starts, thanks to the plugin loader. No manual registration needed!

## Plugin Development Best Practices

### 1. Parameter Validation

Always validate parameters using the base class methods:

```typescript
async execute(params: any, llmClient: any) {
  // Automatic validation based on parameter definitions
  this.validateParams(params);
  
  // Custom validation for complex rules
  if (params.startLine > params.endLine) {
    throw new Error('Start line must be before end line');
  }
}
```

### 2. File Handling

Use the security-checked helpers for file operations:

```typescript
import { readFileContent, isPathSafe } from '../shared/helpers';

// Safe file reading with automatic security checks
const content = await readFileContent(params.filePath);

// Manual path validation if needed
if (!isPathSafe(params.outputPath)) {
  throw new Error('Invalid output path');
}
```

### 3. Prompt Engineering

Structure prompts for consistency and quality:

```typescript
getPrompt(params: any): string {
  // Use templates for common patterns
  const baseInstructions = COMMON_INSTRUCTIONS.codeQuality;
  
  // Be specific about output format
  const outputFormat = `
    Provide your response as a JSON object with:
    - summary: string
    - findings: array of objects
    - suggestions: array of strings
  `;
  
  // Include context when relevant
  const context = params.context ? `
    Project context: ${params.context.projectType}
    Framework: ${params.context.framework}
  ` : '';
  
  return `${baseInstructions}\n${context}\n${outputFormat}\n\nCode:\n${params.code}`;
}
```

### 4. Error Handling

Provide clear, actionable error messages:

```typescript
async execute(params: any, llmClient: any) {
  try {
    // ... plugin logic
  } catch (error) {
    // Add context to errors
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${params.filePath}`);
    }
    
    // Re-throw with more information
    throw new Error(`Failed to analyze: ${error.message}`);
  }
}
```

### 5. Response Formatting

Use the ResponseFormatter for consistent output:

```typescript
import { ResponseFormatter } from '../../core/ResponseFormatter';

async execute(params: any, llmClient: any) {
  const formatter = new ResponseFormatter();
  const response = await llmClient.complete(prompt);
  
  // Parse and structure the response
  return formatter.format(response, 'analysis');
}
```

## Testing Your Plugin

### 1. Unit Testing

Create a test file for your plugin:

```typescript
// src/prompts/analyze/__tests__/my-analyzer.test.ts

import { MyAnalyzer } from '../my-analyzer';

describe('MyAnalyzer', () => {
  let analyzer: MyAnalyzer;
  let mockLLMClient: any;
  
  beforeEach(() => {
    analyzer = new MyAnalyzer();
    mockLLMClient = {
      complete: jest.fn()
    };
  });
  
  test('validates required parameters', () => {
    expect(() => {
      analyzer.validateParams({});
    }).toThrow('Either code or filePath must be provided');
  });
  
  test('generates correct prompt', () => {
    const prompt = analyzer.getPrompt({
      code: 'const x = 1;',
      analysisType: 'basic'
    });
    
    expect(prompt).toContain('const x = 1;');
    expect(prompt).toContain('basic analysis');
  });
  
  test('executes successfully', async () => {
    mockLLMClient.complete.mockResolvedValue('Analysis results...');
    
    const result = await analyzer.execute(
      { code: 'test code', analysisType: 'basic' },
      mockLLMClient
    );
    
    expect(result).toHaveProperty('analysis');
    expect(mockLLMClient.complete).toHaveBeenCalled();
  });
});
```

### 2. Integration Testing

Test with the actual MCP server:

```typescript
// test/integration/plugin-integration.test.ts

import { PluginLoader } from '../../src/plugins';
import { LMStudioClient } from '@lmstudio/sdk';

describe('Plugin Integration', () => {
  let loader: PluginLoader;
  let client: LMStudioClient;
  
  beforeAll(async () => {
    loader = new PluginLoader();
    await loader.loadPlugins('./src/prompts');
    
    client = new LMStudioClient({
      baseUrl: 'ws://localhost:1234'
    });
  });
  
  test('plugin loads and executes', async () => {
    const result = await loader.executePlugin(
      'analyze_my_feature',
      { code: 'test code' },
      client
    );
    
    expect(result).toBeDefined();
  });
});
```

### 3. Manual Testing

Use the MCP test client:

```bash
# Run the server in development mode
npm run dev

# In another terminal, test your plugin
npx @modelcontextprotocol/test-client
```

## Common Patterns

### Pattern 1: File or Direct Input

Many plugins accept either a file path or direct content:

```typescript
parameters = {
  code: { type: 'string', required: false },
  filePath: { type: 'string', required: false }
};

async execute(params: any, llmClient: any) {
  if (!params.code && !params.filePath) {
    throw new Error('Either code or filePath required');
  }
  
  const content = params.code || await readFileContent(params.filePath);
  // ... process content
}
```

### Pattern 2: Context-Aware Analysis

Plugins can adapt based on project context:

```typescript
getPrompt(params: any): string {
  const { context } = params;
  
  let frameworkInstructions = '';
  if (context?.projectType === 'wordpress-plugin') {
    frameworkInstructions = COMMON_INSTRUCTIONS.frameworkSpecific.wordpress;
  } else if (context?.projectType === 'react-app') {
    frameworkInstructions = COMMON_INSTRUCTIONS.frameworkSpecific.react;
  }
  
  return `${frameworkInstructions}\n\nAnalyze: ${params.code}`;
}
```

### Pattern 3: Multi-Stage Processing

For complex operations, break into stages:

```typescript
async execute(params: any, llmClient: any) {
  // Stage 1: Initial analysis
  const analysisPrompt = this.getAnalysisPrompt(params);
  const analysis = await llmClient.complete(analysisPrompt);
  
  // Stage 2: Generate improvements based on analysis
  const improvementPrompt = this.getImprovementPrompt(analysis);
  const improvements = await llmClient.complete(improvementPrompt);
  
  // Stage 3: Format final output
  return this.combineResults(analysis, improvements);
}
```

## Performance Optimization

### 1. Caching

Use the cache manager for expensive operations:

```typescript
import { CacheManager } from '../shared/cache-manager';

async execute(params: any, llmClient: any) {
  const cacheKey = `analysis_${params.filePath}`;
  
  // Check cache first
  const cached = CacheManager.get(cacheKey);
  if (cached) return cached;
  
  // Perform analysis
  const result = await this.performAnalysis(params, llmClient);
  
  // Cache the result
  CacheManager.set(cacheKey, result);
  return result;
}
```

### 2. Prompt Size Management

Keep prompts concise to maximize LLM performance:

```typescript
getPrompt(params: any): string {
  let code = params.code;
  
  // Truncate very long code
  if (code.length > 10000) {
    code = code.substring(0, 10000) + '\n... [truncated]';
  }
  
  // Focus on specific sections if provided
  if (params.startLine && params.endLine) {
    const lines = code.split('\n');
    code = lines.slice(params.startLine - 1, params.endLine).join('\n');
  }
  
  return `Analyze this code:\n${code}`;
}
```

### 3. Parallel Processing

For multi-file operations, process in parallel:

```typescript
async execute(params: any, llmClient: any) {
  const { files } = params;
  
  // Process files in parallel
  const promises = files.map(file => 
    this.analyzeFile(file, llmClient)
  );
  
  const results = await Promise.all(promises);
  return this.mergeResults(results);
}
```

## Debugging

### 1. Enable Debug Logging

Set environment variable for detailed logs:

```bash
DEBUG=local-llm:* npm run dev
```

### 2. Add Debug Points

Use debug statements in your plugin:

```typescript
import debug from 'debug';
const log = debug('local-llm:my-analyzer');

async execute(params: any, llmClient: any) {
  log('Executing with params:', params);
  
  const prompt = this.getPrompt(params);
  log('Generated prompt length:', prompt.length);
  
  const response = await llmClient.complete(prompt);
  log('Response received:', response.substring(0, 100));
  
  return response;
}
```

### 3. Test Prompts Directly

Test prompts with LM Studio directly:

```typescript
// test-prompt.ts
import { MyAnalyzer } from './src/prompts/analyze/my-analyzer';

const analyzer = new MyAnalyzer();
const prompt = analyzer.getPrompt({
  code: 'const x = 1;',
  analysisType: 'basic'
});

console.log('Generated Prompt:');
console.log(prompt);
console.log('\nPrompt length:', prompt.length);
```

## Deployment

### 1. Build for Production

```bash
# Compile TypeScript
npm run build

# Run tests
npm test

# Start production server
npm start
```

### 2. Configuration

Ensure configuration is correct:

```javascript
// config.ts
export const config = {
  lmStudioUrl: process.env.LM_STUDIO_URL || 'ws://localhost:1234',
  maxPromptLength: 15000,
  cacheEnabled: true,
  securityConfig: {
    allowedDirectories: [
      process.env.ALLOWED_DIR || process.cwd()
    ]
  }
};
```

### 3. MCP Registration

The plugin is automatically available to Claude Desktop once registered:

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["C:\\MCP\\local-llm-mcp\\dist\\index.js"]
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Plugin not loading**
   - Check file name matches pattern: `*.ts` or `*.js`
   - Verify export default is the plugin class
   - Check for syntax errors in the file

2. **LM Studio connection fails**
   - Ensure LM Studio is running
   - Check WebSocket URL is correct
   - Verify a model is loaded in LM Studio

3. **Parameter validation errors**
   - Review parameter definitions match usage
   - Check required parameters are provided
   - Verify enum values are correct

4. **Prompt too large**
   - Implement truncation for large inputs
   - Consider chunking strategies
   - Use summarization for context

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-plugin`
3. Implement your plugin following this guide
4. Add tests for your plugin
5. Update documentation
6. Submit a pull request

## Resources

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [LM Studio Documentation](https://lmstudio.ai/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Plugin Examples](./src/prompts/)

## Support

For questions or issues:
1. Check existing plugins for examples
2. Review test files for patterns
3. Open an issue on GitHub
4. Contact the maintainers

---

*Last Updated: December 2024*  
*Version: 1.0.0*
