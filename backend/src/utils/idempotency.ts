/**
 * Idempotency tracking for safe retries
 * Ensures duplicate requests return the same result
 */

import { getRedisClient } from '../lib/redis'
import { logger } from './logger'

const FALLBACK_TTL_SECONDS = 86400
const fallbackCache = new Map<string, { value: unknown; expiresAt: number }>()

function getCacheKey(key: string): string {
  return `idempotency:${key}`
}

function pruneFallback(key: string, entry?: { value: unknown; expiresAt: number }): void {
  if (entry && entry.expiresAt <= Date.now()) {
    fallbackCache.delete(key)
  }
}

export async function checkIdempotency(
  key: string
): Promise<{ exists: boolean; result?: unknown }> {
  if (!key) {
    return { exists: false }
  }

  const redis = await getRedisClient()
  if (redis) {
    try {
      const raw = await redis.get(getCacheKey(key))
      if (!raw) {
        return { exists: false }
      }

      return {
        exists: true,
        result: JSON.parse(raw),
      }
    } catch (error) {
      logger.warn({ error, key }, 'Redis idempotency read failed; trying fallback')
    }
  }

  const fallback = fallbackCache.get(key)
  pruneFallback(key, fallback)
  if (!fallbackCache.has(key)) {
    return { exists: false }
  }

  return {
    exists: true,
    result: fallback?.value,
  }
}

export async function saveIdempotency(
  key: string,
  result: unknown,
  ttlSeconds: number = FALLBACK_TTL_SECONDS
): Promise<void> {
  if (!key) {
    return
  }

  const redis = await getRedisClient()
  if (redis) {
    try {
      await redis.set(getCacheKey(key), JSON.stringify(result), 'EX', ttlSeconds)
      return
    } catch (error) {
      logger.warn({ error, key }, 'Redis idempotency write failed; using fallback')
    }
  }

  fallbackCache.set(key, {
    value: result,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })
}

export async function clearIdempotency(key: string): Promise<void> {
  const redis = await getRedisClient()
  if (redis) {
    try {
      await redis.del(getCacheKey(key))
    } catch (error) {
      logger.warn({ error, key }, 'Redis idempotency clear failed')
    }
  }
  fallbackCache.delete(key)
}

export class IdempotencyService {
  /**
   * Generate idempotency key for a request
   */
  static generateKey(operationId: string): string {
    return operationId
  }

  /**
   * Store operation result for idempotency
   */
  static async storeResult(
    operationId: string,
    result: any,
    serverId?: string,
    data?: any
  ): Promise<void> {
    void serverId
    await saveIdempotency(operationId, result ?? data)
  }

  /**
   * Get cached result for operation
   */
  static async getResult(operationId: string): Promise<any> {
    const cached = await checkIdempotency(operationId)
    return cached.exists ? cached.result : null
  }

  /**
   * Mark operation as processed
   */
  static async markProcessed(operationId: string): Promise<void> {
    logger.debug({ operationId }, 'markProcessed is implicit with cached result')
  }
}

export default IdempotencyService
