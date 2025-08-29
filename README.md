# Local LLM MCP Server v4.2

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Functions](https://img.shields.io/badge/Functions-Complete-brightgreen)](https://github.com/richardbaxterseo/local-llm-mcp)
[![Architecture](https://img.shields.io/badge/Architecture-Plugin%20Based-blue)](https://github.com/richardbaxterseo/local-llm-mcp)

**⚠️ PRIVATE REPOSITORY - NOT FOR PUBLIC DISTRIBUTION**

A sophisticated MCP (Model Context Protocol) server that enables Claude to offload routine tasks to local LLMs running in LM Studio, preserving Claude's context window for strategic work. Features modern plugin architecture with comprehensive security integration and dynamic context window management.

## 🎯 Core Purpose

**Context Window Preservation**: Offload deterministic, routine tasks to local LLM while preserving Claude's context for strategic analysis and decision-making.

**Token Savings**: 50-95% context preservation across all operations  
**Plugin Architecture**: Modern plugin-based system with security integration  
**Dynamic Context Management**: Automatic chunking for large operations  
**Security First**: Comprehensive security wrapper for all operations

## 🚀 What's New in v4.2

### 🔒 Security Integration
- **Universal Security Wrapper**: All plugins now use `withSecurity` for automatic security validation
- **Foreign Prompt Prevention**: Advanced sanitization prevents injection attacks
- **Path Validation**: Comprehensive file path security with `validateAndNormalizePath`
- **Output Encoding**: Secure output encoding for different contexts

### ⚡ Response Management
- **ResponseFactory**: Consistent, spec-compliant responses across all functions
- **Smart Parsing**: Automatic parsing of LLM responses into structured formats
- **Error Handling**: Comprehensive error responses with detailed context
- **Performance Tracking**: Execution time tracking for all operations

### 📊 Context Window Management
- **ThreeStagePromptManager**: Intelligent prompt chunking for large operations
- **Dynamic Context Detection**: Automatic context window size detection from LM Studio
- **File Chunking Strategies**: Smart file processing for large datasets
- **Token Estimation**: Accurate token counting for optimal performance

### 🛠 Modern LM Studio Integration
- **Latest SDK**: Full integration with LM Studio SDK v2.x
- **Streaming Responses**: Efficient streaming for real-time processing
- **Model Management**: Automatic model detection and context limit handling
- **Health Monitoring**: Comprehensive health checks with detailed diagnostics

## 🔧 Available Functions

### Analysis Functions
- **`analyze_single_file`**: Comprehensive file analysis with framework context
- **`analyze_project_structure`**: Project architecture analysis with dependency mapping
- **`security_audit`**: Multi-file security analysis with OWASP compliance
- **`analyze_n8n_workflow`**: n8n workflow optimization and best practices

### Generation Functions
- **`generate_unit_tests`**: Test suite generation with framework-specific patterns
- **`generate_documentation`**: Documentation generation for different audiences
- **`suggest_refactoring`**: Intelligent refactoring suggestions
- **`generate_wordpress_plugin`**: Complete WordPress plugin structure generator
- **`convert_to_typescript`**: JavaScript to TypeScript conversion with type annotations
- **`generate_responsive_component`**: Modern, accessible UI component generation

### Multi-File Functions
- **`compare_integration`**: Cross-file integration analysis
- **`trace_execution_path`**: Code execution path tracing
- **`find_pattern_usage`**: Pattern search across projects
- **`diff_method_signatures`**: Method signature comparison
- **`find_unused_files`**: Advanced unused file detection

### System Functions
- **`health_check`**: LM Studio connection and model status
- **`clear_analysis_cache`**: Cache management
- **`get_cache_statistics`**: Cache performance metrics

### Custom Functions
- **`custom_prompt`**: Direct LLM access for flexible tasks

## 📋 Installation

### Prerequisites
1. **LM Studio** - Download from [lmstudio.ai](https://lmstudio.ai)
2. **Node.js 18+** - Required for the MCP server
3. **Claude Desktop** - With MCP support enabled

### Quick Setup
```bash
# Navigate to your MCP directory
cd C:\MCP\local-llm-mcp

# Install dependencies
npm install

# Build the project
npm run build

# IMPORTANT: Restart Claude Desktop after building
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
        "LLM_MCP_ALLOWED_DIRS": "C:\\MCP,C:\\Dev,C:\\Projects"
      }
    }
  }
}
```

## 💡 Usage Examples

### Modern Security Analysis
```javascript
// Comprehensive security audit with cross-file analysis
security_audit({
  projectPath: "C:\\MyAPI",
  projectType: "node-api",
  auditDepth: "comprehensive",
  includeOwasp: true,
  focusAreas: ["authentication", "data-flow", "input-validation"]
})
```

### Context-Aware Code Generation
```javascript
// Generate tests with framework-specific patterns
generate_unit_tests({
  filePath: "src/auth.js",
  testFramework: "jest",
  coverageTarget: "comprehensive",
  context: {
    projectType: "node-api",
    testStyle: "bdd",
    includeEdgeCases: true
  }
})
```

### Multi-File Analysis
```javascript
// Find patterns across entire project
find_pattern_usage({
  projectPath: "C:\\MyProject",
  patterns: ["async function", "TODO:", "FIXME:"],
  includeContext: 3
})

// Compare integration between files
compare_integration({
  files: ["src/auth.js", "src/middleware.js", "src/routes.js"],
  analysisType: "integration",
  focus: ["method_compatibility", "data_flow"]
})
```

### Custom Analysis Tasks
```javascript
// Direct LLM access for specialized tasks
custom_prompt({
  prompt: "Analyze this API for GraphQL migration opportunities",
  files: ["src/api/rest-endpoints.js", "src/schemas/models.js"],
  context: {
    task_type: "migration_analysis",
    output_format: "structured_report",
    requirements: ["backward_compatibility", "performance"]
  },
  max_tokens: 4000
})
```

## 🏗 Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Claude Desktop │────▶│  MCP Server      │────▶│   LM Studio     │
│  (MCP Client)   │◀────│  (Plugin System) │◀────│   (Local LLM)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Plugin Registry   │
                    └─────────────────────┘
                               │
        ┌──────────────┬───────┴────────┬──────────────┐
        ▼              ▼                ▼              ▼
   [Analyze]      [Generate]      [Multifile]     [Custom]
    Plugins        Plugins         Plugins        Plugins
        │              │                │              │
        ▼              ▼                ▼              ▼
  [Security]    [Response]      [3-Stage]      [Dynamic]
   Wrapper       Factory        Prompts       Context
```

### Key Components

- **Security Layer**: `withSecurity` wrapper for all operations
- **Response Factory**: Consistent response formatting
- **3-Stage Prompt Manager**: Context window management
- **Plugin System**: Modular, extensible architecture
- **Cache Management**: Intelligent caching system

## 🚀 Performance & Token Savings

### Real-World Examples

| Task | Without Local LLM | With Local LLM | Savings |
|------|-------------------|----------------|---------|
| 100-file analysis | 50,000 tokens | 2,500 tokens | 95% |
| Unit test generation | 5,000 tokens | 250 tokens | 95% |
| Security audit | 10,000 tokens | 500 tokens | 95% |
| Code refactoring | 8,000 tokens | 400 tokens | 95% |

### Performance Features

- **Dynamic Context Detection**: Automatic context window size detection
- **Intelligent Chunking**: File-level chunking for large operations
- **Streaming Processing**: Real-time response handling
- **Cache Optimization**: Smart caching for repeated operations

## 🛡 Security Features

### Comprehensive Protection

- **Path Validation**: All file paths validated through `validateAndNormalizePath`
- **Directory Restrictions**: Access limited to configured allowed directories
- **Input Sanitization**: Advanced prompt injection prevention
- **Output Encoding**: Context-aware output encoding
- **Execution Sandboxing**: Isolated execution environment

### Security Configuration

```json
{
  "LLM_MCP_ALLOWED_DIRS": "C:\\MCP,C:\\Projects,C:\\Dev",
  "SECURITY_LOG_LEVEL": "info",
  "ENABLE_SECURITY_MONITORING": "true"
}
```

## 🔧 Development

### Plugin Development

See [PLUGIN_DEVELOPMENT_GUIDE.md](PLUGIN_DEVELOPMENT_GUIDE.md) for comprehensive development documentation.

### Modern Development Patterns

```typescript
// Modern plugin structure with security integration
export class MyPlugin extends BasePlugin implements IPromptPlugin {
  async execute(params: any, llmClient: any) {
    return await withSecurity(this, params, llmClient, async (secureParams) => {
      // Plugin logic with automatic security validation
      const models = await llmClient.llm.listLoaded();
      const model = models[0];
      
      // Use 3-stage prompt management for large operations
      const stages = this.getPromptStages(secureParams);
      const promptManager = new ThreeStagePromptManager(
        await model.getContextLength()
      );
      
      // ResponseFactory for consistent outputs
      return ResponseFactory.parseAndCreateResponse(
        this.name,
        response,
        model.identifier
      );
    });
  }
}
```

### Build Process

```bash
# Development workflow
npm run build        # Build TypeScript
                     # CRITICAL: Restart Claude after building

# Testing
npm test            # Run unit tests
npm run test:watch  # Watch mode for development
```

## 🐛 Troubleshooting

### Common Issues

1. **"No model loaded in LM Studio"**
   - Ensure LM Studio is running with a loaded model
   - Check WebSocket connection at `ws://localhost:1234`

2. **Security violations**
   - All file paths must be within `LLM_MCP_ALLOWED_DIRS`
   - Use absolute paths for reliability
   - Check file permissions

3. **Plugin not registering**
   - Ensure TypeScript is built: `npm run build`
   - Restart Claude Desktop after building
   - Check for import errors in console

4. **Context window exceeded**
   - Functions automatically handle chunking
   - Large files are processed in chunks
   - Consider breaking operations into smaller tasks

### Debug Mode

Enable detailed logging:
```bash
# Set debug environment variable
set DEBUG=local-llm:*

# Or in Claude config
"env": {
  "DEBUG": "local-llm:*",
  "LM_STUDIO_URL": "ws://127.0.0.1:1234"
}
```

## 📚 Documentation

- **[Plugin Development Guide](PLUGIN_DEVELOPMENT_GUIDE.md)** - Comprehensive development documentation
- **[Functional Specification](FUNCTIONAL_SPECIFICATION.md)** - Complete function specifications with parameters and responses

## 📊 System Requirements

### Minimum Requirements
- **Node.js**: 18.0.0 or higher
- **RAM**: 8GB (16GB recommended)
- **Storage**: 2GB for server + model storage
- **OS**: Windows 10/11, macOS, or Linux

### Recommended Setup
- **CPU**: Modern multi-core processor (Intel i7/AMD Ryzen 7 or better)
- **RAM**: 32GB or more for optimal performance with large models
- **GPU**: 12GB+ VRAM recommended (RTX 4070 Ti/RTX 4080 or better)
- **Storage**: NVMe SSD for model storage and fast loading
- **Model**: 7B-13B parameter models for optimal speed/quality balance
- **Network**: Stable connection for model downloads (models range 4-26GB)

## 🔄 Version History

### v4.2 (Current) - Modern Security Integration
- Universal security wrapper (`withSecurity`)
- ResponseFactory for consistent outputs
- ThreeStagePromptManager for context management
- Dynamic context window detection
- Foreign prompt execution prevention

### v4.1 - Enhanced Plugin System
- Improved plugin architecture
- Better error handling
- Performance optimizations

### v4.0 - Multi-File Analysis
- Multi-file analysis capabilities
- Auto-cache population
- Enhanced security audit

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the plugin development guide
3. Contact the repository maintainer

---

**Version**: 4.2.0  
**Architecture**: Modern Plugin System with Security Integration  
**Last Updated**: August 2025  
**Status**: Active Development