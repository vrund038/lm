/**
 * Security Module Integration Test
 * Tests the sanitisation I/O helper module
 */

import { runSecurityTests } from '../security/index.js';

async function testSecurityIntegration() {
  console.log('🔒 Testing Security Module Integration...\n');
  
  try {
    const results = runSecurityTests();
    
    console.log('📊 Test Results:');
    console.log('================');
    
    // Sanitisation tests
    console.log(`✅ Sanitisation: ${results.sanitisation ? 'PASSED' : 'FAILED'}`);
    
    // Injection detection tests
    const injectionRate = (results.injection.passed / (results.injection.passed + results.injection.failed)) * 100;
    console.log(`🛡️  Injection Detection: ${results.injection.passed}/${results.injection.passed + results.injection.failed} (${injectionRate.toFixed(1)}%)`);
    
    // Output encoding tests
    console.log(`🔐 Output Encoding: ${results.encoding.passed ? 'PASSED' : 'FAILED'}`);
    if (!results.encoding.passed) {
      console.log('   Errors:', results.encoding.errors);
    }
    
    // Overall result
    const allPassed = results.sanitisation && results.injection.failed === 0 && results.encoding.passed;
    
    console.log('\n🎯 Overall Security Status:');
    console.log(allPassed ? '✅ ALL TESTS PASSED - Security module ready' : '❌ SOME TESTS FAILED - Review required');
    
    return allPassed;
    
  } catch (error) {
    console.error('❌ Security test failed:', error);
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSecurityIntegration()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testSecurityIntegration };