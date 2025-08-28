// Check symbol table contents
import { FileContextManager } from './dist/core/FileContextManager.js';

async function checkSymbols() {
    const manager = new FileContextManager();
    
    // First analyse a file to populate the symbol table
    console.log('Analysing index.js...');
    const parsed = await manager.analyseFile('C:\\MCP\\local-llm-mcp\\dist\\index.js');
    console.log('Classes found:', parsed.classes.map(c => c.name));
    
    // Get all symbols
    console.log('\n=== All Symbols ===');
    const allSymbols = manager.getAllSymbols();
    console.log('Total symbols:', allSymbols.size);
    
    // Show first 10 symbols
    let count = 0;
    for (const [key, value] of allSymbols) {
        console.log(`  ${key}`);
        if (++count >= 10) break;
    }
    
    // Try to find LocalLLMServer
    console.log('\n=== Looking for LocalLLMServer ===');
    const searchTerms = ['LocalLLMServer', 'class:LocalLLMServer', 'LocalLLMServer::run'];
    for (const term of searchTerms) {
        console.log(`\nSearching for: "${term}"`);
        const found = manager.findSymbol(term);
        console.log(`  Found: ${found.length} results`);
        if (found.length > 0) {
            console.log('  First result:', found[0]);
        }
    }
    
    // Check if the class symbol is there
    console.log('\n=== Direct symbol table check ===');
    for (const [key, value] of allSymbols) {
        if (key.includes('LocalLLMServer')) {
            console.log(`Found key with LocalLLMServer: ${key}`);
            console.log('Value:', value);
        }
    }
}

checkSymbols().catch(console.error);
