#!/usr/bin/env node

/**
 * Diagnostic script for Local LLM MCP Server
 * Helps diagnose common configuration and connection issues
 */

import { LMStudioClient } from '@lmstudio/sdk';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import os from 'os';

const DIAGNOSTIC_VERSION = '1.0.0';

console.log(`\n=== Local LLM MCP Diagnostic Tool v${DIAGNOSTIC_VERSION} ===\n`);

// Helper functions
const checkResult = (passed, message) => {
  console.log(`[${passed ? '✓' : '✗'}] ${message}`);
  return passed;
};

const section = (title) => {
  console.log(`\n--- ${title} ---`);
};

async function runDiagnostics() {
  let allPassed = true;
  const results = {
    environment: {},
    lmStudio: {},
    claude: {},
    server: {}
  };

  // 1. Check Node.js version
  section('Environment Checks');
  
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.split('.')[0].substring(1));
  results.environment.nodeVersion = nodeVersion;
  allPassed &= checkResult(nodeMajor >= 18, `Node.js version: ${nodeVersion} (requires 18+)`);
  
  // 2. Check OS and paths
  const platform = os.platform();
  results.environment.platform = platform;
  console.log(`   Operating System: ${platform}`);
  
  // 3. Check environment variables
  const lmStudioUrl = process.env.LM_STUDIO_URL || 'ws://localhost:1234';
  const allowedDirs = process.env.LLM_MCP_ALLOWED_DIRS || 'Using defaults';
  
  results.environment.lmStudioUrl = lmStudioUrl;
  results.environment.allowedDirs = allowedDirs;
  
  console.log(`   LM_STUDIO_URL: ${lmStudioUrl}`);
  console.log(`   LLM_MCP_ALLOWED_DIRS: ${allowedDirs}`);
  
  // 4. Test LM Studio connection
  section('LM Studio Connection');
  
  try {
    const client = new LMStudioClient({ baseUrl: lmStudioUrl });
    console.log(`   Attempting connection to ${lmStudioUrl}...`);
    
    const models = await client.llm.listLoaded();
    results.lmStudio.connected = true;
    results.lmStudio.modelsLoaded = models.length;
    
    if (models.length === 0) {
      checkResult(false, 'LM Studio connected but no models loaded');
      console.log('   → Please load a model in LM Studio');
    } else {
      checkResult(true, `LM Studio connected with ${models.length} model(s) loaded`);
      models.forEach((model, i) => {
        console.log(`   → Model ${i + 1}: ${model.identifier}`);
      });
    }
  } catch (error) {
    allPassed = false;
    results.lmStudio.connected = false;
    results.lmStudio.error = error.message;
    
    checkResult(false, 'Failed to connect to LM Studio');
    console.log(`   Error: ${error.message}`);
    console.log('\n   Troubleshooting tips:');
    console.log('   1. Ensure LM Studio is running');
    console.log('   2. Check that the server is started in LM Studio');
    console.log(`   3. Verify the URL matches: ${lmStudioUrl}`);
    console.log('   4. Try http://localhost:1234 in your browser');
  }
  
  // 5. Check Claude configuration
  section('Claude Desktop Configuration');
  
  const claudeConfigPath = platform === 'win32' 
    ? resolve(process.env.APPDATA, 'Claude', 'claude_desktop_config.json')
    : platform === 'darwin'
    ? resolve(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    : resolve(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    
  results.claude.configPath = claudeConfigPath;
  
  if (existsSync(claudeConfigPath)) {
    checkResult(true, `Claude config found at: ${claudeConfigPath}`);
    
    try {
      const configContent = readFileSync(claudeConfigPath, 'utf8');
      const config = JSON.parse(configContent);
      
      if (config.mcpServers && config.mcpServers['local-llm']) {
        checkResult(true, 'local-llm server found in configuration');
        const serverConfig = config.mcpServers['local-llm'];
        
        console.log(`   Command: ${serverConfig.command}`);
        console.log(`   Args: ${JSON.stringify(serverConfig.args)}`);
        
        // Check if using NPX or local installation
        if (serverConfig.command === 'npx') {
          console.log('   → Using NPX installation method');
        } else if (serverConfig.command === 'node') {
          console.log('   → Using local installation method');
        }
        
        results.claude.serverConfigured = true;
        results.claude.installMethod = serverConfig.command === 'npx' ? 'npm' : 'local';
      } else {
        allPassed = false;
        checkResult(false, 'local-llm server not found in configuration');
        console.log('   → Please add local-llm to your Claude configuration');
        results.claude.serverConfigured = false;
      }
    } catch (error) {
      allPassed = false;
      checkResult(false, 'Failed to parse Claude configuration');
      console.log(`   Error: ${error.message}`);
      results.claude.parseError = error.message;
    }
  } else {
    allPassed = false;
    checkResult(false, 'Claude configuration file not found');
    console.log(`   Expected location: ${claudeConfigPath}`);
    results.claude.configFound = false;
  }
  
  // 6. Check for multiple Claude processes
  section('Process Check');
  
  if (platform === 'win32') {
    try {
      const processes = await new Promise((resolve, reject) => {
        const ps = spawn('tasklist', ['/FI', 'IMAGENAME eq Claude.exe', '/FO', 'CSV']);
        let output = '';
        ps.stdout.on('data', (data) => output += data);
        ps.on('close', () => {
          const lines = output.trim().split('\n');
          resolve(lines.length - 1); // Subtract header line
        });
      });
      
      if (processes > 1) {
        checkResult(false, `Found ${processes} Claude.exe processes running`);
        console.log('   → Multiple Claude processes can cause connection issues');
        console.log('   → Close all Claude instances and restart');
      } else if (processes === 1) {
        checkResult(true, 'Single Claude process running');
      } else {
        console.log('   Claude not currently running');
      }
      
      results.claude.processCount = processes;
    } catch (error) {
      console.log('   Unable to check Claude processes');
    }
  }
  
  // 7. Test MCP server directly
  section('MCP Server Test');
  
  console.log('   Testing if MCP server can be started...');
  
  try {
    // Try to spawn the server
    const testProcess = spawn('node', [resolve(process.cwd(), 'dist', 'index.js')], {
      stdio: 'pipe',
      timeout: 3000
    });
    
    let errorOutput = '';
    testProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    // Give it a moment to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (testProcess.pid) {
      checkResult(true, 'MCP server can be started');
      testProcess.kill();
      results.server.canStart = true;
    }
  } catch (error) {
    checkResult(false, 'Failed to start MCP server');
    console.log(`   Error: ${error.message}`);
    results.server.canStart = false;
    results.server.error = error.message;
  }
  
  // 8. Summary
  section('Diagnostic Summary');
  
  if (allPassed) {
    console.log('\n✅ All checks passed! Your setup appears to be working correctly.\n');
    console.log('If you\'re still experiencing issues:');
    console.log('1. Fully restart Claude Desktop (check system tray)');
    console.log('2. Wait 10 seconds after restart for servers to initialize');
    console.log('3. Try using a tool like: local-llm:health_check');
  } else {
    console.log('\n❌ Some checks failed. Please address the issues above.\n');
    console.log('Common fixes:');
    console.log('1. Start LM Studio and load a model');
    console.log('2. Ensure the server is running in LM Studio');
    console.log('3. Check your Claude configuration');
    console.log('4. Restart Claude Desktop completely');
  }
  
  // 9. Generate report file
  const reportPath = resolve(process.cwd(), 'diagnostic-report.json');
  console.log(`\nDiagnostic report saved to: ${reportPath}`);
  
  const report = {
    timestamp: new Date().toISOString(),
    version: DIAGNOSTIC_VERSION,
    results,
    summary: {
      passed: allPassed,
      platform,
      nodeVersion,
      lmStudioUrl
    }
  };
  
  try {
    const { writeFileSync } = await import('fs');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  } catch (error) {
    console.log('Failed to save diagnostic report:', error.message);
  }
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('\nFatal error running diagnostics:', error);
  process.exit(1);
});
