import crypto from 'crypto'
import { Stripe } from 'stripe'

/**
 * Stripe Payment Processor Adapter
 * Handles Stripe API integration for card payments, tokenization, and refunds
 */

interface StripeConfig {
  apiKey: string
  webhookSecret: string
}

interface TokenizeCardInput {
  cardNumber: string
  expiryMonth: number
  expiryYear: number
  cvc: string
  cardholderName: string
  customerId?: string
}

interface ProcessPaymentInput {
  customerId: string
  amount: number // in cents
  currency: string
  paymentMethodId?: string
  cardToken?: string
  description: string
  metadata?: Record<string, string>
  idempotencyKey: string
  saveCard?: boolean
  statementDescriptor?: string
}

interface AuthorizePaymentInput extends ProcessPaymentInput {
  requiresConfirmation?: boolean
}

interface CapturePaymentInput {
  paymentIntentId: string
  amountCents: number
}

interface RefundInput {
  chargeId: string
  amountCents?: number
  reason?: string
  metadata?: Record<string, string>
}

interface WebhookPayload {
  id: string
  object: string
  type: string
  created: number
  data: {
    object: any
  }
}

export class StripeAdapter {
  private stripe: Stripe
  private webhookSecret: string

  constructor(config: StripeConfig) {
    this.stripe = new Stripe(config.apiKey, {
      apiVersion: '2024-04-10',
      httpClient: undefined,
    })
    this.webhookSecret = config.webhookSecret
  }

