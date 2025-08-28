/**
 * TypeScript Conversion Plugin
 * Converts JavaScript code to TypeScript with comprehensive type annotations
 */

import { BasePlugin } from '../../plugins/base-plugin.js';
import { IPromptPlugin } from '../../plugins/types.js';
import { readFileContent } from '../shared/helpers.js';

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
    // Validate at least one input provided
    if (!params.code && !params.filePath) {
      throw new Error('Either code or filePath must be provided');
    }
    
    // Read file if needed
    let jsCode = params.code;
    if (params.filePath) {
      jsCode = await readFileContent(params.filePath);
    }
    
    // Prepare context with defaults
    const context: TSContext = {
      strict: params.strict !== false,
      target: params.target || 'ES2020',
      module: params.module || 'ESNext',
      preserveComments: params.preserveComments !== false,
      addTypeGuards: params.addTypeGuards !== false,
      useInterfaces: params.useInterfaces !== false,
      useEnums: params.useEnums !== false
    };
    
    // Generate prompt
    const prompt = this.getPrompt({ code: jsCode, context });
    
    // Execute and return
    const response = await llmClient.complete(prompt);
    
    // Format response
    return {
      content: response,
      metadata: {
        strict: context.strict,
        target: context.target,
        module: context.module
      }
    };
  }

  getPrompt(params: any): string {
    const jsCode = params.code;
    const context = params.context || {};
    
    const { strict = true, target = 'ES2020', module = 'ESNext' } = context;
    
    return `Convert this JavaScript code to TypeScript with comprehensive typing:

TypeScript Configuration:
- Strict Mode: ${strict}
- Target: ${target}
- Module: ${module}
- Preserve Comments: ${context.preserveComments !== false}
- Add Type Guards: ${context.addTypeGuards !== false}
- Use Interfaces: ${context.useInterfaces !== false}
- Use Enums: ${context.useEnums !== false}

Conversion Requirements:

1. **Type Annotations**:
   - Add explicit types to all function parameters
   - Add return type annotations
   - Type all variables (avoid implicit any)
   - Use union types where appropriate
   - Add generic types where beneficial

2. **Interface/Type Definitions**:
   - Create interfaces for all object shapes
   - Use type aliases for complex types
   - Define function signatures
   - Create enums for fixed sets of values
   - Add index signatures where needed

3. **Advanced TypeScript Features**:
   - Use generics for reusable components
   - Implement type guards for runtime checks
   - Add const assertions where immutable
   - Use conditional types if beneficial
   - Implement utility types (Partial, Required, etc.)

4. **Null/Undefined Handling**:
   - Use strict null checks
   - Add optional chaining where safe
   - Implement nullish coalescing
   - Type guards for null checks
   - Proper optional property marking

5. **Module System**:
   - Convert requires to imports
   - Add export statements
   - Type external module imports
   - Create .d.ts files if needed

6. **Error Handling**:
   - Type error objects
   - Add try-catch types
   - Custom error classes
   - Proper Promise rejection types

7. **Documentation**:
   - Convert JSDoc to TSDoc format
   - Add @param and @returns types
   - Include @throws documentation
   - Add @example blocks

JavaScript code to convert:
${jsCode}

Provide:
1. **Fully typed TypeScript code**
2. **Required type definitions** (interfaces, types, enums)
3. **Explanation of complex type decisions**
4. **Any necessary configuration notes**
5. **Migration warnings** (potential runtime differences)

Ensure the converted code:
- Passes strict TypeScript checks
- Maintains the same runtime behavior
- Is more maintainable with types
- Catches potential bugs at compile time`;
  }
}

export default TypeScriptConverter;
