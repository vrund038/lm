# trace_execution_path Fix Requirements

## Current Issues

### 1. Wrong Method Call (Line 113 of MultiFileAnalysis.js)
**Current Code:**
```javascript
const calls = manager.findMethodCalls(methodName);
```

**Problem:** This finds all calls TO `methodName` across the entire project, not calls FROM the current method.

### 2. Missing FileContextManager Functionality
The FileContextManager needs a new method:
```javascript
findCallsFromMethod(className, methodName) {
    // Parse the specific method body
    // Extract all method/function calls from within that method
    // Return array of called methods/functions
}
```

### 3. Current Behavior
- Only returns the entry point
- Doesn't traverse the call graph
- visitedNodes is always 1

## Proposed Solution

### Option 1: Add Method Body Parser
Enhance FileContextManager to:
1. Store method body start/end lines when parsing
2. Add `getMethodBody(className, methodName)` function
3. Add `extractCallsFromMethodBody(methodBody)` function

### Option 2: Build Call Graph During Initial Parse
When parsing files, track:
- Which method/function each call originates from
- Store as: `{ from: "Class::method", to: "calledFunction", line: 123 }`

### Option 3: Use AST Parsing
- Integrate a proper AST parser (like @babel/parser for JS)
- Build accurate call graphs with proper scope awareness

## Quick Fix for Testing
For now, the function could be modified to at least find some relationships:

```javascript
// In trace function, replace lines 108-119 with:
const symbols = manager.findSymbol(point);
for (const symbol of symbols) {
    if (symbol.key) {
        const filePath = symbol.key.split(':')[0];
        if (filePath) {
            await manager.analyseFile(filePath);
            
            // Get all calls from this file (not ideal but better than nothing)
            const allCalls = manager.getCallGraph().get(filePath) || [];
            
            // Filter to calls that might be from our method
            // (This is imprecise but better than current implementation)
            for (const call of allCalls) {
                if (!visited.has(call.to)) {
                    await trace(call.to, depth - 1);
                }
            }
        }
    }
}
```

## Expected Behavior After Fix
For entry point `LocalLLMServer::run`:
```
LocalLLMServer::run
  StdioServerTransport (constructor)
  server.connect
  console.error
```

For entry point `LocalLLMServer::setupToolHandlers`:
```
LocalLLMServer::setupToolHandlers
  server.setRequestHandler (multiple calls)
  isMultiFileTool
  handleMultiFileTool
  handleLLMTool
```

## Implementation Priority
1. **Quick fix**: Make it work with imprecise call tracking
2. **Proper fix**: Add method body parsing to FileContextManager
3. **Long-term**: Integrate proper AST parsing for accurate call graphs
