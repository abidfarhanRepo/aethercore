import axios, { AxiosInstance } from 'axios'
import crypto from 'crypto'

/**
 * PayPal Payment Processor Adapter
 * Handles PayPal API integration for standard and recurring payments
 */

interface PayPalConfig {
  clientId: string
  clientSecret: string
  webhookId: string
}

interface PayPalTokenResponse {
  scope: string
  access_token: string
  token_type: string
  app_id: string
  expires_in: number
}

interface PayPalCreateOrderInput {
  amountCents: number
  currency: string
  reference: string
  description: string
  returnUrl: string
  cancelUrl: string
  customerId?: string
}

interface PayPalCaptureOrderInput {
  orderId: string
  customerId: string
}

interface PayPalRefundInput {
  captureId: string
  amountCents?: number
  reason?: string
}

interface PayPalWebhookEvent {
  id: string
  event_type: string
  create_time: string
  resource: Record<string, any>
  status?: string
}

export class PayPalAdapter {
  private clientId: string
  private clientSecret: string
  private webhookId: string
  private client: AxiosInstance
  private accessToken: string | null = null
  private tokenExpiry: number = 0
  private baseUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com'

  constructor(config: PayPalConfig) {
    this.clientId = config.clientId
    this.clientSecret = config.clientSecret
    this.webhookId = config.webhookId

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    })
  }

  /**
   * Get access token from PayPal
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    try {
      const response = await this.client.post<PayPalTokenResponse>(
        '/v1/oauth2/token',
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          auth: {
            username: this.clientId,
            password: this.clientSecret,
          },
        }
      )

      this.accessToken = response.data.access_token
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000 // Refresh 1 min early

      return this.accessToken
    } catch (error) {
      console.error('Error getting PayPal access token:', error)
      throw new Error(
        `Failed to obtain PayPal access token: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  /**
   * Create PayPal order
   */
  async createOrder(input: PayPalCreateOrderInput): Promise<{
    orderId: string
    status: string
    approvalUrl: string
  }> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await this.client.post(
        '/v2/checkout/orders',
        {
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
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const order = response.data
      const approvalLink = order.links?.find(
        (link: any) => link.rel === 'approve'
      )

      return {
        orderId: order.id,
        status: order.status,
        approvalUrl: approvalLink?.href || '',
      }
    } catch (error) {
      console.error('Error creating PayPal order:', error)
      throw new Error(
        `Order creation failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Capture PayPal order
   */
  async captureOrder(input: PayPalCaptureOrderInput): Promise<{
    transactionId: string
    status: string
    amount: number
  }> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await this.client.post(
        `/v2/checkout/orders/${input.orderId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const order = response.data
      const purchase = order.purchase_units?.[0]
      const capture = purchase?.payments?.captures?.[0]

      if (capture?.status !== 'COMPLETED') {
        throw new Error(`Payment not completed: ${capture?.status}`)
      }

      return {
        transactionId: capture.id,
        status: capture.status,
        amount: parseInt(capture.amount?.value) * 100,
      }
    } catch (error) {
      console.error('Error capturing PayPal order:', error)
      throw new Error(
        `Order capture failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Refund PayPal payment
   */
  async refundPayment(input: PayPalRefundInput): Promise<{
    refundId: string
    status: string
    amountCents: number
  }> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await this.client.post(
        `/v2/payments/capture/${input.captureId}/refund`,
        {
          amount: input.amountCents
            ? {
                value: (input.amountCents / 100).toFixed(2),
                currency_code: 'USD',
              }
            : undefined,
          note_to_payer: input.reason || 'Refund requested',
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const refund = response.data

      return {
        refundId: refund.id,
        status: refund.status,
        amountCents: Math.round(parseFloat(refund.amount?.value) * 100),
      }
    } catch (error) {
      console.error('Error refunding PayPal payment:', error)
      throw new Error(
        `Refund failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Create subscription
   */
  async createSubscription(
    planId: string,
    customerId: string,
    startTime: Date
  ): Promise<{
    subscriptionId: string
    status: string
  }> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await this.client.post(
        '/v1/billing/subscriptions',
        {
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
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
        }
      )

      const approvalUrl = response.data.links?.find(
        (link: any) => link.rel === 'approve'
      )?.href

      return {
        subscriptionId: response.data.id,
        status: response.data.status,
      }
    } catch (error) {
      console.error('Error creating PayPal subscription:', error)
      throw new Error(
        `Subscription creation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken()

      const response = await this.client.get(`/v2/checkout/orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      return response.data
    } catch (error) {
      console.error('Error retrieving order:', error)
      throw error
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    webhookId: string,
    eventBody: any,
    signature: string,
    transmissionId: string,
    transmissionTime: string,
    certUrl: string
  ): boolean {
    try {
      // Expected signature format: v1=<hash>
      const [algorithm, expectedHash] = signature.split('=')

      if (algorithm !== 'v1') {
        console.error('Unsupported signature algorithm:', algorithm)
        return false
      }

      // Create message to verify
      const message = `${transmissionId}|${transmissionTime}|${webhookId}|${eventBody}`

      // Create HMAC (using webhook secret)
      const hash = crypto
        .createHmac('sha256', this.clientSecret)
        .update(message)
        .digest('base64')

      return hash === expectedHash
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return false
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhookEvent(
    event: PayPalWebhookEvent
  ): Promise<Record<string, any>> {
    switch (event.event_type) {
      case 'CHECKOUT.ORDER.COMPLETED':
        return this.handleOrderCompleted(event.resource)
      case 'CHECKOUT.ORDER.APPROVED':
        return this.handleOrderApproved(event.resource)
      case 'PAYMENT.CAPTURE.COMPLETED':
        return this.handlePaymentCompleted(event.resource)
      case 'PAYMENT.CAPTURE.REFUNDED':
        return this.handlePaymentRefunded(event.resource)
      case 'PAYMENT.CAPTURE.DECLINED':
        return this.handlePaymentDeclined(event.resource)
      default:
        console.log(`Unhandled PayPal event type: ${event.event_type}`)
        return {
          type: 'unhandled_event',
          eventType: event.event_type,
        }
    }
  }

  private handleOrderCompleted(resource: any): any {
    return {
      type: 'order_completed',
      orderId: resource.id,
      status: resource.status,
      amount: resource.purchase_units?.[0]?.amount?.value,
    }
  }

  private handleOrderApproved(resource: any): any {
    return {
      type: 'order_approved',
      orderId: resource.id,
      status: resource.status,
    }
  }

  private handlePaymentCompleted(resource: any): any {
    return {
      type: 'payment_completed',
      captureId: resource.id,
      status: resource.status,
      amount: resource.amount?.value,
    }
  }

  private handlePaymentRefunded(resource: any): any {
    return {
      type: 'payment_refunded',
      refundId: resource.id,
      status: resource.status,
      amount: resource.amount?.value,
    }
  }

  private handlePaymentDeclined(resource: any): any {
    return {
      type: 'payment_declined',
      captureId: resource.id,
      status: resource.status,
      reason: resource.supplementary_data?.related_ids?.reason_code,
    }
  }
}
