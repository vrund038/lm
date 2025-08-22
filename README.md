# Local LLM MCP Server v2.1

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![GitHub release](https://img.shields.io/github/v/release/richardbaxterseo/local-llm-mcp)](https://github.com/richardbaxterseo/local-llm-mcp/releases)
[![npm version](https://badge.fury.io/js/@richardbaxterseo%2Flocal-llm-mcp.svg)](https://www.npmjs.com/package/@richardbaxterseo/local-llm-mcp)

An MCP (Model Context Protocol) server that enables Claude to offload tasks to local LLMs running in LM Studio. Version 2.1 adds security features including path validation and configurable directory access.

## Documentation

- 📚 **[Complete Guide](COMPLETE_GUIDE.md)** - Full technical documentation
- 🚀 **[Getting Started](GETTING_STARTED.md)** - Step-by-step setup from zero
- 📖 **[API Reference](COMPLETE_GUIDE.md#api-reference)** - All available tools
- 🔧 **[Troubleshooting](#troubleshooting)** - Common issues and solutions
- 🔄 **[Migration Guide](MIGRATION_GUIDE.md)** - Upgrading from previous versions

## Features

### New in v2.1
- **Security Features**: Path validation and configurable directory access control
- **Path Traversal Protection**: Prevents unauthorized file system access
- **Configurable Allowed Directories**: Control which directories can be accessed
- **Fixed Thinking Tag Regex**: Improved response parsing
- **TypeScript Improvements**: Better type safety and strict mode

### New in v2.0
- **File Attachment Support**: Analyse files directly without reading content first
- **LM Studio SDK Integration**: Replaced axios with official @lmstudio/sdk
- **Enhanced Tools**: New `analyze_file` and `analyze_csv_data` functions
- **Streaming Support**: Better performance with streaming responses
- **Improved Error Handling**: Better detection of LM Studio status

### Core Capabilities
- Code structure analysis with file support
- Unit test generation from files or code snippets
- Documentation generation
- Refactoring suggestions
- Design pattern detection
- Code explanation
- Bug detection
- Performance optimisation
- Variable naming suggestions
- CSV data filtering and analysis

## Prerequisites

1. **LM Studio**: Download and install from [lmstudio.ai](https://lmstudio.ai)
2. **Node.js**: Version 18 or higher
3. **A loaded model in LM Studio**: The server works with any model, but code-focused models like:
   - Qwen 2.5 Coder models
   - DeepSeek Coder models
   - CodeLlama variants
   - Any general model (for non-code tasks)

## Installation Methods

### Method 1: NPM Global Install (Recommended for most users)

```bash
npm install -g @richardbaxterseo/local-llm-mcp
```

**Pros:**
- Easy updates with `npm update -g @richardbaxterseo/local-llm-mcp`
- No build step required
- Simpler path management
- Automatic dependency handling

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

### Method 2: Local Installation (For developers/contributors)

```bash
git clone https://github.com/richardbaxterseo/local-llm-mcp.git
cd local-llm-mcp
npm install
npm run build
```

**Pros:**
- Can modify code
- Test changes immediately
- Contribute to development
- Debug issues locally

**Claude Config:**
```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["C:\\MCP\\local-llm-mcp\\dist\\index.js"],
      "env": {
        "LM_STUDIO_URL": "ws://localhost:1234",
        "LLM_MCP_ALLOWED_DIRS": "C:\\Users\\YourName\\Documents,C:\\Projects"
      }
    }
  }
}
```

## Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `LM_STUDIO_URL` | WebSocket URL for LM Studio | `ws://localhost:1234` | `ws://127.0.0.1:1234` |
| `LLM_MCP_ALLOWED_DIRS` | Comma-separated list of allowed directories | Current directory + defaults | `C:\\Projects,D:\\Code` |
| `LM_STUDIO_MODEL` | Model to use (optional) | `auto` | `qwen-2.5-coder` |

## Quick Start

1. **Install LM Studio** and load a model
2. **Install this server**: `npm install -g @richardbaxterseo/local-llm-mcp`
3. **Test connection**: `node test-connection.mjs`
4. **Configure Claude Desktop** (see configuration above)
5. **Restart Claude Desktop**
6. **Test in Claude**: "Check local LLM health"

## Available Tools

### Code Analysis Tools

#### 1. `analyze_code_structure`
Analyse code structure with optional file input.

Parameters:
- `code` (string, optional): Code to analyse
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `analysisDepth` (enum): basic, detailed, comprehensive

#### 2. `validate_syntax`
Check code syntax and get error details.

Parameters:
- `code` (string, optional): Code to validate
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `strictMode` (boolean): Use strict validation

#### 3. `detect_patterns`
Find design patterns and anti-patterns.

Parameters:
- `code` (string, optional): Code to analyse
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `patternTypes` (array): Types of patterns to detect

### Code Generation Tools

#### 4. `generate_unit_tests`
Generate unit tests for code.

Parameters:
- `code` (string, optional): Code to test
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `testFramework` (string): Testing framework (jest, pytest, etc.)
- `coverageTarget` (enum): basic, comprehensive, edge-cases

#### 5. `generate_documentation`
Generate documentation for code.

Parameters:
- `code` (string, optional): Code to document
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `docStyle` (string): Documentation style
- `includeExamples` (boolean): Include usage examples

#### 6. `suggest_refactoring`
Get refactoring suggestions.

Parameters:
- `code` (string, optional): Code to refactor
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `focusAreas` (array): Areas to focus on

### File Analysis Tools

#### 7. `analyze_file`
General file analysis with custom instructions.

Parameters:
- `filePath` (string): Path to file
- `instructions` (string): Analysis instructions
- `extractFormat` (enum): summary, json, list

#### 8. `analyze_csv_data`
Filter and analyse CSV data.

Parameters:
- `filePath` (string): Path to CSV file
- `filterCriteria` (string): Filter to apply
- `columns` (array, optional): Columns to focus on
- `returnFormat` (enum): json, csv, list

### System Tools

#### 9. `health_check`
Verify LM Studio connection.

Parameters:
- `detailed` (boolean): Get detailed status

## Troubleshooting

### Server Not Appearing in Claude

1. **Check LM Studio is running**
   ```bash
   node test-connection.mjs
   ```
   Or visit `http://localhost:1234/v1/models` in your browser

2. **Verify NPM installation (if using NPM method)**
   ```bash
   npm list -g @richardbaxterseo/local-llm-mcp
   ```

3. **Check Claude logs**
   - Windows: `%APPDATA%\Claude\logs\mcp-server-local-llm.log`
   - Mac: `~/Library/Application Support/Claude/logs/mcp-server-local-llm.log`
   - Linux: `~/.config/Claude/logs/mcp-server-local-llm.log`

4. **Ensure Claude Desktop is fully restarted**
   - Close Claude completely (check system tray)
   - Start Claude Desktop fresh

### Common Issues

#### "Tool not found" error
- Ensure server name is exactly `"local-llm"` in config
- Check no syntax errors in JSON config
- Restart Claude Desktop completely

#### LM Studio on different port/host
Update `LM_STUDIO_URL` in config:
```json
"env": {
  "LM_STUDIO_URL": "ws://192.168.1.100:5555"
}
```

#### Permission errors with file access
Add directories to `LLM_MCP_ALLOWED_DIRS`:
```json
"env": {
  "LLM_MCP_ALLOWED_DIRS": "C:\\Projects,D:\\Work,C:\\Users\\YourName\\Documents"
}
```

#### NPX command not found
Ensure npm is in your PATH:
```bash
where npm
where npx
```

## Verifying Your Setup

After configuration, verify everything works:

1. **Test LM Studio connection**
   ```bash
   node test-connection.mjs
   ```

2. **Check MCP server appears in Claude**
   - Restart Claude Desktop
   - Type: "Check local LLM health"
   - Should see success message

3. **Test a simple task**
   ```
   "Use local-llm to analyze this code structure: 
   function add(a, b) { return a + b; }"
   ```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 🐛 [Report bugs](https://github.com/richardbaxterseo/local-llm-mcp/issues)
- 💡 [Request features](https://github.com/richardbaxterseo/local-llm-mcp/issues)
- 📧 [Email support](mailto:richard@richardbaxter.co)

## Acknowledgments

- Built with [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk)
- Powered by [LM Studio SDK](https://github.com/lmstudio-ai/lmstudio.js)
- Inspired by the need for context-preserving AI workflows