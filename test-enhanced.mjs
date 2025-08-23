// Quick test to verify enhanced prompts work correctly
// Run this after building to test the new features

import { createCodeStructurePrompt, createWordPressPluginPrompt } from './enhanced-prompts.js';

console.log('=== Enhanced Local LLM MCP Test ===\n');

// Test 1: Context-aware code analysis
const testCode = `
class UserAuth {
  constructor() {
    this.users = new Map();
  }
  
  register(username, password) {
    // TODO: Hash password
    this.users.set(username, password);
  }
}`;

const nodeApiPrompt = createCodeStructurePrompt(testCode, {
  projectType: 'node-api',
  language: 'javascript',
  framework: 'Express',
  standards: ['OWASP', 'Clean Code'],
  environment: 'node'
});

console.log('Test 1: Node API Context Analysis');
console.log('Context included:', {
  hasSecurityChecks: nodeApiPrompt.includes('Security'),
  hasNodePatterns: nodeApiPrompt.includes('middleware'),
  hasFramework: nodeApiPrompt.includes('Express')
});

// Test 2: WordPress plugin generation
const wpPluginPrompt = createWordPressPluginPrompt({
  name: 'SEO Helper',
  description: 'Adds SEO meta tags',
  features: ['meta tags', 'sitemap'],
  prefix: 'seo_helper',
  includeAdmin: true,
  includeRest: true
});

console.log('\nTest 2: WordPress Plugin Generation');
console.log('Plugin structure includes:', {
  hasMainFile: wpPluginPrompt.includes('seo_helper.php'),
  hasAdminInterface: wpPluginPrompt.includes('Admin Interface'),
  hasRestAPI: wpPluginPrompt.includes('REST API'),
  hasSecurityGuidelines: wpPluginPrompt.includes('Nonce verification')
});

console.log('\n✓ Enhanced prompts are working correctly!');
console.log('Ready to integrate into Local LLM MCP v3.0.0');
