import { FastifyInstance } from 'fastify'
import { prisma } from '../utils/db'
import {
  createProductBodySchema,
  CreateProductBody,
  productParamsSchema,
  ProductParams,
  updateProductBodySchema,
  UpdateProductBody,
} from '../schemas/products'

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.get('/api/v1/products', async (req, reply) => {
    const products = await prisma.product.findMany()
    return products
  })

  fastify.get('/api/v1/products/:id', {
    config: { zod: { params: productParamsSchema } },
  }, async (req, reply) => {
    const { id } = req.params as ProductParams
    const product = await prisma.product.findUnique({ where: { id } })
    if (!product) return reply.status(404).send({ error: 'not found' })
    return product
  })

  // protected endpoints (manager+)
  fastify.post('/api/v1/products', {
    preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')],
    config: { zod: { body: createProductBodySchema } },
  }, async (req, reply) => {
    const body = req.body as CreateProductBody
    const p = await prisma.product.create({ data: { sku: body.sku, name: body.name, description: body.description, priceCents: body.priceCents, costCents: body.costCents } })
    return p
  })

  fastify.put('/api/v1/products/:id', {
    preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')],
    config: { zod: { params: productParamsSchema, body: updateProductBodySchema } },
  }, async (req, reply) => {
    const { id } = req.params as ProductParams
    const body = req.body as UpdateProductBody
    const p = await prisma.product.update({ where: { id }, data: { name: body.name, description: body.description, priceCents: body.priceCents, costCents: body.costCents } })
    return p
  })

  fastify.delete('/api/v1/products/:id', {
    preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')],
    config: { zod: { params: productParamsSchema } },
  }, async (req, reply) => {
    const { id } = req.params as ProductParams
    await prisma.product.delete({ where: { id } })
    return { ok: true }
  })
}
