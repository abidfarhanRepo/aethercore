import Redis from 'ioredis'
import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/db'
import { collectAndPersistSecurityStatus } from '../lib/securityCompliance'

async function checkDatabase() {
  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Database check failed',
    }
  }
}

async function checkRedis() {
  const startedAt = Date.now()
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    connectTimeout: 1500,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    enableOfflineQueue: false,
  })
  redis.on('error', () => {
    // Swallow connection-level probe errors; failures are reported via health payload.
  })

  try {
    await redis.connect()
    const pong = await redis.ping()

    return {
      ok: pong === 'PONG',
      latencyMs: Date.now() - startedAt,
      pong,
    }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Redis check failed',
    }
  } finally {
    await redis.quit().catch(() => undefined)
  }
}

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/health', async (req, reply) => {
    const [database, redis] = await Promise.all([checkDatabase(), checkRedis()])

    let securitySummary: {
      status: string
      httpsEnforced: boolean
      tlsConfigured: boolean
      checkedAt: string
      notes: string[]
    }

    try {
      const status = await collectAndPersistSecurityStatus(req)
      securitySummary = {
        status: status.status,
        httpsEnforced: status.https.enforced,
        tlsConfigured: status.tls.keyPath.configured && status.tls.certPath.configured,
        checkedAt: status.checkedAt.toISOString(),
        notes: status.notes,
      }
    } catch (error) {
      securitySummary = {
        status: 'error',
        httpsEnforced: false,
        tlsConfigured: false,
        checkedAt: new Date().toISOString(),
        notes: [error instanceof Error ? error.message : 'Failed to compute security summary'],
      }
    }

    const statusCode = database.ok ? 200 : 503

    return reply.code(statusCode).send({
      status: database.ok && redis.ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database,
        redis,
        security: securitySummary,
      },
    })
  })
}
