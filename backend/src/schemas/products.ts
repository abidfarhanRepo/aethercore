import { z } from 'zod'
import { idSchema } from './common'

export const productParamsSchema = z.object({
  id: idSchema,
})

export const createProductBodySchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  priceCents: z.number().int().nonnegative(),
  costCents: z.number().int().nonnegative().optional(),
})

export const updateProductBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  priceCents: z.number().int().nonnegative().optional(),
  costCents: z.number().int().nonnegative().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
})

export type ProductParams = z.infer<typeof productParamsSchema>
export type CreateProductBody = z.infer<typeof createProductBodySchema>
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>
