# Local LLM MCP Plugin Development Guide v4.2

*Last Updated: August 2025*  
*Version: 4.2.0*  
*Architecture: Modern Plugin System with Security Integration*

## Overview

The Local LLM MCP server uses a sophisticated plugin-based architecture to offload routine tasks to a local LLM (via LM Studio), preserving Claude's context window for strategic work. This guide explains how to develop, test, and integrate new plugins using the latest patterns and security features.

## Technology Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (strict mode)
- **Module System**: ESM (ECMAScript Modules) with `.js` extensions
- **MCP SDK**: `@modelcontextprotocol/sdk` for tool registration
- **LM Studio**: `@lmstudio/sdk` for local LLM communication
- **WebSocket**: Connection to LM Studio at `ws://localhost:1234`
- **Security**: Integrated security wrapper system
- **Response Management**: ResponseFactory for consistent outputs
- **Context Management**: ThreeStagePromptManager for large operations

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
   [Analyze]      [Generate]      [Multifile]     [Custom]
    Plugins        Plugins         Plugins        Plugins
        │              │                │              │
        ▼              ▼                ▼              ▼
  [Security]    [Response]      [3-Stage]      [Dynamic]
   Wrapper       Factory        Prompts       Context
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
│   │   ├── single-file.ts # Modern pattern example
│   │   ├── security-audit.ts
│   │   └── ...
│   ├── generate/          # Generation plugins
│   │   ├── unit-tests.ts
│   │   ├── documentation.ts
│   │   └── ...
│   ├── multifile/         # Multi-file analysis plugins
│   │   ├── find-patterns.ts # Latest pattern example
│   │   └── ...
│   ├── custom/            # Custom/system plugins
│   │   ├── custom-prompt.ts # Universal plugin
│   │   └── ...
│   └── shared/            # Shared utilities
│       ├── helpers.ts     # Common functions
│       └── types.ts       # Shared types
│
├── core/                   # Core functionality
│   ├── ThreeStagePromptManager.ts  # Context window management
│   └── MultiFileAnalysis.ts
│
├── security/               # Security layer
│   ├── integration-helpers.ts     # withSecurity wrapper
│   └── security-service.ts
│
├── validation/             # Response management
│   ├── response-factory.ts       # ResponseFactory class
│   ├── schemas.ts               # TypeScript response types
│   └── output-validator.ts
│
└── types/
    ├── prompt-stages.ts          # 3-stage prompt types
    └── ...
```

## Creating a New Plugin: Modern Pattern

### Step 1: Choose the Category

Determine which category your plugin belongs to:
- **analyze**: Code/file analysis tasks
- **generate**: Code/content generation tasks  
- **multifile**: Cross-file analysis tasks
- **custom**: System utilities and custom tasks

### Step 2: Create the Plugin File

Create a new file in the appropriate category folder following the latest patterns:

```typescript
// src/prompts/analyze/my-analyzer.ts

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { readFileContent, validateAndNormalizePath } from '../shared/helpers.js';

export class MyAnalyzer extends BasePlugin implements IPromptPlugin {
  // Required: Unique name for MCP registration
  name = 'analyze_my_feature';
  
  // Required: Plugin category
  category = 'analyze' as const;
  
