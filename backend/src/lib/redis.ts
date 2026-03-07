import Redis from 'ioredis'
import { logger } from '../utils/logger'

let client: Redis | null = null
let initPromise: Promise<Redis | null> | null = null

async function initRedis(): Promise<Redis | null> {
  let redis: Redis | null = null

  try {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      retryStrategy: () => null,
    })

    redis.on('error', (error) => {
      logger.warn({ error }, 'Redis client error')
    })

    await redis.connect()
    logger.info('Redis client initialized')
    return redis
  } catch (error) {
    // Ensure failed clients are closed so test/process shutdown is not blocked by reconnect timers.
    if (redis) {
      redis.disconnect()
    }
    logger.warn({ error }, 'Redis unavailable; idempotency fallback will be used')
    return null
  }
}

export async function getRedisClient(): Promise<Redis | null> {
  if (client) {
    return client
  }

  if (!initPromise) {
    initPromise = initRedis()
  }

  client = await initPromise
  return client
}

export async function closeRedisClient(): Promise<void> {
  if (!client) {
    return
  }

  try {
    await client.quit()
  } catch (error) {
    logger.warn({ error }, 'Failed to close Redis client cleanly')
  } finally {
    client = null
    initPromise = null
  }
}
