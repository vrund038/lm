import { jest } from '@jest/globals';
import { LocalLLMServer } from '../src/index-npm.js';
import { TaskType } from '../src/types-secure.js';
import path from 'path';

// Mock dependencies
jest.mock('@lmstudio/sdk');
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');
jest.mock('fs/promises');

describe('LocalLLMServer', () => {
  let server: LocalLLMServer;
  let mockLMStudioClient: any;
  let mockConfig: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock config
    mockConfig = {
      modelName: 'auto',
      allowedDirectories: ['/allowed/path'],
      supportedFileTypes: ['.js', '.ts', '.py'],
      maxFileSize: 1024 * 1024, // 1MB
      temperature: 0.1,
      maxTokens: 2000,
      lmStudioUrl: 'ws://localhost:1234',
      taskPrompts: {
        [TaskType.CODE_STRUCTURE]: {
          systemPrompt: 'You are a code analyzer',
          prompt: (content: string) => `Analyze: ${content}`
        }
      }
    };

    // Mock LMStudioClient
    mockLMStudioClient = {
      llm: {
        listLoaded: jest.fn(),
        model: jest.fn()
      }
    };

    // Override config import
    jest.doMock('../src/config.js', () => ({ config: mockConfig }));
  });

  describe('validateFilePath', () => {
    it('should accept absolute paths within allowed directories', () => {
      const server = new LocalLLMServer();
      const safePath = '/allowed/path/file.js';
      
      // Access private method via reflection for testing
      const validateMethod = (server as any).validateFilePath.bind(server);
      
      expect(() => validateMethod(safePath, ['/allowed/path'])).not.toThrow();
    });

    it('should reject paths with directory traversal', () => {
      const server = new LocalLLMServer();
      const unsafePath = '/allowed/path/../../../etc/passwd';
      
      const validateMethod = (server as any).validateFilePath.bind(server);
      
      expect(() => validateMethod(unsafePath, ['/allowed/path']))
        .toThrow('Access denied: Path is outside allowed directories');
    });

    it('should reject relative paths', () => {
      const server = new LocalLLMServer();
      const relativePath = '../file.js';
      
      const validateMethod = (server as any).validateFilePath.bind(server);
      
      expect(() => validateMethod(relativePath, ['/allowed/path']))
        .toThrow('Path must be absolute');
    });

    it('should reject paths outside allowed directories', () => {
      const server = new LocalLLMServer();
      const outsidePath = '/not/allowed/file.js';
      
      const validateMethod = (server as any).validateFilePath.bind(server);
      
      expect(() => validateMethod(outsidePath, ['/allowed/path']))
        .toThrow('Access denied: Path is outside allowed directories');
    });
  });

  describe('parseModelResponse', () => {
    it('should remove think tags from response', () => {
      const server = new LocalLLMServer();
      const response = '<think>Internal thoughts</think>{"result": "clean"}';
      
      const parseMethod = (server as any).parseModelResponse.bind(server);
      const result = parseMethod(response);
      
      expect(result).toEqual({ result: 'clean' });
    });

    it('should handle non-JSON responses', () => {
      const server = new LocalLLMServer();
      const response = 'This is plain text';
      
      const parseMethod = (server as any).parseModelResponse.bind(server);
      const result = parseMethod(response);
      
      expect(result).toEqual({ content: 'This is plain text' });
    });
  });

  describe('Security Features', () => {
    it('should prevent reading files outside allowed directories', async () => {
      const server = new LocalLLMServer();
      const maliciousPath = '/etc/passwd';
      
      const readMethod = (server as any).readFileContent.bind(server);
      
      await expect(readMethod(maliciousPath))
        .rejects.toThrow('Access denied: Path is outside allowed directories');
    });

    it('should normalize paths to prevent traversal attacks', () => {
      const server = new LocalLLMServer();
      const traversalPath = '/allowed/path/../../etc/passwd';
      
      const validateMethod = (server as any).validateFilePath.bind(server);
      
      expect(() => validateMethod(traversalPath, ['/allowed/path']))
        .toThrow('Access denied: Path is outside allowed directories');
    });
  });

  describe('NPM Package Structure', () => {
    it('should export LocalLLMServer class', () => {
      expect(LocalLLMServer).toBeDefined();
      expect(typeof LocalLLMServer).toBe('function');
    });

    it('should have proper TypeScript types', () => {
      const server = new LocalLLMServer();
      expect(server).toBeInstanceOf(LocalLLMServer);
      expect(typeof (server as any).start).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('should handle LM Studio connection errors gracefully', async () => {
      const server = new LocalLLMServer();
      const error = new Error('ECONNREFUSED');
      (error as any).code = 'ECONNREFUSED';
      
      mockLMStudioClient.llm.listLoaded.mockRejectedValue(error);
      
      const callMethod = (server as any).callLMStudio.bind(server);
      
      await expect(callMethod('test prompt'))
        .rejects.toThrow('LM Studio is not running. Please start LM Studio and load a model.');
    });

    it('should handle unsupported file types', async () => {
      const server = new LocalLLMServer();
      const unsupportedFile = '/allowed/path/file.exe';
      
      const callMethod = (server as any).callLMStudio.bind(server);
      
      await expect(callMethod('test', undefined, unsupportedFile))
        .rejects.toThrow('Unsupported file type: .exe');
    });

    it('should handle file size limits', async () => {
      const server = new LocalLLMServer();
      const largeFile = '/allowed/path/large.js';
      
      // Mock file stats
      const mockStats = { size: 2 * 1024 * 1024 }; // 2MB
      jest.doMock('fs', () => ({
        promises: {
          stat: jest.fn().mockResolvedValue(mockStats)
        }
      }));
      
      const callMethod = (server as any).callLMStudio.bind(server);
      
      await expect(callMethod('test', undefined, largeFile))
        .rejects.toThrow('File too large: 2097152 bytes. Maximum size: 1048576 bytes');
    });
  });
});