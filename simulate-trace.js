// Complete trace simulation
import { FileContextManager } from './dist/core/FileContextManager.js';

async function simulateTrace() {
    const manager = new FileContextManager();
    
    // First analyze the file (like our fix does)
    console.log('=== STEP 1: Analyze file ===');
    await manager.analyseFile('C:\\MCP\\local-llm-mcp\\dist\\index.js');
    
    // Now try to find LocalLLMServer
    console.log('\n=== STEP 2: Find symbol LocalLLMServer ===');
    const symbols = manager.findSymbol('LocalLLMServer');
    console.log('Found symbols:', symbols.length);
    
    if (symbols.length > 0) {
        const symbol = symbols[0];
        console.log('Symbol key:', symbol.key);
        
        // Extract file path
        const filePath = symbol.key.split(':')[0];
        console.log('File path:', filePath);
        
        // The file should already be cached
        console.log('\n=== STEP 3: Find calls from run method ===');
        const calls = manager.findCallsFromMethod('LocalLLMServer', 'run');
        console.log('Calls found from run:', calls.length);
        
        // Process the calls
        console.log('\n=== STEP 4: Process calls ===');
        const visited = new Set();
        const executionPath = [];
        
        function processCall(call, depth, indent = 0) {
            let nextPoint = call.to;
            console.log(`${'  '.repeat(indent)}Processing: ${nextPoint}`);
            
            // Clean up the call target (same logic as in trace)
            if (nextPoint.startsWith('this.')) {
                nextPoint = `LocalLLMServer::${nextPoint.substring(5)}`;
                console.log(`${'  '.repeat(indent)}  -> Resolved to: ${nextPoint}`);
            } else if (nextPoint.includes('.') && !nextPoint.includes('::')) {
                const [obj, method] = nextPoint.split('.');
                if (obj === 'server' || obj === 'console' || obj === 'process' || 
                    obj === 'path' || obj === 'fs') {
                    console.log(`${'  '.repeat(indent)}  -> Skipped (built-in)`);
                    return null;
                }
                nextPoint = `${obj}::${method}`;
                console.log(`${'  '.repeat(indent)}  -> Resolved to: ${nextPoint}`);
            }
            
            return nextPoint;
        }
        
        // Process first level calls
        executionPath.push('LocalLLMServer::run');
        for (const call of calls.slice(0, 5)) {
            const nextPoint = processCall(call, 3, 1);
            if (nextPoint && !visited.has(nextPoint)) {
                visited.add(nextPoint);
                executionPath.push(`  ${nextPoint}`);
            }
        }
        
        console.log('\n=== Final execution path ===');
        executionPath.forEach(p => console.log(p));
    }
}

simulateTrace().catch(console.error);
