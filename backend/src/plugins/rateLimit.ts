import { FastifyInstance } from 'fastify'
import Redis from 'ioredis'

const WINDOW_SECONDS = 60
const MAX_PER_WINDOW = 100 // general per-IP limit per minute

export default async function rateLimitPlugin(fastify: FastifyInstance) {
  const REDIS_DISABLED = process.env.REDIS_DISABLED === 'true'
  const redisUrl = process.env.REDIS_URL
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  let redis: Redis | null = null
  
  // Skip Redis initialization if disabled or in development mode
  if (!REDIS_DISABLED && nodeEnv !== 'development' && redisUrl) {
    try {
      redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 5000,
        retryStrategy: () => null,
        enableOfflineQueue: false,
      })
      redis.on('error', (err) => {
        fastify.log.warn({ err }, 'Redis rate limit client error')
      })
      await redis.connect()
      fastify.log.info('Using Redis for rate limiting')
    } catch (e) {
      fastify.log.warn('Failed to connect to Redis, falling back to in-memory limiter')
      if (redis) {
        redis.disconnect()
      }
      redis = null
    }
  }

  // simple in-memory map fallback: { key: { count, expiresAt } }
  const memoryMap = new Map<string, { count: number; expiresAt: number }>()

  fastify.addHook('onRequest', async (request, reply) => {
    const ip = request.ip || request.headers['x-forwarded-for'] as string || 'unknown'
    if (request.url === '/health') return

    const key = `rate:${ip}`

    try {
      if (redis) {
        const ttl = await redis.incr(key)
        if (ttl === 1) {
          await redis.expire(key, WINDOW_SECONDS)
        }
        const current = await redis.get(key)
        const count = Number(current || 0)
        if (count > MAX_PER_WINDOW) {
          reply.code(429).send({ error: 'too many requests' })
        }
      } else {
        const now = Date.now()
        const entry = memoryMap.get(key)
        if (!entry || entry.expiresAt < now) {
          memoryMap.set(key, { count: 1, expiresAt: now + WINDOW_SECONDS * 1000 })
        } else {
          entry.count += 1
          if (entry.count > MAX_PER_WINDOW) {
            return reply.code(429).send({ error: 'too many requests' })
          }
        }
      }
    } catch (e) {
      fastify.log.warn('rate limit check failed', e as any)
    }
  })

  // expose helper for auth to throttle logins
  fastify.decorate('loginThrottle', async (ip: string) => {
    const key = `login:ip:${ip}`
    const LIMIT = 5
    const WINDOW = 15 * 60 // 15 minutes
    try {
      if (redis) {
        const val = await redis.incr(key)
        if (val === 1) await redis.expire(key, WINDOW)
        return { count: val, allowed: val <= LIMIT }
      }
      const now = Date.now()
      const entry = memoryMap.get(key)
      if (!entry || entry.expiresAt < now) {
        memoryMap.set(key, { count: 1, expiresAt: now + WINDOW * 1000 })
        return { count: 1, allowed: true }
      }
      entry.count += 1
      return { count: entry.count, allowed: entry.count <= LIMIT }
    } catch (e) {
      fastify.log.warn('login throttle failed', e as any)
      return { count: 0, allowed: true }
    }
  })

  fastify.decorate('resetLoginThrottle', async (ip: string) => {
    const key = `login:ip:${ip}`
    try {
      if (redis) return redis.del(key)
      memoryMap.delete(key)
    } catch (e) {
      fastify.log.warn('reset login throttle failed', e as any)
    }
  })
}

