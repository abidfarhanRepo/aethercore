import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/db'

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.get('/api/products', async (req, reply) => {
    const products = await prisma.product.findMany()
    return products
  })

  fastify.get('/api/products/:id', { schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } }, async (req, reply) => {
    const id = (req.params as any).id
    const product = await prisma.product.findUnique({ where: { id } })
    if (!product) return reply.status(404).send({ error: 'not found' })
    return product
  })

  // protected endpoints (manager+)
  const createProductSchema = {
    body: {
      type: 'object',
      required: ['sku', 'name', 'priceCents'],
      properties: {
        sku: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        priceCents: { type: 'number' },
        costCents: { type: 'number' }
      }
    }
  }

  fastify.post('/api/products', { preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')], schema: createProductSchema }, async (req, reply) => {
    const body = req.body as any
    const p = await prisma.product.create({ data: { sku: body.sku, name: body.name, description: body.description, priceCents: body.priceCents, costCents: body.costCents } })
    return p
  })

  const updateProductSchema = {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    body: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, priceCents: { type: 'number' }, costCents: { type: 'number' } } }
  }

  fastify.put('/api/products/:id', { preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')], schema: updateProductSchema }, async (req, reply) => {
    const id = (req.params as any).id
    const body = req.body as any
    const p = await prisma.product.update({ where: { id }, data: { name: body.name, description: body.description, priceCents: body.priceCents, costCents: body.costCents } })
    return p
  })

  fastify.delete('/api/products/:id', { preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')], schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } }, async (req, reply) => {
    const id = (req.params as any).id
    await prisma.product.delete({ where: { id } })
    return { ok: true }
  })
}
