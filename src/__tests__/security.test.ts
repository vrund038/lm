import { jest } from '@jest/globals';
import { LocalLLMServer } from '../index-npm.js';
import { readFile, stat } from 'fs/promises';
import * as path from 'path';

// Mock all dependencies
jest.mock('fs/promises');
jest.mock('@lmstudio/sdk');
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: jest.fn().mockImplementation(() => ({
    setRequestHandler: jest.fn(),
    connect: jest.fn()
  }))
}));
jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}));
jest.mock('../config.js', () => ({
  config: {
    modelName: 'auto',
    supportedFileTypes: ['.txt', '.md', '.py', '.js', '.ts'],
    maxFileSize: 1024 * 1024, // 1MB
    temperature: 0.5,
    maxTokens: 100,
    topP: 0.9,
    lmStudioUrl: 'ws://localhost:1234',
    taskPrompts: {
      analyze_code_structure: {
        systemPrompt: 'You are a code analyzer',
        prompt: jest.fn().mockReturnValue('Analyze this code')
      },
      analyze_file: {
        systemPrompt: 'You are a file analyzer',
        prompt: jest.fn().mockReturnValue('Analyze this file')
      },
      analyze_csv_data: {
        systemPrompt: 'You are a CSV analyzer',
        prompt: jest.fn().mockReturnValue('Analyze this CSV')
      }
    }
  }
}));

