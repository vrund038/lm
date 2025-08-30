/**
 * Analysis Result Cache
 * Specialized caching for plugin analysis results
 */

import { BaseCacheManager, CacheConfig } from './cache-manager.js';

export interface AnalysisResult {
  summary: string;
  findings?: any[];
  data?: any;
  metadata?: {
    modelUsed: string;
    executionTime: number;
    timestamp: string;
  };
}

export class AnalysisCache extends BaseCacheManager<AnalysisResult> {
  private static instance: AnalysisCache;

  constructor(config?: Partial<CacheConfig>) {
    super({
      maxEntries: 50,  // Smaller cache for analysis results
      ttlMs: 30 * 60 * 1000,  // 30 minutes TTL
      enableStats: true,
      ...config
    });
  }

  static getInstance(config?: Partial<CacheConfig>): AnalysisCache {
    if (!this.instance) {
      this.instance = new AnalysisCache(config);
    }
    return this.instance;
  }

  /**
   * Generate cache key for analysis results
   */
  generateKey(
    functionName: string,
    params: any,
    fileHashes?: string[]
  ): string {
    const paramHash = this.hashObject(params);
    const filesHash = fileHashes ? fileHashes.join('|') : '';
    
    return `${functionName}:${paramHash}:${filesHash}`.substring(0, 128);
  }

  /**
   * Cache analysis result with metadata
   */
  async cacheAnalysis(
    key: string,
    result: AnalysisResult,
    metadata: AnalysisResult['metadata']
  ): Promise<void> {
    const enrichedResult = {
      ...result,
      metadata: {
        ...metadata,
        cachedAt: new Date().toISOString()
      }
    };

    await this.set(key, enrichedResult);
  }

  /**
   * Simple hash function for cache keys
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
}