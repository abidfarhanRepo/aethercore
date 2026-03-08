import { z } from 'zod'
import { idSchema } from './common'

const processorSchema = z.enum(['STRIPE', 'SQUARE', 'PAYPAL'])

export const processPaymentBodySchema = z.object({
  saleId: idSchema,
  processor: processorSchema,
  amount: z.number().int().positive(),
  cardToken: z.string().trim().optional(),
  paymentMethodId: z.string().trim().optional(),
  cardNumber: z.string().trim().optional(),
  expiryMonth: z.number().int().min(1).max(12).optional(),
  expiryYear: z.number().int().min(2024).optional(),
  cvv: z.string().trim().optional(),
  cardholderName: z.string().trim().optional(),
  saveCard: z.boolean().optional(),
})

export const stripePaymentBodySchema = z.object({
  saleId: idSchema,
  paymentMethodId: z.string().trim().min(1),
  amount: z.number().int().positive(),
  save: z.boolean().optional(),
})

export const squarePaymentBodySchema = z.object({
  saleId: idSchema,
  sourceId: z.string().trim().min(1),
  amount: z.number().int().positive(),
})

export const paypalPaymentBodySchema = z.object({
  saleId: idSchema,
  orderId: z.string().trim().min(1),
})

export const paymentMethodsQuerySchema = z.object({
  customerId: idSchema,
  processor: z.string().trim().optional(),
})

export const paymentIdParamsSchema = z.object({
  id: idSchema,
})

export const refundPaymentBodySchema = z.object({
  amount: z.number().int().positive().optional(),
  reason: z.string().trim().optional(),
})

export const receiptBodySchema = z.object({
  recipientEmail: z.string().email(),
})

export const updatePaymentSettingsBodySchema = z.object({
  name: processorSchema,
  displayName: z.string().trim().min(1),
  apiKey: z.string().trim().optional(),
  secretKey: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional(),
  isActive: z.boolean(),
  enabled: z.boolean().optional(),
  dummyMode: z.boolean().optional(),
})

export type ProcessPaymentBody = z.infer<typeof processPaymentBodySchema>
export type StripePaymentBody = z.infer<typeof stripePaymentBodySchema>
export type SquarePaymentBody = z.infer<typeof squarePaymentBodySchema>
export type PaypalPaymentBody = z.infer<typeof paypalPaymentBodySchema>
export type PaymentMethodsQuery = z.infer<typeof paymentMethodsQuerySchema>
export type PaymentIdParams = z.infer<typeof paymentIdParamsSchema>
export type RefundPaymentBody = z.infer<typeof refundPaymentBodySchema>
export type ReceiptBody = z.infer<typeof receiptBodySchema>
export type UpdatePaymentSettingsBody = z.infer<typeof updatePaymentSettingsBodySchema>
