import { Config, TaskType } from './types.js';

export const config: Config = {
  lmStudioUrl: process.env.LM_STUDIO_URL || 'ws://localhost:1234',
  modelName: process.env.LM_STUDIO_MODEL || 'auto',
  temperature: 0.1,
  maxTokens: 2000,
  topP: 0.95,
  timeout: 30000,
  maxFileSize: 200 * 1024 * 1024,  // 200MB limit
  supportedFileTypes: ['.csv', '.json', '.txt', '.js', '.ts', '.py', '.md', '.log', '.jsx', '.tsx', '.java', '.c', '.cpp', '.rs', '.go', '.php', '.rb', '.swift'],
  
  taskPrompts: {
    [TaskType.CODE_STRUCTURE]: {
      systemPrompt: 'You are a code analysis assistant. Provide clear, structured analysis of code. Be concise and technical.',
      prompt: (content: string, language?: string) => 
        `Analyse the structure of this ${language || 'code'} and provide:
1. All classes/types with their purpose
2. All functions/methods with parameters
3. All imports and dependencies
4. All exports
5. Key variables and constants

Format as structured text, not JSON.

Code:
${content}`
    },

    [TaskType.GENERATE_TESTS]: {
      systemPrompt: 'You are a test generation expert. Create comprehensive unit tests using appropriate testing frameworks.',
      prompt: (content: string, language?: string) => 
        `Generate comprehensive unit tests for this ${language || 'code'}.
Use the appropriate testing framework for the language.
Include edge cases and error scenarios.
Make tests readable and well-organised.

Code to test:
${content}`
    },

    [TaskType.DOCUMENT_FUNCTION]: {
      systemPrompt: 'You are a documentation expert. Write clear, helpful documentation comments.',
      prompt: (content: string, language?: string) => 
        `Add comprehensive documentation to this ${language || 'code'}.
Use the appropriate documentation format (JSDoc, docstrings, etc.).
Include parameter descriptions, return values, and usage examples.

Code:
${content}`
    },

    [TaskType.SUGGEST_REFACTOR]: {
      systemPrompt: 'You are a refactoring expert. Identify improvements while maintaining functionality.',
      prompt: (content: string) => 
        `Analyse this code and suggest refactoring improvements:
1. Identify code smells
2. Suggest specific improvements
3. Show before/after examples for key changes
4. Explain the benefits of each suggestion

Code:
${content}`
    },

    [TaskType.CHECK_PATTERNS]: {
      systemPrompt: 'You are a design patterns expert. Identify patterns and architectural improvements.',
      prompt: (content: string) => 
        `Analyse the design patterns in this code:
1. Identify existing design patterns
2. Suggest pattern improvements
3. Point out anti-patterns
4. Recommend architectural changes

Code:
${content}`
    },

    [TaskType.EXPLAIN_CODE]: {
      systemPrompt: 'You are a code explanation expert. Explain code clearly for developers.',
      prompt: (content: string) => 
        `Explain what this code does:
1. Overall purpose
2. How it works step by step
3. Key algorithms or logic
4. Any notable techniques used

Code:
${content}`
    },

    [TaskType.FIND_BUGS]: {
      systemPrompt: 'You are a bug detection expert. Find potential issues and vulnerabilities.',
      prompt: (content: string) => 
        `Analyse this code for potential bugs:
1. Logic errors
2. Edge cases not handled
3. Potential runtime errors
4. Security vulnerabilities
5. Performance issues

Provide specific line references where possible.

Code:
${content}`
    },

    [TaskType.OPTIMISE_PERFORMANCE]: {
      systemPrompt: 'You are a performance optimisation expert.',
      prompt: (content: string) => 
        `Analyse this code for performance optimisations:
1. Identify performance bottlenecks
2. Suggest specific optimisations
3. Consider time and space complexity
4. Provide optimised code examples

Code:
${content}`
    },

    [TaskType.GENERATE_TYPES]: {
      systemPrompt: 'You are a type system expert. Generate accurate type definitions.',
      prompt: (content: string, language?: string) => 
        `Generate type definitions for this ${language || 'code'}.
Create interfaces, types, or type annotations as appropriate.
Include all function signatures and data structures.

Code:
${content}`
    },

    [TaskType.CREATE_EXAMPLES]: {
      systemPrompt: 'You are a code example expert. Create clear, practical examples.',
      prompt: (content: string) => 
        `Create usage examples for this code:
1. Basic usage example
2. Common use cases
3. Edge cases
4. Integration examples

Make examples practical and easy to understand.

Code:
${content}`
    },

    [TaskType.ANALYZE_FILE]: {
      systemPrompt: 'You are a file analysis expert. Analyze files comprehensively based on their content and user instructions.',
      prompt: (content: string, language?: string, additionalParams?: any) => {
        const instructions = additionalParams?.instructions || 'Provide a comprehensive analysis of this file';
        const format = additionalParams?.extractFormat || 'summary';
        
        return `Analyze the following file content according to these instructions:
${instructions}

Output format: ${format}

${format === 'json' ? 'Provide your analysis as a structured JSON object.' : ''}
${format === 'list' ? 'Provide your analysis as a bullet-point list.' : ''}
${format === 'summary' ? 'Provide your analysis as a clear, readable summary.' : ''}

File content:
${content}`;
      }
    },

    [TaskType.ANALYZE_CSV_DATA]: {
      systemPrompt: 'You are a CSV data analysis expert. Filter and analyze CSV data based on specific criteria.',
      prompt: (content: string, language?: string, additionalParams?: any) => {
        const filterCriteria = additionalParams?.filterCriteria || 'all data';
        const columns = additionalParams?.columns;
        const returnFormat = additionalParams?.returnFormat || 'json';
        
        return `Analyze this CSV data and filter for: ${filterCriteria}

${columns ? `Focus on these columns: ${columns.join(', ')}` : 'Analyze all columns'}

Return the results in ${returnFormat} format.

${returnFormat === 'json' ? 'Return as a JSON array of objects.' : ''}
${returnFormat === 'csv' ? 'Return as CSV format with headers.' : ''}
${returnFormat === 'list' ? 'Return as a formatted list.' : ''}

CSV Data:
${content}`;
      }
    }
  }
};
