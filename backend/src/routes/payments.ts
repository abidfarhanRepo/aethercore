import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../utils/db'
import { StripeAdapter } from '../lib/payments/stripe'
import { SquareAdapter } from '../lib/payments/square'
import { PayPalAdapter } from '../lib/payments/paypal'
import {
  encryptSensitiveData,
  decryptSensitiveData,
  generateIdempotencyKey,
  maskCardNumber,
  getCardLastFour,
  logPaymentAttempt,
  validatePaymentAmount,
  validateProcessorConfig,
  detectCardBrand,
} from '../lib/payments'
import { checkIdempotency, saveIdempotency } from '../utils/idempotency'

// Payment processor instances (initialized when needed)
const processors: Record<string, any> = {}
const SUPPORTED_PROCESSORS = ['STRIPE', 'SQUARE', 'PAYPAL'] as const

function paymentProviderEnabledKey(name: string): string {
  return `payment_provider_${name.toLowerCase()}_enabled`
}

function paymentProviderDummyKey(name: string): string {
  return `payment_provider_${name.toLowerCase()}_dummy_mode`
}

function normalizeProcessorName(name: string): string {
  return String(name || '').trim().toUpperCase()
}

async function getSettingValue(key: string): Promise<string | null> {
  const setting = await prisma.settings.findUnique({ where: { key } })
  return setting?.value || null
}

async function getBooleanSetting(
  key: string,
  fallback: boolean
): Promise<boolean> {
  const value = await getSettingValue(key)
  if (value === null) return fallback
  return value.toLowerCase() === 'true'
}

async function upsertSetting(
  key: string,
  value: string,
  type: 'string' | 'number' | 'boolean' | 'json',
  label: string,
  description: string
) {
  await prisma.settings.upsert({
    where: { key },
    update: { value, type, label, description, category: 'payment' },
    create: { key, value, type, label, description, category: 'payment' },
  })
}

function buildDummyPaymentResult(
  processorName: string,
  saleId: string,
  idempotencyKey: string
) {
  const normalized = normalizeProcessorName(processorName)
  return {
    status: 'succeeded',
    requiresAction: false,
    transactionId: `dummy_${normalized}_${saleId}_${idempotencyKey.slice(0, 8)}`,
    paymentIntentId: `dummy_pi_${idempotencyKey.slice(0, 16)}`,
    actionUrl: undefined,
    clientSecret: undefined,
  }
}

async function ensureProcessorRecord(name: string) {
  const normalizedName = normalizeProcessorName(name)
  const existing = await prisma.paymentProcessor.findUnique({
    where: { name: normalizedName },
  })

  if (existing) {
    return existing
  }

  return prisma.paymentProcessor.create({
    data: {
      name: normalizedName,
      displayName: normalizedName,
      apiKey: encryptSensitiveData(`dummy_${normalizedName}_key`),
      secretKey: encryptSensitiveData(`dummy_${normalizedName}_secret`),
      webhookSecret: encryptSensitiveData(`dummy_${normalizedName}_webhook`),
      isActive: false,
    },
  })
}

/**
 * Authenticate payment endpoints (requires ADMIN or specific permissions)
 */
async function authPaymentAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
    const user = req.user as any
    if (user.role !== 'ADMIN') {
      reply.code(403).send({ error: 'Admin access required' })
    }
  } catch (error) {
    reply.code(401).send({ error: 'Unauthorized' })
  }
}

/**
 * Get payment processor instance
 */
function getProcessor(processorName: string): any {
  const name = processorName.toUpperCase()

  if (!processors[name]) {
    throw new Error(`Payment processor not configured: ${name}`)
  }

  return processors[name]
}

/**
 * Initialize processors from database
 */
