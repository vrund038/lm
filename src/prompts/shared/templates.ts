/**
 * Shared prompt templates used across multiple plugins
 */

export const COMMON_INSTRUCTIONS = {
  codeQuality: `
    Focus on:
    - Code readability and maintainability
    - Performance implications
    - Security considerations
    - Best practices for the given language/framework
  `,
  
  outputFormat: `
    Provide your response in a clear, structured format:
    - Use bullet points for lists
    - Include code examples where relevant
    - Highlight critical issues first
    - Suggest actionable improvements
  `,
  
  frameworkSpecific: {
    wordpress: `
      Consider WordPress-specific patterns:
      - Hook and filter usage
      - Nonce verification for security
      - Proper escaping and sanitization
      - Database query optimization
      - Plugin/theme compatibility
    `,
    
    react: `
      Consider React-specific patterns:
      - Component composition
      - State management
      - Performance optimization (memoization, lazy loading)
      - Accessibility (ARIA attributes)
      - Testing considerations
    `,
    
    node: `
      Consider Node.js-specific patterns:
      - Async/await patterns
      - Error handling
      - Module structure
      - Performance and memory usage
      - Security (input validation, authentication)
    `
  }
};

export const ANALYSIS_TEMPLATES = {
  complexity: `
    Analyze the complexity of this code:
    - Cyclomatic complexity
    - Cognitive complexity
    - Nesting depth
    - Function length
    Suggest ways to reduce complexity if needed.
  `,
  
  security: `
    Perform a security analysis:
    - Input validation
    - Authentication/authorization
    - Data sanitization
    - SQL injection risks
    - XSS vulnerabilities
    - CSRF protection
  `,
  
  performance: `
    Analyze performance aspects:
    - Algorithm efficiency
    - Database query optimization
    - Caching opportunities
    - Memory usage patterns
    - Potential bottlenecks
  `
};

export default {
  COMMON_INSTRUCTIONS,
  ANALYSIS_TEMPLATES
};
