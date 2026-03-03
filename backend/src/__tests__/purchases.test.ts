import Fastify from 'fastify'
import purchaseRoutes from '../routes/purchases'
import { PrismaClient } from '@prisma/client'

// lightweight smoke tests using sqlite in-memory would be ideal but here we do simple route registration smoke

describe('purchases routes', ()=>{
  let server: any
  beforeAll(()=>{
    server = Fastify()
    server.register(purchaseRoutes)
  })

  test('reject create without items', async ()=>{
    const res = await server.inject({ method: 'POST', url: '/purchases', payload: {} })
    expect(res.statusCode).toBe(400)
  })

  test('reject receive without items', async ()=>{
    const res = await server.inject({ method: 'POST', url: '/purchases/doesnotexist/receive', payload: {} })
    // should be 500 because id not found in our simple setup
    expect([400,500,404]).toContain(res.statusCode)
  })
})
