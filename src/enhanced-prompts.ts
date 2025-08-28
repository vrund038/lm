// Enhanced prompt templates with context awareness
// This file contains improved prompts that leverage domain knowledge

import { 
  TaskType, 
  ProjectType, 
  CodeContext, 
  TestContext,
  DocContext,
  RefactorContext,
  PluginRequirements,
  ComponentSpecs,
  TSContext,
  SecurityContext
} from './enhanced-types.js';

// Helper function to get project-specific instructions
export function getProjectSpecificInstructions(projectType?: ProjectType): string {
  switch(projectType) {
    case 'wordpress-plugin':
      return `
WordPress-Specific Analysis:
- Hook usage (actions/filters) and proper priority
- Database interactions with $wpdb
- Security: nonces, capabilities, sanitization, escaping
- Coding standards: WordPress PHP Coding Standards
- Performance: transients, object caching
- Internationalization with text domains
- Multisite compatibility considerations`;
    
    case 'n8n-node':
      return `
n8n-Specific Analysis:
- Node configuration structure and properties
- Credential handling and type definitions
- Execute method implementation patterns
- Error handling with NodeOperationError
- Input/output data structures
- Webhook and trigger implementations
- Resource loading and pagination`;
    
    case 'react-app':
    case 'react-component':
      return `
React-Specific Analysis:
- Component structure (functional vs class)
- Hook usage and custom hooks
- State management patterns
- Props validation and TypeScript interfaces
- Performance optimizations (memo, useMemo, useCallback)
- Side effect management
- Component lifecycle and cleanup`;
    
    case 'node-api':
      return `
Node.js API-Specific Analysis:
- Route structure and middleware
- Authentication and authorization
- Error handling and logging
- Database connection patterns
- Request validation and sanitization
- Response formatting and status codes
- API versioning strategy`;
    
    default:
      return '';
  }
}

// Helper function to get framework-specific test guidelines
export function getFrameworkTestGuidelines(context: TestContext): string {
  const { projectType } = context;
  
  const guidelines: Record<string, string> = {
    'wordpress-plugin': `
WordPress Testing Guidelines:
- Use Brain Monkey for WordPress function mocking
- Test hooks with has_action()/has_filter()
- Mock global WordPress functions ($wpdb, get_option, etc.)
- Test nonce verification and capability checks
- Verify proper escaping and sanitization`,
    
    'react-app': `
React Testing Guidelines:
- Use React Testing Library for component tests
- Test user interactions over implementation details
- Mock API calls and external dependencies
- Test accessibility with appropriate queries
- Verify error boundaries and loading states`,
    
    'node-api': `
Node.js API Testing Guidelines:
- Use supertest for HTTP endpoint testing
- Mock database connections and external services
- Test authentication and authorization flows
- Verify error responses and status codes
- Include rate limiting and validation tests`
  };
  
  return guidelines[projectType] || '';
}

