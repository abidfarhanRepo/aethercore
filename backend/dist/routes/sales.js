"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = salesRoutes;
const db_1 = require("../utils/db");
const discountEngine_1 = require("../utils/discountEngine");
const paymentEngine_1 = require("../utils/paymentEngine");
const hookBus_1 = require("../lib/hookBus");
async function salesRoutes(fastify) {
    // ============ POST /sales - Create Sale ============
    fastify.post('/api/sales', async (req, reply) => {
        const body = req.body;
        try {
            let actorUserId = body.userId;
            // Prefer authenticated user when token is provided.
            try {
                await req.jwtVerify();
                const authUser = req.user;
                if (authUser?.id) {
                    actorUserId = authUser.id;
                }
            }
            catch {
                // Non-authenticated/internal flows may still pass explicit body.userId.
            }
            if (!actorUserId) {
                const fallbackUser = await db_1.prisma.user.findFirst({
                    where: { isActive: true },
                    orderBy: { createdAt: 'asc' },
                    select: { id: true },
                });
                actorUserId = fallbackUser?.id;
            }
            if (!actorUserId) {
                return reply.status(400).send({
                    error: 'No valid user context for sale creation',
                    code: 'USER_CONTEXT_REQUIRED',
                    statusCode: 400,
                });
            }
            await hookBus_1.coreHookBus.emit('beforeSaleFinalize', {
                userId: actorUserId,
                receiptPublicId: body.receiptPublicId,
                terminalId: body.terminalId,
            });
            const result = await db_1.prisma.$transaction(async (tx) => {
                const parsedClientCreatedAt = body.clientCreatedAt
                    ? new Date(body.clientCreatedAt)
                    : undefined;
                if (parsedClientCreatedAt && Number.isNaN(parsedClientCreatedAt.getTime())) {
                    throw new Error('Invalid clientCreatedAt');
                }
                // Validate all products exist and have stock
                const itemsToCreate = body.items || [];
                const products = await Promise.all(itemsToCreate.map(async (item) => {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    if (!product)
                        throw new Error(`Product ${item.productId} not found`);
                    return product;
                }));
                // Get default warehouse
                let warehouse = await tx.warehouse.findFirst();
                if (!warehouse) {
                    warehouse = await tx.warehouse.create({
                        data: { name: 'Default Warehouse', location: 'Default' },
                    });
                }
                // Calculate subtotal
                let subtotalCents = itemsToCreate.reduce((sum, item) => sum + (item.qty * item.unitPrice), 0);
                // Apply discounts
                const discountsToApply = [];
                let totalDiscountCents = 0;
                // Apply segment-based discount if customer provided
                if (body.customerId) {
                    const customer = await tx.customer.findUnique({ where: { id: body.customerId } });
                    if (customer?.segment) {
                        const segmentDiscount = (0, discountEngine_1.calculateSegmentDiscount)(customer.segment, subtotalCents);
                        if (segmentDiscount) {
                            discountsToApply.push({
                                reason: 'LOYALTY',
                                type: 'PERCENTAGE',
                                amountCents: segmentDiscount.amountCents,
                                percentage: segmentDiscount.percentage,
                                description: segmentDiscount.description,
                            });
                            totalDiscountCents += segmentDiscount.amountCents;
                        }
                    }
                }
                // Apply manual discounts if provided
                if (body.discounts && Array.isArray(body.discounts)) {
                    for (const discountInput of body.discounts) {
                        const discount = (0, discountEngine_1.calculateDiscount)(subtotalCents - totalDiscountCents, discountInput);
                        discountsToApply.push(discount);
                        totalDiscountCents += discount.amountCents;
                    }
                }
                // Apply bulk discount if applicable
                const totalQty = itemsToCreate.reduce((sum, item) => sum + item.qty, 0);
                const bulkDiscount = (0, discountEngine_1.calculateBulkDiscount)(totalQty, subtotalCents - totalDiscountCents, [
                    { minQty: 10, discountPercent: 5 },
                    { minQty: 25, discountPercent: 10 },
                    { minQty: 50, discountPercent: 15 },
                ]);
                if (bulkDiscount && !body.discounts?.some((d) => d.reason === 'BULK')) {
                    discountsToApply.push(bulkDiscount);
                    totalDiscountCents += bulkDiscount.amountCents;
                }
                // Validate discount total
                if (!(0, discountEngine_1.validateDiscoundApplication)(subtotalCents, discountsToApply)) {
                    throw new Error('Discounts exceed 50% of subtotal');
                }
                // Calculate tax (10% for now - would be configurable)
                const taxableCents = subtotalCents - totalDiscountCents;
                const taxCents = Math.floor((taxableCents * 10) / 100);
                const totalCents = taxableCents + taxCents;
                // Validate payment
                let payments = [];
                if (body.payments && Array.isArray(body.payments)) {
                    const paymentValidation = (0, paymentEngine_1.validateSplitPayment)(body.payments, totalCents);
                    if (!paymentValidation.isValid) {
                        throw new Error(paymentValidation.error);
                    }
                    payments = body.payments;
                }
                else {
                    // Single payment method
                    const singlePayment = (0, paymentEngine_1.validatePayment)({ method: body.paymentMethod || 'CASH', amountCents: totalCents }, totalCents);
                    if (!singlePayment.isValid) {
                        throw new Error(singlePayment.error);
                    }
                    payments = [{ method: body.paymentMethod || 'CASH', amountCents: totalCents }];
                }
                // Create sale
                const sale = await tx.sale.create({
                    data: {
                        userId: actorUserId,
                        customerId: body.customerId,
                        receiptPublicId: body.receiptPublicId,
                        terminalId: body.terminalId,
                        offlineOpId: body.offlineOpId,
                        syncState: body.syncState || 'online_created',
                        clientCreatedAt: parsedClientCreatedAt,
                        subtotalCents,
                        totalCents,
                        discountCents: totalDiscountCents,
                        taxCents,
                        paymentMethod: body.paymentMethod || 'CASH',
                        status: 'completed',
                        notes: body.notes,
                    },
                });
                // Distribute discounts to line items
                const lineDiscounts = (0, discountEngine_1.distributeDiscountToItems)(itemsToCreate.map((item, idx) => ({
                    id: `item-${idx}`,
                    qty: item.qty,
                    unitPrice: item.unitPrice,
                })), totalDiscountCents);
                // Create sale items
                for (let idx = 0; idx < itemsToCreate.length; idx++) {
                    const item = itemsToCreate[idx];
                    const lineDiscount = lineDiscounts[idx]?.discountCents || 0;
                    await tx.saleItem.create({
                        data: {
                            saleId: sale.id,
                            productId: item.productId,
                            qty: item.qty,
                            unitPrice: item.unitPrice,
                            discountCents: lineDiscount,
                        },
                    });
                    // Create inventory transaction
                    await hookBus_1.coreHookBus.emit('beforeInventoryCommit', {
                        saleId: sale.id,
                        productId: item.productId,
                        qtyDelta: -item.qty,
                        reason: 'SALE',
                    });
                    await tx.inventoryTransaction.create({
                        data: {
                            productId: item.productId,
                            warehouseId: warehouse.id,
                            qtyDelta: -item.qty,
                            type: 'SALE',
                            reason: 'SALE',
                            createdBy: actorUserId,
                            reference: sale.id,
                        },
                    });
                    await hookBus_1.coreHookBus.emit('afterInventoryCommit', {
                        saleId: sale.id,
                        productId: item.productId,
                        qtyDelta: -item.qty,
                        reason: 'SALE',
                    });
                    // Phase 3 FEFO support: if lot data exists, consume oldest-expiring batches first.
                    const lotBatches = await tx.lotBatch?.findMany?.({
                        where: {
                            productId: item.productId,
                            warehouseId: warehouse.id,
                            qtyAvailable: { gt: 0 },
                        },
                        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
                    });
                    if (Array.isArray(lotBatches) && lotBatches.length > 0) {
                        let remaining = item.qty;
                        for (const lot of lotBatches) {
                            if (remaining <= 0) {
                                break;
                            }
                            const consume = Math.min(remaining, lot.qtyAvailable);
                            if (consume > 0) {
                                await tx.lotBatch.update({
                                    where: { id: lot.id },
                                    data: { qtyAvailable: { decrement: consume } },
                                });
                                remaining -= consume;
                            }
                        }
                    }
                }
                // Create discount records
                for (const discount of discountsToApply) {
                    await tx.saleDiscount.create({
                        data: {
                            saleId: sale.id,
                            reason: discount.reason,
                            type: discount.type,
                            amountCents: discount.amountCents,
                            percentage: discount.percentage || 0,
                            description: discount.description,
                        },
                    });
                }
                // Create payment records
                for (const payment of payments) {
                    await tx.salePayment.create({
                        data: {
                            saleId: sale.id,
                            method: payment.method,
                            amountCents: payment.amountCents,
                            reference: payment.reference,
                            notes: payment.notes,
                        },
                    });
                }
                // Update customer loyalty points if applicable
                if (body.customerId) {
                    const pointsEarned = Math.floor(subtotalCents / 100); // 1 point per $1
                    await tx.customer.update({
                        where: { id: body.customerId },
                        data: { loyaltyPoints: { increment: pointsEarned } },
                    });
                }
                return {
                    id: sale.id,
                    totalCents,
                    discountCents: totalDiscountCents,
                    taxCents,
                    itemCount: itemsToCreate.length,
                    paymentMethods: payments.map(p => p.method),
                };
            });
            // Audit log
            try {
                if (fastify.createAudit) {
                    await fastify.createAudit('sale_created', { saleId: result.id }, actorUserId);
                }
            }
            catch (ae) {
                fastify.log.warn('Failed to write audit', ae);
            }
            await hookBus_1.coreHookBus.emit('afterSaleFinalize', {
                saleId: result.id,
                userId: actorUserId,
            });
            return reply.code(201).send(result);
        }
        catch (e) {
            fastify.log.error('Sale creation error:', e);
            // Differentiate error types for better debugging
            if (e.message.includes('not found')) {
                return reply.status(404).send({
                    error: e.message,
                    code: 'PRODUCT_NOT_FOUND',
                    statusCode: 404
                });
            }
            if (e.message.includes('Discounts exceed')) {
                return reply.status(422).send({
                    error: e.message,
                    code: 'INVALID_DISCOUNT',
                    statusCode: 422
                });
            }
            if (e.message.includes('Payment')) {
                return reply.status(422).send({
                    error: e.message,
                    code: 'PAYMENT_MISMATCH',
                    statusCode: 422
                });
            }
            if (e.message.includes('Foreign key constraint')) {
                return reply.status(400).send({
                    error: 'Invalid user reference for sale',
                    code: 'INVALID_USER_REFERENCE',
                    statusCode: 400,
                });
            }
            // Generic validation error
            return reply.status(400).send({
                error: e.message || 'Failed to create sale',
                code: 'VALIDATION_ERROR',
                statusCode: 400
            });
        }
    });
    // ============ GET /sales - List Sales ============
    fastify.get('/api/sales', async (req, reply) => {
        const query = req.query;
        const where = {};
        if (query.status)
            where.status = query.status;
        if (query.paymentMethod)
            where.paymentMethod = query.paymentMethod;
        if (query.customerId)
            where.customerId = query.customerId;
        // Date range filtering
        if (query.startDate || query.endDate) {
            where.createdAt = {};
            if (query.startDate) {
                where.createdAt.gte = new Date(query.startDate);
            }
            if (query.endDate) {
                where.createdAt.lte = new Date(query.endDate);
            }
        }
        const limit = Math.min(parseInt(query.limit) || 50, 100);
        const offset = Math.max(parseInt(query.offset) || 0, 0);
        const [sales, total] = await Promise.all([
            db_1.prisma.sale.findMany({
                where,
                include: {
                    items: { include: { product: true } },
                    payments: true,
                    discounts: true,
                    customer: true,
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            db_1.prisma.sale.count({ where }),
        ]);
        return {
            data: sales,
            pagination: { limit, offset, total, hasMore: offset + limit < total },
        };
    });
    // ============ GET /sales/:id - Get Sale Details ============
    fastify.get('/api/sales/:id', async (req, reply) => {
        const { id } = req.params;
        const sale = await db_1.prisma.sale.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        product: true,
                        returns: true,
                    },
                },
                payments: true,
                discounts: true,
                returns: {
                    include: {
                        item: { include: { product: true } },
                    },
                },
                customer: true,
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
            },
        });
        if (!sale) {
            return reply.status(404).send({ error: 'Sale not found' });
        }
        return sale;
    });
    // ============ POST /sales/:id/refund - Process Refund ============
    fastify.post('/api/sales/:id/refund', async (req, reply) => {
        const { id } = req.params;
        const body = req.body;
        try {
            await hookBus_1.coreHookBus.emit('beforeRefund', {
                saleId: id,
                type: body.type,
                reason: body.reason,
            });
            const sale = await db_1.prisma.sale.findUnique({
                where: { id },
                include: { items: true, customer: true },
            });
            if (!sale) {
                return reply.status(404).send({ error: 'Sale not found' });
            }
            let refundAmountCents = 0;
            if (body.type === 'full') {
                // Full refund
                refundAmountCents = sale.totalCents;
            }
            else if (body.type === 'partial' && body.items && Array.isArray(body.items)) {
                // Partial refund with specific items
                for (const refundItem of body.items) {
                    const saleItem = sale.items.find(si => si.id === refundItem.itemId);
                    if (!saleItem) {
                        return reply.status(400).send({ error: `Item ${refundItem.itemId} not in sale` });
                    }
                    const itemTotal = (saleItem.unitPrice * refundItem.qty);
                    refundAmountCents += itemTotal;
                }
            }
            else {
                return reply.status(400).send({ error: 'Invalid refund type or items' });
            }
            // Process refund
            const refund = await db_1.prisma.$transaction(async (tx) => {
                // Update customer credit if needed
                if (sale.customerId) {
                    await tx.customer.update({
                        where: { id: sale.customerId },
                        data: { creditBalance: { increment: refundAmountCents } },
                    });
                }
                // Create return records
                const returnRecords = [];
                if (body.type === 'full') {
                    for (const saleItem of sale.items) {
                        const returnRecord = await tx.saleReturn.create({
                            data: {
                                saleId: id,
                                itemId: saleItem.id,
                                qty: saleItem.qty,
                                reason: body.reason || 'CUSTOMER_REQUEST',
                                notes: body.notes,
                                refundAmountCents: saleItem.unitPrice * saleItem.qty,
                            },
                        });
                        returnRecords.push(returnRecord);
                    }
                }
                else if (body.items) {
                    for (const refundItem of body.items) {
                        const saleItem = sale.items.find(si => si.id === refundItem.itemId);
                        if (saleItem) {
                            const returnRecord = await tx.saleReturn.create({
                                data: {
                                    saleId: id,
                                    itemId: refundItem.itemId,
                                    qty: refundItem.qty,
                                    reason: body.reason || 'CUSTOMER_REQUEST',
                                    notes: body.notes,
                                    refundAmountCents: saleItem.unitPrice * refundItem.qty,
                                },
                            });
                            returnRecords.push(returnRecord);
                        }
                    }
                }
                return {
                    saleId: id,
                    refundAmountCents,
                    type: body.type,
                    reason: body.reason,
                    returnCount: returnRecords.length,
                };
            });
            // Audit
            if (fastify.createAudit) {
                await fastify.createAudit('sale_refunded', refund, req.userId);
            }
            await hookBus_1.coreHookBus.emit('afterRefund', {
                saleId: id,
                type: body.type,
                refundAmountCents,
            });
            return reply.code(201).send(refund);
        }
        catch (e) {
            fastify.log.error(e);
            return reply.status(400).send({ error: e.message || 'Failed to process refund' });
        }
    });
    // ============ POST /sales/:id/return - Process Return ============
    fastify.post('/api/sales/:id/return', async (req, reply) => {
        const { id } = req.params;
        const body = req.body;
        try {
            await hookBus_1.coreHookBus.emit('beforeRefund', {
                saleId: id,
                type: 'return',
                reason: body.reason,
            });
            const saleReturn = await db_1.prisma.saleReturn.create({
                data: {
                    saleId: id,
                    itemId: body.itemId,
                    qty: body.qty,
                    reason: body.reason || 'CHANGE_MIND',
                    notes: body.notes,
                    refundAmountCents: body.refundAmountCents || 0,
                },
            });
            // Update inventory if needed
            if (body.restockQty && body.restockQty > 0) {
                const item = await db_1.prisma.saleItem.findUnique({
                    where: { id: body.itemId },
                    include: { product: true },
                });
                if (item) {
                    const warehouse = await db_1.prisma.warehouse.findFirst();
                    if (warehouse) {
                        await hookBus_1.coreHookBus.emit('beforeInventoryCommit', {
                            saleId: id,
                            productId: item.productId,
                            qtyDelta: body.restockQty,
                            reason: 'RETURN',
                        });
                        await db_1.prisma.inventoryTransaction.create({
                            data: {
                                productId: item.productId,
                                warehouseId: warehouse.id,
                                qtyDelta: body.restockQty,
                                type: 'RETURN',
                                reason: body.reason,
                                reference: saleReturn.id,
                                createdBy: req.userId || 'system',
                            },
                        });
                        await hookBus_1.coreHookBus.emit('afterInventoryCommit', {
                            saleId: id,
                            productId: item.productId,
                            qtyDelta: body.restockQty,
                            reason: 'RETURN',
                        });
                    }
                }
            }
            await hookBus_1.coreHookBus.emit('afterRefund', {
                saleId: id,
                type: 'return',
                returnId: saleReturn.id,
            });
            return reply.code(201).send(saleReturn);
        }
        catch (e) {
            fastify.log.error(e);
            return reply.status(400).send({ error: e.message || 'Failed to process return' });
        }
    });
    // ============ POST /sales/:id/void - Void Sale ============
    fastify.post('/api/sales/:id/void', async (req, reply) => {
        const { id } = req.params;
        const body = req.body;
        try {
            const sale = await db_1.prisma.sale.findUnique({
                where: { id },
                include: { items: true },
            });
            if (!sale) {
                return reply.status(404).send({ error: 'Sale not found' });
            }
            if (sale.status === 'voided') {
                return reply.status(400).send({ error: 'Sale already voided' });
            }
            await db_1.prisma.$transaction(async (tx) => {
                // Update sale status
                await tx.sale.update({
                    where: { id },
                    data: { status: 'voided', notes: body.reason || 'Void requested' },
                });
                // Restore inventory
                const warehouse = await tx.warehouse.findFirst();
                if (warehouse && sale.items.length > 0) {
                    for (const item of sale.items) {
                        await hookBus_1.coreHookBus.emit('beforeInventoryCommit', {
                            saleId: id,
                            productId: item.productId,
                            qtyDelta: item.qty,
                            reason: 'VOID',
                        });
                        await tx.inventoryTransaction.create({
                            data: {
                                productId: item.productId,
                                warehouseId: warehouse.id,
                                qtyDelta: item.qty,
                                type: 'RETURN',
                                reason: 'VOID',
                                reference: id,
                                createdBy: req.userId || 'system',
                            },
                        });
                        await hookBus_1.coreHookBus.emit('afterInventoryCommit', {
                            saleId: id,
                            productId: item.productId,
                            qtyDelta: item.qty,
                            reason: 'VOID',
                        });
                    }
                }
            });
            // Audit
            if (fastify.createAudit) {
                await fastify.createAudit('sale_voided', { saleId: id }, req.userId);
            }
            return {
                saleId: id,
                status: 'voided',
                itemsRestored: sale.items.length,
            };
        }
        catch (e) {
            fastify.log.error(e);
            return reply.status(400).send({ error: e.message || 'Failed to void sale' });
        }
    });
    // ============ GET /sales/analytics/summary - Sales Analytics ============
    fastify.get('/api/sales/analytics/summary', async (req, reply) => {
        const query = req.query;
        const period = query.period || 'daily'; // daily, weekly, monthly
        const startDate = query.startDate ? new Date(query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = query.endDate ? new Date(query.endDate) : new Date();
        const sales = await db_1.prisma.sale.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
                status: 'completed',
            },
            include: { items: true, discounts: true },
        });
        // Group by period
        const grouped = {};
        for (const sale of sales) {
            let key;
            if (period === 'daily') {
                key = sale.createdAt.toISOString().split('T')[0];
            }
            else if (period === 'weekly') {
                const date = new Date(sale.createdAt);
                const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
                key = weekStart.toISOString().split('T')[0];
            }
            else {
                key = sale.createdAt.toISOString().substring(0, 7);
            }
            if (!grouped[key]) {
                grouped[key] = {
                    date: key,
                    salesCount: 0,
                    totalRevenue: 0,
                    totalDiscount: 0,
                    totalTax: 0,
                    totalItems: 0,
                    avgSaleValue: 0,
                };
            }
            grouped[key].salesCount += 1;
            grouped[key].totalRevenue += sale.totalCents;
            grouped[key].totalDiscount += sale.discountCents;
            grouped[key].totalTax += sale.taxCents;
            grouped[key].totalItems += sale.items.length;
        }
        // Calculate averages
        const summary = Object.values(grouped).map((g) => ({
            ...g,
            avgSaleValue: g.salesCount > 0 ? Math.floor(g.totalRevenue / g.salesCount) : 0,
            totalRevenue: g.totalRevenue,
            totalDiscount: g.totalDiscount,
            totalTax: g.totalTax,
        }));
        return {
            period,
            startDate,
            endDate,
            totalSalesCount: sales.length,
            totalRevenue: sales.reduce((sum, s) => sum + s.totalCents, 0),
            totalDiscount: sales.reduce((sum, s) => sum + s.discountCents, 0),
            totalTax: sales.reduce((sum, s) => sum + s.taxCents, 0),
            summary: summary.sort((a, b) => a.date.localeCompare(b.date)),
        };
    });
}
