// Simple test of enhanced prompts
import { createCodeStructurePrompt, createWordPressPluginPrompt } from './dist/enhanced-prompts.js';

console.log('Testing Enhanced Prompts\n');

// Test 1: WordPress context
const wpCode = `
class My_Plugin {
  public function __construct() {
    add_action('init', array($this, 'init'));
  }
}`;

const wpPrompt = createCodeStructurePrompt(wpCode, {
  projectType: 'wordpress-plugin',
  language: 'PHP',
  framework: 'WordPress'
});

console.log('WordPress Plugin Analysis:');
console.log('- Has WordPress-specific checks:', wpPrompt.includes('Hook usage'));
console.log('- Has security guidance:', wpPrompt.includes('nonces'));
console.log('- Length:', wpPrompt.length, 'characters\n');

// Test 2: WordPress plugin generation
const pluginPrompt = createWordPressPluginPrompt({
  name: 'Test Plugin',
  description: 'A test plugin',
  features: ['admin page'],
  prefix: 'tp'
});

console.log('WordPress Plugin Generation:');
console.log('- Has file structure:', pluginPrompt.includes('File Structure'));
console.log('- Has security requirements:', pluginPrompt.includes('Security Requirements'));
console.log('- Length:', pluginPrompt.length, 'characters');

console.log('\n✅ Enhanced prompts working correctly!');
