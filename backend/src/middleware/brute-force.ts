/**
 * Brute force protection middleware
 * Tracks failed login attempts by IP and username
 * Uses Redis for high performance and distributed support
 */

import { FastifyRequest, FastifyReply } from 'fastify'
import Redis from 'ioredis'
import { logger } from '../utils/logger'

// Allow Redis to be disabled for development
const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true'

let redis: Redis | null = null

// Only initialize Redis if not disabled and not in development
if (!REDIS_DISABLED && process.env.NODE_ENV !== 'development') {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
  redis.on('error', (err) => {
    logger.warn({ err }, 'Redis client error')
    // Gracefully degrade if Redis fails
  })
}

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 15 * 60 // 15 minutes
const RESET_AFTER = 24 * 60 * 60 // 24 hours

interface BruteForceConfig {
  maxAttempts?: number
  lockoutDuration?: number
  resetAfter?: number
}

/**
 * Get brute force key for tracking
 */
function getBruteForceKey(identifier: string, type: 'ip' | 'user'): string {
  const prefix = type === 'ip' ? 'bruteforce:ip' : 'bruteforce:user'
  return `${prefix}:${identifier}`
}

/**
 * Record a failed attempt
 */
export async function recordFailedAttempt(
  identifier: string,
  type: 'ip' | 'user' = 'ip',
  config: BruteForceConfig = {}
): Promise<{ attempts: number; locked: boolean; waitTime?: number }> {
  // Skip Redis operations if disabled
  if (!redis) {
    return {
      attempts: 1,
      locked: false,
    }
  }

  const maxAttempts = config.maxAttempts || MAX_ATTEMPTS
  const lockoutDuration = config.lockoutDuration || LOCKOUT_DURATION
  
  const key = getBruteForceKey(identifier, type)
  
  try {
    // Increment failed attempts
    const attempts = await redis.incr(key)
    
    // Set expiration if first attempt
    if (attempts === 1) {
      await redis.expire(key, config.resetAfter || RESET_AFTER)
    }
    
    // Lock if max attempts exceeded
    const locked = attempts >= maxAttempts
    
    if (locked) {
      // Set lock key
      const lockKey = `${key}:locked`
      await redis.setex(lockKey, lockoutDuration, '1')
      
      // Return wait time in seconds
      const ttl = await redis.ttl(lockKey)
      return {
        attempts,
        locked: true,
        waitTime: ttl > 0 ? ttl : lockoutDuration,
      }
    }
    
    return {
      attempts,
      locked: false,
    }
  } catch (error) {
    logger.error({ error }, 'Failed to record failed attempt')
    // Fail open - don't block on Redis errors
    return {
      attempts: 1,
      locked: false,
    }
  }
}

/**
 * Check if an identifier is locked out
 */
export async function isLockedOut(
  identifier: string,
  type: 'ip' | 'user' = 'ip'
): Promise<{ locked: boolean; waitTime?: number }> {
  // Skip Redis operations if disabled
  if (!redis) {
    return { locked: false }
  }

  const key = getBruteForceKey(identifier, type)
  const lockKey = `${key}:locked`
  
  try {
    const locked = await redis.exists(lockKey)
    
    if (locked) {
      const ttl = await redis.ttl(lockKey)
      return {
        locked: true,
        waitTime: ttl > 0 ? ttl : 0,
      }
    }
    
    return { locked: false }
  } catch (error) {
    logger.error({ error }, 'Failed to check lockout status')
    // Fail open - don't block on Redis errors
    return { locked: false }
  }
}

/**
 * Reset failed attempts for an identifier
 */
export async function resetFailedAttempts(
  identifier: string,
  type: 'ip' | 'user' = 'ip'
): Promise<void> {
  // Skip Redis operations if disabled
  if (!redis) {
    return
  }

  const key = getBruteForceKey(identifier, type)
  const lockKey = `${key}:locked`
  
  try {
    await redis.del(key, lockKey)
  } catch (error) {
    logger.error({ error }, 'Failed to reset failed attempts')
  }
}

