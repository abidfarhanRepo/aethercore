"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProductBodySchema = exports.createProductBodySchema = exports.productParamsSchema = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
exports.productParamsSchema = zod_1.z.object({
    id: common_1.idSchema,
});
exports.createProductBodySchema = zod_1.z.object({
    sku: zod_1.z.string().trim().min(1),
    name: zod_1.z.string().trim().min(1),
    description: zod_1.z.string().trim().optional(),
    priceCents: zod_1.z.number().int().nonnegative(),
    costCents: zod_1.z.number().int().nonnegative().optional(),
});
exports.updateProductBodySchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).optional(),
    description: zod_1.z.string().trim().optional(),
    priceCents: zod_1.z.number().int().nonnegative().optional(),
    costCents: zod_1.z.number().int().nonnegative().optional(),
}).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
});
