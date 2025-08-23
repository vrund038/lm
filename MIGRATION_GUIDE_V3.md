# Migration Guide - v2.x to v3.0

## Overview

Version 3.0 of Local LLM MCP is **fully backward compatible**. All your existing code will continue to work without any changes. This guide shows you how to take advantage of the new features.

## What's New

### 1. Context-Aware Prompts
Enhanced tools now accept an optional `context` parameter for better, domain-specific results.

### 2. Five New Tools
- `generate_wordpress_plugin`
- `analyze_n8n_workflow`
- `generate_responsive_component`
- `convert_to_typescript`
- `security_audit`

### 3. 90% Token Savings
Offload more work to local LLM with smarter, focused prompts.

## Upgrade Steps

### 1. Update the Package

```bash
# NPM global install
npm update -g @richardbaxterseo/local-llm-mcp

# Or fresh install
npm install -g @richardbaxterseo/local-llm-mcp@latest
```

### 2. Restart Claude Desktop

After updating, restart Claude Desktop to load the new tool definitions.

### 3. Verify Installation

```javascript
// Test that new tools are available
await local-llm:health_check({ detailed: true });
```

## Using New Features

### Enhanced Existing Tools

All these tools now accept an optional `context` parameter:

#### Before (still works):
```javascript
await local-llm:analyze_code_structure({
  filePath: "src/components/Header.jsx"
});
```

#### After (with context):
```javascript
await local-llm:analyze_code_structure({
  filePath: "src/components/Header.jsx",
  context: {
    projectType: "react-component",
    framework: "React",
    frameworkVersion: "18.2.0",
    dependencies: ["react-router", "styled-components"],
    standards: ["Airbnb Style Guide", "a11y"]
  }
});
```

### Context Options by Tool

#### analyze_code_structure
```javascript
context: {
  projectType: "wordpress-plugin" | "react-app" | "n8n-node" | "node-api" | ...,
  framework: string,
  frameworkVersion: string,
  dependencies: string[],
  standards: string[],
  focusAreas: string[]
}
```

#### generate_unit_tests
```javascript
context: {
  projectType: string,
  testFramework: "jest" | "mocha" | "phpunit" | ...,
  dependencies: string[],
  testingLibraries: string[],
  coverageTarget: number,
  testStyle: string
}
```

#### generate_documentation
```javascript
context: {
  projectType: string,
  docStyle: "jsdoc" | "tsdoc" | "markdown" | ...,
  audience: "developer" | "enduser" | "api-consumer",
  includeExamples: boolean,
  detailLevel: "minimal" | "standard" | "comprehensive"
}
```

#### suggest_refactoring
```javascript
context: {
  projectType: string,
  targetVersion: string,
  focusAreas: string[],
  constraints: string[],
  preserveApi: boolean
}
```

### New Tools Usage

#### generate_wordpress_plugin
```javascript
await local-llm:generate_wordpress_plugin({
  pluginName: "Event Manager",
  description: "Manage and display events",
  features: ["custom post type", "shortcodes", "REST API", "admin interface"],
  includeTests: true,
  testFramework: "phpunit",
  phpVersion: "8.0",
  wpVersion: "6.4",
  namespace: "EventManager"
});
```

#### analyze_n8n_workflow
```javascript
await local-llm:analyze_n8n_workflow({
  workflow: {
    name: "Customer Onboarding",
    nodes: [...],
    connections: {...}
  }
});
```

#### generate_responsive_component
```javascript
await local-llm:generate_responsive_component({
  componentName: "ProductCard",
  componentType: "react",
  description: "Display product with image, title, price",
  responsive: true,
  accessibility: true,
  styling: "tailwind",
  animations: ["hover", "entrance"],
  breakpoints: ["mobile", "tablet", "desktop"]
});
```

#### convert_to_typescript
```javascript
await local-llm:convert_to_typescript({
  filePath: "src/utils/validators.js",
  strictMode: true,
  targetVersion: "5.0",
  preserveJSDoc: true,
  addTypeImports: true,
  inferTypes: true,
  handleAny: "unknown"
});
```

#### security_audit
```javascript
await local-llm:security_audit({
  filePath: "api/auth.js",
  projectType: "node-api",
  framework: "express",
  checkTypes: ["injection", "authentication", "validation", "xss"],
  includeFixSuggestions: true,
  severityThreshold: "medium"
});
```

## Best Practices for v3.0

### 1. Always Provide Context When Available
```javascript
// ❌ Missing valuable context
await local-llm:generate_unit_tests({
  filePath: "wp-includes/user.php"
});

// ✅ Context enables better tests
await local-llm:generate_unit_tests({
  filePath: "wp-includes/user.php",
  context: {
    projectType: "wordpress-plugin",
    testFramework: "phpunit",
    dependencies: ["brain-monkey", "mockery"],
    coverageTarget: 80
  }
});
```

### 2. Use Project-Specific Analysis
```javascript
// WordPress project
const wpContext = {
  projectType: "wordpress-plugin",
  framework: "WordPress",
  frameworkVersion: "6.4",
  standards: ["WordPress Coding Standards", "PSR-4"]
};

// React project
const reactContext = {
  projectType: "react-app",
  framework: "React",
  frameworkVersion: "18.2.0",
  dependencies: ["redux", "react-router"],
  standards: ["Airbnb Style Guide"]
};
```

### 3. Leverage Token Savings

#### Pattern: Bulk Analysis
```javascript
// Process 100 files with local LLM
const files = await desktop-commander:search_files({
  path: "src",
  pattern: "*.js"
});

for (const file of files) {
  // Offloaded to local LLM - no Claude tokens used
  const analysis = await local-llm:analyze_code_structure({
    filePath: file,
    context: { projectType: "node-api" }
  });
  
  // Store only key findings
  await nova-memory:memory({
    action: "store",
    content: analysis.summary
  });
}

// Claude works with aggregated summaries - 95% token savings
```

## Troubleshooting

### Tools Not Appearing
1. Restart Claude Desktop after update
2. Verify version: `npm list -g @richardbaxterseo/local-llm-mcp`
3. Check health: `await local-llm:health_check()`

### Context Not Working
- Ensure you're using the correct structure
- Context is inside a `context` object, not top-level
- Check spelling of projectType values

### Performance Issues
- Verify LM Studio has sufficient resources
- Try a smaller model for routine tasks
- Use appropriate context depth

## Examples Repository

Find more examples at: https://github.com/richardbaxterseo/local-llm-mcp-examples

## Need Help?

- GitHub Issues: https://github.com/richardbaxterseo/local-llm-mcp/issues
- Documentation: https://github.com/richardbaxterseo/local-llm-mcp#readme
