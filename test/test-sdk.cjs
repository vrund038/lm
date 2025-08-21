const { LMStudioClient } = require('@lmstudio/sdk');

async function testConnection() {
  console.log('Testing LM Studio connection...');
  
  try {
    const client = new LMStudioClient();
    
    // Test 1: Check if we can list loaded models
    console.log('\nTest 1: Listing loaded models...');
    const models = await client.llm.listLoaded();
    console.log(`Found ${models.length} loaded models:`);
    models.forEach(model => {
      console.log(`  - ${model.identifier} (${model.path})`);
    });
    
    if (models.length === 0) {
      console.log('⚠️  No models loaded. Please load a model in LM Studio.');
      return;
    }
    
    // Test 2: Simple text completion
    console.log('\nTest 2: Testing simple text completion...');
    const model = await client.llm.model(models[0].identifier);
    const response = await model.respond([
      { role: 'user', content: 'Say "Hello from LM Studio SDK!" and nothing else.' }
    ]);
    console.log('Response:', response.content);
    
    console.log('\n✅ Basic tests passed! LM Studio SDK is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('Make sure LM Studio is running and the local server is started on port 1234');
    }
  }
}

// Run the test
testConnection().catch(console.error);
