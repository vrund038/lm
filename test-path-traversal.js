/**
 * Test script to verify path traversal vulnerability fixes
 * This tests the validateAndNormalizePath function with various attack vectors
 */

import { validateAndNormalizePath } from './src/prompts/shared/helpers.js';

// Test cases for path traversal attacks
const testCases = [
  // Basic path traversal attempts
  {
    path: 'C:\\MCP\\local-llm-mcp\\..\\..\\Windows\\System32\\drivers\\etc\\hosts',
    description: 'Windows path traversal to system files',
    shouldFail: true
  },
  {
    path: 'C:/MCP/local-llm-mcp/../../../etc/passwd',
    description: 'Unix-style path traversal (on Windows)',
    shouldFail: true
  },
  
  // Encoded path traversal attempts
  {
    path: 'C:\\MCP\\local-llm-mcp\\%2e%2e\\%2e%2e\\Windows\\System32',
    description: 'URL-encoded path traversal',
    shouldFail: true
  },
  
  // Null byte injection
  {
    path: 'C:\\MCP\\local-llm-mcp\\test.txt\0..\\..\\sensitive.txt',
    description: 'Null byte injection',
    shouldFail: true
  },
  
  // Double-encoded attempts
  {
    path: 'C:\\MCP\\local-llm-mcp\\..%2F..%2FWindows',
    description: 'Mixed encoding path traversal',
    shouldFail: true
  },
  
  // Relative path (should fail - must be absolute)
  {
    path: '../../../etc/passwd',
    description: 'Relative path traversal',
    shouldFail: true
  },
  
  // Valid paths (should succeed if within allowed directories)
  {
    path: 'C:\\MCP\\local-llm-mcp\\src\\index.ts',
    description: 'Valid file within allowed directory',
    shouldFail: false
  },
  {
    path: 'C:\\MCP\\local-llm-mcp\\package.json',
    description: 'Valid file in root of allowed directory',
    shouldFail: false
  },
  
  // Edge cases
  {
    path: '',
    description: 'Empty path',
    shouldFail: true
  },
  {
    path: null,
    description: 'Null path',
    shouldFail: true
  }
];

async function runSecurityTests() {
  console.log('🔒 Starting Path Traversal Security Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const testCase of testCases) {
    try {
      console.log(`Testing: ${testCase.description}`);
      console.log(`Path: ${testCase.path}`);
      
      if (testCase.path === null) {
        // Special handling for null test
        await validateAndNormalizePath(testCase.path);
      } else {
        const result = await validateAndNormalizePath(testCase.path);
        
        if (testCase.shouldFail) {
          console.log('❌ SECURITY ISSUE: Attack vector was NOT blocked!');
          console.log(`   Normalized path: ${result}`);
          failed++;
        } else {
          console.log('✅ Valid path accepted');
          console.log(`   Normalized path: ${result}`);
          passed++;
        }
      }
      
    } catch (error) {
      if (testCase.shouldFail) {
        console.log('✅ Attack vector successfully blocked');
        console.log(`   Error: ${error.message}`);
        passed++;
      } else {
        console.log('❌ Valid path incorrectly rejected');
        console.log(`   Error: ${error.message}`);
        failed++;
      }
    }
    
    console.log(''); // Empty line for readability
  }
  
  // Summary
  console.log('='.repeat(60));
  console.log('🔒 SECURITY TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`✅ Tests Passed: ${passed}`);
  console.log(`❌ Tests Failed: ${failed}`);
  console.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All security tests passed! Path traversal protection is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please review the path validation logic.');
  }
  
  return { passed, failed };
}

// Additional test: Try to actually access a sensitive file
async function testActualFileAccess() {
  console.log('\n🔍 Testing Actual File Access Prevention\n');
  
  const sensitiveFiles = [
    'C:\\Windows\\System32\\drivers\\etc\\hosts',
    'C:\\Windows\\System32\\config\\SAM',
    '/etc/passwd',
    '/etc/shadow'
  ];
  
  for (const filePath of sensitiveFiles) {
    try {
      console.log(`Attempting to access: ${filePath}`);
      const result = await validateAndNormalizePath(filePath);
      console.log('❌ CRITICAL: Sensitive file access was allowed!');
      console.log(`   Normalized path: ${result}`);
    } catch (error) {
      console.log('✅ Sensitive file access properly blocked');
      console.log(`   Blocked with: ${error.message}`);
    }
    console.log('');
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  runSecurityTests()
    .then(() => testActualFileAccess())
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { runSecurityTests, testActualFileAccess };
