"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = productRoutes;
const db_1 = require("../utils/db");
async function productRoutes(fastify) {
    fastify.get('/products', async (req, reply) => {
        const products = await db_1.prisma.product.findMany();
        return products;
    });
    fastify.get('/products/:id', { schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } }, async (req, reply) => {
        const id = req.params.id;
        const product = await db_1.prisma.product.findUnique({ where: { id } });
        if (!product)
            return reply.status(404).send({ error: 'not found' });
        return product;
    });
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
    };
    fastify.post('/products', { preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')], schema: createProductSchema }, async (req, reply) => {
        const body = req.body;
        const p = await db_1.prisma.product.create({ data: { sku: body.sku, name: body.name, description: body.description, priceCents: body.priceCents, costCents: body.costCents } });
        return p;
    });
    const updateProductSchema = {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, priceCents: { type: 'number' }, costCents: { type: 'number' } } }
    };
    fastify.put('/products/:id', { preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')], schema: updateProductSchema }, async (req, reply) => {
        const id = req.params.id;
        const body = req.body;
        const p = await db_1.prisma.product.update({ where: { id }, data: { name: body.name, description: body.description, priceCents: body.priceCents, costCents: body.costCents } });
        return p;
    });
    fastify.delete('/products/:id', { preHandler: [require('./../plugins/authMiddleware').requireAuth, require('./../plugins/authMiddleware').requireRole('MANAGER')], schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } }, async (req, reply) => {
        const id = req.params.id;
        await db_1.prisma.product.delete({ where: { id } });
        return { ok: true };
    });
}
