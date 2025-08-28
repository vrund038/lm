# Private Installation Guide - Local LLM MCP

**⚠️ PRIVATE REPOSITORY - INTERNAL USE ONLY**

This groundbreaking MCP server enables 90% token savings by offloading routine tasks to local LLMs. Keep this private until official release.

## Installation Steps

### 1. Prerequisites

- **Node.js 18+**: Check with `node --version`
- **LM Studio**: Running at `ws://localhost:1234`
- **Git**: For cloning the private repository

### 2. Clone and Build

```bash
# Clone the private repository
git clone https://github.com/richardbaxterseo/local-llm-mcp.git
cd local-llm-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### 3. Configure Claude Desktop

Add to your Claude configuration file:

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
        "LLM_MCP_ALLOWED_DIRS": "C:\\MCP,C:\\Users\\Richard Baxter\\Documents,C:\\Projects,C:\\dev"
      }
    }
  }
}
```

**Important:** Update the path in `args` to match your installation directory.

### 4. Verify Installation

1. Start LM Studio with a model loaded
2. Restart Claude Desktop
3. Test with: `local-llm:health_check`

## Security Configuration

### Allowed Directories

The `LLM_MCP_ALLOWED_DIRS` environment variable controls which directories the server can access:

```json
"LLM_MCP_ALLOWED_DIRS": "C:\\MCP,C:\\dev,C:\\Projects"
```

- Use comma-separated absolute paths
- No trailing slashes
- Subdirectories are automatically included

### WebSocket URL

Default: `ws://localhost:1234`

To use a different port or remote LM Studio:
```json
"LM_STUDIO_URL": "ws://192.168.1.100:1234"
```

## Development Workflow

### Running in Development

```bash
# Watch mode for development
npm run dev

# Run tests
npm test

# Run diagnostics
npm run diagnose
```

### Building Changes

```bash
# Clean and rebuild
npm run rebuild
```

## Troubleshooting

### Common Issues

1. **"Connection refused" error**
   - Ensure LM Studio is running
   - Check the WebSocket URL matches LM Studio's server
   - Default port is 1234

2. **"Directory not allowed" error**
   - Add the directory to `LLM_MCP_ALLOWED_DIRS`
   - Use absolute paths
   - Restart Claude after config changes

3. **Tools not appearing in Claude**
   - Restart Claude Desktop completely
   - Check for errors in Claude's developer console
   - Run `npm run diagnose` to verify setup

### Debug Commands

```bash
# Test LM Studio connection
npm run test:connection

# Check Claude processes (Windows)
npm run check:processes

# Full diagnostics
npm run diagnose
```

## Why Keep This Private?

This MCP represents a breakthrough in AI interaction patterns:

1. **90% Context Preservation**: Offloads routine tasks to local LLM
2. **Unlimited Processing**: No rate limits on local operations
3. **Strategic AI Usage**: Claude focuses on high-level decisions
4. **Cost Efficiency**: Reduces API usage dramatically

The competitive advantage is too significant to release publicly until the timing is right.

## Contact

For internal support: richard@richardbaxter.co

**Remember: This is proprietary technology. Do not share outside the organization.**
