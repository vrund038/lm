# Houtini LM MCP Server v1.0

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Functions](https://img.shields.io/badge/Functions-Complete-brightgreen)](https://github.com/houtini-ai/lm)
[![Architecture](https://img.shields.io/badge/Architecture-Plugin%20Based-blue)](https://github.com/houtini-ai/lm)

**Local AI processing for unlimited development without API costs**

A sophisticated MCP (Model Context Protocol) server that enables Claude to offload routine tasks to local LLMs running in LM Studio. Preserve Claude's context window for strategic work whilst handling detailed analysis locally.

## 🎯 Core Purpose

**Context Window Preservation**: Offload deterministic, routine tasks to local LLM while preserving Claude's context for strategic analysis and decision-making.

**Plugin Architecture**: Modern plugin-based system with security integration  
**Dynamic Context Management**: Automatic chunking for large operations  
**Security First**: Comprehensive security wrapper for all operations

## 🚀 What's New in v4.3

### 🔗 Chained Analysis Workflows
- **WordPress Plugin Auditor**: Chains structure, dependencies, security, database, and quality analysis
- **WordPress Theme Auditor**: Comprehensive theme audit including accessibility, SEO, and performance
- **Intelligent Step Sequencing**: Results from earlier steps inform later analysis
- **Professional Caching**: Each step caches results for performance optimization

### 📊 Enhanced Analysis Coverage
- **Code Quality Analysis**: Comprehensive maintainability, complexity, and best practices assessment
- **Database Query Analysis**: SQL injection detection, performance optimization recommendations
- **Dependency Analysis**: Circular dependency detection, unused import identification
- **Directory Structure Analysis**: Markdown tree visualization with file/folder statistics

### 🎯 Template-Based Development
- **Universal Plugin Template**: Single template supporting both single-file and multi-file analysis
- **Automatic Mode Detection**: Intelligent switching between analysis modes based on parameters
- **Centralized Utilities**: Shared patterns for model setup, response processing, and error handling
- **Professional Cache System**: TTL-based caching with statistics and memory management

### 🔒 Security Integration (v4.2)
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
- **`analyze_single_file`**: Comprehensive code structure, quality, security, and performance analysis
- **`analyze_project_structure`**: Project architecture analysis with dependency mapping
- **`analyze_code_quality`**: Code quality assessment with maintainability metrics
- **`analyze_dependencies`**: Dependency analysis including circular references and unused imports
- **`analyze_database_queries`**: Database query performance and security analysis
- **`analyze_wordpress_security`**: WordPress-specific security audit with OWASP compliance
- **`analyze_n8n_workflow`**: n8n workflow optimization and best practices
- **`count_files`**: Directory structure analysis with markdown tree visualization

### WordPress-Specific Auditing
- **`audit_wordpress_plugin`**: Comprehensive WordPress plugin audit chaining multiple analysis steps
- **`audit_wordpress_theme`**: Complete WordPress theme audit for security, performance, accessibility, and SEO

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
- **`generate_project_documentation`**: Comprehensive project documentation generation
- **`security_audit`**: Project-wide security analysis with cross-file vulnerability detection

### System Functions
- **`health_check`**: LM Studio connection and model status
- **`clear_analysis_cache`**: Cache management
- **`get_cache_statistics`**: Cache performance metrics

### Fun & Creative Functions 🎮🎨
- **`arcade_game`**: Generate complete playable 2D arcade games using HTML5 Canvas with player controls, enemies, and game mechanics
- **`create_text_adventure`**: Create complete interactive text adventure games with branching storylines, inventory systems, and multiple endings
- **`css_art_generator`**: Create pure CSS drawings, animations, and interactive art with no images required - just clever CSS techniques

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

## 💬 Friendly Usage Examples

Here are natural ways to use Houtini LM in your conversations with Claude:

### Code Analysis
"Use houtini-lm MCP to audit the code quality in this folder"
"Can you analyze the security of my WordPress plugin using local-llm?"
"Please use the local MCP to check for unused files in my project"

### WordPress Development  
"Use local-llm to run a complete audit on my WordPress theme"
"Can you generate a WordPress plugin for contact management using the MCP?"
"Please analyze my WordPress code for security issues with the local server"

### Project Analysis
"Use houtini-lm to analyze the structure of my React project"
"Can you check my database queries for security issues using local-llm?"
"Please use the MCP to trace the execution path through my authentication system"

### Code Generation
"Generate unit tests for this file using the local MCP server"
"Can you convert this JavaScript to TypeScript using local-llm?"
"Please create responsive components using the houtini-lm functions"

### Creative Projects
"Use local-llm to create a space shooter game for my portfolio"
"Can you generate some CSS art using the MCP creative functions?"
"Please create an interactive text adventure using houtini-lm"

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

## 🚀 Performance Benefits

### Chained Analysis Benefits

- **Comprehensive Coverage**: Single command executes 5-8 analysis steps
- **Context Preservation**: Each step builds on previous results for deeper insights  
- **Professional Caching**: Repeated audits skip completed steps for massive speed improvements
- **Intelligent Synthesis**: Expert-level synthesis of all analysis results into actionable reports

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

Complete guides for each function category:

- **[Analysis Functions Guide](https://github.com/houtini-ai/docs/blob/main/analysis-functions.md)** - Comprehensive guide to all analysis functions with examples and use cases
- **[Generation Functions Guide](https://github.com/houtini-ai/docs/blob/main/generation-functions.md)** - Complete guide to code and content generation functions  
- **[Creative Functions Guide](https://github.com/houtini-ai/docs/blob/main/creative-functions.md)** - Guide to games, art, and interactive content creation
- **[System Functions Guide](https://github.com/houtini-ai/docs/blob/main/system-functions.md)** - Health checks, diagnostics, and system management
- **[Complete User Guide](https://github.com/houtini-ai/docs/blob/main/user-guide.md)** - Comprehensive user guide with workflows and best practices

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

### v4.3 (Current) - Chained Analysis & Template Architecture  
- WordPress plugin and theme comprehensive auditors
- Universal plugin template with automatic mode detection
- Enhanced analysis coverage (dependencies, database queries, code quality)
- Directory structure visualization with `count_files`
- Professional cache system with TTL and statistics

### v4.2 - Modern Security Integration
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
2. Review the complete documentation guides
3. Contact the repository maintainer

---

**Version**: 4.3.0  
**Architecture**: Universal Template with Chained Analysis  
**Last Updated**: January 2025  
**Status**: Active Development
