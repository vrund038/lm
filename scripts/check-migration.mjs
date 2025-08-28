#!/usr/bin/env node

/**
 * Quick migration progress checker script
 * Run with: node scripts/check-migration.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Check which placeholder files have actual implementation
function checkImplementationStatus() {
  const FUNCTIONS_TO_MIGRATE = {
    analyze: [
      { name: 'analyze_single_file', target: 'prompts/analyze/single-file.ts' },
      { name: 'security_audit', target: 'prompts/analyze/security-audit.ts' },
      { name: 'analyze_n8n_workflow', target: 'prompts/analyze/n8n-workflow.ts' },
      { name: 'analyze_project_structure', target: 'prompts/analyze/project-structure.ts' }
    ],
    generate: [
      { name: 'generate_unit_tests', target: 'prompts/generate/unit-tests.ts' },
      { name: 'generate_documentation', target: 'prompts/generate/documentation.ts' },
      { name: 'suggest_refactoring', target: 'prompts/generate/refactoring.ts' },
      { name: 'generate_wordpress_plugin', target: 'prompts/generate/wordpress-plugin.ts' },
      { name: 'generate_responsive_component', target: 'prompts/generate/responsive-component.ts' },
      { name: 'convert_to_typescript', target: 'prompts/generate/typescript-conversion.ts' }
    ],
    multifile: [
      { name: 'compare_integration', target: 'prompts/multifile/compare-integration.ts' },
      { name: 'trace_execution_path', target: 'prompts/multifile/trace-execution.ts' },
      { name: 'find_pattern_usage', target: 'prompts/multifile/find-patterns.ts' },
      { name: 'diff_method_signatures', target: 'prompts/multifile/diff-signatures.ts' }
    ],
    system: [
      { name: 'health_check', target: 'system/health-check.ts' },
      { name: 'clear_analysis_cache', target: 'prompts/shared/cache-manager.ts' },
      { name: 'get_cache_statistics', target: 'prompts/shared/cache-manager.ts' }
    ]
  };

  console.log('\n=== Implementation Status Check ===\n');
  
  let totalFunctions = 0;
  let fullyImplemented = 0;
  let partiallyImplemented = 0;
  let placeholders = 0;
  
  Object.entries(FUNCTIONS_TO_MIGRATE).forEach(([category, items]) => {
    console.log(`\n${category.toUpperCase()}:`);
    items.forEach(item => {
      totalFunctions++;
      const targetPath = path.join(projectRoot, 'src', item.target);
      
      if (fs.existsSync(targetPath)) {
        const content = fs.readFileSync(targetPath, 'utf-8');
        const lines = content.split('\n').length;
        const hasClass = content.includes('extends BasePlugin');
        const hasExecute = content.includes('async execute(');
        const hasPrompt = content.includes('getPrompt(');
        
        const status = hasClass && hasExecute && hasPrompt ? '✅' : 
                      hasClass ? '🔨' : 
                      lines > 50 ? '📝' : '⚠️';
        
        console.log(`  ${status} ${item.name} (${lines} lines)`);
        
        if (status === '✅') {
          console.log(`     ✓ Full implementation detected`);
          fullyImplemented++;
        } else if (status === '🔨') {
          console.log(`     ⚡ Partial implementation`);
          partiallyImplemented++;
        } else if (status === '📝') {
          console.log(`     ○ Has content but no plugin structure`);
          placeholders++;
        } else {
          console.log(`     ⚠️  Placeholder only`);
          placeholders++;
        }
      } else {
        console.log(`  ❌ ${item.name} - File not found`);
      }
    });
  });
  
  console.log('\n=== Summary ===');
  console.log(`Total Functions: ${totalFunctions}`);
  console.log(`Fully Implemented: ${fullyImplemented} (${Math.round(fullyImplemented/totalFunctions*100)}%)`);
  console.log(`Partially Implemented: ${partiallyImplemented} (${Math.round(partiallyImplemented/totalFunctions*100)}%)`);
  console.log(`Placeholders: ${placeholders} (${Math.round(placeholders/totalFunctions*100)}%)`);
}

// Main execution
console.log('Local LLM MCP - Migration Progress Checker');
console.log('==========================================');

checkImplementationStatus();

console.log('\nLegend:');
console.log('✅ Fully implemented plugin');
console.log('🔨 Partial implementation (has class structure)');
console.log('📝 Has content but needs migration');
console.log('⚠️  Placeholder file only');
console.log('❌ File missing\n');
