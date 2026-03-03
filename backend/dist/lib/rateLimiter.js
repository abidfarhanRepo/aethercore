"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginRateLimiter = exports.apiKeyRateLimiter = exports.ipRateLimiter = exports.userRateLimiter = exports.RedisRateLimiter = void 0;
exports.checkRateLimits = checkRateLimits;
exports.rateLimiterHook = rateLimiterHook;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
class RedisRateLimiter {
    constructor(config, redisUrl) {
        this.config = {
            keyPrefix: 'rate-limit:',
            ...config,
        };
        // Skip Redis initialization if disabled or in development
        const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
        if (!REDIS_DISABLED && process.env.NODE_ENV !== 'development') {
            this.redis = new ioredis_1.default(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
            this.redis.on('error', (err) => {
                logger_1.logger.error('Redis rate limiter error:', err);
            });
        }
        else {
            this.redis = null;
        }
    }
    /**
     * Check if request should be allowed using token bucket algorithm
     */
    async isAllowed(key) {
        // If Redis not available, allow all requests (fail open)
        if (!this.redis) {
            return {
                allowed: true,
                limit: this.config.maxRequests,
                current: 0,
                remainingMs: 0,
            };
        }
        const fullKey = `${this.config.keyPrefix}${key}`;
        const now = Date.now();
        try {
            // Use Lua script for atomic operation
            const result = await this.redis.eval(`
          local key = KEYS[1]
          local limit = tonumber(ARGV[1])
          local window = tonumber(ARGV[2])
          local current_time = tonumber(ARGV[3])

          local current = tonumber(redis.call('GET', key) or 0)
          local expires_at = tonumber(redis.call('PTTL', key))

          if expires_at <= 0 then
            -- First request in window
            redis.call('SETEX', key, math.ceil(window / 1000), 1)
            return {1, limit, 1, window}
          elseif current < limit then
            -- Increment counter
            redis.call('INCR', key)
            return {1, limit, current + 1, expires_at}
          else
            -- Rate limit exceeded
            return {0, limit, current, expires_at}
          end
        `, 1, fullKey, this.config.maxRequests, this.config.windowMs, now);
            const [allowed, limit, current, remainingMs] = result;
            return {
                allowed: allowed === 1,
                limit,
                current,
                remainingMs,
                retryAfter: allowed === 0 ? Math.ceil(remainingMs / 1000) : undefined,
            };
        }
        catch (error) {
            logger_1.logger.error('Rate limiter error:', error);
            // In case of Redis error, allow request (fail open)
            return {
                allowed: true,
                limit: this.config.maxRequests,
                current: 0,
                remainingMs: 0,
            };
        }
    }
    /**
     * Reset rate limit for a key
     */
    async reset(key) {
        if (!this.redis)
            return;
        const fullKey = `${this.config.keyPrefix}${key}`;
        await this.redis.del(fullKey);
    }
    /**
     * Get current count for a key
     */
    async getCount(key) {
        if (!this.redis)
            return 0;
        const fullKey = `${this.config.keyPrefix}${key}`;
        const count = await this.redis.get(fullKey);
        return count ? parseInt(count, 10) : 0;
    }
    /**
     * Close Redis connection
     */
    async close() {
        if (!this.redis)
            return;
        await this.redis.quit();
    }
}
exports.RedisRateLimiter = RedisRateLimiter;
/**
 * Rate limiter instances for different use cases
 */
// Per-user rate limiting - generous for logged-in users
exports.userRateLimiter = new RedisRateLimiter({
    maxRequests: 1000, // 1000 requests
    windowMs: 60 * 1000, // per minute
    keyPrefix: 'rate-limit:user:',
});
// Per-IP rate limiting - stricter for public endpoints
exports.ipRateLimiter = new RedisRateLimiter({
    maxRequests: 100, // 100 requests
    windowMs: 60 * 1000, // per minute
    keyPrefix: 'rate-limit:ip:',
});
// Per-API key rate limiting
exports.apiKeyRateLimiter = new RedisRateLimiter({
    maxRequests: 10000, // 10000 requests
    windowMs: 60 * 1000, // per minute
    keyPrefix: 'rate-limit:api-key:',
});
// Login rate limiting - very strict
exports.loginRateLimiter = new RedisRateLimiter({
    maxRequests: 5, // 5 attempts
    windowMs: 15 * 60 * 1000, // per 15 minutes
    keyPrefix: 'rate-limit:login:',
});
/**
 * Check multiple rate limiters (e.g., user + IP)
 */
async function checkRateLimits(userId, ipAddress) {
    // Check user limit
    if (userId) {
        const userResult = await exports.userRateLimiter.isAllowed(userId);
        if (!userResult.allowed) {
            return {
                allowed: false,
                failedLimiter: 'user',
                result: userResult,
            };
        }
    }
    // Check IP limit
    if (ipAddress) {
        const ipResult = await exports.ipRateLimiter.isAllowed(ipAddress);
        if (!ipResult.allowed) {
            return {
                allowed: false,
                failedLimiter: 'ip',
                result: ipResult,
            };
        }
    }
    return { allowed: true };
}
/**
 * Fastify rate limiter hook
 */
async function rateLimiterHook(fastify, options) {
    fastify.addHook('onRequest', async (request, reply) => {
        const userId = request.user?.id;
        const ipAddress = request.ip;
        const result = await checkRateLimits(userId, ipAddress);
        if (!result.allowed && result.result) {
            reply.code(429);
            reply.header('retry-after', result.result.retryAfter);
            reply.header('x-ratelimit-limit', result.result.limit);
            reply.header('x-ratelimit-remaining', result.result.limit - result.result.current);
            reply.header('x-ratelimit-reset', Math.ceil(Date.now() / 1000 + result.result.remainingMs / 1000));
            return reply.send({
                error: 'Too many requests',
                message: `Rate limit exceeded. Retry after ${result.result.retryAfter} seconds`,
                retryAfter: result.result.retryAfter,
            });
        }
        if (result.result) {
            reply.header('x-ratelimit-limit', result.result.limit);
            reply.header('x-ratelimit-remaining', result.result.limit - result.result.current);
        }
    });
}
