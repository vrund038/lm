#!/usr/bin/env node

// Direct test of LLM streaming with Local LLM MCP
import { LMStudioClient } from '@lmstudio/sdk';
import { handleLLMResponse } from './dist/utils/streamHandler.js';

console.log('Testing LM Studio streaming directly...\n');

const client = new LMStudioClient({
  baseUrl: 'ws://localhost:1234',
});

async function testStreaming() {
  try {
    // List models
    const models = await client.llm.listLoaded();
    
    if (models.length === 0) {
      console.error('❌ No models loaded in LM Studio');
      return;
    }
    
    console.log(`✅ Found ${models.length} model(s):`);
    models.forEach(m => console.log(`   - ${m.identifier}`));
    
    // Use first model
    const modelName = models[0].identifier;
    console.log(`\n📊 Testing with model: ${modelName}`);
    
    const model = await client.llm.model(modelName);
    
    // Create a simple test prompt
    const prompt = `Analyze this simple function and return a brief structured response:

function add(a, b) {
  return a + b;
}

Provide:
1. Function name
2. Parameters
3. Purpose`;

    console.log('\n🔄 Sending prompt to LLM...');
    
    // Get streaming prediction
    const prediction = model.respond([
      {
        role: 'system',
        content: 'You are a helpful code analyst. Provide brief, structured responses.'
      },
      {
        role: 'user',
        content: prompt
      }
    ]);
    
    console.log('\n📝 Raw chunks received:');
    let chunkCount = 0;
    
    // Test raw streaming first
    const chunks = [];
    for await (const chunk of prediction) {
      chunkCount++;
      
      // Log chunk type and sample
      const chunkType = typeof chunk;
      let chunkInfo = `Chunk ${chunkCount}: type=${chunkType}`;
      
      if (chunkType === 'string') {
        chunkInfo += `, length=${chunk.length}`;
        if (chunk.length < 50) {
          chunkInfo += `, content="${chunk}"`;
        }
      } else if (chunkType === 'object') {
        const keys = Object.keys(chunk);
        chunkInfo += `, keys=[${keys.join(', ')}]`;
        
        // Show content of the object
        if (chunk.content) {
          chunkInfo += `, content="${chunk.content.substring(0, 30)}..."`;
        } else if (chunk.text) {
          chunkInfo += `, text="${chunk.text.substring(0, 30)}..."`;
        } else if (chunk.choices) {
          chunkInfo += `, choices=${chunk.choices.length}`;
        } else {
          // Show the actual object for debugging
          chunkInfo += `, value=${JSON.stringify(chunk).substring(0, 100)}`;
        }
      }
      
      console.log(chunkInfo);
      chunks.push(chunk);
    }
    
    console.log(`\n✅ Received ${chunkCount} chunks`);
    
    // Now test with our handler
    console.log('\n🔧 Testing handleLLMResponse function...');
    
    // Create async iterable from chunks
    async function* makeAsyncIterable(chunks) {
      for (const chunk of chunks) {
        yield chunk;
      }
    }
    
    const response = await handleLLMResponse(makeAsyncIterable(chunks));
    
    console.log('\n✅ Processed response:');
    console.log('   Length:', response.length, 'characters');
    
    // Check for [object Object]
    if (response.includes('[object Object]')) {
      console.error('\n❌ Response contains [object Object]!');
      console.log('Response preview:', response.substring(0, 200));
    } else {
      console.log('\n✅ No [object Object] in response!');
      console.log('\nResponse preview:');
      console.log(response.substring(0, 300));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testStreaming().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
