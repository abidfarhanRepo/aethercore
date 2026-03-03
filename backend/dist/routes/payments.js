"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = paymentRoutes;
const db_1 = require("../utils/db");
const stripe_1 = require("../lib/payments/stripe");
const square_1 = require("../lib/payments/square");
const paypal_1 = require("../lib/payments/paypal");
const payments_1 = require("../lib/payments");
// Payment processor instances (initialized when needed)
const processors = {};
/**
 * Authenticate payment endpoints (requires ADMIN or specific permissions)
 */
async function authPaymentAdmin(req, reply) {
    try {
        await req.jwtVerify();
        const user = req.user;
        if (user.role !== 'ADMIN') {
            reply.code(403).send({ error: 'Admin access required' });
        }
    }
    catch (error) {
        reply.code(401).send({ error: 'Unauthorized' });
    }
}
/**
 * Get payment processor instance
 */
function getProcessor(processorName) {
    const name = processorName.toUpperCase();
    if (!processors[name]) {
        throw new Error(`Payment processor not configured: ${name}`);
    }
    return processors[name];
}
/**
 * Initialize processors from database
 */
async function initializeProcessors() {
    const paymentProcessors = await db_1.prisma.paymentProcessor.findMany({
        where: { isActive: true },
    });
    for (const proc of paymentProcessors) {
        const config = {
            apiKey: (0, payments_1.decryptSensitiveData)(proc.apiKey),
        };
        if (proc.secretKey) {
            config.secretKey = (0, payments_1.decryptSensitiveData)(proc.secretKey);
        }
        if (proc.webhookSecret) {
            config.webhookSecret = (0, payments_1.decryptSensitiveData)(proc.webhookSecret);
        }
        switch (proc.name) {
            case 'STRIPE':
                config.webhookSecret = proc.webhookSecret
                    ? (0, payments_1.decryptSensitiveData)(proc.webhookSecret)
                    : '';
                processors['STRIPE'] = new stripe_1.StripeAdapter(config);
                break;
            case 'SQUARE':
                config.applicationId = config.apiKey.split('|')[0]; // Assumed format
                config.locationId = process.env.SQUARE_LOCATION_ID || '';
                processors['SQUARE'] = new square_1.SquareAdapter(config);
                break;
            case 'PAYPAL':
                config.clientId = config.apiKey;
                config.clientSecret = (0, payments_1.decryptSensitiveData)(proc.secretKey || '');
                config.webhookId = process.env.PAYPAL_WEBHOOK_ID || '';
                processors['PAYPAL'] = new paypal_1.PayPalAdapter(config);
                break;
        }
    }
}
async function paymentRoutes(fastify) {
    // Initialize processors on first load
    await initializeProcessors();
    /**
     * POST /payments/process
     * Process payment (generic endpoint that selects processor)
     */
    fastify.post('/payments/process', async (req, reply) => {
        try {
            await req.jwtVerify();
            const user = req.user;
            const { saleId, processor, amount, cardToken, paymentMethodId, cardNumber, expiryMonth, expiryYear, cvv, cardholderName, saveCard, } = req.body;
            // Validate payment amount
            if (!(0, payments_1.validatePaymentAmount)(amount)) {
                return reply
                    .code(400)
                    .send({ error: 'Invalid payment amount' });
            }
            // Validate sale exists
            const sale = await db_1.prisma.sale.findUnique({
                where: { id: saleId },
                include: { customer: true },
            });
            if (!sale) {
                return reply.code(404).send({ error: 'Sale not found' });
            }
            // Verify amount doesn't exceed sale total
            if (amount > sale.totalCents) {
                return reply.code(400).send({
                    error: 'Payment amount exceeds sale total',
                });
            }
            const proc = getProcessor(processor);
            const idempotencyKey = (0, payments_1.generateIdempotencyKey)();
            try {
                let stripeCustomerId = null;
                let paymentMethodIdToUse = paymentMethodId;
                // Create/get customer in processor
                if (sale.customer) {
                    if (processor === 'STRIPE') {
                        stripeCustomerId = await proc.getOrCreateCustomer(sale.customerId, sale.customer.email, sale.customer.name);
                    }
                    else if (processor === 'SQUARE') {
                        // Similar for Square
                    }
                    else if (processor === 'PAYPAL') {
                        // PayPal handles customer differently
                    }
                }
                // Tokenize card if provided
                if (cardNumber &&
                    expiryMonth &&
                    expiryYear &&
                    cvv &&
                    cardholderName &&
                    !paymentMethodId) {
                    if (processor === 'STRIPE' && stripeCustomerId) {
                        const tokenized = await proc.tokenizeCard({
                            cardNumber,
                            expiryMonth,
                            expiryYear,
                            cvc: cvv,
                            cardholderName,
                            customerId: sale.customerId,
                        }, stripeCustomerId);
                        paymentMethodIdToUse = tokenized.paymentMethodId;
                        // Save payment token if requested
                        if (saveCard && sale.customerId) {
                            await db_1.prisma.paymentToken.create({
                                data: {
                                    customerId: sale.customerId,
                                    processorId: (await db_1.prisma.paymentProcessor.findUniqueOrThrow({
                                        where: { name: 'STRIPE' },
                                    })).id,
                                    tokenValue: (0, payments_1.encryptSensitiveData)(tokenized.paymentMethodId),
                                    cardLast4: tokenized.last4,
                                    cardBrand: tokenized.brand,
                                    expiryMonth,
                                    expiryYear,
                                    cardholderName,
                                },
                            });
                        }
                    }
                }
                // Process payment
                let paymentResult;
                if (processor === 'STRIPE') {
                    paymentResult = await proc.processPayment({
                        customerId: stripeCustomerId || 'unknown',
                        amount,
                        currency: 'USD',
                        paymentMethodId: paymentMethodIdToUse,
                        cardToken,
                        description: `Sale ${saleId}`,
                        idempotencyKey,
                        saveCard,
                        statementDescriptor: 'AETHER POS',
                    });
                }
                else if (processor === 'SQUARE') {
                    // Square payment
                }
                else if (processor === 'PAYPAL') {
                    // PayPal payment
                }
                // Get transaction ID (varies by processor)
                const transactionId = paymentResult.transactionId || paymentResult.paymentIntentId;
                // Save payment record
                const paymentRecord = await db_1.prisma.payment.create({
                    data: {
                        saleId,
                        processorId: (await db_1.prisma.paymentProcessor.findUniqueOrThrow({
                            where: { name: processor },
                        })).id,
                        amountCents: amount,
                        currency: 'USD',
                        status: paymentResult.status === 'succeeded'
                            ? 'CAPTURED'
                            : paymentResult.requiresAction
                                ? 'PROCESSING'
                                : 'FAILED',
                        transactionId,
                        paymentIntentId: paymentResult.paymentIntentId,
                        idempotencyKey,
                        cardLast4: cardNumber
                            ? (0, payments_1.getCardLastFour)(cardNumber)
                            : undefined,
                        cardBrand: cardNumber ? (0, payments_1.detectCardBrand)(cardNumber) : undefined,
                        clientSecret: paymentResult.clientSecret,
                        requiresAction: paymentResult.requiresAction || false,
                        actionUrl: paymentResult.actionUrl,
                        createdBy: user.id,
                        processedAt: new Date(),
                    },
                });
                // Log payment attempt
                (0, payments_1.logPaymentAttempt)(transactionId, processor, amount, cardNumber ? (0, payments_1.getCardLastFour)(cardNumber) : 'xxxx', paymentRecord.status === 'CAPTURED' ? 'success' : 'pending');
                return reply.code(201).send({
                    success: true,
                    paymentId: paymentRecord.id,
                    transactionId,
                    status: paymentRecord.status,
                    requiresAction: paymentResult.requiresAction,
                    clientSecret: paymentResult.clientSecret,
                    actionUrl: paymentResult.actionUrl,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                // Log failed payment attempt
                (0, payments_1.logPaymentAttempt)('unknown', processor, amount, cardNumber ? (0, payments_1.getCardLastFour)(cardNumber) : 'xxxx', 'failure', errorMessage);
                return reply.code(400).send({
                    error: 'Payment processing failed',
                    details: errorMessage,
                });
            }
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                error: 'Internal server error',
            });
        }
    });
    /**
     * POST /payments/stripe
     * Process Stripe payment (convenience endpoint)
     */
    fastify.post('/payments/stripe', async (req, reply) => {
        try {
            await req.jwtVerify();
            const { saleId, paymentMethodId, amount, save } = req.body;
            // Reuse main endpoint
            await req.server.inject({
                method: 'POST',
                url: '/payments/process',
                payload: {
                    saleId,
                    processor: 'STRIPE',
                    amount,
                    paymentMethodId,
                    saveCard: save,
                },
                headers: req.headers,
            });
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    /**
     * POST /payments/square
     * Process Square payment
     */
    fastify.post('/payments/square', async (req, reply) => {
        try {
            await req.jwtVerify();
            const { saleId, sourceId, amount } = req.body;
            // Process Square payment
            reply.code(501).send({ error: 'Square payment endpoint not yet implemented' });
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    /**
     * POST /payments/paypal
     * Process PayPal payment
     */
    fastify.post('/payments/paypal', async (req, reply) => {
        try {
            await req.jwtVerify();
            const { saleId, orderId } = req.body;
            const sale = await db_1.prisma.sale.findUnique({
                where: { id: saleId },
            });
            if (!sale) {
                return reply.code(404).send({ error: 'Sale not found' });
            }
            const proc = getProcessor('PAYPAL');
            try {
                const captureResult = await proc.captureOrder({
                    orderId,
                    customerId: sale.customerId || 'unknown',
                });
                const paymentRecord = await db_1.prisma.payment.create({
                    data: {
                        saleId,
                        processorId: (await db_1.prisma.paymentProcessor.findUniqueOrThrow({
                            where: { name: 'PAYPAL' },
                        })).id,
                        amountCents: sale.totalCents,
                        currency: 'USD',
                        status: captureResult.status === 'COMPLETED' ? 'CAPTURED' : 'PROCESSING',
                        transactionId: captureResult.transactionId,
                        idempotencyKey: (0, payments_1.generateIdempotencyKey)(),
                        processedAt: new Date(),
                    },
                });
                return reply.code(201).send({
                    success: true,
                    paymentId: paymentRecord.id,
                    transactionId: captureResult.transactionId,
                    status: paymentRecord.status,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return reply.code(400).send({
                    error: 'PayPal payment failed',
                    details: errorMessage,
                });
            }
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    /**
     * GET /payments/methods
     * List payment methods on file for a customer
     */
    fastify.get('/payments/methods', async (req, reply) => {
        try {
            await req.jwtVerify();
            const { customerId, processor } = req.query;
            const paymentTokens = await db_1.prisma.paymentToken.findMany({
                where: {
                    customerId,
                    processor: processor
                        ? { name: processor }
                        : undefined,
                    status: 'active',
                },
                include: { processor: true },
            });
            const methods = paymentTokens.map((token) => ({
                id: token.id,
                processor: token.processor.name,
                cardLast4: token.cardLast4,
                cardBrand: token.cardBrand,
                isDefault: token.isDefault,
                expiryMonth: token.expiryMonth,
                expiryYear: token.expiryYear,
                createdAt: token.createdAt,
            }));
            return reply.send({
                success: true,
                methods,
            });
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    /**
     * POST /payments/:id/refund
     * Process refund for a payment
     */
    fastify.post('/payments/:id/refund', async (req, reply) => {
        try {
            await req.jwtVerify();
            const user = req.user;
            const { id } = req.params;
            const { amount, reason } = req.body;
            const payment = await db_1.prisma.payment.findUnique({
                where: { id },
                include: { sale: true, processor: true },
            });
            if (!payment) {
                return reply.code(404).send({ error: 'Payment not found' });
            }
            if (payment.status !== 'CAPTURED') {
                return reply.code(400).send({
                    error: 'Only captured payments can be refunded',
                });
            }
            const refundAmountCents = amount || payment.amountCents;
            if (refundAmountCents > payment.amountCents - payment.refundedCents) {
                return reply.code(400).send({
                    error: 'Refund amount exceeds available balance',
                });
            }
            try {
                let refundResult;
                const proc = getProcessor(payment.processor.name);
                if (payment.processor.name === 'STRIPE') {
                    refundResult = await proc.refundPayment({
                        chargeId: payment.transactionId,
                        amountCents: refundAmountCents,
                        reason: reason || 'Requested by merchant',
                    });
                }
                else if (payment.processor.name === 'SQUARE') {
                    refundResult = await proc.refundPayment({
                        paymentId: payment.transactionId,
                        amountCents: refundAmountCents,
                        reason,
                    });
                }
                else if (payment.processor.name === 'PAYPAL') {
                    refundResult = await proc.refundPayment({
                        captureId: payment.transactionId,
                        amountCents: refundAmountCents,
                        reason,
                    });
                }
                // Create refund record
                const refund = await db_1.prisma.refund.create({
                    data: {
                        paymentId: id,
                        amountCents: refundAmountCents,
                        reason: reason || 'CUSTOMER_REQUEST',
                        status: 'COMPLETED',
                        refundId: refundResult.refundId,
                        processedAt: new Date(),
                    },
                });
                // Update payment refunded amount
                await db_1.prisma.payment.update({
                    where: { id },
                    data: {
                        refundedCents: payment.refundedCents + refundAmountCents,
                    },
                });
                (0, payments_1.logPaymentAttempt)(payment.transactionId, payment.processor.name, refundAmountCents, payment.cardLast4 || 'xxxx', 'success');
                return reply.code(201).send({
                    success: true,
                    refundId: refund.id,
                    refundStatus: refund.status,
                    amountRefundedCents: refundAmountCents,
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return reply.code(400).send({
                    error: 'Refund processing failed',
                    details: errorMessage,
                });
            }
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    /**
     * POST /payments/:id/receipt
     * Email receipt
     */
    fastify.post('/payments/:id/receipt', async (req, reply) => {
        try {
            await req.jwtVerify();
            const { id } = req.params;
            const { recipientEmail } = req.body;
            const payment = await db_1.prisma.payment.findUnique({
                where: { id },
                include: { sale: { include: { items: true } } },
            });
            if (!payment) {
                return reply.code(404).send({ error: 'Payment not found' });
            }
            // TODO: Implement email sending logic
            // For now, just acknowledge the request
            return reply.send({
                success: true,
                message: 'Receipt email queued',
            });
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    /**
     * GET /payments/settings
     * Get payment processor configuration (ADMIN only)
     */
    fastify.get('/payments/settings', async (req, reply) => {
        try {
            await authPaymentAdmin(req, reply);
            const processors = await db_1.prisma.paymentProcessor.findMany({
                select: {
                    id: true,
                    name: true,
                    displayName: true,
                    isActive: true,
                    webhookUrl: true,
                    createdAt: true,
                },
            });
            return reply.send({
                success: true,
                processors,
            });
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    /**
     * POST /payments/settings
     * Update payment processor configuration (ADMIN only)
     */
    fastify.post('/payments/settings', async (req, reply) => {
        try {
            await authPaymentAdmin(req, reply);
            const { name, displayName, apiKey, secretKey, webhookSecret, isActive } = req.body;
            // Validate configuration
            const validation = (0, payments_1.validateProcessorConfig)(name, {
                apiKey,
                secretKey,
                webhookSecret,
                applicationId: process.env[`${name.toUpperCase()}_APP_ID`],
                locationId: process.env[`${name.toUpperCase()}_LOCATION_ID`],
            });
            if (!validation.valid) {
                return reply.code(400).send({
                    error: 'Invalid processor configuration',
                    details: validation.errors,
                });
            }
            // Encrypt sensitive data
            const processor = await db_1.prisma.paymentProcessor.upsert({
                where: { name },
                update: {
                    displayName,
                    apiKey: (0, payments_1.encryptSensitiveData)(apiKey),
                    secretKey: secretKey
                        ? (0, payments_1.encryptSensitiveData)(secretKey)
                        : undefined,
                    webhookSecret: webhookSecret
                        ? (0, payments_1.encryptSensitiveData)(webhookSecret)
                        : undefined,
                    isActive,
                },
                create: {
                    name,
                    displayName,
                    apiKey: (0, payments_1.encryptSensitiveData)(apiKey),
                    secretKey: secretKey
                        ? (0, payments_1.encryptSensitiveData)(secretKey)
                        : undefined,
                    webhookSecret: webhookSecret
                        ? (0, payments_1.encryptSensitiveData)(webhookSecret)
                        : undefined,
                    isActive,
                },
            });
            // Reinitialize processors
            await initializeProcessors();
            return reply.code(201).send({
                success: true,
                processor: {
                    id: processor.id,
                    name: processor.name,
                    displayName: processor.displayName,
                    isActive: processor.isActive,
                },
            });
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Internal server error' });
        }
    });
    /**
     * POST /payments/webhooks/stripe
     * Stripe webhook handler
     */
    fastify.post('/payments/webhooks/stripe', async (req, reply) => {
        try {
            const signature = req.headers['stripe-signature'];
            const body = JSON.stringify(req.body);
            const proc = getProcessor('STRIPE');
            const event = proc.verifyWebhookSignature(body, signature);
            if (!event) {
                return reply.code(400).send({ error: 'Invalid signature' });
            }
            // Store webhook event
            await db_1.prisma.paymentWebhookEvent.create({
                data: {
                    processor: 'STRIPE',
                    eventId: event.id,
                    eventType: event.type,
                    payload: event,
                    signature,
                    status: 'VERIFIED',
                },
            });
            // Handle event
            const result = await proc.handleWebhookEvent(event);
            // Update payment status based on event
            if (result && result.transactionId) {
                const payment = await db_1.prisma.payment.findUnique({
                    where: { transactionId: result.transactionId },
                });
                if (payment) {
                    if (result.type === 'payment_succeeded') {
                        await db_1.prisma.payment.update({
                            where: { id: payment.id },
                            data: { status: 'CAPTURED' },
                        });
                    }
                    else if (result.type === 'payment_failed') {
                        await db_1.prisma.payment.update({
                            where: { id: payment.id },
                            data: {
                                status: 'FAILED',
                                errorMessage: result.error,
                            },
                        });
                    }
                }
            }
            return reply.code(200).send({ received: true });
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Webhook processing failed' });
        }
    });
    /**
     * POST /payments/webhooks/square
     * Square webhook handler
     */
    fastify.post('/payments/webhooks/square', async (req, reply) => {
        try {
            const signature = req.headers['x-square-hmac-sha256'];
            const body = JSON.stringify(req.body);
            const proc = getProcessor('SQUARE');
            // Verify signature
            const webhookSecret = process.env.SQUARE_WEBHOOK_SECRET || '';
            if (!proc.verifyWebhookSignature(body, signature, webhookSecret)) {
                return reply.code(400).send({ error: 'Invalid signature' });
            }
            const event = req.body.data.object;
            // Store webhook event
            await db_1.prisma.paymentWebhookEvent.create({
                data: {
                    processor: 'SQUARE',
                    eventId: req.body.id,
                    eventType: req.body.type,
                    payload: req.body,
                    signature,
                    status: 'VERIFIED',
                },
            });
            // Handle event
            const result = await proc.handleWebhookEvent(req.body.type, req.body);
            return reply.code(200).send({ received: true });
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Webhook processing failed' });
        }
    });
    /**
     * POST /payments/webhooks/paypal
     * PayPal webhook handler
     */
    fastify.post('/payments/webhooks/paypal', async (req, reply) => {
        try {
            const transmissionId = req.headers['paypal-transmission-id'];
            const transmissionTime = req.headers['paypal-transmission-time'];
            const certUrl = req.headers['paypal-cert-url'];
            const signature = req.headers['paypal-auth-algo'];
            const body = JSON.stringify(req.body);
            const proc = getProcessor('PAYPAL');
            // Verify signature
            if (!proc.verifyWebhookSignature(body, req.headers['paypal-transmission-sig'], transmissionId, transmissionTime, certUrl)) {
                return reply.code(400).send({ error: 'Invalid signature' });
            }
            // Store webhook event
            await db_1.prisma.paymentWebhookEvent.create({
                data: {
                    processor: 'PAYPAL',
                    eventId: req.body.id,
                    eventType: req.body.event_type,
                    payload: req.body,
                    signature: req.headers['paypal-transmission-sig'],
                    status: 'VERIFIED',
                },
            });
            // Handle event
            const result = await proc.handleWebhookEvent(req.body);
            return reply.code(200).send({ id: req.body.id });
        }
        catch (error) {
            fastify.log.error(error);
            reply.code(500).send({ error: 'Webhook processing failed' });
        }
    });
}
