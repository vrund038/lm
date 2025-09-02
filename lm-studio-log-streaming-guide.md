# LM Studio Log Streaming Guide for Local LLM MCP Testing

*Essential debugging tool for monitoring Local LLM MCP function calls and LM Studio interactions*

---

## Overview

LM Studio provides a powerful CLI tool for streaming real-time logs of all model interactions. This is invaluable for debugging Local LLM MCP functions, monitoring token usage, and understanding prompt execution.

## Prerequisites

- LM Studio installed and running
- Local LLM MCP configured and operational
- Command line access (cmd/PowerShell on Windows)

---

## Quick Start Commands

### Start Log Streaming
```bash
# Basic log streaming
lms log stream

# JSON format with debug level (recommended for development)
lms log stream --json --log-level debug

# Verbose output with all details
lms log stream --json --log-level debug --verbose
```

### Check LM Studio Status
```bash
# Verify LM Studio is running
lms status

# List loaded models
lms ps

# Check server status
lms server status
```

---

## Setting Up Debugging Session

### 1. Start Log Stream in Separate Terminal
```bash
# Open new terminal/command prompt
lms log stream --json --log-level debug
```

**Important**: Keep this terminal open during testing - it will show real-time logs.

### 2. Test Local LLM Functions
In Claude Desktop, test functions while monitoring logs:

```
# Test basic function
local-llm:health_check detailed=true

# Test analysis function  
local-llm:analyze_single_file code="function test() { return 'hello'; }"

# Test complex function
local-llm:count_files projectPath="C:\your-project" analysisDepth="basic"
```

### 3. Monitor Log Output
Watch the log stream terminal for:
- Model predictions starting
- Full prompt content
- Token usage patterns
- Response generation
- Error conditions

---

## Log Output Examples

### Successful Function Call
```json
{
  "timestamp": 1756824676851,
  "data": {
    "type": "llm.prediction.input",
    "modelPath": "DevQuasar/Qwen.Qwen3-Coder-30B-A3B-Instruct-GGUF/Qwen.Qwen3-Coder-30B-A3B-Instruct.Q4_K_S.gguf",
    "modelIdentifier": "qwen.qwen3-coder-30b-a3b-instruct",
    "input": "<|im_start|>system\nYou are a world-class senior software architect...<|im_end|>"
  }
}
```

### Key Information to Monitor
- **Model Used**: Which model processed the request
- **Full Prompt**: Complete system + user prompt content
- **Token Count**: Estimate token usage for optimization
- **Timing**: Response generation speed

---

## Advanced Options

### Filter by Log Level
```bash
# Only show errors and warnings
lms log stream --log-level warn

# Show all information (most verbose)
lms log stream --log-level debug --verbose

# Quiet mode (minimal output)
lms log stream --quiet
```

### Remote LM Studio Instance
```bash
# Connect to remote LM Studio
lms log stream --host 192.168.1.100 --port 1234
```

### Save Logs to File
```bash
# Windows: Save logs to file
lms log stream --json > lm-studio-logs.json

# PowerShell: Save with timestamp
lms log stream --json | Tee-Object -FilePath "logs-$(Get-Date -Format 'yyyy-MM-dd-HH-mm').json"
```

---

## Debugging Common Issues

### No Log Output
**Problem**: Log stream shows no activity when functions execute

**Solutions**:
1. Verify LM Studio is running: `lms status`
2. Check model is loaded: `lms ps`
3. Confirm correct port: `lms log stream --port 1234`
4. Test with simple function: `local-llm:health_check`

### Connection Refused
**Problem**: `Found local API server at ws://127.0.0.1:XXXXX` then no logs

**Solutions**:
1. Restart LM Studio application
2. Check Windows firewall settings
3. Verify no other process using LM Studio port
4. Try `lms bootstrap` to reset CLI

### Incomplete Log Data
**Problem**: Logs cut off or missing response data

**Solutions**:
1. Increase terminal buffer size
2. Use `--json` format for structured output
3. Save logs to file for complete capture
4. Use `--verbose` flag for maximum detail

---

## Integration with Testing Workflow

### Standard Testing Session
```bash
# Terminal 1: Start log stream
lms log stream --json --log-level debug --verbose

# Terminal 2: Test functions in sequence
# (Claude Desktop interactions)

# Terminal 3: Monitor system resources
lms ps    # Check model status
lms status # Check server health
```

### Automated Testing with Logs
```bash
# Create timestamped log file
$timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
lms log stream --json > "test-logs-$timestamp.json" &

# Run your tests
# (Execute Local LLM MCP functions)

# Stop logging when done
# Ctrl+C to stop log stream
```

---

## Understanding Log Data

### Prompt Structure Analysis
Monitor logs to verify:
- **System Context**: Expert persona and instructions
- **Data Payload**: Code/files being analyzed  
- **Output Format**: JSON schema requirements
- **Token Efficiency**: Prompt length optimization

### Performance Monitoring
Track:
- **Response Times**: Model inference speed
- **Token Usage**: Input/output token consumption
- **Memory Usage**: Model resource utilization
- **Error Rates**: Failed function calls

### Quality Assurance
Verify:
- **Prompt Quality**: Clear, structured instructions
- **Response Format**: Consistent JSON output
- **Error Handling**: Graceful failure modes
- **Context Preservation**: Proper information passing

---

## Troubleshooting Commands

### LM Studio CLI Issues
```bash
# Reset CLI configuration
lms bootstrap

# Check CLI version
lms version

# Get help for any command
lms help log
lms log stream --help
```

### Connection Testing
```bash
# Test basic connectivity
lms status

# List all available models
lms ls

# Check loaded models
lms ps

# Test model loading
lms load "path/to/model.gguf"
```

---

## Best Practices

### Development Workflow
1. **Always start with log streaming** before testing functions
2. **Use JSON format** for structured, parseable output
3. **Save logs for complex debugging** sessions
4. **Monitor token usage** to optimize prompt efficiency
5. **Test functions incrementally** while watching logs

### Performance Optimization
1. **Track token counts** in logs to optimize prompts
2. **Monitor response times** to identify bottlenecks
3. **Watch memory usage** with resource-intensive functions
4. **Identify prompt patterns** that work well

### Error Debugging
1. **Capture full error context** from logs
2. **Compare working vs failing** function calls
3. **Verify model status** when issues occur
4. **Check prompt formatting** in log output

---

## Quick Reference

### Essential Commands
| Command | Purpose |
|---------|---------|
| `lms log stream --json --log-level debug` | Start comprehensive logging |
| `lms status` | Check LM Studio status |
| `lms ps` | List loaded models |
| `lms server status` | Check server health |

### Log Levels
| Level | What It Shows |
|-------|---------------|
| `debug` | All requests, responses, and internal operations |
| `info` | General information and successful operations |
| `warn` | Warning messages and potential issues |
| `error` | Error messages and failures only |

### Common Issues
| Problem | Solution |
|---------|----------|
| No logs appearing | Check `lms status` and model loading |
| Connection refused | Restart LM Studio, check firewall |
| Incomplete logs | Use `--json --verbose` flags |
| Performance issues | Monitor token usage in logs |

---

## Integration Notes

This log streaming capability provides complete visibility into Local LLM MCP operations, making it an essential tool for development, debugging, and optimization of your AI-powered development workflow.