// Test script to verify findCallsFromMethod is working now
import { FileContextManager } from './dist/core/FileContextManager.js';

async function test() {
    const manager = new FileContextManager();
    
    // Analyse the index.js file
    console.log('Analysing index.js...');
    const parsed = await manager.analyseFile('C:\\MCP\\local-llm-mcp\\dist\\index.js');
    
    console.log('Methods found:', parsed.methods.length);
    
    // Test findCallsFromMethod for the run method
    console.log('\n=== Testing findCallsFromMethod for run method ===');
    const runCalls = manager.findCallsFromMethod('LocalLLMServer', 'run');
    console.log(`Calls from LocalLLMServer::run: ${runCalls.length}`);
    runCalls.forEach(call => {
        console.log(`  Line ${call.line}: ${call.to}`);
    });
    
    // Test for setupToolHandlers
    console.log('\n=== Testing findCallsFromMethod for setupToolHandlers ===');
    const setupCalls = manager.findCallsFromMethod('LocalLLMServer', 'setupToolHandlers');
    console.log(`Calls from LocalLLMServer::setupToolHandlers: ${setupCalls.length}`);
    setupCalls.slice(0, 10).forEach(call => {
        console.log(`  Line ${call.line}: ${call.to}`);
    });
    
    // Test for constructor
    console.log('\n=== Testing findCallsFromMethod for constructor ===');
    const constructorCalls = manager.findCallsFromMethod('LocalLLMServer', 'constructor');
    console.log(`Calls from LocalLLMServer::constructor: ${constructorCalls.length}`);
    constructorCalls.slice(0, 10).forEach(call => {
        console.log(`  Line ${call.line}: ${call.to}`);
    });
}

test().catch(console.error);
