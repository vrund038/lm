// Test script to debug trace_execution_path - enhanced version
import { FileContextManager } from './dist/core/FileContextManager.js';

async function test() {
    const manager = new FileContextManager();
    
    // Analyse the index.js file
    console.log('Analysing index.js...');
    const parsed = await manager.analyseFile('C:\\MCP\\local-llm-mcp\\dist\\index.js');
    
    console.log('\n=== Parsed Data ===');
    console.log('Classes:', parsed.classes.map(c => ({name: c.name, line: c.line, methods: c.methods})));
    console.log('Functions:', parsed.functions.map(f => ({name: f.name, line: f.line})));
    console.log('Methods:', parsed.methods);
    
    // Check if methods were detected inside the class
    if (parsed.classes.length > 0) {
        const localLLMServer = parsed.classes[0];
        console.log('\nLocalLLMServer class details:');
        console.log('  Line:', localLLMServer.line);
        console.log('  Methods:', localLLMServer.methods);
        console.log('  Properties:', localLLMServer.properties);
    }
    
    // Check the call graph
    console.log('\n=== Call Graph Sample ===');
    const callGraph = manager.getCallGraph();
    const calls = callGraph.get('C:\\MCP\\local-llm-mcp\\dist\\index.js') || [];
    
    // Find calls around line 354 (where run method is)
    console.log('\nCalls around line 354 (run method):');
    calls.filter(c => c.line >= 353 && c.line <= 358).forEach(call => {
        console.log(`  Line ${call.line}: ${call.from} -> ${call.to}`);
    });
    
    // Find calls around line 64 (setupToolHandlers)
    console.log('\nCalls around line 64 (setupToolHandlers):');
    calls.filter(c => c.line >= 64 && c.line <= 70).forEach(call => {
        console.log(`  Line ${call.line}: ${call.from} -> ${call.to}`);
    });
    
    // Check if methods are being parsed at all
    console.log('\n=== All Methods in File ===');
    console.log('Total methods found:', parsed.methods.length);
    if (parsed.methods.length > 0) {
        parsed.methods.slice(0, 5).forEach(m => {
            console.log(`  ${m.className}::${m.name} at line ${m.line}`);
        });
    }
}

test().catch(console.error);
