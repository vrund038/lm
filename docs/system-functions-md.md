# System Functions Guide

**Essential utilities for maintaining and optimizing your Houtini LM installation**

The system functions help you manage, troubleshoot, and optimize your Houtini LM setup. These diagnostic and utility tools ensure everything runs smoothly and help you discover new capabilities.

## Quick Start Examples

Essential system checks and maintenance:

```
Check if houtini-lm is working properly with a health check
```

```
Show me all available houtini-lm functions with examples
```

```
Use houtini-lm to analyze this file path and suggest the correct parameters
```

```
List all the creative functions available in houtini-lm
```

```
Get detailed system information about my houtini-lm setup
```

## System Functions

### 1. `health_check` - System Verification

**Purpose**: Verify LM Studio connection, model status, and system health

**Simple usage**:
```
Run a houtini-lm health check to make sure everything is working
```

**What you get**:
- LM Studio connection status
- Model loading verification
- Performance indicators
- Configuration validation
- Quick troubleshooting guidance

**Advanced usage**:
```json
{
  "name": "houtini-lm:health_check",
  "parameters": {
    "detailed": true
  }
}
```

**Detailed output includes**:
- Model name, size, and parameters
- Memory usage and performance metrics
- Server response times
- Configuration file validation
- Recommended optimizations

### 2. `list_functions` - Function Discovery

**Purpose**: Explore all available functions with descriptions and usage examples

**Simple usage**:
```
Show me all the houtini-lm functions I can use
```

**What you get**:
- Complete function catalog organized by category
- Brief descriptions of what each function does
- Usage examples for immediate implementation
- Parameter summaries for advanced usage
- Related function suggestions

**Advanced usage**:
```json
{
  "name": "houtini-lm:list_functions",
  "parameters": {
    "category": "analyze",
    "detailed": true,
    "includeExamples": true
  }
}
```

**Categories available**:
- **analyze** - All 17 analysis functions
- **generate** - All 10 generation functions
- **creative** - All 3 creative functions
- **system** - All 5 system functions
- **custom** - Custom and advanced functions

### 3. `resolve_path` - Path Analysis and Suggestions

**Purpose**: Analyze file system paths and suggest correct MCP parameters

**Simple usage**:
```
Help me understand how to use this path with houtini-lm: C:/my-project/src
```

**What you get**:
- Path validation and accessibility check
- File type detection and recommendations
- Suggested function parameters for the path
- Alternative path formats if needed
- Usage examples specific to your path

**Advanced usage**:
```json
{
  "name": "houtini-lm:resolve_path",
  "parameters": {
    "path": "C:/complex-project/nested/deep/file.tsx",
    "suggestions": true
  }
}
```

**What the analysis covers**:
- **File existence**: Whether the path exists and is accessible
- **Path format**: Windows vs Unix format compatibility
- **Function compatibility**: Which functions work with this path type
- **Parameter suggestions**: Exact JSON parameters to use
- **Alternative approaches**: Different ways to accomplish your goal

### 4. `get_cache_statistics` - Performance Monitoring

**Purpose**: Monitor analysis cache performance and memory usage

**Simple usage**:
```
Show me houtini-lm cache performance statistics
```

**What you get**:
- Cache hit rates and efficiency metrics
- Memory usage by function type
- Performance trends and optimization opportunities
- Cache cleanup recommendations

### 5. `clear_analysis_cache` - Cache Management

**Purpose**: Clear cached analysis results for fresh analysis

**Simple usage**:
```
Clear the houtini-lm analysis cache for fresh results
```

**What you get**:
- Selective or complete cache clearing
- Memory recovery statistics
- Performance impact analysis
- Recommendations for cache management

**Advanced usage**:
```json
{
  "name": "houtini-lm:clear_analysis_cache",
  "parameters": {
    "filePath": "C:/specific/file/to/clear.js"
  }
}
```

## Troubleshooting with System Functions

### Connection Issues

**Problem**: "Cannot connect to LM Studio"
**Solution**:
```
Run houtini-lm health check detailed to diagnose the connection issue
```

**Common causes**:
- LM Studio not running
- Wrong port configuration  
- Model not loaded
- Firewall blocking connection

### Performance Problems

**Problem**: Functions running slowly
**Solution**:
```
Check houtini-lm cache statistics and clear cache if needed
```

**Optimization steps**:
1. Monitor cache hit rates
2. Clear stale cache entries
3. Verify model is fully loaded
4. Check system memory usage

### Function Discovery

**Problem**: "Don't know which function to use"
**Solution**:
```
Show me houtini-lm analysis functions with examples
```

**Discovery workflow**:
1. List functions by category
2. Read detailed descriptions
3. Try simple usage examples
4. Progress to advanced parameters

### Path Configuration

**Problem**: "File path errors and permissions"
**Solution**:
```
Use houtini-lm to analyze my project path and suggest correct usage
```

**Path troubleshooting**:
1. Verify path format and existence
2. Check allowed directories configuration
3. Test with resolve_path function
4. Adjust permissions if needed

## System Optimization

### Regular Maintenance Tasks

**Weekly Health Check**:
```
Run detailed houtini-lm health check to verify system performance
```

**Monthly Cache Cleanup**:
```
Check houtini-lm cache statistics and clear if memory usage is high
```

**Quarterly Function Review**:
```
List all houtini-lm functions to discover new capabilities and usage patterns
```

### Performance Monitoring

**Key Metrics to Track**:
- Health check response times
- Cache hit rates and efficiency
- Memory usage trends
- Function execution speed

**Optimization Indicators**:
- Response times >5 seconds (check model loading)
- Cache hit rates <50% (consider cache clearing)
- Memory usage >80% available (restart LM Studio)
- Frequent timeouts (check system resources)

## Best Practices

### System Health Management

1. **Regular health checks**: Run weekly to catch issues early
2. **Monitor performance**: Track response times and cache efficiency
3. **Proactive maintenance**: Clear cache before it becomes a problem
4. **Stay updated**: Use list_functions to discover new capabilities

### Troubleshooting Approach

1. **Start with health_check**: Always verify system status first
2. **Use resolve_path**: For any path-related issues
3. **Check documentation**: Use list_functions for usage examples
4. **Monitor resources**: Ensure adequate memory and CPU availability

### Configuration Management

1. **Document your setup**: Keep track of working configurations
2. **Test after changes**: Run health_check after configuration updates
3. **Backup settings**: Preserve working Claude Desktop configurations
4. **Version tracking**: Note which model versions work best

## Integration with Other Tools

### Claude Desktop Integration

The system functions work seamlessly with Claude Desktop's MCP architecture:
- Health checks validate MCP server connectivity
- Function listings help Claude understand available capabilities
- Path resolution ensures compatibility with file operations

### Desktop Commander Integration

System functions complement Desktop Commander for complete development workflows:
- Use health_check before file operations
- Combine with Desktop Commander's file system functions
- Coordinate cache management with file write operations

### Development Workflow Integration

System functions enhance your development process:
- Health checks in morning startup routines
- Function discovery for new project types
- Path analysis before bulk operations
- Performance monitoring during heavy usage

---

*These system functions are your maintenance toolkit for keeping Houtini LM running optimally. Use them regularly to ensure peak performance and discover new capabilities as they're added.*