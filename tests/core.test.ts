/**
 * Tests for FileContextManager and ResponseFormatter
 */

import { FileContextManager } from '../src/core/FileContextManager';
import { ResponseFormatter } from '../src/core/ResponseFormatter';
import * as fs from 'fs/promises';
import * as path from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Test fixtures directory
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('FileContextManager', () => {
  let manager: FileContextManager;
  
  beforeAll(async () => {
    manager = new FileContextManager();
    
    // Create test fixtures
    await fs.mkdir(FIXTURES_DIR, { recursive: true });
    
    // Create test JavaScript file
    await fs.writeFile(
      path.join(FIXTURES_DIR, 'test.js'),
      `
import { something } from './other';
import React from 'react';

export class TestClass extends BaseClass {
  constructor() {
    super();
    this.property = 'value';
  }
  
  async testMethod(param1, param2 = 'default') {
    return this.helperMethod(param1);
  }
  
  helperMethod(value) {
    return value * 2;
  }
}

export function standaloneFunction(arg) {
  const result = TestClass.staticMethod();
  return result + arg;
}

const arrowFunction = async (x, y) => {
  return x + y;
};
      `.trim()
    );
    
    // Create test PHP file
    await fs.writeFile(
      path.join(FIXTURES_DIR, 'test.php'),
      `
<?php
namespace App\\Controllers;

use App\\Models\\UserModel;

class UserController extends BaseController {
  private $userModel;
  
  public function __construct() {
    $this->userModel = new UserModel();
  }
  
  public function getUser($id) {
    return $this->userModel->find($id);
  }
  
  private function validateUser($data) {
    return !empty($data['email']);
  }
}
      `.trim()
    );
  });
  
  afterAll(async () => {
    // Clean up test fixtures
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
  });
  
  describe('parseFile', () => {
    it('should parse JavaScript file correctly', async () => {
      const filePath = path.join(FIXTURES_DIR, 'test.js');
      const parsed = await manager.analyseFile(filePath);
      
      expect(parsed.language).toBe('javascript');
      expect(parsed.classes).toHaveLength(1);
      expect(parsed.classes[0].name).toBe('TestClass');
      expect(parsed.classes[0].extends).toBe('BaseClass');
      
      expect(parsed.functions).toHaveLength(1);
      expect(parsed.functions[0].name).toBe('standaloneFunction');
      
      expect(parsed.imports).toContain('./other');
      expect(parsed.imports).toContain('react');
      
      expect(parsed.exports).toContain('TestClass');
      expect(parsed.exports).toContain('standaloneFunction');
    });
    
    it('should parse PHP file correctly', async () => {
      const filePath = path.join(FIXTURES_DIR, 'test.php');
      const parsed = await manager.analyseFile(filePath);
      
      expect(parsed.language).toBe('php');
      expect(parsed.classes).toHaveLength(1);
      expect(parsed.classes[0].name).toBe('UserController');
      expect(parsed.classes[0].extends).toBe('BaseController');
      
      expect(parsed.methods).toHaveLength(2);
      expect(parsed.methods[0].name).toBe('getUser');
      expect(parsed.methods[0].visibility).toBe('public');
      expect(parsed.methods[1].name).toBe('validateUser');
      expect(parsed.methods[1].visibility).toBe('private');
      
      expect(parsed.imports).toContain('App\\Models\\UserModel');
    });
  });
  
  describe('caching', () => {
    it('should cache parsed files', async () => {
      const filePath = path.join(FIXTURES_DIR, 'test.js');
      
      // First parse
      const start1 = Date.now();
      await manager.analyseFile(filePath);
      const time1 = Date.now() - start1;
      
      // Second parse (should be cached)
      const start2 = Date.now();
      await manager.analyseFile(filePath);
      const time2 = Date.now() - start2;
      
      // Cached version should be much faster
      expect(time2).toBeLessThan(time1);
      
      const stats = manager.getCacheStats();
      expect(stats.filesAnalyzed).toBeGreaterThanOrEqual(1);
    });
    
    it('should invalidate cache on file change', async () => {
      const filePath = path.join(FIXTURES_DIR, 'test.js');
      
      // First parse
      const parsed1 = await manager.analyseFile(filePath);
      const hash1 = parsed1.hash;
      
      // Modify file
      await fs.appendFile(filePath, '\n// Comment added');
      
      // Parse again - should detect change
      const parsed2 = await manager.analyseFile(filePath);
      const hash2 = parsed2.hash;
      
      expect(hash2).not.toBe(hash1);
    });
  });
  
  describe('symbol table', () => {
    it('should build symbol table correctly', async () => {
      const filePath = path.join(FIXTURES_DIR, 'test.js');
      await manager.analyseFile(filePath);
      
      const symbols = manager.getAllSymbols();
      expect(symbols.size).toBeGreaterThan(0);
      
      const testClass = manager.findSymbol('TestClass');
      expect(testClass).toHaveLength(1);
      expect(testClass[0].name).toBe('TestClass');
    });
  });
});

