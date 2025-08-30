/**
 * Core Cache Manager
 * Foundation for all caching functionality - analysis, prompts, memory, etc.
 */

export interface CacheEntry<T = any> {
  value: T;
  timestamp: number;
  hits: number;
  size?: number;
}

export interface CacheConfig {
  maxEntries: number;
  ttlMs?: number;
  enableStats: boolean;
}

export abstract class BaseCacheManager<T = any> {
  protected cache: Map<string, CacheEntry<T>> = new Map();
  protected config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxEntries: 100,
      ttlMs: undefined, // No TTL by default
      enableStats: true,
      ...config
    };
  }

  protected isExpired(entry: CacheEntry<T>): boolean {
    if (!this.config.ttlMs) return false;
    return (Date.now() - entry.timestamp) > this.config.ttlMs;
  }

  protected evictIfNeeded(): void {
    if (this.cache.size <= this.config.maxEntries) return;

    // Simple FIFO eviction - remove oldest entry
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }

  protected createEntry(value: T): CacheEntry<T> {
    return {
      value,
      timestamp: Date.now(),
      hits: 0,
      size: this.estimateSize(value)
    };
  }

  protected estimateSize(value: T): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }
    
    // Update hit count for stats
    entry.hits++;
    
    return entry.value;
  }

  async set(key: string, value: T): Promise<void> {
    this.evictIfNeeded();
    const entry = this.createEntry(value);
    this.cache.set(key, entry);
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  getStatistics(): any {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + (entry.size || 0), 0);
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);

    return {
      totalEntries: this.cache.size,
      maxEntries: this.config.maxEntries,
      memoryUsage: `${(totalSize / 1024).toFixed(2)} KB`,
      totalHits,
      avgHitsPerEntry: entries.length > 0 ? (totalHits / entries.length).toFixed(1) : 0,
      oldestEntry: entries.length > 0 ? new Date(Math.min(...entries.map(e => e.timestamp))) : null,
      config: this.config
    };
  }
}