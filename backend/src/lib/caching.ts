import Redis from 'ioredis';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // seconds
  key: string;
  strategy?: 'TTL' | 'LRU';
  maxSize?: number; // for LRU
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
}

/**
 * Redis cache wrapper with support for multiple strategies
 * TTL: Time-To-Live (automatic expiration)
 * LRU: Least Recently Used (size-based eviction)
 */
export class CacheManager {
  private redis: Redis;
  private stats: CacheStats = { hits: 0, misses: 0, evictions: 0 };
  private maxMemory: number = 100 * 1024 * 1024; // 100MB default

  // Cache key prefixes for organization
  static readonly PREFIXES = {
    PRODUCT: 'cache:product:',
    INVENTORY: 'cache:inventory:',
    SALE: 'cache:sale:',
    USER: 'cache:user:',
    REPORT: 'cache:report:',
    SESSION: 'cache:session:',
  };

  // Default TTLs (in seconds)
  static readonly TTLs = {
    PRODUCT: 3600, // 1 hour - products change infrequently
    INVENTORY: 300, // 5 minutes - high volatility
    SALE: 3600, // 1 hour
    REPORT: 3600, // 1 hour - heavy computation
    USER_DATA: 300, // 5 minutes - security
    AUDIT_LOG: 0, // no cache - compliance
    SESSION: 1800, // 30 minutes
  };

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      retryStrategy: () => null,
      enableOfflineQueue: false,
    });

    this.redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      logger.info('Redis cache connected');
    });
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        this.stats.hits++;
        return JSON.parse(value) as T;
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl > 0) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        // No expiration if ttl is 0
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  /**
   * Set with options (TTL or LRU strategy)
   */
  async setWithOptions<T>(value: T, options: CacheOptions): Promise<void> {
    try {
      const serialized = JSON.stringify(value);

      if (options.strategy === 'LRU') {
        // For LRU, just use SETEX with a very long TTL
        // and rely on max-memory-policy for eviction
        await this.redis.setex(options.key, options.ttl || 86400, serialized);
      } else {
        // TTL strategy (default)
        if (options.ttl && options.ttl > 0) {
          await this.redis.setex(options.key, options.ttl, serialized);
        } else {
          await this.redis.set(options.key, serialized);
        }
      }
    } catch (error) {
      logger.error('Cache setWithOptions error:', error);
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  /**
   * Delete multiple keys
   */
  async deleteMultiple(keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.error('Cache deleteMultiple error:', error);
    }
  }

  /**
   * Clear all keys with a specific prefix
   */
  async clearPrefix(prefix: string): Promise<void> {
    try {
      const keys = await this.redis.keys(`${prefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      logger.error('Cache clearPrefix error:', error);
    }
  }

  /**
   * Invalidate cache on data change
   * Clears related cache entries
   */
  async invalidateOnChange(entityType: string, entityId?: string): Promise<void> {
    try {
      const pattern = entityId ? `cache:${entityType}:${entityId}` : `cache:${entityType}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
        logger.debug(`Invalidated ${keys.length} cache entries for ${entityType}`);
      }
    } catch (error) {
      logger.error('Cache invalidation error:', error);
    }
  }

  /**
   * Get or compute value (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    try {
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      const value = await fn();
      await this.set(key, value, ttl);
      return value;
    } catch (error) {
      logger.error('Cache getOrSet error:', error);
      // Fallback to computing value without caching
      return fn();
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get TTL of key
   */
  async getTTL(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      logger.error('Cache getTTL error:', error);
      return -1;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Get Redis info (memory usage, etc.)
   */
  async getInfo(): Promise<any> {
    try {
      return await this.redis.info();
    } catch (error) {
      logger.error('Cache getInfo error:', error);
      return null;
    }
  }

  /**
   * Flush all cache
   */
  async flush(): Promise<void> {
    try {
      await this.redis.flushdb();
      logger.info('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error);
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      await this.redis.quit();
    } catch (error) {
      logger.error('Cache close error:', error);
    }
  }
}

// Singleton instance
let cacheManager: CacheManager | null = null;

export function getCacheManager(): CacheManager {
  if (!cacheManager) {
    cacheManager = new CacheManager();
  }
  return cacheManager;
}

export async function initCache(): Promise<CacheManager> {
  cacheManager = new CacheManager();
  await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for connection
  return cacheManager;
}
