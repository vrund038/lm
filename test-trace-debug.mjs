// Debug script to test trace_execution_path
import { FileContextManager } from './dist/core/FileContextManager.js';

async function testTrace() {
    console.log('Testing trace_execution_path functionality...\n');
    
    const manager = new FileContextManager();
    
    // Analyze the main index.js file
    const filePath = 'C:\\MCP\\local-llm-mcp\\dist\\index.js';
    console.log('1. Analyzing file:', filePath);
    const parsed = await manager.analyseFile(filePath);
    
    console.log('\n2. Classes found:', parsed.classes.map(c => c.name));
    console.log('3. Methods found:', parsed.methods.map(m => `${m.className}::${m.name}`));
    console.log('4. Functions found:', parsed.functions.map(f => f.name));
    
    // Test findSymbol
    console.log('\n5. Testing findSymbol for "LocalLLMServer":');
    const symbols = manager.findSymbol('LocalLLMServer');
    console.log('   Found symbols:', symbols.length);
    symbols.forEach(s => console.log('   -', s.key));
    
    // Test findSymbol for a method
    console.log('\n6. Testing findSymbol for "run":');
    const runSymbols = manager.findSymbol('run');
    console.log('   Found symbols:', runSymbols.length);
    runSymbols.forEach(s => console.log('   -', s.key));
    
    // Test findCallsFromMethod
    console.log('\n7. Testing findCallsFromMethod for LocalLLMServer::run:');
    const calls = manager.findCallsFromMethod('LocalLLMServer', 'run');
    console.log('   Found calls:', calls.length);
    calls.forEach(c => console.log('   -', c.to, 'at line', c.line));
    
    // Get the symbol table
    const allSymbols = manager.getAllSymbols();
    console.log('\n8. Total symbols in table:', allSymbols.size);
    console.log('   First 10 symbol keys:');
    let count = 0;
    for (const [key, value] of allSymbols.entries()) {
        console.log('   -', key);
        if (++count >= 10) break;
    }
}

testTrace().catch(console.error);
