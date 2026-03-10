import { z } from 'zod'
import { idSchema, paymentLineSchema, saleItemSchema } from './common'

export const saleIdParamsSchema = z.object({
  id: idSchema,
})

export const createSaleBodySchema = z.object({
  items: z.array(saleItemSchema).min(1),
  customerId: idSchema.optional(),
  userId: idSchema.optional(),
  receiptPublicId: z.string().trim().optional(),
  terminalId: z.string().trim().optional(),
  sessionId: z.string().trim().optional(),
  offlineOpId: z.string().trim().optional(),
  syncState: z.string().trim().optional(),
  paymentMethod: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  clientCreatedAt: z.string().datetime().optional(),
  discounts: z.array(z.object({
    reason: z.string().trim().min(1),
    type: z.enum(['PERCENTAGE', 'FIXED']),
    value: z.number().nonnegative(),
  })).optional(),
  payments: z.array(paymentLineSchema).optional(),
})

export const listSalesQuerySchema = z.object({
  status: z.string().trim().optional(),
  paymentMethod: z.string().trim().optional(),
  customerId: idSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const salesAnalyticsQuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
})

export const refundBodySchema = z.object({
  type: z.enum(['full', 'partial']),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  items: z.array(z.object({
    itemId: idSchema,
    qty: z.number().int().positive(),
  })).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'partial' && (!value.items || value.items.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'items are required for partial refund', path: ['items'] })
  }
})

export const returnBodySchema = z.object({
  itemId: idSchema,
  qty: z.number().int().positive(),
  reason: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  refundAmountCents: z.number().int().nonnegative().optional(),
  restockQty: z.number().int().nonnegative().optional(),
})

export const voidBodySchema = z.object({
  reason: z.string().trim().min(1),
})

export type SaleIdParams = z.infer<typeof saleIdParamsSchema>
export type CreateSaleBody = z.infer<typeof createSaleBodySchema>
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>
export type SalesAnalyticsQuery = z.infer<typeof salesAnalyticsQuerySchema>
export type RefundBody = z.infer<typeof refundBodySchema>
export type ReturnBody = z.infer<typeof returnBodySchema>
export type VoidBody = z.infer<typeof voidBodySchema>
