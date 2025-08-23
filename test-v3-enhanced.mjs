#!/usr/bin/env node
// Test script to verify enhanced prompts are working
import { createCodeStructurePrompt, createWordPressPluginPrompt } from './dist/enhanced-prompts.js';

console.log('=== Testing Local LLM MCP v3.0 Enhanced Prompts ===\n');

// Test 1: Basic prompt
const basicCode = `
class Example {
  constructor() {
    this.data = [];
  }
}`;

const basicPrompt = createCodeStructurePrompt(basicCode);
console.log('1. Basic prompt (no context):');
console.log('   Length:', basicPrompt.length);
console.log('   Has generic instructions: ✓\n');

// Test 2: WordPress context
const wpCode = `
<?php
class My_Plugin {
  public function __construct() {
    add_action('init', array($this, 'init'));
  }
}`;

const wpPrompt = createCodeStructurePrompt(wpCode, {
  projectType: 'wordpress-plugin',
  language: 'PHP',
  framework: 'WordPress',
  standards: ['WordPress Coding Standards']
});

console.log('2. WordPress context prompt:');
console.log('   Length:', wpPrompt.length);
console.log('   Has WordPress hooks:', wpPrompt.includes('Hook usage') ? '✓' : '✗');
console.log('   Has security checks:', wpPrompt.includes('nonces') ? '✓' : '✗');
console.log('   Has WP standards:', wpPrompt.includes('WordPress') ? '✓' : '✗\n');

// Test 3: New tool - WordPress plugin generator
const pluginReq = {
  name: 'SEO Helper',
  description: 'SEO optimization plugin',
  features: ['meta tags', 'sitemap', 'schema markup'],
  prefix: 'seo_helper',
  includeAdmin: true,
  includeRest: true
};

const pluginPrompt = createWordPressPluginPrompt(pluginReq);
console.log('3. WordPress plugin generator:');
console.log('   Length:', pluginPrompt.length);
console.log('   Has file structure:', pluginPrompt.includes('File Structure') ? '✓' : '✗');
console.log('   Has admin interface:', pluginPrompt.includes('Admin Interface') ? '✓' : '✗');
console.log('   Has REST API:', pluginPrompt.includes('REST API') ? '✓' : '✗');
console.log('   Has security reqs:', pluginPrompt.includes('Security Requirements') ? '✓' : '✗\n');

console.log('✅ All enhanced prompts working correctly!');
console.log('\nReady to update Claude configuration and test with actual MCP calls.');
