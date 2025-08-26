# Local LLM MCP - Corrected Configuration and Usage Guide

## Correct Configuration

The MCP server name in Claude Desktop config should be **`local-llm`** (not `local-llm-assistant`).

### Working Configuration for claude_desktop_config.json:
```json
{
  "mcpServers": {
    "local-llm": {
      "command": "npx",
      "args": ["-y", "@richardbaxterseo/local-llm-mcp@3.0.2"],
      "env": {
        "LM_STUDIO_URL": "ws://127.0.0.1:1234",
        "LLM_MCP_ALLOWED_DIRS": "C:\\MCP,C:\\Users\\Richard Baxter\\Documents,C:\\Projects,C:\\Dev,C:\\tax-receipts-2024-25"
      }
    }
  }
}
```

## Correct Tool Names

All tools should be called with the prefix **`local-llm:`** (not `local-llm-assistant:`).

### Examples:
```javascript
// CORRECT:
local-llm:health_check
local-llm:analyze_code_structure
local-llm:generate_unit_tests

// INCORRECT:
local-llm-assistant:health_check  // Wrong prefix
local-llm-mcp:health_check        // Wrong prefix
```

## URL Configuration

Both formats work and are equivalent:
- `ws://127.0.0.1:1234` (IP address)
- `ws://localhost:1234` (hostname)

Your config uses `ws://127.0.0.1:1234` which is perfectly fine.

## Directory Names Clarification

- **NPM Package**: `@richardbaxterseo/local-llm-mcp`
- **Installation Directory**: `C:\MCP\local-llm-mcp\`
- **MCP Server Name**: `local-llm`
- **Tool Prefix**: `local-llm:`

## Available Tools (Corrected Names)

### System
- `local-llm:health_check` - Verify LM Studio connection

### Code Analysis
- `local-llm:analyze_code_structure` - Analyze code architecture
- `local-llm:validate_syntax` - Check syntax errors
- `local-llm:detect_patterns` - Find design patterns
- `local-llm:suggest_variable_names` - Improve naming

### Code Generation
- `local-llm:generate_unit_tests` - Create test suites
- `local-llm:generate_documentation` - Generate docs
- `local-llm:suggest_refactoring` - Refactoring suggestions

### Specialized Tools
- `local-llm:generate_wordpress_plugin` - WordPress plugin generator
- `local-llm:analyze_n8n_workflow` - n8n workflow optimizer
- `local-llm:generate_responsive_component` - UI component generator
- `local-llm:convert_to_typescript` - JS to TS converter
- `local-llm:security_audit` - Security analysis

### File Processing
- `local-llm:analyze_file` - General file analysis
- `local-llm:analyze_csv_data` - CSV data analysis

## Testing the Connection

After configuration, restart Claude Desktop and test:
```javascript
local-llm:health_check({ detailed: true })
```

This should return details about the LM Studio connection and loaded models.

## Current Status

Based on testing:
- ✅ LM Studio is running correctly at `127.0.0.1:1234`
- ✅ Models are loaded (Qwen models detected)
- ❌ MCP tools not available in current Claude session (requires restart)

## Action Required

1. Ensure your Claude Desktop config uses the exact format shown above
2. Restart Claude Desktop to load the MCP server
3. Test with `local-llm:health_check` command