  /**
   * Create or get Stripe customer
   */
  async getOrCreateCustomer(
    customerId: string,
    customerEmail: string,
    customerName: string
  ): Promise<string> {
    try {
      // Try to retrieve existing customer
      const customers = await this.stripe.customers.search({
        query: `email:"${customerEmail}"`,
        limit: 1,
      })

      if (customers.data.length > 0) {
        return customers.data[0].id
      }

      // Create new customer
      const customer = await this.stripe.customers.create({
        email: customerEmail,
        name: customerName,
        metadata: {
          aether_customer_id: customerId,
        },
      })

      return customer.id
    } catch (error) {
      console.error('Error creating Stripe customer:', error)
      throw new Error(`Failed to create Stripe customer: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Create payment method token from card details (PCI-safe via Stripe)
   */
  async tokenizeCard(
    input: TokenizeCardInput,
    stripeCustomerId: string
  ): Promise<{ paymentMethodId: string; last4: string; brand: string }> {
    try {
      // Create payment method
      const paymentMethod = await this.stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: input.cardNumber,
          exp_month: input.expiryMonth,
          exp_year: input.expiryYear,
          cvc: input.cvc,
        },
        billing_details: {
          name: input.cardholderName,
        },
      })

      // Attach to customer
      await this.stripe.paymentMethods.attach(paymentMethod.id, {
        customer: stripeCustomerId,
      })

      const cardDetails = paymentMethod.card
      return {
        paymentMethodId: paymentMethod.id,
        last4: cardDetails?.last4 || '',
        brand: cardDetails?.brand?.toUpperCase() || 'UNKNOWN',
      }
    } catch (error) {
      console.error('Error tokenizing card:', error)
      throw new Error(
        `Card tokenization failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Process payment with Stripe
   */
  async processPayment(input: ProcessPaymentInput): Promise<{
    paymentIntentId: string
    status: string
    transactionId?: string
    clientSecret?: string
    requiresAction: boolean
    actionUrl?: string
  }> {
    try {
      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        customer: input.customerId,
        description: input.description,
        metadata: {
          ...input.metadata,
          idempotency_key: input.idempotencyKey,
        },
        statement_descriptor: input.statementDescriptor?.substring(0, 22),
      }

      // Use saved payment method or create from token
      if (input.paymentMethodId) {
        paymentIntentData.payment_method = input.paymentMethodId
        paymentIntentData.confirm = true
        paymentIntentData.return_url = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-confirmation`
      } else if (input.cardToken) {
        paymentIntentData.payment_method_data = {
          type: 'card',
          card: {
            token: input.cardToken,
          },
        }
      }

      const paymentIntent = await this.stripe.paymentIntents.create(
        paymentIntentData,
        { idempotencyKey: input.idempotencyKey }
      )

      const result: any = {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        requiresAction: paymentIntent.status === 'requires_action',
      }

      if (paymentIntent.status === 'requires_action' && paymentIntent.client_secret) {
        result.clientSecret = paymentIntent.client_secret
        result.actionUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/3d-secure/${paymentIntent.id}`
      }

      if (paymentIntent.charges.data.length > 0) {
        result.transactionId = paymentIntent.charges.data[0].id
      }

      return result
    } catch (error) {
      console.error('Error processing Stripe payment:', error)
      throw new Error(
        `Payment processing failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Authorize payment (for later capture)
   */
  async authorizePayment(input: AuthorizePaymentInput): Promise<{
    paymentIntentId: string
    status: string
    transactionId?: string
    clientSecret?: string
    requiresAction: boolean
  }> {
    try {
      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: input.amount,
        currency: input.currency.toLowerCase(),
        customer: input.customerId,
        description: input.description,
        capture_method: 'manual', // Authorize without capture
        payment_method: input.paymentMethodId,
        confirm: true,
        metadata: input.metadata,
        statement_descriptor: input.statementDescriptor?.substring(0, 22),
      }

      const paymentIntent = await this.stripe.paymentIntents.create(
        paymentIntentData,
        { idempotencyKey: input.idempotencyKey }
      )

      const result: any = {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        requiresAction: paymentIntent.status === 'requires_action',
        clientSecret: paymentIntent.client_secret,
      }

      if (paymentIntent.charges.data.length > 0) {
        result.transactionId = paymentIntent.charges.data[0].id
      }

      return result
    } catch (error) {
      console.error('Error authorizing Stripe payment:', error)
      throw new Error(
        `Payment authorization failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Capture previously authorized payment
   */
  async capturePayment(input: CapturePaymentInput): Promise<{
    status: string
    transactionId: string
  }> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(
        input.paymentIntentId
      )

      return {
        status: paymentIntent.status,
        transactionId: paymentIntent.charges.data[0]?.id || '',
      }
    } catch (error) {
      console.error('Error capturing Stripe payment:', error)
      throw new Error(
        `Payment capture failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(input: RefundInput): Promise<{
    refundId: string
    status: string
    amountCents: number
  }> {
    try {
      const refund = await this.stripe.refunds.create({
        charge: input.chargeId,
        amount: input.amountCents,
        reason: (input.reason as Stripe.RefundCreateParams.Reason) || 'requested_by_customer',
        metadata: input.metadata,
      })

      return {
        refundId: refund.id,
        status: refund.status,
        amountCents: refund.amount,
      }
    } catch (error) {
      console.error('Error refunding Stripe payment:', error)
      throw new Error(
        `Payment refund failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    body: string,
    signature: string
  ): WebhookPayload | null {
    try {
      const event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        this.webhookSecret
      )
      return event as WebhookPayload
    } catch (error) {
      console.error('Webhook signature verification failed:', error)
      return null
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhookEvent(event: WebhookPayload): Promise<any> {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return this.handlePaymentIntentSucceeded(event.data.object)
      case 'payment_intent.payment_failed':
        return this.handlePaymentIntentFailed(event.data.object)
      case 'charge.refunded':
        return this.handleChargeRefunded(event.data.object)
      case 'charge.dispute.created':
        return this.handleChargeDispute(event.data.object)
      default:
        console.log(`Unhandled event type: ${event.type}`)
        return null
    }
  }

  private handlePaymentIntentSucceeded(paymentIntent: any): {
    type: string
    transactionId: string
    status: string
  } {
    return {
      type: 'payment_succeeded',
      transactionId: paymentIntent.charges?.data[0]?.id,
      status: paymentIntent.status,
    }
  }

  private handlePaymentIntentFailed(paymentIntent: any): {
    type: string
    transactionId: string
    error: string
  } {
    return {
      type: 'payment_failed',
      transactionId: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message || 'Payment failed',
    }
  }

  private handleChargeRefunded(charge: any): {
    type: string
    transactionId: string
    refunded: boolean
  } {
    return {
      type: 'charge_refunded',
      transactionId: charge.id,
      refunded: charge.refunded,
    }
  }

  private handleChargeDispute(dispute: any): {
    type: string
    transactionId: string
    reason: string
  } {
    return {
      type: 'charge_dispute',
      transactionId: dispute.charge,
      reason: dispute.reason,
    }
  }

  /**
   * Retrieve payment intent details
   */
  async getPaymentIntent(paymentIntentId: string): Promise<any> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId)
    } catch (error) {
      console.error('Error retrieving payment intent:', error)
      throw error
    }
  }

  /**
   * List payment methods for customer
   */
  async getCustomerPaymentMethods(customerId: string): Promise<any[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      })
      return paymentMethods.data
    } catch (error) {
      console.error('Error retrieving payment methods:', error)
      throw error
    }
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await this.stripe.paymentMethods.detach(paymentMethodId)
    } catch (error) {
      console.error('Error deleting payment method:', error)
      throw error
    }
  }
}
