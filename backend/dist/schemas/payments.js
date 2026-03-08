"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePaymentSettingsBodySchema = exports.receiptBodySchema = exports.refundPaymentBodySchema = exports.paymentIdParamsSchema = exports.paymentMethodsQuerySchema = exports.paypalPaymentBodySchema = exports.squarePaymentBodySchema = exports.stripePaymentBodySchema = exports.processPaymentBodySchema = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
const processorSchema = zod_1.z.enum(['STRIPE', 'SQUARE', 'PAYPAL']);
exports.processPaymentBodySchema = zod_1.z.object({
    saleId: common_1.idSchema,
    processor: processorSchema,
    amount: zod_1.z.number().int().positive(),
    cardToken: zod_1.z.string().trim().optional(),
    paymentMethodId: zod_1.z.string().trim().optional(),
    cardNumber: zod_1.z.string().trim().optional(),
    expiryMonth: zod_1.z.number().int().min(1).max(12).optional(),
    expiryYear: zod_1.z.number().int().min(2024).optional(),
    cvv: zod_1.z.string().trim().optional(),
    cardholderName: zod_1.z.string().trim().optional(),
    saveCard: zod_1.z.boolean().optional(),
});
exports.stripePaymentBodySchema = zod_1.z.object({
    saleId: common_1.idSchema,
    paymentMethodId: zod_1.z.string().trim().min(1),
    amount: zod_1.z.number().int().positive(),
    save: zod_1.z.boolean().optional(),
});
exports.squarePaymentBodySchema = zod_1.z.object({
    saleId: common_1.idSchema,
    sourceId: zod_1.z.string().trim().min(1),
    amount: zod_1.z.number().int().positive(),
});
exports.paypalPaymentBodySchema = zod_1.z.object({
    saleId: common_1.idSchema,
    orderId: zod_1.z.string().trim().min(1),
});
exports.paymentMethodsQuerySchema = zod_1.z.object({
    customerId: common_1.idSchema,
    processor: zod_1.z.string().trim().optional(),
});
exports.paymentIdParamsSchema = zod_1.z.object({
    id: common_1.idSchema,
});
exports.refundPaymentBodySchema = zod_1.z.object({
    amount: zod_1.z.number().int().positive().optional(),
    reason: zod_1.z.string().trim().optional(),
});
exports.receiptBodySchema = zod_1.z.object({
    recipientEmail: zod_1.z.string().email(),
});
exports.updatePaymentSettingsBodySchema = zod_1.z.object({
    name: processorSchema,
    displayName: zod_1.z.string().trim().min(1),
    apiKey: zod_1.z.string().trim().optional(),
    secretKey: zod_1.z.string().trim().optional(),
    webhookSecret: zod_1.z.string().trim().optional(),
    isActive: zod_1.z.boolean(),
    enabled: zod_1.z.boolean().optional(),
    dummyMode: zod_1.z.boolean().optional(),
});
