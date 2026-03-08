"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentLineSchema = exports.saleItemSchema = exports.paginationQuerySchema = exports.optionalStringSchema = exports.nonNegativeIntSchema = exports.positiveIntSchema = exports.idSchema = exports.uuidLikeSchema = void 0;
const zod_1 = require("zod");
exports.uuidLikeSchema = zod_1.z.string().min(1);
exports.idSchema = zod_1.z.string().min(1);
exports.positiveIntSchema = zod_1.z.number().int().positive();
exports.nonNegativeIntSchema = zod_1.z.number().int().nonnegative();
exports.optionalStringSchema = zod_1.z.string().trim().min(1).optional();
exports.paginationQuerySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional(),
    offset: zod_1.z.coerce.number().int().min(0).optional(),
});
exports.saleItemSchema = zod_1.z.object({
    productId: exports.idSchema,
    qty: exports.positiveIntSchema,
    unitPrice: exports.nonNegativeIntSchema,
});
exports.paymentLineSchema = zod_1.z.object({
    method: zod_1.z.string().trim().min(1),
    amountCents: exports.nonNegativeIntSchema,
    reference: zod_1.z.string().trim().min(1).optional(),
    notes: zod_1.z.string().trim().min(1).optional(),
});