async function initializeProcessors() {
  const paymentProcessors = await prisma.paymentProcessor.findMany({
    where: { isActive: true },
  })

  for (const proc of paymentProcessors) {
    const config: any = {
      apiKey: decryptSensitiveData(proc.apiKey),
    }

    if (proc.secretKey) {
      config.secretKey = decryptSensitiveData(proc.secretKey)
    }
    if (proc.webhookSecret) {
      config.webhookSecret = decryptSensitiveData(proc.webhookSecret)
    }

    switch (proc.name) {
      case 'STRIPE':
        config.webhookSecret = proc.webhookSecret
          ? decryptSensitiveData(proc.webhookSecret)
          : ''
        processors['STRIPE'] = new StripeAdapter(config)
        break

      case 'SQUARE':
        config.applicationId = config.apiKey.split('|')[0] // Assumed format
        config.locationId = process.env.SQUARE_LOCATION_ID || ''
        processors['SQUARE'] = new SquareAdapter(config)
        break

      case 'PAYPAL':
        config.clientId = config.apiKey
        config.clientSecret = decryptSensitiveData(proc.secretKey || '')
        config.webhookId = process.env.PAYPAL_WEBHOOK_ID || ''
        processors['PAYPAL'] = new PayPalAdapter(config)
        break
    }
  }
}

