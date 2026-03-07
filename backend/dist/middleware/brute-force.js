"use strict";
/**
 * Brute force protection middleware
 * Tracks failed login attempts by IP and username
 * Uses Redis for high performance and distributed support
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordFailedAttempt = recordFailedAttempt;
exports.isLockedOut = isLockedOut;
exports.resetFailedAttempts = resetFailedAttempts;
exports.getAttemptCount = getAttemptCount;
exports.bruteForceProtection = bruteForceProtection;
exports.onLoginSuccess = onLoginSuccess;
exports.onLoginFailure = onLoginFailure;
exports.getExponentialBackoff = getExponentialBackoff;
exports.clearAllBruteForceRecords = clearAllBruteForceRecords;
exports.getBruteForceStats = getBruteForceStats;
const ioredis_1 = __importDefault(require("ioredis"));
// Allow Redis to be disabled for development
const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true';
let redis = null;
// Only initialize Redis if not disabled and not in development
if (!REDIS_DISABLED && process.env.NODE_ENV !== 'development') {
    redis = new ioredis_1.default(process.env.REDIS_URL || 'redis://localhost:6379');
    redis.on('error', (err) => {
        console.warn('Redis client error:', err);
        // Gracefully degrade if Redis fails
    });
}
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes
const RESET_AFTER = 24 * 60 * 60; // 24 hours
/**
 * Get brute force key for tracking
 */
function getBruteForceKey(identifier, type) {
    const prefix = type === 'ip' ? 'bruteforce:ip' : 'bruteforce:user';
    return `${prefix}:${identifier}`;
}
/**
 * Record a failed attempt
 */
async function recordFailedAttempt(identifier, type = 'ip', config = {}) {
    // Skip Redis operations if disabled
    if (!redis) {
        return {
            attempts: 1,
            locked: false,
        };
    }
    const maxAttempts = config.maxAttempts || MAX_ATTEMPTS;
    const lockoutDuration = config.lockoutDuration || LOCKOUT_DURATION;
    const key = getBruteForceKey(identifier, type);
    try {
        // Increment failed attempts
        const attempts = await redis.incr(key);
        // Set expiration if first attempt
        if (attempts === 1) {
            await redis.expire(key, config.resetAfter || RESET_AFTER);
        }
        // Lock if max attempts exceeded
        const locked = attempts >= maxAttempts;
        if (locked) {
            // Set lock key
            const lockKey = `${key}:locked`;
            await redis.setex(lockKey, lockoutDuration, '1');
            // Return wait time in seconds
            const ttl = await redis.ttl(lockKey);
            return {
                attempts,
                locked: true,
                waitTime: ttl > 0 ? ttl : lockoutDuration,
            };
        }
        return {
            attempts,
            locked: false,
        };
    }
    catch (error) {
        console.error('Failed to record failed attempt:', error);
        // Fail open - don't block on Redis errors
        return {
            attempts: 1,
            locked: false,
        };
    }
}
/**
 * Check if an identifier is locked out
 */
async function isLockedOut(identifier, type = 'ip') {
    // Skip Redis operations if disabled
    if (!redis) {
        return { locked: false };
    }
    const key = getBruteForceKey(identifier, type);
    const lockKey = `${key}:locked`;
    try {
        const locked = await redis.exists(lockKey);
        if (locked) {
            const ttl = await redis.ttl(lockKey);
            return {
                locked: true,
                waitTime: ttl > 0 ? ttl : 0,
            };
        }
        return { locked: false };
    }
    catch (error) {
        console.error('Failed to check lockout status:', error);
        // Fail open - don't block on Redis errors
        return { locked: false };
    }
}
/**
 * Reset failed attempts for an identifier
 */
async function resetFailedAttempts(identifier, type = 'ip') {
    // Skip Redis operations if disabled
    if (!redis) {
        return;
    }
    const key = getBruteForceKey(identifier, type);
    const lockKey = `${key}:locked`;
    try {
        await redis.del(key, lockKey);
    }
    catch (error) {
        console.error('Failed to reset failed attempts:', error);
    }
}
/**
 * Get current failed attempts count
 */
async function getAttemptCount(identifier, type = 'ip') {
    // Skip Redis operations if disabled
    if (!redis) {
        return 0;
    }
    const key = getBruteForceKey(identifier, type);
    try {
        const count = await redis.get(key);
        return parseInt(count || '0', 10);
    }
    catch (error) {
        console.error('Failed to get attempt count:', error);
        return 0;
    }
}
/**
 * Brute force protection middleware for login endpoints
 */
async function bruteForceProtection(request, reply, config = {}) {
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    // Check if IP is locked out
    const ipLockout = await isLockedOut(ip, 'ip');
    if (ipLockout.locked) {
        reply.code(429).send({
            error: 'Too many failed attempts',
            message: `Please wait ${ipLockout.waitTime} seconds before trying again`,
            retryAfter: ipLockout.waitTime,
        });
        return;
    }
}
/**
 * Middleware to handle login success (reset counter)
 */
async function onLoginSuccess(identifier, request) {
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    // Reset failed attempts for both IP and user
    await resetFailedAttempts(ip, 'ip');
    await resetFailedAttempts(identifier, 'user');
}
/**
 * Middleware to handle login failure (track attempt)
 */
async function onLoginFailure(identifier, request) {
    const ip = request.ip || request.socket?.remoteAddress || 'unknown';
    // Track failed attempt for both IP and user
    const ipResult = await recordFailedAttempt(ip, 'ip');
    const userResult = await recordFailedAttempt(identifier, 'user');
    // Return lock status based on whichever is more restrictive
    if (ipResult.locked || userResult.locked) {
        return {
            locked: true,
            waitTime: Math.max(ipResult.waitTime || 0, userResult.waitTime || 0),
        };
    }
    return {
        locked: false,
    };
}
/**
 * Exponential backoff calculation for retry
 */
function getExponentialBackoff(attemptNumber) {
    // backoff = min(maxWait, initialDelay * 2^attemptNumber) + random jitter
    const initialDelay = 1; // 1 second
    const maxWait = 3600; // 1 hour max
    const jitter = Math.random() * 1000; // 0-1 second jitter
    const waitTime = Math.min(maxWait, initialDelay * Math.pow(2, attemptNumber - 1)) * 1000;
    return (waitTime + jitter) / 1000; // Return in seconds
}
/**
 * Clear all brute force records (admin function)
 */
async function clearAllBruteForceRecords() {
    try {
        if (!redis) {
            return;
        }
        const keys = await redis.keys('bruteforce:*');
        if (keys.length > 0) {
            await redis.del(...keys);
        }
    }
    catch (error) {
        console.error('Failed to clear brute force records:', error);
    }
}
/**
 * Get brute force statistics for monitoring
 */
async function getBruteForceStats() {
    try {
        if (!redis) {
            return {
                totalLockedIPs: 0,
                totalLockedUsers: 0,
                timestamp: Date.now(),
            };
        }
        const lockedIPs = await redis.keys('bruteforce:ip:*:locked');
        const lockedUsers = await redis.keys('bruteforce:user:*:locked');
        return {
            totalLockedIPs: lockedIPs.length,
            totalLockedUsers: lockedUsers.length,
            timestamp: Date.now(),
        };
    }
    catch (error) {
        console.error('Failed to get brute force stats:', error);
        return {
            totalLockedIPs: 0,
            totalLockedUsers: 0,
            timestamp: Date.now(),
        };
    }
}
