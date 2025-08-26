# Local LLM MCP - Quick Reference Card

## Configuration Summary
- **MCP Name**: `local-llm` 
- **Tool Prefix**: `local-llm:`
- **URL**: `ws://127.0.0.1:1234` or `ws://localhost:1234`
- **Package**: `@richardbaxterseo/local-llm-mcp@3.0.2`

## Common Tool Commands

### Health Check
```
local-llm:health_check({ detailed: true })
```

### Analyze Code
```
local-llm:analyze_code_structure({ 
  filePath: "path/to/file.js",
  analysisDepth: "comprehensive"
})
```

### Generate Tests
```
local-llm:generate_unit_tests({
  filePath: "path/to/file.js",
  testFramework: "jest",
  coverageTarget: "comprehensive"
})
```

### Security Audit
```
local-llm:security_audit({
  filePath: "path/to/project",
  projectType: "node-api",
  auditDepth: "comprehensive"
})
```

### WordPress Plugin
```
local-llm:generate_wordpress_plugin({
  name: "My Plugin",
  description: "Plugin description",
  features: ["admin", "shortcodes"],
  prefix: "mp_"
})
```

## Troubleshooting

### Tool Not Found Error?
1. Check MCP name is `local-llm` in config
2. Restart Claude Desktop
3. Verify LM Studio is running

### Connection Failed?
1. Start LM Studio first
2. Load a model in LM Studio
3. Check server shows: http://localhost:1234

### Wrong Results?
1. Use appropriate model (Qwen 2.5 Coder recommended)
2. Provide clear context parameters
3. Check allowed directories in config
