"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryHoldConflictError = void 0;
exports.reserveInventoryHold = reserveInventoryHold;
exports.releaseInventoryHolds = releaseInventoryHolds;
exports.cleanupExpiredInventoryHolds = cleanupExpiredInventoryHolds;
const db_1 = require("../utils/db");
const HOLD_TTL_MINUTES = 15;
class InventoryHoldConflictError extends Error {
    constructor(message = 'Insufficient inventory available for hold') {
        super(message);
        this.code = 'HOLD_EXHAUSTED';
        this.name = 'InventoryHoldConflictError';
    }
}
exports.InventoryHoldConflictError = InventoryHoldConflictError;
function resolveCommittedSales(sumQtyDelta) {
    const normalized = sumQtyDelta ?? 0;
    return normalized < 0 ? Math.abs(normalized) : 0;
}
async function reserveInventoryHold(tx, input) {
    const tenantId = input.tenantId || 'global';
    const now = new Date();
    // Serialize concurrent reservations for the same location.
    await tx.$queryRaw `
    SELECT 1
    FROM "InventoryLocation"
    WHERE "productId" = ${input.productId}
      AND "warehouseId" = ${input.warehouseId}
    FOR UPDATE
  `;
    const location = await tx.inventoryLocation.findUnique({
        where: {
            productId_warehouseId: {
                productId: input.productId,
                warehouseId: input.warehouseId,
            },
        },
        select: { qty: true },
    });
    if (!location) {
        throw new InventoryHoldConflictError('Inventory location not found for product');
    }
    const [activeHolds, committedSales] = await Promise.all([
        tx.inventoryHold.aggregate({
            _sum: { quantity: true },
            where: {
                productId: input.productId,
                tenantId,
                expiresAt: { gt: now },
            },
        }),
        tx.inventoryTransaction.aggregate({
            _sum: { qtyDelta: true },
            where: {
                productId: input.productId,
                warehouseId: input.warehouseId,
                type: 'SALE',
                qtyDelta: { lt: 0 },
            },
        }),
    ]);
    const availableBefore = location.qty -
        (activeHolds._sum.quantity ?? 0) -
        resolveCommittedSales(committedSales._sum.qtyDelta);
    if (availableBefore < input.quantity) {
        throw new InventoryHoldConflictError('Insufficient reserved inventory');
    }
    const hold = await tx.inventoryHold.create({
        data: {
            productId: input.productId,
            tenantId,
            quantity: input.quantity,
            expiresAt: new Date(now.getTime() + HOLD_TTL_MINUTES * 60 * 1000),
            sessionId: input.sessionId,
        },
        select: { id: true },
    });
    return {
        holdId: hold.id,
        availableBefore,
    };
}
async function releaseInventoryHolds(tx, holdIds) {
    if (holdIds.length === 0) {
        return 0;
    }
    const released = await tx.inventoryHold.deleteMany({
        where: {
            id: { in: holdIds },
        },
    });
    return released.count;
}
async function cleanupExpiredInventoryHolds(db = db_1.prisma) {
    const result = await db.inventoryHold.deleteMany({
        where: {
            expiresAt: { lte: new Date() },
        },
    });
    return result.count;
}
