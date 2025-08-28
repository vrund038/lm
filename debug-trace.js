// Debug script for trace_execution_path
import { FileContextManager } from './dist/core/FileContextManager.js';
import { ResponseFormatter } from './dist/core/ResponseFormatter.js';

// Simulate what trace_execution_path does
async function debugTrace() {
    const manager = new FileContextManager();
    const formatter = new ResponseFormatter();
    
    // Parse entry point
    const entryPoint = 'LocalLLMServer::run';
    const [className, methodName] = entryPoint.split('::');
    console.log(`Entry: className=${className}, methodName=${methodName}`);
    
    // Find the symbol
    console.log('\n=== Finding symbol ===');
    const symbols = manager.findSymbol(className || entryPoint);
    console.log('Found symbols:', symbols.length);
    
    if (symbols.length > 0) {
        const symbol = symbols[0];
        console.log('First symbol:', symbol);
        
        if (symbol.key) {
            const filePath = symbol.key.split(':')[0];
            console.log('File path:', filePath);
            
            // Analyze the file
            console.log('\n=== Analyzing file ===');
            const file = await manager.analyseFile(filePath);
            console.log('File analyzed, classes:', file.classes.map(c => c.name));
            console.log('Methods found:', file.methods.length);
            
            // Get calls from the method
            console.log('\n=== Getting calls from method ===');
            const calls = manager.findCallsFromMethod(className, methodName);
            console.log('Calls found:', calls.length);
            
            // Process each call
            console.log('\n=== Processing calls ===');
            for (const call of calls.slice(0, 5)) {
                let nextPoint = call.to;
                console.log(`\nCall: ${call.to} at line ${call.line}`);
                
                // Clean up the call target
                if (nextPoint.startsWith('this.')) {
                    nextPoint = className ? `${className}::${nextPoint.substring(5)}` : nextPoint.substring(5);
                    console.log(`  Resolved this. to: ${nextPoint}`);
                } else if (nextPoint.includes('.') && !nextPoint.includes('::')) {
                    const [obj, method] = nextPoint.split('.');
                    if (obj === 'server' || obj === 'console' || obj === 'process' || obj === 'path' || obj === 'fs') {
                        console.log(`  Skipping built-in: ${obj}`);
                        continue;
                    }
                    nextPoint = `${obj}::${method}`;
                    console.log(`  Resolved to: ${nextPoint}`);
                }
                
                console.log(`  Would trace: ${nextPoint}`);
            }
        }
    }
}

debugTrace().catch(console.error);