// Helper function to get security checks by project type
export function getSecurityChecklist(projectType: ProjectType): string {
  const checklists: Record<ProjectType, string> = {
    'wordpress-plugin': `
1. Nonce verification on all forms and AJAX
2. Capability checks for all admin actions
3. SQL injection prevention with $wpdb->prepare()
4. XSS prevention with esc_html(), esc_attr(), etc.
5. CSRF protection on state-changing operations
6. File upload validation and sanitization
7. Option and meta value sanitization`,
    
    'wordpress-theme': `
1. Escaping all dynamic output
2. Nonce verification on forms
3. Capability checks for customizer
4. Safe file includes
5. SVG sanitization
6. JavaScript variable escaping
7. Theme option validation`,
    
    'node-api': `
1. Input validation on all endpoints
2. SQL injection prevention (parameterized queries)
3. XSS prevention in responses
4. Authentication token validation
5. Rate limiting implementation
6. CORS configuration
7. Dependency vulnerability scanning`,
    
    'react-app': `
1. XSS prevention with proper JSX escaping
2. URL and href validation
3. Dangerous HTML sanitization
4. Secure storage of sensitive data
5. API key protection
6. Content Security Policy compliance
7. Third-party library vulnerabilities`,
    
    'react-component': `
1. Props validation and sanitization
2. XSS prevention in rendered content
3. Event handler security
4. State management security
5. Secure data passing
6. Component isolation
7. Third-party integration security`,
    
    'n8n-node': `
1. Credential encryption and storage
2. Input validation for node parameters
3. API key and secret handling
4. Rate limiting respect
5. Error message sanitization
6. Webhook signature validation
7. Data exposure in logs`,
    
    'n8n-workflow': `
1. Exposed credentials in code nodes
2. Sensitive data in logs
3. Webhook authentication
4. Data validation between nodes
5. Error handling security
6. Third-party API security
7. Workflow access control`,
    
    'html-component': `
1. HTML injection prevention
2. JavaScript injection prevention
3. CSS injection prevention
4. Form validation
5. ARIA security considerations
6. iframe sandboxing
7. Link target validation`,
    
    'browser-extension': `
1. Content Security Policy
2. Permission minimization
3. Cross-origin communication security
4. Storage encryption
5. Code injection prevention
6. External resource validation
7. Update mechanism security`,
    
    'cli-tool': `
1. Command injection prevention
2. Path traversal prevention
3. Environment variable validation
4. File permission checks
5. Temporary file security
6. Signal handling
7. Privilege escalation prevention`,
    
    'generic': `
1. Input validation and sanitization
2. Output encoding
3. Authentication and authorization
4. Secure data storage
5. Error handling without info leakage
6. Dependency security
7. Security headers and configurations`
  };
  
  return checklists[projectType] || checklists.generic;
}

// Enhanced analyze_single_file prompt
export function createCodeStructurePrompt(content: string, context?: CodeContext): string {
  const projectType = context?.projectType || 'generic';
  const framework = context?.framework || 'none specified';
  const standards = context?.standards?.join(', ') || 'clean code principles';
  
  return `You are analyzing ${context?.language || 'code'} for a ${projectType} project.

Context:
- Project Type: ${projectType}
- Framework: ${framework} ${context?.frameworkVersion ? `v${context.frameworkVersion}` : ''}
- Coding Standards: ${standards}
- Environment: ${context?.environment || 'not specified'}

Analyze and provide:
1. **Architecture Overview**: High-level design patterns and structure
2. **Dependencies**: External libraries, their versions, and purposes
3. **Entry Points**: Main execution flows, initialization, and bootstrapping
4. **Data Flow**: How data moves through the system, transformations, and storage
5. **Integration Points**: APIs, hooks, events, or extension points
6. **Code Organization**: Module structure, separation of concerns
7. **Potential Issues**: Anti-patterns, technical debt, or improvement areas

${getProjectSpecificInstructions(projectType)}

Consider:
- Language version compatibility (${context?.languageVersion || 'latest'})
- Performance implications of architectural choices
- Testability and maintainability of the structure
- Security considerations for the architecture

Code to analyze:
${content}`;
}

