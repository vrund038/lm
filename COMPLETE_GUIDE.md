# Local LLM MCP Server - Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [Core Features](#core-features)
5. [API Reference](#api-reference)
6. [Implementation Details](#implementation-details)
7. [Security Considerations](#security-considerations)
8. [Performance Optimisation](#performance-optimisation)
9. [Contributing Guidelines](#contributing-guidelines)
10. [Troubleshooting](#troubleshooting)
11. [Future Roadmap](#future-roadmap)

## Overview

The Local LLM MCP Server is a Model Context Protocol (MCP) implementation that enables Claude Desktop to offload computational tasks to local language models running in LM Studio. This approach preserves Claude's context window for strategic thinking whilst delegating routine analysis tasks to a local LLM.

### Key Benefits
- **Context Preservation**: Save 85-90% of Claude's context window
- **Faster Processing**: Local processing without API rate limits
- **Cost Efficiency**: No API costs for routine tasks
- **Privacy**: Data stays local on your machine

### Version History
- **v2.0.0** (Current): LM Studio SDK integration, file attachment support
- **v1.0.0**: Initial release with axios-based implementation

## Architecture

### System Components

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Claude Desktop  │────▶│ Local LLM MCP    │────▶│   LM Studio     │
│     (Client)    │◀────│    (Server)      │◀────│   (LLM Host)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │ MCP Protocol          │ WebSocket              │
         │ (stdio)               │ (ws://localhost:1234)  │
         ▼                       ▼                         ▼
    Task Request            Process & Route          Execute Prompt
```

### Design Patterns

1. **Singleton Pattern**: Single server instance manages all connections
2. **Strategy Pattern**: Different handlers for code, file, and CSV analysis
3. **Factory Pattern**: Configuration-driven task prompt generation
4. **Command Pattern**: Tool-based request handling
5. **Dependency Injection**: LMStudioClient injected into server

### File Structure

```
local-llm-mcp/
├── src/
│   ├── index.ts       # Main server implementation
│   ├── types.ts       # TypeScript type definitions
│   └── config.ts      # Configuration and prompts
├── test/
│   ├── test-data.csv  # Sample CSV for testing
│   └── test-sdk.cjs   # SDK test script
├── dist/              # Compiled JavaScript output
├── package.json       # Project configuration
├── tsconfig.json      # TypeScript configuration
└── README.md          # Basic documentation
```

## Installation & Setup

> **New to LM Studio?** See our [Getting Started Guide](GETTING_STARTED.md) for complete step-by-step instructions from zero to working setup.

### Prerequisites

1. **Node.js** (v18+)
   ```bash
   node --version  # Should be 18.0.0 or higher
   ```

2. **LM Studio**
   - Download from [lmstudio.ai](https://lmstudio.ai)
   - Install and load a model (see recommended models below)
   - Start the local server on port 1234

3. **Claude Desktop**
   - Latest version with MCP support

### Installation Steps

1. Clone or download the repository:
   ```bash
   cd C:\MCP
   git clone https://github.com/richardbaxterseo/local-llm-mcp.git
   cd local-llm-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the TypeScript code:
   ```bash
   npm run build
   ```

4. Configure Claude Desktop:
   ```json
   {
     "mcpServers": {
       "local-llm": {
         "command": "node",
         "args": ["C:\\MCP\\local-llm-mcp\\dist\\index.js"]
       }
     }
   }
   ```

5. Restart Claude Desktop

### Recommended Models

For code tasks:
- **Qwen 2.5 Coder** (7B/14B/32B) - Excellent code understanding
- **DeepSeek Coder** (6.7B/33B) - Strong performance
- **CodeLlama** (7B/13B/34B) - Open source alternative

For general tasks:
- **Llama 3** (8B/70B) - Good all-round performance
- **Mistral** (7B) - Fast and efficient
- **Phi-3** (3.8B) - Lightweight option

## Core Features

### 1. Code Analysis Tools

#### analyze_code_structure
Analyses code architecture, identifying classes, functions, imports, and patterns.

**Use Cases:**
- Understanding unfamiliar codebases
- Code review preparation
- Documentation generation
- Refactoring planning

**Token Savings:** ~500-1000 per file

#### generate_unit_tests
Creates comprehensive test suites for functions and classes.

**Use Cases:**
- Test-driven development
- Legacy code coverage
- Edge case identification
- Mock generation

**Token Savings:** ~200-500 per function

#### generate_documentation
Produces inline documentation and markdown files.

**Use Cases:**
- API documentation
- README generation
- Docstring creation
- Usage examples

**Token Savings:** ~300-600 per file

### 2. File Analysis Tools

#### analyze_file
General-purpose file analysis with custom instructions.

**Use Cases:**
- Log file parsing
- Configuration extraction
- Data pattern recognition
- Content summarisation

**Token Savings:** Variable based on file size

#### analyze_csv_data
Filters and processes CSV files based on criteria.

**Use Cases:**
- Data filtering
- Statistical analysis
- Report generation
- Data validation

**Token Savings:** ~1000+ for large datasets

### 3. Code Quality Tools

#### suggest_refactoring
Identifies improvement opportunities in code.

**Focus Areas:**
- Readability improvements
- Performance optimisation
- Maintainability enhancement
- Security hardening
- Test coverage

#### detect_patterns
Finds design patterns and anti-patterns.

**Pattern Types:**
- Design patterns (Singleton, Factory, etc.)
- Anti-patterns (God Object, Spaghetti Code)
- Code smells (Long methods, Duplicate code)
- Best practices compliance

## API Reference

### Tool Definitions

```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}
```

### Complete Tool List

| Tool Name | Required Parameters | Optional Parameters | Returns |
|-----------|-------------------|-------------------|---------|
| `analyze_code_structure` | `language` | `code`, `filePath`, `analysisDepth` | Structured analysis |
| `generate_unit_tests` | `language` | `code`, `filePath`, `testFramework`, `coverageTarget` | Test code |
| `generate_documentation` | `language` | `code`, `filePath`, `docStyle`, `includeExamples` | Documentation |
| `suggest_refactoring` | `language` | `code`, `filePath`, `focusAreas` | Suggestions |
| `detect_patterns` | `language` | `code`, `filePath`, `patternTypes` | Pattern list |
| `validate_syntax` | `language` | `code`, `filePath`, `strictMode` | Validation results |
| `suggest_variable_names` | `language` | `code`, `filePath`, `namingConvention` | Name suggestions |
| `analyze_file` | `filePath` | `instructions`, `extractFormat` | Analysis results |
| `analyze_csv_data` | `filePath`, `filterCriteria` | `columns`, `returnFormat` | Filtered data |
| `health_check` | - | `detailed` | Status information |

### Parameter Details

#### analysisDepth
- `basic`: High-level overview
- `detailed`: Standard analysis
- `comprehensive`: Deep dive with examples

#### coverageTarget
- `basic`: Core functionality
- `comprehensive`: Full coverage
- `edge-cases`: Focus on edge cases

#### docStyle
- `jsdoc`: JavaScript documentation
- `markdown`: Markdown format
- `docstring`: Python/Java style
- `javadoc`: Java documentation

#### extractFormat / returnFormat
- `json`: Structured JSON output
- `list`: Simple list format
- `summary`: Prose summary
- `csv`: CSV format (CSV analysis only)

## Implementation Details

### Request Flow

1. **Claude Desktop** sends MCP request via stdio
2. **Local LLM MCP** receives and validates request
3. **Request Router** determines handler based on tool name
4. **Handler** prepares prompt and file attachments
5. **LM Studio Client** sends request via WebSocket
6. **Response Parser** processes LLM output
7. **Result** returned to Claude Desktop

### Error Handling

```typescript
try {
  // Main processing logic
} catch (error) {
  if (error.code === 'ENOENT') {
    throw new McpError(ErrorCode.InvalidRequest, 'File not found');
  }
  if (error.message.includes('LM Studio')) {
    throw new McpError(ErrorCode.InternalError, 'LM Studio connection failed');
  }
  // Generic error
  throw error;
}
```

### File Processing

1. **Validation**: Check file exists and extension supported
2. **Size Check**: Ensure under 200MB limit
3. **Encoding**: UTF-8 for text files
4. **Attachment**: Send as base64 to LM Studio
5. **Cleanup**: Remove temporary data

## Security Considerations

### Current Security Measures

1. **File Size Limits**: 200MB maximum
2. **File Type Restrictions**: Whitelist of extensions
3. **Local Processing**: No external API calls
4. **WebSocket**: Local connection only

### Potential Vulnerabilities

1. **Path Traversal**: No validation on file paths
2. **Resource Exhaustion**: No rate limiting
3. **Input Validation**: Limited sanitisation
4. **Authentication**: No auth mechanism

### Recommended Improvements

```typescript
// Path validation
const safePath = path.resolve(filePath);
if (!safePath.startsWith(allowedDirectory)) {
  throw new Error('Access denied');
}

// Rate limiting
const requestCount = new Map<string, number>();
function rateLimit(clientId: string) {
  const count = requestCount.get(clientId) || 0;
  if (count > 100) throw new Error('Rate limit exceeded');
  requestCount.set(clientId, count + 1);
}
```

## Performance Optimisation

### Current Performance

- **File Reading**: Synchronous, blocking
- **Processing**: Single-threaded
- **Memory**: No caching mechanism
- **Streaming**: Implemented but unused

### Optimisation Strategies

1. **Implement Caching**
   ```typescript
   const cache = new Map<string, any>();
   function getCached(key: string) {
     if (cache.has(key)) {
       return cache.get(key);
     }
   }
   ```

2. **Use Streaming**
   ```typescript
   async function streamAnalysis(filePath: string) {
     const stream = createReadStream(filePath);
     // Process in chunks
   }
   ```

3. **Parallel Processing**
   ```typescript
   const results = await Promise.all(
     files.map(file => analyzeFile(file))
   );
   ```

## Contributing Guidelines

### Code Standards

1. **TypeScript**: Strict mode enabled
2. **Formatting**: 2-space indentation
3. **Naming**: camelCase for functions, PascalCase for types
4. **Comments**: JSDoc for public methods

### Pull Request Process

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for new functionality
4. Ensure all tests pass
5. Update documentation
6. Submit PR with detailed description

### Testing

```bash
# Run unit tests (when implemented)
npm test

# Test with LM Studio
node test/test-sdk.cjs

# Manual testing
1. Start LM Studio with a model
2. Run the server: npm start
3. Test each tool via Claude Desktop
```

## Troubleshooting

### Common Issues

#### "LM Studio is not running"
```bash
# Check if LM Studio is running
curl http://localhost:1234/v1/models

# Verify WebSocket connection
wscat -c ws://localhost:1234
```

#### "File not found"
- Use absolute paths: `C:\\path\\to\\file.ts`
- Check file permissions
- Verify file exists before calling

#### "Model not responding"
- Check model is loaded in LM Studio
- Verify sufficient RAM available
- Try smaller model if memory limited

### Debug Mode

Set environment variable:
```bash
set DEBUG=local-llm-mcp:*
node dist/index.js
```

## Future Roadmap

### Version 2.1 (Planned)
- [ ] Unit test coverage
- [ ] Streaming response support
- [ ] Caching mechanism
- [ ] Rate limiting

### Version 3.0 (Proposed)
- [ ] Multi-model support
- [ ] Custom prompt templates
- [ ] Web UI for configuration
- [ ] Metrics and monitoring
- [ ] Plugin system

### Long-term Goals
- Support for other LLM backends (Ollama, llama.cpp)
- Integration with popular IDEs
- Batch processing capabilities
- Advanced security features
- Performance benchmarking

## License

MIT License - See LICENSE file for details

## Acknowledgements

- Anthropic for the MCP specification
- LM Studio team for the SDK
- Open source model creators
- Community contributors

---

*For questions, issues, or contributions, please visit the [GitHub repository](https://github.com/richardbaxterseo/local-llm-mcp)*