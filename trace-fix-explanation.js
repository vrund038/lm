// Fixed trace_execution_path implementation
// The issue is on line 113 of MultiFileAnalysis.js
// Current buggy code:
//     const calls = manager.findMethodCalls(methodName);
//
// The problem: It's looking for calls TO methodName, not calls FROM the current method
// 
// Fixed version should be:
//     const calls = manager.findMethodCallsFrom(className, methodName);
//
// Or alternatively, it should parse the method body to find all method calls within it.
//
// The trace function needs to:
// 1. Find the method/function definition
// 2. Parse its body to find all method/function calls
// 3. Recursively trace each called method/function
//
// Current implementation is only finding the entry point symbol but not analyzing
// what that symbol calls, which is why it returns only one node.

// Example of what the fix might look like:
async function traceExecutionPath(entryPoint, traceDepth = 5, showParameters = false) {
    const manager = getContextManager();
    const formatter = getFormatter();
    
    // Parse entry point (e.g., "SearchHandler::handle_search_results")
    const [className, methodName] = entryPoint.split('::');
    const executionPath = [];
    const visited = new Set();
    const issues = [];
    
    async function trace(point, depth) {
        if (depth <= 0 || visited.has(point))
            return;
        visited.add(point);
        executionPath.push(`${'  '.repeat(traceDepth - depth)}${point}`);
        
        // FIXED: Find the method body and analyze what it calls
        const [currentClass, currentMethod] = point.includes('::') 
            ? point.split('::') 
            : [null, point];
        
        // Find all files that might contain this class/method
        const symbols = manager.findSymbol(currentClass || point);
        
        for (const symbol of symbols) {
            if (symbol.key) {
                const filePath = symbol.key.split(':')[0];
                if (filePath) {
                    const file = await manager.analyseFile(filePath);
                    
                    // FIXED: Get the parsed file data
                    const fileData = manager.getParsedFile(filePath);
                    if (fileData) {
                        // Find the specific method in the parsed data
                        if (currentClass && currentMethod) {
                            const classData = fileData.classes.find(c => c.name === currentClass);
                            if (classData) {
                                // Parse the method body to find calls
                                // This would need to extract method calls from the method body
                                const methodCalls = extractMethodCallsFromBody(fileData, classData, currentMethod);
                                for (const call of methodCalls) {
                                    await trace(call, depth - 1);
                                }
                            }
                        } else {
                            // It's a function, not a method
                            const funcData = fileData.functions.find(f => f.name === point);
                            if (funcData) {
                                const functionCalls = extractFunctionCallsFromBody(fileData, funcData);
                                for (const call of functionCalls) {
                                    await trace(call, depth - 1);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    await trace(entryPoint, traceDepth);
    
    return formatter.format({
        summary: `Execution trace from ${entryPoint}`,
        confidence: 0.9,
        critical: issues,
        details: {
            executionPath,
            depth: traceDepth,
            visitedNodes: visited.size
        }
    });
}