// Enhanced generate_unit_tests prompt
export function createUnitTestPrompt(content: string, context: TestContext): string {
  const { projectType, testFramework, coverageTarget = 80, mockStrategy = 'minimal' } = context;
  
  return `Generate comprehensive unit tests for ${projectType} code.

Testing Requirements:
- Framework: ${testFramework}
- Coverage Target: ${coverageTarget}% minimum
- Mock Strategy: ${mockStrategy}
- Test Style: ${context.testStyle || 'descriptive'}

Required Test Categories:
1. **Happy Path**: Standard successful operations
2. **Edge Cases**: Boundary conditions, empty inputs, null/undefined, large datasets
3. **Error Scenarios**: Invalid inputs, network failures, permission issues, timeouts
4. **Security Tests**: ${getSecurityTests(projectType)}
5. **Performance Tests**: ${context.includePerformanceTests ? 'Response times, memory usage, concurrent operations' : 'Skip performance tests'}
6. **Integration Points**: External dependencies, API calls, database operations

${getFrameworkTestGuidelines(context)}

Test Structure Requirements:
- Use descriptive test names: ${getTestNamingPattern(context.testStyle)}
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

// Helper function for test naming patterns
function getTestNamingPattern(testStyle?: string): string {
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

// Helper function for security tests by project type
function getSecurityTests(projectType: ProjectType): string {
  const securityTests: Record<ProjectType, string> = {
    'wordpress-plugin': 'Nonce validation, capability checks, SQL injection prevention, XSS escaping',
    'wordpress-theme': 'Output escaping, form validation, capability checks, safe file handling',
    'node-api': 'Input validation, authentication, authorization, rate limiting',
    'react-app': 'XSS prevention, prop validation, secure routing',
    'react-component': 'Props sanitization, event handler security, state validation',
    'n8n-node': 'Credential handling, input sanitization, API security',
    'n8n-workflow': 'Data validation, webhook security, error handling',
    'html-component': 'HTML injection prevention, form validation, accessibility',
    'browser-extension': 'CSP compliance, permission checks, cross-origin security',
    'cli-tool': 'Command injection prevention, path validation, privilege checks',
    'generic': 'Input validation, output escaping, authorization checks'
  };
  
  return securityTests[projectType] || securityTests.generic;
}

// Enhanced generate_documentation prompt
export function createDocumentationPrompt(content: string, context: DocContext): string {
  const { projectType, docStyle, detailLevel, includeExamples, audience } = context;
  
  return `Generate documentation for ${audience} audience.

Documentation Standards:
- Style: ${docStyle}
- Detail Level: ${detailLevel}
- Include Examples: ${includeExamples}
- Project Type: ${projectType}

Required Sections:
1. **Overview**: What problem does this solve? Why was it built?
2. **Installation/Setup**: ${getSetupInstructions(projectType)}
3. **Usage**: How to implement/use this code
4. **API Reference**: ${context.includeApiReference !== false ? 'All public methods/functions with parameters and return types' : 'Skip API reference'}
5. **Configuration**: Required settings, environment variables, or options
6. **Dependencies**: External requirements and version constraints
7. **Examples**: ${includeExamples ? getExampleRequirements(projectType, audience) : 'Skip examples'}
8. **Troubleshooting**: ${context.includeTroubleshooting !== false ? 'Common issues and solutions' : 'Skip troubleshooting'}
9. **Best Practices**: Recommended usage patterns and anti-patterns to avoid

${getProjectSpecificDocRequirements(projectType)}

Documentation should be:
- Clear and concise for ${audience} audience
- Technically accurate with proper terminology
- Well-structured with logical flow
- Searchable with good headings
- Compatible with ${docStyle} format

Code to document:
${content}`;
}

// Helper functions for documentation
function getSetupInstructions(projectType: ProjectType): string {
  const setupGuides: Record<ProjectType, string> = {
    'wordpress-plugin': 'WordPress version requirements, installation steps, activation process',
    'wordpress-theme': 'WordPress version, theme installation, customizer setup',
    'node-api': 'Node version, npm install, environment setup, database configuration',
    'react-app': 'Prerequisites, npm/yarn install, development server setup',
    'react-component': 'Package installation, peer dependencies, usage in React app',
    'n8n-node': 'n8n version compatibility, node installation, credential setup',
    'n8n-workflow': 'n8n instance setup, workflow import, credential configuration',
    'html-component': 'Browser compatibility, CSS/JS dependencies, integration steps',
    'browser-extension': 'Browser compatibility, installation methods, permissions setup',
    'cli-tool': 'System requirements, installation via npm/binary, PATH setup',
    'generic': 'Prerequisites and installation steps'
  };
  return setupGuides[projectType] || setupGuides.generic;
}

function getExampleRequirements(_projectType: ProjectType, audience: string): string {
  if (audience === 'developer') {
    return 'Working code samples with imports, error handling, and edge cases';
  } else {
    return 'Simple, practical examples with clear explanations';
  }
}

function getProjectSpecificDocRequirements(projectType: ProjectType): string {
  const requirements: Record<ProjectType, string> = {
    'wordpress-plugin': `
WordPress-Specific Documentation:
- Hook reference (actions and filters)
- Shortcode usage (if applicable)
- Admin interface guide
- Database schema (if custom tables)
- Multisite considerations
- Translation/localization guide`,
    
    'wordpress-theme': `
WordPress Theme Documentation:
- Template hierarchy
- Customizer options
- Widget areas
- Menu locations
- Theme hooks
- Child theme guide`,
    
    'node-api': `
API-Specific Documentation:
- Endpoint reference with methods
- Request/response examples
- Authentication guide
- Rate limiting information
- Error response formats
- API versioning`,
    
    'react-app': `
React-Specific Documentation:
- Component props and types
- State management approach
- Routing structure
- Build and deployment
- Performance optimization tips
- Browser compatibility`,
    
    'react-component': `
React Component Documentation:
- Props interface
- Event callbacks
- Styling customization
- Usage examples
- Storybook stories
- Testing guide`,
    
    'n8n-node': `
n8n-Specific Documentation:
- Node configuration options
- Credential setup guide
- Input/output data formats
- Error handling behavior
- Webhook setup (if applicable)
- Resource limitations`,
    
    'n8n-workflow': `
n8n Workflow Documentation:
- Workflow purpose and flow
- Required nodes and versions
- Environment variables
- Credential requirements
- Trigger configuration
- Error handling strategy`,
    
    'html-component': `
HTML Component Documentation:
- Browser support matrix
- CSS variables for theming
- JavaScript API
- Event listeners
- Accessibility features
- Integration examples`,
    
    'browser-extension': `
Browser Extension Documentation:
- Supported browsers
- Installation guide
- Permission explanations
- User interface guide
- Storage usage
- Update process`,
    
    'cli-tool': `
CLI Tool Documentation:
- Command reference
- Option flags
- Configuration files
- Environment variables
- Exit codes
- Shell completion`,
    
    'generic': ''
  };
  
  return requirements[projectType] || requirements.generic;
}

// Enhanced suggest_refactoring prompt
export function createRefactoringPrompt(content: string, context: RefactorContext): string {
  const { projectType, focusAreas, preserveApi = true, modernizationLevel = 'moderate' } = context;
  const standards = context.standards?.join(', ') || 'clean code principles';
  
  return `Analyze code for refactoring opportunities following ${projectType} best practices.

Refactoring Context:
- Focus Areas: ${focusAreas.join(', ')}
- Preserve API: ${preserveApi ? 'Yes - maintain backward compatibility' : 'No - breaking changes allowed'}
- Modernization Level: ${modernizationLevel}
- Standards: ${standards}
- Target Complexity: ${context.targetComplexity || 10} (cyclomatic complexity)

Refactoring Priorities:
1. **Code Smells**: ${getCodeSmellsToCheck(focusAreas)}
2. **Design Patterns**: Apply appropriate patterns for ${projectType}
3. **Performance**: ${focusAreas.includes('performance') ? getPerformanceTargets(projectType) : 'Not a priority'}
4. **Maintainability**: ${focusAreas.includes('maintainability') ? 'Improve readability, reduce coupling, increase cohesion' : 'Standard'}
5. **Security**: ${focusAreas.includes('security') ? 'Apply security best practices' : 'Maintain current security level'}

Specific Guidelines:
${getRefactoringGuidelines(projectType, modernizationLevel)}

Consider:
- Breaking large functions (>50 lines) into smaller, focused methods
- Extracting reusable components/utilities
- Improving naming for clarity (${context.teamConventions?.naming || 'appropriate convention'})
- Reducing cyclomatic complexity below ${context.targetComplexity || 10}
- Adding appropriate error handling
- Implementing proper logging
- Updating deprecated APIs (modernization level: ${modernizationLevel})

Code to refactor:
${content}

Provide:
1. Refactored code with clear improvements
2. Explanation of each significant change
3. Impact assessment on:
   - Performance (if applicable)
   - Maintainability score
   - Test coverage implications
   - API compatibility (if preserving)
4. Migration guide if breaking changes`;
}

// Helper functions for refactoring
function getCodeSmellsToCheck(focusAreas: string[]): string {
  const smells: string[] = ['Large classes', 'Long methods', 'Duplicate code'];
  
  if (focusAreas.includes('readability')) {
    smells.push('Complex conditionals', 'Magic numbers', 'Poor naming');
  }
  if (focusAreas.includes('maintainability')) {
    smells.push('Tight coupling', 'Feature envy', 'Inappropriate intimacy');
  }
  if (focusAreas.includes('performance')) {
    smells.push('Inefficient loops', 'Memory leaks', 'N+1 queries');
  }
  
  return smells.join(', ');
}

function getPerformanceTargets(projectType: ProjectType): string {
  const targets: Record<ProjectType, string> = {
    'wordpress-plugin': 'Reduce database queries, use transients, optimize hooks',
    'wordpress-theme': 'Minimize render-blocking resources, optimize images, lazy loading',
    'node-api': 'Improve response time, reduce memory usage, optimize database queries',
    'react-app': 'Reduce re-renders, optimize bundle size, improve initial load',
    'react-component': 'Minimize re-renders, reduce bundle impact, optimize props',
    'n8n-node': 'Handle large datasets efficiently, minimize API calls, stream processing',
    'n8n-workflow': 'Reduce node count, parallelize operations, batch processing',
    'html-component': 'Minimize reflows/repaints, optimize animations, reduce JavaScript',
    'browser-extension': 'Reduce memory footprint, optimize content scripts, minimize permissions',
    'cli-tool': 'Improve startup time, reduce memory usage, optimize file operations',
    'generic': 'Optimize algorithms, reduce memory allocation, improve caching'
  };
  
  return targets[projectType] || targets.generic;
}

function getRefactoringGuidelines(projectType: ProjectType, modernizationLevel: string): string {
  const baseGuidelines = `
General Refactoring Rules:
- Maintain single responsibility principle
- Use dependency injection where appropriate
- Prefer composition over inheritance
- Apply DRY principle thoughtfully
- Keep functions pure when possible`;

  const modernization = modernizationLevel === 'aggressive' ? `
Aggressive Modernization:
- Update to latest language features
- Replace callbacks with promises/async
- Use modern module systems
- Apply latest framework patterns` : '';

  const projectGuidelines: Record<ProjectType, string> = {
    'wordpress-plugin': `
WordPress Refactoring:
- Use modern PHP features (${modernizationLevel === 'conservative' ? 'PHP 7.4+' : 'PHP 8.0+'})
- Replace direct SQL with $wpdb methods
- Use WordPress coding standards
- Implement proper hook organization
- Add namespace to avoid conflicts`,
    
    'wordpress-theme': `
WordPress Theme Refactoring:
- Use theme.json for block editor support
- Implement proper template parts
- Optimize asset loading
- Use WordPress coding standards
- Add proper escaping functions`,
    
    'node-api': `
Node.js Refactoring:
- Use async/await over callbacks
- Implement proper middleware structure
- Add request validation layer
- Improve error handling consistency
- Modularize route handlers`,
    
    'react-app': `
React Refactoring:
- Convert class components to hooks (if ${modernizationLevel !== 'conservative'})
- Extract custom hooks
- Optimize with memo/useMemo/useCallback
- Improve component composition
- Add proper TypeScript types`,
    
    'react-component': `
React Component Refactoring:
- Extract reusable logic to hooks
- Improve prop interfaces
- Add proper memoization
- Enhance accessibility
- Optimize bundle size`,
    
    'n8n-node': `
n8n Node Refactoring:
- Improve error handling
- Add proper TypeScript types
- Optimize API calls
- Implement retry logic
- Add comprehensive logging`,
    
    'n8n-workflow': `
n8n Workflow Refactoring:
- Consolidate duplicate nodes
- Parallelize operations
- Add error handling nodes
- Improve data transformations
- Use sub-workflows for complexity`,
    
    'html-component': `
HTML Component Refactoring:
- Improve semantic markup
- Enhance accessibility
- Optimize CSS architecture
- Reduce JavaScript complexity
- Add progressive enhancement`,
    
    'browser-extension': `
Browser Extension Refactoring:
- Minimize permission requests
- Optimize content scripts
- Improve message passing
- Add proper error handling
- Enhance user privacy`,
    
    'cli-tool': `
CLI Tool Refactoring:
- Improve argument parsing
- Add proper error messages
- Enhance help documentation
- Optimize performance
- Add progress indicators`,
    
    'generic': ''
  };

  return baseGuidelines + modernization + (projectGuidelines[projectType] || '');
}

// New tool: generate_wordpress_plugin
export function createWordPressPluginPrompt(requirements: PluginRequirements): string {
  const { name, description, features, wpVersion = '6.0+', phpVersion = '7.4+', prefix } = requirements;
  
  return `Create a WordPress plugin following these specifications:

Plugin Details:
- Name: ${name}
- Purpose: ${description}
- Features: ${features.join(', ')}
- WordPress Version: ${wpVersion}
- PHP Version: ${phpVersion}
- Text Domain: ${requirements.textDomain || prefix}

Required Components:
1. **Main Plugin File** (${prefix}.php):
   - Proper plugin headers with all metadata
   - Namespace: ${prefix.charAt(0).toUpperCase() + prefix.slice(1)}
   - Main plugin class with singleton pattern
   - Proper initialization hooks

2. **Activation/Deactivation** (includes/class-${prefix}-activator.php, includes/class-${prefix}-deactivator.php):
   - Database table creation (if needed)
   - Default options setup
   - Capability registration
   - Scheduled events setup
   - Proper cleanup on deactivation

3. **Core Functionality** (includes/class-${prefix}-core.php):
   - Hook registration (actions and filters)
   - Dependency injection setup
   - Feature initialization
   - Error handling

${requirements.includeAdmin ? `
4. **Admin Interface** (admin/class-${prefix}-admin.php):
   - Admin menu registration
   - Settings page with sections and fields
   - Form handling with nonces
   - Admin notices system
   - Screen options (if applicable)` : ''}

${requirements.includeDatabase ? `
5. **Database Handler** (includes/class-${prefix}-db.php):
   - Custom table schema
   - CRUD operations with $wpdb
   - Data validation and sanitization
   - Migration support for updates` : ''}

${requirements.includeAjax ? `
6. **AJAX Handlers** (includes/class-${prefix}-ajax.php):
   - Nonce verification
   - Capability checks
   - Response formatting
   - Error handling with wp_send_json_error()` : ''}

${requirements.includeRest ? `
7. **REST API Endpoints** (includes/class-${prefix}-rest.php):
   - Endpoint registration
   - Permission callbacks
   - Schema definitions
   - Response formatting` : ''}

${requirements.includeGutenberg ? `
8. **Gutenberg Block** (blocks/):
   - Block registration
   - Edit and save components
   - Block attributes and controls
   - Server-side rendering (if dynamic)` : ''}

9. **Uninstall Cleanup** (uninstall.php):
   - Remove database tables
   - Clean up options
   - Remove user meta
   - Clear scheduled events

WordPress Coding Standards to Follow:
- Use proper prefixing: ${prefix}_ for functions, ${prefix.toUpperCase()}_ for constants
- Escape all output: esc_html(), esc_attr(), esc_url(), wp_kses()
- Sanitize all input: sanitize_text_field(), sanitize_email(), etc.
- Use WordPress APIs exclusively (don't reinvent)
- Include inline documentation (PHPDoc blocks)
- Implement internationalization: __(), _e(), _n()
- Add action/filter documentation

Security Requirements:
- Nonce verification on all forms and AJAX
- Capability checks: current_user_can()
- SQL injection prevention: $wpdb->prepare()
- File upload validation (if applicable)
- Data validation before saving

Generate:
1. Complete file structure with all necessary files
2. Core plugin code with proper OOP structure
3. Basic admin interface with settings
4. Installation and usage instructions
5. Hook reference documentation

File Structure:
${prefix}/
├── ${prefix}.php
├── uninstall.php
├── readme.txt
├── includes/
│   ├── class-${prefix}-activator.php
│   ├── class-${prefix}-deactivator.php
│   ├── class-${prefix}-core.php
│   └── class-${prefix}-loader.php
├── admin/
│   ├── class-${prefix}-admin.php
│   ├── css/
│   └── js/
├── public/
│   ├── class-${prefix}-public.php
│   ├── css/
│   └── js/
└── languages/`;
}

// New tool: analyze_n8n_workflow
export function createN8nWorkflowAnalysisPrompt(workflow: object): string {
  return `Analyze this n8n workflow for optimization and best practices:

Workflow Data:
${JSON.stringify(workflow, null, 2)}

Analysis Requirements:

1. **Efficiency Analysis**:
   - Identify redundant nodes or operations
   - Find duplicate API calls that could be consolidated
   - Detect unnecessary data transformations
   - Suggest node consolidation opportunities
   - Identify loops that could be optimized

2. **Error Handling Review**:
   - Check for proper error catching (Error Trigger nodes)
   - Identify nodes without error handling
   - Suggest try-catch patterns for critical operations
   - Review error notification setup
   - Validate retry configurations

3. **Performance Optimization**:
   - Identify potential bottlenecks (synchronous operations that could be parallel)
   - Check for large data processing without pagination
   - Review API rate limiting considerations
   - Suggest batch processing where applicable
   - Memory usage concerns with large datasets

4. **Security Assessment**:
   - Flag exposed credentials or API keys in code nodes
   - Check for sensitive data in logs
   - Review webhook security (authentication)
   - Identify data exposure risks
   - Validate input sanitization

5. **Maintainability Improvements**:
   - Suggest better node naming conventions
   - Recommend grouping related nodes
   - Identify complex flows that could be sub-workflows
   - Suggest documentation nodes (Sticky Notes)
   - Review variable naming in code nodes

6. **Best Practices Compliance**:
   - Use of proper node types (Code vs Function nodes)
   - Consistent data structure throughout workflow
   - Proper use of expressions vs static values
   - Environment variable usage for configuration
   - Webhook response handling

Provide:
1. **Optimization Summary**: Key improvements with impact assessment
2. **Refactored Workflow**: Updated JSON with improvements
3. **Implementation Guide**: Step-by-step changes needed
4. **Risk Assessment**: Potential issues with current setup
5. **Performance Metrics**: Expected improvements

Focus on practical improvements that enhance reliability and performance.`;
}

// New tool: generate_responsive_component
export function createResponsiveComponentPrompt(specs: ComponentSpecs): string {
  const { name, type, framework = 'vanilla', designSystem = 'custom' } = specs;
  
  return `Create a responsive, accessible ${type} component named "${name}":

Component Specifications:
- Type: ${type}
- Framework: ${framework}
- Design System: ${designSystem}
- Responsive: ${specs.responsive !== false}
- Accessible: ${specs.accessible !== false}
- Animations: ${specs.animations || false}
- Dark Mode: ${specs.darkMode || false}

Requirements:

1. **HTML Structure**:
   - Semantic HTML5 elements
   - ARIA labels and roles where needed
   - Proper heading hierarchy
   - Form labels and associations
   - Landmark regions (if applicable)

2. **CSS Implementation**:
   - Mobile-first responsive design
   - CSS Grid and/or Flexbox for layout
   - CSS custom properties for theming:
     * --${name}-primary-color
     * --${name}-background
     * --${name}-text-color
     * --${name}-spacing
     * --${name}-border-radius
   - Container queries (if supported)
   - Logical properties for RTL support

3. **Accessibility Features**:
   - Keyboard navigation (tab order, arrow keys where appropriate)
   - Focus indicators (visible and high contrast)
   - Screen reader announcements
   - Color contrast (WCAG 2.1 AA minimum)
   - Touch targets (minimum 44x44px)
   - Reduced motion support

4. **Responsive Breakpoints**:
   - Mobile: 320px - 767px
   - Tablet: 768px - 1023px
   - Desktop: 1024px+
   - Handle landscape orientation
   - Fluid typography with clamp()

5. **Interactive Features** (if applicable):
   - State management (open/closed, active/inactive)
   - Smooth transitions
   - Loading states
   - Error states
   - Empty states

${specs.animations ? `
6. **Animation Requirements**:
   - Respect prefers-reduced-motion
   - Performance optimized (transform, opacity)
   - Natural easing functions
   - No layout shifts` : ''}

${specs.darkMode ? `
7. **Dark Mode Support**:
   - CSS custom properties for colors
   - Media query: prefers-color-scheme
   - Smooth transitions between modes
   - Proper contrast in both modes` : ''}

${framework === 'react' ? `
8. **React Specific**:
   - TypeScript interfaces for props
   - Proper event handlers
   - Ref forwarding support
   - Memoization where appropriate
   - Error boundaries` : ''}

${framework === 'vue' ? `
8. **Vue Specific**:
   - Composition API preferred
   - Props validation
   - Emitted events documentation
   - Scoped slots support
   - Transition components` : ''}

Generate:
1. **HTML Structure** with all semantic markup
2. **CSS Styles** (mobile-first, organized by component parts)
3. **JavaScript** (if interactive, with proper event handling)
4. **Usage Documentation** with examples
5. **Accessibility Notes** for developers
6. **Browser Support** information
7. **Customization Guide** for theming

Make it production-ready with performance optimization and cross-browser compatibility.`;
}

// New tool: convert_to_typescript
export function createTypeScriptConversionPrompt(jsCode: string, context: TSContext): string {
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

// New tool: security_audit
export function createSecurityAuditPrompt(code: string, context: SecurityContext): string {
  const { projectType, auditDepth = 'standard' } = context;
  
  return `Perform a ${auditDepth} security audit for this ${projectType} code:

Security Audit Configuration:
- Project Type: ${projectType}
- Audit Depth: ${auditDepth}
- Include OWASP: ${context.includeOwasp !== false}
- Check Dependencies: ${context.includeDependencies || false}
- Custom Checks: ${context.customChecks?.join(', ') || 'None'}

Security Checklist:
${getSecurityChecklist(projectType)}

Additional Checks for ${auditDepth} audit:
${getAuditDepthChecks(auditDepth)}

Analyze for:

1. **Input Validation**:
   - Unvalidated user input
   - Type coercion issues
   - Range validation
   - Format validation
   - Encoding issues

2. **Output Encoding**:
   - XSS vulnerabilities
   - HTML injection
   - JavaScript injection
   - CSS injection
   - SQL injection

3. **Authentication/Authorization**:
   - Broken authentication
   - Session management
   - Privilege escalation
   - Insecure direct object references
   - Missing function level access control

4. **Data Protection**:
   - Sensitive data exposure
   - Weak cryptography
   - Hardcoded secrets
   - Insecure data transmission
   - Insufficient data masking

5. **Security Misconfiguration**:
   - Default credentials
   - Unnecessary features enabled
   - Verbose error messages
   - Missing security headers
   - Outdated dependencies

6. **Common Vulnerabilities**:
   - Path traversal
   - Command injection
   - XXE (XML External Entities)
   - Deserialization flaws
   - LDAP injection

${context.includeOwasp !== false ? `
7. **OWASP Top 10 Compliance**:
   - Check against current OWASP Top 10
   - Provide OWASP references
   - Suggest OWASP recommended fixes` : ''}

${context.includeDependencies ? `
8. **Dependency Analysis**:
   - Known vulnerable dependencies
   - Outdated packages
   - License compliance
   - Supply chain risks` : ''}

Code to audit:
${code}

Provide:
1. **Vulnerability Report**:
   - Finding description
   - Severity (Critical/High/Medium/Low)
   - CVSS score (if applicable)
   - Location in code
   - Proof of concept (if safe to demonstrate)

2. **Remediation Code**:
   - Fixed version of vulnerable code
   - Security best practices applied
   - Comments explaining fixes

3. **Prevention Guidelines**:
   - How to prevent similar issues
   - Security coding standards
   - Testing recommendations

4. **Compliance Notes**:
   - Regulatory compliance issues
   - Industry standard violations
   - Framework-specific security guidelines

Format as a professional security audit report.`;
}

// Helper function for audit depth
function getAuditDepthChecks(depth: string): string {
  const checks = {
    basic: 'Common vulnerabilities, obvious security flaws',
    standard: 'OWASP Top 10, framework-specific issues, basic cryptography',
    comprehensive: 'Advanced attack vectors, race conditions, side-channel attacks, cryptographic analysis, business logic flaws'
  };
  
  return checks[depth as keyof typeof checks] || checks.standard;
}

// Export all prompt creators
export const enhancedPromptCreators = {
  [TaskType.ANALYZE_SINGLE_FILE]: createCodeStructurePrompt,
  [TaskType.GENERATE_TESTS]: createUnitTestPrompt,
  [TaskType.DOCUMENT_FUNCTION]: createDocumentationPrompt,
  [TaskType.SUGGEST_REFACTOR]: createRefactoringPrompt,
  [TaskType.GENERATE_WORDPRESS_PLUGIN]: createWordPressPluginPrompt,
  [TaskType.ANALYZE_N8N_WORKFLOW]: createN8nWorkflowAnalysisPrompt,
  [TaskType.GENERATE_RESPONSIVE_COMPONENT]: createResponsiveComponentPrompt,
  [TaskType.CONVERT_TO_TYPESCRIPT]: createTypeScriptConversionPrompt,
  [TaskType.SECURITY_AUDIT]: createSecurityAuditPrompt
};
