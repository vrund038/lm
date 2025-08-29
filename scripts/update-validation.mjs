#!/usr/bin/env node
/**
 * Auto-update script to integrate ResponseFactory into all Local LLM MCP functions
 * This script automatically updates all function files to use the new validation system
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function names and their file paths
const functions = [
  // Analysis functions
  { name: 'security_audit', path: 'src/prompts/analyze/security-audit.ts' },
  { name: 'analyze_n8n_workflow', path: 'src/prompts/analyze/n8n-workflow.ts' },
  { name: 'analyze_project_structure', path: 'src/prompts/analyze/project-structure.ts' },
  
  // Generation functions  
  { name: 'generate_unit_tests', path: 'src/prompts/generate/unit-tests.ts' },
  { name: 'generate_documentation', path: 'src/prompts/generate/documentation.ts' },
  { name: 'suggest_refactoring', path: 'src/prompts/generate/refactoring.ts' },
  { name: 'generate_wordpress_plugin', path: 'src/prompts/generate/wordpress-plugin.ts' },
  { name: 'generate_responsive_component', path: 'src/prompts/generate/responsive-component.ts' },
  { name: 'convert_to_typescript', path: 'src/prompts/generate/typescript-converter.ts' },
  
  // Multi-file functions
  { name: 'compare_integration', path: 'src/prompts/multifile/compare-integration.ts' },
  { name: 'trace_execution_path', path: 'src/prompts/multifile/trace-execution.ts' },
  { name: 'find_pattern_usage', path: 'src/prompts/multifile/find-patterns.ts' },
  { name: 'diff_method_signatures', path: 'src/prompts/multifile/diff-signatures.ts' },
  
  // System functions
  { name: 'health_check', path: 'src/system/health-check.ts' },
  { name: 'clear_analysis_cache', path: 'src/prompts/multifile/cache-manager.ts' },
  { name: 'get_cache_statistics', path: 'src/prompts/multifile/cache-manager.ts' }
];

// Import statement to add
const importStatement = "import { ResponseFactory } from '../../validation/response-factory.js';";
const systemImportStatement = "import { ResponseFactory } from '../validation/response-factory.js';";

// Update patterns
const returnPattern = /return\s*{[\s\S]*?};/g;
const errorPattern = /throw new Error\(`([^`]+)`\);/g;

function updateFunction(functionInfo) {
  const filePath = path.join(__dirname, '..', functionInfo.path);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${functionInfo.path}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let updated = false;

  // Add import statement if not already present
  const correctImport = functionInfo.path.includes('src/system/') ? systemImportStatement : importStatement;
  if (!content.includes("ResponseFactory")) {
    // Find the last import statement
    const importLines = content.split('\n');
    let lastImportIndex = -1;
    
    for (let i = 0; i < importLines.length; i++) {
      if (importLines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex !== -1) {
      importLines.splice(lastImportIndex + 1, 0, correctImport);
      content = importLines.join('\n');
      updated = true;
      console.log(`✅ Added import to ${functionInfo.name}`);
    }
  }

  // Update return statements (basic pattern - might need manual refinement)
  if (content.includes('return {') && !content.includes('ResponseFactory.parseAndCreateResponse')) {
    // Look for the main return statement in the execute method
    const returnMatch = content.match(/return\s*{\s*([\w\s:,'"]*)\s*:\s*response[,\s]*([\s\S]*?)};/);
    if (returnMatch) {
      const replacement = `
      // Use ResponseFactory for consistent, spec-compliant output
      ResponseFactory.setStartTime();
      return ResponseFactory.parseAndCreateResponse(
        '${functionInfo.name}',
        response,
        model.identifier || 'unknown'
      );`;
      
      content = content.replace(returnMatch[0], replacement);
      updated = true;
      console.log(`✅ Updated return statement in ${functionInfo.name}`);
    }
  }

  // Update error handling
  content = content.replace(
    errorPattern, 
    (match, errorMessage) => {
      updated = true;
      return `return ResponseFactory.createErrorResponse(
        '${functionInfo.name}',
        'MODEL_ERROR',
        \`${errorMessage}\`,
        { originalError: error.message },
        'unknown'
      );`;
    }
  );

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`🎯 Updated ${functionInfo.name} successfully`);
  } else {
    console.log(`➡️  ${functionInfo.name} already up to date`);
  }
}

console.log('🚀 Starting auto-update of all Local LLM MCP functions...\n');

let totalUpdated = 0;
for (const func of functions) {
  console.log(`\n📝 Processing ${func.name}...`);
  try {
    updateFunction(func);
    totalUpdated++;
  } catch (error) {
    console.error(`❌ Error updating ${func.name}: ${error.message}`);
  }
}

console.log(`\n🎉 Auto-update completed! Processed ${totalUpdated}/${functions.length} functions`);
console.log('\n⚠️  Note: Some functions may need manual refinement for complex return structures');
console.log('💡 Remember to run: npm run build && restart Claude Desktop');
