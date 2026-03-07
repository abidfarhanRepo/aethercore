"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.closeRedisClient = closeRedisClient;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../utils/logger");
let client = null;
let initPromise = null;
async function initRedis() {
    try {
        const redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379', {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            connectTimeout: 5000,
        });
        redis.on('error', (error) => {
            logger_1.logger.warn({ error }, 'Redis client error');
        });
        await redis.connect();
        logger_1.logger.info('Redis client initialized');
        return redis;
    }
    catch (error) {
        logger_1.logger.warn({ error }, 'Redis unavailable; idempotency fallback will be used');
        return null;
    }
}
async function getRedisClient() {
    if (client) {
        return client;
    }
    if (!initPromise) {
        initPromise = initRedis();
    }
    client = await initPromise;
    return client;
}
async function closeRedisClient() {
    if (!client) {
        return;
    }
    try {
        await client.quit();
    }
    catch (error) {
        logger_1.logger.warn({ error }, 'Failed to close Redis client cleanly');
    }
    finally {
        client = null;
        initPromise = null;
    }
}
