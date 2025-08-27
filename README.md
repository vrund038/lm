# Local LLM MCP Server v3.0 (Private)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

**⚠️ PRIVATE REPOSITORY - NOT FOR PUBLIC DISTRIBUTION**

A groundbreaking MCP (Model Context Protocol) server that enables Claude to offload tasks to local LLMs running in LM Studio. Version 3.0 introduces context-aware prompts and 5 powerful new tools for 90% token savings!

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

- 🚀 **[Getting Started](GETTING_STARTED.md)** - Step-by-step setup guide
- 🔄 **[Migration Guide v3](MIGRATION_GUIDE_V3.md)** - Upgrading to v3.0
- 📋 **[Migration Guide v2](MIGRATION_GUIDE.md)** - Upgrading from v1.x
- 🔒 **[Security Configuration](SECURITY_CONFIG.md)** - Security settings
- 🔧 **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
- 📖 **[API Reference](#available-tools)** - All available tools

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

### Local Installation from Private Repository

1. **Clone the private repository:**
```bash
git clone https://github.com/richardbaxterseo/local-llm-mcp.git
cd local-llm-mcp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

### Claude Configuration

Add to your Claude desktop configuration file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["C:\\MCP\\local-llm-mcp\\dist\\index.js"],
      "env": {
        "LM_STUDIO_URL": "ws://localhost:1234",
        "LLM_MCP_ALLOWED_DIRS": "C:\\MCP,C:\\Users\\YourName\\Documents,C:\\Projects"
      }
    }
  }
}
```

**Important:** Update the paths to match your local installation directory.

## Usage Examples
