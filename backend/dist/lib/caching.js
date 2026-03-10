"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
exports.getCacheManager = getCacheManager;
exports.initCache = initCache;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
/**
 * Redis cache wrapper with support for multiple strategies
 * TTL: Time-To-Live (automatic expiration)
 * LRU: Least Recently Used (size-based eviction)
 */
class CacheManager {
    constructor(redisUrl) {
        this.stats = { hits: 0, misses: 0, evictions: 0 };
        this.maxMemory = 100 * 1024 * 1024; // 100MB default
        this.redis = new ioredis_1.default(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379', {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
            retryStrategy: () => null,
            enableOfflineQueue: false,
        });
        this.redis.on('error', (err) => {
            logger_1.logger.error('Redis connection error:', err);
        });
        this.redis.on('connect', () => {
            logger_1.logger.info('Redis cache connected');
        });
    }
    /**
     * Get value from cache
     */
    async get(key) {
        try {
            const value = await this.redis.get(key);
            if (value) {
                this.stats.hits++;
                return JSON.parse(value);
            }
            this.stats.misses++;
            return null;
        }
        catch (error) {
            logger_1.logger.error('Cache get error:', error);
            return null;
        }
    }
    /**
     * Set value in cache with TTL
     */
    async set(key, value, ttl = 3600) {
        try {
            const serialized = JSON.stringify(value);
            if (ttl > 0) {
                await this.redis.setex(key, ttl, serialized);
            }
            else {
                // No expiration if ttl is 0
                await this.redis.set(key, serialized);
            }
        }
        catch (error) {
            logger_1.logger.error('Cache set error:', error);
        }
    }
    /**
     * Set with options (TTL or LRU strategy)
     */
    async setWithOptions(value, options) {
        try {
            const serialized = JSON.stringify(value);
            if (options.strategy === 'LRU') {
                // For LRU, just use SETEX with a very long TTL
                // and rely on max-memory-policy for eviction
                await this.redis.setex(options.key, options.ttl || 86400, serialized);
            }
            else {
                // TTL strategy (default)
                if (options.ttl && options.ttl > 0) {
                    await this.redis.setex(options.key, options.ttl, serialized);
                }
                else {
                    await this.redis.set(options.key, serialized);
                }
            }
        }
        catch (error) {
            logger_1.logger.error('Cache setWithOptions error:', error);
        }
    }
    /**
     * Delete key from cache
     */
    async delete(key) {
        try {
            await this.redis.del(key);
        }
        catch (error) {
            logger_1.logger.error('Cache delete error:', error);
        }
    }
    /**
     * Delete multiple keys
     */
    async deleteMultiple(keys) {
        try {
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        }
        catch (error) {
            logger_1.logger.error('Cache deleteMultiple error:', error);
        }
    }
    /**
     * Clear all keys with a specific prefix
     */
    async clearPrefix(prefix) {
        try {
            const keys = await this.redis.keys(`${prefix}*`);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        }
        catch (error) {
            logger_1.logger.error('Cache clearPrefix error:', error);
        }
    }
    /**
     * Invalidate cache on data change
     * Clears related cache entries
     */
    async invalidateOnChange(entityType, entityId) {
        try {
            const pattern = entityId ? `cache:${entityType}:${entityId}` : `cache:${entityType}:*`;
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
                logger_1.logger.debug(`Invalidated ${keys.length} cache entries for ${entityType}`);
            }
        }
        catch (error) {
            logger_1.logger.error('Cache invalidation error:', error);
        }
    }
    /**
     * Get or compute value (cache-aside pattern)
     */
    async getOrSet(key, fn, ttl = 3600) {
        try {
            const cached = await this.get(key);
            if (cached !== null) {
                return cached;
            }
            const value = await fn();
            await this.set(key, value, ttl);
            return value;
        }
        catch (error) {
            logger_1.logger.error('Cache getOrSet error:', error);
            // Fallback to computing value without caching
            return fn();
        }
    }
    /**
     * Check if key exists
     */
    async exists(key) {
        try {
            const result = await this.redis.exists(key);
            return result === 1;
        }
        catch (error) {
            logger_1.logger.error('Cache exists error:', error);
            return false;
        }
    }
    /**
     * Get TTL of key
     */
    async getTTL(key) {
        try {
            return await this.redis.ttl(key);
        }
        catch (error) {
            logger_1.logger.error('Cache getTTL error:', error);
            return -1;
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats = { hits: 0, misses: 0, evictions: 0 };
    }
    /**
     * Get Redis info (memory usage, etc.)
     */
    async getInfo() {
        try {
            return await this.redis.info();
        }
        catch (error) {
            logger_1.logger.error('Cache getInfo error:', error);
            return null;
        }
    }
    /**
     * Flush all cache
     */
    async flush() {
        try {
            await this.redis.flushdb();
            logger_1.logger.info('Cache flushed');
        }
        catch (error) {
            logger_1.logger.error('Cache flush error:', error);
        }
    }
    /**
     * Close Redis connection
     */
    async close() {
        try {
            await this.redis.quit();
        }
        catch (error) {
            logger_1.logger.error('Cache close error:', error);
        }
    }
}
exports.CacheManager = CacheManager;
// Cache key prefixes for organization
CacheManager.PREFIXES = {
    PRODUCT: 'cache:product:',
    INVENTORY: 'cache:inventory:',
    SALE: 'cache:sale:',
    USER: 'cache:user:',
    REPORT: 'cache:report:',
    SESSION: 'cache:session:',
};
// Default TTLs (in seconds)
CacheManager.TTLs = {
    PRODUCT: 3600, // 1 hour - products change infrequently
    INVENTORY: 300, // 5 minutes - high volatility
    SALE: 3600, // 1 hour
    REPORT: 3600, // 1 hour - heavy computation
    USER_DATA: 300, // 5 minutes - security
    AUDIT_LOG: 0, // no cache - compliance
    SESSION: 1800, // 30 minutes
};
// Singleton instance
let cacheManager = null;
function getCacheManager() {
    if (!cacheManager) {
        cacheManager = new CacheManager();
    }
    return cacheManager;
}
async function initCache() {
    cacheManager = new CacheManager();
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for connection
    return cacheManager;
}