describe('ResponseFormatter', () => {
  let formatter: ResponseFormatter;
  
  beforeAll(() => {
    formatter = new ResponseFormatter();
  });
  
  describe('format', () => {
    it('should format basic response correctly', () => {
      const response = formatter.format({
        summary: 'Test analysis complete',
        confidence: 0.95,
        critical: [
          {
            file: 'test.js',
            line: 42,
            operation: 'replace',
            code: 'const fixed = true;',
            validated: true
          }
        ],
        filesAnalyzed: 3
      });
      
      expect(response.summary).toBe('Test analysis complete');
      expect(response.confidence).toBe(0.95);
      expect(response.actions.critical).toHaveLength(1);
      expect(response.actions.critical[0].line).toBe(42);
      expect(response.metadata.filesAnalyzed).toBe(3);
      expect(response.metadata.tokensSaved).toBeGreaterThan(0);
    });
    
    it('should handle empty input gracefully', () => {
      const response = formatter.format({});
      
      expect(response.summary).toBe('Analysis complete');
      expect(response.confidence).toBe(0.8);
      expect(response.actions.critical).toHaveLength(0);
      expect(response.actions.recommended).toHaveLength(0);
      expect(response.actions.optional).toHaveLength(0);
    });
    
    it('should parse raw LLM response', () => {
      const rawResponse = `
# Analysis Results

Found critical issue at line 25: Missing null check
Confidence: 0.9

FIX at line 25: Add null check before accessing property
\`\`\`javascript
if (obj && obj.property) {
  return obj.property;
}
\`\`\`

RECOMMENDED at line 30: Improve variable naming
      `;
      
      const response = formatter.format({ rawResponse });
      
      expect(response.summary).toContain('Analysis Results');
      expect(response.confidence).toBe(0.9);
      expect(response.actions.critical.length).toBeGreaterThan(0);
    });
  });
  
  describe('formatAsMarkdown', () => {
    it('should generate valid markdown', () => {
      const response = formatter.format({
        summary: 'Test',
        critical: [{
          file: 'test.js',
          line: 10,
          operation: 'replace',
          code: 'fixed',
          validated: true
        }]
      });
      
      const markdown = formatter.formatAsMarkdown(response);
      
      expect(markdown).toContain('# Test');
      expect(markdown).toContain('## Critical Actions');
      expect(markdown).toContain('test.js:10');
      expect(markdown).toContain('```');
    });
  });
  
  describe('token calculation', () => {
    it('should estimate token savings correctly', () => {
      const response = formatter.format({
        filesAnalyzed: 5,
        critical: new Array(3).fill({
          file: 'test.js',
          line: 1,
          operation: 'replace',
          code: 'code',
          validated: true
        }),
        recommended: new Array(2).fill({
          file: 'test.js',
          line: 1,
          operation: 'insert',
          code: 'code',
          validated: true
        })
      });
      
      // 5 files * 500 tokens + 5 actions * 100 tokens
      expect(response.metadata.tokensSaved).toBe(3000);
    });
  });
});
