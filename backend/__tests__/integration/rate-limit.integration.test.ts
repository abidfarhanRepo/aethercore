import Fastify from 'fastify'
import fastifyRateLimit from '@fastify/rate-limit'

describe('Rate limiting integration', () => {
  const GLOBAL_LIMIT = 200
  const AUTH_LIMIT = 10

  const buildApp = async () => {
    const app = Fastify()

    await app.register(fastifyRateLimit, {
      global: true,
      timeWindow: '1 minute',
      max: (request) => {
        const path = request.url.split('?')[0]
        if (path.startsWith('/api/v1/auth/')) {
          return AUTH_LIMIT
        }
        return GLOBAL_LIMIT
      },
      keyGenerator: (request) => request.ip,
    })

    app.post('/api/v1/auth/login', async (_request, reply) => {
      return reply.status(401).send({ error: 'Invalid credentials' })
    })

    app.get('/api/v1/products', async () => ({ ok: true }))

    await app.ready()
    return app
  }

  it('returns 429 on the 11th rapid request to /api/v1/auth/login', async () => {
    const app = await buildApp()

    try {
      for (let index = 1; index <= AUTH_LIMIT; index += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email: 'blocked@example.com', password: 'incorrect' },
        })

        expect(response.statusCode).toBe(401)
      }

      const throttledResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'blocked@example.com', password: 'incorrect' },
      })

      expect(throttledResponse.statusCode).toBe(429)
      expect(throttledResponse.headers['retry-after']).toBeDefined()
    } finally {
      await app.close()
    }
  })

  it('enforces the 200 requests per minute global limit on non-auth routes', async () => {
    const app = await buildApp()

    try {
      for (let index = 1; index <= GLOBAL_LIMIT; index += 1) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/products',
        })

        expect(response.statusCode).toBe(200)
      }

      const throttledResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/products',
      })

      expect(throttledResponse.statusCode).toBe(429)
      expect(throttledResponse.headers['retry-after']).toBeDefined()
    } finally {
      await app.close()
    }
  })
})
