"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = inventoryRoutes;
async function inventoryRoutes(fastify) {
    // Stub inventory routes - full implementation disabled for now
    fastify.get('/inventory', async (req, reply) => {
        try {
            // Return stub data to avoid Prisma type issues
            return {
                locations: [],
                summary: [],
                message: 'Inventory API available but using stub data'
            };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to fetch inventory' });
        }
    });
    // Stub endpoint for getting product inventory
    fastify.get('/inventory/:productId', async (req, reply) => {
        return { error: 'Inventory detailed view temporarily disabled' };
    });
    // Stub endpoint for adjusting stock
    fastify.post('/inventory/adjust', async (req, reply) => {
        return { error: 'Inventory adjust temporarily disabled' };
    });
    // Stub endpoint for transferring stock
    fastify.post('/inventory/transfer', async (req, reply) => {
        return { error: 'Inventory transfer temporarily disabled' };
    });
    // Stub endpoint for low stock
    fastify.get('/inventory/low-stock', async (req, reply) => {
        return { items: [], count: 0 };
    });
    // Stub endpoint for recount
    fastify.post('/inventory/recount', async (req, reply) => {
        return { error: 'Inventory recount temporarily disabled' };
    });
    // Stub endpoint for warehouse init
    fastify.post('/inventory/warehouse/init', async (req, reply) => {
        return { message: 'Warehouse init temporarily disabled' };
    });
    // Stub endpoint for warehouses
    fastify.get('/inventory/warehouses', async (req, reply) => {
        return { warehouses: [] };
    });
}
