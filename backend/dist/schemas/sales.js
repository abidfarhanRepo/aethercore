"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voidBodySchema = exports.returnBodySchema = exports.refundBodySchema = exports.salesAnalyticsQuerySchema = exports.listSalesQuerySchema = exports.createSaleBodySchema = exports.saleIdParamsSchema = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
exports.saleIdParamsSchema = zod_1.z.object({
    id: common_1.idSchema,
});
exports.createSaleBodySchema = zod_1.z.object({
    items: zod_1.z.array(common_1.saleItemSchema).min(1),
    customerId: common_1.idSchema.optional(),
    userId: common_1.idSchema.optional(),
    receiptPublicId: zod_1.z.string().trim().optional(),
    terminalId: zod_1.z.string().trim().optional(),
    sessionId: zod_1.z.string().trim().optional(),
    offlineOpId: zod_1.z.string().trim().optional(),
    syncState: zod_1.z.string().trim().optional(),
    paymentMethod: zod_1.z.string().trim().optional(),
    notes: zod_1.z.string().trim().optional(),
    clientCreatedAt: zod_1.z.string().datetime().optional(),
    discounts: zod_1.z.array(zod_1.z.object({
        reason: zod_1.z.string().trim().min(1),
        type: zod_1.z.enum(['PERCENTAGE', 'FIXED']),
        value: zod_1.z.number().nonnegative(),
    })).optional(),
    payments: zod_1.z.array(common_1.paymentLineSchema).optional(),
});
exports.listSalesQuerySchema = zod_1.z.object({
    status: zod_1.z.string().trim().optional(),
    paymentMethod: zod_1.z.string().trim().optional(),
    customerId: common_1.idSchema.optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional(),
    offset: zod_1.z.coerce.number().int().min(0).optional(),
});
exports.salesAnalyticsQuerySchema = zod_1.z.object({
    period: zod_1.z.enum(['daily', 'weekly', 'monthly']).optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
});
exports.refundBodySchema = zod_1.z.object({
    type: zod_1.z.enum(['full', 'partial']),
    reason: zod_1.z.string().trim().optional(),
    notes: zod_1.z.string().trim().optional(),
    items: zod_1.z.array(zod_1.z.object({
        itemId: common_1.idSchema,
        qty: zod_1.z.number().int().positive(),
    })).optional(),
}).superRefine((value, ctx) => {
    if (value.type === 'partial' && (!value.items || value.items.length === 0)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: 'items are required for partial refund', path: ['items'] });
    }
});
exports.returnBodySchema = zod_1.z.object({
    itemId: common_1.idSchema,
    qty: zod_1.z.number().int().positive(),
    reason: zod_1.z.string().trim().optional(),
    notes: zod_1.z.string().trim().optional(),
    refundAmountCents: zod_1.z.number().int().nonnegative().optional(),
    restockQty: zod_1.z.number().int().nonnegative().optional(),
});
exports.voidBodySchema = zod_1.z.object({
    reason: zod_1.z.string().trim().min(1),
});
