"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = inventoryRoutes;
const db_1 = require("../utils/db");
const inventory_1 = require("../schemas/inventory");
async function inventoryRoutes(fastify) {
    fastify.get('/api/v1/inventory', {
        config: { zod: { query: inventory_1.inventoryListQuerySchema } },
    }, async (req, reply) => {
        try {
            const where = req.query.warehouseId
                ? { warehouseId: req.query.warehouseId }
                : undefined;
            const locations = await db_1.prisma.inventoryLocation.findMany({
                where,
                include: {
                    product: {
                        select: {
                            id: true,
                            sku: true,
                            name: true,
                            priceCents: true,
                            costCents: true,
                        },
                    },
                    warehouse: {
                        select: {
                            id: true,
                            name: true,
                            location: true,
                            isActive: true,
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
            });
            const totalValue = locations.reduce((acc, location) => acc + (location.product.costCents || 0) * location.qty, 0);
            return {
                locations,
                summary: {
                    totalLocations: locations.length,
                    totalValue,
                    lowStockCount: locations.filter((location) => location.qty < location.minThreshold)
                        .length,
                    averageQty: locations.length > 0
                        ? Math.round(locations.reduce((acc, location) => acc + location.qty, 0) /
                            locations.length)
                        : 0,
                },
                count: locations.length,
            };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to fetch inventory' });
        }
    });
    fastify.get('/api/v1/inventory/:productId', {
        config: { zod: { params: inventory_1.inventoryProductParamsSchema } },
    }, async (req, reply) => {
        const { productId } = req.params;
        try {
            const product = await db_1.prisma.product.findUnique({
                where: { id: productId },
                select: {
                    id: true,
                    sku: true,
                    name: true,
                    priceCents: true,
                    costCents: true,
                },
            });
            if (!product) {
                return reply.status(404).send({ error: 'Product not found' });
            }
            const locations = await db_1.prisma.inventoryLocation.findMany({
                where: { productId },
                include: {
                    warehouse: {
                        select: { id: true, name: true, location: true, isActive: true },
                    },
                },
                orderBy: { createdAt: 'asc' },
            });
            const totalQty = locations.reduce((acc, location) => acc + location.qty, 0);
            return {
                product,
                locations,
                totalQty,
            };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to fetch product inventory' });
        }
    });
    fastify.post('/api/v1/inventory/adjust', {
        config: { zod: { body: inventory_1.adjustInventoryBodySchema } },
    }, async (req, reply) => {
        const { productId, warehouseId, qtyDelta, reason, notes, costPerUnit } = req.body;
        if (!productId || qtyDelta === undefined) {
            return reply
                .status(400)
                .send({ error: 'productId and qtyDelta are required' });
        }
        if (!Number.isInteger(qtyDelta)) {
            return reply.status(400).send({ error: 'qtyDelta must be an integer' });
        }
        try {
            const result = await db_1.prisma.$transaction(async (tx) => {
                const product = await tx.product.findUnique({ where: { id: productId } });
                if (!product) {
                    throw new Error('Product not found');
                }
                const warehouse = warehouseId
                    ? await tx.warehouse.findUnique({ where: { id: warehouseId } })
                    :
                        (await tx.warehouse.findFirst({
                            where: { isActive: true },
                            orderBy: { createdAt: 'asc' },
                        })) ||
                            (await tx.warehouse.create({
                                data: {
                                    name: 'Default Warehouse',
                                    location: 'Default Location',
                                    isActive: true,
                                },
                            }));
                if (!warehouse) {
                    throw new Error('Warehouse not found');
                }
                let location = await tx.inventoryLocation.findUnique({
                    where: {
                        productId_warehouseId: {
                            productId,
                            warehouseId: warehouse.id,
                        },
                    },
                });
                if (!location) {
                    location = await tx.inventoryLocation.create({
                        data: {
                            productId,
                            warehouseId: warehouse.id,
                            qty: 0,
                        },
                    });
                }
                const qtyBefore = location.qty;
                const qtyAfter = Math.max(0, qtyBefore + qtyDelta);
                const updatedLocation = await tx.inventoryLocation.update({
                    where: { id: location.id },
                    data: { qty: qtyAfter },
                });
                await tx.inventoryTransaction.create({
                    data: {
                        productId,
                        warehouseId: warehouse.id,
                        qtyDelta,
                        qtyBefore,
                        qtyAfter,
                        type: 'ADJUSTMENT',
                        reason: reason || 'MANUAL',
                        notes,
                        costPerUnit,
                        createdBy: 'system',
                    },
                });
                return {
                    id: updatedLocation.id,
                    product: { id: product.id, sku: product.sku, name: product.name },
                    warehouse: { id: warehouse.id, name: warehouse.name },
                    qtyBefore,
                    qtyAfter,
                    qtyDelta,
                };
            });
            return reply.status(200).send(result);
        }
        catch (err) {
            fastify.log.error(err);
            if (err.message === 'Product not found' || err.message === 'Warehouse not found') {
                return reply.status(404).send({ error: err.message });
            }
            return reply.status(500).send({ error: 'Failed to adjust inventory' });
        }
    });
    fastify.post('/api/v1/inventory/transfer', {
        config: { zod: { body: inventory_1.transferInventoryBodySchema } },
    }, async (req, reply) => {
        const { productId, fromWarehouseId, toWarehouseId, qty, notes } = req.body;
        if (!productId || !fromWarehouseId || !toWarehouseId || qty === undefined) {
            return reply.status(400).send({
                error: 'productId, fromWarehouseId, toWarehouseId, and qty are required',
            });
        }
        if (!Number.isInteger(qty) || qty <= 0) {
            return reply.status(400).send({ error: 'qty must be a positive integer' });
        }
        if (fromWarehouseId === toWarehouseId) {
            return reply.status(400).send({ error: 'Cannot transfer to the same warehouse' });
        }
        try {
            const result = await db_1.prisma.$transaction(async (tx) => {
                const product = await tx.product.findUnique({ where: { id: productId } });
                if (!product) {
                    throw new Error('Product not found');
                }
                const fromWarehouse = await tx.warehouse.findUnique({ where: { id: fromWarehouseId } });
                const toWarehouse = await tx.warehouse.findUnique({ where: { id: toWarehouseId } });
                if (!fromWarehouse || !toWarehouse) {
                    throw new Error('One or both warehouses not found');
                }
                const sourceLocation = await tx.inventoryLocation.findUnique({
                    where: {
                        productId_warehouseId: {
                            productId,
                            warehouseId: fromWarehouseId,
                        },
                    },
                });
                if (!sourceLocation) {
                    throw new Error('Product not in source warehouse');
                }
                if (sourceLocation.qty < qty) {
                    throw new Error('Insufficient stock in source warehouse');
                }
                let destinationLocation = await tx.inventoryLocation.findUnique({
                    where: {
                        productId_warehouseId: {
                            productId,
                            warehouseId: toWarehouseId,
                        },
                    },
                });
                if (!destinationLocation) {
                    destinationLocation = await tx.inventoryLocation.create({
                        data: {
                            productId,
                            warehouseId: toWarehouseId,
                            qty: 0,
                        },
                    });
                }
                const sourceAfter = sourceLocation.qty - qty;
                const destinationAfter = destinationLocation.qty + qty;
                const transferRef = `transfer:${productId}:${Date.now()}`;
                await tx.inventoryLocation.update({
                    where: { id: sourceLocation.id },
                    data: { qty: sourceAfter },
                });
                await tx.inventoryLocation.update({
                    where: { id: destinationLocation.id },
                    data: { qty: destinationAfter },
                });
                await tx.inventoryTransaction.create({
                    data: {
                        productId,
                        warehouseId: fromWarehouseId,
                        qtyDelta: -qty,
                        qtyBefore: sourceLocation.qty,
                        qtyAfter: sourceAfter,
                        type: 'TRANSFER',
                        reason: 'TRANSFER_OUT',
                        reference: transferRef,
                        createdBy: 'system',
                        notes: notes || `Transfer to ${toWarehouse.name}`,
                        fromLocation: fromWarehouseId,
                        toLocation: toWarehouseId,
                    },
                });
                await tx.inventoryTransaction.create({
                    data: {
                        productId,
                        warehouseId: toWarehouseId,
                        qtyDelta: qty,
                        qtyBefore: destinationLocation.qty,
                        qtyAfter: destinationAfter,
                        type: 'TRANSFER',
                        reason: 'TRANSFER_IN',
                        reference: transferRef,
                        createdBy: 'system',
                        notes: notes || `Transfer from ${fromWarehouse.name}`,
                        fromLocation: fromWarehouseId,
                        toLocation: toWarehouseId,
                    },
                });
                return {
                    product: { id: product.id, sku: product.sku, name: product.name },
                    from: {
                        warehouseId: fromWarehouseId,
                        warehouseName: fromWarehouse.name,
                        qtyAfter: sourceAfter,
                    },
                    to: {
                        warehouseId: toWarehouseId,
                        warehouseName: toWarehouse.name,
                        qtyAfter: destinationAfter,
                    },
                    qtyTransferred: qty,
                    reference: transferRef,
                };
            });
            return reply.status(200).send(result);
        }
        catch (err) {
            fastify.log.error(err);
            if (err.message === 'Product not found' ||
                err.message === 'One or both warehouses not found' ||
                err.message === 'Product not in source warehouse' ||
                err.message === 'Insufficient stock in source warehouse') {
                return reply.status(400).send({ error: err.message });
            }
            return reply.status(500).send({ error: 'Failed to transfer inventory' });
        }
    });
    fastify.get('/api/v1/inventory/low-stock', {
        config: { zod: { query: inventory_1.inventoryListQuerySchema } },
    }, async (req, reply) => {
        try {
            const where = req.query.warehouseId
                ? { warehouseId: req.query.warehouseId }
                : undefined;
            const locations = await db_1.prisma.inventoryLocation.findMany({
                where,
                include: {
                    product: {
                        select: {
                            id: true,
                            sku: true,
                            name: true,
                        },
                    },
                    warehouse: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
            const items = locations
                .filter((location) => location.qty < location.minThreshold)
                .sort((a, b) => a.qty - b.qty)
                .map((location) => ({
                id: location.id,
                productId: location.productId,
                productSku: location.product.sku,
                productName: location.product.name,
                warehouseId: location.warehouseId,
                warehouseName: location.warehouse.name,
                currentQty: location.qty,
                minThreshold: location.minThreshold,
                reorderPoint: location.reorderPoint,
                shortage: Math.max(0, location.minThreshold - location.qty),
            }));
            return { items, count: items.length };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to fetch low stock items' });
        }
    });
    fastify.post('/api/v1/inventory/recount', {
        config: { zod: { body: inventory_1.recountInventoryBodySchema } },
    }, async (req, reply) => {
        const { warehouseId, sessionName, notes, items } = req.body;
        if (!warehouseId || !sessionName || !Array.isArray(items)) {
            return reply
                .status(400)
                .send({ error: 'warehouseId, sessionName, and items are required' });
        }
        const validItems = items.filter((item) => item.productId && Number.isInteger(item.countedQty) && item.countedQty >= 0);
        if (validItems.length === 0) {
            return reply.status(400).send({ error: 'items must contain valid productId and countedQty' });
        }
        try {
            const result = await db_1.prisma.$transaction(async (tx) => {
                const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
                if (!warehouse) {
                    throw new Error('Warehouse not found');
                }
                const session = await tx.inventoryAdjustmentSession.create({
                    data: {
                        warehouseId,
                        sessionName,
                        status: 'in_progress',
                        totalItems: validItems.length,
                        adjustedBy: 'system',
                        notes,
                    },
                });
                let totalVariance = 0;
                const records = [];
                for (const item of validItems) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    if (!product) {
                        continue;
                    }
                    let location = await tx.inventoryLocation.findUnique({
                        where: {
                            productId_warehouseId: {
                                productId: item.productId,
                                warehouseId,
                            },
                        },
                    });
                    if (!location) {
                        location = await tx.inventoryLocation.create({
                            data: {
                                productId: item.productId,
                                warehouseId,
                                qty: 0,
                            },
                        });
                    }
                    const qtyBefore = location.qty;
                    const qtyAfter = item.countedQty;
                    const variance = qtyAfter - qtyBefore;
                    totalVariance += variance;
                    await tx.inventoryLocation.update({
                        where: { id: location.id },
                        data: {
                            qty: qtyAfter,
                            lastCountedAt: new Date(),
                        },
                    });
                    if (variance !== 0) {
                        await tx.inventoryTransaction.create({
                            data: {
                                productId: item.productId,
                                warehouseId,
                                qtyDelta: variance,
                                qtyBefore,
                                qtyAfter,
                                type: 'RECOUNT',
                                reason: variance > 0 ? 'INVENTORY_FOUND' : 'SHRINKAGE',
                                reference: session.id,
                                createdBy: 'system',
                                notes: `Physical recount ${sessionName}`,
                            },
                        });
                    }
                    records.push({
                        productId: item.productId,
                        systemQty: qtyBefore,
                        countedQty: qtyAfter,
                        variance,
                    });
                }
                await tx.inventoryAdjustmentSession.update({
                    where: { id: session.id },
                    data: {
                        status: 'completed',
                        completedAt: new Date(),
                        variance: totalVariance,
                    },
                });
                return {
                    sessionId: session.id,
                    warehouseId,
                    sessionName,
                    itemsProcessed: records.length,
                    totalVariance,
                    records,
                };
            });
            return reply.status(201).send(result);
        }
        catch (err) {
            fastify.log.error(err);
            if (err.message === 'Warehouse not found') {
                return reply.status(404).send({ error: err.message });
            }
            return reply.status(500).send({ error: 'Failed to complete recount' });
        }
    });
    fastify.post('/api/v1/inventory/warehouse/init', {
        config: { zod: { body: inventory_1.warehouseInitBodySchema } },
    }, async (req, reply) => {
        try {
            const existing = await db_1.prisma.warehouse.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: 'asc' },
            });
            if (existing) {
                return reply.status(200).send({
                    id: existing.id,
                    name: existing.name,
                    location: existing.location,
                    isActive: existing.isActive,
                    message: 'Default warehouse already exists',
                });
            }
            const warehouse = await db_1.prisma.warehouse.create({
                data: {
                    name: req.body?.name || 'Default Warehouse',
                    location: req.body?.location || 'Default Location',
                    address: req.body?.address,
                    isActive: true,
                },
            });
            return reply.status(201).send({
                id: warehouse.id,
                name: warehouse.name,
                location: warehouse.location,
                isActive: warehouse.isActive,
                message: 'Default warehouse created',
            });
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to initialize warehouse' });
        }
    });
    fastify.get('/api/v1/inventory/warehouses', async (req, reply) => {
        try {
            const warehouses = await db_1.prisma.warehouse.findMany({
                where: { isActive: true },
                select: {
                    id: true,
                    name: true,
                    location: true,
                    address: true,
                    isActive: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
            });
            return { warehouses, count: warehouses.length };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to fetch warehouses' });
        }
    });
    fastify.post('/api/v1/inventory/holds/release', {
        config: { zod: { body: inventory_1.releaseInventoryHoldBodySchema } },
    }, async (req, reply) => {
        const tenantId = (req.user?.tenantId || 'global').trim() || 'global';
        try {
            const where = req.body.holdId
                ? {
                    id: req.body.holdId,
                    tenantId,
                }
                : {
                    tenantId,
                    ...(req.body.sessionId ? { sessionId: req.body.sessionId } : {}),
                    ...(req.body.productId ? { productId: req.body.productId } : {}),
                };
            const result = await db_1.prisma.inventoryHold.deleteMany({ where });
            return reply.status(200).send({
                released: result.count,
            });
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to release inventory hold(s)' });
        }
    });
}
