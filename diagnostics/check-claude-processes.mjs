#!/usr/bin/env node

/**
 * Check for multiple Claude processes
 * Multiple Claude.exe processes can cause MCP connection issues
 */

import { spawn } from 'child_process';
import os from 'os';

console.log('\n=== Claude Process Checker ===\n');

const platform = os.platform();

if (platform !== 'win32') {
  console.log('This script is for Windows only.');
  console.log('On macOS/Linux, use: ps aux | grep Claude');
  process.exit(0);
}

async function checkClaudeProcesses() {
  try {
    const processes = await new Promise((resolve, reject) => {
      const ps = spawn('tasklist', ['/FI', 'IMAGENAME eq Claude.exe', '/FO', 'CSV', '/V']);
      let output = '';
      
      ps.stdout.on('data', (data) => output += data);
      ps.on('error', reject);
      ps.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code ${code}`));
          return;
        }
        
        const lines = output.trim().split('\n').filter(line => line);
        const processLines = lines.slice(1); // Skip header
        
        const processes = processLines.map(line => {
          const parts = line.split('","').map(p => p.replace(/"/g, ''));
          return {
            name: parts[0],
            pid: parts[1],
            memory: parts[4],
            windowTitle: parts[8] || 'N/A'
          };
        });
        
        resolve(processes);
      });
    });
    
    console.log(`Found ${processes.length} Claude process(es):\n`);
    
    if (processes.length === 0) {
      console.log('Claude is not currently running.');
    } else if (processes.length === 1) {
      console.log('✅ Single Claude instance running (expected)');
      console.log(`   PID: ${processes[0].pid}`);
      console.log(`   Memory: ${processes[0].memory}`);
    } else {
      console.log('⚠️  Multiple Claude instances detected!');
      console.log('This can cause MCP connection issues.\n');
      
      processes.forEach((proc, i) => {
        console.log(`Instance ${i + 1}:`);
        console.log(`   PID: ${proc.pid}`);
        console.log(`   Memory: ${proc.memory}`);
        console.log(`   Window: ${proc.windowTitle}\n`);
      });
      
      console.log('Recommended actions:');
      console.log('1. Close all Claude windows');
      console.log('2. Check the system tray for hidden Claude instances');
      console.log('3. Use Task Manager to end all Claude.exe processes');
      console.log('4. Restart Claude Desktop\n');
      
      // Offer to kill processes
      console.log('To kill all Claude processes, run:');
      console.log('   taskkill /F /IM Claude.exe\n');
    }
    
  } catch (error) {
    console.error('Error checking processes:', error.message);
    console.log('\nYou can manually check using:');
    console.log('   tasklist | findstr Claude.exe');
  }
}

checkClaudeProcesses();
