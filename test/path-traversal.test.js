/**
 * Path Traversal Security Tests
 * 
 * These tests validate the enhanced path traversal protection in validateAndNormalizePath()
 */

import { validateAndNormalizePath } from '../dist/prompts/shared/helpers.js';
import { securityConfig } from '../dist/security-config.js';

// Mock environment for testing
process.env.LLM_MCP_ALLOWED_DIRS = 'C:\\MCP,C:\\Projects,C:\\Users\\Richard Baxter\\Documents';

/**
 * Test helper to expect rejection with specific message
 */
async function expectRejection(promise, expectedMessage) {
  try {
    await promise;
    throw new Error('Expected rejection but promise resolved');
  } catch (error) {
    if (!error.message.includes(expectedMessage)) {
      throw new Error(`Expected error containing "${expectedMessage}", got: ${error.message}`);
    }
    console.log(`✅ Correctly rejected: ${error.message}`);
  }
}

/**
 * Test helper to expect successful validation
 */
async function expectSuccess(filePath, description) {
  try {
    const result = await validateAndNormalizePath(filePath);
    console.log(`✅ ${description}: ${filePath} → ${result}`);
    return result;
  } catch (error) {
    console.error(`❌ ${description}: Expected success but got error: ${error.message}`);
    throw error;
  }
}

/**
 * Main test function
 */
async function runPathTraversalTests() {
  console.log('🛡️  Running Path Traversal Security Tests...\n');

  // Test 1: Basic valid paths should work
  console.log('Test 1: Valid paths');
  await expectSuccess('C:\\MCP\\test.txt', 'Valid file in allowed directory');
  await expectSuccess('C:\\Projects\\myapp\\src\\index.js', 'Valid nested file');
  await expectSuccess('C:\\Users\\Richard Baxter\\Documents\\report.pdf', 'Valid file in user directory');

  console.log('\nTest 2: Path traversal attempts should be blocked');
  
  // Test 2a: Classic path traversal
  await expectRejection(
    validateAndNormalizePath('C:\\MCP\\..\\..\\Windows\\System32\\config\\sam'),
    'Path traversal sequences detected'
  );
  
  // Test 2b: Forward slashes mixed with backslashes
  await expectRejection(
    validateAndNormalizePath('C:\\MCP\\../../../Windows/System32'),
    'Path traversal sequences detected'
  );
  
  // Test 2c: Double dot sequences
  await expectRejection(
    validateAndNormalizePath('C:\\MCP\\..\\..\\Windows\\System32'),
    'Path traversal sequences detected'
  );
  
  // Test 2d: Multiple traversal sequences
  await expectRejection(
    validateAndNormalizePath('C:\\MCP\\..\\..\\..\\..\\Windows\\System32'),
    'Path traversal sequences detected'
  );

  console.log('\nTest 3: Null byte injection should be blocked');
  await expectRejection(
    validateAndNormalizePath('C:\\MCP\\test.txt\0.exe'),
    'Null byte detected'
  );

  console.log('\nTest 4: Relative paths should be blocked');
  await expectRejection(
    validateAndNormalizePath('..\\..\\Windows\\System32'),
    'Path traversal sequences detected'
  );
  
  await expectRejection(
    validateAndNormalizePath('test.txt'),
    'File path must be absolute'
  );

  console.log('\nTest 5: Paths outside allowed directories should be blocked');
  await expectRejection(
    validateAndNormalizePath('C:\\Windows\\System32\\cmd.exe'),
    'outside allowed directories'
  );
  
  await expectRejection(
    validateAndNormalizePath('D:\\sensitive\\data.txt'),
    'outside allowed directories'
  );

  console.log('\nTest 6: Invalid input types should be blocked');
  await expectRejection(
    validateAndNormalizePath(null),
    'Invalid file path provided'
  );
  
  await expectRejection(
    validateAndNormalizePath(undefined),
    'Invalid file path provided'
  );
  
  await expectRejection(
    validateAndNormalizePath(''),
    'Invalid file path provided'
  );
  
  await expectRejection(
    validateAndNormalizePath(123),
    'Invalid file path provided'
  );

  console.log('\nTest 7: Edge cases and bypass attempts');
  
  // Test 7a: UNC paths
  await expectRejection(
    validateAndNormalizePath('\\\\server\\share\\file.txt'),
    'outside allowed directories'
  );
  
  // Test 7b: Case variations (should work due to case-insensitive matching)
  await expectSuccess('c:\\mcp\\test.txt', 'Case insensitive valid path');
  await expectSuccess('C:\\mcp\\TEST.TXT', 'Mixed case valid path');
  
  // Test 7c: Path with spaces
  await expectSuccess('C:\\Users\\Richard Baxter\\Documents\\my file.txt', 'Path with spaces');

  console.log('\n🎉 All path traversal security tests completed successfully!');
  console.log('✅ Enhanced path validation is working correctly');
}

/**
 * Performance test for the validation function
 */
async function runPerformanceTest() {
  console.log('\n⚡ Running performance test...');
  
  const testPaths = [
    'C:\\MCP\\test1.txt',
    'C:\\Projects\\app\\src\\main.js', 
    'C:\\Users\\Richard Baxter\\Documents\\report.pdf'
  ];
  
  const iterations = 1000;
  const startTime = process.hrtime.bigint();
  
  for (let i = 0; i < iterations; i++) {
    for (const testPath of testPaths) {
      await validateAndNormalizePath(testPath);
    }
  }
  
  const endTime = process.hrtime.bigint();
  const totalTimeMs = Number(endTime - startTime) / 1_000_000;
  const avgTimePerValidation = totalTimeMs / (iterations * testPaths.length);
  
  console.log(`⚡ Performance test completed:`);
  console.log(`   - Total validations: ${iterations * testPaths.length}`);
  console.log(`   - Total time: ${totalTimeMs.toFixed(2)}ms`);
  console.log(`   - Average time per validation: ${avgTimePerValidation.toFixed(4)}ms`);
  console.log(`   - Validations per second: ${(1000 / avgTimePerValidation).toFixed(0)}`);
}

// Run tests - simplified detection
console.log('Starting path traversal tests...');
try {
  await runPathTraversalTests();
  await runPerformanceTest();
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
}

export { runPathTraversalTests, runPerformanceTest };
