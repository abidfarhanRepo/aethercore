import { Client, Environment } from 'square'
import { logger } from '../../utils/logger'

/**
 * Square Payment Processor Adapter
 * Handles Square API integration for card payments, digital wallets, and hardware readers
 */

interface SquareConfig {
  apiKey: string
  applicationId: string
  locationId: string
}

interface SquareTokenizeInput {
  sourceId: string // From Square Web Payments SDK
  cardholderName: string
  customerId?: string
}

interface SquareProcessPaymentInput {
  sourceId: string
  amountCents: number
  currency: string
  customerId: string
  idempotencyKey: string
  orderId?: string
  metadata?: Record<string, string>
  statementDescriptor?: string
}

interface SquareRefundInput {
  paymentId: string
  amountCents?: number
  reason?: string
}

export class SquareAdapter {
  private client: Client
  private locationId: string

  constructor(config: SquareConfig) {
    this.client = new Client({
      accessToken: config.apiKey,
      environment:
        process.env.NODE_ENV === 'production'
          ? Environment.Production
          : Environment.Sandbox,
    })
    this.locationId = config.locationId
  }

  /**
   * Create or get Square customer
   */
  async getOrCreateCustomer(
    customerId: string,
    customerEmail: string,
    customerName: string
  ): Promise<string> {
    try {
      const { result } = await this.client.customersApi.searchCustomers({
        query: {
          filter: {
            emailAddress: {
              exact: customerEmail,
            },
          },
        },
      })

      if (result.customers && result.customers.length > 0) {
        return result.customers[0].id || ''
      }

      // Create new customer
      const { result: newCustomer } = await this.client.customersApi.createCustomer({
        givenName: customerName.split(' ')[0],
        familyName: customerName.split(' ').slice(1).join(' '),
        emailAddress: customerEmail,
        referenceId: customerId,
      })

      return newCustomer.customer?.id || ''
    } catch (error) {
      logger.error({ error }, 'Error creating Square customer')
      throw new Error(
        `Failed to create Square customer: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Store payment method (tokenize)
   */
  async tokenizePaymentMethod(
    input: SquareTokenizeInput,
    squareCustomerId: string
  ): Promise<{ paymentSourceId: string; last4: string; brand: string }> {
    try {
      // In production, card data should come from Square Web Payments SDK
      // We store the sourceId (nonce) which is PCI-compliant
      const sourceId = input.sourceId

      return {
        paymentSourceId: sourceId,
        last4: 'xxxx', // Would be populated from actual card details
        brand: 'UNKNOWN', // Would be determined from token response
      }
    } catch (error) {
      logger.error({ error }, 'Error tokenizing payment method')
      throw new Error(
        `Payment method tokenization failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  /**
   * Process payment through Square
   */
  async processPayment(input: SquareProcessPaymentInput): Promise<{
    transactionId: string
    status: string
    orderId?: string
    receiptUrl?: string
  }> {
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
      } as any)

      if (!result.payment) {
        throw new Error('No payment result returned')
      }

      return {
        transactionId: result.payment.id || '',
        status: result.payment.status || 'unknown',
        orderId: result.payment.orderId,
        receiptUrl: result.payment.receiptUrl,
      }
    } catch (error) {
      logger.error({ error }, 'Error processing Square payment')
      throw new Error(
        `Payment processing failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Create order for payment
   */
  async createOrder(
    customerId: string,
    amountCents: number,
    currency: string,
    lineItems: Array<{ name: string; quantity: number; amount: number }>
  ): Promise<string> {
    try {
      const { result } = await (this.client.ordersApi as any).createOrder(this.locationId, {
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
      })

      return result.order?.id || ''
    } catch (error) {
      logger.error({ error }, 'Error creating order')
      throw new Error(
        `Order creation failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Process refund
   */
  async refundPayment(input: SquareRefundInput): Promise<{
    refundId: string
    status: string
    amountCents: number
  }> {
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
      } as any)

      if (!result.refund) {
        throw new Error('No refund result returned')
      }

      return {
        refundId: result.refund.id || '',
        status: result.refund.status || 'unknown',
        amountCents: Number(result.refund.amountMoney?.amount || 0),
      }
    } catch (error) {
      logger.error({ error }, 'Error refunding Square payment')
      throw new Error(
        `Payment refund failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Retrieve payment details
   */
  async getPayment(paymentId: string): Promise<any> {
    try {
      const { result } = await this.client.paymentsApi.getPayment(paymentId)
      return result.payment
    } catch (error) {
      logger.error({ error }, 'Error retrieving payment')
      throw error
    }
  }

  /**
   * Search payments
   */
  async searchPayments(customerId: string, beginTime?: number): Promise<any[]> {
    try {
      const { result } = await (this.client.paymentsApi as any).listPayments(
        beginTime ? String(beginTime) : undefined,
        100,
        undefined,
        customerId
      )
      return result.payments || []
    } catch (error) {
      logger.error({ error }, 'Error searching payments')
      throw error
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhookEvent(eventType: string, payload: Record<string, any>): Promise<any> {
    switch (eventType) {
      case 'payment.created':
        return this.handlePaymentCreated(payload)
      case 'payment.updated':
        return this.handlePaymentUpdated(payload)
      case 'payment.completed':
        return this.handlePaymentCompleted(payload)
      case 'refund.created':
        return this.handleRefundCreated(payload)
      case 'refund.updated':
        return this.handleRefundUpdated(payload)
      default:
        logger.info({ eventType }, 'Unhandled Square event type')
        return null
    }
  }

  private handlePaymentCreated(payload: Record<string, any>): any {
    return {
      type: 'payment_created',
      paymentId: payload.data?.object?.payment?.id,
      status: payload.data?.object?.payment?.status,
    }
  }

  private handlePaymentUpdated(payload: Record<string, any>): any {
    return {
      type: 'payment_updated',
      paymentId: payload.data?.object?.payment?.id,
      status: payload.data?.object?.payment?.status,
    }
  }

  private handlePaymentCompleted(payload: Record<string, any>): any {
    return {
      type: 'payment_completed',
      paymentId: payload.data?.object?.payment?.id,
      status: 'completed',
    }
  }

  private handleRefundCreated(payload: Record<string, any>): any {
    return {
      type: 'refund_created',
      refundId: payload.data?.object?.refund?.id,
      paymentId: payload.data?.object?.refund?.paymentId,
      status: payload.data?.object?.refund?.status,
    }
  }

  private handleRefundUpdated(payload: Record<string, any>): any {
    return {
      type: 'refund_updated',
      refundId: payload.data?.object?.refund?.id,
      status: payload.data?.object?.refund?.status,
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    body: string,
    signature: string,
    webhookSecret: string
  ): boolean {
    try {
      const hash = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('base64')
      return hash === signature
    } catch {
      return false
    }
  }
}

import crypto from 'crypto'
