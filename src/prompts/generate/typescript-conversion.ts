/**
 * TypeScript Conversion Plugin - Modern v4.2 Architecture
 * Converts JavaScript code to TypeScript with comprehensive type annotations
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../shared/types.js';
import { readFileContent } from '../shared/helpers.js';
import { ResponseFactory } from '../../validation/response-factory.js';
import { withSecurity } from '../../security/integration-helpers.js';
import { ThreeStagePromptManager } from '../../core/ThreeStagePromptManager.js';
import { PromptStages } from '../../types/prompt-stages.js';

// Type definitions for TypeScript context
interface TSContext {
  strict?: boolean;
  target?: string;
  module?: string;
  preserveComments?: boolean;
  addTypeGuards?: boolean;
  useInterfaces?: boolean;
  useEnums?: boolean;
}

export class TypeScriptConverter extends BasePlugin implements IPromptPlugin {
  name = 'convert_to_typescript';
  category = 'generate' as const;
  description = 'Convert JavaScript code to TypeScript with comprehensive type annotations';
  
  parameters = {
    code: {
      type: 'string' as const,
      description: 'JavaScript code to convert',
      required: false
    },
    filePath: {
      type: 'string' as const,
      description: 'Path to JavaScript file',
      required: false
    },
    strict: {
      type: 'boolean' as const,
      description: 'Use strict TypeScript mode',
      required: false,
      default: true
    },
    target: {
      type: 'string' as const,
      description: 'TypeScript target',
      required: false,
      default: 'ES2020'
    },
    module: {
      type: 'string' as const,
      description: 'Module system',
      required: false,
      default: 'ESNext'
    },
    preserveComments: {
      type: 'boolean' as const,
      description: 'Preserve original comments',
      required: false,
      default: true
    },
    addTypeGuards: {
      type: 'boolean' as const,
      description: 'Add type guard functions',
      required: false,
      default: true
    },
    useInterfaces: {
      type: 'boolean' as const,
      description: 'Prefer interfaces over type aliases',
      required: false,
      default: true
    },
    useEnums: {
      type: 'boolean' as const,
      description: 'Use enums for fixed values',
      required: false,
      default: true
    }
  };

  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      try {
        // Validate at least one input provided
        if (!secureParams.code && !secureParams.filePath) {
          throw new Error('Either code or filePath must be provided');
        }
        
        // Read file if needed
        let jsCode = secureParams.code;
        if (secureParams.filePath) {
          jsCode = await readFileContent(secureParams.filePath);
        }
        
        // Get loaded models
        const models = await llmClient.llm.listLoaded();
        if (models.length === 0) {
          throw new Error('No model loaded in LM Studio. Please load a model first.');
        }
        
        const model = models[0];
        const contextLength = await model.getContextLength() || 23832;
        
        // Generate 3-stage prompt
        const promptStages = this.getPromptStages({
          ...secureParams,
          code: jsCode
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
          'convert_to_typescript',
          'EXECUTION_ERROR',
          `Failed to convert to TypeScript: ${error.message}`,
          { originalError: error.message },
          'unknown'
        );
      }
    });
  }

  getPromptStages(params: any): PromptStages {
    const context: TSContext = {
      strict: params.strict !== false,
      target: params.target || 'ES2020',
      module: params.module || 'ESNext',
      preserveComments: params.preserveComments !== false,
      addTypeGuards: params.addTypeGuards !== false,
      useInterfaces: params.useInterfaces !== false,
      useEnums: params.useEnums !== false
    };

    // STAGE 1: System instructions and context
    const systemAndContext = `You are an expert TypeScript developer specializing in JavaScript to TypeScript conversion. Your task is to create comprehensive, type-safe TypeScript code with modern best practices.

Conversion Configuration:
- Strict Mode: ${context.strict}
- Target: ${context.target}
- Module System: ${context.module}
- Preserve Comments: ${context.preserveComments}
- Add Type Guards: ${context.addTypeGuards}
- Use Interfaces: ${context.useInterfaces}
- Use Enums: ${context.useEnums}

Your conversion must maintain runtime behavior while adding comprehensive type safety and catching potential bugs at compile time.`;

    // STAGE 2: Data payload (the JavaScript code to convert)
    const dataPayload = `JavaScript code to convert to TypeScript:

\`\`\`javascript
${params.code}
\`\`\``;

    // STAGE 3: Output instructions
    const outputInstructions = `Convert the JavaScript code to TypeScript following these requirements:

## Type Annotations
- Add explicit types to all function parameters
- Add return type annotations
- Type all variables (avoid implicit any)
- Use union types where appropriate
- Add generic types where beneficial

## Interface and Type Definitions
${context.useInterfaces ? '- Create interfaces for all object shapes' : '- Use type aliases for object shapes'}
- Define function signatures with proper types
${context.useEnums ? '- Create enums for fixed sets of values' : '- Use union types instead of enums'}
- Add index signatures where needed
- Use utility types (Partial, Required, etc.)

## Advanced TypeScript Features
- Implement generics for reusable components
${context.addTypeGuards ? '- Add type guards for runtime type checking' : '- Use basic type assertions where needed'}
- Add const assertions for immutable data
- Use conditional types if beneficial
- Implement proper null/undefined handling

## Code Structure
- Convert require() statements to ES6 imports
- Add proper export statements
- Maintain ${context.preserveComments ? 'original comments and add TSDoc' : 'essential comments only'}
- Follow ${context.strict ? 'strict TypeScript' : 'relaxed TypeScript'} rules

## Error Handling and Edge Cases
- Type error objects appropriately
- Add proper Promise rejection types
- Handle async/await type inference
- Type event handlers correctly

## Output Format
Provide your response in this structure:

### Converted TypeScript Code
The fully typed TypeScript implementation

### Type Definitions
Additional interfaces, types, and enums (if any)

### Configuration Notes
Recommended tsconfig.json settings for this code

### Migration Notes
Any potential runtime behavior changes or warnings

### Type Safety Improvements
Explanation of how types prevent potential bugs

Ensure the converted code passes strict TypeScript compilation and maintains identical runtime behavior.`;

    return {
      systemAndContext,
      dataPayload,
      outputInstructions
    };
  }

  // Direct execution for small operations
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

    ResponseFactory.setStartTime();
    return ResponseFactory.parseAndCreateResponse(
      'convert_to_typescript',
      response,
      model.identifier || 'unknown'
    );
  }

  // Chunked execution for large operations
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
      'convert_to_typescript',
      response,
      model.identifier || 'unknown'
    );
  }

  // Legacy compatibility method
  getPrompt(params: any): string {
    const stages = this.getPromptStages(params);
    return `${stages.systemAndContext}\n\n${stages.dataPayload}\n\n${stages.outputInstructions}`;
  }
}

export default TypeScriptConverter;
