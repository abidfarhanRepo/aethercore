import { z } from 'zod'

export const uuidLikeSchema = z.string().min(1)
export const idSchema = z.string().min(1)
export const positiveIntSchema = z.number().int().positive()
export const nonNegativeIntSchema = z.number().int().nonnegative()
export const optionalStringSchema = z.string().trim().min(1).optional()

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const saleItemSchema = z.object({
  productId: idSchema,
  qty: positiveIntSchema,
  unitPrice: nonNegativeIntSchema,
})

export const paymentLineSchema = z.object({
  method: z.string().trim().min(1),
  amountCents: nonNegativeIntSchema,
  reference: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional(),
})
