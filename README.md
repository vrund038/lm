# Local LLM MCP Server v2.0

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![GitHub release](https://img.shields.io/github/v/release/richardbaxterseo/local-llm-mcp)](https://github.com/richardbaxterseo/local-llm-mcp/releases)

An MCP (Model Context Protocol) server that enables Claude to offload tasks to local LLMs running in LM Studio. Version 2.0 adds file attachment support using the official LM Studio SDK.

## Documentation

- 📚 **[Complete Guide](COMPLETE_GUIDE.md)** - Full technical documentation
- 🚀 **[Getting Started](GETTING_STARTED.md)** - Step-by-step setup from zero
- 📖 **[API Reference](COMPLETE_GUIDE.md#api-reference)** - All available tools
- 🔧 **[Troubleshooting](GETTING_STARTED.md#troubleshooting)** - Common issues

## Features

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

## Installation

```bash
cd C:\MCP\local-llm-mcp
npm install
npm run build
```

## Configuration

### Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

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

### Environment Variables

- `LM_STUDIO_URL`: LM Studio WebSocket URL (default: `ws://localhost:1234`)
- `LM_STUDIO_MODEL`: Model to use (default: `auto` - uses currently loaded model)

## Usage

### Starting LM Studio

1. Open LM Studio
2. Load your preferred model
3. Start the local server (usually on port 1234)

### Available Tools

#### 1. `analyze_code_structure`
Analyse code structure with optional file input.

Parameters:
- `code` (string, optional): Code to analyse
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `analysisDepth` (enum): basic, detailed, comprehensive

#### 2. `generate_unit_tests`
Generate unit tests for code.

Parameters:
- `code` (string, optional): Code to test
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `testFramework` (string): Testing framework (jest, pytest, etc.)
- `coverageTarget` (enum): basic, comprehensive, edge-cases

#### 3. `generate_documentation`
Generate documentation for code.

Parameters:
- `code` (string, optional): Code to document
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `docStyle` (enum): jsdoc, markdown, docstring, javadoc
- `includeExamples` (boolean): Include usage examples

#### 4. `suggest_refactoring`
Suggest code improvements.

Parameters:
- `code` (string, optional): Code to analyse
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `focusAreas` (array): readability, performance, maintainability, testability, security

#### 5. `detect_patterns`
Detect design patterns and anti-patterns.

Parameters:
- `code` (string, optional): Code to analyse
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `patternTypes` (array): design-patterns, anti-patterns, code-smells, best-practices

#### 6. `validate_syntax`
Validate code syntax.

Parameters:
- `code` (string, optional): Code to validate
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `strictMode` (boolean): Use strict validation

#### 7. `suggest_variable_names`
Suggest better variable names.

Parameters:
- `code` (string, optional): Code to analyse
- `filePath` (string, optional): Path to code file
- `language` (string): Programming language
- `namingConvention` (enum): camelCase, snake_case, PascalCase, kebab-case

#### 8. `analyze_file` (NEW)
Analyse any file with custom instructions.

Parameters:
- `filePath` (string, required): Path to file
- `instructions` (string, optional): Specific analysis instructions
- `extractFormat` (enum): json, list, summary

Example:
```
analyze_file({
  filePath: "C:\\data\\report.txt",
  instructions: "Extract all dates and amounts mentioned",
  extractFormat: "json"
})
```

#### 9. `analyze_csv_data` (NEW)
Filter and analyse CSV data.

Parameters:
- `filePath` (string, required): Path to CSV file
- `filterCriteria` (string, required): What to filter for
- `columns` (array, optional): Specific columns to analyse
- `returnFormat` (enum): json, csv, list

Example:
```
analyze_csv_data({
  filePath: "C:\\data\\companies.csv",
  filterCriteria: "automotive and motorsport companies",
  returnFormat: "json"
})
```

#### 10. `health_check`
Check LM Studio status.

Parameters:
- `detailed` (boolean): Include detailed model information

## Supported File Types

The following file extensions are supported for direct analysis:
- Code: `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.c`, `.cpp`, `.rs`, `.go`, `.php`, `.rb`, `.swift`
- Data: `.csv`, `.json`, `.txt`
- Documentation: `.md`, `.log`

Maximum file size: 200MB

## Example Usage in Claude

```
User: "Analyse the structure of the code in C:\project\src\main.ts"

Claude will use: analyze_code_structure({ 
  filePath: "C:\\project\\src\\main.ts",
  language: "typescript",
  analysisDepth: "detailed"
})
```

```
User: "Find all automotive companies in C:\data\companies.csv"

Claude will use: analyze_csv_data({
  filePath: "C:\\data\\companies.csv",
  filterCriteria: "automotive companies",
  returnFormat: "json"
})
```

## Troubleshooting

### "LM Studio is not running"
- Ensure LM Studio is open and the local server is started
- Check the port number matches your configuration (default: 1234)
- Verify a model is loaded in LM Studio

### File not found errors
- Use absolute paths for file references
- Ensure the file exists and is readable
- Check file extension is supported

### Model response issues
- Some models include thinking tags (like Qwen 3) which are automatically stripped
- For best results with code tasks, use code-focused models
- Adjust temperature in config.ts for more/less creative responses

## Development

### Building from source
```bash
npm run build
```

### Development mode
```bash
npm run dev
```

### Adding new tools
1. Add the task type to `TaskType` enum in `types.ts`
2. Add the task prompt to `config.ts`
3. Add the tool definition in `setupHandlers()` in `index.ts`
4. Add the handler case in the switch statement

## Version History

- **v2.0.0** - LM Studio SDK integration, file attachment support, new analysis tools
- **v1.0.0** - Initial release with axios-based implementation

## License

MIT