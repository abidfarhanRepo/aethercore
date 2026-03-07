"use strict";
/**
 * Idempotency tracking for safe retries
 * Ensures duplicate requests return the same result
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdempotencyService = void 0;
exports.checkIdempotency = checkIdempotency;
exports.saveIdempotency = saveIdempotency;
exports.clearIdempotency = clearIdempotency;
const redis_1 = require("../lib/redis");
const logger_1 = require("./logger");
const FALLBACK_TTL_SECONDS = 86400;
const fallbackCache = new Map();
function getCacheKey(key) {
    return `idempotency:${key}`;
}
function pruneFallback(key, entry) {
    if (entry && entry.expiresAt <= Date.now()) {
        fallbackCache.delete(key);
    }
}
async function checkIdempotency(key) {
    if (!key) {
        return { exists: false };
    }
    const redis = await (0, redis_1.getRedisClient)();
    if (redis) {
        try {
            const raw = await redis.get(getCacheKey(key));
            if (!raw) {
                return { exists: false };
            }
            return {
                exists: true,
                result: JSON.parse(raw),
            };
        }
        catch (error) {
            logger_1.logger.warn({ error, key }, 'Redis idempotency read failed; trying fallback');
        }
    }
    const fallback = fallbackCache.get(key);
    pruneFallback(key, fallback);
    if (!fallbackCache.has(key)) {
        return { exists: false };
    }
    return {
        exists: true,
        result: fallback?.value,
    };
}
async function saveIdempotency(key, result, ttlSeconds = FALLBACK_TTL_SECONDS) {
    if (!key) {
        return;
    }
    const redis = await (0, redis_1.getRedisClient)();
    if (redis) {
        try {
            await redis.set(getCacheKey(key), JSON.stringify(result), 'EX', ttlSeconds);
            return;
        }
        catch (error) {
            logger_1.logger.warn({ error, key }, 'Redis idempotency write failed; using fallback');
        }
    }
    fallbackCache.set(key, {
        value: result,
        expiresAt: Date.now() + ttlSeconds * 1000,
    });
}
async function clearIdempotency(key) {
    const redis = await (0, redis_1.getRedisClient)();
    if (redis) {
        try {
            await redis.del(getCacheKey(key));
        }
        catch (error) {
            logger_1.logger.warn({ error, key }, 'Redis idempotency clear failed');
        }
    }
    fallbackCache.delete(key);
}
class IdempotencyService {
    /**
     * Generate idempotency key for a request
     */
    static generateKey(operationId) {
        return operationId;
    }
    /**
     * Store operation result for idempotency
     */
    static async storeResult(operationId, result, serverId, data) {
        void serverId;
        await saveIdempotency(operationId, result ?? data);
    }
    /**
     * Get cached result for operation
     */
    static async getResult(operationId) {
        const cached = await checkIdempotency(operationId);
        return cached.exists ? cached.result : null;
    }
    /**
     * Mark operation as processed
     */
    static async markProcessed(operationId) {
        logger_1.logger.debug({ operationId }, 'markProcessed is implicit with cached result');
    }
}
exports.IdempotencyService = IdempotencyService;
exports.default = IdempotencyService;
