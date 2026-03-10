"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCashSessionsQuerySchema = exports.cashSessionIdParamsSchema = exports.closeCashSessionBodySchema = exports.openCashSessionBodySchema = void 0;
const zod_1 = require("zod");
exports.openCashSessionBodySchema = zod_1.z.object({
    terminalId: zod_1.z.string().trim().min(1).max(100).optional(),
    openingFloatCents: zod_1.z.number().int().min(0),
});
exports.closeCashSessionBodySchema = zod_1.z.object({
    declaredCashCents: zod_1.z.number().int().min(0),
});
exports.cashSessionIdParamsSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1),
});
exports.listCashSessionsQuerySchema = zod_1.z.object({
    terminalId: zod_1.z.string().trim().min(1).optional(),
    dateFrom: zod_1.z.string().datetime().optional(),
    dateTo: zod_1.z.string().datetime().optional(),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(50),
    offset: zod_1.z.coerce.number().int().min(0).default(0),
});
