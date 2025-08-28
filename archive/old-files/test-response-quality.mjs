import { LMStudioClient } from '@lmstudio/sdk';

const client = new LMStudioClient({
  baseUrl: 'ws://127.0.0.1:1234'
});

async function testDirectPrompt() {
  try {
    const models = await client.llm.listLoaded();
    console.log('Found', models.length, 'loaded models');
    
    if (models.length === 0) {
      console.log('No models loaded!');
      return;
    }
    
    // Use the model directly from the list
    const model = models[0];
    console.log('Using model:', model.identifier);
    
    // Test 1: Simple instruction
    console.log('\n=== Test 1: Simple instruction ===');
    const response1 = model.respond([
      { role: 'user', content: 'List three benefits of TypeScript in a JSON array' }
    ]);
    
    let result1 = '';
    for await (const chunk of response1) {
      if (typeof chunk === 'string') {
        result1 += chunk;
      } else if (chunk?.content) {
        result1 += chunk.content;
      }
    }
    console.log('Response:', result1);
    console.log('First 100 chars:', result1.substring(0, 100));
    
    // Test 2: Code analysis instruction
    console.log('\n=== Test 2: Code analysis ===');
    const response2 = model.respond([
      { 
        role: 'system', 
        content: 'You are a code analyst. Return structured JSON responses only.' 
      },
      { 
        role: 'user', 
        content: `Analyze this code and return a JSON object:
export const config = {
  url: 'ws://localhost:1234',
  timeout: 30000
};

Return: {"summary": "analysis", "exports": ["config"], "properties": ["url", "timeout"]}` 
      }
    ]);
    
    let result2 = '';
    for await (const chunk of response2) {
      if (typeof chunk === 'string') {
        result2 += chunk;
      } else if (chunk?.content) {
        result2 += chunk.content;
      }
    }
    console.log('Response:', result2);
    console.log('First 100 chars:', result2.substring(0, 100));
    
    // Test 3: Check for thinking tags
    console.log('\n=== Test 3: Direct question ===');
    const response3 = model.respond([
      { role: 'user', content: 'What is 2+2? Reply with just the number.' }
    ]);
    
    let result3 = '';
    for await (const chunk of response3) {
      if (typeof chunk === 'string') {
        result3 += chunk;
      } else if (chunk?.content) {
        result3 += chunk.content;
      }
    }
    console.log('Response:', result3);
    console.log('First 100 chars:', result3.substring(0, 100));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testDirectPrompt();