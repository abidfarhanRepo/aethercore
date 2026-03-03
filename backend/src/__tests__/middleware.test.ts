import request from 'supertest'
import Fastify from 'fastify'
import rateLimitPlugin from '../plugins/rateLimit'

describe('rate limit plugin (memory)', () => {
  test('blocks when over limit', async () => {
    const app = Fastify()
    await app.register(rateLimitPlugin)
    app.get('/test', async () => ({ ok: true }))
    await app.listen({ port: 0 })
    const address = app.server.address()
    // address may be object
    const port = (address as any).port
    const agent = request(`http://localhost:${port}`)

    for (let i = 0; i < 101; i++) {
      // make requests from same agent (same IP)
      const res = await agent.get('/test')
      if (i < 100) expect(res.status).toBe(200)
      else expect(res.status).toBe(429)
    }
    await app.close()
  }, 20000)
})
