"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = syncRoutes;
const client_1 = require("@prisma/client");
const db_1 = require("../utils/db");
const authMiddleware_1 = require("../plugins/authMiddleware");
const hookBus_1 = require("../lib/hookBus");
const MAX_REPLAY_ATTEMPTS = 5;
const BASE_REPLAY_BACKOFF_SECONDS = 5;
const MAX_REPLAY_BACKOFF_SECONDS = 300;
function normalizeOperationType(op) {
    return op.operationType || op.type || 'POST';
}
function normalizeId(op, index) {
    return op.id || op.offlineOpId || `op-${index + 1}`;
}
function parseClientCreatedAt(value) {
    if (!value) {
        return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    return parsed;
}
function getOperationClientCreatedAt(operation) {
    const dataCreatedAt = typeof operation.data?.clientCreatedAt === 'string'
        ? operation.data.clientCreatedAt
        : undefined;
    return parseClientCreatedAt(operation.clientCreatedAt || dataCreatedAt);
}
function normalizeEndpoint(endpoint) {
    if (!endpoint.startsWith('/')) {
        return `/${endpoint}`;
    }
    return endpoint;
}
function toSaleItems(rawItems) {
    if (!Array.isArray(rawItems)) {
        return [];
    }
    const items = [];
    for (const raw of rawItems) {
        const item = raw;
        const productId = typeof item.productId === 'string' ? item.productId : '';
        const qty = typeof item.qty === 'number' ? item.qty : Number(item.qty || 0);
        const unitPrice = typeof item.unitPrice === 'number'
            ? item.unitPrice
            : Number(item.unitPrice || 0);
        if (productId && qty > 0 && unitPrice >= 0) {
            items.push({ productId, qty, unitPrice });
        }
    }
    return items;
}
function toSalePayments(rawPayments, fallbackTotal, paymentMethod) {
    if (!Array.isArray(rawPayments) || rawPayments.length === 0) {
        return [{ method: paymentMethod, amountCents: fallbackTotal }];
    }
    const payments = [];
    for (const raw of rawPayments) {
        const p = raw;
        const method = typeof p.method === 'string' ? p.method : paymentMethod;
        const amountCents = typeof p.amountCents === 'number'
            ? p.amountCents
            : Number(p.amountCents || 0);
        if (amountCents > 0) {
            payments.push({
                method,
                amountCents,
                reference: typeof p.reference === 'string' ? p.reference : undefined,
                notes: typeof p.notes === 'string' ? p.notes : undefined,
            });
        }
    }
    if (payments.length === 0) {
        return [{ method: paymentMethod, amountCents: fallbackTotal }];
    }
    return payments;
}
function toInt(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.floor(value);
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
        return Math.floor(parsed);
    }
    return fallback;
}
function computeReplayBackoffSeconds(attemptCount) {
    const exponent = Math.max(0, attemptCount - 1);
    const raw = BASE_REPLAY_BACKOFF_SECONDS * Math.pow(2, exponent);
    return Math.min(MAX_REPLAY_BACKOFF_SECONDS, raw);
}
function sortOperations(operations) {
    const compareWithinTerminal = (a, b) => {
        const aDate = getOperationClientCreatedAt(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bDate = getOperationClientCreatedAt(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (aDate !== bDate) {
            return aDate - bDate;
        }
        const aKey = a.offlineOpId || a.id || '';
        const bKey = b.offlineOpId || b.id || '';
        if (aKey < bKey) {
            return -1;
        }
        if (aKey > bKey) {
            return 1;
        }
        return 0;
    };
    const byTerminal = new Map();
    for (const operation of operations) {
        const terminalKey = operation.terminalId && operation.terminalId.length > 0
            ? operation.terminalId
            : '';
        const grouped = byTerminal.get(terminalKey);
        if (grouped) {
            grouped.push(operation);
        }
        else {
            byTerminal.set(terminalKey, [operation]);
        }
    }
    const terminalOrder = [...byTerminal.keys()].sort((a, b) => {
        if (a === '' && b !== '') {
            return 1;
        }
        if (a !== '' && b === '') {
            return -1;
        }
        return a.localeCompare(b);
    });
    const ordered = [];
    for (const terminalId of terminalOrder) {
        const grouped = byTerminal.get(terminalId) || [];
        ordered.push(...grouped.sort(compareWithinTerminal));
    }
    return ordered;
}
async function persistDeadLetter(params) {
    const { operation, operationId, errorCode, errorDetail } = params;
    const existing = operation.offlineOpId
        ? await db_1.prisma.syncDeadLetter.findUnique({ where: { offlineOpId: operation.offlineOpId } })
        : null;
    if (existing) {
        const updated = await db_1.prisma.syncDeadLetter.update({
            where: { id: existing.id },
            data: {
                attemptCount: { increment: 1 },
                errorCode,
                errorDetail,
                status: 'open',
                lastFailedAt: new Date(),
            },
            select: { id: true },
        });
        return updated.id;
    }
    const created = await db_1.prisma.syncDeadLetter.create({
        data: {
            terminalId: operation.terminalId,
            offlineOpId: operation.offlineOpId,
            endpoint: normalizeEndpoint(operation.endpoint),
            operationType: normalizeOperationType(operation),
            payload: {
                operationId,
                ...operation,
            },
            errorCode,
            errorDetail,
        },
        select: { id: true },
    });
    return created.id;
}
async function resolveUserId(rawUserId) {
    if (typeof rawUserId === 'string' && rawUserId.length > 0) {
        return rawUserId;
    }
    const fallbackUser = await db_1.prisma.user.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    });
    if (!fallbackUser) {
        throw new Error('No active user available for sync sale creation');
    }
    return fallbackUser.id;
}
async function createSaleFromOperation(operation) {
    const data = (operation.data || {});
    const items = toSaleItems(data.items);
    if (items.length === 0) {
        throw new Error('Sale operation is missing valid items');
    }
    const subtotalComputed = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const discountCents = toInt(data.discountCents, 0);
    const subtotalCents = toInt(data.subtotalCents, subtotalComputed);
    const taxableCents = Math.max(subtotalCents - discountCents, 0);
    const taxCents = toInt(data.taxCents, Math.floor((taxableCents * 10) / 100));
    const totalCents = toInt(data.totalCents, taxableCents + taxCents);
    const paymentMethod = typeof data.paymentMethod === 'string' ? data.paymentMethod : 'CASH';
    const payments = toSalePayments(data.payments, totalCents, paymentMethod);
    const userId = await resolveUserId(data.userId);
    const clientCreatedAt = getOperationClientCreatedAt(operation);
    const result = await db_1.prisma.$transaction(async (tx) => {
        let warehouse = await tx.warehouse.findFirst({ select: { id: true } });
        if (!warehouse) {
            warehouse = await tx.warehouse.create({
                data: {
                    name: 'Default Warehouse',
                    location: 'Default',
                },
                select: { id: true },
            });
        }
        const sale = await tx.sale.create({
            data: {
                userId,
                customerId: typeof data.customerId === 'string' ? data.customerId : undefined,
                receiptPublicId: typeof data.receiptPublicId === 'string' ? data.receiptPublicId : undefined,
                terminalId: typeof data.terminalId === 'string' ? data.terminalId : operation.terminalId,
                offlineOpId: typeof data.offlineOpId === 'string' ? data.offlineOpId : operation.offlineOpId,
                syncState: 'offline_synced',
                clientCreatedAt,
                subtotalCents,
                totalCents,
                discountCents,
                taxCents,
                paymentMethod,
                status: 'completed',
                notes: typeof data.notes === 'string' ? data.notes : undefined,
            },
            select: { id: true, receiptPublicId: true },
        });
        for (const item of items) {
            await tx.saleItem.create({
                data: {
                    saleId: sale.id,
                    productId: item.productId,
                    qty: item.qty,
                    unitPrice: item.unitPrice,
                    discountCents: 0,
                },
            });
            await tx.inventoryTransaction.create({
                data: {
                    productId: item.productId,
                    warehouseId: warehouse.id,
                    qtyDelta: -item.qty,
                    type: 'SALE',
                    reason: 'SALE',
                    reference: sale.id,
                    createdBy: userId,
                },
            });
        }
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
        return sale;
    });
    return result;
}
async function syncRoutes(fastify) {
    fastify.post('/api/sync/batch', async (req, reply) => {
        const body = req.body;
        if (!body || !Array.isArray(body.operations)) {
            return reply.status(400).send({
                error: 'Invalid request: operations must be an array',
                code: 'INVALID_OPERATIONS',
            });
        }
        const results = [];
        const operations = sortOperations(body.operations);
        for (let index = 0; index < operations.length; index++) {
            const operation = operations[index];
            const operationId = normalizeId(operation, index);
            const endpoint = normalizeEndpoint(operation.endpoint);
            const operationType = normalizeOperationType(operation);
            try {
                if (operation.offlineOpId) {
                    const existingSale = await db_1.prisma.sale.findUnique({
                        where: { offlineOpId: operation.offlineOpId },
                        select: { id: true, receiptPublicId: true },
                    });
                    if (existingSale) {
                        results.push({
                            id: operationId,
                            status: 'duplicate',
                            saleId: existingSale.id,
                            receiptPublicId: existingSale.receiptPublicId,
                        });
                        continue;
                    }
                }
                if (operationType === 'POST' && (endpoint === '/api/sales' || endpoint === '/sales')) {
                    try {
                        const createdSale = await createSaleFromOperation(operation);
                        results.push({
                            id: operationId,
                            status: 'created',
                            saleId: createdSale.id,
                            receiptPublicId: createdSale.receiptPublicId,
                        });
                    }
                    catch (error) {
                        const targetMeta = (error instanceof client_1.Prisma.PrismaClientKnownRequestError)
                            ? error.meta?.target
                            : undefined;
                        const targetText = Array.isArray(targetMeta)
                            ? targetMeta.join(',')
                            : (typeof targetMeta === 'string' ? targetMeta : '');
                        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError
                            && error.code === 'P2002'
                            && targetText.includes('receiptPublicId')) {
                            const deadLetterId = await persistDeadLetter({
                                operation,
                                operationId,
                                errorCode: 'RECEIPT_PUBLIC_ID_CONFLICT',
                                errorDetail: error.message,
                            });
                            results.push({
                                id: operationId,
                                status: 'conflict',
                                deadLetterId,
                                message: 'receiptPublicId already exists',
                            });
                            await hookBus_1.coreHookBus.emit('onSyncConflict', {
                                operationId,
                                endpoint,
                                reason: 'RECEIPT_PUBLIC_ID_CONFLICT',
                                deadLetterId,
                            });
                            continue;
                        }
                        throw error;
                    }
                    continue;
                }
                const deadLetterId = await persistDeadLetter({
                    operation,
                    operationId,
                    errorCode: 'UNSUPPORTED_ENDPOINT',
                    errorDetail: `Unsupported operation: ${operationType} ${endpoint}`,
                });
                results.push({
                    id: operationId,
                    status: 'dead_lettered',
                    deadLetterId,
                    message: `Unsupported operation: ${operationType} ${endpoint}`,
                });
                await hookBus_1.coreHookBus.emit('onSyncConflict', {
                    operationId,
                    endpoint,
                    reason: 'UNSUPPORTED_ENDPOINT',
                    deadLetterId,
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                const normalizedMessage = message.toLowerCase();
                const isInventoryConflict = normalizedMessage.includes('stock') || normalizedMessage.includes('insufficient');
                const errorCode = isInventoryConflict ? 'INVENTORY_CONFLICT' : 'SYNC_OPERATION_FAILED';
                const resultStatus = isInventoryConflict ? 'conflict' : 'error';
                const deadLetterId = await persistDeadLetter({
                    operation,
                    operationId,
                    errorCode,
                    errorDetail: message,
                });
                results.push({
                    id: operationId,
                    status: resultStatus,
                    deadLetterId,
                    message,
                });
                await hookBus_1.coreHookBus.emit('onSyncConflict', {
                    operationId,
                    endpoint,
                    reason: errorCode,
                    deadLetterId,
                    message,
                });
            }
        }
        return reply.status(200).send({
            results,
            processedAt: new Date().toISOString(),
        });
    });
    fastify.get('/api/sync/status', async () => {
        const [total, open, replayed, resolved] = await Promise.all([
            db_1.prisma.syncDeadLetter.count(),
            db_1.prisma.syncDeadLetter.count({ where: { status: 'open' } }),
            db_1.prisma.syncDeadLetter.count({ where: { status: 'replayed' } }),
            db_1.prisma.syncDeadLetter.count({ where: { resolvedAt: { not: null } } }),
        ]);
        return {
            status: 'ready',
            acceptsBatch: true,
            deadLetter: {
                total,
                open,
                replayed,
                resolved,
            },
            readiness: {
                syncEnabled: true,
                replayEnabled: true,
            },
            checkedAt: new Date().toISOString(),
        };
    });
    fastify.get('/api/sync/dead-letter', async () => {
        const items = await db_1.prisma.syncDeadLetter.findMany({
            where: {
                status: 'open',
                resolvedAt: null,
            },
            orderBy: [
                { lastFailedAt: 'desc' },
                { createdAt: 'desc' },
            ],
            select: {
                id: true,
                terminalId: true,
                offlineOpId: true,
                endpoint: true,
                operationType: true,
                errorCode: true,
                errorDetail: true,
                attemptCount: true,
                lastFailedAt: true,
                createdAt: true,
            },
        });
        return {
            items,
            count: items.length,
            fetchedAt: new Date().toISOString(),
        };
    });
    fastify.post('/api/sync/dead-letter/:id/replay', {
        preHandler: [authMiddleware_1.requireAuth, (0, authMiddleware_1.requireRole)('ADMIN', 'MANAGER', 'SUPERVISOR')],
    }, async (req, reply) => {
        const deadLetterId = req.params.id;
        const deadLetter = await db_1.prisma.syncDeadLetter.findUnique({ where: { id: deadLetterId } });
        if (!deadLetter) {
            return reply.status(404).send({
                error: 'Dead letter not found',
                code: 'DEAD_LETTER_NOT_FOUND',
            });
        }
        const payload = deadLetter.payload;
        const endpoint = normalizeEndpoint(deadLetter.endpoint);
        if (deadLetter.operationType !== 'POST' || !(endpoint === '/api/sales' || endpoint === '/sales')) {
            return reply.status(422).send({
                error: 'Replay supports only sale create operations',
                code: 'REPLAY_UNSUPPORTED_OPERATION',
            });
        }
        if (deadLetter.attemptCount >= MAX_REPLAY_ATTEMPTS && deadLetter.resolvedAt === null) {
            await db_1.prisma.syncDeadLetter.update({
                where: { id: deadLetter.id },
                data: {
                    status: 'discarded',
                    resolvedAt: new Date(),
                },
            });
            return reply.status(409).send({
                id: deadLetter.id,
                status: 'discarded',
                code: 'RETRY_BUDGET_EXCEEDED',
                error: 'Replay retry budget exceeded',
            });
        }
        // Enforce backend replay cooldown so retries are not spammed manually.
        if (deadLetter.resolvedAt === null) {
            const backoffSeconds = computeReplayBackoffSeconds(deadLetter.attemptCount);
            const nextAllowedAt = new Date(deadLetter.lastFailedAt.getTime() + (backoffSeconds * 1000));
            const now = new Date();
            if (now < nextAllowedAt) {
                const retryAfterSeconds = Math.max(1, Math.ceil((nextAllowedAt.getTime() - now.getTime()) / 1000));
                return reply.status(429).send({
                    id: deadLetter.id,
                    status: deadLetter.status,
                    code: 'REPLAY_BACKOFF_ACTIVE',
                    error: 'Replay is temporarily throttled by exponential backoff',
                    retryAfterSeconds,
                    nextAllowedAt: nextAllowedAt.toISOString(),
                });
            }
        }
        try {
            const createdSale = await createSaleFromOperation(payload);
            await db_1.prisma.syncDeadLetter.update({
                where: { id: deadLetter.id },
                data: {
                    status: 'replayed',
                    resolvedAt: new Date(),
                },
            });
            return reply.status(200).send({
                id: deadLetter.id,
                status: 'replayed',
                saleId: createdSale.id,
                receiptPublicId: createdSale.receiptPublicId,
            });
        }
        catch (error) {
            const nextAttemptCount = deadLetter.attemptCount + 1;
            const shouldDiscard = nextAttemptCount >= MAX_REPLAY_ATTEMPTS;
            await db_1.prisma.syncDeadLetter.update({
                where: { id: deadLetter.id },
                data: {
                    status: shouldDiscard ? 'discarded' : 'open',
                    resolvedAt: shouldDiscard ? new Date() : null,
                    lastFailedAt: new Date(),
                    attemptCount: { increment: 1 },
                    errorCode: 'REPLAY_FAILED',
                    errorDetail: error instanceof Error ? error.message : 'Unknown replay error',
                },
            });
            return reply.status(409).send({
                id: deadLetter.id,
                status: shouldDiscard ? 'discarded' : 'open',
                error: error instanceof Error ? error.message : 'Replay failed',
            });
        }
    });
}
