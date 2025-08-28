# Security Configuration

## Overview

The Local LLM MCP v2.0 includes security features to prevent unauthorized file access. This document explains how to configure these security settings.

## Default Allowed Directories

By default, the following directories are allowed for file operations:
- Current working directory (`process.cwd()`)
- `C:\MCP` - MCP tools directory (Windows)
- `C:\Dev` - Development directory (Windows)

## Configuring Allowed Directories

### Via Environment Variable

You can override the default allowed directories by setting the `LLM_MCP_ALLOWED_DIRS` environment variable:

```bash
# Windows
set LLM_MCP_ALLOWED_DIRS=C:\Projects,C:\Documents,D:\Code

# Linux/Mac
export LLM_MCP_ALLOWED_DIRS=/home/user/projects,/home/user/documents
```

Multiple directories should be separated by commas.

### Via Configuration File

The allowed directories are configured in `src/security-config.ts`:

```typescript
export const securityConfig = {
  defaultAllowedDirectories: [
    process.cwd(),      // Current working directory
    'C:\\MCP',          // MCP tools directory
    'C:\\Dev',          // Development directory
    // Add more default directories as needed
  ],
  // ... other settings
};
```

## Path Validation

All file paths must meet the following criteria:
1. **Absolute paths only** - Relative paths are rejected
2. **Within allowed directories** - Path must start with one of the allowed directories
3. **Normalized** - Paths are normalized to prevent directory traversal attacks

## Claude Desktop Configuration

When configuring Claude Desktop, you can set allowed directories in the environment:

```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["C:\\MCP\\local-llm-mcp\\dist\\index.js"],
      "env": {
        "LLM_MCP_ALLOWED_DIRS": "C:\\Users\\YourName\\Documents,C:\\Projects"
      }
    }
  }
}
```

## Security Best Practices

1. **Principle of Least Privilege**: Only allow access to directories that are necessary
2. **Absolute Paths**: Always use absolute paths in your allowed directories
3. **Regular Review**: Periodically review and update allowed directories
4. **Separate Environments**: Use different configurations for development and production

## Error Messages

When a path violation occurs, you'll see one of these errors:
- `"Invalid file path: Path must be absolute and within allowed directories"`
- `"Failed to read file: [error details]"`

## Troubleshooting

### "Invalid file path" errors
1. Ensure the path is absolute (starts with `/` on Unix or `C:\` on Windows)
2. Check that the path is within one of the allowed directories
3. Verify the allowed directories are correctly configured

### Viewing current configuration
The server logs allowed directories on startup:
```
Local LLM MCP server started
Allowed directories: C:\MCP\local-llm-mcp, C:\MCP, C:\Dev
```

## Future Enhancements

The following security features are planned for future releases:
- API key authentication
- Rate limiting
- Audit logging
- Per-user directory restrictions

## Configuration File Location

The security configuration is stored in:
- Source: `src/security-config.ts`
- Compiled: `dist/security-config.js`

To modify the configuration:
1. Edit `src/security-config.ts`
2. Rebuild the project: `npm run build`
3. Restart the MCP server

## Example Use Cases

### Development Environment
```bash
export LLM_MCP_ALLOWED_DIRS=/home/dev/projects,/home/dev/sandbox
```

### Production Environment
```bash
export LLM_MCP_ALLOWED_DIRS=/var/app/data,/var/app/uploads
```

### Windows Development
```bash
set LLM_MCP_ALLOWED_DIRS=C:\Users\%USERNAME%\source\repos,C:\Dev\Projects
```

## Related Documentation

- [Migration Guide](MIGRATION_GUIDE.md) - Upgrading from v1.x
- [Security Audit](SECURITY_AUDIT.md) - Full security analysis
- [API Reference](README.md#api-reference) - Complete API documentation