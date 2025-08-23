# Local LLM MCP Server v3.0

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![GitHub release](https://img.shields.io/github/v/release/richardbaxterseo/local-llm-mcp)](https://github.com/richardbaxterseo/local-llm-mcp/releases)
[![npm version](https://badge.fury.io/js/@richardbaxterseo%2Flocal-llm-mcp.svg)](https://www.npmjs.com/package/@richardbaxterseo/local-llm-mcp)

An MCP (Model Context Protocol) server that enables Claude to offload tasks to local LLMs running in LM Studio. Version 3.0 introduces context-aware prompts and 5 powerful new tools for 90% token savings!

## 🚀 What's New in v3.0

### Context-Aware Prompts
All major tools now support optional context for domain-specific analysis:
- **Project Types**: WordPress, React, n8n, Node.js, and more
- **Framework-Specific**: Best practices for each framework
- **Smart Suggestions**: Context-aware refactoring and testing
- **90% Token Savings**: Offload routine tasks intelligently

### 5 New Powerful Tools
1. **`generate_wordpress_plugin`** - Complete WordPress plugin generator
2. **`analyze_n8n_workflow`** - n8n workflow optimization
3. **`generate_responsive_component`** - Accessible component generator
4. **`convert_to_typescript`** - JavaScript to TypeScript converter
5. **`security_audit`** - Project-specific security auditor

### Full Backward Compatibility
All existing tools work exactly as before - context is optional!

## Documentation

- 📚 **[Complete Guide](COMPLETE_GUIDE.md)** - Full technical documentation
- 🚀 **[Getting Started](GETTING_STARTED.md)** - Step-by-step setup from zero
- 📖 **[API Reference](COMPLETE_GUIDE.md#api-reference)** - All available tools
- 🔄 **[Migration Guide](MIGRATION_GUIDE_V3.md)** - Upgrading to v3.0
- 🔧 **[Troubleshooting](#troubleshooting)** - Common issues and solutions

## Features

### Core Capabilities
- **Code Analysis**: Structure, patterns, complexity, security
- **Code Generation**: Tests, documentation, refactoring suggestions
- **File Processing**: Direct file analysis without manual reading
- **CSV Analysis**: Filter and analyze data with custom criteria
- **TypeScript Conversion**: Migrate JavaScript projects to TypeScript
- **Security Auditing**: Project-specific vulnerability scanning
- **Component Generation**: Create accessible, responsive components

### Supported Project Types
- WordPress (Plugins & Themes)
- React (Apps & Components)
- n8n (Nodes & Workflows)
- Node.js (APIs & CLIs)
- HTML/CSS Components
- Generic JavaScript/TypeScript

## Prerequisites

1. **LM Studio**: Download and install from [lmstudio.ai](https://lmstudio.ai)
2. **Node.js**: Version 18 or higher
3. **A loaded model in LM Studio**: Recommended models:
   - Qwen 2.5 Coder (best for code tasks)
   - DeepSeek Coder
   - CodeLlama variants
   - Any general model for non-code tasks

## Installation

### Method 1: NPM Global Install (Recommended)

```bash
npm install -g @richardbaxterseo/local-llm-mcp
```

**Claude Config:**
```json
{
  "mcpServers": {
    "local-llm": {
      "command": "npx",
      "args": ["@richardbaxterseo/local-llm-mcp"],
      "env": {
        "LM_STUDIO_URL": "ws://localhost:1234",
        "LLM_MCP_ALLOWED_DIRS": "C:\\Users\\YourName\\Documents,C:\\Projects"
      }
    }
  }
}
```

### Method 2: Local Installation

```bash
git clone https://github.com/richardbaxterseo/local-llm-mcp.git
cd local-llm-mcp
npm install
npm run build
```

## Usage Examples

### Basic Usage (Backward Compatible)
```javascript
// Works exactly as before - no changes needed!
await local-llm:analyze_code_structure({
  filePath: "app.js"
});
```

### Enhanced Context Usage (New in v3.0)
```javascript
// WordPress Plugin Analysis
await local-llm:analyze_code_structure({
  filePath: "wp-content/plugins/my-plugin/my-plugin.php",
  context: {
    projectType: "wordpress-plugin",
    framework: "WordPress",
    frameworkVersion: "6.4",
    standards: ["WordPress Coding Standards", "PSR-4"]
  }
});

// React Component Testing
await local-llm:generate_unit_tests({
  filePath: "components/UserProfile.jsx",
  context: {
    projectType: "react-component",
    testFramework: "jest",
    dependencies: ["react-testing-library", "jest-dom"],
    coverageTarget: 80
  }
});

// n8n Node Analysis
await local-llm:analyze_n8n_workflow({
  workflow: {
    nodes: [...],
    connections: {...}
  }
});
```

### New Tool Examples

#### Generate WordPress Plugin
```javascript
await local-llm:generate_wordpress_plugin({
  pluginName: "Custom Analytics",
  description: "Track custom events in WordPress",
  features: ["admin dashboard", "REST API", "gutenberg block"],
  includeTests: true,
  phpVersion: "8.0"
});
```

#### Convert to TypeScript
```javascript
await local-llm:convert_to_typescript({
  filePath: "src/utils/helpers.js",
  strictMode: true,
  preserveJSDoc: true,
  addTypeImports: true
});
```

#### Security Audit
```javascript
await local-llm:security_audit({
  filePath: "api/auth.js",
  projectType: "node-api",
  checkTypes: ["injection", "authentication", "validation"],
  includeFixSuggestions: true
});
```

## Token Savings Example

### Without Context (Traditional Approach)
```
Claude reads 100 files → 100,000 tokens used
Claude analyzes each file → Complex context management
Result: Context window exhausted quickly
```

### With Context (v3.0 Approach)
```
Local LLM analyzes 100 files → 0 Claude tokens used
Claude receives summaries → 5,000 tokens used
Result: 95% token savings, full project understanding maintained
```

## Available Tools

### Enhanced Tools (with optional context)
- `analyze_code_structure` - Analyze code with framework awareness
- `generate_unit_tests` - Create framework-specific tests
- `generate_documentation` - Generate audience-appropriate docs
- `suggest_refactoring` - Project-specific improvements

### New Tools (v3.0)
- `generate_wordpress_plugin` - Full WordPress plugin scaffolding
- `analyze_n8n_workflow` - Optimize n8n workflows
- `generate_responsive_component` - Create accessible components
- `convert_to_typescript` - Migrate JS to TS intelligently
- `security_audit` - Project-specific security analysis

### Existing Tools
- `detect_patterns` - Find design patterns and anti-patterns
- `validate_syntax` - Check syntax and find bugs
- `suggest_variable_names` - Improve naming conventions
- `analyze_file` - General file analysis
- `analyze_csv_data` - Filter and analyze CSV data
- `health_check` - Verify LM Studio connection

## Configuration

### Environment Variables
- `LM_STUDIO_URL`: WebSocket URL (default: `ws://localhost:1234`)
- `LLM_MCP_ALLOWED_DIRS`: Comma-separated allowed directories
- `LLM_MAX_RETRIES`: Max retry attempts (default: 3)
- `LLM_RETRY_DELAY`: Retry delay in ms (default: 1000)

### Security Settings
Configure allowed directories for file access:
```bash
# Windows
set LLM_MCP_ALLOWED_DIRS=C:\Projects,C:\Users\YourName\Documents

# Linux/Mac
export LLM_MCP_ALLOWED_DIRS=/home/user/projects,/home/user/documents
```

## Best Practices

### 1. Use Context for Better Results
```javascript
// ❌ Generic analysis
await local-llm:analyze_code_structure({ filePath: "plugin.php" });

// ✅ Context-aware analysis
await local-llm:analyze_code_structure({
  filePath: "plugin.php",
  context: { projectType: "wordpress-plugin" }
});
```

### 2. Offload Repetitive Tasks
- File-by-file analysis
- Boilerplate generation
- Documentation creation
- Basic refactoring

### 3. Keep Strategic Work in Claude
- Architecture decisions
- Complex integrations
- Security-critical reviews
- User experience design

## Troubleshooting

### LM Studio Connection Issues
```bash
# Test connection
npm test:connection

# Check if LM Studio is running on correct port
curl http://localhost:1234/v1/models
```

### Common Issues
1. **"Server transport closed unexpectedly"**
   - Ensure LM Studio is running
   - Check the URL matches your settings
   - Verify a model is loaded

2. **"Path not allowed"**
   - Add directory to `LLM_MCP_ALLOWED_DIRS`
   - Use absolute paths

3. **"No response from LLM"**
   - Check model is loaded in LM Studio
   - Verify model has enough context length
   - Try a different model

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Links

- [GitHub Repository](https://github.com/richardbaxterseo/local-llm-mcp)
- [NPM Package](https://www.npmjs.com/package/@richardbaxterseo/local-llm-mcp)
- [Issue Tracker](https://github.com/richardbaxterseo/local-llm-mcp/issues)
