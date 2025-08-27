#!/usr/bin/env node

// Test script for verifying streaming fix in Local LLM MCP
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, 'dist', 'index.js');

console.log('Testing Local LLM MCP streaming fix...\n');

// Start the MCP server
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

// Handle server errors
server.stderr.on('data', (data) => {
  const message = data.toString();
  if (message.includes('running')) {
    console.log('✅ Server started successfully');
    runTests();
  } else if (message.includes('Error')) {
    console.error('❌ Server error:', message);
  }
});

// Test the health check first
async function runTests() {
  console.log('\n1. Testing health check...');
  
  const healthCheckRequest = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "health_check",
      arguments: { detailed: true }
    },
    id: 1
  };
  
  server.stdin.write(JSON.stringify(healthCheckRequest) + '\n');
  
  // Set up response handler
  server.stdout.once('data', (data) => {
    try {
      const response = JSON.parse(data.toString());
      
      if (response.error) {
        console.error('❌ Health check failed:', response.error.message);
      } else {
        console.log('✅ Health check passed');
        
        // Check if response is properly formatted
        const content = response.result?.content?.[0]?.text;
        if (content && !content.includes('[object Object]')) {
          console.log('✅ No [object Object] in response!');
          testCodeAnalysis();
        } else {
          console.error('❌ Response contains [object Object] or is malformed');
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error);
      process.exit(1);
    }
  });
}

// Test code analysis with streaming
async function testCodeAnalysis() {
  console.log('\n2. Testing code analysis (uses LLM streaming)...');
  
  const codeAnalysisRequest = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "analyze_code_structure",
      arguments: {
        code: `function hello() {
  console.log("Hello World");
  return true;
}`,
        analysisDepth: "basic"
      }
    },
    id: 2
  };
  
  server.stdin.write(JSON.stringify(codeAnalysisRequest) + '\n');
  
  // Set timeout for response
  const timeout = setTimeout(() => {
    console.error('❌ Timeout waiting for code analysis response');
    process.exit(1);
  }, 15000);
  
  server.stdout.once('data', (data) => {
    clearTimeout(timeout);
    
    try {
      const response = JSON.parse(data.toString());
      
      if (response.error) {
        console.error('❌ Code analysis failed:', response.error.message);
        process.exit(1);
      } else {
        const content = response.result?.content?.[0]?.text;
        
        if (!content) {
          console.error('❌ No content in response');
          process.exit(1);
        } else if (content.includes('[object Object]')) {
          console.error('❌ Response still contains [object Object]');
          console.error('Content:', content.substring(0, 200));
          process.exit(1);
        } else {
          console.log('✅ Code analysis completed successfully');
          console.log('✅ Response is properly formatted');
          
          // Try to parse the JSON response
          try {
            const parsed = JSON.parse(content);
            if (parsed.summary || parsed.content || parsed.rawResponse) {
              console.log('✅ Response structure is valid');
              console.log('\n🎉 All tests passed! Streaming fix is working!');
              process.exit(0);
            }
          } catch (e) {
            console.warn('⚠️  Response is not JSON, but no [object Object] found');
            console.log('Response preview:', content.substring(0, 100));
            process.exit(0);
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error);
      process.exit(1);
    }
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down test...');
  server.kill();
  process.exit(0);
});

// Give the server a moment to start
setTimeout(() => {
  if (!server.killed) {
    console.log('Waiting for server to start...');
  }
}, 1000);
