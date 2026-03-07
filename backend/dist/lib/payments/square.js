"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquareAdapter = void 0;
const square_1 = require("square");
const logger_1 = require("../../utils/logger");
class SquareAdapter {
    constructor(config) {
        this.client = new square_1.Client({
            accessToken: config.apiKey,
            environment: process.env.NODE_ENV === 'production'
                ? square_1.Environment.Production
                : square_1.Environment.Sandbox,
        });
        this.locationId = config.locationId;
    }
    /**
     * Create or get Square customer
     */
    async getOrCreateCustomer(customerId, customerEmail, customerName) {
        try {
            const { result } = await this.client.customersApi.searchCustomers({
                query: {
                    filter: {
                        emailAddress: {
                            exact: customerEmail,
                        },
                    },
                },
            });
            if (result.customers && result.customers.length > 0) {
                return result.customers[0].id || '';
            }
            // Create new customer
            const { result: newCustomer } = await this.client.customersApi.createCustomer({
                givenName: customerName.split(' ')[0],
                familyName: customerName.split(' ').slice(1).join(' '),
                emailAddress: customerEmail,
                referenceId: customerId,
            });
            return newCustomer.customer?.id || '';
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Error creating Square customer');
            throw new Error(`Failed to create Square customer: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Store payment method (tokenize)
     */
    async tokenizePaymentMethod(input, squareCustomerId) {
        try {
            // In production, card data should come from Square Web Payments SDK
            // We store the sourceId (nonce) which is PCI-compliant
            const sourceId = input.sourceId;
            return {
                paymentSourceId: sourceId,
                last4: 'xxxx', // Would be populated from actual card details
                brand: 'UNKNOWN', // Would be determined from token response
            };
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Error tokenizing payment method');
            throw new Error(`Payment method tokenization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Process payment through Square
     */
    async processPayment(input) {
        try {
            const { result } = await this.client.paymentsApi.createPayment({
                sourceId: input.sourceId,
                amountMoney: {
                    amount: BigInt(input.amountCents),
                    currency: input.currency,
                },
                customerId: input.customerId,
                idempotencyKey: input.idempotencyKey,
                orderId: input.orderId,
                statementDescriptorSuffix: input.statementDescriptor?.substring(0, 20),
                receiptUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/receipt`,
                note: input.metadata?.note,
            });
            if (!result.payment) {
                throw new Error('No payment result returned');
            }
            return {
                transactionId: result.payment.id || '',
                status: result.payment.status || 'unknown',
                orderId: result.payment.orderId,
                receiptUrl: result.payment.receiptUrl,
            };
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Error processing Square payment');
            throw new Error(`Payment processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Create order for payment
     */
    async createOrder(customerId, amountCents, currency, lineItems) {
        try {
            const { result } = await this.client.ordersApi.createOrder(this.locationId, {
                customerId,
                lineItems: lineItems.map((item) => ({
                    name: item.name,
                    quantity: item.quantity.toString(),
                    basePriceMoney: {
                        amount: BigInt(item.amount),
                        currency,
                    },
                })),
                totalMoney: {
                    amount: BigInt(amountCents),
                    currency,
                },
            });
            return result.order?.id || '';
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Error creating order');
            throw new Error(`Order creation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Process refund
     */
    async refundPayment(input) {
        try {
            const { result } = await this.client.refundsApi.refundPayment({
                paymentId: input.paymentId,
                amountMoney: input.amountCents
                    ? {
                        amount: BigInt(input.amountCents),
                        currency: 'USD',
                    }
                    : undefined,
                reason: input.reason,
            });
            if (!result.refund) {
                throw new Error('No refund result returned');
            }
            return {
                refundId: result.refund.id || '',
                status: result.refund.status || 'unknown',
                amountCents: Number(result.refund.amountMoney?.amount || 0),
            };
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Error refunding Square payment');
            throw new Error(`Payment refund failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Retrieve payment details
     */
    async getPayment(paymentId) {
        try {
            const { result } = await this.client.paymentsApi.getPayment(paymentId);
            return result.payment;
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Error retrieving payment');
            throw error;
        }
    }
    /**
     * Search payments
     */
    async searchPayments(customerId, beginTime) {
        try {
            const { result } = await this.client.paymentsApi.listPayments(beginTime ? String(beginTime) : undefined, 100, undefined, customerId);
            return result.payments || [];
        }
        catch (error) {
            logger_1.logger.error({ error }, 'Error searching payments');
            throw error;
        }
    }
    /**
     * Handle webhook event
     */
    async handleWebhookEvent(eventType, payload) {
        switch (eventType) {
            case 'payment.created':
                return this.handlePaymentCreated(payload);
            case 'payment.updated':
                return this.handlePaymentUpdated(payload);
            case 'payment.completed':
                return this.handlePaymentCompleted(payload);
            case 'refund.created':
                return this.handleRefundCreated(payload);
            case 'refund.updated':
                return this.handleRefundUpdated(payload);
            default:
                logger_1.logger.info({ eventType }, 'Unhandled Square event type');
                return null;
        }
    }
    handlePaymentCreated(payload) {
        return {
            type: 'payment_created',
            paymentId: payload.data?.object?.payment?.id,
            status: payload.data?.object?.payment?.status,
        };
    }
    handlePaymentUpdated(payload) {
        return {
            type: 'payment_updated',
            paymentId: payload.data?.object?.payment?.id,
            status: payload.data?.object?.payment?.status,
        };
    }
    handlePaymentCompleted(payload) {
        return {
            type: 'payment_completed',
            paymentId: payload.data?.object?.payment?.id,
            status: 'completed',
        };
    }
    handleRefundCreated(payload) {
        return {
            type: 'refund_created',
            refundId: payload.data?.object?.refund?.id,
            paymentId: payload.data?.object?.refund?.paymentId,
            status: payload.data?.object?.refund?.status,
        };
    }
    handleRefundUpdated(payload) {
        return {
            type: 'refund_updated',
            refundId: payload.data?.object?.refund?.id,
            status: payload.data?.object?.refund?.status,
        };
    }
    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(body, signature, webhookSecret) {
        try {
            const hash = crypto_1.default
                .createHmac('sha256', webhookSecret)
                .update(body)
                .digest('base64');
            return hash === signature;
        }
        catch {
            return false;
        }
    }
}
exports.SquareAdapter = SquareAdapter;
const crypto_1 = __importDefault(require("crypto"));
