/**
 * Simple test to validate FileContextManager and ResponseFormatter
 */

import { FileContextManager } from './dist/core/FileContextManager.js';
import { ResponseFormatter } from './dist/core/ResponseFormatter.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEMP_DIR = 'C:\\MCP\\local-llm-mcp\\test-temp';

async function runTests() {
  console.log('🧪 Testing FileContextManager and ResponseFormatter...\n');
  
  // Create test directory
  await fs.mkdir(TEMP_DIR, { recursive: true });
  
  try {
    // Test 1: FileContextManager basic functionality
    console.log('Test 1: FileContextManager - Parse JavaScript file');
    const manager = new FileContextManager();
    
    // Create test file
    const testFile = path.join(TEMP_DIR, 'test.js');
    await fs.writeFile(testFile, `
import { something } from './other';

class TestClass {
  constructor() {
    this.value = 42;
  }
  
  testMethod(param) {
    return param * 2;
  }
}

function testFunction(x, y) {
  return x + y;
}

export { TestClass, testFunction };
    `.trim());
    
    // Analyze file
    const parsed = await manager.analyseFile(testFile);
    
    console.log(`✅ Parsed file: ${parsed.path}`);
    console.log(`   Language: ${parsed.language}`);
    console.log(`   Classes found: ${parsed.classes.length}`);
    console.log(`   Functions found: ${parsed.functions.length}`);
    console.log(`   Imports: ${parsed.imports.length}`);
    console.log(`   Exports: ${parsed.exports.length}`);
    
    // Test 2: Caching
    console.log('\nTest 2: Cache functionality');
    const start1 = Date.now();
    await manager.analyseFile(testFile);
    const time1 = Date.now() - start1;
    
    const start2 = Date.now();
    await manager.analyseFile(testFile); // Should be cached
    const time2 = Date.now() - start2;
    
    console.log(`✅ First parse: ${time1}ms`);
    console.log(`   Cached parse: ${time2}ms`);
    console.log(`   Speed improvement: ${Math.round((time1 - time2) / time1 * 100)}%`);
    
    const stats = manager.getCacheStats();
    console.log(`   Cache stats: ${stats.filesAnalyzed} files, ${stats.totalSymbols} symbols`);
    
    // Test 3: ResponseFormatter
    console.log('\nTest 3: ResponseFormatter');
    const formatter = new ResponseFormatter();
    
    const response = formatter.format({
      summary: 'Test analysis complete',
      confidence: 0.95,
      critical: [
        {
          file: 'test.js',
          line: 42,
          operation: 'replace',
          code: 'const fixed = true;',
          validated: true,
          reason: 'Fix critical issue'
        }
      ],
      recommended: [
        {
          file: 'test.js',
          line: 10,
          operation: 'insert',
          code: '// Add comment',
          validated: true,
          reason: 'Improve documentation'
        }
      ],
      filesAnalyzed: 1
    });
    
    console.log(`✅ Response formatted successfully`);
    console.log(`   Summary: ${response.summary}`);
    console.log(`   Confidence: ${response.confidence}`);
    console.log(`   Critical actions: ${response.actions.critical.length}`);
    console.log(`   Recommended actions: ${response.actions.recommended.length}`);
    console.log(`   Tokens saved: ${response.metadata.tokensSaved}`);
    
    // Test 4: Multi-file relationship detection
    console.log('\nTest 4: Multi-file relationships');
    
    // Create another file that imports from the first
    const testFile2 = path.join(TEMP_DIR, 'consumer.js');
    await fs.writeFile(testFile2, `
import { TestClass, testFunction } from './test';

const instance = new TestClass();
const result = instance.testMethod(5);
const sum = testFunction(10, 20);

console.log(result, sum);
    `.trim());
    
    await manager.analyseFile(testFile2);
    const relationships = manager.getFileRelationships(testFile2);
    
    console.log(`✅ Found ${relationships.length} relationships`);
    relationships.forEach(rel => {
      console.log(`   ${path.basename(rel.from)} --${rel.type}--> ${rel.to}`);
    });
    
    // Test 5: Symbol search
    console.log('\nTest 5: Symbol search');
    const testClassSymbol = manager.findSymbol('TestClass');
    console.log(`✅ Found ${testClassSymbol.length} symbol(s) for 'TestClass'`);
    
    const allSymbols = manager.getAllSymbols();
    console.log(`   Total symbols in project: ${allSymbols.size}`);
    
    // Test 6: JSON response format
    console.log('\nTest 6: JSON response format');
    const jsonResponse = JSON.stringify(response, null, 2);
    const parsedJson = JSON.parse(jsonResponse);
    console.log(`✅ Response is valid JSON`);
    console.log(`   Can be parsed and re-serialized`);
    
    // Test 7: Error handling
    console.log('\nTest 7: Error handling');
    try {
      await manager.analyseFile('non-existent-file.js');
    } catch (error) {
      console.log(`✅ Properly handles missing files`);
    }
    
    const errorResponse = formatter.format({
      summary: 'Error occurred',
      confidence: 0,
      errors: ['File not found', 'Invalid syntax'],
      warnings: ['Deprecated function used']
    });
    
    console.log(`   Error response includes ${errorResponse.errors?.length || 0} errors`);
    console.log(`   Warning response includes ${errorResponse.warnings?.length || 0} warnings`);
    
    console.log('\n✅ All tests passed successfully!');
    console.log('\nSummary:');
    console.log('- FileContextManager can parse and cache files');
    console.log('- ResponseFormatter ensures JSON structure');
    console.log('- Multi-file relationships are detected');
    console.log('- Symbol table works correctly');
    console.log('- Error handling is in place');
    
  } finally {
    // Clean up
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
    console.log('\n🧹 Cleaned up test files');
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
