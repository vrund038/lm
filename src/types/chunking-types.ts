/**
 * TypeScript interfaces and types for Context Window Management and Chunking
 * 
 * This file defines all the interfaces, types, and enums used by the
 * Context Window Manager and related components.
 */

/**
 * Health check result structure from health_check function
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  connection: 'established' | 'failed';
  lmStudioUrl: string;
  timestamp: string;
  details?: {
    loadedModels: Array<{
      path: string;
      identifier: string;
      architecture: string;
    }>;
    modelCount: number;
    hasActiveModel: boolean;
    serverInfo: {
      url: string;
      protocol: string;
    };
    activeModel?: {
      path: string;
      identifier: string;
      architecture: string;
    };
  };
}

/**
 * Context Window Manager configuration
 */
export interface ContextWindowConfig {
  contextLimit: number;           // Maximum tokens for the model
  safetyMargin: number;           // Percentage of context to use (0.8 = 80%)
  notificationThreshold?: number; // Token threshold for notifications
  enableUserNotifications?: boolean; // Enable user notifications
}

/**
 * Chunking strategy types
 */
export type ChunkingStrategyType = 
  | 'file-based'      // Split by files (for multi-file operations)
  | 'token-based'     // Split by token count
  | 'semantic'        // Split by semantic boundaries
  | 'sliding-window'  // Overlapping chunks
  | 'hierarchical';   // Tree-like chunking

/**
 * Individual chunk of data for processing
 */
export interface Chunk {
  id: string;
  data: any;
  metadata?: {
    [key: string]: any;
  };
}

/**
 * Plugin execution context for chunking operations
 */
export interface PluginExecutionContext {
  pluginName: string;
  originalParams: any;
  estimatedTokens: number;
  chunkingStrategy: ChunkingStrategyType;
  chunks: Chunk[];
}

/**
 * Chunking-specific error class
 */
export class ChunkingError extends Error {
  constructor(
    message: string,
    public readonly code: 'CHUNKING_FAILED' | 'STRATEGY_NOT_FOUND' | 'CHUNK_PROCESSING_FAILED',
    public readonly context?: any
  ) {
    super(message);
    this.name = 'ChunkingError';
  }
}

/**
 * Token estimation configuration
 */
export interface TokenEstimationConfig {
  averageTokensPerWord: number;    // Default: 1.3
  averageCharsPerToken: number;    // Default: 4
  estimationFactor: number;        // Safety factor: 1.2
  maxCacheSize: number;           // Max cached estimations: 1000
}
