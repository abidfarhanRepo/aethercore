"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = phase3Routes;
const db_1 = require("../utils/db");
const authMiddleware_1 = require("../plugins/authMiddleware");
const capabilityMiddleware_1 = require("../middleware/capabilityMiddleware");
async function phase3Routes(fastify) {
    fastify.post('/api/inventory/lots', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireAllCapabilities)(['inventory.expiry', 'inventory.lot_tracking'])] }, async (req, reply) => {
        const { productId, warehouseId, batchNumber, expiryDate, qtyAvailable, costPerUnit, notes } = req.body;
        if (!productId || !warehouseId || !batchNumber || !expiryDate || qtyAvailable === undefined) {
            return reply.status(400).send({ error: 'productId, warehouseId, batchNumber, expiryDate and qtyAvailable are required' });
        }
        try {
            const lot = await db_1.prisma.lotBatch.create({
                data: {
                    productId,
                    warehouseId,
                    batchNumber,
                    expiryDate: new Date(expiryDate),
                    qtyAvailable,
                    costPerUnit,
                    notes,
                },
            });
            return reply.status(201).send(lot);
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to create lot', detail: err.message });
        }
    });
    fastify.get('/api/inventory/lots/:productId', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireAllCapabilities)(['inventory.expiry', 'inventory.lot_tracking'])] }, async (req, reply) => {
        const { productId } = req.params;
        try {
            const lots = await db_1.prisma.lotBatch.findMany({
                where: { productId },
                orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
            });
            return { lots };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to list lots', detail: err.message });
        }
    });
    fastify.get('/api/inventory/expiry-alerts', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('inventory.expiry')] }, async (req, reply) => {
        const thresholdDays = Number(req.query.thresholdDays || '30');
        const now = new Date();
        const thresholdDate = new Date(now);
        thresholdDate.setDate(thresholdDate.getDate() + thresholdDays);
        try {
            const lots = await db_1.prisma.lotBatch.findMany({
                where: {
                    expiryDate: { lte: thresholdDate, gte: now },
                    qtyAvailable: { gt: 0 },
                },
                include: {
                    product: { select: { id: true, name: true, sku: true } },
                    warehouse: { select: { id: true, name: true } },
                },
                orderBy: { expiryDate: 'asc' },
            });
            const alerts = lots.map((lot) => {
                const daysLeft = Math.ceil((new Date(lot.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    lotId: lot.id,
                    productId: lot.productId,
                    productName: lot.product?.name,
                    warehouseId: lot.warehouseId,
                    warehouseName: lot.warehouse?.name,
                    batchNumber: lot.batchNumber,
                    expiryDate: lot.expiryDate,
                    nearExpiryQty: lot.qtyAvailable,
                    daysLeft,
                };
            });
            return { alerts, thresholdDays };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to fetch expiry alerts', detail: err.message });
        }
    });
    fastify.post('/api/inventory/transfer-lot', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireAllCapabilities)(['inventory.expiry', 'inventory.lot_tracking'])] }, async (req, reply) => {
        const { productId, fromLotBatchId, toLotBatchId, qty, notes } = req.body;
        if (!productId || !fromLotBatchId || !qty || qty <= 0) {
            return reply.status(400).send({ error: 'productId, fromLotBatchId and positive qty are required' });
        }
        try {
            const result = await db_1.prisma.$transaction(async (tx) => {
                const fromLot = await tx.lotBatch.findUnique({ where: { id: fromLotBatchId } });
                if (!fromLot) {
                    throw new Error('Source lot not found');
                }
                if (fromLot.productId !== productId) {
                    throw new Error('Lot does not belong to productId');
                }
                if (fromLot.qtyAvailable < qty) {
                    throw new Error('Insufficient lot quantity');
                }
                await tx.lotBatch.update({
                    where: { id: fromLotBatchId },
                    data: { qtyAvailable: { decrement: qty } },
                });
                let targetLotId = toLotBatchId;
                if (toLotBatchId) {
                    await tx.lotBatch.update({
                        where: { id: toLotBatchId },
                        data: { qtyAvailable: { increment: qty } },
                    });
                }
                else {
                    const created = await tx.lotBatch.create({
                        data: {
                            productId: fromLot.productId,
                            warehouseId: fromLot.warehouseId,
                            batchNumber: `${fromLot.batchNumber}-XFER-${Date.now()}`,
                            expiryDate: fromLot.expiryDate,
                            qtyAvailable: qty,
                            costPerUnit: fromLot.costPerUnit,
                            notes: notes || 'Auto-created transfer lot',
                        },
                    });
                    targetLotId = created.id;
                }
                return { fromLotBatchId, toLotBatchId: targetLotId, qty };
            });
            return result;
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to transfer lot', detail: err.message });
        }
    });
    fastify.get('/api/restaurant/tables', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('restaurant.table_service')] }, async (_req, reply) => {
        try {
            const tables = await db_1.prisma.restaurantTable.findMany({ orderBy: [{ tableNumber: 'asc' }] });
            return { tables };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to fetch tables', detail: err.message });
        }
    });
    fastify.patch('/api/restaurant/tables/:id', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('restaurant.table_service')] }, async (req, reply) => {
        const { id } = req.params;
        const { status, notes } = req.body;
        try {
            const table = await db_1.prisma.restaurantTable.update({
                where: { id },
                data: {
                    ...(status ? { status } : {}),
                    ...(notes !== undefined ? { notes } : {}),
                },
            });
            return table;
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to update table', detail: err.message });
        }
    });
    fastify.get('/api/kitchen/tickets', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('restaurant.kds')] }, async (_req, reply) => {
        try {
            const tickets = await db_1.prisma.kitchenTicket.findMany({
                include: {
                    table: { select: { id: true, tableNumber: true, status: true } },
                    sale: { select: { id: true, status: true, createdAt: true } },
                },
                orderBy: [{ createdAt: 'asc' }],
            });
            return { tickets };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to fetch tickets', detail: err.message });
        }
    });
    fastify.patch('/api/kitchen/tickets/:id/status', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('restaurant.kds')] }, async (req, reply) => {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) {
            return reply.status(400).send({ error: 'status is required' });
        }
        try {
            const ticket = await db_1.prisma.kitchenTicket.update({
                where: { id },
                data: {
                    status,
                    ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
                },
            });
            return ticket;
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to update ticket status', detail: err.message });
        }
    });
    fastify.get('/api/pharmacy/prescriptions/:rxNumber', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('pharmacy.prescription_validation')] }, async (req, reply) => {
        const { rxNumber } = req.params;
        try {
            const prescription = await db_1.prisma.prescription.findUnique({
                where: { rxNumber },
                include: {
                    customer: { select: { id: true, name: true, email: true } },
                    prescriber: { select: { id: true, name: true, npiNumber: true } },
                    product: { select: { id: true, name: true, sku: true } },
                    items: true,
                },
            });
            if (!prescription) {
                return reply.status(404).send({ error: 'Prescription not found' });
            }
            return prescription;
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to fetch prescription', detail: err.message });
        }
    });
    fastify.get('/api/pharmacy/interactions', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('pharmacy.drug_interactions')] }, async (_req, reply) => {
        try {
            const interactions = await db_1.prisma.drugInteraction.findMany({
                where: { isActive: true },
                include: {
                    product1: { select: { id: true, name: true, sku: true } },
                    product2: { select: { id: true, name: true, sku: true } },
                },
            });
            return { interactions };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to fetch interactions', detail: err.message });
        }
    });
    fastify.post('/api/pharmacy/prescriptions/:id/fill', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('pharmacy.prescription_validation')] }, async (req, reply) => {
        const { id } = req.params;
        try {
            const result = await db_1.prisma.$transaction(async (tx) => {
                const prescription = await tx.prescription.findUnique({ where: { id } });
                if (!prescription) {
                    throw new Error('Prescription not found');
                }
                const now = new Date();
                if (new Date(prescription.expiryDate) < now) {
                    throw new Error('Prescription expired');
                }
                if (prescription.refillsUsed >= prescription.refillsAllowed) {
                    throw new Error('No refills remaining');
                }
                const updated = await tx.prescription.update({
                    where: { id },
                    data: {
                        refillsUsed: { increment: 1 },
                        status: 'FILLED',
                    },
                });
                return updated;
            });
            return result;
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(400).send({ error: 'Failed to fill prescription', detail: err.message });
        }
    });
    fastify.post('/api/pharmacy/overrides', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('pharmacy.controlled_substances')] }, async (req, reply) => {
        const { prescriptionId, pharmacistId, action, reason } = req.body;
        if (!prescriptionId || !pharmacistId || !action || !reason) {
            return reply.status(400).send({ error: 'prescriptionId, pharmacistId, action and reason are required' });
        }
        try {
            const override = await db_1.prisma.pharmacistOverride.create({
                data: {
                    prescriptionId,
                    pharmacistId,
                    action,
                    reason,
                },
            });
            return reply.status(201).send(override);
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to create override', detail: err.message });
        }
    });
    fastify.post('/api/purchases/:id/start-receiving', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('procurement.receiving')] }, async (req, reply) => {
        const { id } = req.params;
        const { startedBy } = req.body;
        try {
            const session = await db_1.prisma.receivingSession.create({
                data: {
                    purchaseOrderId: id,
                    status: 'OPEN',
                    startedBy,
                },
            });
            return reply.status(201).send(session);
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to start receiving session', detail: err.message });
        }
    });
    fastify.post('/api/purchases/:id/receiving/discrepancy', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('procurement.receiving')] }, async (req, reply) => {
        const { id } = req.params;
        const { sessionId, purchaseOrderItemId, qtyExpected, qtyReceived, discrepancyReason, notes } = req.body;
        if (!sessionId || !purchaseOrderItemId || qtyExpected === undefined || qtyReceived === undefined || !discrepancyReason) {
            return reply.status(400).send({ error: 'sessionId, purchaseOrderItemId, qtyExpected, qtyReceived and discrepancyReason are required' });
        }
        try {
            const discrepancy = await db_1.prisma.receivingDiscrepancy.create({
                data: {
                    receivingSessionId: sessionId,
                    purchaseOrderItemId,
                    qtyExpected,
                    qtyReceived,
                    discrepancyReason,
                    notes: notes || `PO ${id} discrepancy`,
                },
            });
            return reply.status(201).send(discrepancy);
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to log discrepancy', detail: err.message });
        }
    });
    fastify.post('/api/purchases/:id/receiving/complete', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('procurement.receiving')] }, async (req, reply) => {
        const { id } = req.params;
        const { sessionId, completedBy } = req.body;
        if (!sessionId) {
            return reply.status(400).send({ error: 'sessionId is required' });
        }
        try {
            const result = await db_1.prisma.$transaction(async (tx) => {
                const session = await tx.receivingSession.update({
                    where: { id: sessionId },
                    data: {
                        status: 'CLOSED',
                        completedAt: new Date(),
                        completedBy,
                    },
                });
                await tx.purchaseOrder.update({
                    where: { id },
                    data: { status: 'RECEIVED' },
                });
                return session;
            });
            return result;
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to complete receiving session', detail: err.message });
        }
    });
    fastify.get('/api/purchases/discrepancies', { preHandler: [authMiddleware_1.requireAuth, (0, capabilityMiddleware_1.requireCapability)('procurement.receiving')] }, async (_req, reply) => {
        try {
            const discrepancies = await db_1.prisma.receivingDiscrepancy.findMany({
                include: {
                    receivingSession: { select: { id: true, purchaseOrderId: true, status: true } },
                    purchaseOrderItem: { select: { id: true, productId: true, qty: true, qtyReceived: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
            return { discrepancies };
        }
        catch (err) {
            fastify.log.error(err);
            return reply.status(500).send({ error: 'Failed to list discrepancies', detail: err.message });
        }
    });
}
