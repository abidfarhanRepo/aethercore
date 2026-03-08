// Load environment variables FIRST, before anything else
import dotenv from 'dotenv'
dotenv.config()

import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyRateLimit from '@fastify/rate-limit'
import jwt from 'jsonwebtoken'
import { prisma } from './utils/db'
import authRoutes from './routes/auth'
import productRoutes from './routes/products'
import salesRoutes from './routes/sales'
import auditRoutes from './routes/audit'
import purchaseRoutes from './routes/purchases'
import inventoryRoutes from './routes/inventory'
import userRoutes from './routes/users'
import roleRoutes from './routes/roles'
import reportsRoutes from './routes/reports'
import reportingIntelligenceRoutes from './routes/reportingIntelligence'
import paymentRoutes from './routes/payments'
import settingsRoutes from './routes/settings'
import syncRoutes from './routes/sync'
import receiptsRoutes from './routes/receipts'
import phase3Routes from './routes/phase3'
import hardwareRoutes from './routes/hardware'
import securityRoutes from './routes/security'
import notificationRoutes from './routes/notifications'
import healthRoutes from './routes/health'
import pluginRoutes from './routes/plugins'
import { registerSecurityPlugin } from './plugins/securityPlugin'
import { setupErrorHandler } from './middleware/errorHandler'
import { logger } from './utils/logger'
import { getRedisClient, closeRedisClient } from './lib/redis'
import { registerGlobalValidationHook } from './lib/validation'

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'change_me'
const RATE_LIMIT_GLOBAL = Number(process.env.RATE_LIMIT_GLOBAL || 200)
const RATE_LIMIT_AUTH = Number(process.env.RATE_LIMIT_AUTH || 10)
const RATE_LIMIT_TENANT = 1000

type JwtRateLimitPayload = {
  tenantId?: string | null
}

function getTenantIdFromAuthHeader(authorizationHeader: string | string[] | undefined): string | null {
  if (!authorizationHeader || Array.isArray(authorizationHeader)) {
    return null
  }

  const token = authorizationHeader.replace(/^Bearer\s+/, '').trim()
  if (!token) {
    return null
  }

  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as JwtRateLimitPayload
    return payload?.tenantId || null
  } catch {
    return null
  }
}

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
  },
  requestIdLogLabel: 'requestId',
})


// IMPORTANT: Register security plugin first, before all other middleware
const initializeSecurityAndRoutes = async () => {
  await getRedisClient()

  // Ensure each request carries a request ID and propagate it to response headers.
  server.addHook('onRequest', async (request, reply) => {
    const headerRequestId = request.headers['x-request-id']
    const requestId =
      (typeof headerRequestId === 'string' && headerRequestId.trim()) ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`

    request.headers['x-request-id'] = requestId
    reply.header('X-Request-ID', requestId)

    const requestPath = request.url.split('?')[0]
    if (
      request.method === 'GET' &&
      requestPath.startsWith('/api/') &&
      !requestPath.startsWith('/api/v1/')
    ) {
      const query = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''
      const upgradedPath = `/api/v1/${requestPath.slice('/api/'.length)}`
      reply
        .header('X-API-Deprecation', 'Deprecated endpoint. Use /api/v1/*')
        .header('Warning', '299 - "Deprecated API version. Use /api/v1 endpoints"')
        .redirect(301, `${upgradedPath}${query}`)
      return
    }
  })

  server.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
      },
      'request completed'
    )
  })

  // Global request validation hook. Route-level Zod schemas are attached in route config.zod.
  registerGlobalValidationHook(server)
  
  // Register comprehensive security plugin
  await registerSecurityPlugin(server, {
    enableHTTPS: process.env.NODE_ENV === 'production',
    enableCSP: true,
    enableRateLimit: true,
  })
  
  // Setup global error handler (after security)
  setupErrorHandler(server)
  
  // Register plugins and routes
  server.register(fastifyCookie)
  server.register(fastifyRateLimit, {
    global: true,
    timeWindow: '1 minute',
    max: (request) => {
      const path = request.url.split('?')[0]
      if (path.startsWith('/api/v1/auth/')) {
        return RATE_LIMIT_AUTH
      }
      return RATE_LIMIT_GLOBAL
    },
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (_request, context) => ({
      error: 'Too Many Requests',
      message: `Rate limit exceeded, retry in ${context.after}`,
      statusCode: 429,
    }),
  })

  // Enforce an additional tenant-wide ceiling to limit aggregate abuse per tenant.
  server.register(fastifyRateLimit, {
    global: true,
    timeWindow: '1 minute',
    max: RATE_LIMIT_TENANT,
    keyGenerator: (request) => {
      const tenantId = getTenantIdFromAuthHeader(request.headers.authorization)
      if (tenantId) {
        return `tenant:${tenantId}`
      }
      return `anon:${request.ip}`
    },
    errorResponseBuilder: (_request, context) => ({
      error: 'Too Many Requests',
      message: `Tenant rate limit exceeded, retry in ${context.after}`,
      statusCode: 429,
    }),
  })
  
  // Health check endpoint
  server.get('/health', async () => ({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }))
  
  // Register all routes
  server.register(authRoutes)
  server.register(productRoutes)
  server.register(auditRoutes)
  server.register(salesRoutes)
  server.register(purchaseRoutes)
  server.register(inventoryRoutes)
  server.register(userRoutes)
  server.register(roleRoutes)
  server.register(reportsRoutes)
  server.register(reportingIntelligenceRoutes)
  server.register(paymentRoutes)
  server.register(settingsRoutes)
  server.register(syncRoutes)
  server.register(receiptsRoutes)
  server.register(phase3Routes)
  server.register(hardwareRoutes)
  server.register(securityRoutes)
  server.register(notificationRoutes)
  server.register(healthRoutes)
  server.register(pluginRoutes)
  
  // Security audit endpoint (admin only)
  server.get('/api/v1/security/audit-summary', async (req, reply) => {
    // Check auth and admin role
    const auth = req.headers.authorization
    if (!auth) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
    
    try {
      const { getAuditSummary } = await import('./utils/audit')
      const summary = await getAuditSummary(30)
      return summary
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get audit summary' })
    }
  })
  
  // Brute force stats endpoint (admin only)
  server.get('/api/v1/security/bruteforce-stats', async (req, reply) => {
    try {
      const { getBruteForceStats } = await import('./middleware/brute-force')
      const stats = await getBruteForceStats()
      return stats
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to get stats' })
    }
  })
}

const start = async () => {
  try {
    // Initialize security and routes
    await initializeSecurityAndRoutes()
    
    // Start server
    await server.listen({ port: Number(process.env.PORT) || 4000, host: '0.0.0.0' })
    logger.info(
      {
        port: Number(process.env.PORT) || 4000,
        security: {
          headers: true,
          jwtRotation: true,
          inputSanitization: true,
          auditLogging: true,
          bruteForceProtection: true,
          corsWhitelist: true,
        },
      },
      'Aether POS Security Hardened'
    )
    server.log.info(`Server started on port ${process.env.PORT || 4000}`)
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  server.log.info('SIGTERM received, gracefully shutting down...')
  await server.close()
  await closeRedisClient()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  server.log.info('SIGINT received, gracefully shutting down...')
  await server.close()
  await closeRedisClient()
  await prisma.$disconnect()
  process.exit(0)
})

start()