/**
 * Get current failed attempts count
 */
export async function getAttemptCount(
  identifier: string,
  type: 'ip' | 'user' = 'ip'
): Promise<number> {
  // Skip Redis operations if disabled
  if (!redis) {
    return 0
  }

  const key = getBruteForceKey(identifier, type)
  
  try {
    const count = await redis.get(key)
    return parseInt(count || '0', 10)
  } catch (error) {
    logger.error({ error }, 'Failed to get attempt count')
    return 0
  }
}

/**
 * Brute force protection middleware for login endpoints
 */
export async function bruteForceProtection(
  request: FastifyRequest,
  reply: FastifyReply,
  config: BruteForceConfig = {}
): Promise<void> {
  const ip = request.ip || request.socket?.remoteAddress || 'unknown'
  
  // Check if IP is locked out
  const ipLockout = await isLockedOut(ip, 'ip')
  if (ipLockout.locked) {
    reply.code(429).send({
      error: 'Too many failed attempts',
      message: `Please wait ${ipLockout.waitTime} seconds before trying again`,
      retryAfter: ipLockout.waitTime,
    })
    return
  }
}

/**
 * Middleware to handle login success (reset counter)
 */
export async function onLoginSuccess(
  identifier: string,
  request: FastifyRequest
): Promise<void> {
  const ip = request.ip || request.socket?.remoteAddress || 'unknown'
  
  // Reset failed attempts for both IP and user
  await resetFailedAttempts(ip, 'ip')
  await resetFailedAttempts(identifier, 'user')
}

/**
 * Middleware to handle login failure (track attempt)
 */
export async function onLoginFailure(
  identifier: string,
  request: FastifyRequest
): Promise<{ locked: boolean; waitTime?: number }> {
  const ip = request.ip || request.socket?.remoteAddress || 'unknown'
  
  // Track failed attempt for both IP and user
  const ipResult = await recordFailedAttempt(ip, 'ip')
  const userResult = await recordFailedAttempt(identifier, 'user')
  
  // Return lock status based on whichever is more restrictive
  if (ipResult.locked || userResult.locked) {
    return {
      locked: true,
      waitTime: Math.max(ipResult.waitTime || 0, userResult.waitTime || 0),
    }
  }
  
  return {
    locked: false,
  }
}

/**
 * Exponential backoff calculation for retry
 */
export function getExponentialBackoff(attemptNumber: number): number {
  // backoff = min(maxWait, initialDelay * 2^attemptNumber) + random jitter
  const initialDelay = 1 // 1 second
  const maxWait = 3600 // 1 hour max
  const jitter = Math.random() * 1000 // 0-1 second jitter
  
  const waitTime = Math.min(maxWait, initialDelay * Math.pow(2, attemptNumber - 1)) * 1000
  return (waitTime + jitter) / 1000 // Return in seconds
}

/**
 * Clear all brute force records (admin function)
 */
export async function clearAllBruteForceRecords(): Promise<void> {
  try {
    if (!redis) {
      return
    }
    const keys = await redis.keys('bruteforce:*')
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  } catch (error) {
    logger.error({ error }, 'Failed to clear brute force records')
  }
}

/**
 * Get brute force statistics for monitoring
 */
export async function getBruteForceStats(): Promise<{
  totalLockedIPs: number
  totalLockedUsers: number
  timestamp: number
}> {
  try {
    if (!redis) {
      return {
        totalLockedIPs: 0,
        totalLockedUsers: 0,
        timestamp: Date.now(),
      }
    }

    const lockedIPs = await redis.keys('bruteforce:ip:*:locked')
    const lockedUsers = await redis.keys('bruteforce:user:*:locked')
    
    return {
      totalLockedIPs: lockedIPs.length,
      totalLockedUsers: lockedUsers.length,
      timestamp: Date.now(),
    }
  } catch (error) {
    logger.error({ error }, 'Failed to get brute force stats')
    return {
      totalLockedIPs: 0,
      totalLockedUsers: 0,
      timestamp: Date.now(),
    }
  }
}
