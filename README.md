# Local LLM MCP Server v4.0 (Private)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

**⚠️ PRIVATE REPOSITORY - NOT FOR PUBLIC DISTRIBUTION**

A groundbreaking MCP (Model Context Protocol) server that enables Claude to offload tasks to local LLMs running in LM Studio. Version 4.0 introduces powerful multi-file analysis capabilities with automatic cache population for seamless operation!

## 🎉 What's New in v4.0

### 🔥 Multi-File Analysis with Auto-Population
**Game-changing improvement**: Multi-file analysis functions now automatically populate their cache! No need to manually run `analyze_project_structure` first.

#### Key Improvements:
- **Automatic Cache Population**: Functions intelligently analyze common entry files when called
- **Smart File Discovery**: Automatically finds index.js, main.js, app.js and other entry points
- **Zero Configuration**: Just call the function - it handles everything else
- **Performance Optimised**: Analyzes up to 10 files initially to avoid delays
- **Helpful Error Messages**: Shows available symbols when something isn't found

### 7 New Multi-File Analysis Tools
1. **`compare_integration`** - Compare how multiple files work together
2. **`trace_execution_path`** - Follow code execution across files
3. **`find_pattern_usage`** - Search for patterns across entire projects
4. **`diff_method_signatures`** - Compare method signatures between files
5. **`analyze_project_structure`** - Get bird's-eye view of architecture
6. **`clear_analysis_cache`** - Clear cached analysis data
7. **`get_cache_statistics`** - View cache status and performance

### Token Savings: 94% Average
- Multi-file analysis: 35,000+ tokens saved per project scan
- Code generation: 2,000-5,000 tokens per component
- Security audits: 1,000+ tokens per audit

## 🚀 What's Included from v3.0

### Context-Aware Prompts
All major tools support optional context for domain-specific analysis:
- **Project Types**: WordPress, React, n8n, Node.js, and more
- **Framework-Specific**: Best practices for each framework
- **Smart Suggestions**: Context-aware refactoring and testing

### 10 Powerful Single-File Tools
1. **`analyze_single_file`** - Analyse code structure with framework context
2. **`generate_unit_tests`** - Create test suites with framework patterns
3. **`generate_documentation`** - Generate docs for different audiences
4. **`suggest_refactoring`** - Get refactoring suggestions
5. **`generate_wordpress_plugin`** - Complete WordPress plugin generator
6. **`analyze_n8n_workflow`** - n8n workflow optimization
7. **`generate_responsive_component`** - Accessible component generator
8. **`convert_to_typescript`** - JavaScript to TypeScript converter
9. **`security_audit`** - Project-specific security auditor
10. **`health_check`** - Verify LM Studio connection

### Full Backward Compatibility
All tools from v1, v2, and v3 work exactly as before!

## Documentation

- 🚀 **[Getting Started](GETTING_STARTED.md)** - Step-by-step setup guide
- 🆕 **[Multi-File Analysis Guide](MULTI_FILE_GUIDE.md)** - Using the new v4.0 features
- 🔄 **[Migration Guide v3](MIGRATION_GUIDE_V3.md)** - Upgrading to v3.0
- 📋 **[Migration Guide v2](MIGRATION_GUIDE.md)** - Upgrading from v1.x
- 🔒 **[Security Configuration](SECURITY_CONFIG.md)** - Security settings
- 🔧 **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
- 📖 **[API Reference](#available-tools)** - All available tools

## Installation

### Prerequisites
1. **LM Studio** - Download from [lmstudio.ai](https://lmstudio.ai)
2. **Node.js 18+** - Required for the MCP server
3. **Claude Desktop** - With MCP support enabled

### Quick Start
```bash
# Clone the repository
git clone [repository-url]
cd local-llm-mcp

# Install dependencies
npm install

# Build the project
npm run build

# The server is configured in Claude Desktop's config file
```

### Claude Desktop Configuration
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["C:\\MCP\\local-llm-mcp\\dist\\index.js"],
      "env": {
        "LM_STUDIO_URL": "ws://127.0.0.1:1234",
        "LLM_MCP_ALLOWED_DIRS": "C:\\Dev,C:\\Projects,C:\\MCP"
      }
    }
  }
}
```

## Usage Examples

### Multi-File Analysis (v4.0) - With Auto-Population!

```javascript
// Just call the function - cache auto-populates!
trace_execution_path({
  entryPoint: "MyClass::method",
  traceDepth: 5
})
// Automatically finds and analyzes relevant files