  // Required: Human-readable description
  description = 'Analyzes something specific in the code with modern security and context management';
  
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
    analysisDepth: {
      type: 'string' as const,
      description: 'Level of analysis',
      enum: ['basic', 'detailed', 'comprehensive'],
      default: 'detailed',
      required: false
    }
  };

  // MODERN PATTERN: Security wrapper integration
  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // 1. Validate parameters
        this.validateSecureParams(secureParams);
        
        // 2. Process inputs using secure file reading
        let codeToAnalyze = secureParams.code;
        if (secureParams.filePath) {
          codeToAnalyze = await readFileContent(secureParams.filePath);
        }
        
        // 3. Get model information for context management
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        const model = models[0];
        const contextLength = await model.getContextLength() || 23832;
        
        // 4. Generate 3-stage prompt
        const promptStages = this.getPromptStages({
          ...secureParams,
          code: codeToAnalyze
        });
        
        // 5. Determine if chunking is needed
        const promptManager = new ThreeStagePromptManager(contextLength);
        const needsChunking = promptManager.needsChunking(promptStages);
        
        if (needsChunking) {
          return await this.executeWithChunking(promptStages, llmClient, model, promptManager);
        } else {
          return await this.executeDirect(promptStages, llmClient, model);
        }
        
      } catch (error: any) {
        return ResponseFactory.createErrorResponse(
          'analyze_my_feature',
          'EXECUTION_ERROR',
          `Failed to analyze: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  // MODERN PATTERN: 3-Stage prompt architecture
  getPromptStages(params: any): PromptStages {
    const { code, analysisDepth } = params;
    
    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert code analyzer specializing in ${analysisDepth} analysis.

Analysis Context:
- Analysis Depth: ${analysisDepth}
- Code Language: Auto-detected
- Focus: Structure, patterns, quality, security

Your task is to provide actionable insights and recommendations.`;

    // STAGE 2: Data payload (the code to analyze)
    const dataPayload = `Code to analyze:

\`\`\`
${code}
\`\`\``;

    // STAGE 3: Output instructions
    const outputInstructions = `Provide your analysis in the following structured format:

## Summary
Brief overview of the code structure and purpose

## Structure Analysis
- Classes: [list of classes found]
- Functions: [list of functions/methods]
- Dependencies: [external dependencies identified]

## Quality Assessment
### Strengths
- [positive observations]

### Issues Found
- [problems identified with severity levels]

## Recommendations
1. [Priority recommendations]
2. [Performance suggestions]
3. [Security considerations]

## Patterns Detected
- [design patterns or anti-patterns found]

Be specific and actionable in your recommendations.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }

  // MODERN PATTERN: Direct execution for small operations
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
      maxTokens: 4000
    });

    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) {
        response += chunk.content;
      }
    }

    // MODERN PATTERN: ResponseFactory integration
    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'analyze_my_feature',
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
      temperature: 0.2,
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
      'analyze_my_feature',
      response,
      model.identifier || 'unknown'
    );
  }

  // MODERN PATTERN: Secure parameter validation
  private validateSecureParams(params: any): void {
    if (!params.code && !params.filePath) {
      throw new Error('Either code or filePath must be provided');
    }
  }

  // Required: Legacy compatibility method
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
}

export default MyAnalyzer;
```

## Critical Modern Patterns

### 1. Security Wrapper Integration

**EVERY plugin MUST use the security wrapper:**

```typescript
import { withSecurity } from '../../security/integration-helpers.js';

async execute(params: any, llmClient: any) {
  return await withSecurity(this, params, llmClient, async (secureParams) => {
    // Your plugin logic here with secureParams
    // Security checks are automatically applied
  });
}
```

### 2. ResponseFactory Usage

**Use ResponseFactory for consistent, spec-compliant responses:**

```typescript
import { ResponseFactory } from '../../validation/response-factory.js';

// Set execution start time
ResponseFactory.setStartTime();

// Let ResponseFactory parse and structure the LLM response
return ResponseFactory.parseAndCreateResponse(
  'your_function_name',
  llmResponse,
  model.identifier || 'unknown'
);

// For errors
return ResponseFactory.createErrorResponse(
  'your_function_name',
  'ERROR_CODE',
  'Error message',
  { additionalDetails: 'context' },
  'unknown'
);
```

### 3. ThreeStagePromptManager for Context Management

**For large operations that might exceed context limits:**

```typescript
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';

// Get model context length
const contextLength = await model.getContextLength() || 23832;
const promptManager = new ThreeStagePromptManager(contextLength);

// Check if chunking is needed
const needsChunking = promptManager.needsChunking(stages);

if (needsChunking) {
  // Use chunked conversation
  const conversation = promptManager.createChunkedConversation(stages);
  const messages = [
    conversation.systemMessage,
    ...conversation.dataMessages, 
    conversation.analysisMessage
  ];
} else {
  // Use direct messages
  const messages = [
    { role: 'system', content: stages.systemAndContext },
    { role: 'user', content: stages.dataPayload },
    { role: 'user', content: stages.outputInstructions }
  ];
}
```

### 4. Modern LM Studio SDK Usage

**Use the latest SDK patterns:**

```typescript
// Get loaded models
const models = await llmClient.llm.listLoaded();
if (models.length === 0) {
  throw new Error('No model loaded in LM Studio. Please load a model first.');
}

const model = models[0];

// Get context length for management
const contextLength = await model.getContextLength();

// Use streaming responses
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
```

### 5. Secure File Operations

**Always use the secure helpers:**

```typescript
import { readFileContent, validateAndNormalizePath } from '../shared/helpers.js';

// Secure file reading (includes path validation)
const content = await readFileContent(params.filePath);

// Manual path validation if needed
const safePath = await validateAndNormalizePath(params.filePath);
```

## Testing Your Plugin

### Unit Testing Template

```typescript
// src/prompts/analyze/__tests__/my-analyzer.test.ts

import { MyAnalyzer } from '../my-analyzer.js';
import { jest } from '@jest/globals';

describe('MyAnalyzer', () => {
  let analyzer: MyAnalyzer;
  let mockLLMClient: any;
  
  beforeEach(() => {
    analyzer = new MyAnalyzer();
    mockLLMClient = {
      llm: {
        listLoaded: jest.fn()
      }
    };
    
    // Mock a loaded model
    const mockModel = {
      getContextLength: jest.fn().mockResolvedValue(23832),
      respond: jest.fn().mockReturnValue((async function* () {
        yield { content: 'Mock analysis response' };
      })()),
      identifier: 'test-model'
    };
    
    mockLLMClient.llm.listLoaded.mockResolvedValue([mockModel]);
  });
  
  test('validates required parameters', async () => {
    await expect(
      analyzer.execute({}, mockLLMClient)
    ).rejects.toThrow('Either code or filePath must be provided');
  });
  
  test('generates correct 3-stage prompt', () => {
    const stages = analyzer.getPromptStages({
      code: 'const x = 1;',
      analysisDepth: 'basic'
    });
    
    expect(stages.systemAndContext).toContain('basic analysis');
    expect(stages.dataPayload).toContain('const x = 1;');
    expect(stages.outputInstructions).toContain('Summary');
  });
  
  test('executes successfully with security wrapper', async () => {
    const result = await analyzer.execute(
      { code: 'test code', analysisDepth: 'basic' },
      mockLLMClient
    );
    
    expect(result.success).toBe(true);
    expect(mockLLMClient.llm.listLoaded).toHaveBeenCalled();
  });
});
```

## Build and Deployment

### Build Process

**Important: Always stop and restart Claude when building:**

```bash
# Build the project
npm run build

# CRITICAL: Restart Claude Desktop after building
# The MCP server needs to reload with new changes
```

### Development Workflow

1. **Create Plugin**: Follow modern patterns
2. **Test**: Write comprehensive tests
3. **Build**: `npm run build`
4. **Restart Claude**: Essential step!
5. **Verify**: Test via Claude Desktop

### Avoid Common Pitfalls

```typescript
// ❌ DON'T: Use old llmClient.complete pattern
const response = await llmClient.complete(prompt);

// ✅ DO: Use modern LM Studio SDK
const models = await llmClient.llm.listLoaded();
const model = models[0];
const prediction = model.respond(messages, options);

// ❌ DON'T: Use console.log with emojis (breaks JSON-RPC)
console.log('🚀 Starting analysis...');

// ✅ DO: Use plain text logging
console.log('Starting analysis...');

// ❌ DON'T: Skip security wrapper
async execute(params, llmClient) {
  // Direct implementation
}

// ✅ DO: Always use security wrapper  
async execute(params, llmClient) {
  return await withSecurity(this, params, llmClient, async (secureParams) => {
    // Secure implementation
  });
}
```

## Advanced Patterns

### Dynamic Context Window Management

```typescript
// Automatically adjust processing based on content size
const estimatedTokens = Math.floor(content.length / 4);
const contextLength = await model.getContextLength();

if (estimatedTokens > contextLength * 0.8) {
  // Use file chunking strategy
  return await this.executeWithFileChunking(files, params, llmClient, model);
} else {
  // Process normally
  return await this.executeSinglePass(content, params, llmClient, model);
}
```

### Custom Prompt Function Usage

**For highly flexible operations:**

```typescript
// Use the custom_prompt function for tasks that don't fit standard patterns
const customResult = await llmClient.executePlugin('custom_prompt', {
  prompt: 'Analyze this code for specific patterns...',
  files: [filePath],
  context: {
    task_type: 'pattern_analysis',
    output_format: 'structured_json'
  }
});
```

### Multi-Stage Processing

```typescript
// Break complex operations into stages
async execute(params: any, llmClient: any) {
  return await withSecurity(this, params, llmClient, async (secureParams) => {
    // Stage 1: Initial analysis
    const analysis = await this.performInitialAnalysis(secureParams, llmClient);
    
    // Stage 2: Deep dive based on initial findings
    const deepAnalysis = await this.performDeepAnalysis(analysis, llmClient);
    
    // Stage 3: Generate recommendations
    const recommendations = await this.generateRecommendations(deepAnalysis, llmClient);
    
    return this.combineResults(analysis, deepAnalysis, recommendations);
  });
}
```

## Performance Optimization

### Context Window Management

- Always check model context length: `await model.getContextLength()`
- Use ThreeStagePromptManager for automatic chunking decisions
- Monitor token usage and implement chunking strategies
- Process files in parallel where possible

### Response Caching

```typescript
// Use caching for expensive operations
const cacheKey = `analysis_${fileHash}`;
const cached = await this.getFromCache(cacheKey);
if (cached) return cached;

const result = await this.performAnalysis(params, llmClient);
await this.setCache(cacheKey, result);
return result;
```

## Troubleshooting

### Common Issues

1. **"No model loaded in LM Studio"**
   - Ensure LM Studio is running with a loaded model
   - Check WebSocket connection at `ws://localhost:1234`

2. **Security violations**
   - All file paths are validated through `validateAndNormalizePath`
   - Use `withSecurity` wrapper for all plugins
   - Check allowed directories configuration

3. **Context window exceeded**
   - Implement ThreeStagePromptManager
   - Use file chunking strategies
   - Consider breaking large operations into smaller tasks

4. **Plugin not registering**
   - Ensure file uses `.js` extension imports
   - Check default export is the plugin class
   - Verify plugin name is unique
   - Rebuild and restart Claude

### Debug Patterns

```typescript
// Enable detailed logging
import debug from 'debug';
const log = debug('local-llm:my-analyzer');

async execute(params: any, llmClient: any) {
  log('Executing with params:', JSON.stringify(params, null, 2));
  
  try {
    const result = await this.performAnalysis(params, llmClient);
    log('Analysis completed successfully');
    return result;
  } catch (error) {
    log('Error occurred:', error.message);
    throw error;
  }
}
```

## Version History & Migration

### v4.2 (Current) - Modern Security Integration
- **withSecurity** wrapper for all plugins
- **ResponseFactory** for consistent outputs
- **ThreeStagePromptManager** for context management
- **Dynamic context window** detection
- **Foreign prompt execution** prevention

### Migrating Old Plugins

```typescript
// OLD PATTERN (v4.1)
async execute(params: any, llmClient: any) {
  const prompt = this.getPrompt(params);
  const response = await llmClient.complete(prompt);
  return { content: response };
}

// NEW PATTERN (v4.2)
async execute(params: any, llmClient: any) {
  return await withSecurity(this, params, llmClient, async (secureParams) => {
    const models = await llmClient.llm.listLoaded();
    const model = models[0];
    
    const stages = this.getPromptStages(secureParams);
    const prediction = model.respond(messages, options);
    
    let response = '';
    for await (const chunk of prediction) {
      if (chunk.content) response += chunk.content;
    }
    
    return ResponseFactory.parseAndCreateResponse(
      this.name,
      response,
      model.identifier
    );
  });
}
```

## Resources

- **MCP SDK Documentation**: [Model Context Protocol](https://modelcontextprotocol.org)
- **LM Studio SDK**: [LM Studio Documentation](https://lmstudio.ai/docs)
- **TypeScript Handbook**: [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- **Plugin Examples**: `src/prompts/` directory
- **Security Patterns**: `src/security/integration-helpers.ts`
- **Response Patterns**: `src/validation/response-factory.ts`

---

*This guide reflects the current v4.2 architecture with modern security integration, dynamic context window management, and the latest LM Studio SDK patterns. Always use these patterns for new plugins to ensure compatibility and security.*