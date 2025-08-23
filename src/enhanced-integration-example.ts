// Example integration of enhanced prompts into existing config.ts
// This shows how to update the current implementation

import { TaskType } from './types';
import { 
  createCodeStructurePrompt,
  createUnitTestPrompt,
  createDocumentationPrompt,
  createRefactoringPrompt
} from './enhanced-prompts';

// Example: Updating the CODE_STRUCTURE prompt to be context-aware
export const enhancedTaskPrompts = {
  [TaskType.CODE_STRUCTURE]: {
    systemPrompt: 'You are an expert code analyzer with deep knowledge of various frameworks and best practices.',
    prompt: (content: string, language?: string, additionalParams?: any) => {
      // Check if context is provided
      if (additionalParams?.context) {
        // Use enhanced context-aware prompt
        return createCodeStructurePrompt(content, {
          ...additionalParams.context,
          language: language || additionalParams.context.language
        });
      }
      
      // Fallback to existing prompt for backward compatibility
      return `Analyze the structure of this ${language || 'code'}:
1. Identify main components (classes, functions, modules)
2. Describe the overall architecture
3. List dependencies
4. Identify design patterns used
5. Suggest improvements

Code:
${content}`;
    }
  },

  [TaskType.GENERATE_TESTS]: {
    systemPrompt: 'You are a test generation expert familiar with various testing frameworks.',
    prompt: (content: string, language?: string, additionalParams?: any) => {
      // Enhanced version with context
      if (additionalParams?.context) {
        return createUnitTestPrompt(content, additionalParams.context);
      }
      
      // Existing prompt
      const framework = additionalParams?.framework || 'appropriate testing framework';
      return `Generate comprehensive unit tests for this ${language || 'code'}.
Use ${framework} and follow best practices.
Include:
1. Happy path tests
2. Edge cases
3. Error scenarios
4. Mock external dependencies

Code:
${content}`;
    }
  },

  [TaskType.DOCUMENT_FUNCTION]: {
    systemPrompt: 'You are a documentation expert who creates clear, comprehensive docs.',
    prompt: (content: string, language?: string, additionalParams?: any) => {
      // Enhanced version
      if (additionalParams?.context) {
        return createDocumentationPrompt(content, additionalParams.context);
      }
      
      // Existing prompt
      const docStyle = additionalParams?.docStyle || 'comprehensive';
      return `Generate ${docStyle} documentation for this ${language || 'code'}.
Include:
1. Overview/purpose
2. Parameters and return values
3. Usage examples
4. Any side effects or important notes

Code:
${content}`;
    }
  },

  [TaskType.SUGGEST_REFACTOR]: {
    systemPrompt: 'You are a refactoring expert who improves code quality.',
    prompt: (content: string, language?: string, additionalParams?: any) => {
      // Enhanced version
      if (additionalParams?.context) {
        return createRefactoringPrompt(content, additionalParams.context);
      }
      
      // Existing prompt
      return `Suggest refactoring improvements for this ${language || 'code'}:
1. Identify code smells
2. Suggest design pattern improvements
3. Improve readability
4. Enhance performance where possible
5. Provide refactored code

Code:
${content}`;
    }
  }
};

// Backward compatible configuration merger
export function mergeWithExistingConfig(existingConfig: any) {
  return {
    ...existingConfig,
    taskPrompts: {
      ...existingConfig.taskPrompts,
      // Override with enhanced versions
      [TaskType.CODE_STRUCTURE]: enhancedTaskPrompts[TaskType.CODE_STRUCTURE],
      [TaskType.GENERATE_TESTS]: enhancedTaskPrompts[TaskType.GENERATE_TESTS],
      [TaskType.DOCUMENT_FUNCTION]: enhancedTaskPrompts[TaskType.DOCUMENT_FUNCTION],
      [TaskType.SUGGEST_REFACTOR]: enhancedTaskPrompts[TaskType.SUGGEST_REFACTOR],
    }
  };
}

// Example usage from Claude's perspective:
/*
// Without context (works like before)
await local_llm.analyze_code_structure({
  filePath: 'C:\\Dev\\my-file.js'
});

// With context (enhanced output)
await local_llm.analyze_code_structure({
  filePath: 'C:\\Dev\\wp-plugin\\plugin.php',
  additionalParams: {
    context: {
      projectType: 'wordpress-plugin',
      language: 'PHP',
      framework: 'WordPress',
      standards: ['WordPress Coding Standards', 'PSR-12']
    }
  }
});
*/