// Compare file integration
compare_integration({
  files: ["src/index.js", "src/utils.js"],
  analysisType: "integration"
})
// Auto-populates cache from the file directories

// Find patterns across a project
find_pattern_usage({
  projectPath: "C:\\MyProject",
  patterns: ["async function", "TODO"],
  includeContext: 3
})
// Scans and caches files automatically
```

### Single-File Analysis (v3.0)

```javascript
// Analyze with framework context
analyze_single_file({
  filePath: "C:\\project\\auth.js",
  context: {
    projectType: "node-api",
    framework: "Express"
  }
})

// Generate WordPress plugin
generate_wordpress_plugin({
  name: "My Custom Plugin",
  description: "A powerful plugin",
  features: ["custom post type", "admin interface"],
  prefix: "mcp_"
})
```

## Available Tools

### Multi-File Analysis Tools (v4.0)

| Tool | Description | Token Savings |
|------|------------|---------------|
| `compare_integration` | Analyse integration between files | 1,000-2,000 |
| `trace_execution_path` | Trace execution through files | 1,500-3,000 |
| `find_pattern_usage` | Find patterns across projects | 35,000+ |
| `diff_method_signatures` | Compare method signatures | 500-1,000 |
| `analyze_project_structure` | Analyse project architecture | 5,000-10,000 |
| `clear_analysis_cache` | Clear analysis cache | N/A |
| `get_cache_statistics` | View cache statistics | 500 |

### Single-File Analysis Tools (v3.0)

| Tool | Description | Token Savings |
|------|------------|---------------|
| `analyze_single_file` | Analyse code structure | 500-1,000 |
| `generate_unit_tests` | Generate test suites | 200-500 |
| `generate_documentation` | Create documentation | 300-600 |
| `suggest_refactoring` | Suggest improvements | 400-800 |
| `generate_wordpress_plugin` | Create WP plugin | 2,000-5,000 |
| `analyze_n8n_workflow` | Optimise n8n workflows | 500-1,000 |
| `generate_responsive_component` | Create UI components | 500-1,000 |
| `convert_to_typescript` | Convert JS to TS | 1,000+ |
| `security_audit` | Security analysis | 1,000+ |

## Performance & Token Savings

### Real-World Example: Large Project Analysis
```
Without Local LLM: 100,000 tokens (reading all files)
With Local LLM v4.0: 5,000 tokens (strategic summaries only)
Savings: 95% context preservation
```

### Auto-Population Performance
- **First call**: +1-2 seconds for cache population
- **Subsequent calls**: No performance impact
- **Smart limiting**: Only analyses 10 files initially
- **Cache persistence**: Lasts for entire session

## Requirements

- **Node.js**: 18.0.0 or higher
- **LM Studio**: Latest version with WebSocket API enabled
- **Claude Desktop**: With MCP support
- **RAM**: 8GB minimum (16GB recommended for large models)
- **Disk Space**: Varies by model (5-50GB typical)

## Security Features

- **Path validation**: All file access is restricted to allowed directories
- **Sandboxed execution**: Runs in isolated environment
- **No network access**: Local processing only (except LM Studio connection)
- **Configurable restrictions**: Set your own security boundaries

## Contributing

This is a private repository. Please contact the maintainer for contribution guidelines.

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Support

For issues or questions:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review [Getting Started](GETTING_STARTED.md)
3. Contact the repository maintainer

---

**Version**: 4.0.0  
**Last Updated**: August 2025  
**Status**: Private Development
