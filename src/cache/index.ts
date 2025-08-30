/**
 * Cache System Exports
 * Centralized exports for all caching functionality
 */

// Core cache infrastructure
export { BaseCacheManager } from './cache-manager.js';
export type { CacheEntry, CacheConfig } from './cache-manager.js';

// Specialized cache implementations  
export { AnalysisCache } from './analysis-cache.js';
export type { AnalysisResult } from './analysis-cache.js';

export { PromptCache, MemoryCache } from './prompt-cache.js';
export type { PromptCacheEntry, MemoryEntry } from './prompt-cache.js';

// Import the classes for the convenience functions
import { AnalysisCache } from './analysis-cache.js';
import { PromptCache, MemoryCache } from './prompt-cache.js';

// Convenience exports for common usage patterns
export const getAnalysisCache = () => AnalysisCache.getInstance();
export const getPromptCache = () => PromptCache.getInstance();  
export const getMemoryCache = () => MemoryCache.getInstance();