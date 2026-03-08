"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.warehouseInitBodySchema = exports.recountInventoryBodySchema = exports.transferInventoryBodySchema = exports.adjustInventoryBodySchema = exports.inventoryProductParamsSchema = exports.inventoryListQuerySchema = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
exports.inventoryListQuerySchema = zod_1.z.object({
    warehouseId: common_1.idSchema.optional(),
});
exports.inventoryProductParamsSchema = zod_1.z.object({
    productId: common_1.idSchema,
});
exports.adjustInventoryBodySchema = zod_1.z.object({
    productId: common_1.idSchema,
    warehouseId: common_1.idSchema.optional(),
    qtyDelta: zod_1.z.number().int(),
    reason: zod_1.z.string().trim().optional(),
    notes: zod_1.z.string().trim().optional(),
    costPerUnit: zod_1.z.number().nonnegative().optional(),
});
exports.transferInventoryBodySchema = zod_1.z.object({
    productId: common_1.idSchema,
    fromWarehouseId: common_1.idSchema,
    toWarehouseId: common_1.idSchema,
    qty: zod_1.z.number().int().positive(),
    notes: zod_1.z.string().trim().optional(),
});
exports.recountInventoryBodySchema = zod_1.z.object({
    warehouseId: common_1.idSchema,
    sessionName: zod_1.z.string().trim().min(1),
    notes: zod_1.z.string().trim().optional(),
    items: zod_1.z.array(zod_1.z.object({
        productId: common_1.idSchema,
        countedQty: zod_1.z.number().int().nonnegative(),
    })).min(1),
});
exports.warehouseInitBodySchema = zod_1.z.object({
    name: zod_1.z.string().trim().optional(),
    location: zod_1.z.string().trim().optional(),
    address: zod_1.z.string().trim().optional(),
}).optional();
