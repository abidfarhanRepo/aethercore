import Fastify from 'fastify'
import authRoutes from '../../src/routes/auth'
import salesRoutes from '../../src/routes/sales'
import { registerGlobalValidationHook } from '../../src/lib/validation'

describe('Global Zod Validation', () => {
  let app: ReturnType<typeof Fastify>

  beforeAll(async () => {
    app = Fastify()
    registerGlobalValidationHook(app)
    await app.register(authRoutes)
    await app.register(salesRoutes)
    await app.ready()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
  })

  it('returns structured 400 for malformed register body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        password: 'Password123!',
      },
    })

    expect(response.statusCode).toBe(400)

    const body = response.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.message).toBe('Request validation failed')
    expect(body.statusCode).toBe(400)
    expect(body.requestId).toBeDefined()
    expect(body.timestamp).toBeDefined()
    expect(Array.isArray(body.details?.body)).toBe(true)
  })

  it('returns structured 400 for malformed sales body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sales',
      payload: {
        customerId: 'cust_123',
      },
    })

    expect(response.statusCode).toBe(400)

    const body = response.json()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(Array.isArray(body.details?.body)).toBe(true)
  })
})
