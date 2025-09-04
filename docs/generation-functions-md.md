# Generation Functions Guide

**Your creative powerhouse for building production-ready solutions**

The generation functions transform ideas into working code, comprehensive documentation, and complete applications whilst maintaining professional standards and best practices. Each tool delivers production-ready output that passes code reviews.

## Quick Start Examples

Jump straight in with these natural language prompts:

```
Generate comprehensive unit tests for my React component using houtini-lm
```

```
Use houtini-lm to create a WordPress plugin for event management with admin interface
```

```
Convert my JavaScript file to TypeScript using houtini-lm with strict mode
```

```
Generate a responsive pricing card component using houtini-lm with dark mode
```

```
Create professional documentation for my API using houtini-lm
```

```
Use houtini-lm to suggest refactoring improvements for my legacy code
```

## Core Generation Functions

### 1. `generate_unit_tests` - Professional Test Suite Creation

**Purpose**: Create comprehensive test suites with framework-specific patterns

**Simple usage**:
```
Generate Jest tests for C:/src/UserService.js using houtini-lm
```

**What you get**:
- Complete test files with setup and teardown
- Edge case coverage including error conditions  
- Mock implementations for external dependencies
- Framework-specific patterns (describe/it for Jest, fixtures for pytest)
- Performance and integration test templates

**Advanced usage**:
```json
{
  "name": "houtini-lm:generate_unit_tests",
  "parameters": {
    "filePath": "C:/src/components/UserProfile.jsx",
    "testFramework": "jest",
    "coverageTarget": "comprehensive",
    "context": {
      "framework": "React",
      "async": true,
      "database": "PostgreSQL"
    }
  }
}
```

### 2. `generate_documentation` - Smart Documentation Creation

**Purpose**: Create comprehensive docs from code analysis

**Simple usage**:
```
Generate API documentation for my Express routes using houtini-lm
```

**What you get**:
- Clear function and class documentation
- Parameter descriptions with examples
- Usage examples for common scenarios
- Integration guidelines
- Troubleshooting sections

**Advanced usage**:
```json
{
  "name": "houtini-lm:generate_documentation",
  "parameters": {
    "filePath": "C:/api/routes/users.js",
    "docStyle": "markdown",
    "includeExamples": true,
    "context": {
      "audience": "external_developers",
      "api_version": "v2"
    }
  }
}
```

### 3. `generate_project_documentation` - Complete Project Docs

**Purpose**: Generate comprehensive project documentation with intelligent file discovery

**Simple usage**:
```
Create complete project documentation using houtini-lm for C:/my-react-app
```

**What you get**:
- Executive summary and architecture documentation
- API reference with request/response examples
- Setup and installation guide
- Developer onboarding materials
- Component documentation with usage examples

### 4. `convert_to_typescript` - Modern TypeScript Migration

**Purpose**: Convert JavaScript to TypeScript with comprehensive type annotations

**Simple usage**:
```
Convert C:/legacy/userManager.js to TypeScript using houtini-lm
```

**What you get**:
- Complete TypeScript conversion with proper syntax
- Interface definitions for complex objects
- Type annotations for parameters and returns
- Generic type definitions for reusable code
- Type guards for runtime type checking

**Advanced usage**:
```json
{
  "name": "houtini-lm:convert_to_typescript",
  "parameters": {
    "filePath": "C:/project/src/legacy/UserManager.js",
    "strict": true,
    "target": "ES2022",
    "addTypeGuards": true,
    "useInterfaces": true
  }
}
```

### 5. `suggest_refactoring` - Code Improvement Intelligence

**Purpose**: Get specific refactoring suggestions with before/after examples

**Simple usage**:
```
Suggest refactoring improvements for my component using houtini-lm
```

**What you get**:
- Specific refactoring suggestions with clear explanations
- Before/after code examples
- Performance impact analysis
- Risk assessment for each suggestion
- Architectural pattern improvements

**Advanced usage**:
```json
{
  "name": "houtini-lm:suggest_refactoring",
  "parameters": {
    "filePath": "C:/components/Dashboard.jsx",
    "focusAreas": ["performance", "maintainability"],
    "context": {
      "framework": "React",
      "patterns": ["hooks", "functional"]
    }
  }
}
```

## WordPress Development Tools

### 6. `generate_wordpress_plugin` - Complete Plugin Creation

**Purpose**: Generate complete WordPress plugins with proper structure and security

**Simple usage**:
```
Create a WordPress event management plugin using houtini-lm
```

**What you get**:
- Complete plugin directory structure
- Security features (nonces, sanitization, capability checks)
- Admin interface with settings pages
- Database schema and upgrade functions
- Internationalization support

