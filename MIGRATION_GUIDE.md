# Migration Guide - Local LLM MCP v2.0 to NPM Package

## Overview

This guide helps existing users migrate from the direct repository installation to the NPM package version, which includes important security fixes and improved modularity.

## Breaking Changes

### 1. Module Export Structure
**Old**: Direct script execution  
**New**: ES Module with proper exports

```javascript
// Old way (won't work)
// node dist/index.js

// New way
import LocalLLMServer from '@richardbaxterseo/local-llm-mcp';
const server = new LocalLLMServer();
await server.start();
```

### 2. Path Security Restrictions
**Old**: Any file path accepted  
**New**: Only absolute paths within allowed directories

```bash
# Set allowed directories before running
export LLM_MCP_ALLOWED_DIRS="/home/user/projects,/home/user/documents"
```

### 3. Configuration Location
**Old**: Hardcoded in config.ts  
**New**: Environment variables supported

```bash
export LM_STUDIO_URL="ws://localhost:1234"
export LM_STUDIO_MODEL="auto"
export LLM_MCP_ALLOWED_DIRS="/safe/directory"
```

## Installation Steps

### 1. Uninstall Old Version
```bash
# Remove old installation
rm -rf C:\MCP\local-llm-mcp
```

### 2. Install NPM Package
```bash
npm install -g @richardbaxterseo/local-llm-mcp
# or for local project
npm install @richardbaxterseo/local-llm-mcp
```

### 3. Update Claude Desktop Configuration

**Old claude_desktop_config.json**:
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

**New claude_desktop_config.json**:
```json
{
  "mcpServers": {
    "local-llm": {
      "command": "npx",
      "args": ["@richardbaxterseo/local-llm-mcp"],
      "env": {
        "LLM_MCP_ALLOWED_DIRS": "C:\\Users\\YourName\\Documents,C:\\Projects"
      }
    }
  }
}
```

## Security Configuration

### Setting Allowed Directories

The new version requires explicit directory permissions for security:

```bash
# Windows
set LLM_MCP_ALLOWED_DIRS=C:\Users\YourName\Documents,C:\Projects

# Linux/Mac
export LLM_MCP_ALLOWED_DIRS="/home/user/documents,/home/user/projects"
```

### Multiple Directories
Separate multiple directories with commas:
```bash
export LLM_MCP_ALLOWED_DIRS="/path/one,/path/two,/path/three"
```

## API Changes

### Fixed Methods

1. **parseModelResponse** - Regex fix
   ```typescript
   // Old: Broken regex
   /<think>[\s\S]*?<\/think>/g
   
   // New: Fixed regex
   /<think>[\s\S]*?<\/think>/g
   ```

2. **Path Validation** - New security
   ```typescript
   // All file paths now validated
   // Must be absolute and within allowed dirs
   ```

3. **Health Check** - Information disclosure fix
   ```typescript
   // Non-detailed mode no longer shows paths
   health_check({ detailed: false })
   ```

## Common Issues

### Issue: "Invalid file path" errors
**Solution**: Ensure all paths are absolute and within allowed directories

```bash
# Set your working directory as allowed
export LLM_MCP_ALLOWED_DIRS="$(pwd)"
```

### Issue: "No model loaded" errors
**Solution**: Ensure LM Studio is running with a model loaded before starting

### Issue: Module not found
**Solution**: Install globally or use npx

```bash
# Global install
npm install -g @richardbaxterseo/local-llm-mcp

# Or use npx directly
npx @richardbaxterseo/local-llm-mcp
```

## Programmatic Usage

For integration in other projects:

```typescript
import LocalLLMServer from '@richardbaxterseo/local-llm-mcp';

// Create instance
const server = new LocalLLMServer();

// Start server
await server.start();

// Or use specific methods directly
const status = await server.checkStatus(true);
```

## Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `LM_STUDIO_URL` | LM Studio WebSocket URL | `ws://localhost:1234` |
| `LM_STUDIO_MODEL` | Model selection | `auto` |
| `LLM_MCP_ALLOWED_DIRS` | Comma-separated allowed directories | Current working directory |

## Rollback Instructions

If you need to rollback to the old version:

1. Uninstall NPM package:
   ```bash
   npm uninstall -g @richardbaxterseo/local-llm-mcp
   ```

2. Clone old repository:
   ```bash
   git clone https://github.com/richardbaxterseo/local-llm-mcp.git
   cd local-llm-mcp
   git checkout v1.0.0  # or your previous version
   npm install
   npm run build
   ```

3. Restore old Claude configuration

## Support

- **Issues**: https://github.com/richardbaxterseo/local-llm-mcp/issues
- **Documentation**: https://github.com/richardbaxterseo/local-llm-mcp#readme
- **NPM Package**: https://www.npmjs.com/package/@richardbaxterseo/local-llm-mcp

## Changelog Highlights

### Security Fixes
- Path traversal vulnerability fixed
- Information disclosure in health check fixed
- Added directory access restrictions

### Improvements
- Proper NPM package structure
- TypeScript declarations included
- Better error messages
- Fixed regex parsing

### New Features
- Environment variable configuration
- Programmatic API usage
- Comprehensive test suite