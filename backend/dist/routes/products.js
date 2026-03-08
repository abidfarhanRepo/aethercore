"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = productRoutes;
const db_1 = require("../utils/db");
const products_1 = require("../schemas/products");
async function productRoutes(fastify) {
    fastify.get('/api/v1/products', async (req, reply) => {
        const products = await db_1.prisma.product.findMany();
        return products;
    });
    fastify.get('/api/v1/products/:id', {
        config: { zod: { params: products_1.productParamsSchema } },
    }, async (req, reply) => {
        const { id } = req.params;
        const product = await db_1.prisma.product.findUnique({ where: { id } });
        if (!product)
            return reply.status(404).send({ error: 'not found' });
        return product;
    });
    // protected endpoints (manager+)
    fastify.post('/api/v1/products', {
        preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')],
        config: { zod: { body: products_1.createProductBodySchema } },
    }, async (req, reply) => {
        const body = req.body;
        const p = await db_1.prisma.product.create({ data: { sku: body.sku, name: body.name, description: body.description, priceCents: body.priceCents, costCents: body.costCents } });
        return p;
    });
    fastify.put('/api/v1/products/:id', {
        preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')],
        config: { zod: { params: products_1.productParamsSchema, body: products_1.updateProductBodySchema } },
    }, async (req, reply) => {
        const { id } = req.params;
        const body = req.body;
        const p = await db_1.prisma.product.update({ where: { id }, data: { name: body.name, description: body.description, priceCents: body.priceCents, costCents: body.costCents } });
        return p;
    });
    fastify.delete('/api/v1/products/:id', {
        preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')],
        config: { zod: { params: products_1.productParamsSchema } },
    }, async (req, reply) => {
        const { id } = req.params;
        await db_1.prisma.product.delete({ where: { id } });
        return { ok: true };
    });
}