**Advanced usage**:
```json
{
  "name": "houtini-lm:generate_wordpress_plugin",
  "parameters": {
    "name": "Advanced Contact Manager",
    "description": "Comprehensive contact management with custom fields",
    "features": ["custom_post_type", "admin_interface", "rest_api"],
    "prefix": "acm",
    "includeDatabase": true,
    "includeRest": true
  }
}
```

### 7. `wordpress_theme_from_static` - Static to WordPress Theme

**Purpose**: Convert static websites into fully functional WordPress themes

**Simple usage**:
```
Convert my static website to a WordPress theme using houtini-lm
```

**What you get**:
- Complete WordPress theme structure
- Template hierarchy implementation (index.php, single.php, etc.)
- Dynamic navigation and widget areas
- Customizer integration
- WordPress coding standards compliance

## Component & Frontend Tools

### 8. `generate_responsive_component` - Modern Component Creation

**Purpose**: Create accessible, responsive components with modern best practices

**Simple usage**:
```
Generate a responsive pricing card component using houtini-lm
```

**What you get**:
- Complete component files (HTML, CSS, JavaScript)
- Responsive design with mobile-first approach
- Accessibility compliance (ARIA attributes, keyboard navigation)
- Theme support with CSS custom properties
- Framework-specific implementations (React, Vue, etc.)

**Advanced usage**:
```json
{
  "name": "houtini-lm:generate_responsive_component",
  "parameters": {
    "name": "PricingCard",
    "type": "card",
    "framework": "react",
    "darkMode": true,
    "animations": true,
    "context": {
      "designSystem": "tailwind",
      "brandColors": ["#0066FF", "#00CC88"]
    }
  }
}
```

### 9. `generate_enhanced_static_site` - Complete Static Website Generation

**Purpose**: Generate complete static websites with modern features

**Simple usage**:
```
Create a portfolio website using houtini-lm with modern design
```

**What you get**:
- Complete website with all requested pages
- Modern, responsive design
- SEO optimization with proper meta tags
- Performance optimization
- Cross-browser compatibility

## Best Practices for Generation Functions

### Getting High-Quality Output

1. **Be specific about requirements**: Include framework, design preferences, and functionality needs
2. **Provide context**: Share existing code patterns and architectural preferences  
3. **Use appropriate complexity**: Match the depth to your project needs
4. **Include examples**: Reference existing components or sites you like

### Framework Integration

1. **Specify your stack**: Include framework, version, and key libraries
2. **Share design systems**: Provide brand colours, typography, and component patterns
3. **Include constraints**: Mention accessibility requirements, browser support, or performance targets

### Quality Assurance

1. **Review generated code**: Understand what was created and why
2. **Test thoroughly**: Generated code should be tested in your environment
3. **Customize appropriately**: Use generated code as a foundation for refinement
4. **Security review**: Especially important for WordPress and backend code

## Workflow Patterns

### Complete Project Setup
1. `generate_wordpress_plugin` - Create foundation
2. `generate_unit_tests` - Add test coverage
3. `generate_documentation` - Create user docs
4. Strategic review with Claude

### Legacy Code Modernization
1. `suggest_refactoring` - Identify improvements
2. `convert_to_typescript` - Add type safety
3. `generate_unit_tests` - Ensure reliability
4. Migration planning with Claude

### Frontend Development Acceleration
1. `generate_responsive_component` - Create UI components
2. `generate_enhanced_static_site` - Build complete site
3. `wordpress_theme_from_static` - Convert to dynamic theme
4. User experience optimization with Claude

## Framework-Specific Features

### React/Vue/Angular Components
- Modern hooks and composition patterns
- TypeScript support with proper typing
- State management integration
- Testing utilities and examples
- Accessibility compliance (WCAG 2.1)

### WordPress Development
- Security best practices (nonces, sanitization)
- Proper hook usage and filter implementation
- Database interaction with prepared statements
- Coding standards compliance
- Internationalization support

### Static Site Generation
- Modern build tool integration
- Performance optimization techniques
- SEO and meta tag optimization
- Progressive Web App features
- Cross-browser compatibility

## Security Considerations

### WordPress Security
- All generated plugins include proper nonce verification
- Database queries use prepared statements
- Capability checks restrict access appropriately
- Input sanitization and output escaping implemented

### Frontend Security
- XSS prevention in generated components
- Content Security Policy considerations
- Secure form handling and validation
- Protection against common web vulnerabilities

## Performance Optimization

### Generation Speed
- Functions automatically detect optimal execution strategy
- Smart caching prevents regenerating identical requests
- Token usage optimized for your model's capabilities
- Efficient chunking for large generation tasks

### Output Quality
- Generated code includes performance optimizations
- Responsive designs use efficient CSS patterns
- JavaScript generated with modern, performant patterns
- Database queries optimized for WordPress environments

---

*These generation functions are your creative toolkit for building production-ready solutions. They handle the repetitive, time-consuming parts of development so you can focus on architecture, user experience, and business logic.*