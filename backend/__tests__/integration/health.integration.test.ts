import Fastify from 'fastify'
import healthRoutes from '../../src/routes/health'

describe('Health endpoint integration', () => {
  let app: ReturnType<typeof Fastify>

  beforeAll(async () => {
    app = Fastify()
    await app.register(healthRoutes)
    await app.ready()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('returns /api/health with database, redis, and security checks', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    })

    expect([200, 503]).toContain(response.statusCode)

    const body = response.json()
    expect(body).toHaveProperty('status')
    expect(body).toHaveProperty('checks.database.ok')
    expect(body).toHaveProperty('checks.redis.ok')
    expect(body).toHaveProperty('checks.security.status')
    expect(body).toHaveProperty('checks.security.httpsEnforced')
    expect(body).toHaveProperty('checks.security.tlsConfigured')
  })
})
