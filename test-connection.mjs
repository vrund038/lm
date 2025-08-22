// test-connection.js
// Test script to verify LM Studio connection
const http = require('http');

const url = process.env.LM_STUDIO_URL || 'http://localhost:1234';
const parsed = new URL(url.replace('ws://', 'http://'));

console.log(`Testing LM Studio connection at ${url}...\n`);

http.get(`${parsed.origin}/v1/models`, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ LM Studio is running and accessible');
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const models = JSON.parse(data);
        console.log(`✅ Found ${models.data.length} models loaded:`);
        models.data.forEach(m => console.log(`  - ${m.id}`));
        console.log('\n✅ Connection test successful! You can use Local LLM MCP.');
      } catch (e) {
        console.log('❌ Invalid response from LM Studio');
      }
    });
  } else {
    console.log(`❌ Unexpected status code: ${res.statusCode}`);
  }
}).on('error', (err) => {
  console.log(`❌ Cannot connect to LM Studio: ${err.message}`);
  console.log('\nTroubleshooting steps:');
  console.log('1. Make sure LM Studio is running');
  console.log('2. Load a model in LM Studio');
  console.log('3. Start the server (should show "Server is running")');
  console.log('4. Check the URL matches your LM Studio settings');
});