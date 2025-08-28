# Migration Guide to v4.0

## Overview
Version 4.0 introduces powerful multi-file analysis capabilities with automatic cache population. This is a non-breaking update - all existing v3.0 code continues to work!

## What's New

### 🎉 Automatic Cache Population
The biggest improvement in v4.0 is that multi-file analysis functions now automatically populate their cache. You no longer need to manually run `analyze_project_structure` first.

### Before (v3.x)
```javascript
// You had to populate the cache first
await analyze_project_structure({
  projectPath: "C:\\MyProject"
});

// Then you could use other functions
await trace_execution_path({
  entryPoint: "MyClass::method"
});
```

### After (v4.0)
```javascript
// Just call the function - cache populates automatically!
await trace_execution_path({
  entryPoint: "MyClass::method"
});
```

## New Functions in v4.0

### Multi-File Analysis Tools
- `compare_integration` - Analyse how files work together
- `trace_execution_path` - Follow execution across files
- `find_pattern_usage` - Search patterns project-wide
- `diff_method_signatures` - Compare method signatures
- `analyze_project_structure` - Analyse architecture
- `clear_analysis_cache` - Clear cache
- `get_cache_statistics` - View cache stats

## Breaking Changes
**None!** Version 4.0 is fully backward compatible with v3.x.

## Configuration Updates

### Claude Desktop Config
Update your server version in `claude_desktop_config.json` (optional but recommended):
```json
{
  "mcpServers": {
    "local-llm": {
      "command": "node",
      "args": ["C:\\MCP\\local-llm-mcp\\dist\\index.js"],
      "env": {
        "LM_STUDIO_URL": "ws://127.0.0.1:1234",
        "LLM_MCP_ALLOWED_DIRS": "C:\\Dev,C:\\Projects,C:\\MCP"
      }
    }
  }
}
```

## Performance Considerations

### Auto-Population Behaviour
- **Threshold**: Functions auto-populate when cache has <5 files
- **Limit**: Analyses up to 10 files initially
- **Smart Discovery**: Looks for common entry files first
- **Performance Impact**: +1-2 seconds on first call only

### Customising Auto-Population
If you need to adjust the behaviour, you can modify these values in `src/core/MultiFileAnalysis.ts`:
```typescript
// Line 38: Threshold for auto-population
if (stats.filesAnalyzed < 5) {

// Line 63: Maximum files to analyse
const maxFilesToAnalyze = 10;
```

## Best Practices

### 1. Let Auto-Population Work
Don't manually populate the cache unless you need specific files analysed:
```javascript
// Good - let it auto-populate
await trace_execution_path({ entryPoint: "main" });

// Only manually populate if you need specific control
await analyze_project_structure({ 
  projectPath: "C:\\SpecificProject",
  maxDepth: 5  // Deeper than auto-population
});
```

### 2. Use Project Paths When Possible
Functions work better when given explicit paths:
```javascript
// Better - provides clear context
await find_pattern_usage({
  projectPath: "C:\\MyProject",
  patterns: ["TODO"]
});

// Less optimal - uses current working directory
await trace_execution_path({
  entryPoint: "main"
});
```

### 3. Check Cache Statistics
Use the new cache statistics to understand what's been analysed:
```javascript
const stats = await get_cache_statistics();
console.log(`Cache has ${stats.details.filesAnalyzed} files`);
```

## Upgrading Steps

1. **Update the package**:
   ```bash
   cd local-llm-mcp
   git pull
   npm install
   npm run build
   ```

2. **Restart Claude Desktop** to load the new version

3. **Test the new features**:
   ```javascript
   // Try the auto-population
   clear_analysis_cache();
   trace_execution_path({ entryPoint: "YourClass::method" });
   ```

## Troubleshooting

### Cache Not Auto-Populating?
- Check you're in a directory with JS/TS files
- Verify the target path exists
- Look at console output for `[Cache]` messages

### Symbol Not Found?
- The error message now shows available symbols
- Try `get_cache_statistics()` to see what's cached
- Use `analyze_project_structure()` for deep analysis

### Performance Issues?
- First call is slower due to auto-population
- Reduce `maxFilesToAnalyze` if needed
- Clear cache if it gets too large

## Support

For issues specific to v4.0:
1. Check the console output for `[Cache]` messages
2. Use `get_cache_statistics()` to debug
3. Try `clear_analysis_cache()` and retry
4. Report issues with full error messages

## Summary

Version 4.0 makes multi-file analysis much easier to use with automatic cache population. No breaking changes, just better user experience!
