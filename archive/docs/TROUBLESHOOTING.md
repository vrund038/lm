# Troubleshooting Guide

This guide helps resolve common issues with Local LLM MCP Server setup and operation.

## Table of Contents
- [Installation Issues](#installation-issues)
- [Connection Problems](#connection-problems)
- [Configuration Errors](#configuration-errors)
- [Runtime Errors](#runtime-errors)
- [Performance Issues](#performance-issues)
- [Known Issues](#known-issues)
- [Debugging Tools](#debugging-tools)

## Installation Issues

### Local Build Fails

**Symptom:** `npm run build` fails in local installation

**Solutions:**
1. Check Node.js version (requires 18+):
   ```bash
   node --version
   ```

2. Delete node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Ensure TypeScript is installed:
   ```bash
   npm list typescript
   ```

4. Try rebuilding from clean state:
   ```bash
   npm run clean
   npm run build
   ```

### Local Build Fails

**Symptom:** `npm run build` fails in local installation

**Solutions:**
1. Delete node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Check TypeScript version:
   ```bash
   npx tsc --version
   # Should be 5.x.x
   ```

## Connection Problems

### "Tool not found" in Claude

**Symptom:** Claude doesn't recognize `local-llm` tools

**Solutions:**

1. **Verify server name in config:**
   ```json
   "local-llm": {  // Must be exactly "local-llm"
     "command": "npx",
     ...
   }
   ```

2. **Check Claude logs:**
   - Windows: `%APPDATA%\Claude\logs\mcp-server-local-llm.log`
   - Mac: `~/Library/Application Support/Claude/logs/mcp-server-local-llm.log`

3. **Fully restart Claude:**
   - Close Claude completely (check system tray)
   - Restart Claude Desktop
   - Wait 10 seconds for servers to initialize

### Cannot Connect to LM Studio

**Symptom:** Connection refused or timeout errors

**Solutions:**

1. **Test LM Studio connection:**
   ```bash
   node test-connection.mjs
   ```

2. **Check LM Studio is running:**
   - Open LM Studio
   - Load a model
   - Click "Start Server"
   - Should show "Server is running"

3. **Verify URL matches:**
   ```json
   "env": {
     "LM_STUDIO_URL": "ws://localhost:1234"  // Default
   }
   ```

4. **Common URL issues:**
   - Using `http://` instead of `ws://`
   - Wrong port (default is 1234)
   - Using IP instead of localhost

### LM Studio on Different Host/Port

**Symptom:** LM Studio running on non-default address

**Solution:** Update configuration:
```json
"env": {
  "LM_STUDIO_URL": "ws://192.168.1.100:5000"  // Your custom URL
}
```

## Configuration Errors

### Invalid JSON in Claude Config

**Symptom:** Claude won't start or ignores config

**Solutions:**

1. **Validate JSON syntax:**
   - Use a JSON validator
   - Check for trailing commas
   - Ensure proper quotes

2. **Common JSON errors:**
   ```json
   // ❌ Wrong - trailing comma
   {
     "mcpServers": {
       "local-llm": { ... },  // Remove this comma
     }
   }
   
   // ✅ Correct
   {
     "mcpServers": {
       "local-llm": { ... }
     }
   }
   ```

### Path Errors on Windows

**Symptom:** File not found errors

**Solutions:**

1. **Use double backslashes:**
   ```json
   // ❌ Wrong
   "args": ["C:\MCP\local-llm-mcp\dist\index.js"]
   
   // ✅ Correct
   "args": ["C:\\MCP\\local-llm-mcp\\dist\\index.js"]
   ```

2. **Or use forward slashes:**
   ```json
   "args": ["C:/MCP/local-llm-mcp/dist/index.js"]
   ```

### Permission Denied Errors

**Symptom:** Cannot access files in certain directories

**Solution:** Add directories to allowed list:
```json
"env": {
  "LLM_MCP_ALLOWED_DIRS": "C:\\Projects,D:\\Work,C:\\Users\\YourName\\Documents"
}
```

## Runtime Errors

### "Model not loaded" Error

**Symptom:** LM Studio responds but no model available

**Solutions:**
1. Load a model in LM Studio
2. Wait for model to fully load (progress bar completes)
3. Try a smaller model if memory limited

### Timeout Errors

**Symptom:** Operations time out

**Solutions:**
1. Increase timeout in LM Studio settings
2. Use a faster model (smaller quantization)
3. Check CPU/GPU usage

### Memory Errors

**Symptom:** Out of memory or crashes

**Solutions:**
1. Use smaller model quantization:
   - Q4_K_M instead of Q8_0
   - 7B model instead of 13B
2. Close other applications
3. Check available RAM

## Performance Issues

### Slow Response Times

**Solutions:**
1. **Use GPU acceleration:**
   - Enable GPU in LM Studio
   - Check CUDA is properly installed

2. **Optimize model choice:**
   - Use specialized models (Qwen Coder for code)
   - Use smaller quantizations

3. **Check system resources:**
   ```bash
   # Windows
   taskmgr
   
   # Mac/Linux
   top
   ```

## Known Issues

### Multiple Claude.exe Processes (Windows)

**Symptom:** MCP server appears to connect but tools don't work properly

**Problem:** Multiple Claude.exe processes can interfere with MCP communication

**Detection:**
```bash
# Run diagnostic script
node diagnostics/check-claude-processes.mjs

# Or manually check
tasklist | findstr Claude.exe
```

**Solution:**
1. Close all Claude windows
2. Check system tray for hidden Claude instances
3. Kill all Claude processes:
   ```bash
   taskkill /F /IM Claude.exe
   ```
4. Restart Claude Desktop once
5. Wait 10 seconds for MCP servers to initialize

**Prevention:**
- Always fully exit Claude (not just close window)
- Check system tray before restarting
- Use single Claude instance

### "Method not found" Errors in Logs

**Symptom:** Errors for `resources/list` and `prompts/list` in Claude logs

**Problem:** These are optional MCP methods not implemented in v3.0.2

**Solution:** Update to v3.0.3+ which includes empty handlers for these methods

**Note:** These errors don't affect functionality but can clutter logs

## Debugging Tools

### 1. Comprehensive Diagnostic Tool (NEW)

**Run full system diagnostics:**
```bash
node diagnostics/run-diagnostics.mjs
```

This checks:
- Node.js version
- LM Studio connection
- Claude configuration
- Multiple process detection
- MCP server startup

**Output:** Creates `diagnostic-report.json` with detailed results

### 2. Claude Process Checker (NEW)

**Check for multiple Claude instances:**
```bash
node diagnostics/check-claude-processes.mjs
```

### 3. Connection Test Script

Always included as `test-connection.mjs`:
```bash
node test-connection.mjs
```

### 2. Manual Health Check

Test from command line:
```bash
curl http://localhost:1234/v1/models
```

### 3. Environment Variable Check

Create `check-env.js`:
```javascript
console.log('LM_STUDIO_URL:', process.env.LM_STUDIO_URL || 'Not set (using default)');
console.log('LLM_MCP_ALLOWED_DIRS:', process.env.LLM_MCP_ALLOWED_DIRS || 'Not set (using defaults)');
```

### 4. MCP Server Direct Test

Test server directly:
```bash
# Local installation
node C:\MCP\local-llm-mcp\dist\index.js
```

Should output nothing and wait (it's expecting MCP protocol input).

### 6. Claude Log Analysis

Check for errors in logs:
```bash
# Windows PowerShell
Get-Content "$env:APPDATA\Claude\logs\mcp-server-local-llm.log" -Tail 50

# Mac/Linux
tail -50 ~/Library/Application\ Support/Claude/logs/mcp-server-local-llm.log
```

## Getting Help

If issues persist:

1. **Check existing issues:** [GitHub Issues](https://github.com/richardbaxterseo/local-llm-mcp/issues)
2. **Create detailed bug report** including:
   - Your configuration
   - Error messages
   - Steps to reproduce
   - System information
3. **Contact support:** richard@richardbaxter.co

## Quick Fixes Checklist

- [ ] LM Studio is running with a model loaded
- [ ] Using correct WebSocket URL (`ws://` not `http://`)
- [ ] Server name is exactly `"local-llm"` in config
- [ ] Claude Desktop fully restarted after config changes
- [ ] NPM package installed globally (if using NPM method)
- [ ] JSON configuration is valid (no syntax errors)
- [ ] File paths use double backslashes on Windows
- [ ] Required directories added to `LLM_MCP_ALLOWED_DIRS`