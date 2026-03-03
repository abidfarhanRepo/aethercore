"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalAdapter = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
class PayPalAdapter {
    constructor(config) {
        this.accessToken = null;
        this.tokenExpiry = 0;
        this.baseUrl = process.env.NODE_ENV === 'production'
            ? 'https://api.paypal.com'
            : 'https://api.sandbox.paypal.com';
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.webhookId = config.webhookId;
        this.client = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 10000,
        });
    }
    /**
     * Get access token from PayPal
     */
    async getAccessToken() {
        // Return cached token if still valid
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }
        try {
            const response = await this.client.post('/v1/oauth2/token', 'grant_type=client_credentials', {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                auth: {
                    username: this.clientId,
                    password: this.clientSecret,
                },
            });
            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000; // Refresh 1 min early
            return this.accessToken;
        }
        catch (error) {
            console.error('Error getting PayPal access token:', error);
            throw new Error(`Failed to obtain PayPal access token: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Create PayPal order
     */
    async createOrder(input) {
        try {
            const accessToken = await this.getAccessToken();
            const response = await this.client.post('/v2/checkout/orders', {
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        reference_id: input.reference,
                        amount: {
                            currency_code: input.currency,
                            value: (input.amountCents / 100).toFixed(2),
                        },
                        description: input.description,
                        custom_id: input.customerId,
                    },
                ],
                payment_source: {
                    paypal: {
                        experience_context: {
                            return_url: input.returnUrl,
                            cancel_url: input.cancelUrl,
                            user_action: 'PAY_NOW',
                        },
                    },
                },
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const order = response.data;
            const approvalLink = order.links?.find((link) => link.rel === 'approve');
            return {
                orderId: order.id,
                status: order.status,
                approvalUrl: approvalLink?.href || '',
            };
        }
        catch (error) {
            console.error('Error creating PayPal order:', error);
            throw new Error(`Order creation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Capture PayPal order
     */
    async captureOrder(input) {
        try {
            const accessToken = await this.getAccessToken();
            const response = await this.client.post(`/v2/checkout/orders/${input.orderId}/capture`, {}, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const order = response.data;
            const purchase = order.purchase_units?.[0];
            const capture = purchase?.payments?.captures?.[0];
            if (capture?.status !== 'COMPLETED') {
                throw new Error(`Payment not completed: ${capture?.status}`);
            }
            return {
                transactionId: capture.id,
                status: capture.status,
                amount: parseInt(capture.amount?.value) * 100,
            };
        }
        catch (error) {
            console.error('Error capturing PayPal order:', error);
            throw new Error(`Order capture failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Refund PayPal payment
     */
    async refundPayment(input) {
        try {
            const accessToken = await this.getAccessToken();
            const response = await this.client.post(`/v2/payments/capture/${input.captureId}/refund`, {
                amount: input.amountCents
                    ? {
                        value: (input.amountCents / 100).toFixed(2),
                        currency_code: 'USD',
                    }
                    : undefined,
                note_to_payer: input.reason || 'Refund requested',
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const refund = response.data;
            return {
                refundId: refund.id,
                status: refund.status,
                amountCents: Math.round(parseFloat(refund.amount?.value) * 100),
            };
        }
        catch (error) {
            console.error('Error refunding PayPal payment:', error);
            throw new Error(`Refund failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Create subscription
     */
    async createSubscription(planId, customerId, startTime) {
        try {
            const accessToken = await this.getAccessToken();
            const response = await this.client.post('/v1/billing/subscriptions', {
                plan_id: planId,
                start_time: startTime.toISOString(),
                subscriber: {
                    name: {
                        given_name: customerId,
                    },
                },
                application_context: {
                    brand_name: 'Aether POS',
                    return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription-complete`,
                    cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/subscription-cancel`,
                },
            }, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    Prefer: 'return=representation',
                },
            });
            const approvalUrl = response.data.links?.find((link) => link.rel === 'approve')?.href;
            return {
                subscriptionId: response.data.id,
                status: response.data.status,
            };
        }
        catch (error) {
            console.error('Error creating PayPal subscription:', error);
            throw new Error(`Subscription creation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get order details
     */
    async getOrder(orderId) {
        try {
            const accessToken = await this.getAccessToken();
            const response = await this.client.get(`/v2/checkout/orders/${orderId}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return response.data;
        }
        catch (error) {
            console.error('Error retrieving order:', error);
            throw error;
        }
    }
    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(webhookId, eventBody, signature, transmissionId, transmissionTime, certUrl) {
        try {
            // Expected signature format: v1=<hash>
            const [algorithm, expectedHash] = signature.split('=');
            if (algorithm !== 'v1') {
                console.error('Unsupported signature algorithm:', algorithm);
                return false;
            }
            // Create message to verify
            const message = `${transmissionId}|${transmissionTime}|${webhookId}|${eventBody}`;
            // Create HMAC (using webhook secret)
            const hash = crypto_1.default
                .createHmac('sha256', this.clientSecret)
                .update(message)
                .digest('base64');
            return hash === expectedHash;
        }
        catch (error) {
            console.error('Webhook signature verification failed:', error);
            return false;
        }
    }
    /**
     * Handle webhook event
     */
    async handleWebhookEvent(event) {
        switch (event.event_type) {
            case 'CHECKOUT.ORDER.COMPLETED':
                return this.handleOrderCompleted(event.resource);
            case 'CHECKOUT.ORDER.APPROVED':
                return this.handleOrderApproved(event.resource);
            case 'PAYMENT.CAPTURE.COMPLETED':
                return this.handlePaymentCompleted(event.resource);
            case 'PAYMENT.CAPTURE.REFUNDED':
                return this.handlePaymentRefunded(event.resource);
            case 'PAYMENT.CAPTURE.DECLINED':
                return this.handlePaymentDeclined(event.resource);
            default:
                console.log(`Unhandled PayPal event type: ${event.event_type}`);
                return null;
        }
    }
    handleOrderCompleted(resource) {
        return {
            type: 'order_completed',
            orderId: resource.id,
            status: resource.status,
            amount: resource.purchase_units?.[0]?.amount?.value,
        };
    }
    handleOrderApproved(resource) {
        return {
            type: 'order_approved',
            orderId: resource.id,
            status: resource.status,
        };
    }
    handlePaymentCompleted(resource) {
        return {
            type: 'payment_completed',
            captureId: resource.id,
            status: resource.status,
            amount: resource.amount?.value,
        };
    }
    handlePaymentRefunded(resource) {
        return {
            type: 'payment_refunded',
            refundId: resource.id,
            status: resource.status,
            amount: resource.amount?.value,
        };
    }
    handlePaymentDeclined(resource) {
        return {
            type: 'payment_declined',
            captureId: resource.id,
            status: resource.status,
            reason: resource.supplementary_data?.related_ids?.reason_code,
        };
    }
}
exports.PayPalAdapter = PayPalAdapter;