export default async function paymentRoutes(fastify: FastifyInstance) {
  // Initialize processors on first load
  await initializeProcessors()

  /**
   * POST /api/payments/process
   * Process payment (generic endpoint that selects processor)
   */
  fastify.post<{
    Body: {
      saleId: string
      processor: string
      amount: number
      cardToken?: string
      paymentMethodId?: string
      cardNumber?: string
      expiryMonth?: number
      expiryYear?: number
      cvv?: string
      cardholderName?: string
      saveCard?: boolean
    }
  }>('/api/payments/process', async (req, reply) => {
    try {
      await req.jwtVerify()
      const user = req.user as any

      const {
        saleId,
        processor,
        amount,
        cardToken,
        paymentMethodId,
        cardNumber,
        expiryMonth,
        expiryYear,
        cvv,
        cardholderName,
        saveCard,
      } = req.body

      // Validate payment amount
      if (!validatePaymentAmount(amount)) {
        return reply
          .code(400)
          .send({ error: 'Invalid payment amount' })
      }

      // Validate sale exists
      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { customer: true },
      })

      if (!sale) {
        return reply.code(404).send({ error: 'Sale not found' })
      }

      // Verify amount doesn't exceed sale total
      if (amount > sale.totalCents) {
        return reply.code(400).send({
          error: 'Payment amount exceeds sale total',
        })
      }

      const normalizedProcessor = normalizeProcessorName(processor)
      if (!SUPPORTED_PROCESSORS.includes(normalizedProcessor as any)) {
        return reply.code(400).send({
          error: `Unsupported payment processor: ${processor}`,
        })
      }

      const providerEnabled = await getBooleanSetting(
        paymentProviderEnabledKey(normalizedProcessor),
        false
      )

      if (!providerEnabled) {
        return reply.code(400).send({
          error: `${normalizedProcessor} is disabled in settings`,
        })
      }

      const idempotencyHeader = req.headers['idempotency-key']
      const idempotencyKey =
        (typeof idempotencyHeader === 'string' && idempotencyHeader.trim()) ||
        generateIdempotencyKey()

      const cached = await checkIdempotency(idempotencyKey)
      if (cached.exists) {
        fastify.log.info({ idempotencyKey }, 'Returning cached payment response')
        return reply.code(200).send(cached.result)
      }

      const dummyMode = await getBooleanSetting(
        paymentProviderDummyKey(normalizedProcessor),
        true
      )
      const proc = !dummyMode ? getProcessor(normalizedProcessor) : null

      try {
        let stripeCustomerId: string | null = null
        let paymentMethodIdToUse = paymentMethodId

        // Create/get customer in processor
        if (sale.customer) {
          if (normalizedProcessor === 'STRIPE' && proc) {
            stripeCustomerId = await (
              proc as StripeAdapter
            ).getOrCreateCustomer(
              sale.customerId!,
              sale.customer.email!,
              sale.customer.name
            )
          } else if (normalizedProcessor === 'SQUARE' && proc) {
            // Similar for Square
          } else if (normalizedProcessor === 'PAYPAL' && proc) {
            // PayPal handles customer differently
          }
        }

        // Tokenize card if provided
        if (
          cardNumber &&
          expiryMonth &&
          expiryYear &&
          cvv &&
          cardholderName &&
          !paymentMethodId
        ) {
          if (normalizedProcessor === 'STRIPE' && stripeCustomerId && proc) {
            const tokenized = await (proc as StripeAdapter).tokenizeCard(
              {
                cardNumber,
                expiryMonth,
                expiryYear,
                cvc: cvv,
                cardholderName,
                customerId: sale.customerId || undefined,
              },
              stripeCustomerId
            )
            paymentMethodIdToUse = tokenized.paymentMethodId

            // Save payment token if requested
            if (saveCard && sale.customerId) {
              await prisma.paymentToken.create({
                data: {
                  customerId: sale.customerId,
                  processorId: (
                    await prisma.paymentProcessor.findUniqueOrThrow({
                      where: { name: 'STRIPE' },
                    })
                  ).id,
                  tokenValue: encryptSensitiveData(tokenized.paymentMethodId),
                  cardLast4: tokenized.last4,
                  cardBrand: tokenized.brand,
                  expiryMonth,
                  expiryYear,
                  cardholderName,
                },
              })
            }
          }
        }

        // Process payment
        let paymentResult: any

        if (dummyMode) {
          paymentResult = buildDummyPaymentResult(
            normalizedProcessor,
            saleId,
            idempotencyKey
          )
        } else if (normalizedProcessor === 'STRIPE') {
          paymentResult = await (proc as StripeAdapter).processPayment({
            customerId: stripeCustomerId || 'unknown',
            amount,
            currency: 'USD',
            paymentMethodId: paymentMethodIdToUse,
            cardToken,
            description: `Sale ${saleId}`,
            idempotencyKey,
            saveCard,
            statementDescriptor: 'AETHER POS',
          })
        } else if (normalizedProcessor === 'SQUARE') {
          const squareCustomerId = sale.customer
            ? await (proc as SquareAdapter).getOrCreateCustomer(
                sale.customerId || 'guest',
                sale.customer.email || 'guest@example.com',
                sale.customer.name || 'Guest'
              )
            : 'guest'

          paymentResult = await (proc as SquareAdapter).processPayment({
            sourceId: cardToken || paymentMethodIdToUse || 'manual_entry',
            amountCents: amount,
            currency: 'USD',
            customerId: squareCustomerId,
            idempotencyKey,
            metadata: {
              saleId,
            },
          })
        } else if (normalizedProcessor === 'PAYPAL') {
          const paypal = proc as PayPalAdapter
          const order = await paypal.createOrder({
            amountCents: amount,
            currency: 'USD',
            reference: saleId,
            description: `Sale ${saleId}`,
            returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payments/complete`,
            cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payments/cancel`,
            customerId: sale.customerId || undefined,
          })

          const capture = await paypal.captureOrder({
            orderId: order.orderId,
            customerId: sale.customerId || 'guest',
          })

          paymentResult = {
            status: capture.status,
            requiresAction: false,
            transactionId: capture.transactionId,
            paymentIntentId: order.orderId,
          }
        }

        // Get transaction ID (varies by processor)
        const transactionId =
          paymentResult.transactionId || paymentResult.paymentIntentId

        // Save payment record
        const paymentRecord = await prisma.payment.create({
          data: {
            saleId,
            processorId: (await ensureProcessorRecord(normalizedProcessor)).id,
            amountCents: amount,
            currency: 'USD',
            status:
              ['succeeded', 'COMPLETED', 'CAPTURED', 'SUCCESS'].includes(
                String(paymentResult.status)
              )
                ? 'CAPTURED'
                : paymentResult.requiresAction
                  ? 'PROCESSING'
                  : 'FAILED',
            transactionId,
            paymentIntentId: paymentResult.paymentIntentId,
            idempotencyKey,
            cardLast4: cardNumber
              ? getCardLastFour(cardNumber)
              : undefined,
            cardBrand: cardNumber ? detectCardBrand(cardNumber) : undefined,
            clientSecret: paymentResult.clientSecret,
            requiresAction: paymentResult.requiresAction || false,
            actionUrl: paymentResult.actionUrl,
            createdBy: user.id,
            processedAt: new Date(),
          },
        })

        // Log payment attempt
        logPaymentAttempt(
          transactionId,
          normalizedProcessor,
          amount,
          cardNumber ? getCardLastFour(cardNumber) : 'xxxx',
          paymentRecord.status === 'CAPTURED' ? 'success' : 'pending'
        )

        const responsePayload = {
          success: true,
          paymentId: paymentRecord.id,
          transactionId,
          status: paymentRecord.status,
          requiresAction: paymentResult.requiresAction,
          clientSecret: paymentResult.clientSecret,
          actionUrl: paymentResult.actionUrl,
        }

        await saveIdempotency(idempotencyKey, responsePayload)

        return reply.code(201).send(responsePayload)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        // Log failed payment attempt
        logPaymentAttempt(
          'unknown',
          normalizedProcessor,
          amount,
          cardNumber ? getCardLastFour(cardNumber) : 'xxxx',
          'failure',
          errorMessage
        )

        return reply.code(400).send({
          error: 'Payment processing failed',
          details: errorMessage,
        })
      }
    } catch (error) {
      fastify.log.error(error)
      return reply.code(500).send({
        error: 'Internal server error',
      })
    }
  })

  /**
   * POST /api/payments/stripe
   * Process Stripe payment (convenience endpoint)
   */
  fastify.post<{
    Body: {
      saleId: string
      paymentMethodId: string
      amount: number
      save?: boolean
    }
  }>('/api/payments/stripe', async (req, reply) => {
    try {
      await req.jwtVerify()

      const { saleId, paymentMethodId, amount, save } = req.body

      // Reuse main endpoint
      const injected = await req.server.inject({
        method: 'POST',
        url: '/api/payments/process',
        payload: {
          saleId,
          processor: 'STRIPE',
          amount,
          paymentMethodId,
          saveCard: save,
        },
        headers: req.headers,
      })

      return reply
        .code(injected.statusCode)
        .type('application/json')
        .send(injected.json())
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/payments/square
   * Process Square payment
   */
  fastify.post<{
    Body: {
      saleId: string
      sourceId: string
      amount: number
    }
  }>('/api/payments/square', async (req, reply) => {
    try {
      await req.jwtVerify()

      const { saleId, sourceId, amount } = req.body

      const injected = await req.server.inject({
        method: 'POST',
        url: '/api/payments/process',
        payload: {
          saleId,
          processor: 'SQUARE',
          amount,
          cardToken: sourceId,
        },
        headers: req.headers,
      })

      return reply
        .code(injected.statusCode)
        .type('application/json')
        .send(injected.json())
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/payments/paypal
   * Process PayPal payment
   */
  fastify.post<{
    Body: {
      saleId: string
      orderId: string
    }
  }>('/api/payments/paypal', async (req, reply) => {
    try {
      await req.jwtVerify()

      const { saleId, orderId } = req.body

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
      })

      if (!sale) {
        return reply.code(404).send({ error: 'Sale not found' })
      }

      const proc = getProcessor('PAYPAL') as PayPalAdapter

      try {
        const captureResult = await proc.captureOrder({
          orderId,
          customerId: sale.customerId || 'unknown',
        })

        const paymentRecord = await prisma.payment.create({
          data: {
            saleId,
            processorId: (
              await prisma.paymentProcessor.findUniqueOrThrow({
                where: { name: 'PAYPAL' },
              })
            ).id,
            amountCents: sale.totalCents,
            currency: 'USD',
            status:
              captureResult.status === 'COMPLETED' ? 'CAPTURED' : 'PROCESSING',
            transactionId: captureResult.transactionId,
            idempotencyKey: generateIdempotencyKey(),
            processedAt: new Date(),
          },
        })

        return reply.code(201).send({
          success: true,
          paymentId: paymentRecord.id,
          transactionId: captureResult.transactionId,
          status: paymentRecord.status,
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        return reply.code(400).send({
          error: 'PayPal payment failed',
          details: errorMessage,
        })
      }
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  /**
   * GET /api/payments/methods
   * List payment methods on file for a customer
   */
  fastify.get<{
    Querystring: {
      customerId: string
      processor?: string
    }
  }>('/api/payments/methods', async (req, reply) => {
    try {
      await req.jwtVerify()

      const { customerId, processor } = req.query

      const paymentTokens = await prisma.paymentToken.findMany({
        where: {
          customerId,
          processor: processor
            ? { name: processor }
            : undefined,
          status: 'active',
        },
        include: { processor: true },
      })

      const methods = paymentTokens.map((token) => ({
        id: token.id,
        processor: token.processor.name,
        cardLast4: token.cardLast4,
        cardBrand: token.cardBrand,
        isDefault: token.isDefault,
        expiryMonth: token.expiryMonth,
        expiryYear: token.expiryYear,
        createdAt: token.createdAt,
      }))

      return reply.send({
        success: true,
        methods,
      })
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/payments/:id/refund
   * Process refund for a payment
   */
  fastify.post<{
    Params: {
      id: string
    }
    Body: {
      amount?: number
      reason?: string
    }
  }>('/api/payments/:id/refund', async (req, reply) => {
    try {
      await req.jwtVerify()
      const user = req.user as any

      const { id } = req.params
      const { amount, reason } = req.body

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: { sale: true, processor: true },
      })

      if (!payment) {
        return reply.code(404).send({ error: 'Payment not found' })
      }

      if (payment.status !== 'CAPTURED') {
        return reply.code(400).send({
          error: 'Only captured payments can be refunded',
        })
      }

      const refundAmountCents = amount || payment.amountCents

      if (refundAmountCents > payment.amountCents - payment.refundedCents) {
        return reply.code(400).send({
          error: 'Refund amount exceeds available balance',
        })
      }

      try {
        let refundResult: any

        const proc = getProcessor(payment.processor.name)

        if (payment.processor.name === 'STRIPE') {
          refundResult = await (proc as StripeAdapter).refundPayment({
            chargeId: payment.transactionId,
            amountCents: refundAmountCents,
            reason: reason || 'Requested by merchant',
          })
        } else if (payment.processor.name === 'SQUARE') {
          refundResult = await (proc as SquareAdapter).refundPayment({
            paymentId: payment.transactionId,
            amountCents: refundAmountCents,
            reason,
          })
        } else if (payment.processor.name === 'PAYPAL') {
          refundResult = await (proc as PayPalAdapter).refundPayment({
            captureId: payment.transactionId,
            amountCents: refundAmountCents,
            reason,
          })
        }

        // Create refund record
        const refund = await prisma.refund.create({
          data: {
            paymentId: id,
            amountCents: refundAmountCents,
            reason: reason || 'CUSTOMER_REQUEST',
            status: 'COMPLETED',
            refundId: refundResult.refundId,
            processedAt: new Date(),
          },
        })

        // Update payment refunded amount
        await prisma.payment.update({
          where: { id },
          data: {
            refundedCents: payment.refundedCents + refundAmountCents,
          },
        })

        logPaymentAttempt(
          payment.transactionId,
          payment.processor.name,
          refundAmountCents,
          payment.cardLast4 || 'xxxx',
          'success'
        )

        return reply.code(201).send({
          success: true,
          refundId: refund.id,
          refundStatus: refund.status,
          amountRefundedCents: refundAmountCents,
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        return reply.code(400).send({
          error: 'Refund processing failed',
          details: errorMessage,
        })
      }
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/payments/:id/receipt
   * Email receipt
   */
  fastify.post<{
    Params: {
      id: string
    }
    Body: {
      recipientEmail: string
    }
  }>('/api/payments/:id/receipt', async (req, reply) => {
    try {
      await req.jwtVerify()

      const { id } = req.params
      const { recipientEmail } = req.body

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: { sale: { include: { items: true } } },
      })

      if (!payment) {
        return reply.code(404).send({ error: 'Payment not found' })
      }

      // TODO: Implement email sending logic
      // For now, just acknowledge the request

      return reply.send({
        success: true,
        message: 'Receipt email queued',
      })
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  /**
   * GET /payments/settings
   * Get payment processor configuration (ADMIN only)
   */
  fastify.get('/api/payments/settings', async (req, reply) => {
    try {
      await authPaymentAdmin(req, reply)

      const processors = await prisma.paymentProcessor.findMany({
        select: {
          id: true,
          name: true,
          displayName: true,
          isActive: true,
          webhookUrl: true,
          createdAt: true,
        },
      })

      const settings = await prisma.settings.findMany({
        where: {
          key: {
            in: [
              ...SUPPORTED_PROCESSORS.map((name) => paymentProviderEnabledKey(name)),
              ...SUPPORTED_PROCESSORS.map((name) => paymentProviderDummyKey(name)),
            ],
          },
        },
      })

      const settingsMap = settings.reduce(
        (acc, setting) => {
          acc[setting.key] = setting.value
          return acc
        },
        {} as Record<string, string>
      )

      const byName = processors.reduce(
        (acc, processor) => {
          acc[processor.name] = processor
          return acc
        },
        {} as Record<string, any>
      )

      const allProcessors = SUPPORTED_PROCESSORS.map((name) => {
        const dbProcessor = byName[name]
        return {
          id: dbProcessor?.id || name,
          name,
          displayName: dbProcessor?.displayName || name,
          isActive: Boolean(dbProcessor?.isActive),
          webhookUrl: dbProcessor?.webhookUrl,
          createdAt: dbProcessor?.createdAt || new Date().toISOString(),
          enabled:
            settingsMap[paymentProviderEnabledKey(name)]?.toLowerCase() ===
            'true',
          dummyMode:
            settingsMap[paymentProviderDummyKey(name)]?.toLowerCase() !==
            'false',
        }
      })

      return reply.send({
        success: true,
        processors: allProcessors,
      })
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/payments/settings
   * Update payment processor configuration (ADMIN only)
   */
  fastify.post<{
    Body: {
      name: string
      displayName: string
      apiKey?: string
      secretKey?: string
      webhookSecret?: string
      isActive: boolean
      enabled?: boolean
      dummyMode?: boolean
    }
  }>('/api/payments/settings', async (req, reply) => {
    try {
      await authPaymentAdmin(req, reply)

      const {
        name,
        displayName,
        apiKey,
        secretKey,
        webhookSecret,
        isActive,
        enabled,
        dummyMode,
      } =
        req.body

      const normalizedName = normalizeProcessorName(name)

      if (!SUPPORTED_PROCESSORS.includes(normalizedName as any)) {
        return reply.code(400).send({
          error: `Unsupported payment processor: ${name}`,
        })
      }

      if (typeof enabled === 'boolean') {
        await upsertSetting(
          paymentProviderEnabledKey(normalizedName),
          String(enabled),
          'boolean',
          `${normalizedName} Enabled`,
          `Enable or disable ${normalizedName} payment processing`
        )
      }

      if (typeof dummyMode === 'boolean') {
        await upsertSetting(
          paymentProviderDummyKey(normalizedName),
          String(dummyMode),
          'boolean',
          `${normalizedName} Dummy Mode`,
          `Use dummy transactions for ${normalizedName}`
        )
      }

      let processor = await ensureProcessorRecord(normalizedName)

      if (apiKey) {
        // Validate configuration only when sensitive keys are being updated.
        const validation = validateProcessorConfig(normalizedName, {
          apiKey,
          secretKey,
          webhookSecret,
          applicationId: process.env[`${normalizedName}_APP_ID`],
          locationId: process.env[`${normalizedName}_LOCATION_ID`],
        })

        if (!validation.valid) {
          return reply.code(400).send({
            error: 'Invalid processor configuration',
            details: validation.errors,
          })
        }

        processor = await prisma.paymentProcessor.update({
          where: { name: normalizedName },
          data: {
            displayName,
            apiKey: encryptSensitiveData(apiKey),
            secretKey: secretKey
              ? encryptSensitiveData(secretKey)
              : undefined,
            webhookSecret: webhookSecret
              ? encryptSensitiveData(webhookSecret)
              : undefined,
            isActive,
          },
        })
      } else {
        processor = await prisma.paymentProcessor.update({
          where: { name: normalizedName },
          data: {
            displayName,
            isActive,
          },
        })
      }

      // Reinitialize processors
      await initializeProcessors()

      return reply.code(201).send({
        success: true,
        processor: {
          id: processor.id,
          name: processor.name,
          displayName: processor.displayName,
          isActive: processor.isActive,
          enabled:
            typeof enabled === 'boolean'
              ? enabled
              : await getBooleanSetting(
                  paymentProviderEnabledKey(normalizedName),
                  false
                ),
          dummyMode:
            typeof dummyMode === 'boolean'
              ? dummyMode
              : await getBooleanSetting(
                  paymentProviderDummyKey(normalizedName),
                  true
                ),
        },
      })
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Internal server error' })
    }
  })

  /**
   * POST /api/payments/webhooks/stripe
   * Stripe webhook handler
   */
  fastify.post<{
    Body: any
  }>('/api/payments/webhooks/stripe', async (req, reply) => {
    try {
      const signature = req.headers['stripe-signature'] as string
      const body = JSON.stringify(req.body)

      const proc = getProcessor('STRIPE') as StripeAdapter
      const event = proc.verifyWebhookSignature(body, signature)

      if (!event) {
        return reply.code(400).send({ error: 'Invalid signature' })
      }

      // Store webhook event
      await prisma.paymentWebhookEvent.create({
        data: {
          processor: 'STRIPE',
          eventId: event.id,
          eventType: event.type,
          payload: event as any,
          signature,
          status: 'VERIFIED',
        },
      })

      // Handle event
      const result = await proc.handleWebhookEvent(event)

      // Update payment status based on event
      if (result && result.transactionId) {
        const payment = await prisma.payment.findUnique({
          where: { transactionId: result.transactionId },
        })

        if (payment) {
          if (result.type === 'payment_succeeded') {
            await prisma.payment.update({
              where: { id: payment.id },
              data: { status: 'CAPTURED' },
            })
          } else if (result.type === 'payment_failed') {
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: 'FAILED',
                errorMessage: result.error,
              },
            })
          }
        }
      }

      return reply.code(200).send({ received: true })
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Webhook processing failed' })
    }
  })

  /**
   * POST /api/payments/webhooks/square
   * Square webhook handler
   */
  fastify.post<{
    Body: any
  }>('/api/payments/webhooks/square', async (req, reply) => {
    try {
      const bodyData = req.body as any
      const signature = req.headers['x-square-hmac-sha256'] as string
      const body = JSON.stringify(bodyData)

      const proc = getProcessor('SQUARE') as SquareAdapter

      // Verify signature
      const webhookSecret = process.env.SQUARE_WEBHOOK_SECRET || ''
      if (!proc.verifyWebhookSignature(body, signature, webhookSecret)) {
        return reply.code(400).send({ error: 'Invalid signature' })
      }

      const event = bodyData.data?.object as any

      // Store webhook event
      await prisma.paymentWebhookEvent.create({
        data: {
          processor: 'SQUARE',
          eventId: bodyData.id,
          eventType: bodyData.type,
          payload: bodyData,
          signature,
          status: 'VERIFIED',
        },
      })

      // Handle event
      const result = await proc.handleWebhookEvent(bodyData.type, bodyData)

      return reply.code(200).send({ received: true })
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Webhook processing failed' })
    }
  })

  /**
   * POST /api/payments/webhooks/paypal
   * PayPal webhook handler
   */
  fastify.post<{
    Body: any
  }>('/api/payments/webhooks/paypal', async (req, reply) => {
    try {
      const bodyData = req.body as any
      const transmissionId = req.headers['paypal-transmission-id'] as string
      const transmissionTime = req.headers['paypal-transmission-time'] as string
      const certUrl = req.headers['paypal-cert-url'] as string
      const signature = req.headers['paypal-auth-algo'] as string
      const body = JSON.stringify(bodyData)
      const webhookId = process.env.PAYPAL_WEBHOOK_ID || ''

      const proc = getProcessor('PAYPAL') as PayPalAdapter

      // Verify signature
      if (
        !proc.verifyWebhookSignature(
          webhookId,
          body,
          req.headers['paypal-transmission-sig'] as string,
          transmissionId,
          transmissionTime,
          certUrl
        )
      ) {
        return reply.code(400).send({ error: 'Invalid signature' })
      }

      // Store webhook event
      await prisma.paymentWebhookEvent.create({
        data: {
          processor: 'PAYPAL',
          eventId: bodyData.id,
          eventType: bodyData.event_type,
          payload: bodyData,
          signature: req.headers['paypal-transmission-sig'] as string,
          status: 'VERIFIED',
        },
      })

      // Handle event
      const result = await proc.handleWebhookEvent(bodyData)

      return reply.code(200).send({ id: bodyData.id })
    } catch (error) {
      fastify.log.error(error)
      reply.code(500).send({ error: 'Webhook processing failed' })
    }
  })
}
