"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replayDeadLetterParamsSchema = exports.syncBatchBodySchema = exports.syncOperationSchema = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
exports.syncOperationSchema = zod_1.z.object({
    id: zod_1.z.string().trim().optional(),
    offlineOpId: zod_1.z.string().trim().optional(),
    terminalId: zod_1.z.string().trim().optional(),
    endpoint: zod_1.z.string().trim().min(1),
    operationType: zod_1.z.enum(['POST', 'PUT', 'DELETE']).optional(),
    type: zod_1.z.enum(['POST', 'PUT', 'DELETE']).optional(),
    clientCreatedAt: zod_1.z.string().datetime().optional(),
    data: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.syncBatchBodySchema = zod_1.z.object({
    operations: zod_1.z.array(exports.syncOperationSchema),
});
exports.replayDeadLetterParamsSchema = zod_1.z.object({
    id: common_1.idSchema,
});