describe('LocalLLMServer Security Tests', () => {
  let server: LocalLLMServer;
  let mockLMStudioClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment
    delete process.env.LLM_MCP_ALLOWED_DIRS;
    
    // Mock LMStudioClient
    const { LMStudioClient } = require('@lmstudio/sdk');
    mockLMStudioClient = {
      llm: {
        listLoaded: jest.fn().mockResolvedValue([
          { identifier: 'model-1', path: '/path/to/model' }
        ]),
        model: jest.fn().mockResolvedValue({
          respond: jest.fn().mockResolvedValue({ content: 'Test response' })
        })
      }
    };
    LMStudioClient.mockImplementation(() => mockLMStudioClient);
    
    server = new LocalLLMServer();
  });

  describe('Path Traversal Protection', () => {
    it('should reject relative paths', async () => {
      const mockStats = { size: 100 };
      (stat as jest.Mock).mockResolvedValue(mockStats);
      
      await expect(
        server['callLMStudio']('test', undefined, '../../../etc/passwd')
      ).rejects.toThrow('Invalid file path: Path must be absolute and within allowed directories');
    });

    it('should reject paths outside allowed directories', async () => {
      process.env.LLM_MCP_ALLOWED_DIRS = '/safe/directory';
      
      // Recreate server to pick up env change
      server = new LocalLLMServer();
      
      const mockStats = { size: 100 };
      (stat as jest.Mock).mockResolvedValue(mockStats);
      
      await expect(
        server['callLMStudio']('test', undefined, '/etc/passwd')
      ).rejects.toThrow('Invalid file path: Path must be absolute and within allowed directories');
    });

    it('should accept paths within allowed directories', async () => {
      process.env.LLM_MCP_ALLOWED_DIRS = '/safe/directory';
      
      // Mock path functions
      jest.spyOn(path, 'isAbsolute').mockReturnValue(true);
      jest.spyOn(path, 'resolve').mockReturnValue('/safe/directory/file.txt');
      jest.spyOn(path, 'normalize').mockReturnValue('/safe/directory/file.txt');
      jest.spyOn(path, 'extname').mockReturnValue('.txt');
      
      // Recreate server
      server = new LocalLLMServer();
      
      const mockStats = { size: 100 };
      (stat as jest.Mock).mockResolvedValue(mockStats);
      
      const result = await server['callLMStudio']('test', undefined, '/safe/directory/file.txt');
      expect(result).toBe('Test response');
    });

    it('should prevent directory traversal attacks', async () => {
      process.env.LLM_MCP_ALLOWED_DIRS = '/safe/directory';
      
      // Recreate server
      server = new LocalLLMServer();
      
      const attacks = [
        '/safe/directory/../../../etc/passwd',
        '/safe/directory/..\\..\\..\\windows\\system32',
        '/safe/directory/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '\\\\server\\share\\..\\..\\sensitive'
      ];
      
      for (const attack of attacks) {
        await expect(
          server['callLMStudio']('test', undefined, attack)
        ).rejects.toThrow('Invalid file path');
      }
    });
  });

  describe('File Size Limits', () => {
    it('should reject files larger than maxFileSize', async () => {
      process.env.LLM_MCP_ALLOWED_DIRS = process.cwd();
      
      jest.spyOn(path, 'isAbsolute').mockReturnValue(true);
      jest.spyOn(path, 'resolve').mockReturnValue(process.cwd() + '/large.txt');
      jest.spyOn(path, 'normalize').mockReturnValue(process.cwd() + '/large.txt');
      jest.spyOn(path, 'extname').mockReturnValue('.txt');
      
      // Recreate server
      server = new LocalLLMServer();
      
      const mockStats = { size: 2 * 1024 * 1024 }; // 2MB
      (stat as jest.Mock).mockResolvedValue(mockStats);
      
      await expect(
        server['callLMStudio']('test', undefined, process.cwd() + '/large.txt')
      ).rejects.toThrow('File too large');
    });
  });

  describe('File Type Validation', () => {
    it('should reject unsupported file types', async () => {
      process.env.LLM_MCP_ALLOWED_DIRS = process.cwd();
      
      jest.spyOn(path, 'isAbsolute').mockReturnValue(true);
      jest.spyOn(path, 'resolve').mockReturnValue(process.cwd() + '/file.exe');
      jest.spyOn(path, 'normalize').mockReturnValue(process.cwd() + '/file.exe');
      jest.spyOn(path, 'extname').mockReturnValue('.exe');
      
      // Recreate server
      server = new LocalLLMServer();
      
      await expect(
        server['callLMStudio']('test', undefined, process.cwd() + '/file.exe')
      ).rejects.toThrow('Unsupported file type: .exe');
    });
  });

  describe('Response Parsing', () => {
    it('should correctly remove thinking tags', () => {
      const input = 'Before<think>Internal thoughts</think>After';
      const result = server['parseModelResponse'](input);
      expect(result).toEqual({ content: 'BeforeAfter' });
    });

    it('should handle nested thinking tags', () => {
      const input = 'Start<think>Outer<think>Inner</think>thoughts</think>End';
      const result = server['parseModelResponse'](input);
      expect(result).toEqual({ content: 'StartEnd' });
    });

    it('should parse valid JSON after removing tags', () => {
      const input = '<think>Thinking</think>{"key": "value"}';
      const result = server['parseModelResponse'](input);
      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('Health Check Security', () => {
    it('should not expose model paths in non-detailed mode', async () => {
      const result = await server['checkStatus'](false);
      const text = result.content[0].text;
      
      expect(text).not.toContain('/path/to/model');
      expect(text).toContain('LM Studio is ready with 1 model(s) loaded');
    });

    it('should expose model paths only in detailed mode', async () => {
      const result = await server['checkStatus'](true);
      const text = result.content[0].text;
      const parsed = JSON.parse(text);
      
      expect(parsed.models[0].path).toBe('/path/to/model');
    });
  });

  describe('Error Handling', () => {
    it('should handle LM Studio connection errors gracefully', async () => {
      mockLMStudioClient.llm.listLoaded.mockRejectedValue(
        new Error('Connection refused')
      );
      
      const result = await server['checkStatus'](false);
      expect(result.content[0].text).toContain('LM Studio connection failed');
    });

    it('should handle file read errors securely', async () => {
      process.env.LLM_MCP_ALLOWED_DIRS = process.cwd();
      
      jest.spyOn(path, 'isAbsolute').mockReturnValue(true);
      jest.spyOn(path, 'resolve').mockReturnValue(process.cwd() + '/missing.txt');
      jest.spyOn(path, 'normalize').mockReturnValue(process.cwd() + '/missing.txt');
      
      // Recreate server
      server = new LocalLLMServer();
      
      (readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      
      await expect(
        server['readFileContent'](process.cwd() + '/missing.txt')
      ).rejects.toThrow('Failed to read file: ENOENT');
    });
  });

  describe('Input Validation', () => {
    it('should handle null/undefined file paths', async () => {
      await expect(
        server['callLMStudio']('test', undefined, null as any)
      ).resolves.toBe('Test response');
      
      await expect(
        server['callLMStudio']('test', undefined, undefined)
      ).resolves.toBe('Test response');
    });

    it('should validate file path is a string', async () => {
      await expect(
        server['callLMStudio']('test', undefined, 123 as any)
      ).rejects.toThrow('Invalid file path');
      
      await expect(
        server['callLMStudio']('test', undefined, {} as any)
      ).rejects.toThrow('Invalid file path');
    });
  });
});